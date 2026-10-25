// Vercel already has the Supabase Postgres URL as POSTGRES_URL.
// Better Auth reads only DATABASE_URL, and it reads it when its module loads.
// Point DATABASE_URL at that database before the auth server is imported.
const current = process.env.DATABASE_URL?.trim();
if (!current) {
  const next = process.env.POSTGRES_URL?.trim() || process.env.POSTGRES_URL_NON_POOLING?.trim();
  if (next) process.env.DATABASE_URL = next;
}
