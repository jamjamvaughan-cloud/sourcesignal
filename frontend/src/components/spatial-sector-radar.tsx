"use client";

import * as React from "react";

interface Sector {
  id: string;
  label: string;
  short: string;
  intentScore: number;
  preRfpCount: number;
  liveTenderCount: number;
  angle: number;
}

interface SpatialSectorRadarProps {
  adapters: Array<{ code: string; region: string; authority: string; latency: string }>;
}

const SECTORS: Sector[] = [
  { id: "defence", label: "Defense", short: "DEF", intentScore: 94, preRfpCount: 12, liveTenderCount: 4, angle: 270 },
  { id: "healthcare", label: "Healthcare", short: "HLTH", intentScore: 87, preRfpCount: 8, liveTenderCount: 6, angle: 315 },
  { id: "local_gov", label: "Local Government", short: "LOCAL", intentScore: 76, preRfpCount: 15, liveTenderCount: 9, angle: 0 },
  { id: "energy", label: "Energy", short: "NRG", intentScore: 82, preRfpCount: 6, liveTenderCount: 3, angle: 45 },
  { id: "transport", label: "Transport", short: "TRANS", intentScore: 71, preRfpCount: 9, liveTenderCount: 5, angle: 90 },
  { id: "digital", label: "Digital", short: "DIGI", intentScore: 89, preRfpCount: 7, liveTenderCount: 8, angle: 135 },
  { id: "construction", label: "Construction", short: "CONST", intentScore: 68, preRfpCount: 11, liveTenderCount: 7, angle: 180 },
  { id: "logistics", label: "Logistics", short: "LOG", intentScore: 63, preRfpCount: 5, liveTenderCount: 4, angle: 225 },
];

