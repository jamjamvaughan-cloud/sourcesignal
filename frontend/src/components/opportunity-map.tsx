"use client";

import * as React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface OpportunityMapPoint {
  id: string;
  title: string;
  sector: string;
  region: string;
  latitude: number;
  longitude: number;
  value?: number;
  currency?: string;
  stage: string;
}

interface MapCanvasProps {
  opportunities: OpportunityMapPoint[];
  onSelect?: (id: string) => void;
  selectedId?: string | null;
}

export function MapCanvas({
  opportunities,
  onSelect,
  selectedId,
}: MapCanvasProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 0, 5], fov: 25 }}
      className="rounded-none border border-white/[0.05] bg-black h-[400px]"
      style={{ backgroundColor: "#000000" }}
    >
      <OrbitControls enableZoom enablePan makeDefault />
      <Stars radius={100} depth={50} count={3000} factor={4} speed={1} />

      {opportunities.map((opp) => {
        const lat = opp.latitude;
        const lon = opp.longitude;
        const phi = ((90 - lat) * Math.PI) / 180;
        const theta = ((lon + 180) * Math.PI) / 180;
        const x = 4 * Math.sin(phi) * Math.cos(theta);
        const y = 4 * Math.cos(phi);
        const z = 4 * Math.sin(phi) * Math.sin(theta);

        const isSelected = selectedId === opp.id;

        return (
          <mesh
            key={opp.id}
            position={[x, y, z]}
            onClick={() => onSelect?.(opp.id)}
            scale={isSelected ? [1.5, 1.5, 1.5] : [1, 1, 1]}
          >
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial
              color={isSelected ? "#FF5500" : "#FFFFFF"}
              emissive={isSelected ? "#FF5500" : "#FFFFFF"}
              emissiveIntensity={0.3}
            />
          </mesh>
        );
      })}
    </Canvas>
  );
}

export function OpportunityMap({
  opportunities,
  selectedOpportunity,
}: {
  opportunities: OpportunityMapPoint[];
  selectedOpportunity: OpportunityMapPoint | null;
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(
    selectedOpportunity?.id ?? null,
  );

  const [error, setError] = React.useState<Error | null>(null);

  if (error) {
    return (
      <div className="border border-[#FF5500]/20 bg-[#FF5500]/05 p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-[#FF5500]" aria-hidden="true" />
          <span className="text-sm font-medium text-[#FF5500]">
            Map Failed to Load
          </span>
        </div>
        <p className="mt-2 text-sm text-[#FF5500]">{error.message}</p>
        <Button variant="ghost" size="sm" onClick={() => setError(null)}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black">
      <div className="flex-1 relative">
        <MapCanvas
          opportunities={opportunities}
          onSelect={(id) => setSelectedId(id)}
          selectedId={selectedId}
        />
      </div>

      {selectedOpportunity && (
        <div className="border-t border-white/[0.08] bg-black p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-[#ffffff]">
              {selectedOpportunity.title}
            </h3>
            <Badge
              variant="outline"
              className="text-xs text-[#94A3B8] border-white/[0.15]"
            >
              {selectedOpportunity.stage}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
            <span>{selectedOpportunity.sector}</span>
            <span className="text-[#71717A]">•</span>
            <span>{selectedOpportunity.region}</span>
            {selectedOpportunity.value && (
              <span className="ml-2 font-medium text-[#ffffff] data-text">
                {selectedOpportunity.value} {selectedOpportunity.currency || "GBP"}
              </span>
            )}
          </div>
          <div className="mt-2 text-[10px] text-[#71717A] font-mono">
            {selectedOpportunity.latitude.toFixed(4)},{" "}
            {selectedOpportunity.longitude.toFixed(4)}
          </div>
        </div>
      )}
    </div>
  );
}
