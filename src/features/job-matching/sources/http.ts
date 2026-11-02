import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import robotsParser from "robots-parser";
import { SourceUnavailable } from "./types";

const AGENT = "WeSearch";
const USER_AGENT = `${AGENT}/0.1 (student project)`;
const CACHE_DIR = path.join(process.cwd(), ".cache");
const REQUEST_TIMEOUT_MS = 20_000;
const ROBOTS_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_GAP_MS = 250;
export const QUERY_TTL_MS = 60 * 60 * 1000;
export const BOARD_TTL_MS = 6 * 60 * 60 * 1000;

interface GetOptions {
  params?: Record<string, string | number>;
  ttlMs?: number;
}

const memoryRobots = new Map<string, Promise<RobotsRule>>();
const nextSlot = new Map<string, number>();

interface RobotsRule {
  allowed(url: string): boolean;
  gapMs: number;
}

function cachePath(key: string): string {
  return path.join(CACHE_DIR, `${createHash("sha256").update(key).digest("hex")}.json`);
}

async function readCache<T>(key: string, ttlMs: number): Promise<T | null> {
  try {
    const file = cachePath(key);
    if (Date.now() - (await stat(file)).mtimeMs >= ttlMs) return null;
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function writeCache(key: string, value: unknown): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cachePath(key), JSON.stringify(value));
}

/** One host's requests are spaced out, by its Crawl-delay if it sets one. */
async function waitForSlot(host: string, gapMs: number): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextSlot.get(host) ?? 0);
  nextSlot.set(host, slot + gapMs);
  if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now));
}

async function loadRobots(origin: string): Promise<RobotsRule> {
  const robotsUrl = `${origin}/robots.txt`;
  let cached = await readCache<{ text: string }>(robotsUrl, ROBOTS_TTL_MS);
  if (!cached) {
    let response: Response;
    try {
      response = await fetch(robotsUrl, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: "no-store" });
    } catch {
      // Permission unknown, so treat it as not given
      throw new SourceUnavailable("its robots.txt couldn't be checked, so it was skipped");
    }
    if (response.status >= 500) throw new SourceUnavailable("its robots.txt couldn't be checked, so it was skipped");
    // A 4xx means the site publishes no rules, which robots.txt's standard (RFC 9309) treats as no restriction
    cached = { text: response.ok ? await response.text() : "" };
    await writeCache(robotsUrl, cached);
  }
  const parser = robotsParser(robotsUrl, cached.text);
  const delay = parser.getCrawlDelay(AGENT);
  return { allowed: (url) => parser.isAllowed(url, AGENT) !== false, gapMs: delay ? delay * 1000 : DEFAULT_GAP_MS };
}

function robotsFor(origin: string): Promise<RobotsRule> {
  let rule = memoryRobots.get(origin);
  if (!rule) {
    rule = loadRobots(origin);
    memoryRobots.set(origin, rule);
    rule.catch(() => memoryRobots.delete(origin));
    setTimeout(() => memoryRobots.delete(origin), ROBOTS_TTL_MS).unref?.();
  }
  return rule;
}

/** Whether robots.txt lets this app read the URL. Also used to check apply links. */
export async function robotsAllow(url: string): Promise<boolean> {
  return (await robotsFor(new URL(url).origin)).allowed(url);
}

/** GET JSON politely: robots.txt first, spaced-out requests, a timeout, and a disk cache that survives restarts. */
export async function getJson<T>(url: string, { params, ttlMs = QUERY_TTL_MS }: GetOptions = {}): Promise<T> {
  const query = new URLSearchParams(Object.entries(params ?? {}).map(([k, v]) => [k, String(v)])).toString();
  const full = query ? `${url}?${query}` : url;
  const cached = await readCache<T>(full, ttlMs);
  if (cached !== null) return cached;

  const { origin, host } = new URL(full);
  const robots = await robotsFor(origin);
  if (!robots.allowed(full)) throw new SourceUnavailable("its robots.txt doesn't allow automated access, so it was skipped");
  await waitForSlot(host, robots.gapMs);

  let response: Response;
  try {
    response = await fetch(full, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new SourceUnavailable("could not reach it");
  }
  if (!response.ok) throw new SourceUnavailable(`it answered with error ${response.status}`);
  let data: T;
  try {
    data = (await response.json()) as T;
  } catch {
    throw new SourceUnavailable("it returned something that isn't valid JSON");
  }
  await writeCache(full, data);
  return data;
}