export function SpatialSectorRadar({ adapters }: SpatialSectorRadarProps) {
  const [radarAngle, setRadarAngle] = React.useState(0);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setRadarAngle((a) => (a + 3) % 360);
    }, 40);
    return () => clearInterval(timer);
  }, []);

  const activeSector = SECTORS.find((s) => s.id === hoveredId) ?? SECTORS[0];

  const getSectorPos = (angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    const cx = 50;
    const cy = 30;
    const r = 40;
    const x = cx + r * Math.cos(rad);
    const y = cy + (r * 0.75) * Math.sin(rad);
    return { x, y };
  };

  const isSweeping = (angleDeg: number) => {
    const diff = Math.abs(((angleDeg - radarAngle + 540) % 360) - 180);
    return diff < 8;
  };

  return (
    <section className="relative bg-[#09090B] overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-12 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-12">
          <div>
            <p className="mb-2 text-[10px] font-sans uppercase tracking-[0.2em] text-[#94A3B8] font-medium">
              [ SCENE IV · SECTOR RADAR ]
            </p>
            <h2 className="text-3xl font-bold uppercase tracking-tighter text-white sm:text-4xl">
              Spatial Radar
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#94A3B8] sm:text-base">
              Monochrome vector radar sweep linked to the live intercept stream below.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          {/* Left: Radar */}
          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-[440px] aspect-[5/3]">
              <svg
                viewBox="0 0 100 60"
                className="w-full h-auto max-h-[340px] sm:max-h-[420px]"
                role="img"
                aria-label="Sector intent radar sweep"
                style={{ imageRendering: "pixelated" }}
              >
                <defs>
                  <filter id="radarBlur" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" />
                  </filter>
                </defs>

                {Array.from({ length: 11 }, (_, i) => (
                  <line
                    key={`v-${i}`}
                    x1={i * 10}
                    y1="0"
                    x2={i * 10}
                    y2="60"
                    stroke="rgba(255,255,255,0.025)"
                    strokeWidth="0.1"
                  />
                ))}
                {Array.from({ length: 7 }, (_, i) => (
                  <line
                    key={`h-${i}`}
                    x1="0"
                    y1={i * 10}
                    x2="100"
                    y2={i * 10}
                    stroke="rgba(255,255,255,0.025)"
                    strokeWidth="0.1"
                  />
                ))}

                <g fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.1">
                  <circle cx="50" cy="30" r="8" />
                  <circle cx="50" cy="30" r="16" />
                  <circle cx="50" cy="30" r="24" />
                  <circle cx="50" cy="30" r="32" />
                  <circle cx="50" cy="30" r="40" />
                </g>

                <g>
                  {SECTORS.map((sector) => {
                    const pos = getSectorPos(sector.angle);
                    const sweeping = isSweeping(sector.angle);
                    const isSelected = hoveredId === sector.id;
                    const active = isSelected || sweeping;

                    return (
                      <g key={sector.id}>
                        <line
                          x1="50"
                          y1="30"
                          x2={pos.x}
                          y2={pos.y}
                          stroke="rgba(255,255,255,0.15)"
                          strokeWidth="0.4"
                          className={sweeping ? "animate-pulse" : ""}
                        />
                        <line
                          x1={pos.x}
                          y1={pos.y}
                          x2={pos.x + Math.cos(((sector.angle - 90) * Math.PI) / 180) * 6}
                          y2={pos.y + Math.sin(((sector.angle - 90) * Math.PI) / 180) * 4.5}
                          stroke="white"
                          strokeWidth="1.5"
                          opacity={active ? 0.9 : 0.3}
                          filter={active ? "url(#radarBlur)" : undefined}
                          onMouseEnter={() => setHoveredId(sector.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          className="cursor-pointer transition-all duration-200"
                        />
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={active ? 2.5 : 1.2}
                          fill="white"
                          opacity={active ? 1 : 0.4}
                          onMouseEnter={() => setHoveredId(sector.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          className="cursor-pointer transition-all duration-200"
                        />
                      </g>
                    );
                  })}
                </g>

                <circle cx="50" cy="30" r="1.5" fill="white" />
                <circle cx="50" cy="30" r="3" fill="none" stroke="white" strokeWidth="0.3" opacity="0.4" />

                {SECTORS.map((sector) => {
                  const pos = getSectorPos(sector.angle);
                  const active = hoveredId === sector.id;
                  return (
                    <text
                      key={sector.id}
                      x={pos.x}
                      y={pos.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={active ? 2.4 : 1.7}
                      fontFamily="var(--font-inter), ui-sans-serif, system-ui, sans-serif"
                      fill={active ? "white" : "#71717A"}
                      fontWeight={active ? "600" : "400"}
                      letterSpacing="0.05em"
                      opacity={active ? 1 : 0.5}
                      onMouseEnter={() => setHoveredId(sector.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className="cursor-pointer select-none transition-all duration-200"
                      style={{ userSelect: "none" }}
                    >
                      {sector.short}
                    </text>
                  );
                })}
              </svg>
            </div>

            <div className="mt-8 flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-white/60 shadow-[0_0_8px_rgba(255,255,255,0.4)] animate-pulse" />
              <span className="font-sans text-xs uppercase tracking-[0.15em] text-[#94A3B8]/80 font-medium">
                Sweep angle: {radarAngle.toFixed(0)}°
              </span>
            </div>
          </div>

          {/* Right: Metrics */}
          <div className="space-y-3">
            {SECTORS.map((sector) => {
              const isActive = hoveredId === sector.id || (!hoveredId && sector.id === "defence");
              return (
                <div
                  key={sector.id}
                  className={`group relative overflow-hidden cursor-pointer border rounded-none p-4 transition-all duration-200 ${
                    isActive
                      ? "border-white bg-white/[0.02] shadow-[0_0_20px_rgba(255,255,255,0.03)]"
                      : "border-white/10 bg-white/[0.01] hover:border-white/20 hover:bg-white/[0.02]"
                  }`}
                  onMouseEnter={() => setHoveredId(sector.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-sans text-xs uppercase tracking-[0.15em] font-medium transition-colors duration-200 ${isActive ? "text-white" : "text-[#94A3B8]"}`}>
                      {sector.label}
                    </span>
                    <span className={`font-sans text-sm tabular-nums font-medium transition-colors duration-200 ${isActive ? "text-white" : "text-[#94A3B8]"}`}>
                      {sector.intentScore}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-white/[0.03] rounded-none overflow-hidden mb-2">
                    <div
                      className="h-full transition-all duration-500 ease-out bg-white"
                      style={{ width: `${sector.intentScore}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#94A3B8]/70 font-sans">
                    <span>{sector.preRfpCount} pre-RFP</span>
                    <span>{sector.liveTenderCount} live</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-14 border border-white/[0.1] bg-white/[0.01] rounded-none p-6 flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-white/60 shadow-[0_0_8px_rgba(255,255,255,0.4)] animate-pulse" />
            <span className="font-sans text-xs uppercase tracking-[0.15em] text-[#94A3B8]/80 font-medium">
              Active sector: {activeSector.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-white/60 shadow-[0_0_8px_rgba(255,255,255,0.4)] animate-pulse" />
            <span className="font-sans text-xs uppercase tracking-[0.15em] text-[#94A3B8]/80 font-medium">
              {activeSector.preRfpCount} pre-RFP
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-white/60 shadow-[0_0_8px_rgba(255,255,255,0.4)] animate-pulse" />
            <span className="font-sans text-xs uppercase tracking-[0.15em] text-[#94A3B8]/80 font-medium">
              {activeSector.liveTenderCount} live tenders
            </span>
          </div>
          <span className="ml-auto font-sans text-[10px] text-[#94A3B8]/70 uppercase tracking-[0.15em] font-medium">
            Intent model · SHA-256 weighted
          </span>
        </div>
      </div>
    </section>
  );
}
