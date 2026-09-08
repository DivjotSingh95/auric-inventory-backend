const { AsyncLocalStorage } = require('node:async_hooks');
const { Pool } = require('pg');

// Preserve the existing document shape, including variants and vendor records.
// The private schema is not exposed through Supabase's public Data API.
const SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS auric_private;
REVOKE ALL ON SCHEMA auric_private FROM PUBLIC;
CREATE TABLE IF NOT EXISTS auric_private.inventory_state (
  id integer PRIMARY KEY CHECK (id = 1),
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE auric_private.inventory_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON auric_private.inventory_state FROM PUBLIC;
`;

function createPool(env = process.env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL must point to your Supabase database.');
  const url = new URL(env.DATABASE_URL);
  // Do not let URL SSL options silently disable certificate verification.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  return new Pool({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true, ...(env.DATABASE_CA_CERT ? { ca: env.DATABASE_CA_CERT.replace(/\\n/g, '\n') } : {}) },
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    application_name: 'auric-inventory',
  });
}

function createDatabase(pool) {
  const context = new AsyncLocalStorage();
  return {
    read() {
      const tx = context.getStore();
      if (!tx) throw new Error('Database read outside transaction');
      return tx.data;
    },
    write(data) {
      const tx = context.getStore();
      if (!tx || !tx.writable) throw new Error('Database write outside write transaction');
      tx.data = data;
      tx.dirty = true;
    },
    async run(writable, operation) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SET LOCAL lock_timeout = '10s'");
        const result = await client.query('SELECT data FROM auric_private.inventory_state WHERE id = 1' + (writable ? ' FOR UPDATE' : ''));
        if (!result.rows[0]) throw new Error('Database is not initialized. Run npm run db:migrate with a data export.');
        const tx = { data: result.rows[0].data, writable, dirty: false };
        const response = await context.run(tx, operation);
        if (response && response.statusCode >= 400) {
          await client.query('ROLLBACK');
          return response;
        }
        if (tx.dirty) {
          await client.query('UPDATE auric_private.inventory_state SET data = $1::jsonb, updated_at = now() WHERE id = 1', [JSON.stringify(tx.data)]);
        }
        await client.query('COMMIT');
        return response;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    async health() {
      const result = await pool.query('SELECT id FROM auric_private.inventory_state WHERE id = 1');
      if (!result.rows[0]) throw new Error('Database is not initialized');
    },
    close: () => pool.end(),
  };
}

module.exports = { createPool, createDatabase, SCHEMA_SQL };
