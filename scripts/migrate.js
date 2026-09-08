const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const { createPool, SCHEMA_SQL } = require('../database');

async function migrate(pool, data) {
  for (const key of ['products', 'sales', 'expenses']) {
    if (!Array.isArray(data[key])) throw new Error(`The import must contain an array named ${key}.`);
  }
  const seed = structuredClone(data);
  for (const key of ['vendors', 'purchaseOrders', 'vendorPayments', 'vendorReturns', 'borrowings']) {
    if (seed[key] === undefined) seed[key] = [];
    if (!Array.isArray(seed[key])) throw new Error(`Invalid collection: ${key}`);
  }
  if (!seed.auth || !seed.auth.username || !seed.auth.password) {
    throw new Error('Use a live backend export including the existing login credentials. No default password will be created.');
  }
  seed.auth.sessionSecret ||= randomBytes(32).toString('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(SCHEMA_SQL);
    // Imports are insert-only: rerunning migration never overwrites business data.
    const result = await client.query('INSERT INTO auric_private.inventory_state (id, data) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING RETURNING id', [JSON.stringify(seed)]);
    await client.query('COMMIT');
    return result.rows.length === 1;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  (async () => {
    const file = process.argv[2];
    if (!file) throw new Error('Usage: npm run db:migrate -- <path-to-live-backup.json>');
    const data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    const pool = createPool();
    try {
      const inserted = await migrate(pool, data);
      console.log(inserted ? 'Database initialized; all records and existing login preserved.' : 'Database already initialized; existing data preserved.');
    } finally {
      await pool.end();
    }
  })().catch(error => { console.error('Migration failed:', error.code || error.message); process.exitCode = 1; });
}

module.exports = { migrate };
