/**
 * Shared skill vocabulary used by resume analysis (to extract skills) and
 * job matching (to detect skills a posting asks for). Matching is
 * case-insensitive and word-boundary based, so vague names like "Go" or "R"
 * that match ordinary prose are left out on purpose.
 */
export const COMMON_SKILLS = [
  "JavaScript", "TypeScript", "Python", "Java", "PHP", "Ruby", "C#", "C++", "Swift", "Kotlin",
  "React", "Next.js", "Node.js", "Express", "Django", "Flask", "Rails",
  "HTML", "CSS", "Tailwind CSS", "Sass", "REST API", "GraphQL",
  "PostgreSQL", "MySQL", "MongoDB", "Redis",
  "Docker", "Kubernetes", "AWS", "GCP", "Azure", "Git", "GitHub", "CI/CD", "Linux",
  "Figma", "UI/UX", "Product Design", "Photoshop", "Illustrator",
  "Data Analysis", "Machine Learning", "Pandas",
  "Communication", "Project Management", "Agile", "Scrum", "Leadership",
  "Customer Service", "Sales", "Marketing", "Time Management", "Teamwork",
] as const;

/** Escape special regex characters in an arbitrary string (skill names, keywords). */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Names of every known skill literally mentioned in the text. */
export function findSkillNames(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const skill of COMMON_SKILLS) {
    const regex = new RegExp(`\\b${escapeRegExp(skill.toLowerCase())}\\b`, "i");
    if (regex.test(text)) {
      found.push(skill);
    }
  }
  return found;
}
