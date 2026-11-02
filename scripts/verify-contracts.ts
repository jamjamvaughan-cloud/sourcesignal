import "./load-env";
import { pool } from "../src/lib/db";

const checks: Array<[string, string, unknown[]?]> = [
  [
    "auth.ts getUserPlanIdFromPB",
    `SELECT u.subscription_tier FROM users u
     LEFT JOIN memberships m ON m.user_id = u.id
     LEFT JOIN organisations o ON o.id = m.organisation_id
     WHERE u.id = $1 LIMIT 0`,
    ["00000000-0000-0000-0000-000000000000"],
  ],
  [
    "auth/[action] signup organisation insert",
    `INSERT INTO organisations (name, slug, plan, owner_id, created_by, created_at, updated_at)
     VALUES ($1, $2, 'free', (SELECT id FROM users LIMIT 1), (SELECT id FROM users LIMIT 1), NOW(), NOW()) RETURNING id`,
    ["x", "x"],
  ],
  [
    "auth/[action] signup membership insert",
    `INSERT INTO memberships (organisation_id, user_id, role, created_at, updated_at)
     VALUES ((SELECT id FROM organisations LIMIT 1), (SELECT id FROM users LIMIT 1), 'owner', NOW(), NOW())
     ON CONFLICT DO NOTHING`,
  ],
  [
    "opportunities list/get",
    `SELECT id, canonical_id, title, sector, region, location, buyer,
            estimated_value, currency, procurement_stage, published_date,
            closing_date, confidence, signal_tier, source_url, summary,
            is_demonstration, created_at, updated_at, source_hash
     FROM opportunities LIMIT 0`,
  ],
  [
    "stripe webhook processed_webhooks insert",
    `INSERT INTO processed_webhooks (event_id, event_type, processed_at)
     VALUES ($1, $2, NOW())`,
    ["evt_test", "checkout.session.completed"],
  ],
  [
    "webhook_deliveries insert (webhooks.ts)",
    `INSERT INTO webhook_deliveries (id, user_id, opportunity_id, webhook_url, event_type, delivered_at, status, provider, external_id, response_status, error_message)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9)`,
    [null, null, "https://x", "e", "sent", "webhook", "x", 200, null],
  ],
  [
    "alert_deliveries insert (alerts.ts)",
    `INSERT INTO alert_deliveries (id, opportunity_id, delivered_at, status, provider, external_id, response_status, error_message)
     VALUES (gen_random_uuid(), $1, NOW(), $2, $3, $4, $5, $6)`,
    [null, "sent", "webhook", "x", 200, null],
  ],
  [
    "worker engine opportunities upsert",
    `INSERT INTO opportunities (id, canonical_id, title, sector, region, location, buyer, estimated_value, currency, procurement_stage, published_date, closing_date, confidence, signal_tier, source_url, source_hash, detail_fields, cpv_code, is_demonstration, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())`,
    ["audit-contract", "Audit", "other", null, null, null, null, "GBP", null, null, null, null, "standard", "https://x", "audit-hash", null, null, false],
  ],
  [
    "saved_opportunities insert",
    `INSERT INTO saved_opportunities (user_id, opportunity_id, notes)
     VALUES ($1, $2, $3)`,
    [null, null, null],
  ],
  [
    "alerts insert",
    `INSERT INTO alerts (user_id, name, query_filters, is_active)
     VALUES ($1, $2, $3::jsonb, TRUE)`,
    [null, "x", "{}"],
  ],
];

async function main() {
  const client = await pool.connect();
  await client.query("BEGIN");
  // Seed minimal rows so FK-dependent contract checks can execute. The whole
  // transaction is rolled back at the end, so nothing is persisted.
  await client.query(
    `INSERT INTO users (email, password_hash)
     VALUES ('audit-contract@example.com', 'x')
     ON CONFLICT (email) DO NOTHING`,
  );
  await client.query(
    `INSERT INTO organisations (name, slug, owner_id, created_by)
     SELECT 'Audit Org', 'audit-org', id, id FROM users
     WHERE email = 'audit-contract@example.com'
     ON CONFLICT (slug) DO NOTHING`,
  );
  let failures = 0;
  for (const [name, sql, params] of checks) {
    await client.query("SAVEPOINT sp");
    try {
      await client.query(sql, params as never);
      console.log(`PASS  ${name}`);
      await client.query("ROLLBACK TO SAVEPOINT sp");
    } catch (err: unknown) {
      failures++;
      const e = err as { code?: string; message?: string };
      console.log(`FAIL  ${name}\n      [${e.code}] ${e.message}`);
      await client.query("ROLLBACK TO SAVEPOINT sp");
    }
  }
  await client.query("ROLLBACK");
  client.release();
  console.log(`\n${checks.length - failures}/${checks.length} query contracts valid`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
});
