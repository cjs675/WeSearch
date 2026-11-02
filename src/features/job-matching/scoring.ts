import type { CompatibilityScore, EducationLevel, Qualification, ScoreComponent, TransferableSkill } from "@/types";
import { canonicalSkills, type MatchProfile } from "./profile";
import type { SourceJob } from "./sources/types";
import { ENTRY_LEVEL_TERMS, SENIOR_TITLE_TERMS, TRANSFERABLE_CATEGORIES, TRANSFERABLE_SKILLS, TYPICAL_SKILLS } from "./taxonomy";
import { hasAny, norm } from "./text";

const SKILL_MAX = 45;
const EXPERIENCE_MAX = 25;
const LEVEL_MAX = 15;
const QUALIFICATION_MAX = 15;
const TRANSFERABLE_CREDIT = 0.6;
const TYPICAL_WEIGHT = 0.5;
const MISSING_PENALTY = 8;

const REQUIRED_RE = /\b(required|requires?|must|mandatory|minimum|need to have|needed)\b/i;
const OPTIONAL_RE = /\b(preferred|a plus|nice to have|desired|bonus|helpful|not required)\b/i;
const AFTER_HIRE_RE = /\b(will train|we will help|after hire|upon hire|within \d+ days|obtain(ed)? (after|within)|provided by)\b/i;
const YEARS_RE = /\b(\d{1,2})\s*\+?\s*(?:-|to)?\s*(?:\d{1,2})?\s*\+?\s*years?\b[^.;]{0,40}\bexperience\b/gi;

/** satisfiedBy is what on the resume meets it. Null means a resume can't tell us. */
const QUALIFICATIONS: { label: string; pattern: RegExp; satisfiedBy: string[] | null }[] = [
  { label: "Commercial driver's license (CDL)", pattern: /\bcdl\b|commercial driver/i, satisfiedBy: ["cdl"] },
  { label: "Driver's license", pattern: /driver'?s?'? licen[sc]e/i, satisfiedBy: ["drivers license", "cdl"] },
  { label: "Registered nurse license", pattern: /\brn licen[sc]e|registered nurse licen[sc]e|licensed registered nurse/i, satisfiedBy: ["rn"] },
  { label: "CNA certification", pattern: /\bcna\b (?:certification|licen[sc]e)|certified nurs(?:e|ing) assistant/i, satisfiedBy: ["cna"] },
  { label: "LPN license", pattern: /\blpn licen[sc]e|licensed practical nurse/i, satisfiedBy: ["lpn"] },
  { label: "Security guard license", pattern: /guard (?:card|licen[sc]e)|security licen[sc]e/i, satisfiedBy: ["guard card"] },
  { label: "CPR / first aid certification", pattern: /\bcpr\b|\bbls\b certif/i, satisfiedBy: ["cpr"] },
  { label: "Food handler card", pattern: /food handler|servsafe/i, satisfiedBy: ["food handler", "servsafe"] },
  { label: "Forklift certification", pattern: /forklift certif|certified forklift/i, satisfiedBy: ["forklift certified"] },
  { label: "Security clearance", pattern: /security clearance|secret clearance/i, satisfiedBy: null },
  { label: "Work authorization", pattern: /authorized to work|work authorization|u\.?s\.? citizen/i, satisfiedBy: null },
  { label: "Minimum age", pattern: /\b(?:1[6-9]|21) years? of age|at least (?:1[6-9]|21)\b/i, satisfiedBy: null },
];

