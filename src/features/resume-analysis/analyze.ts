import type { Resume, Skill, WorkExperience, Education } from "@/types";
import { findSkillNames } from "@/lib/skills";

/** Skills mentioned in the submitted text. Only what the text supports. */
export function extractSkillsFromText(text: string): Skill[] {
  return findSkillNames(text).map((name) => ({
    name,
    source: "extracted" as const,
    evidence: "Mentioned in submitted background text",
  }));
}

// Ordered from the highest degree first; the first pattern that matches wins,
// so a resume mentioning both a bachelor and a master reports the master.
const DEGREE_PATTERNS: Array<{ level: Education["level"]; re: RegExp }> = [
  { level: "doctorate", re: /\b(doctorate|ph\.?d|dphil)\b/i },
  { level: "master", re: /\b(master(?:'?s)|mba|msc\b|m\.s\.)\b/i },
  { level: "bachelor", re: /\b(bachelor(?:'?s)?|bsc\b|b\.s\.|b\.a\.|b(?:\.\s?)?s\b)\b/i },
  { level: "associate", re: /\b(associate(?:'?s)? (?:degree|of)|a\.a\.|a\.s\.)\b/i },
  { level: "high_school", re: /\b(high school|ged)\b/i },
];

const FIELD_PATTERNS = [
  "computer science", "software engineering", "information technology", "computer engineering",
  "data science", "mathematics", "engineering", "design", "business", "marketing",
  "finance", "accounting", "nursing", "psychology", "education", "communications",
];

const FIELD_RE = new RegExp(FIELD_PATTERNS.join("|"), "i");

/** Occupations that imply real work history when no explicit "years" figure exists. */
const EXPERIENCE_HINTS =
  /\b(engineer|developer|designer|manager|analyst|administrator|coordinator|technician|nurse|nursing|teacher|accountant|electrician|plumber|welder|mechanic|driver|cashier|bartender|barista|chef|cook|sales|customer service|support|warehouse|operator|specialist|consultant|supervisor|receptionist|clerk|paralegal|writer|editor)\b/i;

const YEARS_RE = /(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/gi;

function extractMaxYears(text: string): number | undefined {
  let max: number | undefined;
  let match: RegExpExecArray | null;
  YEARS_RE.lastIndex = 0;
  while ((match = YEARS_RE.exec(text)) !== null) {
    const value = parseFloat(match[1]);
    if (Number.isFinite(value) && (max === undefined || value > max)) {
      max = value;
    }
  }
  // The supported maximum keeps a stray number from dominating the score.
  return max === undefined ? undefined : Math.min(max, 45);
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseResumeText(rawText: string): Resume {
  const text = rawText || "";
  const lower = text.toLowerCase();
  const skills = extractSkillsFromText(text);

  const experience: WorkExperience[] = [];
  const education: Education[] = [];

  const isStudent = /\bstudent\b|expected graduation|undergraduate/.test(lower);

  for (const { level, re } of DEGREE_PATTERNS) {
    if (re.test(lower)) {
      const fieldMatch = lower.match(FIELD_RE);
      education.push({
        level,
        field: fieldMatch ? titleCase(fieldMatch[0]) : undefined,
        inProgress: isStudent,
      });
      break;
    }
  }

  // Years of experience only when the text states them; never invented.
  const years = extractMaxYears(text);
  if (years !== undefined || EXPERIENCE_HINTS.test(lower)) {
    experience.push({
      title: "Professional experience",
      ...(years !== undefined ? { years } : {}),
      description: "Inferred from the text you pasted. Edit or remove it if it isn't accurate.",
    });
  }

  return {
    skills,
    experience,
    education,
    certifications: [],
    isStudent,
  };
}
