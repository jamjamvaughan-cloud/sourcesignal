/**
 * POST /api/auth/signup
 *
 * Creates a user, their default organisation and owner membership, then
 * issues a signed session cookie.
 *
 * Each SQL statement runs in its own transaction (pgbouncer statement mode),
 * so individual INSERTs auto-commit. A failed step leaves prior inserts in
 * place — acceptable for signup, since re-signup with the same email hits
 * the unique-email check.
 *
 * The handler is deliberately defensive:
 *   - JSON parsing failures return 400.
 *   - Unique-constraint races return 409.
 *   - Every failure is logged with stack context.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { setSession } from "@/lib/redis";
import { SESSION_TTL, buildSessionCookie } from "@/lib/auth";
import { error, info } from "@/lib/logger";
import bcrypt from "bcryptjs";
import { sign } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

const SUPPORTED_COUNTRIES = new Set(["UK", "US", "CA", "IE", "AU", "EU"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

interface SignupBody {
  email?: unknown;
  password?: unknown;
  passwordConfirm?: unknown;
  organisationName?: unknown;
  organizationName?: unknown;
  acceptTerms?: unknown;
  country?: unknown;
}

/** Returns a validated/normalised country code, defaulting to UK. */
function normaliseCountry(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return SUPPORTED_COUNTRIES.has(raw) ? raw : "UK";
}

/** Converts a PostgreSQL unique violation into a friendly message. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

export async function POST(request: Request) {
  let body: SignupBody;
  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body. Expected an object with email and password." },
      { status: 400 },
    );
  }

  const email =
    typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const passwordConfirm =
    typeof body.passwordConfirm === "string" ? body.passwordConfirm : undefined;
  const orgNameRaw =
    typeof body.organisationName === "string"
      ? body.organisationName
      : typeof body.organizationName === "string"
        ? body.organizationName
        : undefined;
  const country = normaliseCountry(body.country);

  // 1. Validate required payload parameters.
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }
  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }
  if (password.length < 10) {
    return NextResponse.json(
      { error: "Password must be at least 10 characters." },
      { status: 400 },
    );
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return NextResponse.json(
      {
        error: "Password must contain both uppercase and lowercase letters.",
      },
      { status: 400 },
    );
  }
  if (!/[0-9]/.test(password)) {
    return NextResponse.json(
      { error: "Password must contain at least one digit." },
      { status: 400 },
    );
  }
  if (passwordConfirm !== undefined && passwordConfirm !== password) {
    return NextResponse.json(
      { error: "Passwords do not match." },
      { status: 400 },
    );
  }
  // acceptTerms is optional — defaults to true (relaxed for API clients).
  if (body.acceptTerms === false) {
    return NextResponse.json(
      { error: "You must accept the Terms of Service to create an account." },
      { status: 400 },
    );
  }

  try {
    // Hash outside any DB work so the pool client is not held during bcrypt.
    const passwordHash = await bcrypt.hash(password, 10);

    // Check for an existing account first. The unique index protects against
    // concurrent signups.
    const existingUser = await query(
      "SELECT id FROM users WHERE email = $1",
      [email],
    );
    if ((existingUser.rowCount ?? 0) > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    // Persist the country chosen at signup as the user's canonical
    // jurisdiction. Without this the column falls back to its `{UK}`
    // default, which locked US/EU signups into UK signals.
    const userResult = await query(
      `INSERT INTO users (email, password_hash, subscription_tier, country_preferences, created_at, updated_at)
       VALUES ($1, $2, 'free', $3, NOW(), NOW())
       RETURNING id, email, subscription_tier`,
      [email, passwordHash, [country]],
    );
    const newUser = userResult.rows[0] as {
      id: string;
      email: string;
      subscription_tier: string;
    };

    const orgName =
      orgNameRaw?.trim() || `${email.split("@")[0]}'s Workspace`;
    const slugBase =
      orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "workspace";
    const orgSlug = `${slugBase}-${newUser.id.slice(0, 8)}`;

    const orgResult = await query(
      `INSERT INTO organisations (name, slug, plan, country, owner_id, created_by, created_at, updated_at)
       VALUES ($1, $2, 'free', $3, $4, $4, NOW(), NOW())
       RETURNING id, name, country`,
      [orgName, orgSlug, country, newUser.id],
    );
    const newOrg = orgResult.rows[0] as {
      id: string;
      name: string;
      country: string;
    };

    await query(
      `INSERT INTO memberships (user_id, organisation_id, role, created_at, updated_at)
       VALUES ($1, $2, 'owner', NOW(), NOW())`,
      [newUser.id, newOrg.id],
    );

    // Keep the user's primary organisation pointer in sync.
    await query(
      `UPDATE users SET organisation_id = $1, updated_at = NOW() WHERE id = $2`,
      [newOrg.id, newUser.id],
    );

    // Issue a signed session token and persist it so /api/auth/me resolves
    // this user immediately after signup.
    const token = sign(
      { userId: newUser.id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: SESSION_TTL },
    );
    await setSession(
      token,
      { userId: newUser.id, email: newUser.email },
      SESSION_TTL,
    );

    const response = NextResponse.json(
      {
        success: true,
        redirectTo: "/dashboard",
        user: {
          id: newUser.id,
          email: newUser.email,
          subscription_tier: newUser.subscription_tier,
          organisation_id: newOrg.id,
          country: newOrg.country,
        },
      },
      { status: 201 },
    );
    response.headers.set(
      "Set-Cookie",
      buildSessionCookie(token, SESSION_TTL, request.headers.get("host")),
    );

    info("auth_signup", {
      message: "Account created",
      userId: newUser.id,
      organisationId: newOrg.id,
      country,
    });

    return response;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    error("auth_signup_failed", {
      error: err instanceof Error ? err.stack ?? err.message : String(err),
      email,
    });

    return NextResponse.json(
      {
        error:
          "We could not create your account right now. Please try again in a moment.",
      },
      { status: 500 },
    );
  }
}
