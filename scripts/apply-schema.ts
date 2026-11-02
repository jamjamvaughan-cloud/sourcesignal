import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pool } from "../src/lib/db";

async function main() {
  const schema = readFileSync(
    resolve(process.cwd(), "src/lib/db-schema.sql"),
    "utf8",
  );
  const client = await pool.connect();
  try {
    await client.query(schema);
    console.log("✅ Schema applied successfully (idempotent).");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(async (err) => {
  console.error("❌ Schema apply failed:", err.message);
  if (err.code) console.error("   Code:", err.code);
  if (err.detail) console.error("   Detail:", err.detail);
  await pool.end();
  process.exit(1);
});
