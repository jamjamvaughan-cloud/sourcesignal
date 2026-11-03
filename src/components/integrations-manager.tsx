"use client";

/**
 * IntegrationsManager — Client component for webhook + alert management.
 *
 * Fetches the caller's webhook destinations from GET /api/webhooks, lets the
 * user register, test and delete destinations, and displays delivery logs from
 * GET /api/alert-logs. All mutating calls include credentials so the session
 * cookie is forwarded to the API.
 */

import * as React from "react";
import {
  Plus,
  Trash2,
  Send,
  RefreshCw,
  ShieldCheck,
  Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Webhook {
  id: string;
  url: string;
  secret: string | null;
  sectorFilters: string[];
  minValue: number | null;
  isActive: boolean;
  createdAt: string;
}

interface AlertLog {
  id: string;
  webhookId: string;
  signalId: string | null;
  status: string;
  responseStatusCode: number | null;
  attemptedAt: string | null;
}

const SECTOR_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "TECH", label: "Technology" },
  { id: "ENERGY", label: "Energy" },
  { id: "HEALTHCARE", label: "Healthcare" },
  { id: "PUBLIC_SECTOR", label: "Public Sector" },
  { id: "CONSTRUCTION", label: "Construction" },
  { id: "TRANSPORT", label: "Transport" },
  { id: "LOGISTICS", label: "Logistics" },
];

async function fetchJSON<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  return res.json();
}

