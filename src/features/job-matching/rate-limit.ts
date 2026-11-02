const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const seen = new Map<string, { start: number; count: number }>();

/** A simple per-client limit, so one browser can't turn into a flood of requests to job sites. */
export function allowRequest(request: Request, now = Date.now()): boolean {
  const client = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const entry = seen.get(client);
  if (!entry || now - entry.start >= WINDOW_MS) {
    seen.set(client, { start: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_PER_WINDOW;
}
