import { buildProfile, canonicalSkills, roleCategories, suggestedCategories, transferableSkills } from "@/features/job-matching/profile";
import { hasAny, norm } from "@/features/job-matching/text";
import type { Education, EducationLevel, Resume, ResumeAnalysis, Skill, WorkExperience } from "@/types";

type Section = "experience" | "education" | "skills" | "projects" | "certifications" | "other";

const HEADERS: [RegExp, Section][] = [
  [/^(work |professional |employment |relevant )?(experience|history|employment)\b/i, "experience"],
  [/^education\b|^academic/i, "education"],
  [/^(technical |core |key )?skills\b|^qualifications\b/i, "skills"],
  [/^(academic |personal |selected )?projects\b/i, "projects"],
  [/^(certifications?|licen[sc]es?)\b/i, "certifications"],
  [/^(summary|objective|profile|activities|awards|honors|references|volunteer|interests)\b/i, "other"],
];
const LEVELS: [EducationLevel, RegExp][] = [
  ["doctorate", /\b(ph\.?d|doctorate)\b/i],
  ["master", /\b(master'?s?|mba|m\.s\.)\b/i],
  ["bachelor", /\b(bachelor'?s?|b\.s\.|b\.a\.|bs in|ba in)\b/i],
  ["associate", /\bassociate'?s?( degree| of)\b/i],
  ["high_school", /\b(high school|ged)\b/i],
];
const KNOWN_CERTS = ["cdl", "cna", "rn", "lpn", "food handler", "servsafe", "forklift certified", "cpr", "guard card", "drivers license"];
const DATE_RANGE = /\b((?:19|20)\d\d)\s*(?:-|–|—|to)\s*((?:19|20)\d\d|present|current|now)\b/i;
const ANY_DATES = /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*)?(?:19|20)\d\d\s*(?:-|–|—|to)\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*)?((?:19|20)\d\d|present|current|now)/i;
const BULLET = /^[•·▪●*\-–]\s*/;

function splitSections(lines: string[]): Record<Section, string[]> {
  const sections: Record<Section, string[]> = { experience: [], education: [], skills: [], projects: [], certifications: [], other: [] };
  let current: Section = "other";
  for (const line of lines) {
    const header = line.length < 45 ? HEADERS.find(([pattern]) => pattern.test(line)) : undefined;
    if (header) current = header[1];
    else sections[current].push(line);
  }
  return sections;
}

function parseExperience(lines: string[], requireDates: boolean): WorkExperience[] {
  const jobs: WorkExperience[] = [];
  let previous: string | null = null;
  for (const line of lines) {
    if (/no (work|employment) (experience|history)/i.test(line)) continue;
    if (BULLET.test(line)) {
      const current = jobs[jobs.length - 1];
      if (current) current.description = `${current.description ?? ""} ${line.replace(BULLET, "")}`.trim();
      continue;
    }
    const range = line.match(DATE_RANGE);
    const isRole = roleCategories(line, line).length > 0;
    if (!range && (!isRole || requireDates)) {
      previous = line;
      continue;
    }
    const withoutDates = line.replace(ANY_DATES, "").replace(/[\s,|•–—-]+$/, "").trim();
    // A date on a line of its own belongs to the title on the line before it
    const text = withoutDates && (isRole || !previous) ? withoutDates : [previous, withoutDates].filter(Boolean).join(", ");
    const [title, ...rest] = text.split(/\s+(?:at|@|-|–|—|\|)\s+|,\s+/);
    const stated = line.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\b/i);
    let years: number | undefined = stated ? Number(stated[1]) : undefined;
    if (range) {
      const end = /^\d/.test(range[2]) ? Number(range[2]) : new Date().getFullYear();
      years = Math.max(end - Number(range[1]), 1);
    }
    jobs.push({ title: title.trim(), employer: rest.join(", ").trim() || undefined, years });
    previous = null;
  }
  return jobs;
}

function parseEducation(sectionLines: string[], allLines: string[]): Education[] {
  const lines = sectionLines.length ? sectionLines : allLines;
  const found: Education[] = [];
  lines.forEach((line, index) => {
    const level = LEVELS.find(([, pattern]) => pattern.test(line))?.[0];
    if (!level || found.some((e) => e.level === level)) return;
    const nearby = [line, lines[index + 1] ?? ""].join(" ");
    found.push({
      level,
      field: line.match(/\b(?:in|of)\s+([A-Z][A-Za-z &]+)/)?.[1]?.trim(),
      institution: [line, lines[index + 1] ?? ""].map((text) => text.match(/[A-Z][\w.' ]*(?:University|College|School|Institute)[\w.' ]*/)?.[0]).find(Boolean)?.trim(),
      inProgress: /\b(expected|anticipated|pursuing|in progress|current(ly)?|present|candidate)\b/i.test(nearby),
    });
  });
  return found;
}

function parseSkills(sectionLines: string[], allText: string, allLines: string[]): Skill[] {
  const evidenceFor = (name: string) => allLines.find((line) => canonicalSkills(line).includes(name))?.slice(0, 160);
  const known: Skill[] = canonicalSkills(allText).map((name) => ({ name, source: "extracted", evidence: evidenceFor(name) }));
  // A listed skill stays even if it isn't one this app already knows
  const listed = sectionLines.flatMap((line) => line.replace(BULLET, "").replace(/^[^:]{1,30}:\s*/, "").split(/[,;|•]/))
    .map((item) => item.trim())
    .filter((item) => item && item.split(/\s+/).length <= 3 && item.length <= 40);
  const seen = new Set(known.map((s) => norm(s.name)));
  for (const item of listed) {
    if (canonicalSkills(item).length || seen.has(norm(item))) continue;
    seen.add(norm(item));
    known.push({ name: item, source: "extracted", evidence: item });
  }
  return known;
}

function parseProjects(lines: string[]): string[] {
  const projects: string[] = [];
  for (const line of lines) {
    if (BULLET.test(line) && projects.length) projects[projects.length - 1] += ` ${line.replace(BULLET, "")}`;
    else projects.push(line.replace(BULLET, ""));
  }
  return projects;
}

/** Reads resume text by rules, with no AI service or API key. Only reports what the text supports. */
export function parseResumeText(text: string): Resume {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const sections = splitSections(lines);
  const normed = norm(text);
  // Without an experience heading, only a dated line outside the other sections is trusted as a job
  const hasHeader = sections.experience.length > 0;
  const experience = parseExperience(hasHeader ? sections.experience : sections.other, !hasHeader);
  const education = parseEducation(sections.education, lines);
  const listedCerts = sections.certifications.map((l) => l.replace(BULLET, ""));
  const certifications = [...listedCerts, ...KNOWN_CERTS.filter((c) => hasAny(normed, [c]) && !listedCerts.some((l) => hasAny(norm(l), [c])))];
  const skills = parseSkills(sections.skills, text, lines);
  return {
    skills,
    experience,
    education,
    certifications,
    projects: parseProjects(sections.projects),
    isStudent: education.some((e) => e.inProgress) || hasAny(normed, ["student", "expected graduation", "currently enrolled"]),
    keywords: [...new Set([...skills.map((s) => s.name), ...experience.map((e) => e.title)])],
  };
}

export function analyzeResumeText(text: string): ResumeAnalysis {
  const resume = parseResumeText(text);
  const profile = buildProfile(resume);
  return { resume, transferableSkills: transferableSkills(profile), suggestedCategories: suggestedCategories(profile) };
}