function statusBadge(status: string) {
  const isOk = status === "sent";
  return (
    <span className={`px-2 py-0.5 rounded font-mono text-[9px] uppercase tracking-[0.1em] ${
      isOk
        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
        : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
    }`}>
      {status}
    </span>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function IntegrationsManager() {
  const [webhooks, setWebhooks] = React.useState<Webhook[]>([]);
  const [alertLogs, setAlertLogs] = React.useState<AlertLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [formUrl, setFormUrl] = React.useState("");
  const [formSecret, setFormSecret] = React.useState("");
  const [formSectors, setFormSectors] = React.useState<string[]>([]);
  const [formMinValue, setFormMinValue] = React.useState("");
  const [formActive, setFormActive] = React.useState(true);

  const clearMessage = () => setTimeout(() => setMessage(null), 4000);

  React.useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [wh, logs] = await Promise.all([
        fetchJSON<{ items: Webhook[] }>("/api/webhooks"),
        fetchJSON<{ items: AlertLog[] }>("/api/alert-logs?perPage=20"),
      ]);
      setWebhooks(wh.items ?? []);
      setAlertLogs((logs.items ?? []).slice(0, 10));
    } catch (err) {
      setMessage({
        kind: "error",
        text:
          err instanceof Error ? err.message : "Failed to load integrations.",
      });
      clearMessage();
    } finally {
      setLoading(false);
    }
  }

  async function addWebhook(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetchJSON("/api/webhooks", {
        method: "POST",
        body: JSON.stringify({
          url: formUrl,
          secret: formSecret || undefined,
          sectorFilters: formSectors,
          minValue: formMinValue ? Number(formMinValue) : null,
          isActive: formActive,
        }),
      });
      setMessage({ kind: "ok", text: "Webhook registered." });
      clearMessage();
      setOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      setMessage({
        kind: "error",
        text:
          err instanceof Error ? err.message : "Failed to register webhook.",
      });
      clearMessage();
    } finally {
      setSaving(false);
    }
  }

  async function deleteWebhook(id: string) {
    if (!window.confirm("Delete this webhook destination?")) return;
    try {
      await fetchJSON(`/api/webhooks/${id}`, { method: "DELETE" });
      setMessage({ kind: "ok", text: "Webhook deleted." });
      clearMessage();
      await loadData();
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to delete webhook.",
      });
      clearMessage();
    }
  }

  async function testWebhook(id: string) {
    setTesting(id);
    try {
      const result = await fetchJSON(`/api/webhooks/${id}/test`, {
        method: "POST",
      });
      const ok = (result as { ok?: boolean }).ok ?? false;
      setMessage({
        kind: ok ? "ok" : "error",
        text: ok
          ? "Test delivery succeeded."
          : `Test delivery failed (${(result as { statusCode?: number }).statusCode ?? "unknown"}).`,
      });
      clearMessage();
      await loadData();
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Test delivery failed.",
      });
      clearMessage();
    } finally {
      setTesting(null);
    }
  }

  function resetForm() {
    setFormUrl("");
    setFormSecret("");
    setFormSectors([]);
    setFormMinValue("");
    setFormActive(true);
  }

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500 animate-pulse">
          Loading integrations…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 section-enter max-w-full min-w-0">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="headline mb-0.5">Integrations</h1>
          <p className="text-[10px] font-inter font-mono tracking-wider text-slate-500 uppercase">
            Configure webhook endpoints and delivery alerts.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`border px-3 py-2 rounded font-mono text-[9px] uppercase tracking-[0.1em] ${
            message.kind === "ok"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-slate-500/10 border-slate-500/20 text-slate-400"
          }`}
        >
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="ml-2 hover:underline"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Webhook destinations */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-D4AF37" />
              <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
                Webhook Endpoints
              </h2>
            </div>
            <Button
              onClick={() => setOpen(true)}
              variant="outline"
              size="sm"
            >
              <Plus className="h-3 w-3 mr-1.5" /> Add Endpoint
            </Button>
          </div>

          {webhooks.length === 0 ? (
            <EmptyStateIntegrations />
          ) : (
            <div className="space-y-2">
              {webhooks.map((wh) => (
                <div
                  key={wh.id}
                  className="border border-white/10 bg-[#0a0a0a] p-3 rounded-sm flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <p className="font-mono text-[10px] font-bold text-slate-200 truncate">
                        {wh.url}
                      </p>
                      <p className="font-mono text-[9px] text-slate-500">
                        {wh.sectorFilters.length > 0
                          ? wh.sectorFilters.join(" · ")
                          : "All sectors"}
                        {wh.minValue != null
                          ? ` · min £${Number(wh.minValue).toLocaleString()}`
                          : ""}
                        {wh.isActive ? "" : " · inactive"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className={`px-2 py-0.5 rounded font-mono text-[9px] uppercase tracking-[0.1em] ${
                        wh.isActive
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                      }`}>
                        {wh.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testWebhook(wh.id)}
                        disabled={testing === wh.id}
                        className="px-2 py-1.5"
                      >
                        {testing === wh.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteWebhook(wh.id)}
                        className="px-2 py-1.5 text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="font-mono text-[9px] text-slate-500">
                    Created {formatDate(wh.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Delivery logs */}
        <section className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
              Delivery Logs
            </h2>
            <Button size="sm" variant="outline" onClick={loadData}>
              <RefreshCw className="h-3 w-3 mr-1.5" /> Refresh
            </Button>
          </div>

          {alertLogs.length === 0 ? (
            <div className="border border-white/10 bg-[#0a0a0a] p-4 rounded-sm">
              <p className="font-mono text-[9px] text-slate-500 text-center">
                No delivery attempts yet.
              </p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[64vh] overflow-y-auto pr-1">
              {alertLogs.map((log) => (
                <div
                  key={log.id}
                  className="border border-white/5 bg-[#0a0a0a] p-2 rounded-sm"
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-mono text-[8px] text-slate-400 truncate flex-1">
                      Webhook {log.webhookId.slice(0, 8)}…
                    </span>
                    {statusBadge(log.status)}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[8px] text-slate-500">
                      {log.responseStatusCode ? `HTTP ${log.responseStatusCode}` : "—"}
                    </span>
                    <span className="font-mono text-[8px] text-slate-500">
                      {formatDate(log.attemptedAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-[8px] text-slate-600">
                      Signal {log.signalId ? log.signalId.slice(0, 8) + "…" : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="glass-card p-4 mt-6">
        <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Security Notice
        </div>
        <p className="text-[10px] font-inter text-slate-500 mb-2">
          Secret keys and credentials are never rendered in this interface. All
          secret values are stored server-side and are only accessible at
          creation time via server-side API endpoints. Rotate credentials
          immediately if compromise is suspected.
        </p>
      </div>

      {/* Add webhook sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger>
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={saving}
            className={`flex items-center gap-1.5 rounded-sm border border-white/10 bg-transparent px-3 py-1.5 text-[9px] font-inter font-semibold uppercase tracking-[0.1em] transition-colors ${
              saving
                ? "text-slate-500 border-slate-500/30 cursor-not-allowed"
                : "text-white hover:bg-white/5 hover:border-white/30"
            }`}
          >
            <Plus className="h-3 w-3 mr-1" /> Register Webhook
          </button>
        </SheetTrigger>
        <SheetContent>
          <SheetClose />
          <SheetHeader>
            <SheetTitle>Register Webhook Endpoint</SheetTitle>
            <SheetDescription>
              Destination URL and optional HMAC secret for signed deliveries.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={addWebhook} className="space-y-4 p-4">
            <div className="space-y-2">
              <Label>Destination URL</Label>
              <Input
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://hooks.example.com/source-signal"
                required
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Signing Secret (optional)</Label>
              <Input
                value={formSecret}
                onChange={(e) => setFormSecret(e.target.value)}
                placeholder="Leave blank for unsigned deliveries"
                type="password"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Sector Filters</Label>
              <p className="font-mono text-[9px] text-slate-500">
                Leave empty to receive all sectors.
              </p>
              <Select
                multiple
                value={formSectors}
                onValueChange={(val) => setFormSectors(val as string[])}
                disabled={saving}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select sectors…" />
                </SelectTrigger>
                <SelectContent>
                  {SECTOR_OPTIONS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Minimum Value (£)</Label>
              <Input
                type="number"
                value={formMinValue}
                onChange={(e) => setFormMinValue(e.target.value)}
                placeholder="e.g. 10000"
                disabled={saving}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                disabled={saving}
                className="rounded-sm border-white/10 bg-[#0a0a0a] text-D4AF37 focus:ring-D4AF37"
              />
              <Label>Active</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !formUrl}>
                {saving ? "Registering…" : "Register Webhook"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function EmptyStateIntegrations() {
  return (
    <div className="border border-white/10 bg-[#0a0a0a] p-6 rounded-sm text-center">
      <Monitor className="h-8 w-8 mx-auto mb-2 text-slate-600" />
      <p className="font-mono text-[9px] text-slate-500 mb-3">
        No webhook endpoints registered yet.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          // noop; handled by parent via open state
        }}
      >
        Register your first endpoint
      </Button>
    </div>
  );
}
