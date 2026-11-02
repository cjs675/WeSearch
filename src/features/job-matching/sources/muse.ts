import { MUSE_CATEGORIES } from "../taxonomy";
import { norm } from "../text";
import { getJson } from "./http";
import { detectJobType, isUsLocation, makeJob, present, type Raw } from "./job";
import { type JobSource, type SourceJob, SourceUnavailable } from "./types";

const MAX_CATEGORIES = 5;
const PAGES = [0, 1, 2]; // Results aren't reliably newest-first, so one page misses recent listings

export function parseMuse(r: Raw): SourceJob | null {
  const locations: string[] = (r.locations ?? []).map((l: Raw) => l.name ?? "");
  const levels = norm((r.levels ?? []).map((l: Raw) => l.name ?? "").join(" "));
  const level = levels.includes("internship") ? "internship" : levels.includes("entry") ? "entry"
    : levels.includes("senior") || levels.includes("management") ? "senior" : null;
  return makeJob("The Muse", r.id, {
    title: r.name, employer: r.company?.name, location: locations.join("; "), description: r.contents,
    url: r.refs?.landing_page, posted: r.publication_date,
    remote: locations.some((l) => /remote|flexible/i.test(l)),
    level, jobType: level === "internship" ? "internship" : detectJobType(String(r.name ?? "")),
  });
}

export const theMuse: JobSource = {
  name: "The Muse",
  async fetch(categories, request) {
    const museCategories = [...new Set(categories.flatMap((c) => MUSE_CATEGORIES[c] ?? []))].slice(0, MAX_CATEGORIES);
    const location: Record<string, string> = request.location?.includes(",") ? { location: request.location } : {}; // Exact "City, ST" names only
    // Internships and entry-level are levels in this API, not categories
    const searches: Record<string, string>[] = museCategories.map((category) => ({ category }));
    if (categories.includes("Internships")) searches.push({ level: "Internship" });
    if (categories.includes("Entry-Level")) searches.push({ level: "Entry Level" });
    const requests = searches.flatMap((search) => PAGES.map((page) => ({ descending: "true", ...location, ...search, page })));
    const results = await Promise.allSettled(requests.map((params) => getJson<Raw>("https://www.themuse.com/api/public/jobs", { params })));
    const jobs = present(results.flatMap((r) => (r.status === "fulfilled" ? r.value.results ?? [] : [])).map(parseMuse));
    const failure = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failure && !jobs.length) throw failure.reason instanceof SourceUnavailable ? failure.reason : new SourceUnavailable("could not read it");
    return { jobs: jobs.filter((j) => isUsLocation(j.location)) };
  },
};
