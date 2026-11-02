// Logic tests. Listings here are test inputs only and are never reachable from the app.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobCategory, JobSearchRequest, Resume } from "@/types";
import { buildProfile, suggestedCategories } from "./profile";
import { scoreJob } from "./scoring";
import { applyFilters, dedupe, generateTerms, jobCategories, keywordTier, searchJobs } from "./search";
import { detectJobType, fetchAll, parseJobicy, parseMuse, parseRemotive, parseUsaJobs, SOURCES } from "./sources";
import { type JobSource, type SourceJob, SourceUnavailable } from "./sources/types";
import { stripHtml } from "./text";

function job(title: string, employer = "Acme", description = "", extra: Partial<SourceJob> = {}): SourceJob {
  const base: SourceJob = {
    id: `test:${title}:${employer}`, sources: ["test"], title, employer, location: "Chicago, IL", remote: false, description,
    descriptionIsPartial: false, applyUrl: `https://example.test/${encodeURIComponent(title + employer)}`, postedAt: null, salary: null,
    jobType: null, categories: [], level: null, labels: [], locationCheckedByApi: false, ...extra,
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
    name: "Fake", needsKey: null, configured: () => true,
    fetch: async () => {
      if (error) throw new SourceUnavailable(error);
      return jobs.map((j) => ({ ...j }));
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
    const source: JobSource = { ...fake(), fetch: async (_q, categories) => { browsed = categories; return [job("Cashier"), job("Stock Associate")]; } };
    const out = await searchJobs(request({ keywords: ["cashier"] }), null, [source]);
    expect(browsed).toContain("Retail");
    expect(titles(out)).toEqual(["Cashier"]);
  });
  it("says so when a source has nothing", async () => {
    const out = await searchJobs(request({ categories: ["Retail"] }), null, [fake()]);
    expect(out.matches).toEqual([]);
    expect(out.message).toContain("none of their listings");
  });
});

describe("sources", () => {
  afterEach(() => vi.unstubAllEnvs());
  // Field mapping against documented shapes. These don't prove the live APIs work.
  it("converts USAJOBS hourly pay to yearly", () => {
    const j = parseUsaJobs({ PositionID: "1", PositionTitle: "Clerk", OrganizationName: "VA", ApplyURI: ["https://u.test/1"],
      PositionRemuneration: [{ MinimumRange: "20", MaximumRange: "25", RateIntervalCode: "PH" }], PositionSchedule: [{ Name: "Part-Time" }] }, false);
    expect(j?.salary?.min).toBe(41600);
    expect(j?.jobType).toBe("part_time");
    expect(j?.labels).toEqual(["Government"]);
  });
  it("drops a listing whose link isn't http or https", () => {
    expect(parseMuse({ id: "1", name: "Cashier", refs: { landing_page: "javascript:alert(1)" } })).toBeNull();
    expect(parseJobicy({ id: "1", jobTitle: "Cashier", url: "not a link" })).toBeNull();
  });
  it("reads The Muse's locations and levels", () => {
    const j = parseMuse({ id: "1", name: "Marketing Intern", company: { name: "X" }, contents: "<p>Hello &amp; welcome</p>", publication_date: "2026-10-01T00:00:00Z",
      locations: [{ name: "Chicago, IL" }, { name: "Flexible / Remote" }], levels: [{ name: "Internship" }], refs: { landing_page: "https://u.test/1" } });
    expect(j?.location).toBe("Chicago, IL; Flexible / Remote");
    expect(j?.remote).toBe(true);
    expect(j?.level).toBe("internship");
    expect(j?.jobType).toBe("internship");
    expect(j?.description).toBe("Hello & welcome");
  });
  it("keeps Remotive's pay as written", () => {
    const j = parseRemotive({ id: "1", title: "Support Agent", company_name: "X", candidate_required_location: "USA", url: "https://u.test/1", salary: "$20/hour", job_type: "freelance" });
    expect(j?.salary).toEqual({ text: "$20/hour", estimated: false });
    expect(j?.jobType).toBe("contract");
    expect(j?.remote).toBe(true);
  });
  it("converts Jobicy's pay to yearly, in US dollars only", () => {
    const base = { id: "1", jobTitle: "Support Agent", companyName: "X", jobGeo: "USA", url: "https://u.test/1", salaryMin: "3000", salaryPeriod: "monthly" };
    expect(parseJobicy({ ...base, salaryCurrency: "USD" })?.salary?.min).toBe(36000);
    expect(parseJobicy({ ...base, salaryCurrency: "EUR" })?.salary).toBeNull();
  });
  it("reads job type from the title before the description", () => {
    expect(detectJobType("Cashier", "This contract covers full time staff")).toBe("full_time");
    expect(detectJobType("Part-Time Cashier", "full time")).toBe("part_time");
  });
  it("reports a source with no key as not configured, without revealing anything", async () => {
    vi.stubEnv("USAJOBS_API_KEY", "");
    const usaJobs = SOURCES.find((s) => s.name === "USAJOBS");
    expect(usaJobs?.configured()).toBe(false);
    const { statuses } = await fetchAll(["cashier"], [], request(), usaJobs ? [usaJobs] : []);
    expect(statuses[0].state).toBe("not_configured");
    expect(statuses[0].message).not.toContain("USAJOBS_API_KEY=");
  });
  it("lists only the supported sources", () => {
    expect(SOURCES.map((s) => s.name)).toEqual(["USAJOBS", "The Muse", "Remotive", "Jobicy"]);
  });
  it("keeps other sources' results when one fails", async () => {
    const { jobs, statuses } = await fetchAll(["cashier"], [], request(), [fake([], "could not reach the API"), fake([job("Cashier")])]);
    expect(jobs.map((j) => j.title)).toEqual(["Cashier"]);
    expect(statuses.map((s) => s.state)).toEqual(["error", "ok"]);
  });
});
