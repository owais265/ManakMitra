// Better Auth reads DATABASE_URL once, when its module loads.
// This project already has the Supabase URL as POSTGRES_URL on Vercel.
// Read it with a dynamic key so the bundler cannot replace it at build time.
// Supabase's pooler certificate is not in Node's default trust store.
function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function withSsl(url: string): string {
  if (!/supabase/i.test(url)) return url;
  const [base, query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  params.set("sslmode", "no-verify");
  return `${base}?${params.toString()}`;
}

if (!readEnv("DATABASE_URL")) {
  const next = readEnv("POSTGRES_URL") || readEnv("POSTGRES_URL_NON_POOLING");
  if (next) process.env.DATABASE_URL = withSsl(next);
}
