"use client";

import * as React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Map as MapLibreMap,
  LngLatBounds,
  NavigationControl,
  ScaleControl,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Button } from "@/components/ui/button";
import {
  Globe,
  DollarSign,
  Activity,
  ShieldCheck,
} from "lucide-react";

const API_URL =
  typeof window !== "undefined"
    ? window.location.origin + "/api/map/signals"
    : "";

const DARK_STYLE: any = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [],
      tileSize: 256,
      attribution: "SourceSignal Spatial Radar",
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#09090b",
      },
    },
  ],
};

interface MapSignal {
  id: string;
  title: string;
  buyer?: string | null;
  jurisdiction?: string | null;
  sector?: string | null;
  opportunity_type?: string | null;
  estimated_value?: number | null;
  latitude: number;
  longitude: number;
  source_name?: string | null;
  source_url?: string | null;
  sha256_hash?: string | null;
  commercial_why?: string | null;
  published_at?: string | null;
}

interface MapStats {
  count: number;
  totalValue: number;
  totalValueFormatted: string;
  signalCount: number;
  byTier: Record<string, number>;
}

const tierColors: Record<string, string> = {
  PROJECT: "#10b981", // emerald - high probability pre-RFP
  PROCUREMENT: "#d4af37", // gold - live tender
  EXPANSION: "#10b981",
  COMPLIANCE: "#6366f1",
  POLICY: "#a1a1aa",
};

