import type { Education, JobCategory, Resume, TransferableSkill } from "@/types";
import { CATEGORIES, CATEGORY_NAMES, SKILLS, STUDENT_CATEGORIES, TRANSFERABLE_CATEGORIES, TRANSFERABLE_SKILLS } from "./taxonomy";
import { hasAny, norm } from "./text";

/** A resume reduced to what matching needs. */
export interface MatchProfile {
  skills: string[];
  certifications: string[];
  education: Education[];
  workCategories: JobCategory[];
  hasExperience: boolean;
  yearsExperience: number;
  roles: { title: string; categories: JobCategory[] }[];
  projects: string[];
}

export function canonicalSkills(text: string | null | undefined): string[] {
  const normed = norm(text);
  return Object.keys(SKILLS).filter((skill) => hasAny(normed, SKILLS[skill].map(norm)));
}

/** Which categories a past job title belongs to. */
export function roleCategories(title: string, employer = ""): JobCategory[] {
  const titleNorm = norm(title);
  const employerNorm = norm(employer);
  return CATEGORY_NAMES.filter((name) => {
    const category = CATEGORIES[name];
    if (hasAny(titleNorm, category.exclude)) return false;
    const context = category.contextTitles;
    return (
      hasAny(titleNorm, category.titles) ||
      hasAny(employerNorm, category.employers) ||
      (context !== undefined && hasAny(titleNorm, context.titles) && hasAny(`${titleNorm} ${employerNorm}`, context.context))
    );
  });
}

export function buildProfile(resume: Resume): MatchProfile {
  const experience = resume.experience ?? [];
  const skills = new Set<string>();
  for (const skill of resume.skills ?? []) {
    const known = canonicalSkills(skill.name);
    (known.length ? known : [norm(skill.name)]).forEach((name) => skills.add(name));
  }
  for (const job of experience) {
    canonicalSkills(`${job.title} ${job.description ?? ""}`).forEach((name) => skills.add(name));
  }
  for (const project of resume.projects ?? []) canonicalSkills(project).forEach((name) => skills.add(name));
  return {
    roles: experience.map((job) => ({ title: job.employer ? `${job.title}, ${job.employer}` : job.title, categories: roleCategories(job.title, job.employer) })),
    projects: resume.projects ?? [],
    skills: [...skills].sort(),
    certifications: (resume.certifications ?? []).map(norm),
    education: resume.education ?? [],
    workCategories: [...new Set(experience.flatMap((job) => roleCategories(job.title, job.employer)))],
    hasExperience: experience.length > 0,
    // A role with no stated length counts as one year rather than being guessed from nothing or ignored.
    yearsExperience: experience.reduce((sum, job) => sum + (job.years ?? 1), 0),
  };
}

/** Categories to search when the user picks none: their own, then ones their skills transfer to. */
export function suggestedCategories(profile: MatchProfile): JobCategory[] {
  const suggested = [...profile.workCategories];
  for (const category of profile.workCategories) suggested.push(...TRANSFERABLE_CATEGORIES[category]);
  if (!profile.hasExperience) suggested.push(...STUDENT_CATEGORIES);
  return [...new Set(suggested)];
}

/** What the skills on a resume also count toward, for showing the applicant. */
export function transferableSkills(profile: MatchProfile): TransferableSkill[] {
  return profile.skills.flatMap((have) =>
    Object.entries(TRANSFERABLE_SKILLS[have] ?? {})
      .filter(([target]) => !profile.skills.includes(target))
      .map(([countsToward, explanation]) => ({ have, countsToward, explanation })));
}
