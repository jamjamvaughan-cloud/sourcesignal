"use client";

import * as React from "react";
import { LogOut } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface SignOutButtonProps {
  className?: string;
  showLabel?: boolean;
}

/**
 * Clears the server session via fetch, then performs a full navigation to the
 * sign-in page. Never links directly to the API route — that would render the
 * raw JSON response in the browser.
 */
export function SignOutButton({
  className = "",
  showLabel = true,
}: SignOutButtonProps) {
  const [pending, setPending] = React.useState(false);

  const handleSignOut = async () => {
    if (pending) return;
    setPending(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/signout`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as {
        redirectTo?: string;
      } | null;
      window.location.replace(data?.redirectTo || "/auth/signin");
    } catch {
      // Even if the network call fails, never leave the user staring at an
      // API endpoint. Send them to sign-in, where they can retry.
      window.location.replace("/auth/signin");
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      aria-busy={pending}
      className={`whitespace-nowrap disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
      {showLabel && (
        <span className="hidden sm:inline">
          {pending ? "Signing out" : "Sign out"}
        </span>
      )}
    </button>
  );
}
