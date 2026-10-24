/** In-process sliding window. One Vercel instance only — not shared across instances. */
const buckets = new Map<string, number[]>();
const MAX_KEYS = 2000;

export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip");
  if (real && real.trim()) return real.trim().slice(0, 64);
  const fwd = request.headers.get("x-forwarded-for");
  const raw = fwd ? fwd.split(",")[0] : "";
  const ip = (raw || "local").trim().slice(0, 64);
  return ip || "local";
}

function sweep(now: number, windowMs: number): void {
  if (buckets.size < MAX_KEYS) return;
  for (const [key, stamps] of buckets) {
    const live = stamps.filter((t) => now - t < windowMs);
    if (live.length) buckets.set(key, live);
    else buckets.delete(key);
  }
  while (buckets.size > MAX_KEYS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

export function takeLimit(
  key: string,
  now = Date.now(),
  limit = 20,
  windowMs = 60_000,
): { ok: true } | { ok: false; retryAfter: number } {
  sweep(now, windowMs);
  const prev = buckets.get(key) ?? [];
  const stamps = prev.filter((t) => now - t < windowMs);
  if (stamps.length >= limit) {
    const retryAfter = Math.max(1, Math.ceil((stamps[0] + windowMs - now) / 1000));
    buckets.set(key, stamps);
    return { ok: false, retryAfter };
  }
  stamps.push(now);
  buckets.set(key, stamps);
  return { ok: true };
}

export function resetLimits(): void {
  buckets.clear();
}
