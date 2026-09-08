# Auric Inventory

The existing frontend runs on Vercel. Its `/api/*` requests are forwarded to the existing Render backend. The backend stores inventory in Supabase Postgres instead of writing `db.json`.

The deployed HTML and CSS are preserved. Frontend JavaScript changes connect requests to the same API, correct the existing product/vendor save endpoints, and keep the user signed in after changing credentials.

## Database

Set `DATABASE_URL` on Render to the **Session pooler** connection string from Supabase's Connect panel (port 5432). The database is in Oregon, matching the existing Render service. Credentials stay on the backend. TLS certificate verification is always enabled. If required, set `DATABASE_CA_CERT` to the Supabase CA certificate in PEM format.

Run the insert-only migration once before deploying the backend:

```sh
npm ci
npm run db:migrate -- /path/to/render-live-db.json
```

The export must contain the existing records and login configuration. The migration preserves them, creates a session signing secret, and never overwrites an initialized database. There is no file-storage fallback and no automatic reset when the database is unavailable.

Data is in `auric_private.inventory_state`, a private Postgres table containing the full existing JSON document. This preserves all current fields without a lossy conversion. Writes lock the row in a transaction, so a sale, stock deduction, or vendor operation commits as one change. This design suits the current single-store app; larger installations may eventually need separate relational tables.

The table is outside the public schema, public privileges are revoked, and RLS is enabled. Supabase's Data API is disabled for this project. No Supabase credential is included in the frontend.

## Deployments

- Render: `npm ci --omit=dev`, then `npm start`; health check `/api/health`.
- Vercel: `npm run build`, output directory `public`. Only `index.html`, `app.js`, and `style.css` are published. API paths are forwarded using `vercel.json`.
- A healthy backend returns `{"status":"ok","database":"supabase"}` at `/api/health`. Failed database checks return HTTP 503.

Existing login credentials remain valid. Users sign in once after migration because the former shared hard-coded token is replaced by signed expiring tokens. Login data is no longer returned from `/api/data`; credential changes also invalidate previous sessions.

## Verification

`npm test` uses an isolated embedded PostgreSQL database to check migrations, persistent CRUD, API compatibility, checkout serialization, rollback, duplicate invoices, reset behavior, and login sessions. Production data is never used for destructive tests. Live deployment checks should verify health, login, read-only record counts, and static assets.

The original supplied files and the live pre-migration data are backed up separately outside this repository. Keep that directory private, particularly the database export containing the existing login configuration.

References: [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase schemas](https://supabase.com/docs/guides/database/tables), [Render API](https://render.com/docs/api).
