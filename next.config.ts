import type { NextConfig } from "next";

/**
 * SourceSignal runs as two deployments of the same codebase:
 *
 *   - Vercel (frontend): `BACKEND_URL` points at the VPS API and `/api/*` is
 *     rewritten there. No database or secret credentials live on Vercel.
 *   - VPS (API): `BACKEND_URL` is unset, so API routes are served locally and
 *     the app runs in standalone mode behind Caddy.
 */
const backendUrl = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.BACKEND_URL ??
  process.env.API_BACKEND_URL
)
  ?.trim()
  .replace(/\/+$/, "");

const appOrigin =
  process.env.APP_ORIGIN?.trim() ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://sourcesignal.site");

const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  serverComponentsExternalPackages: ["ioredis", "bcryptjs"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  async rewrites() {
    if (!backendUrl) {
      // VPS deployment: serve API routes from this process.
      return [];
    }

    // Frontend deployment: proxy API traffic (including SSE) to the VPS.
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: appOrigin,
          },
          {
            key: "Vary",
            value: "Origin",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "Content-Type, Authorization, Stripe-Signature, X-SourceSignal-Signature",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
