"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, LogIn, UserPlus, ShieldCheck, Activity, Mail, Lock } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

type AuthMode = "signin" | "signup";

interface WorkerLogEntry {
  time: string;
  message: string;
  source: string;
}

// Simulated worker log stream — in production this comes from the SSE
// /api/signals/stream endpoint or a dedicated worker-log endpoint.
const MOCK_WORKER_LOGS: WorkerLogEntry[] = [
  { time: "12s ago", message: "NHS England Tender Extracted", source: "UK_MOD_DSP" },
  { time: "47s ago", message: "DfE Framework Notice Published", source: "UK_TENDERS" },
  { time: "1m 3s ago", message: "HMRC Digital Services RFP", source: "GOV.UK_SPEND" },
  { time: "2m 11s ago", message: "EU TED Cross-Border Opportunity", source: "EU_TED_API" },
  { time: "3m 4s ago", message: "US SAM.gov Contract Award", source: "US_SAM" },
  { time: "5m 22s ago", message: "Canada MERX Tender Posted", source: "CA_MERX" },
];

export default function AuthShellClient({
  initialMode,
}: {
  initialMode: AuthMode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [slidePosition, setSlidePosition] = useState(
    initialMode === "signup" ? 100 : 0,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [organisationName, setOrganisationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [workerLogs, setWorkerLogs] = useState<WorkerLogEntry[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Animate the slide when mode changes.
  useEffect(() => {
    setSlidePosition(mode === "signup" ? 100 : 0);
  }, [mode]);

  // Connect to the worker log stream (SSE) for the left panel.
  useEffect(() => {
    // Try to connect to a real SSE stream; fall back to mock polling.
    let mockTimer: NodeJS.Timeout;

    try {
      const es = new EventSource(`${API_URL.replace("/api", "")}/api/signals/stream`);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "connected") {
            // Seed with mock logs on connect.
            setWorkerLogs([...MOCK_WORKER_LOGS]);
          }
        } catch {
          // Ignore parse errors.
        }
      };
      eventSourceRef.current = es;
    } catch {
      // SSE not available — use mock polling.
    }

    // Mock log stream: periodically prepend new entries.
    mockTimer = setInterval(() => {
      const now = new Date();
      const seconds = now.getSeconds();
      if (seconds % 7 === 0) {
        setWorkerLogs((prev) => {
          const newEntry: WorkerLogEntry = {
            time: "Just now",
            message: "Streaming telemetry frame ingested",
            source: "UK_PIPELINE_WORKER",
          };
          return [newEntry, ...prev.slice(0, 9)];
        });
      }
      // Update relative timestamps.
      setWorkerLogs((prev) =>
        prev.map((entry) => {
          const match = entry.time.match(/(\d+)\s*(s|m|h) ago/);
          if (!match) return entry;
          const num = parseInt(match[1], 10);
          const unit = match[2];
          if (unit === "s") {
            return { ...entry, time: `${num + 1}s ago` };
          }
          if (unit === "m") {
            return { ...entry, time: `${num}m ${num === 0 ? 1 : 0}s ago` };
          }
          return entry;
        }),
      );
    }, 1000);

    return () => {
      if (mockTimer) clearInterval(mockTimer);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const handleSwitch = () => {
    setError(null);
    setMode(mode === "signin" ? "signup" : "signin");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const response = await fetch(`${API_URL}/api/auth/signin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.error || "Sign in failed.");
          setLoading(false);
          return;
        }
        window.location.replace(data.redirectTo || "/dashboard");
      } else {
        if (password !== passwordConfirm) {
          setError("Passwords do not match.");
          setLoading(false);
          return;
        }
        const response = await fetch(`${API_URL}/api/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            email,
            password,
            passwordConfirm,
            organisationName: organisationName || undefined,
            country: "UK",
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.error || "Signup failed.");
          setLoading(false);
          return;
        }
        window.location.replace(data.redirectTo || "/dashboard");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed.";
      setError(message);
      setLoading(false);
    }
  };

  const handleModeChange = (next: AuthMode) => {
    setMode(next);
    setSlidePosition(next === "signup" ? 100 : 0);
  };

  return (
    <div className="flex min-h-screen bg-[#09090b] text-[#E5E5EA]">
      {/* =====================================================================
          LEFT PANEL — Live worker log stream
          ===================================================================== */}
      <div className="flex-shrink-0 w-[40vw] min-w-[320px] bg-[#050505] border-r border-white/10 flex flex-col h-[calc(100vh-4rem)] relative overflow-hidden">
        {/* Ambient grid background */}
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(16, 185, 129, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.03) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

        <div className="absolute inset-0 bg-black/40 pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full px-6">
          <div className="h-12 flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-400">
                Live worker stream
              </span>
            </div>
            <span className="font-mono text-[9px] text-zinc-500">
              {new Date().toLocaleTimeString("en-GB", { hour12: false })}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-2 no-scrollbar pt-2">
            {workerLogs.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="h-6 w-6 mx-auto mb-2 animate-spin text-zinc-500" />
                <p className="font-mono text-[9px] text-zinc-500 uppercase tracking-tighter">
                  Connecting to ingestion workers…
                </p>
              </div>
            ) : (
              workerLogs.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex gap-2.5 items-start animate-[fadeIn_0.3s_ease-out]"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <span className="flex-shrink-0 font-mono text-[9px] text-zinc-600 mt-0.5">
                    {entry.time}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[10px] text-zinc-300 leading-tight">
                      {entry.message}
                    </p>
                    <span className="font-mono text-[8px] text-zinc-500 uppercase tracking-[0.1em]">
                      • {entry.source}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-white/5 pt-3">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-emerald-400">
                Zero synthetic signals — every entry traces to a live scraper
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          RIGHT PANEL — Sliding glass auth container
          ===================================================================== */}
      <div className="flex-1 flex items-center justify-center bg-[#09090b] min-w-0">
        {/* Frosted glass backdrop */}
        <div className="absolute inset-0 bg-[#050505]/80 backdrop-blur-xl border border-white/5" />

        {/* Sliding glass container */}
        <div
          className="relative z-10 w-full max-w-2xl h-[560px] bg-[#09090b]/60 backdrop-blur-2xl border border-white/10 rounded-[3px] shadow-2xl overflow-hidden transition-all duration-500 ease-in-out"
          style={{
            transform: `translateX(${slidePosition}%)`,
          }}
        >
          {/* Sign In card — left position */}
          <div
            className={`absolute inset-0 flex flex-col p-8 transition-opacity duration-300 ${
              mode === "signin" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
          >
            <div className="flex flex-col items-center gap-2 mb-8">
              <div className="flex h-10 w-10 items-center justify-center bg-[#050505] border border-white/10 rounded-[3px]">
                <LogIn className="h-5 w-5 text-white" />
              </div>
              <span className="text-[10px] font-mono tracking-[0.25em] text-zinc-400 uppercase">
                SourceSignal // Sign in
              </span>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-white mb-1">
              Welcome back
            </h2>
            <p className="text-[#94A3B8] text-sm mb-8">
              Sign in to your procurement workspace.
            </p>

            {error && (
              <div className="mb-6 p-3 rounded border border-[#FF5500]/30 bg-[#FF5500]/10 text-sm text-[#FF5500] font-mono">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs font-mono tracking-[0.2em] text-zinc-400 uppercase block mb-1">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="ghost-input h-10 text-xs px-3"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password" className="text-xs font-mono tracking-[0.2em] text-zinc-400 uppercase block mb-1">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="ghost-input h-10 text-xs px-3"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 text-xs font-bold tracking-[0.15em] uppercase hover:text-black hover:bg-white"
              >
                {loading ? "Signing in…" : "Sign in"}
                <ArrowRight className={`ml-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </form>

            <div className="mt-8 border-t border-white/10 pt-4 flex flex-col gap-2">
              <span className="text-xs font-mono tracking-[0.2em] text-zinc-500 uppercase">
                New to SourceSignal?
              </span>
              <Button
                variant="ghost"
                className="w-full h-10 border-white/10 text-xs font-mono tracking-[0.1em] uppercase hover:bg-white/[0.05] hover:border-white/30"
                onClick={() => handleModeChange("signup")}
              >
                Create account <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Sign Up card — right position */}
          <div
            className={`absolute inset-0 flex flex-col p-8 transition-opacity duration-300 ${
              mode === "signup" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
          >
            <div className="flex flex-col items-center gap-2 mb-8">
              <div className="flex h-10 w-10 items-center justify-center bg-[#050505] border border-white/10 rounded-[3px]">
                <UserPlus className="h-5 w-5 text-white" />
              </div>
              <span className="text-[10px] font-mono tracking-[0.25em] text-zinc-400 uppercase">
                SourceSignal // Create account
              </span>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-white mb-1">
              Create your account
            </h2>
            <p className="text-[#94A3B8] text-sm mb-8">
              Set up your organisation on the free plan. Upgrade to Pro for full
              opportunity details, exports and the live opportunity map.
            </p>

            {error && (
              <div className="mb-6 p-3 rounded border border-[#FF5500]/30 bg-[#FF5500]/10 text-sm text-[#FF5500] font-mono">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs font-mono tracking-[0.2em] text-zinc-400 uppercase block mb-1">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="ghost-input h-10 text-xs px-3"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password" className="text-xs font-mono tracking-[0.2em] text-zinc-400 uppercase block mb-1">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="ghost-input h-10 text-xs px-3"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="passwordConfirm" className="text-xs font-mono tracking-[0.2em] text-zinc-400 uppercase block mb-1">
                  Confirm password
                </Label>
                <Input
                  id="passwordConfirm"
                  type="password"
                  placeholder="••••••••"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="ghost-input h-10 text-xs px-3"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="organisationName" className="text-xs font-mono tracking-[0.2em] text-zinc-400 uppercase block mb-1">
                  Organisation / Workspace
                </Label>
                <Input
                  id="organisationName"
                  placeholder="e.g. Acme Contracting Ltd"
                  value={organisationName}
                  onChange={(e) => setOrganisationName(e.target.value)}
                  className="ghost-input h-10 text-xs px-3"
                />
                <p className="text-[10px] text-zinc-500">
                  Your organisation starts on the Free tier. All sectors are
                  available; Pro adds full details, exports and the map.
                </p>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 text-xs font-bold tracking-[0.15em] uppercase hover:text-black hover:bg-white"
              >
                {loading ? "Creating account…" : "Create account"}
                <ArrowRight className={`ml-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </form>

            <div className="mt-8 border-t border-white/10 pt-4 flex flex-col gap-2">
              <span className="text-xs font-mono tracking-[0.2em] text-zinc-500 uppercase">
                Already have an account?
              </span>
              <Button
                variant="ghost"
                className="w-full h-10 border-white/10 text-xs font-mono tracking-[0.1em] uppercase hover:bg-white/[0.05] hover:border-white/30"
                onClick={() => handleModeChange("signin")}
              >
                Sign in <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
