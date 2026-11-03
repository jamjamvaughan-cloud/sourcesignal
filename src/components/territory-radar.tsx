"use client";

import * as React from "react";
import { regionMeta } from "@/lib/signal-view";

export interface RadarPoint {
  id: string;
  region?: string | null;
  sector?: string | null;
  label?: string | null;
  score?: number | null;
}

interface TerritoryRadarProps {
  points: RadarPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function project(region: string | null | undefined, id: string) {
  const meta = regionMeta(region);
  const seed = hash(id);
  const jitterX = ((seed % 1000) / 1000 - 0.5) * 3.6;
  const jitterY = (((seed >> 10) % 1000) / 1000 - 0.5) * 2.8;
  const x = ((meta.lon + 180) / 360) * 100 + jitterX;
  const y = ((90 - meta.lat) / 180) * 60 + jitterY;
  return {
    x: Math.max(1.5, Math.min(98.5, x)),
    y: Math.max(1.5, Math.min(58.5, y)),
    meta,
  };
}

export function TerritoryRadar({
  points,
  selectedId,
  onSelect,
  className = "",
}: TerritoryRadarProps) {
  const plotted = React.useMemo(
    () =>
      points.map((point) => ({
        ...point,
        ...project(point.region, point.id),
      })),
    [points],
  );

  const territories = React.useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const point of points) {
      const meta = regionMeta(point.region);
      const key = meta.short;
      const current = counts.get(key);
      counts.set(key, {
        label: meta.label,
        count: (current?.count ?? 0) + 1,
      });
    }
    return [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [points]);

  const maxCount = Math.max(1, ...territories.map((item) => item.count));

  return (
    <section
      className={`border border-white/10 bg-[#050505] ${className}`}
      aria-label="Territory radar"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="font-mono text-[8px] uppercase tracking-[0.3em] text-zinc-500">
            Territory Radar
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-300">
            {points.length} active signal{points.length === 1 ? "" : "s"}
          </p>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.2em] text-emerald-400">
          <span className="h-1.5 w-1.5 bg-emerald-400" />
          Live
        </span>
      </div>

      <div className="relative overflow-hidden">
        <svg
          viewBox="0 0 100 60"
          className="h-auto w-full"
          role="img"
          aria-label="Global plot of active opportunity signals"
        >
          <rect width="100" height="60" fill="#050505" />

          {/* Equirectangular grid */}
          {Array.from({ length: 11 }, (_, index) => (
            <line
              key={`v-${index}`}
              x1={index * 10}
              y1="0"
              x2={index * 10}
              y2="60"
              stroke="rgba(255,255,255,0.055)"
              strokeWidth="0.15"
            />
          ))}
          {Array.from({ length: 7 }, (_, index) => (
            <line
              key={`h-${index}`}
              x1="0"
              y1={index * 10}
              x2="100"
              y2={index * 10}
              stroke="rgba(255,255,255,0.055)"
              strokeWidth="0.15"
            />
          ))}

          {/* Radar rings + sweep */}
          <g fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="0.18">
            <circle cx="50" cy="30" r="9" />
            <circle cx="50" cy="30" r="17" />
            <circle cx="50" cy="30" r="26" />
            <circle cx="50" cy="30" r="35" />
            <line x1="15" y1="30" x2="85" y2="30" />
            <line x1="50" y1="0" x2="50" y2="60" />
          </g>
          <g stroke="rgba(212,175,55,0.22)" strokeWidth="0.22">
            <line x1="50" y1="30" x2="50" y2="4">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 50 30"
                to="360 50 30"
                dur="24s"
                repeatCount="indefinite"
              />
            </line>
          </g>

          {plotted.map((point) => {
            const selected = selectedId === point.id;
            return (
              <g
                key={point.id}
                transform={`translate(${point.x} ${point.y})`}
                className="cursor-pointer"
                onClick={() => onSelect?.(point.id)}
                role="button"
                tabIndex={0}
                aria-label={point.label ?? "Opportunity signal"}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect?.(point.id);
                  }
                }}
              >
                {selected && (
                  <circle
                    r="2.4"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="0.3"
                    opacity="0.85"
                  />
                )}
                <circle
                  r={selected ? 1.15 : 0.75}
                  fill={selected ? "#ffffff" : "#D4AF37"}
                />
                <title>{point.label ?? "Opportunity signal"}</title>
              </g>
            );
          })}

          {plotted.length === 0 && (
            <text
              x="50"
              y="30.8"
              textAnchor="middle"
              fill="rgba(255,255,255,0.35)"
              fontSize="2.4"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              letterSpacing="0.5"
            >
              AWAITING SIGNALS
            </text>
          )}
        </svg>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between px-2 pt-1 font-mono text-[7px] uppercase tracking-[0.2em] text-zinc-700">
          <span>180°W</span>
          <span>0°</span>
          <span>180°E</span>
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <p className="font-mono text-[8px] uppercase tracking-[0.3em] text-zinc-500">
          Active territories
        </p>
        {territories.length === 0 ? (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-600">
            No mapped signals
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {territories.map((territory) => (
              <li key={territory.label}>
                <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.14em]">
                  <span className="text-zinc-400">{territory.label}</span>
                  <span className="tabular-nums text-white">
                    {territory.count}
                  </span>
                </div>
                <div className="mt-1 h-[2px] w-full bg-white/5">
                  <div
                    className="h-full bg-[#D4AF37]"
                    style={{
                      width: `${Math.max(
                        6,
                        (territory.count / maxCount) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
