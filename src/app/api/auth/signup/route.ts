import { NextResponse } from "next/server";
import { getClient } from "@/lib/db";
import { setSession } from "@/lib/redis";
import {
  SESSION_TTL,
  buildSessionCookie,
} from "@/lib/auth";
import bcrypt from "bcryptjs";
import { sign } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

export async function POST(request: Request) {
  const client = await getClient();

  try {
    const body = await request.json();
    const {
      email,
      password,
      organisationName,
      organizationName,
      acceptTerms,
      country,
    } = body;

    // 1. Validate required payload parameters
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    // Accept either spelling: organisationName or organizationName
    const orgNameRaw =
      organisationName ?? organizationName ?? undefined;

    // acceptTerms is optional — defaults to true (relaxed for dev testing)
    const termsAccepted = acceptTerms ?? true;

    if (!termsAccepted) {
      return NextResponse.json(
        { error: "You must accept the Terms of Service to create an account" },
        { status: 400 },
      );
    }

    // 2. Begin database transaction
    await client.query("BEGIN");

    // 3. Check if user already exists
    const existingUser = await client.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase().trim()],
    );
    if (existingUser.rowCount && existingUser.rowCount > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 },
      );
    }

    // 4. Hash password securely
    const passwordHash = await bcrypt.hash(password, 10);

    // 5. Insert new user with default 'free' subscription tier
    let newUser: { id: string; email: string; subscription_tier: string };
    try {
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, subscription_tier, created_at, updated_at)
         VALUES ($1, $2, 'free', NOW(), NOW())
         RETURNING id, email, subscription_tier`,
        [email.toLowerCase().trim(), passwordHash],
      );
      newUser = userResult.rows[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("User insert error:", err);
      return NextResponse.json(
        {
          error: err?.message || "Failed to create user",
          detail: err?.detail || undefined,
          code: err?.code || undefined,
        },
        { status: 500 },
      );
    }

    // 6. Create default organisation and membership link
    const orgName =
      orgNameRaw?.trim() || `${email.split("@")[0]}'s Workspace`;
    const slugBase =
      orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "workspace";
    const orgSlug = `${slugBase}-${newUser.id.slice(0, 8)}`;

    let newOrg: { id: string };
    try {
      const orgResult = await client.query(
        `INSERT INTO organisations (name, slug, plan, country, owner_id, created_by, created_at, updated_at)
         VALUES ($1, $2, 'free', $3, $4, $4, NOW(), NOW())
         RETURNING id`,
        [orgName, orgSlug, country ?? "UK", newUser.id],
      );
      newOrg = orgResult.rows[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("Organisation insert error:", err);
      return NextResponse.json(
        {
          error: err?.message || "Failed to create organisation",
          detail: err?.detail || undefined,
          code: err?.code || undefined,
        },
        { status: 500 },
      );
    }

    // Link user to organisation in memberships table
    try {
      await client.query(
        `INSERT INTO memberships (user_id, organisation_id, role, created_at, updated_at)
         VALUES ($1, $2, 'owner', NOW(), NOW())`,
        [newUser.id, newOrg.id],
      );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("Membership insert error:", err);
      return NextResponse.json(
        {
          error: err?.message || "Failed to create membership",
          detail: err?.detail || undefined,
          code: err?.code || undefined,
        },
        { status: 500 },
      );
    }

    // Commit transaction
    try {
      await client.query("COMMIT");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("Commit error:", err);
      return NextResponse.json(
        {
          error: err?.message || "Failed to commit transaction",
          detail: err?.detail || undefined,
          code: err?.code || undefined,
        },
        { status: 500 },
      );
    }

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
        user: {
          id: newUser.id,
          email: newUser.email,
          subscription_tier: newUser.subscription_tier,
          organisation_id: newOrg.id,
        },
      },
      { status: 201 },
    );
    response.headers.set(
      "Set-Cookie",
      buildSessionCookie(token, SESSION_TTL),
    );
    return response;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Signup Execution Error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Internal Server Error",
        detail: error?.detail || undefined,
        code: error?.code || undefined,
      },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
