import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { SourceUnavailable } from "./types";

const USER_AGENT = "WeSearch/0.1 (student project)";
const CACHE_DIR = path.join(process.cwd(), ".cache");
export const QUERY_TTL_MS = 15 * 60 * 1000;
export const FEED_TTL_MS = 6 * 60 * 60 * 1000; // Remotive asks for at most 4 fetches a day

interface GetOptions {
  params?: Record<string, string | number>;
  headers?: Record<string, string>;
  ttlMs?: number;
}

/** GET JSON with a disk cache, which survives restarts so API limits aren't used up during development. */
export async function getJson<T>(url: string, { params, headers, ttlMs = QUERY_TTL_MS }: GetOptions = {}): Promise<T> {
  const query = new URLSearchParams(Object.entries(params ?? {}).map(([k, v]) => [k, String(v)])).toString();
  const full = query ? `${url}?${query}` : url;
  const cacheFile = path.join(CACHE_DIR, `${createHash("sha256").update(full).digest("hex")}.json`);
  try {
    if (Date.now() - (await stat(cacheFile)).mtimeMs < ttlMs) return JSON.parse(await readFile(cacheFile, "utf8")) as T;
  } catch {
    // No usable cache entry, so fetch it
  }
  let response: Response;
  try {
    response = await fetch(full, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    // Never include the URL in a message: it can hold API keys
    throw new SourceUnavailable("could not reach the API");
  }
  if (!response.ok) throw new SourceUnavailable(`the API answered with error ${response.status}`);
  let data: T;
  try {
    data = (await response.json()) as T;
  } catch {
    throw new SourceUnavailable("the API returned something that isn't valid JSON");
  }
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cacheFile, JSON.stringify(data));
  return data;
}
