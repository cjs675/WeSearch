// Logic tests. Listings here are test inputs only and are never reachable from the app.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobCategory, JobSearchRequest, Resume } from "@/types";
import { buildProfile, suggestedCategories } from "./profile";
import { scoreJob } from "./scoring";
import { applyFilters, dedupe, generateTerms, jobCategories, keywordTier, searchJobs } from "./search";
import { fetchAll, SOURCES } from "./sources";
import { getJson } from "./sources/http";
import { parseAshby } from "./sources/ashby";
import { type Employer, employerSource, selectEmployers } from "./sources/employers";
import { parseGreenhouse } from "./sources/greenhouse";
import { detectJobType, detectRemote, isUsLocation, parseSalaryText } from "./sources/job";
import { parseJobicy } from "./sources/jobicy";
import { parseLever } from "./sources/lever";
import { parseMuse } from "./sources/muse";
import { parseRemoteOk } from "./sources/remoteok";
import { type JobSource, type SourceJob, SourceUnavailable } from "./sources/types";
import { stripHtml } from "./text";

function job(title: string, employer = "Acme", description = "", extra: Partial<SourceJob> = {}): SourceJob {
  const base: SourceJob = {
    id: `test:${title}:${employer}`, sources: ["test"], title, employer, location: "Chicago, IL", remote: false, description,
    descriptionIsPartial: false, applyUrl: `https://example.test/${encodeURIComponent(title + employer)}`, postedAt: null, salary: null,
    jobType: null, categories: [], level: null, labels: [], verifiedOpen: false, ...extra,
  };
  return { ...base, categories: jobCategories(base) };
}

function resume(skills: string[], extra: Partial<Resume> = {}): Resume {
  return { skills: skills.map((name) => ({ name, source: "extracted" })), experience: [], education: [], certifications: [], isStudent: false, ...extra };
}

const FAST_FOOD = resume(["cash handling", "customer service", "food preparation"], { experience: [{ title: "Crew Member", employer: "McDonald's", years: 2 }] });
const STUDENT = resume(["communication"], { isStudent: true, education: [{ level: "bachelor", inProgress: true }] });
const PROGRAMMER = resume(["python", "sql"], { experience: [{ title: "Software Developer", years: 4 }] });

function fake(jobs: SourceJob[] = [], error?: string): JobSource {
  return {
    name: "Fake",
    fetch: async () => {
      if (error) throw new SourceUnavailable(error);
      return { jobs: jobs.map((j) => ({ ...j })) };
    },
  };
}
const request = (extra: Partial<JobSearchRequest> = {}): JobSearchRequest => ({ keywords: [], categories: [], ...extra });
const score = (j: SourceJob, r: Resume) => scoreJob(j, buildProfile(r));
const titles = (out: Awaited<ReturnType<typeof searchJobs>>) => out.matches.map((m) => m.job.title);

describe("categories", () => {
  const has = (j: SourceJob, c: JobCategory) => j.categories.includes(c);
  it("treats a brand employer as fast food, except corporate roles", () => {
    expect(has(job("Shift Manager", "McDonald's"), "Fast Food")).toBe(true);
    expect(has(job("Software Engineer", "McDonald's"), "Fast Food")).toBe(false);
  });
  it("avoids false friends found in real listings", () => {
    expect(has(job("SQL Server Administrator"), "Restaurants")).toBe(false);
    expect(has(job("Security Engineer"), "Security")).toBe(false);
    expect(has(job("Internal Auditor"), "Internships")).toBe(false);
    expect(has(job("Treasury Sales Associate I"), "Retail")).toBe(false);
    expect(has(job("Enterprise Sales Leader, Retail"), "Retail")).toBe(false);
    expect(has(job("Teller", "U.S. Bank"), "Government")).toBe(false);
    expect(has(job("Federal Sales Manager"), "Government")).toBe(false);
    expect(has(job("Senior Product Manager, Security"), "Security")).toBe(false);
    expect(has(job("Higher Education Enterprise Sales"), "Education")).toBe(false);
    expect(has(job("Healthcare Provider Account Manager"), "Healthcare")).toBe(false);
    expect(has(job("Senior Data Scientist, Delivery"), "Delivery")).toBe(false);
    expect(has(job("Senior Data Scientist, Guest & Host"), "Restaurants")).toBe(false);
  });
  it("ignores a mention that's only in the description", () => {
    expect(has(job("Accountant", "Acme", "Clients in the fast food industry."), "Fast Food")).toBe(false);
  });
});