export default function MapPage() {
  const mapRef = useRef<MapLibreMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<MapStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [bounds, setBounds] = useState<{
    west: number;
    south: number;
    east: number;
    north: number;
  } | null>(null);

  // Initialize the map once the container mounts.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: DARK_STYLE,
      center: [-2.0, 54.0],
      zoom: 5,
      pitch: 0,
      bearing: 0,
      antialias: true,
      interactive: true,
    });

    mapRef.current = map;

    // Add navigation controls.
    map.addControl(new NavigationControl(), "top-right");

    // Add a scale control.
    map.addControl(new ScaleControl({}), "bottom-right");

    // Store the initial viewport bounds and fetch signals.
    const initialBounds = map.getBounds();
    setBounds({
      west: initialBounds.getWest(),
      south: initialBounds.getSouth(),
      east: initialBounds.getEast(),
      north: initialBounds.getNorth(),
    });

    // Debounced viewport change handler for bounding-box queries.
    let debounceTimer: NodeJS.Timeout;
    const onMoveEnd = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const b = map.getBounds();
        setBounds({
          west: b.getWest(),
          south: b.getSouth(),
          east: b.getEast(),
          north: b.getNorth(),
        });
        fetchSignalsInBounds(b);
      }, 150);
    };

    map.on("moveend", onMoveEnd);
    map.on("zoomend", onMoveEnd);

    // Fetch signals for the initial viewport.
    fetchSignalsInBounds(initialBounds);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      map.off("moveend", onMoveEnd);
      map.off("zoomend", onMoveEnd);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const fetchSignalsInBounds = useCallback(
    async (bounds: LngLatBounds) => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_URL}?west=${bounds.getWest().toFixed(4)}&south=${bounds.getSouth().toFixed(4)}&east=${bounds.getEast().toFixed(4)}&north=${bounds.getNorth().toFixed(4)}`,
          {
            credentials: "include",
            headers: { Accept: "application/json" },
          },
        );
        if (!res.ok) return;
        const data = await res.json();
        setStats({
          count: data.count ?? 0,
          totalValue: data.totalValue ?? 0,
          totalValueFormatted: data.totalValueFormatted ?? "—",
          signalCount: data.signalCount ?? 0,
          byTier: data.byTier ?? {},
        });
        renderSignals(mapRef.current, data.items ?? []);
      } catch {
        // Silent fail — map remains usable without live stats.
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const renderSignals = useCallback(
    (map: MapLibreMap | null, signals: MapSignal[]) => {
      if (!map) return;

      // Remove existing layers/sources.
      ["signal-points", "signal-clusters", "signal-cluster-count"].forEach(
        (id) => {
          if (map.getLayer(id)) map.removeLayer(id);
        },
      );
      ["signals"].forEach((id) => {
        if (map.getSource(id)) map.removeSource(id);
      });

      if (signals.length === 0) return;

      // Add a GeoJSON source with cluster options.
      map.addSource("signals", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: signals.map((s) => ({
            type: "Feature",
            properties: {
              id: s.id,
              title: s.title,
              buyer: s.buyer ?? "",
              jurisdiction: s.jurisdiction ?? "",
              sector: s.sector ?? "",
              opportunity_type: s.opportunity_type ?? "",
              estimated_value: s.estimated_value ?? 0,
              source_name: s.source_name ?? "",
              source_url: s.source_url ?? "",
              sha256_hash: s.sha256_hash ?? "",
              commercial_why: s.commercial_why ?? "",
              published_at: s.published_at ?? "",
              tierColor:
                tierColors[s.opportunity_type ?? "UNKNOWN"] ?? "#a1a1aa",
            },
            geometry: {
              type: "Point",
              coordinates: [s.longitude, s.latitude],
            },
          })),
        },
        cluster: true,
        clusterMaxZoom: 14, // Zoom to split clusters into individual pins
        clusterRadius: 50,
      } as any);

      // Cluster layer — emerald (pre-RFP) and gold (live tender) glow rings.
      map.addLayer({
        id: "signal-clusters",
        type: "circle",
        source: "signals",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "case",
            ["boolean", ["feature-state", "cluster"], false],
            "#09090b",
            [
              "match",
              ["get", "opportunity_type"],
              "PROJECT",
              "#10b981",
              "PROCUREMENT",
              "#d4af37",
              "#a1a1aa",
            ],
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            20,
            100,
            30,
            500,
            40,
          ],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#09090b",
          "circle-opacity": 0.85,
          "circle-blur": 0.5,
          "circle-stroke-opacity": 0.6,
        },
      });

      // Cluster count labels.
      map.addLayer({
        id: "signal-cluster-count",
        type: "symbol",
        source: "signals",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      // Unclustered point layer — individual pins.
      map.addLayer({
        id: "signal-points",
        type: "circle",
        source: "signals",
        filter: ["!has", "point_count"],
        paint: {
          "circle-color": ["get", "tierColor"],
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#09090b",
          "circle-opacity": 0.9,
          "circle-blur": 0.2,
        },
      });

      // Click handler: zoom into cluster or open pin detail.
      map.on("click", "signal-clusters", (e: any) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["signal-clusters"],
        });
        if (features.length === 0) return;
        const clusterId = features[0].properties.cluster_id;
        const source = map.getSource("signals") as GeoJSONSource;
        if (source) {
          source.getClusterExpansionZoom(clusterId, (err: any, zoom: any) => {
            if (err) return;
            map.easeTo({
              center: (features[0].geometry as any).coordinates as [number, number],
              zoom: (zoom as number) ?? map.getZoom() + 2,
              duration: 600,
            });
          });
        }
      });

      map.on("click", "signal-points", (e: any) => {
        const feature = e.features[0];
        map.flyTo({
          center: feature.geometry.coordinates as [number, number],
          zoom: 15,
          duration: 800,
        });
      });

      // Cursor styling on hover.
      map.on("mouseenter", "signal-clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "signal-clusters", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", "signal-points", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "signal-points", () => {
        map.getCanvas().style.cursor = "";
      });
    },
    [],
  );

  return (
    <div className="flex flex-col h-full bg-[#09090b] text-[#E5E5EA] overflow-x-hidden">
      {/* Top bar */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-emerald-400" />
          <span className="font-inter font-semibold tracking-tight text-white text-sm">
            Spatial Radar — Live Pipeline Map
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-inter font-mono text-slate-500 tabular-nums">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live viewport queries</span>
          </div>
        </div>
      </div>

      {/* Map container */}
      <div className="flex-1 relative overflow-hidden min-w-0">
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        {/* Floating stats panel — bottom left */}
        <div className="absolute bottom-6 left-6 z-30 flex flex-col gap-2 pointer-events-none">
          <div
            className={`pointer-events-auto glass-card px-4 py-3 min-w-[320px] transition-all duration-300 ${
              loading ? "opacity-50" : "opacity-100"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-400">
                  Active pipeline in viewport
                </span>
              </div>
              {loading && (
                <Activity className="h-4 w-4 animate-spin text-zinc-500" />
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-3xl font-bold text-white tabular-nums">
                {stats?.totalValueFormatted ?? "—"}
              </span>
              <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-tighter">
                {stats?.signalCount ?? 0} signals · {stats?.count ?? 0} clusters
              </span>
            </div>
            {stats && Object.entries(stats.byTier).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(stats.byTier).map(([tier, count]) => (
                  <span
                    key={tier}
                    className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-[0.1em] border ${
                      tier === "PROCUREMENT"
                        ? "border-d4af37/40 bg-d4af37/10 text-d4af37"
                        : tier === "PROJECT"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                          : "border-white/10 bg-white/5 text-zinc-400"
                    }`}
                  >
                    {tier} · {count}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2 font-mono text-[9px] text-zinc-500 uppercase tracking-[0.12em]">
              Drag the map to update spatial bounds · Click clusters to split into pins
            </div>
          </div>
        </div>

        {/* Legend — top left */}
        <div className="absolute top-6 left-6 z-30 pointer-events-none">
          <div className="pointer-events-auto glass-card px-3 py-2 flex flex-col gap-1">
            <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-zinc-400 mb-1">
              Signal tiers
            </div>
            <div className="flex gap-2">
              <span className="flex items-center gap-1.5 px-2 py-1 rounded border border-emerald-500/40 bg-emerald-500/10 text-[9px] text-emerald-400 font-mono">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Pre-RFP (emerald)
              </span>
              <span className="flex items-center gap-1.5 px-2 py-1 rounded border border-d4af37/40 bg-d4af37/10 text-[9px] text-d4af37 font-mono">
                <span className="h-2 w-2 rounded-full bg-d4af37" />
                Live tender (gold)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom stats bar */}
      <div className="h-12 border-t border-white/5 bg-[#050505] px-6 flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-[0.15em]">
        <span>
          <ShieldCheck className="h-3 w-3 mr-1 text-emerald-400" /> Spatial
          query engine active
        </span>
        <span>
          {bounds ? `Viewport: ${bounds.west.toFixed(3)}, ${bounds.south.toFixed(3)} → ${bounds.east.toFixed(3)}, ${bounds.north.toFixed(3)}` : "—"}
        </span>
        <span>MapLibre GL · Dark Monochrome Industrial</span>
      </div>
    </div>
  );
}