const DEGREES: { level: EducationLevel; label: string; rank: number; pattern: RegExp }[] = [
  { level: "doctorate", label: "Doctorate", rank: 5, pattern: /\b(ph\.?d|doctorate)\b/i },
  { level: "master", label: "Master's degree", rank: 4, pattern: /\bmaster'?s?\b/i },
  { level: "bachelor", label: "Bachelor's degree", rank: 3, pattern: /\bbachelor'?s?\b|\bb\.?s\.?\/b\.?a\.?\b/i },
  { level: "associate", label: "Associate degree", rank: 2, pattern: /\bassociate'?s? degree\b/i },
  { level: "high_school", label: "High school diploma or GED", rank: 1, pattern: /\bhigh school (diploma|education)|\bged\b/i },
];
const rankOf = (level: EducationLevel) => DEGREES.find((d) => d.level === level)?.rank ?? 0;

function sentences(text: string): string[] {
  return text.split(/[\n•]+|[.!?;]\s+/).map((s) => s.trim()).filter(Boolean);
}

export function isEntryLevel(job: SourceJob): boolean {
  const title = norm(job.title);
  return (
    job.level === "entry" ||
    job.level === "internship" ||
    job.jobType === "internship" ||
    hasAny(norm(`${job.title} ${job.description}`), ENTRY_LEVEL_TERMS) ||
    hasAny(title, ["intern", "internship", "apprentice", "trainee", "junior"])
  );
}

export function isSenior(job: SourceJob): boolean {
  return job.level === "senior" || hasAny(norm(job.title), SENIOR_TITLE_TERMS);
}

export function requiredYears(job: SourceJob): number | null {
  const years: number[] = [];
  for (const sentence of sentences(job.description)) {
    if (OPTIONAL_RE.test(sentence) || AFTER_HIRE_RE.test(sentence)) continue;
    for (const match of sentence.matchAll(YEARS_RE)) years.push(Number(match[1]));
  }
  return years.length ? Math.min(...years) : null;
}

/** Requirements the posting states. Nothing here removes a job. */
export function extractQualifications(job: SourceJob, profile: MatchProfile): Qualification[] {
  const found = new Map<string, Qualification>();
  const add = (qualification: Qualification) => {
    if (!found.has(qualification.label)) found.set(qualification.label, qualification);
  };
  for (const sentence of sentences(job.description)) {
    if (!REQUIRED_RE.test(sentence) || OPTIONAL_RE.test(sentence)) continue;
    const canGetAfterHire = AFTER_HIRE_RE.test(sentence);
    const evidence = sentence.slice(0, 180);
    for (const { label, pattern, satisfiedBy } of QUALIFICATIONS) {
      if (!pattern.test(sentence)) continue;
      const status = satisfiedBy === null ? "check_yourself" : satisfiedBy.some((c) => profile.certifications.includes(c)) ? "met" : "missing";
      add({ label, status, evidence, canGetAfterHire });
    }
    const degree = DEGREES.find((d) => d.pattern.test(sentence));
    if (degree) {
      const atLevel = profile.education.filter((e) => rankOf(e.level) >= degree.rank);
      const status = atLevel.some((e) => !e.inProgress) ? "met" : atLevel.length ? "in_progress" : "missing";
      add({ label: degree.label, status, evidence, canGetAfterHire });
    }
  }
  return [...found.values()];
}

function skillComponent(job: SourceJob, profile: MatchProfile) {
  const stated = canonicalSkills(`${job.title} ${job.description}`);
  const typical = [...new Set(job.categories.flatMap((c) => TYPICAL_SKILLS[c]))].filter((s) => !stated.includes(s));
  const matched: string[] = [];
  const missing: string[] = [];
  const transferable: TransferableSkill[] = [];
  let earned = 0;
  let possible = 0;
  for (const [skills, weight] of [[stated, 1], [typical, TYPICAL_WEIGHT]] as const) {
    for (const skill of skills) {
      possible += weight;
      if (profile.skills.includes(skill)) {
        earned += weight;
        matched.push(skill);
        continue;
      }
      const bridge = profile.skills.find((have) => TRANSFERABLE_SKILLS[have]?.[skill]);
      if (bridge) {
        earned += weight * TRANSFERABLE_CREDIT;
        transferable.push({ have: bridge, countsToward: skill, explanation: TRANSFERABLE_SKILLS[bridge][skill] });
      } else {
        missing.push(skill);
      }
    }
  }
  const points = possible ? Math.round((SKILL_MAX * earned) / possible) : Math.round(SKILL_MAX / 2);
  const explanation = possible
    ? `${matched.length} direct and ${transferable.length} transferable matches out of ${stated.length + typical.length} skills (${stated.length} stated by the posting, ${typical.length} typical for the role).`
    : "The posting text names no skills we recognize, so this is a neutral half score.";
  return { points, explanation, matched, missing, transferable, typical };
}

function experienceComponent(job: SourceJob, profile: MatchProfile): [number, string] {
  const same = job.categories.find((c) => profile.workCategories.includes(c));
  if (same) return [EXPERIENCE_MAX, `You have worked in ${same}.`];
  for (const own of profile.workCategories) {
    const near = job.categories.find((c) => TRANSFERABLE_CATEGORIES[own].includes(c));
    if (near) return [Math.round(EXPERIENCE_MAX * 0.6), `Your ${own} experience transfers to ${near}.`];
  }
  if (!profile.hasExperience) {
    return isEntryLevel(job)
      ? [Math.round(EXPERIENCE_MAX * 0.4), "No work history yet, but this posting is open to beginners."]
      : [0, "No work history on the resume, and this posting doesn't say it's open to beginners."];
  }
  return [Math.round(EXPERIENCE_MAX * 0.2), "Your past roles are in a different field; you may still qualify."];
}

function levelComponent(job: SourceJob, profile: MatchProfile): [number, string] {
  const need = requiredYears(job);
  const have = profile.yearsExperience;
  if (need === null && isEntryLevel(job)) return [LEVEL_MAX, "Entry-level or will-train."];
  if (need !== null) {
    const points = have >= need || need === 0 ? LEVEL_MAX : Math.round((LEVEL_MAX * have) / need);
    return [points, `Asks for ${need}+ years; you have about ${have}.`];
  }
  if (isSenior(job)) return [have >= 3 ? LEVEL_MAX : 3, "Senior or management title, with no stated years requirement."];
  return [Math.round((LEVEL_MAX * 2) / 3), "No experience requirement found in the text we received."];
}

function qualificationComponent(qualifications: Qualification[]): [number, string] {
  const counted = qualifications.filter((q) => q.status === "missing" && !q.canGetAfterHire);
  const points = Math.max(0, QUALIFICATION_MAX - MISSING_PENALTY * counted.length);
  if (counted.length) return [points, `Missing: ${counted.map((q) => q.label).join(", ")}.`];
  if (qualifications.length) return [points, "No required qualifications missing, though some need checking."];
  return [points, "No mandatory qualifications found in the text we received."];
}

export function scoreJob(job: SourceJob, profile: MatchProfile): CompatibilityScore {
  const skills = skillComponent(job, profile);
  const [experiencePoints, experienceText] = experienceComponent(job, profile);
  const [levelPoints, levelText] = levelComponent(job, profile);
  const qualifications = extractQualifications(job, profile);
  const [qualificationPoints, qualificationText] = qualificationComponent(qualifications);
  const components: ScoreComponent[] = [
    { name: "Skills", points: skills.points, maxPoints: SKILL_MAX, explanation: skills.explanation },
    { name: "Experience", points: experiencePoints, maxPoints: EXPERIENCE_MAX, explanation: experienceText },
    { name: "Level fit", points: levelPoints, maxPoints: LEVEL_MAX, explanation: levelText },
    { name: "Qualifications", points: qualificationPoints, maxPoints: QUALIFICATION_MAX, explanation: qualificationText },
  ];
  return {
    score: components.reduce((sum, c) => sum + c.points, 0),
    components,
    matchedSkills: skills.matched,
    transferableSkills: skills.transferable,
    missingSkills: skills.missing,
    skillsTypicalForRole: skills.typical,
    qualifications,
  };
}