describe("keywords", () => {
  it("needs a brand in the employer or title", () => {
    expect(keywordTier(job("Crew", "McDonald's"), "McDonald's")).toBe(3);
    expect(keywordTier(job("Cook", "Diner", "McDonald's experience a plus."), "McDonald's")).toBe(0);
  });
  it("ranks a related title below an exact one", () => {
    expect(keywordTier(job("Cashier"), "cashier")).toBe(3);
    expect(keywordTier(job("Front End Associate"), "cashier")).toBe(2);
  });
  it("understands part-time", () => {
    expect(keywordTier(job("Cook", "Acme", "", { jobType: "part_time" }), "part-time")).toBe(3);
    expect(keywordTier(job("Cook", "Acme", "", { jobType: "full_time" }), "part-time")).toBe(0);
  });
  it("rejects unpaid internships for paid internship", () => {
    expect(keywordTier(job("Marketing Intern", "Acme", "This is a paid role."), "paid internship")).toBe(3);
    expect(keywordTier(job("Marketing Intern", "Acme", "This is an unpaid role."), "paid internship")).toBe(0);
  });
  it("generates related terms and titles", () => {
    const { queries, titles: related } = generateTerms(["Fast Food"], ["cashier"]);
    expect(queries).toContain("cashier");
    expect(related).toEqual(expect.arrayContaining(["Front End Associate", "Crew Member"]));
  });
});

