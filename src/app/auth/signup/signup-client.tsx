"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function SignUpPageClient() {
  const router = useRouter();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [passwordConfirm, setPasswordConfirm] = React.useState("");
  const [organisationName, setOrganisationName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          passwordConfirm,
          organisationName: organisationName || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Signup failed.");
        setLoading(false);
        return;
      }

      // Full navigation so the cross-domain session cookie is applied before
      // the dashboard request runs.
      window.location.replace(data.redirectTo || "/dashboard");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Signup failed.",
      );
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-md surface-panel p-8">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="flex h-8 w-8 items-center justify-center bg-[#FF5500]/10 border border-[#FF5500]/30">
            <svg
              className="h-5 w-5 text-[#FF5500]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 8.088 9.246 9.318 7.88 10.555 6.539 11.747 4 12.841 4 15h16c0-2.159-2.539-3.253-3.88-4.445-1.366-1.237-2.952-2.467-4.12-3.303m0 0c.227-.206.472-.387.727-.545.58-.36 1.16-.68 1.73-.89 1.134-.425 2.267-.858 3.4-1.215.54-.168 1.081-.335 1.622-.502 1.216-.392 2.43-.784 3.64-1.174.57-.183 1.141-.362 1.71-.543 1.128-.358 2.257-.716 3.38-1.073.53-.17 1.065-.339 1.597-.509.53-.17 1.065-.339 1.597-.509"
              />
            </svg>
          </div>
          <div className="text-[10px] font-mono tracking-[0.25em] text-[#94A3B8] uppercase">
            SourceSignal // Create account
          </div>
        </div>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-medium tracking-tight text-[#ffffff] mb-2">
            Create your account
          </CardTitle>
          <p className="text-[#94A3B8] body-copy">
            Set up your organisation on the free plan. Upgrade to Pro for full opportunity details,
            exports and the live opportunity map.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="border border-[#FF5500]/30 bg-[#FF5500]/10 p-3 text-sm text-[#FF5500]">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs font-mono tracking-[0.2em] text-[#94A3B8] uppercase block mb-1">
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
              <Label htmlFor="password" className="text-xs font-mono tracking-[0.2em] text-[#94A3B8] uppercase block mb-1">
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
              <Label htmlFor="passwordConfirm" className="text-xs font-mono tracking-[0.2em] text-[#94A3B8] uppercase block mb-1">
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
              <Label htmlFor="organisationName" className="text-xs font-mono tracking-[0.2em] text-[#94A3B8] uppercase block mb-1">
                Organisation / Workspace
              </Label>
              <Input
                id="organisationName"
                placeholder="e.g. Acme Contracting Ltd"
                value={organisationName}
                onChange={(e) => setOrganisationName(e.target.value)}
                className="ghost-input h-10 text-xs px-3"
              />
              <p className="text-[10px] text-[#94A3B8]">
                Your organisation starts on the Free tier. All sectors are
                available; Pro adds full details, exports and the map.
              </p>
            </div>
            <Button type="submit" disabled={loading} className="w-full h-10 btn-ghost-primary text-xs font-bold tracking-[0.15em] uppercase hover:text-black hover:bg-white">
              Create account <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t border-white/[0.08]">
          <Separator orientation="horizontal" className="border-white/[0.08]" />
          <span className="text-xs font-mono tracking-[0.2em] text-[#94A3B8] uppercase">
            Already have an account?
          </span>
          <Button
            variant="ghost"
            className="w-full h-10 border-white/[0.10] text-xs font-mono tracking-[0.1em] uppercase hover:bg-white/[0.05] hover:border-white/30"
            onClick={() => router.push("/auth/signin")}
          >
            Sign in
          </Button>
        </CardFooter>
      </div>
    </div>
  );
}
