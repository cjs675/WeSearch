const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? whole;
    const value = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : whole;
  });
}

/** Lowercase and flatten text so "McDonald's" == "mcdonalds" and "part-time" == "part time". */
export function norm(text: string | null | undefined): string {
  return decodeEntities(text ?? "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim();
}

/** Plain text from HTML. Block endings become line breaks so requirements stay in separate sentences. */
export function stripHtml(text: string | null | undefined): string {
  return decodeEntities(text ?? "")
    .replace(/<\/(p|li|div|ul|ol|h[1-6])>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** Whole-word match on normalized text, so "intern" never matches "internal". */
export function hasTerm(normedText: string, term: string): boolean {
  const padded = ` ${normedText} `;
  return padded.includes(` ${term} `) || padded.includes(` ${term}s `);
}

export function hasAny(normedText: string, terms: readonly string[] | undefined): boolean {
  return (terms ?? []).some((term) => hasTerm(normedText, term));
}

/** The link if it is safe to show, otherwise null. */
export function safeUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const { protocol, href } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? href : null;
  } catch {
    return null;
  }
}
