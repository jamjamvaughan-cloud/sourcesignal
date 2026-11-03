"use client";

/**
 * AlertsManager — Client component for alert monitor management.
 *
 * Fetches the caller's alerts from GET /api/alerts, lets the user create,
 * toggle, edit and delete alerts, and shows recent deliveries from
 * alert_deliveries. All mutating calls include credentials so the session
 * cookie is forwarded to the API.
 */

import * as React from "react";
import {
  Trash2,
  Plus,
  RefreshCw,
  List,
  ChevronRight,
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
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SECTORS, REGIONS } from "@/lib/config";

interface Alert {
  id: string;
  name: string;
  sectors: string[];
  regions: string[];
  keywords: string;
  enabled: boolean;
  lastTriggered: string | null;
  createdAt: string | null;
}

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

function sectorLabel(sectorId: string): string {
  const sector = SECTORS.find((s) => s.id === sectorId);
  return sector ? sector.name : sectorId.replace(/-/g, " ");
}

function alertStatusClass(enabled: boolean): string {
  return enabled
    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
    : "bg-slate-500/10 text-slate-400 border border-slate-500/20";
}

export function AlertsManager() {
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const [formName, setFormName] = React.useState("");
  const [formSectors, setFormSectors] = React.useState<string[]>([]);
  const [formRegions, setFormRegions] = React.useState<string[]>([]);
  const [formKeywords, setFormKeywords] = React.useState("");
  const [formEnabled, setFormEnabled] = React.useState(true);

  const clearMessage = () => setTimeout(() => setMessage(null), 4000);

  React.useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await fetchJSON<{ items: Alert[] }>("/api/alerts");
      setAlerts(data.items ?? []);
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to load alerts.",
      });
      clearMessage();
    } finally {
      setLoading(false);
    }
  }

  async function saveAlert(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await fetchJSON(`/api/alerts/${editId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: formName || undefined,
            sectors: formSectors.length > 0 ? formSectors : undefined,
            regions: formRegions.length > 0 ? formRegions : undefined,
            keywords: formKeywords || undefined,
            enabled: formEnabled,
          }),
        });
        setMessage({ kind: "ok", text: "Alert updated." });
      } else {
        await fetchJSON("/api/alerts", {
          method: "POST",
          body: JSON.stringify({
            name: formName,
            sectors: formSectors,
            regions: formRegions,
            keywords: formKeywords,
            enabled: formEnabled,
          }),
        });
        setMessage({ kind: "ok", text: "Alert created." });
      }
      clearMessage();
      setOpen(false);
      setEditId(null);
      resetForm();
      await loadData();
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to save alert.",
      });
      clearMessage();
    } finally {
      setSaving(false);
    }
  }

  async function toggleAlert(id: string, enabled: boolean) {
    try {
      await fetchJSON(`/api/alerts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, enabled } : a)),
      );
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to update alert.",
      });
      clearMessage();
    }
  }

  async function deleteAlert(id: string) {
    if (!window.confirm("Delete this alert monitor?")) return;
    setDeleting(id);
    try {
      await fetchJSON(`/api/alerts/${id}`, { method: "DELETE" });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      setMessage({ kind: "ok", text: "Alert deleted." });
      clearMessage();
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to delete alert.",
      });
      clearMessage();
    } finally {
      setDeleting(null);
    }
  }

  function editAlert(alert: Alert) {
    setEditId(alert.id);
    setFormName(alert.name);
    setFormSectors(alert.sectors);
    setFormRegions(alert.regions);
    setFormKeywords(alert.keywords);
    setFormEnabled(alert.enabled);
    setOpen(true);
  }

  function resetForm() {
    setFormName("");
    setFormSectors([]);
    setFormRegions([]);
    setFormKeywords("");
    setFormEnabled(true);
  }

  const submitLabel = saving
    ? "Saving…"
    : editId
      ? "Update Monitor"
      : "Create Monitor";

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500 animate-pulse">
          Loading alerts…
        </p>
      </div>
    );
  }

  const messageBox = message ? (
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
  ) : null;

  return (
    <div className="space-y-6 section-enter max-w-full min-w-0">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="headline mb-0.5">Active Monitors</h1>
          <p className="text-[10px] font-inter font-mono tracking-wider text-slate-500 uppercase">
            Monitor signals and get notified when new matches arrive.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditId(null);
            resetForm();
            setOpen(true);
          }}
          variant="outline"
          size="sm"
        >
          <Plus className="h-3 w-3 mr-1.5" /> New Monitor
        </Button>
      </div>

      {messageBox}

      {alerts.length === 0 ? (
        <div className="border border-white/10 bg-[#0a0a0a] p-8 rounded-sm text-center">
          <List className="h-8 w-8 mx-auto mb-2 text-slate-600" />
          <p className="font-mono text-[9px] text-slate-500 mb-3">
            No alert monitors configured yet.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditId(null);
              resetForm();
              setOpen(true);
            }}
          >
            Create your first monitor
          </Button>
        </div>
      ) : (
        <div className="border border-white/10 bg-[#0a0a0a] rounded-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-[#09090b]">
                <th className="p-3 font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500 text-left">
                  Name
                </th>
                <th className="p-3 font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500 text-left">
                  Sectors
                </th>
                <th className="p-3 font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500 text-left">
                  Regions
                </th>
                <th className="p-3 font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500 text-left">
                  Keywords
                </th>
                <th className="p-3 font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500 text-right">
                  Status
                </th>
                <th className="p-3 font-mono text-[8px] uppercase tracking-[0.2em] text-right">
                  Last Triggered
                </th>
                <th className="p-3 font-mono text-[8px] uppercase tracking-[0.2em] text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr
                  key={alert.id}
                  className="border-b border-white/5 hover:bg-white/3 transition-colors"
                >
                  <td className="p-3 font-mono text-[9px] text-slate-200">
                    {alert.name}
                  </td>
                  <td className="p-3 font-mono text-[8px] text-slate-400">
                    {alert.sectors.length > 0
                      ? alert.sectors.map((s) => sectorLabel(s)).join(" · ")
                      : "All"}
                  </td>
                  <td className="p-3 font-mono text-[8px] text-slate-400">
                    {alert.regions.length > 0
                      ? alert.regions.join(" · ")
                      : "All"}
                  </td>
                  <td className="p-3 font-mono text-[8px] text-slate-400 truncate max-w-[120px]">
                    {alert.keywords || "—"}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => toggleAlert(alert.id, !alert.enabled)}
                      className={`px-2.5 py-1 rounded font-mono text-[8px] uppercase tracking-[0.1em] transition-colors ${alertStatusClass(
                        alert.enabled,
                      )}`}
                    >
                      {alert.enabled ? "ACTIVE" : "INACTIVE"}
                    </button>
                  </td>
                  <td className="p-3 font-mono text-[9px] text-slate-500 text-right">
                    {formatDate(alert.lastTriggered)}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => editAlert(alert)}
                        className="px-2 py-1.5 text-slate-400 hover:text-white"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteAlert(alert.id)}
                        disabled={deleting === alert.id}
                        className="px-2 py-1.5 text-slate-400 hover:text-red-400"
                      >
                        {deleting === alert.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="glass-card p-4 mt-6">
        <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-3">
          How Monitors Work
        </div>
        <p className="text-[10px] font-inter text-slate-500 mb-2">
          Alert monitors continuously scan new primary-source signals and
          notify you when a signal matches your sector, region and keyword
          criteria. Delivery status is recorded for every monitor trigger.
        </p>
      </div>

      {/* Add/edit alert sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetClose />
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editId ? "Edit Alert Monitor" : "New Alert Monitor"}
            </SheetTitle>
            <SheetDescription>
              Configure the criteria that trigger this monitor.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={saveAlert} className="space-y-4 p-4">
            <div className="space-y-2">
              <Label>Monitor Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. UK Defence Infrastructure"
                required
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Sectors</Label>
              <p className="font-mono text-[9px] text-slate-500">
                Leave empty to monitor all sectors.
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
                  {SECTORS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Regions</Label>
              <p className="font-mono text-[9px] text-slate-500">
                Leave empty to monitor all regions.
              </p>
              <Select
                multiple
                value={formRegions}
                onValueChange={(val) => setFormRegions(val as string[])}
                disabled={saving}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select regions…" />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Keywords</Label>
              <Input
                value={formKeywords}
                onChange={(e) => setFormKeywords(e.target.value)}
                placeholder="e.g. defence, infrastructure"
                disabled={saving}
              />
              <p className="font-mono text-[9px] text-slate-500">
                Comma-separated keywords matched against signal titles.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                checked={formEnabled}
                onChange={(e) => setFormEnabled(e.target.checked)}
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
              <Button type="submit" disabled={saving || !formName}>
                {submitLabel}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
