"use client";

import * as React from "react";
import { regionMeta } from "@/lib/signal-view";

export interface RadarPoint {
  id: string;
  region?: string | null;
  sector?: string | null;
  label?: string | null;
  score?: number | null;
  estimatedValue?: number | null;
}

interface ClusterPoint {
  id: string;
  region?: string | null;
  sector?: string | null;
  label?: string | null;
  score?: number | null;
  points: RadarPoint[];
  center: { x: number; y: number };
}

interface TerritoryRadarProps {
  points: RadarPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  hoveredId?: string | null;
  className?: string;
  showHeatmap?: boolean;
  zoom?: number;
  bounds?: { north: number; south: number; east: number; west: number };
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
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

function sectorColor(sector?: string | null): string {
  switch (sector?.toUpperCase()) {
    case "TECH": return "#10B981";
    case "ENERGY": return "#F59E0B";
    case "HEALTHCARE": return "#3B82F6";
    case "PUBLIC_SECTOR": return "#A855F7";
    case "CONSTRUCTION": return "#EF4444";
    case "TRANSPORT": return "#F59E0B";
    case "LOGISTICS": return "#10B981";
    default: return "#10B981";
  }
}

export function TerritoryRadar({
  points,
  selectedId,
  onSelect,
  onHover,
  hoveredId,
  className = "",
  showHeatmap = false,
  zoom = 4,
  bounds,
  onBoundsChange,
}: TerritoryRadarProps) {
  const plotted = React.useMemo(
    () =>
      points.map((point) => ({
        ...point,
        ...project(point.region, point.id),
      })),
    [points],
  );

  const clusters = React.useMemo(() => {
    if (zoom >= 8) {
      return plotted.map((p) => ({
        id: p.id,
        region: p.region,
        sector: p.sector,
        label: p.label,
        score: p.score,
        points: [p],
        center: { x: p.x, y: p.y },
      }));
    }

    const clusters = new Map<string, ClusterPoint>();

    for (const point of plotted) {
      const key = point.region || "EU";
      const existing = clusters.get(key);
      if (existing) {
        existing.points.push(point);
      } else {
        clusters.set(key, {
          id: `cluster-${key}`,
          points: [point],
          center: {
            x: plotted.find((p) => p.region === key)?.x ?? 50,
            y: plotted.find(p => p.region === key)?.y ?? 30,
          },
        });
      }
    }

    return Array.from(clusters.entries()).map(([key, data]) => ({
      id: `cluster-${key}`,
      region: key,
      sector: undefined,
      label: undefined,
      score: undefined,
      points: data.points,
      center: data.center,
    }));
  }, [plotted, zoom]);

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
            {plotted.length} active signal{plotted.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onBoundsChange?.({ north: 90, south: -90, east: 180, west: -180 })}
            className="px-2 py-1 border border-white/10 bg-zinc-900/50 text-[7px] font-mono uppercase tracking-[0.1em] text-zinc-500 hover:bg-white/5"
          >
            Reset View
          </button>
          <button
            type="button"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[7px] font-mono uppercase tracking-[0.1em] transition-colors ${
              showHeatmap
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200"
            }`}
          >
            <span className={`h-3 w-3 rounded-full ${showHeatmap ? "bg-emerald-400" : "bg-zinc-500"}`} />
            Heatmap
          </button>
          <span className="ml-2 text-[7px] font-mono text-zinc-500">
            Zoom {zoom}
          </span>
        </div>
      </div>

      <div className="relative overflow-hidden aspect-[5:3] w-full">
        <svg
          viewBox="0 0 100 60"
          className="h-full w-full"
          role="img"
          aria-label="Global plot of active opportunity signals"
          onWheel={(e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 1 : -1;
            const newZoom = Math.min(Math.max(zoom + delta, 1), 12);
            onBoundsChange?.({
              north: Math.max(-90, 90 - (zoom - newZoom) * 10),
              south: Math.min(90, -90 + (zoom - newZoom) * 10),
              east: Math.min(180, 180 + (zoom - newZoom) * 15),
              west: Math.max(-180, -180 - (zoom - newZoom) * 15),
            });
          }}
          onWheelCapture={(e) => {
            e.preventDefault();
          }}
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

          {zoom < 8 ? clusters.map((cluster) => (
            <g
              key={cluster.id}
              transform={`translate(${cluster.center.x} ${cluster.center.y})`}
              className="cursor-pointer"
              onClick={() => onSelect?.(cluster.id)}
              role="button"
              tabIndex={0}
              aria-label={`${cluster.points.length} signals in ${cluster.region}`}
              onMouseEnter={() => onHover?.(cluster.id)}
              onMouseLeave={() => onHover?.(null)}
            >
              <circle
                r={Math.min(8, 4 + Math.log(cluster.points.length) * 2)}
                fill="#0F172A"
                stroke="#94A3B8"
                strokeWidth="1"
              />
              <text
                x="0"
                y="4"
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="8"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontWeight="bold"
              >
                {cluster.points.length}
              </text>
            </g>
          )) : null}

          {zoom >= 8 && plotted.map((point) => {
            const selected = selectedId === point.id;
            const hovered = hoveredId === point.id;
            const isHighValue = point.sector === "ENERGY" || point.sector === "CONSTRUCTION";
            const color = sectorColor(point.sector);

            return (
              <g
                key={point.id}
                transform={`translate(${point.x} ${point.y})`}
                className="cursor-pointer"
                onClick={() => onSelect?.(point.id)}
                role="button"
                tabIndex={0}
                aria-label={point.label ?? "Opportunity signal"}
                onMouseEnter={() => onHover?.(point.id)}
                onMouseLeave={() => onHover?.(null)}
              >
                {selected && (
                  <circle
                    r={3.5}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="0.5"
                    opacity="0.9"
                  >
                    <animateTransform
                      attributeName="r"
                      from="3.5"
                      to="5"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                    <animateTransform
                      attributeName="stroke-opacity"
                      from="0.9"
                      to="0.3"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                {isHighValue && !selected && (
                  <circle
                    r={2.5}
                    fill="none"
                    stroke="#D4AF37"
                    strokeWidth="0.8"
                    opacity="0.7"
                  >
                    <animateTransform
                      attributeName="r"
                      from="2.5"
                      to="4"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animateTransform
                      attributeName="stroke-opacity"
                      from="0.7"
                      to="0.3"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                <circle
                  r={1.2}
                  fill={isHighValue ? "#D4AF37" : "#10B981"}
                  stroke={selected ? "#10B981" : "none"}
                  strokeWidth={selected ? 0.5 : 0}
                />
                {selected && (
                  <circle
                    r={0.5}
                    fill="#FFFFFF"
                  >
                    <animateTransform
                      attributeName="r"
                      from="0.5"
                      to="1.5"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                    <animateTransform
                      attributeName="stroke-opacity"
                      from="1"
                      to="0"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                <title>{point.label ?? "Opportunity signal"}</title>
              </g>
            );
          })}
        </svg>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between px-2 pt-1 font-mono text-[7px] uppercase tracking-[0.2em] text-zinc-700">
          <span>180°W</span>
          <span>0°</span>
          <span>180°E</span>
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[8px] uppercase tracking-[0.3em] text-zinc-500">
              Active territories
            </p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400">
              {plotted.length} signal{plotted.length === 1 ? "" : "s"} across {new Set(plotted.map((p) => p.region)).size} jurisdictions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[9px] font-mono text-zinc-400">
              <span className="h-3 w-3 rounded-full bg-zinc-500" />
              Signals
            </span>
            <span className="flex items-center gap-1 text-[9px] font-mono text-zinc-400">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              Standard
            </span>
            <span className="flex items-center gap-1 text-[9px] font-mono text-zinc-400">
              <span className="h-2.5 w-2.5 rounded-full border border-amber-400/50 text-amber-400 text-[7px] leading-none">
                ★
              </span>
              High Value
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}