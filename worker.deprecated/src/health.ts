#!/usr/bin/env tsx
/**
 * SourceSignal ingestion worker — health check endpoint.
 *
 * Usage:
 *   npm run health
 *
 * Verifies:
 *   - PocketBase connectivity (admin auth)
 *   - Environment variable presence
 *   - Collection accessibility
 */

import PocketBase from "pocketbase";

async function main(): Promise<void> {
  const email = process.env.POCKETBASE_ADMIN_EMAIL;
  const password = process.env.POCKETBASE_ADMIN_PASSWORD;
  const url = process.env.NEXT_PUBLIC_POCKETBASE_URL;

  console.log("=== SourceSignal Worker Health Check ===\n");

  // Env check
  if (!email || !password || !url) {
    console.error("[FAIL] Missing PocketBase admin credentials in .env");
    console.log("  Required: POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD, NEXT_PUBLIC_POCKETBASE_URL");
    process.exit(1);
  }
  console.log("[OK]  PocketBase credentials configured");

  // Connectivity check
  try {
    const pb = new PocketBase(url);
    await pb.collection("_superusers").authWithPassword(email, password);
    console.log("[OK]  PocketBase admin auth successful");
  } catch (err) {
    console.error("[FAIL]  PocketBase admin auth failed:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Collection accessibility check
  const requiredCollections = [
    "opportunities",
    "organisations",
    "memberships",
    "subscriptions",
    "ingestion_runs",
    "ingestion_errors",
    "alerts",
    "alert_deliveries",
    "saved_opportunities",
    "source_records",
    "source_snapshots",
    "provenance",
    "processed_webhooks",
  ];

  try {
    const pb = new PocketBase(url);
    await pb.collection("_superusers").authWithPassword(email, password);

    for (const name of requiredCollections) {
      try {
        await pb.collection(name).getList(1, 1, { fields: "id" });
        console.log(`[OK]  Collection "${name}" accessible`);
      } catch (err) {
        console.error(
          `[FAIL]  Collection "${name}" inaccessible:`,
          err instanceof Error ? err.message : String(err),
        );
        process.exit(1);
      }
    }
  } catch (err) {
    console.error("[FAIL]  Could not connect to PocketBase:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  console.log("\n=== All health checks passed ===");
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
