"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    country: "United Kingdom",
    terms: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!formData.terms) {
      setError("You must agree to the Terms of Service and Privacy Policy to create an account.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          passwordConfirm: formData.password,
          country: formData.country,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Account creation failed.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Account creation failed.",
      );
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-between bg-black p-6 font-sans text-white selection:bg-white selection:text-black md:p-12">
      {/* Center Card Container */}
      <div className="mx-auto my-auto w-full max-w-md py-12">
        <div className="border border-white/10 bg-black p-8 shadow-2xl md:p-10">
          <h1 className="mb-2 text-2xl font-bold uppercase tracking-tight">
            Create your account
          </h1>
          <p className="mb-8 font-mono text-sm leading-relaxed text-zinc-400">
            Get started on the free tier. Access live contract leads across
            public sector portals.
          </p>

          {error && (
            <div
              role="alert"
              className="mb-5 border border-[#FF5500]/40 bg-[#FF5500]/10 p-3 font-mono text-xs leading-relaxed text-[#FF5500]"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block font-mono text-xs uppercase tracking-wider text-zinc-400"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@company.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-none border border-white/20 bg-zinc-950 p-3 font-mono text-sm text-white placeholder-zinc-600 transition-colors focus:border-white focus:outline-none"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block font-mono text-xs uppercase tracking-wider text-zinc-400"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="At least 10 characters"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })}
                className="w-full rounded-none border border-white/20 bg-zinc-950 p-3 font-mono text-sm text-white placeholder-zinc-600 transition-colors focus:border-white focus:outline-none"
              />
              <p className="font-mono text-[10px] leading-relaxed text-zinc-600">
                Minimum 10 characters with uppercase, lowercase and a number.
              </p>
            </div>

            {/* Country Selector */}
            <div className="space-y-2">
              <label
                htmlFor="country"
                className="block font-mono text-xs uppercase tracking-wider text-zinc-400"
              >
                Country
              </label>
              <select
                id="country"
                value={formData.country}
                onChange={(e) =>
                  setFormData({ ...formData, country: e.target.value })}
                className="w-full rounded-none border border-white/20 bg-zinc-950 p-3 font-mono text-sm text-white transition-colors focus:border-white focus:outline-none"
              >
                <option value="United Kingdom">United Kingdom</option>
                <option value="United States">United States</option>
                <option value="Canada">Canada</option>
                <option value="Ireland">Ireland</option>
                <option value="Australia">Australia</option>
                <option value="European Union">European Union</option>
              </select>
            </div>

            {/* Terms Checkbox */}
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <input
                  id="terms"
                  type="checkbox"
                  checked={formData.terms}
                  onChange={(e) =>
                    setFormData({ ...formData, terms: e.target.checked })}
                  className="switch-control w-4 h-4 mt-0.5 shrink-0"
                />
                <div className="flex-1">
                  <p className="text-xs font-inter font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    I agree to the Terms of Service and Privacy Policy
                  </p>
                  <p className="text-[9px] font-inter text-slate-400 leading-relaxed">
                    By creating an account you agree to our <a href="/terms" className="text-D4AF37 hover:text-D4AF37/80 underline">Terms of Service</a> and <a href="/privacy" className="text-D4AF37 hover:text-D4AF37/80 underline">Privacy Policy</a>, including the as-is data disclaimer and non-refundable subscription terms.
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-none bg-white py-4 font-mono text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create Account →"}
            </button>
          </form>

          <p className="mt-6 text-center font-mono text-xs leading-normal text-zinc-500">
            Already have an account?{" "}
            <Link
              href="/auth/signin"
              className="text-white underline underline-offset-4 transition-colors hover:text-[#FF5500]"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-6xl border-t border-white/10 pt-6 text-center font-mono text-xs text-zinc-600">
        Contains public sector information licensed under the Open Government
        Licence v3.0.
      </footer>
    </div>
  );
}
