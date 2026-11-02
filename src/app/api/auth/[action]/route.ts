/**
 * Authentication API for dynamic actions.
 *
 * POST /api/auth/signin   — verify credentials and issue a session cookie
 * POST /api/auth/signup   — create an account (static route also exists)
 * POST /api/auth/signout  — clear the session cookie and stored session
 * GET  /api/auth/me       — resolve the current session's user + plan
 */

import { NextRequest, NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { deleteSession, getSession, setSession } from "@/lib/redis";
import {
  SESSION_TTL,
  buildSessionCookie,
  clearSessionCookie,
  getCurrentUser,
  getUserPlanId,
  readSessionToken,
} from "@/lib/auth";
import { rateLimitResponse } from "@/lib/rate-limit";
import { error, info } from "@/lib/logger";
import bcrypt from "bcryptjs";
import { sign } from "jsonwebtoken";

const AUTH_RATE_LIMIT = { max: 20, windowMs: 60 * 1000 };
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const SUPPORTED_COUNTRIES = new Set(["UK", "US", "CA", "IE", "AU", "EU"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * CSRF guard: verify the Origin header matches the request host for mutations.
 */
function csrfGuard(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) {
    return null;
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json({ error: "Invalid Origin header." }, { status: 400 });
  }

  // The browser talks to the frontend origin, but the API request may arrive
  // directly (api.sourcesignal.site) or via the Vercel rewrite. Accept any host
  // that the reverse proxy reports for this request plus the configured app
  // origin. Comparing only against `Host` would reject the proxied hop.
  const allowedHosts = new Set<string>();
  for (const raw of [
    request.headers.get("x-forwarded-host"),
    request.headers.get("host"),
  ]) {
    const value = raw?.split(",")[0]?.trim();
    if (value) allowedHosts.add(value);
  }
  for (const raw of [process.env.APP_ORIGIN, process.env.NEXT_PUBLIC_APP_URL]) {
    if (!raw) continue;
    try {
      allowedHosts.add(new URL(raw).host);
    } catch {
      // Ignore malformed configuration; it cannot widen the allow-list.
    }
  }

  if (allowedHosts.size > 0 && !allowedHosts.has(originHost)) {
    return NextResponse.json({ error: "CSRF token mismatch." }, { status: 403 });
  }
  return null;
}

/**
 * Validate password strength: min 10 chars, mixed-case, at least one digit.
 */
function validatePassword(password: string): string | null {
  if (password.length < 10) {
    return "Password must be at least 10 characters.";
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return "Password must contain both uppercase and lowercase letters.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one digit.";
  }
  return null;
}

function normaliseCountry(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return SUPPORTED_COUNTRIES.has(raw) ? raw : "UK";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;

  // CSRF guard on mutation endpoints.
  if (action === "signup" || action === "signin" || action === "signout") {
    const csrfError = csrfGuard(request);
    if (csrfError) return csrfError;
  }

  // Rate limit signin and signup.
  if (action === "signin" || action === "signup") {
    const rateLimitResult = await rateLimitResponse(request, AUTH_RATE_LIMIT);
    if (rateLimitResult) return rateLimitResult;
  }

  const body = await request.json().catch(() => ({}));

  switch (action) {
    case "signup": {
      const { email, password, passwordConfirm, organisationName, country } =
        body as Record<string, unknown>;

      const normalizedEmail =
        typeof email === "string" ? email.toLowerCase().trim() : "";
      const passwordValue = typeof password === "string" ? password : "";

      if (!normalizedEmail || !passwordValue) {
        return NextResponse.json(
          { error: "Email and password are required." },
          { status: 400 },
        );
      }
      if (!EMAIL_PATTERN.test(normalizedEmail)) {
        return NextResponse.json(
          { error: "Please enter a valid email address." },
          { status: 400 },
        );
      }
      if (
        typeof passwordConfirm === "string" &&
        passwordConfirm !== passwordValue
      ) {
        return NextResponse.json(
          { error: "Passwords do not match." },
          { status: 400 },
        );
      }
      const passwordError = validatePassword(passwordValue);
      if (passwordError) {
        return NextResponse.json({ error: passwordError }, { status: 400 });
      }

      try {
        const existing = await query(
          `SELECT id FROM users WHERE email = $1`,
          [normalizedEmail],
        );
        if ((existing.rowCount ?? 0) > 0) {
          return NextResponse.json(
            { error: "Email already registered." },
            { status: 409 },
          );
        }

        const passwordHash = await bcrypt.hash(passwordValue, 10);

        const created = await withTransaction(async (client) => {
          const userResult = await client.query(
            `INSERT INTO users (email, password_hash, subscription_tier, created_at, updated_at)
             VALUES ($1, $2, 'free', NOW(), NOW())
             RETURNING id, email, subscription_tier`,
            [normalizedEmail, passwordHash],
          );
          const userId = userResult.rows[0].id as string;

          let organisationId: string | null = null;
          const orgName =
            typeof organisationName === "string"
              ? organisationName.trim()
              : "";

          if (orgName) {
            const slugBase =
              orgName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "") || "workspace";
            const orgResult = await client.query(
              `INSERT INTO organisations (name, slug, plan, country, owner_id, created_by, created_at, updated_at)
               VALUES ($1, $2, 'free', $3, $4, $4, NOW(), NOW())
               RETURNING id`,
              [
                orgName,
                `${slugBase}-${userId.slice(0, 8)}`,
                normaliseCountry(country),
                userId,
              ],
            );
            organisationId = orgResult.rows[0].id as string;

            await client.query(
              `INSERT INTO memberships (organisation_id, user_id, role, created_at, updated_at)
               VALUES ($1, $2, 'owner', NOW(), NOW())`,
              [organisationId, userId],
            );

            await client.query(
              `UPDATE users SET organisation_id = $1, updated_at = NOW() WHERE id = $2`,
              [organisationId, userId],
            );
          }

          return { userId, email: normalizedEmail, organisationId };
        });

        const token = sign(
          { userId: created.userId, email: created.email },
          JWT_SECRET,
          { expiresIn: SESSION_TTL },
        );
        await setSession(
          token,
          { userId: created.userId, email: created.email },
          SESSION_TTL,
        );

        const response = NextResponse.json({
          user: { id: created.userId, email: created.email },
          organisationId: created.organisationId,
          plan: "free",
        });
        response.headers.set(
          "Set-Cookie",
          buildSessionCookie(token, SESSION_TTL),
        );
        return response;
      } catch (err: unknown) {
        error("auth_signup_failed", {
          error: err instanceof Error ? err.stack ?? err.message : String(err),
          email: normalizedEmail,
        });
        return NextResponse.json({ error: "Signup failed." }, { status: 500 });
      }
    }

    case "signin": {
      const { email, password } = body as Record<string, unknown>;
      const normalizedEmail =
        typeof email === "string" ? email.toLowerCase().trim() : "";
      const passwordValue = typeof password === "string" ? password : "";

      if (!normalizedEmail || !passwordValue) {
        return NextResponse.json(
          { error: "Email and password are required." },
          { status: 400 },
        );
      }

      try {
        const userResult = await query(
          `SELECT id, email, password_hash, subscription_tier FROM users WHERE email = $1`,
          [normalizedEmail],
        );

        if (userResult.rowCount === 0) {
          return NextResponse.json(
            { error: "Invalid email or password." },
            { status: 401 },
          );
        }

        const user = userResult.rows[0];
        const passwordMatch = await bcrypt.compare(
          passwordValue,
          user.password_hash as string,
        );
        if (!passwordMatch) {
          return NextResponse.json(
            { error: "Invalid email or password." },
            { status: 401 },
          );
        }

        const token = sign(
          { userId: user.id, email: user.email },
          JWT_SECRET,
          { expiresIn: SESSION_TTL },
        );
        await setSession(
          token,
          { userId: user.id as string, email: user.email as string },
          SESSION_TTL,
        );

        const response = NextResponse.json({
          user: { id: user.id, email: user.email },
          plan: await getUserPlanId(user.id as string),
        });
        response.headers.set(
          "Set-Cookie",
          buildSessionCookie(token, SESSION_TTL),
        );
        return response;
      } catch (err: unknown) {
        error("auth_signin_failed", {
          error: err instanceof Error ? err.stack ?? err.message : String(err),
          email: normalizedEmail,
        });
        return NextResponse.json(
          { error: "Sign in is temporarily unavailable. Please try again." },
          { status: 500 },
        );
      }
    }

    case "signout": {
      const token = readSessionToken(request.headers.get("cookie"));
      if (token) {
        await deleteSession(token).catch((err: unknown) => {
          error("auth_signout_failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }

      const response = NextResponse.json({ ok: true });
      response.headers.set("Set-Cookie", clearSessionCookie());
      return response;
    }

    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 404 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  if (action !== "me") {
    return NextResponse.json({ error: "Unknown action." }, { status: 404 });
  }

  const cookieHeader = request.headers.get("cookie");
  const user = await getCurrentUser(cookieHeader);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const sessionId = readSessionToken(cookieHeader);
    if (sessionId) {
      const session = await getSession(sessionId);
      if (!session) {
        return NextResponse.json(
          { error: "Not authenticated." },
          { status: 401 },
        );
      }
    }

    const plan = await getUserPlanId(user.id);
    info("auth_me", { userId: user.id, plan });

    return NextResponse.json({
      user: { id: user.id, email: user.email, country: user.country ?? null },
      plan,
    });
  } catch (err: unknown) {
    error("auth_me_failed", {
      userId: user.id,
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Session check failed. Please try again." },
      { status: 500 },
    );
  }
}
