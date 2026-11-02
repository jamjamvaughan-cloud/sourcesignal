import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const target = new URL(url);
  const dbName = target.pathname.replace(/^\//, "");
  const admin = new URL(url);
  admin.pathname = "/postgres";

  const client = new Client({ connectionString: admin.toString() });
  await client.connect();

  console.log(`Dropping database "${dbName}"...`);
  await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  console.log(`Creating database "${dbName}"...`);
  await client.query(`CREATE DATABASE "${dbName}"`);
  await client.end();

  const schema = readFileSync(
    resolve(process.cwd(), "src/lib/db-schema.sql"),
    "utf8",
  );
  const db = new Client({ connectionString: url });
  await db.connect();
  await db.query(schema);
  await db.end();

  console.log("✅ Fresh database created and schema applied.");
}

main().catch((err) => {
  console.error("❌ Reset failed:", err.message, err.code ?? "");
  process.exit(1);
});
