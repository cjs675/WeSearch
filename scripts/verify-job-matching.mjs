// Runs the required searches through the running app's API and reports on the real listings returned.
// The resumes are made-up test people. Start the app first (npm run dev), then:
//   node scripts/verify-job-matching.mjs "Chicago, IL"

import robotsParser from "robots-parser";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const location = process.argv[2];
const AGENT = "WeSearch/0.1 (student project)";
const LINKS_PER_SEARCH = 4;
const skills = (...names) => names.map((name) => ({ name, source: "manual" }));
const person = (extra) => ({ skills: [], experience: [], education: [], certifications: [], isStudent: false, ...extra });

const FAST_FOOD = person({ skills: skills("cash handling", "customer service", "food preparation", "teamwork"), experience: [{ title: "Crew Member", employer: "McDonald's", years: 2 }] });
const STUDENT = person({ skills: skills("communication", "microsoft office", "research"), isStudent: true, education: [{ level: "bachelor", inProgress: true }] });
const PROGRAMMER = person({ skills: skills("python", "sql", "git"), experience: [{ title: "Software Developer", years: 4 }] });

const SEARCHES = [
  ["1. Fast Food / Crew Member", { resume: FAST_FOOD, categories: ["Fast Food"], keywords: "Crew Member" }],
  ["1b. Fast Food, any title", { resume: PROGRAMMER, categories: ["Fast Food"] }],
  ["2. Retail / Cashier", { resume: FAST_FOOD, categories: ["Retail"], keywords: "Cashier" }],
  ["2b. Retail, any title", { resume: FAST_FOOD, categories: ["Retail"] }],
  ["3. Warehouse / Package Handler", { resume: FAST_FOOD, categories: ["Warehouse"], keywords: "Package Handler" }],
  ["3b. Warehouse, any title", { resume: FAST_FOOD, categories: ["Warehouse"] }],
  ["4. College Internships", { resume: STUDENT, categories: ["Internships"] }],
  ["5. Entry-Level Customer Service", { resume: STUDENT, categories: ["Customer Service"], keywords: "Entry-Level" }],
  ["5b. Customer Service, any level", { resume: FAST_FOOD, categories: ["Customer Service"] }],
  ["Resume matches: fast-food worker", { resume: FAST_FOOD }],
  ["Resume matches: student, no work history", { resume: STUDENT }],
  ["Explore, no resume: Warehouse", { categories: ["Warehouse"] }],
  ["Keyword: McDonald's", { keywords: "McDonald's" }],
  ["Empty search on purpose", { keywords: "zzzz-no-such-job" }],
];

const robotsCache = new Map();
async function allowed(url) {
  const { origin } = new URL(url);
  if (!robotsCache.has(origin)) {
    const response = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": AGENT }, signal: AbortSignal.timeout(15000) }).catch(() => null);
    robotsCache.set(origin, robotsParser(`${origin}/robots.txt`, response?.ok ? await response.text() : ""));
  }
  return robotsCache.get(origin).isAllowed(url, "WeSearch") !== false;
}

async function checkLink(url) {
  if (!(await allowed(url))) return "not checked (robots.txt)";
  try {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const response = await fetch(url, { headers: { "User-Agent": AGENT }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    await response.body?.cancel();
    return String(response.status);
  } catch {
    return "failed";
  }
}

for (const [label, body] of SEARCHES) {
  const response = await fetch(`${BASE}/api/jobs/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location, ...body }) });
  const out = await response.json();
  console.log(`\n=== ${label} (HTTP ${response.status})`);
  for (const s of out.sources) if (s.state !== "ok" || s.count) console.log(`  [${s.state}] ${s.name}: ${s.message}`);
  const scored = out.matches.filter((m) => m.compatibility).length;
  const sites = [...new Set(out.matches.flatMap((m) => m.job.sources))];
  const employers = [...new Set(out.matches.map((m) => m.job.employer))];
  const located = out.matches.filter((m) => m.job.location).length;
  console.log(`  found ${out.total} | scored ${scored} | with location ${located} | sites: ${sites.join(", ") || "none"} | employers: ${employers.length}`);
  const keys = out.matches.map((m) => [m.job.title, m.job.employer, m.job.location].join("|"));
  console.log(`  duplicates in results: ${keys.length - new Set(keys).size} | older listings hidden: ${out.notes.some((n) => n.includes("older"))}`);
  if (location) console.log(`  in or remote from ${location}: ${out.matches.filter((m) => m.job.remote || (m.job.location ?? "").includes(location.split(",")[0])).length} of ${out.matches.length}`);
  if (out.message) console.log(`  message: ${out.message}`);
  for (const note of out.notes) console.log(`  note: ${note}`);
  if (body.resume && !body.categories && !body.keywords) {
    const shown = {};
    for (const { job } of out.matches) for (const c of job.categories) shown[c] = (shown[c] ?? 0) + 1;
    console.log("  categories in the top results:", shown);
  }
  for (const { job, compatibility } of out.matches.slice(0, 5)) {
    console.log(`  ${String(compatibility?.score ?? "-").padStart(3)}%  ${job.title.slice(0, 40)} | ${(job.employer ?? "?").slice(0, 18)} | ${(job.location ?? "?").slice(0, 26)} | ${(job.postedAt ?? "no date").slice(0, 10)} | ${job.sources[0].slice(0, 10)}`);
  }
  const statuses = [];
  for (const { job } of out.matches.slice(0, LINKS_PER_SEARCH)) statuses.push(await checkLink(job.applyUrl));
  if (statuses.length) console.log(`  apply links: ${statuses.join(", ")}`);
}
