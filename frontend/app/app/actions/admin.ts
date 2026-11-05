"use server";

import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { getSession } from "@/lib/redis";

/**
 * Admin action to toggle a user's subscription tier between free, pro, and admin.
 *
 * Validates the requesting session belongs to an admin user via Redis session
 * + PostgreSQL verification, then updates the target user's subscription tier
 * via a native SQL query.
 *
 * @param userId - The UUID of the user to update
 * @param newTier - The new subscription tier ('free', 'pro', or 'admin')
 * @returns Object with success boolean and optional error message
 */
export async function toggleUserSubscriptionTier(
  userId: string,
  newTier: "free" | "pro" | "admin",
): Promise<{ success: boolean; error?: string }> {
  const validTiers = ["free", "pro", "admin"];
  if (!validTiers.includes(newTier)) {
    return { success: false, error: "Invalid tier" };
  }

  try {
    // Validate requesting session belongs to an admin user via Redis + PostgreSQL
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session_id")?.value;

    if (!sessionId) {
      return { success: false, error: "No session found" };
    }

    const session = await getSession(sessionId);
    if (!session) {
      return { success: false, error: "Invalid or expired session" };
    }

    const requestingUserId = session.userId;

    const adminCheck = await query(
      `SELECT subscription_tier FROM users WHERE id = $1`,
      [requestingUserId],
    );

    if (
      adminCheck.rowCount === 0 ||
      adminCheck.rows[0].subscription_tier !== "admin"
    ) {
      return { success: false, error: "Admin access required" };
    }

    // Update the target user's subscription tier via native SQL
    const result = await query(
      `UPDATE users SET subscription_tier = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, subscription_tier`,
      [newTier, userId],
    );

    if (result.rowCount === 0) {
      return { success: false, error: "User not found" };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
