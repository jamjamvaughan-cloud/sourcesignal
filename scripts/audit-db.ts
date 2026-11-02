import { query, pool } from "../src/lib/db";

async function main() {
  const tables = await query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  );
  console.log("TABLES:", tables.rows.map((r) => r.table_name).join(", "));

  for (const { table_name } of tables.rows) {
    const cols = await query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table_name],
    );
    console.log(`\n[${table_name}]`);
    console.log(
      cols.rows
        .map((c) => `${c.column_name}:${c.data_type}${c.is_nullable === "NO" ? "!" : ""}`)
        .join(", "),
    );
  }

  const idx = await query(
    `SELECT tablename, indexname FROM pg_indexes
     WHERE schemaname = 'public' ORDER BY tablename, indexname`,
  );
  console.log("\nINDEXES:");
  for (const r of idx.rows) console.log(`  ${r.tablename}: ${r.indexname}`);

  await pool.end();
}

main().catch(async (e) => {
  console.error("AUDIT FAILED:", e.message, e.code);
  await pool.end();
});
