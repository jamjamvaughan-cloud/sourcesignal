/**
 * Next.js proxy for SourceSignal.
 *
 * Combines route protection and secure response headers.
 *
 * - Protects /dashboard/* routes by checking for the session auth cookie.
 * - Sets security-conscious response headers (X-Content-Type-Options,
 *   X-Frame-Options, Referrer-Policy, CSP, HSTS on HTTPS).
 *
 * The public landing page and auth routes remain accessible.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATH_PREFIXES = [
  "/api",
  "/_next",
  "/auth",
  "/favicon.ico",
];

const DASHBOARD_PREFIX = "/dashboard";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and static assets.
  if (PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
    const response = NextResponse.next();
    return setSecurityHeaders(response, request);
  }

  // Protect dashboard routes.
  if (pathname.startsWith(DASHBOARD_PREFIX) || pathname === "/dashboard") {
    const cookieHeader = request.headers.get("cookie");
    const hasAuthCookie = cookieHeader
      ? /(?:^|; )session_id=([^;]+)/.test(cookieHeader)
      : false;

    if (!hasAuthCookie) {
      const signInUrl = new URL("/auth/signin", request.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      const response = NextResponse.redirect(signInUrl);
      return setSecurityHeaders(response, request);
    }
  }

  const response = NextResponse.next();
  return setSecurityHeaders(response, request);
}

function setSecurityHeaders(
  response: NextResponse,
  request: NextRequest,
): NextResponse {
  // Prevent MIME-type sniffing.
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking.
  response.headers.set("X-Frame-Options", "DENY");

  // Enable XSS filter (legacy, defense in depth).
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Referrer policy: don't leak URLs to third parties.
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content Security Policy — restrictive but compatible with Next.js.
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.sourcesignal.site",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  );

  // Strict transport security (only when served over HTTPS).
  if (request.nextUrl.protocol === "https:") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)",
  ],
};
