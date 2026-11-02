"use server";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { deleteSession, getSession, setSession } from "@/lib/redis";
import {
  SESSION_TTL,
  buildSessionCookie,
  clearSessionCookie,
  readSessionToken,
} from "@/lib/auth";
import { rateLimitResponse } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { sign } from "jsonwebtoken";

const AUTH_RATE_LIMIT = { max: 10, windowMs: 60 * 1000 };
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

/**
 * CSRF guard: verify Origin header matches the request host for mutations.
 */
function csrfGuard(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) {
    return null;
  }
  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      return NextResponse.json({ error: "CSRF token mismatch." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid Origin header." }, { status: 400 });
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
      const { email, password, passwordConfirm, organisationName, country } = body;
      if (!email || !password || !passwordConfirm) {
        return NextResponse.json(
          { error: "Email, password and password confirmation are required." },
          { status: 400 },
        );
      }
      if (password !== passwordConfirm) {
        return NextResponse.json(
          { error: "Passwords do not match." },
          { status: 400 },
        );
      }
      const passwordError = validatePassword(password);
      if (passwordError) {
        return NextResponse.json({ error: passwordError }, { status: 400 });
      }

      try {
        const normalizedEmail = email.toLowerCase().trim();

        // Check if user already exists
        const existing = await query(
          `SELECT id FROM users WHERE email = $1`,
          [normalizedEmail],
        );
        if ((existing.rowCount ?? 0) > 0) {
          return NextResponse.json({ error: "Email already registered." }, { status: 409 });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert user
        const userResult = await query(
          `INSERT INTO users (id, email, password_hash, subscription_tier, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, 'free', NOW(), NOW())
           RETURNING id, email, subscription_tier`,
          [normalizedEmail, passwordHash],
        );

        const userId = userResult.rows[0].id;

        // Create organisation if organisation name provided
        let organisationId: string | null = null;
        if (organisationName) {
          const slugBase =
            organisationName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "") || "workspace";
          const orgResult = await query(
            `INSERT INTO organisations (name, slug, plan, country, owner_id, created_by, created_at, updated_at)
             VALUES ($1, $2, 'free', $3, $4, $4, NOW(), NOW())
             RETURNING id`,
            [organisationName, `${slugBase}-${userId.slice(0, 8)}`, country ?? "UK", userId],
          );
          organisationId = orgResult.rows[0].id;
          await query(
            `INSERT INTO memberships (organisation_id, user_id, role, created_at, updated_at)
             VALUES ($1, $2, 'owner', NOW(), NOW())`,
            [organisationId, userId],
          );
        }

        // Create JWT session token and persist it in the session store so
        // /api/auth/me can resolve the identity on the next request.
        const token = await sign(
          { userId, email: normalizedEmail },
          JWT_SECRET,
          { expiresIn: SESSION_TTL },
        );
        await setSession(
          token,
          { userId, email: normalizedEmail },
          SESSION_TTL,
        );

        const response = NextResponse.json({
          user: { id: userId, email: normalizedEmail },
          organisationId,
          plan: "free",
        });
        response.headers.set(
          "Set-Cookie",
          buildSessionCookie(token, SESSION_TTL),
        );
        return response;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Signup failed.";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    case "signin": {
      const { email, password } = body;
      if (!email || !password) {
        return NextResponse.json(
          { error: "Email and password are required." },
          { status: 400 },
        );
      }

      try {
        const normalizedEmail = email.toLowerCase().trim();
        const userResult = await query(
          `SELECT id, email, password_hash, subscription_tier FROM users WHERE email = $1`,
          [normalizedEmail],
        );

        if (userResult.rowCount === 0) {
          return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
        }

        const user = userResult.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
          return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
        }

        // Create JWT session token and persist it in the session store.
        const token = await sign(
          { userId: user.id, email: user.email },
          JWT_SECRET,
          { expiresIn: SESSION_TTL },
        );
        await setSession(
          token,
          { userId: user.id, email: user.email },
          SESSION_TTL,
        );

        const response = NextResponse.json({
          user: { id: user.id, email: user.email },
          plan: user.subscription_tier,
        });
        response.headers.set(
          "Set-Cookie",
          buildSessionCookie(token, SESSION_TTL),
        );
        return response;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Sign in failed.";
        return NextResponse.json({ error: message }, { status: 401 });
      }
    }

    case "signout": {
      const token = readSessionToken(request.headers.get("cookie"));
      if (token) {
        await deleteSession(token);
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
  if (!cookieHeader) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const sessionId = readSessionToken(cookieHeader);
  if (!sessionId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const userResult = await query(
      `SELECT u.id, u.email, u.subscription_tier, o.country
       FROM users u
       LEFT JOIN memberships m ON m.user_id = u.id
       LEFT JOIN organisations o ON o.id = m.organisation_id
       WHERE u.id = $1`,
      [session.userId],
    );

    if (userResult.rowCount === 0) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const user = userResult.rows[0];
    return NextResponse.json({
      user: { id: user.id, email: user.email, country: user.country ?? null },
      plan: user.subscription_tier,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Session check failed.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
