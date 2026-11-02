// Runs the required scenarios through the running app's API and prints the real listings returned.
// The resumes are made-up test people. Start the app first (npm run dev), then:
//   node scripts/verify-job-matching.mjs "Chicago, IL"

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const location = process.argv[2];
const skills = (...names) => names.map((name) => ({ name, source: "manual" }));
const person = (extra) => ({ skills: [], experience: [], education: [], certifications: [], isStudent: false, ...extra });

const FAST_FOOD = person({
  skills: skills("cash handling", "customer service", "food preparation", "teamwork"),
  experience: [{ title: "Crew Member", employer: "McDonald's", years: 2 }],
});
const STUDENT = person({
  skills: skills("communication", "microsoft office", "research"),
  isStudent: true,
  education: [{ level: "bachelor", inProgress: true }],
});
const PROGRAMMER = person({
  skills: skills("python", "sql", "git"),
  experience: [{ title: "Software Developer", years: 4 }],
});

const SCENARIOS = [
  ["1. Fast-food worker, no category chosen", { resume: FAST_FOOD }, ["Fast Food", "Retail", "Hospitality", "Customer Service"]],
  ["2. Student, no work experience, no category chosen", { resume: STUDENT }, ["Internships"]],
  ["3. Programmer selects Fast Food", { resume: PROGRAMMER, categories: ["Fast Food"] }, ["Fast Food"]],
];
const EXTRAS = [
  ["Keyword: McDonald's", { resume: PROGRAMMER, keywords: "McDonald's" }],
  ["Keywords: cashier, part-time", { resume: FAST_FOOD, keywords: "cashier, part-time" }],
  ...["Fast Food", "Retail", "Warehouse", "Customer Service", "Internships"].map((c) => [`Category: ${c}`, { resume: FAST_FOOD, categories: [c] }]),
];

async function run(label, body, wanted = []) {
  const response = await fetch(`${BASE}/api/jobs/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location, ...body }),
  });
  const out = await response.json();
  console.log(`\n=== ${label} (HTTP ${response.status})`);
  for (const s of out.sources) console.log(`  [${s.state}] ${s.name}: ${s.message}`);
  console.log(`  total ${out.total} | searched: ${out.searchTerms.join(", ")}`);
  if (out.message) console.log(`  message: ${out.message}`);
  for (const { job, compatibility } of out.matches.slice(0, 6)) {
    console.log(`  ${String(compatibility?.score ?? "-").padStart(3)}%  ${job.title.slice(0, 46)} | ${(job.employer ?? "?").slice(0, 22)} | ${(job.location ?? "?").slice(0, 22)} | ${(job.postedAt ?? "no date").slice(0, 10)} | ${job.applyUrl.slice(0, 60)}`);
  }
  const counts = wanted.map((c) => [c, out.matches.filter((m) => m.job.categories.includes(c)).length]);
  if (wanted.length) console.log("  by category:", Object.fromEntries(counts));
  const missing = counts.filter(([, n]) => n === 0).map(([c]) => c);
  const met = out.matches.length > 0 && missing.length === 0;
  if (wanted.length) console.log(`  --> ${met ? "MET" : `NOT MET${missing.length ? ` (no real listings for: ${missing.join(", ")})` : ""}`}`);
  return met;
}

const results = [];
for (const [label, body, wanted] of SCENARIOS) results.push(await run(label, body, wanted));
for (const [label, body] of EXTRAS) await run(label, body);
console.log(`\nScenarios met: ${results.filter(Boolean).length} of ${results.length}`);
