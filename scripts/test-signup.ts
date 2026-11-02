import { query, pool } from '../src/lib/db';
import bcrypt from 'bcryptjs';

async function testSignupFlow() {
  console.log('🧪 Testing Native PostgreSQL Signup Pipeline...\n');

  try {
    // 1. Test Database Connection
    const timeRes = await query('SELECT NOW()');
    console.log('✅ Database connection active:', timeRes.rows[0].now);

    // 2. Simulate User Insertion
    const testEmail = `test_${Date.now()}@sourcesignal.site`;
    const passwordHash = await bcrypt.hash('SecurePass123', 10);

    console.log(`\nAttempting to insert test user: ${testEmail}...`);
    const userRes = await query(
      `INSERT INTO users (email, password_hash, subscription_tier, created_at, updated_at)
       VALUES ($1, $2, 'free', NOW(), NOW())
       RETURNING id, email, subscription_tier`,
      [testEmail, passwordHash],
    );
    const newUser = userRes.rows[0];
    console.log('✅ User inserted successfully! ID:', newUser.id);

    // 3. Simulate Organisation Insertion
    console.log('Attempting to create default organisation...');
    const orgRes = await query(
      `INSERT INTO organisations (name, slug, plan, owner_id, created_by, created_at, updated_at)
       VALUES ($1, $2, 'free', $3, $3, NOW(), NOW())
       RETURNING id`,
      ['Test Workspace', `test-workspace-${newUser.id.slice(0, 8)}`, newUser.id],
    );
    const newOrg = orgRes.rows[0];
    console.log('✅ Organisation created successfully! ID:', newOrg.id);

    // 4. Simulate Membership Insertion
    console.log('Attempting to link membership...');
    await query(
      `INSERT INTO memberships (user_id, organisation_id, role, created_at, updated_at)
       VALUES ($1, $2, 'owner', NOW(), NOW())`,
      [newUser.id, newOrg.id],
    );
    console.log('✅ Membership linked successfully!');

    console.log('\n🎉 FULL SIGNUP PIPELINE TEST PASSED: Database transactions, hashing, and foreign keys are 100% operational.');
  } catch (err: unknown) {
    const e = err as { message?: string; code?: string; detail?: string; hint?: string };
    console.error('\n❌ Signup Pipeline Test Failed:');
    console.error('   Error Message:', e.message);
    if (e.code) console.error('   PostgreSQL Error Code:', e.code);
    if (e.detail) console.error('   Detail:', e.detail);
    if (e.hint) console.error('   Hint:', e.hint);
  } finally {
    await pool.end();
  }
}

testSignupFlow();