describe("scoring", () => {
  it("is the sum of its parts, from 0 to 100", () => {
    for (const r of [FAST_FOOD, STUDENT, PROGRAMMER]) {
      const s = score(job("Cashier", "Acme", "Handle cash and help customers."), r);
      expect(s.score).toBe(s.components.reduce((sum, c) => sum + c.points, 0));
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
  });
  it("ranks a step up below a same-level job in the same field", () => {
    const crew = job("Shift Leader", "Wendy's");
    const manager = job("District Manager", "Wendy's");
    expect(score(crew, FAST_FOOD).score).toBeGreaterThan(score(manager, FAST_FOOD).score);
  });
  it("recognizes transferable skills", () => {
    const s = score(job("Cashier", "Acme", "Use the POS register and sell products."), FAST_FOOD);
    expect(s.transferableSkills.map((t) => t.countsToward)).toContain("pos systems");
  });
  it("scores a fast-food worker above a programmer for retail", () => {
    const cashier = job("Retail Cashier", "Acme", "Cash handling and customer service.");
    expect(score(cashier, FAST_FOOD).score).toBeGreaterThan(score(cashier, PROGRAMMER).score);
  });
  it("flags a missing requirement without zeroing the job", () => {
    const s = score(job("Delivery Driver", "Acme", "A valid CDL is required."), STUDENT);
    expect(s.qualifications.map((q) => q.status)).toEqual(["missing"]);
    expect(s.score).toBeGreaterThan(0);
  });
  it("doesn't treat preferred as mandatory", () => {
    expect(score(job("Driver", "Acme", "CDL preferred."), STUDENT).qualifications).toEqual([]);
  });
  it("doesn't penalize what can be obtained after hire", () => {
    const s = score(job("Cook", "Acme", "Food handler card required, we will help after hire."), STUDENT);
    expect(s.qualifications[0].canGetAfterHire).toBe(true);
    expect(s.components[3].points).toBe(15);
  });
  it("marks a degree underway as in progress", () => {
    expect(score(job("Analyst", "Acme", "Bachelor's degree required."), STUDENT).qualifications[0].status).toBe("in_progress");
  });
  it("reads requirements from separate HTML list items", () => {
    const description = stripHtml("<ul><li>Friendly attitude</li><li>Must have a CDL</li><li>Forklift certification preferred</li></ul>");
    expect(score(job("Driver", "Acme", description), STUDENT).qualifications.map((q) => q.label)).toEqual(["Commercial driver's license (CDL)"]);
  });
});

describe("duplicates", () => {
  it("merges the same job and keeps both sources", () => {
    const merged = dedupe([
      job("Cashier (Full-Time)", "Target Inc", "", { sources: ["A"], salary: { min: 30000, estimated: false } }),
      job("Cashier", "Target", "longer description", { sources: ["B"] }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].sources).toEqual(["A", "B"]);
    expect(merged[0].description).toBe("longer description");
  });
  it("keeps the same title in different cities", () => {
    expect(dedupe([job("Cashier"), job("Cashier", "Acme", "", { location: "Boston, MA", applyUrl: "https://example.test/b" })])).toHaveLength(2);
  });
  it("merges listings with the same link", () => {
    expect(dedupe([job("Cashier"), job("Cashier", "Acme", "", { location: "Boston, MA" })])).toHaveLength(1);
  });
});

describe("filters", () => {
  const filter = (jobs: SourceJob[], extra: Partial<JobSearchRequest>) =>
    applyFilters(jobs.map((j) => ({ job: j, relevance: 2, match: { job: j, compatibility: null, entryLevel: false, matchedKeywords: [] } })), request({ maxAgeDays: null, ...extra })).kept.map((k) => k.job.title);
  it("keeps remote jobs when filtering by location", () => {
    expect(filter([job("A"), job("B", "Acme", "", { location: "Boston, MA" }), job("C", "Acme", "", { location: "Remote", remote: true })], { location: "Chicago, IL" })).toEqual(["A", "C"]);
  });
  it("keeps unstated pay unless told not to", () => {
    const jobs = [job("Low", "Acme", "", { salary: { max: 20000, estimated: false } }), job("High", "Acme", "", { salary: { max: 60000, estimated: false } }), job("Unknown")];
    expect(filter(jobs, { minSalary: 30000 })).toEqual(["High", "Unknown"]);
    expect(filter(jobs, { minSalary: 30000, salaryRequired: true })).toEqual(["High"]);
  });
  it("filters by remote and job type", () => {
    const jobs = [job("A", "Acme", "", { remote: true, jobType: "part_time" }), job("B", "Acme", "", { jobType: "full_time" })];
    expect(filter(jobs, { remote: "only" })).toEqual(["A"]);
    expect(filter(jobs, { jobType: "full_time" })).toEqual(["B"]);
  });
  it("gives listings on live employer boards up to a year", async () => {
    const months = (n: number) => new Date(Date.now() - n * 30 * 86_400_000).toISOString();
    const jobs = [job("Retail A", "Acme", "", { postedAt: months(6), verifiedOpen: true }), job("Retail B", "Acme", "", { postedAt: months(20), verifiedOpen: true }), job("Retail C", "Acme", "", { postedAt: months(6) })];
    expect(titles(await searchJobs(request({ categories: ["Retail"] }), null, [fake(jobs)]))).toEqual(["Retail A"]);
  });
  it("matches a state code and treats a distance as the same state", () => {
    const jobs = [job("A", "Acme", "", { location: "Peoria, IL" }), job("B", "Acme", "", { location: "Boston, MA" })];
    expect(filter(jobs, { location: "IL" })).toEqual(["A"]);
    expect(filter(jobs, { location: "Chicago, IL" })).toEqual([]);
    expect(filter(jobs, { location: "Chicago, IL", distanceMiles: 25 })).toEqual(["A"]);
  });
  it("hides old listings by default", async () => {
    const old = job("Retail Associate", "Acme", "", { postedAt: "2020-01-01T00:00:00Z" });
    const out = await searchJobs(request({ categories: ["Retail"] }), null, [fake([old])]);
    expect(out.matches).toEqual([]);
    expect(out.notes[0]).toContain("hidden");
    expect(out.message).toContain("old listings");
  });
  it("applies a minimum score", async () => {
    const out = await searchJobs(request({ categories: ["Retail"], minScore: 99 }), PROGRAMMER, [fake([job("Retail Cashier")])]);
    expect(out.matches).toEqual([]);
    expect(out.message).toContain("filters");
  });
});

describe("required behavior", () => {
  it("suggests retail, hospitality and customer service to a fast-food worker", () => {
    expect(suggestedCategories(buildProfile(FAST_FOOD))).toEqual(expect.arrayContaining(["Fast Food", "Retail", "Hospitality", "Customer Service"]));
  });
  it("shows a fast-food worker other kinds of work, not one employer's many openings", async () => {
    const insomnia = Array.from({ length: 150 }, (_, i) => job("Cookie Crew", "Insomnia Cookies", "", { location: `Town ${i}, OH`, applyUrl: `https://example.test/${i}` }));
    const others = [job("Retail Cashier", "Acme"), job("Hotel Front Desk Agent", "Inn Co"), job("Customer Service Representative", "Call Co")];
    const out = await searchJobs(request(), FAST_FOOD, [fake([...insomnia, ...others])]);
    expect(out.total).toBe(153);
    expect(out.matches).toHaveLength(100);
    const employers = out.matches.map((m) => m.job.employer);
    for (const employer of ["Acme", "Inn Co", "Call Co"]) expect(employers).toContain(employer);
  });
  it("keeps strict ranking when a category is chosen", async () => {
    const jobs = Array.from({ length: 12 }, (_, i) => job("Cookie Crew", "Insomnia Cookies", "", { location: `Town ${i}, OH`, applyUrl: `https://example.test/${i}` }));
    const lower = job("Fast Food Cook", "Other Co", "", { location: "Town, OH" });
    const out = await searchJobs(request({ categories: ["Fast Food"] }), FAST_FOOD, [fake([...jobs, lower])]);
    const scores = out.matches.map((m) => m.compatibility?.score ?? 0);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
  it("gives a student with no experience entry-level jobs only", async () => {
    const source = fake([job("Marketing Intern"), job("Retail Store Manager"), job("Retail Associate", "Acme", "5 years of experience required.")]);
    const out = await searchJobs(request(), STUDENT, [source]);
    expect(titles(out)).toEqual(["Marketing Intern"]);
  });
  it("respects a selected category over the resume's career", async () => {
    const out = await searchJobs(request({ categories: ["Fast Food"] }), PROGRAMMER, [fake([job("Crew Member", "Wendy's"), job("Software Developer")])]);
    expect(titles(out)).toEqual(["Crew Member"]);
  });
  it("ranks an exact keyword above a higher score", async () => {
    const source = fake([job("Front End Associate", "Acme", "cash handling, customer service, POS"), job("Cashier")]);
    const out = await searchJobs(request({ keywords: ["cashier"] }), resume(["cash handling", "customer service"]), [source]);
    expect(titles(out)[0]).toBe("Cashier");
  });
  it("reports a failed source and invents nothing", async () => {
    const out = await searchJobs(request({ categories: ["Retail"] }), null, [fake([], "could not reach the API")]);
    expect(out.matches).toEqual([]);
    expect(out.sources[0].state).toBe("error");
    expect(out.message).toContain("could be reached");
  });
  it("browses the category a keyword points to, without loosening the match", async () => {
    let browsed: JobCategory[] = [];
    const source: JobSource = { ...fake(), fetch: async (categories) => { browsed = categories; return { jobs: [job("Cashier"), job("Stock Associate")] }; } };
    const out = await searchJobs(request({ keywords: ["cashier"] }), null, [source]);
    expect(browsed).toContain("Retail");
    expect(titles(out)).toEqual(["Cashier"]);
  });
  it("says so when a source has nothing", async () => {
    const out = await searchJobs(request({ categories: ["Retail"] }), null, [fake()]);
    expect(out.matches).toEqual([]);
    expect(out.message).toContain("had no listings");
  });
});

const ACME: Employer = { name: "Acme Foods", platform: "greenhouse", token: "acmefoods", categories: ["Fast Food"] };

describe("sources", () => {
  // Field mapping against real response shapes. Live behavior is checked by scripts/verify-job-matching.mjs.
  it("reads a Greenhouse listing", () => {
    const j = parseGreenhouse({ id: 1, title: "Team Member", location: { name: "Liberty Township, OH" }, absolute_url: "https://careers.test/1", first_published: "2026-10-16T19:46:24-04:00",
      content: "&lt;p&gt;Earn $18 - $22 per hour. Must have a food handler card.&lt;/p&gt;", metadata: [{ name: "TH: Employment Type", value: "Part-time" }] }, ACME);
    expect(j?.employer).toBe("Acme Foods");
    expect(j?.jobType).toBe("part_time");
    expect(j?.salary?.min).toBe(37440);
    expect(j?.verifiedOpen).toBe(true);
    expect(j?.description).not.toContain("<p>");
  });
  it("drops a Greenhouse listing past its deadline", () => {
    expect(parseGreenhouse({ id: 1, title: "Cook", absolute_url: "https://careers.test/1", application_deadline: "2020-01-01" }, ACME)).toBeNull();
  });
  it("doesn't give a restaurant's category to its head-office jobs", () => {
    expect(job("Assistant Restaurant Manager", "sweetgreen").categories).toContain("Fast Food");
    for (const title of ["Tax Manager", "Senior Manager, Loyalty & CRM", "Executive Business Partner"]) expect(job(title, "sweetgreen").categories).not.toContain("Fast Food");
  });
  it("skips resume-collecting postings that aren't openings", () => {
    expect(parseGreenhouse({ id: 1, title: "General Application", absolute_url: "https://careers.test/1" }, ACME)).toBeNull();
  });
  it("reads a Lever listing", () => {
    const j = parseLever({ id: "a", text: "Package Handler", categories: { location: "Cherry Hill, NJ", commitment: "Part Time" }, hostedUrl: "https://jobs.lever.co/x/a", createdAt: 1789052684716, descriptionPlain: "Lift boxes.", workplaceType: "onsite",
      salaryRange: { min: 40000, max: 50000, currency: "USD", interval: "per-year-salary" } }, ACME);
    expect(j?.jobType).toBe("part_time");
    expect(j?.location).toBe("Cherry Hill, NJ");
    expect(j?.postedAt).toContain("2026");
    expect(j?.salary).toEqual({ min: 40000, max: 50000, estimated: false });
  });
  it("keeps Lever's hourly pay as hourly", () => {
    const j = parseLever({ id: "a", text: "Cookie Crew", hostedUrl: "https://jobs.lever.co/x/a", salaryRange: { min: 18.25, max: 18.5, currency: "USD", interval: "per-hour-wage" } }, ACME);
    expect(j?.salary?.text).toBe("$18.25 to $18.5 an hour");
    expect(j?.salary?.min).toBe(37960);
  });
  it("reads an Ashby listing and skips unlisted ones", () => {
    const base = { id: "a", title: "Support Agent", location: "New York, NY", applyUrl: "https://jobs.ashbyhq.com/x/a", employmentType: "Intern", isRemote: false, compensation: { scrapeableCompensationSalarySummary: "$50K - $60K" } };
    const j = parseAshby(base, ACME);
    expect(j?.jobType).toBe("internship");
    expect(j?.salary?.max).toBe(60000);
    expect(parseAshby({ ...base, isListed: false }, ACME)).toBeNull();
  });
  it("reads The Muse's locations and levels", () => {
    const j = parseMuse({ id: "1", name: "Marketing Intern", company: { name: "X" }, contents: "<p>Hello &amp; welcome</p>", publication_date: "2026-10-01T00:00:00Z",
      locations: [{ name: "Chicago, IL" }, { name: "Flexible / Remote" }], levels: [{ name: "Internship" }], refs: { landing_page: "https://u.test/1" } });
    expect(j?.location).toBe("Chicago, IL; Flexible / Remote");
    expect(j?.remote).toBe(true);
    expect(j?.level).toBe("internship");
    expect(j?.description).toBe("Hello & welcome");
  });
  it("converts Jobicy's pay to yearly, in US dollars only", () => {
    const base = { id: "1", jobTitle: "Support Agent", companyName: "X", jobGeo: "USA", url: "https://u.test/1", salaryMin: "3000", salaryPeriod: "monthly" };
    expect(parseJobicy({ ...base, salaryCurrency: "USD" })?.salary?.min).toBe(36000);
    expect(parseJobicy({ ...base, salaryCurrency: "EUR" })?.salary).toBeNull();
  });
  it("reads a Remote OK listing, treating zero pay as not stated", () => {
    const j = parseRemoteOk({ id: "1", position: "Support Agent", company: "X", location: "Colorado", url: "https://remoteok.com/remote-jobs/1", date: "2026-11-01T08:00:12+00:00", description: "<p>Help</p>", salary_min: 0, salary_max: 0 });
    expect(j?.remote).toBe(true);
    expect(j?.salary).toBeNull();
    expect(j?.description).toBe("Help");
    expect(parseRemoteOk({ id: "2", position: "Agent", company: "X", location: "Germany", url: "https://remoteok.com/remote-jobs/2" })).toBeNull();
    expect(parseRemoteOk({ last_updated: 1, legal: "terms" })).toBeNull();
  });
  it("drops a listing whose link isn't http or https", () => {
    expect(parseMuse({ id: "1", name: "Cashier", refs: { landing_page: "javascript:alert(1)" } })).toBeNull();
    expect(parseJobicy({ id: "1", jobTitle: "Cashier", url: "not a link" })).toBeNull();
  });
  it("reads stated pay and leaves unclear pay out", () => {
    expect(parseSalaryText("$18 - $22 per hour")?.max).toBe(45760);
    expect(parseSalaryText("$211.4K - $290.6K")?.min).toBeCloseTo(211400);
    expect(parseSalaryText("$500 sign-on bonus")).toBeNull();
    expect(parseSalaryText("Competitive pay")).toBeNull();
  });
  it("recognizes US locations", () => {
    for (const place of ["Liberty Township, OH", "50 Washington St, Norwalk, CT 06854", "United States - Remote", "Remote", "New York"]) expect(isUsLocation(place)).toBe(true);
    for (const place of ["Toronto, ON", "Tokyo, Japan", "Remote (Canada)", "London, UK", null]) expect(isUsLocation(place)).toBe(false);
  });
  it("reads job type from the title before the description", () => {
    expect(detectJobType("Cashier", "This contract covers full time staff")).toBe("full_time");
    expect(detectJobType("Part-Time Cashier", "full time")).toBe("part_time");
  });
  it("detects remote work", () => {
    expect(detectRemote("Agent - Remote", "", "")).toBe(true);
    expect(detectRemote("Agent", "Chicago", "This is not remote.")).toBe(false);
  });
  it("uses only sources that allow automated access", () => {
    expect(SOURCES.map((s) => s.name)).toEqual(["Greenhouse employer boards", "Lever employer boards", "Ashby employer boards", "The Muse", "Jobicy", "Remote OK"]);
  });
  it("keeps other sources' results when one fails", async () => {
    const { jobs, statuses } = await fetchAll([], request(), [fake([], "could not reach it"), fake([job("Cashier")])]);
    expect(jobs.map((j) => j.title)).toEqual(["Cashier"]);
    expect(statuses.map((s) => s.state)).toEqual(["error", "ok"]);
  });
  it("chooses boards by company, then category, then all for a general keyword", () => {
    const other: Employer = { ...ACME, name: "Other Retail", token: "otherretail", categories: ["Retail"] };
    const employers = [ACME, other];
    expect(selectEmployers(employers, [], request({ keywords: ["Acme Foods"] }))).toEqual([ACME]);
    expect(selectEmployers(employers, ["Retail"], request())).toEqual([other]);
    expect(selectEmployers(employers, [], request({ keywords: ["cashier"] }))).toEqual(employers);
  });
  it("reports a board source as unavailable only when no board answers", async () => {
    const down = employerSource("Test", "greenhouse", async () => { throw new SourceUnavailable("down"); });
    await expect(down.fetch(["Fast Food"], request())).rejects.toThrow("none of its employer boards");
    const partial = employerSource("Test", "greenhouse", async (e) => {
      if (e.token !== "sweetgreen") throw new SourceUnavailable("down");
      return [job("Team Member")];
    });
    const result = await partial.fetch(["Retail", "Fast Food"], request());
    expect(result.jobs).toHaveLength(1);
    expect(result.note).toContain("of");
  });
});

describe("polite fetching", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (robots: () => Response) => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(url);
      return url.endsWith("/robots.txt") ? robots() : Response.json({ ok: true });
    });
    return calls;
  };
  const host = () => `https://t${Date.now()}${Math.random().toString(36).slice(2)}.test`;
  it("doesn't request a page robots.txt blocks", async () => {
    const calls = stub(() => new Response("User-agent: *\nDisallow: /"));
    await expect(getJson(`${host()}/jobs`)).rejects.toThrow("robots.txt");
    expect(calls).toHaveLength(1);
  });
  it("allows a page robots.txt permits, or when the site publishes no rules", async () => {
    stub(() => new Response("User-agent: *\nDisallow: /private"));
    await expect(getJson(`${host()}/jobs`)).resolves.toEqual({ ok: true });
    stub(() => new Response("Unauthorized", { status: 401 }));
    await expect(getJson(`${host()}/jobs`)).resolves.toEqual({ ok: true });
  });
  it("skips a source when robots.txt can't be checked", async () => {
    stub(() => new Response("oops", { status: 503 }));
    await expect(getJson(`${host()}/jobs`)).rejects.toThrow("couldn't be checked");
  });
});
