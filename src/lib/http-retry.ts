/** One retry on 429, 503, or a fast network abort. A slow timeout is not retried. */
export function retryDecision(status: number | null, elapsedMs: number): "retry" | "stop" {
  if (elapsedMs > 8_000) return "stop";
  if (status === 429 || status === 503 || status === null) return "retry";
  return "stop";
}

export function retryJitterMs(rand: () => number = Math.random): number {
  return 200 + Math.floor(rand() * 401);
}

export async function fetchOnceRetry(
  run: (timeoutMs: number) => Promise<Response>,
  timeoutMs: number,
): Promise<Response> {
  const started = Date.now();
  try {
    const res = await run(timeoutMs);
    if (retryDecision(res.status, Date.now() - started) !== "retry") return res;
  } catch (err) {
    if (retryDecision(null, Date.now() - started) !== "retry") throw err;
  }
  await new Promise((resolve) => setTimeout(resolve, retryJitterMs()));
  return run(Math.min(8_000, timeoutMs));
}
