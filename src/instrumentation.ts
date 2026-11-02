/**
 * Server startup checks.
 *
 * The Vercel deployment is frontend-only and intentionally has no database,
 * Redis or Stripe credentials, so environment validation is skipped there.
 * On the VPS (API + worker deployment) startup fails fast if the server is
 * misconfigured.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.VERCEL) return;

  const { validateServerEnv } = await import("@/lib/env");
  validateServerEnv();
}
