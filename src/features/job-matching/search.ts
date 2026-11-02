import type {
  JobCategory,
  JobListing,
  JobMatch,
  JobSearchRequest,
  JobSearchResponse,
  JobSourceStatus,
  JobType,
  Resume,
  CompatibilityScore,
} from "@/types";
import { JOB_CATEGORIES } from "@/types";

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags: string[];
  job_types: string[];
  location: string;
  created_at: number;
}

interface RemoteOKJob {
  id?: string | number;
  position?: string;
  company?: string;
  description?: string;
  location?: string;
  url?: string;
  apply_url?: string;
  tags?: string[];
  date?: string | number;
  salary_min?: number;
  salary_max?: number;
}

function matchCategory(text: string): JobCategory[] {
  const lower = text.toLowerCase();
  const matched: JobCategory[] = [];
  for (const cat of JOB_CATEGORIES) {
    if (lower.includes(cat.toLowerCase())) {
      matched.push(cat);
    }
  }
  if (matched.length === 0) {
    if (lower.includes("software") || lower.includes("developer") || lower.includes("engineer") || lower.includes("designer")) {
      matched.push("Technology");
    }
  }
  return matched;
}

function mapJobType(types?: string[]): JobType | null {
  if (!types || types.length === 0) return null;
  const first = types[0].toLowerCase();
  if (first.includes("full")) return "full_time";
  if (first.includes("part")) return "part_time";
  if (first.includes("contract")) return "contract";
  if (first.includes("intern")) return "internship";
  if (first.includes("temp")) return "temporary";
  return null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchArbeitnow(): Promise<{ jobs: JobListing[]; status: JobSourceStatus }> {
  try {
    const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return {
        jobs: [],
        status: {
          name: "Arbeitnow",
          state: "error",
          count: 0,
          message: `Arbeitnow returned HTTP ${res.status}`,
        },
      };
    }
    const data = await res.json();
    const rawJobs: ArbeitnowJob[] = data.data || [];
    const jobs: JobListing[] = rawJobs.map((item) => {
      const cleanDesc = stripHtml(item.description || "");
      const categories = matchCategory(`${item.title} ${(item.tags || []).join(" ")}`);
      return {
        id: `arbeitnow-${item.slug}`,
        sources: ["Arbeitnow"],
        title: item.title,
        employer: item.company_name || null,
        location: item.location || (item.remote ? "Remote" : null),
        remote: Boolean(item.remote),
        description: cleanDesc,
        descriptionIsPartial: cleanDesc.length > 300,
        applyUrl: item.url,
        postedAt: item.created_at ? new Date(item.created_at * 1000).toISOString() : null,
        salary: null,
        jobType: mapJobType(item.job_types),
        categories: categories.length ? categories : ["Technology"],
      };
    });

    return {
      jobs,
      status: {
        name: "Arbeitnow",
        state: "ok",
        count: jobs.length,
        message: `Fetched ${jobs.length} listings from Arbeitnow`,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch from Arbeitnow";
    return {
      jobs: [],
      status: {
        name: "Arbeitnow",
        state: "error",
        count: 0,
        message,
      },
    };
  }
}

async function fetchRemoteOK(): Promise<{ jobs: JobListing[]; status: JobSourceStatus }> {
  try {
    const res = await fetch("https://remoteok.com/api", {
      next: { revalidate: 60 },
      headers: {
        "User-Agent": "WeSearch/1.0",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      return {
        jobs: [],
        status: {
          name: "RemoteOK",
          state: "error",
          count: 0,
          message: `RemoteOK returned HTTP ${res.status}`,
        },
      };
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      return {
        jobs: [],
        status: {
          name: "RemoteOK",
          state: "error",
          count: 0,
          message: "Unexpected response format from RemoteOK",
        },
      };
    }
    // Skip the first item if it is legal metadata
    const jobItems = (data as RemoteOKJob[]).filter((item) => item.position && item.id);
    const jobs: JobListing[] = jobItems.slice(0, 50).map((item) => {
      const cleanDesc = stripHtml(item.description || "");
      const categories = matchCategory(`${item.position} ${(item.tags || []).join(" ")}`);
      return {
        id: `remoteok-${item.id}`,
        sources: ["RemoteOK"],
        title: item.position || "Untitled Role",
        employer: item.company || null,
        location: item.location || "Remote",
        remote: true,
        description: cleanDesc,
        descriptionIsPartial: cleanDesc.length > 300,
        applyUrl: item.apply_url || item.url || `https://remoteok.com/l/${item.id}`,
        postedAt: item.date ? new Date(typeof item.date === "number" ? item.date * 1000 : item.date).toISOString() : null,
        salary: item.salary_min || item.salary_max ? { min: item.salary_min, max: item.salary_max, estimated: false } : null,
        jobType: "full_time",
        categories: categories.length ? categories : ["Technology"],
      };
    });

    return {
      jobs,
      status: {
        name: "RemoteOK",
        state: "ok",
        count: jobs.length,
        message: `Fetched ${jobs.length} listings from RemoteOK`,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch from RemoteOK";
    return {
      jobs: [],
      status: {
        name: "RemoteOK",
        state: "error",
        count: 0,
        message,
      },
    };
  }
}

function computeCompatibility(job: JobListing, resume: Resume): CompatibilityScore {
  const candidateSkills = resume.skills.map((s) => s.name.toLowerCase());
  const jobText = `${job.title} ${job.description}`.toLowerCase();

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const skill of resume.skills) {
    if (jobText.includes(skill.name.toLowerCase())) {
      matchedSkills.push(skill.name);
    }
  }

  // Common industry skills to detect if missing
  const commonTechSkills = ["TypeScript", "React", "Node.js", "Python", "SQL", "Docker", "AWS", "Design", "Figma"];
  for (const skill of commonTechSkills) {
    if (jobText.includes(skill.toLowerCase()) && !candidateSkills.includes(skill.toLowerCase())) {
      missingSkills.push(skill);
    }
  }

  const skillScore = candidateSkills.length > 0
    ? Math.min(60, Math.round((matchedSkills.length / Math.max(1, candidateSkills.length)) * 60))
    : 40;

  const experienceYears = resume.experience.reduce((acc, exp) => acc + (exp.years || 1), 0);
  const experienceScore = Math.min(25, experienceYears * 5);
  const educationScore = resume.education.length > 0 ? 15 : 10;

  const totalScore = Math.min(100, Math.max(0, skillScore + experienceScore + educationScore));

  return {
    score: totalScore,
    components: [
      {
        name: "Skill Match",
        points: skillScore,
        maxPoints: 60,
        explanation: `${matchedSkills.length} matching skills identified in job posting.`,
      },
      {
        name: "Experience",
        points: experienceScore,
        maxPoints: 25,
        explanation: `${experienceYears} years of relevant experience across roles.`,
      },
      {
        name: "Background",
        points: educationScore,
        maxPoints: 15,
        explanation: "Educational background and certifications align with criteria.",
      },
    ],
    matchedSkills,
    transferableSkills: [],
    missingSkills: missingSkills.slice(0, 3),
    qualifications: [
      {
        label: "Relevant Domain Experience",
        status: matchedSkills.length > 0 ? "met" : "in_progress",
        evidence: `Matches ${matchedSkills.join(", ") || "baseline domain keywords"}`,
      },
    ],
  };
}

export async function searchJobs(
  request: JobSearchRequest,
  resume?: Resume
): Promise<JobSearchResponse> {
  const [arbeitnowResult, remoteokResult] = await Promise.all([
    fetchArbeitnow(),
    fetchRemoteOK(),
  ]);

  const sources: JobSourceStatus[] = [arbeitnowResult.status, remoteokResult.status];
  let allListings: JobListing[] = [...arbeitnowResult.jobs, ...remoteokResult.jobs];

  // Filter by keywords
  if (request.keywords && request.keywords.length > 0) {
    const kws = request.keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
    if (kws.length > 0) {
      allListings = allListings.filter((job) => {
        const title = job.title.toLowerCase();
        const desc = job.description.toLowerCase();
        const emp = (job.employer || "").toLowerCase();
        return kws.some((kw) => title.includes(kw) || desc.includes(kw) || emp.includes(kw));
      });
    }
  }

  // Filter by location
  if (request.location && request.location.trim().length > 0) {
    const loc = request.location.toLowerCase().trim();
    allListings = allListings.filter((job) => {
      const jobLoc = (job.location || "").toLowerCase();
      if (loc === "remote") {
        return job.remote || jobLoc.includes("remote");
      }
      return jobLoc.includes(loc);
    });
  }

  // Filter by remote preference
  if (request.remote === "only") {
    allListings = allListings.filter((job) => job.remote);
  } else if (request.remote === "exclude") {
    allListings = allListings.filter((job) => !job.remote);
  }

  // Filter by categories
  if (request.categories && request.categories.length > 0) {
    allListings = allListings.filter((job) =>
      job.categories.some((cat) => request.categories.includes(cat))
    );
  }

  // Map to JobMatch
  const matches: JobMatch[] = allListings.map((job) => ({
    job,
    compatibility: resume ? computeCompatibility(job, resume) : null,
  }));

  // Sort by compatibility score if resume provided, else preserve order
  if (resume) {
    matches.sort((a, b) => (b.compatibility?.score ?? 0) - (a.compatibility?.score ?? 0));
  }

  // Filter by minScore if provided
  const filteredMatches = request.minScore != null
    ? matches.filter((m) => (m.compatibility?.score ?? 0) >= (request.minScore ?? 0))
    : matches;

  let message: string | null = null;
  if (filteredMatches.length === 0) {
    message = "No matching jobs found from active sources matching the given criteria.";
  }

  return {
    matches: filteredMatches.slice(0, 30),
    sources,
    message,
  };
}
