"use client";

/**
 * useSignalStream — React hook for real-time signal SSE.
 *
 * Connects to GET /api/signals/stream and invokes onSignal for each new
 * signal event. Handles reconnection with exponential backoff and exposes
 * the connection status.
 *
 * Requires an authenticated Pro session (credentials: "include").
 * On 401/403 the hook stops retrying and reports a permanent error.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface StreamEvent {
  type: "connected" | "signal" | "error";
  clients?: number;
  id?: string;
  title?: string;
  buyer_name?: string | null;
  jurisdiction?: string | null;
  sector?: string | null;
  opportunity_type?: string | null;
  estimated_value?: number | null;
  source_name?: string | null;
  source_url?: string | null;
  source_hash?: string | null;
  sha256_hash?: string | null;
  commercial_why?: string | null;
  published_at?: string | null;
  created_at?: string | null;
}

export interface UseSignalStreamReturn {
  /** Whether the SSE connection is currently open. */
  isConnected: boolean;
  /** Number of connected SSE clients (from server). */
  clientCount: number | null;
  /** Last received signal event, if any. */
  lastSignal: StreamEvent | null;
  /** Connection error message, if any. */
  error: string | null;
  /** Manually reconnect. */
  reconnect: () => void;
}

/** Maximum reconnect delay in ms. */
const MAX_RECONNECT_DELAY_MS = 30_000;
/** Initial reconnect delay in ms. */
const INITIAL_RECONNECT_DELAY_MS = 1_000;

/**
 * Hook to subscribe to real-time signal events via Server-Sent Events.
 *
 * @param onSignal - Callback invoked when a new signal event arrives.
 * @param enabled - Whether the stream should be active (default true).
 */
export function useSignalStream(
  onSignal?: (event: StreamEvent) => void,
  enabled: boolean = true,
): UseSignalStreamReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [clientCount, setClientCount] = useState<number | null>(null);
  const [lastSignal, setLastSignal] = useState<StreamEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconnectKey, setReconnectKey] = useState(0);

  const esRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const onSignalRef = useRef(onSignal);

  // Keep callback ref in sync without updating during render.
  useEffect(() => {
    onSignalRef.current = onSignal;
  }, [onSignal]);

  /**
   * Probe the stream endpoint before opening EventSource.
   * EventSource does not expose HTTP status codes, so we fetch first to
   * detect permanent auth failures (401/403) and stop retrying.
   */
  async function probeStream(): Promise<boolean> {
    try {
      const res = await fetch("/api/signals/stream", {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "text/event-stream",
        },
        signal: AbortSignal.timeout(10_000),
      });

      // 401/403 are permanent — stop retrying.
      if (res.status === 401 || res.status === 403) {
        setIsConnected(false);
        setError(
          res.status === 403
            ? "Real-time signals require a Pro subscription."
            : "Not authenticated. Please sign in.",
        );
        return false;
      }

      // Any other non-2xx is treated as retryable.
      if (!res.ok) {
        setIsConnected(false);
        setError(`Stream unavailable (${res.status}). Retrying…`);
        return false;
      }

      return true;
    } catch (err) {
      setIsConnected(false);
      setError(
        err instanceof Error ? err.message : "Stream connection failed.",
      );
      return false;
    }
  }

  const connect = useCallback(() => {
    if (!enabled) return;
    if (esRef.current?.readyState === EventSource.OPEN) return;

    void probeStream().then((ok) => {
      if (!ok) return; // permanent failure, do not open EventSource

      const es = new EventSource("/api/signals/stream", {
        withCredentials: true,
      });
      esRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      es.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as StreamEvent;
          if (data.type === "connected") {
            setClientCount(data.clients ?? null);
          } else if (data.type === "signal") {
            setLastSignal(data);
            onSignalRef.current?.(data);
          }
        } catch {
          // Ignore malformed messages (including heartbeat comments).
        }
      };

      es.onerror = () => {
        setIsConnected(false);
        setError("SSE connection lost. Reconnecting…");
        es.close();
        esRef.current = null;

        // Trigger reconnection via state change (avoids self-reference).
        setReconnectKey((k) => k + 1);
      };
    });
  }, [enabled]);

  // Reconnect with exponential backoff when reconnectKey changes.
  useEffect(() => {
    if (!enabled || reconnectKey === 0) return;

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(2, reconnectKey - 1),
      MAX_RECONNECT_DELAY_MS,
    );

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [enabled, connect, reconnectKey]);

  const reconnect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setError(null);
    setReconnectKey(1);
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    }
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (esRef.current) {
        esRef.current.close();
      }
    };
  }, [enabled, connect]);

  return { isConnected, clientCount, lastSignal, error, reconnect };
}
