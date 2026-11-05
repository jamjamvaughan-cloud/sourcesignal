"use client";

import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export function IllustrativeBadge({
  className,
}: {
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={[
        "text-xs font-medium flex items-center gap-1.5 text-[#71717A] border-[#71717A] hover:bg-[#FF5500]/5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      Illustrative sample data — not live
    </Badge>
  );
}
