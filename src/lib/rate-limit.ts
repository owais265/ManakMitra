/** In-process sliding window. One Vercel instance only — not shared across instances. */
const buckets = new Map<string, number[]>();

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  const raw = fwd ? fwd.split(",")[0] : request.headers.get("x-real-ip");
  const ip = (raw || "local").trim().slice(0, 64);
  return ip || "local";
}

export function takeLimit(
  key: string,
  now = Date.now(),
  limit = 20,
  windowMs = 60_000,
): { ok: true } | { ok: false; retryAfter: number } {
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
