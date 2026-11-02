/** "extracted" came from the resume analysis; "manual" was added or edited by the user. */
export type SkillSource = "extracted" | "manual";

export interface Skill {
  name: string;
  source: SkillSource;
  /** Text from the resume that supports this skill. Absent for manual skills. */
  evidence?: string;
}
