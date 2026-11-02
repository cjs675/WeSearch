import type { Resume, Skill, WorkExperience, Education } from "@/types";

const COMMON_SKILLS = [
  "JavaScript", "TypeScript", "Python", "React", "Next.js", "Node.js", "HTML", "CSS", "Tailwind CSS",
  "SQL", "PostgreSQL", "MongoDB", "Docker", "Kubernetes", "AWS", "GCP", "Git", "GitHub", "REST API",
  "GraphQL", "Figma", "UI/UX", "Product Design", "Data Analysis", "Machine Learning", "Communication",
  "Project Management", "Agile", "Scrum", "Customer Service", "Sales", "Leadership"
];

export function extractSkillsFromText(text: string): Skill[] {
  const lower = text.toLowerCase();
  const found: Skill[] = [];

  for (const skill of COMMON_SKILLS) {
    const skillLower = skill.toLowerCase();
    // Word boundary match
    const regex = new RegExp(`\\b${skillLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
    if (regex.test(lower)) {
      found.push({
        name: skill,
        source: "extracted",
        evidence: `Mentioned in submitted background text`,
      });
    }
  }

  return found;
}

export function parseResumeText(rawText: string): Resume {
  const skills = extractSkillsFromText(rawText);

  const experience: WorkExperience[] = [];
  const education: Education[] = [];

  const lower = rawText.toLowerCase();

  // Basic heuristic detection for student status
  const isStudent = lower.includes("student") || lower.includes("expected graduation") || lower.includes("undergraduate");

  if (lower.includes("bachelor") || lower.includes("b.s.") || lower.includes("b.a.")) {
    education.push({
      level: "bachelor",
      field: "Computer Science or Related",
      inProgress: isStudent,
    });
  } else if (lower.includes("master") || lower.includes("m.s.")) {
    education.push({
      level: "master",
      field: "Computer Science or Related",
      inProgress: isStudent,
    });
  }

  if (lower.includes("engineer") || lower.includes("developer") || lower.includes("designer")) {
    experience.push({
      title: "Software / Technical Experience",
      years: 2,
      description: "Extracted from background information",
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
