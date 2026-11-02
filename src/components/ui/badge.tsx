import * as React from "react"
import { cn } from "cn"

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost"
}) {
  return (
    <div
      data-slot="badge"
      className={cn(
        "inline-flex items-center rounded-none border px-2.5 py-0.5 text-xs font-medium transition-colors",
        variant === "default"
          ? "bg-primary text-primary-foreground"
          : variant === "secondary"
            ? "bg-secondary text-secondary-foreground"
            : variant === "destructive"
              ? "bg-destructive text-destructive-foreground"
              : variant === "outline"
                ? "border border-input bg-transparent"
                : "bg-accent text-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Badge }
