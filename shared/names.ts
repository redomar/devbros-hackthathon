export const NAME_MAX_LENGTH = 20;

export function normaliseName(raw: string): string {
  return raw.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-GB");
}

/** Tidies spacing and capitalises the first letter, keeping the rest as typed. */
export function tidyName(raw: string): string {
  const trimmed = raw.normalize("NFKC").trim().replace(/\s+/g, " ");
  return trimmed.charAt(0).toLocaleUpperCase("en-GB") + trimmed.slice(1);
}

/** Returns an error message, or null when the name is acceptable. */
export function validateFirstName(raw: string): string | null {
  const name = tidyName(raw);
  if (name.length === 0) return "Please enter your first name.";
  if (name.length > NAME_MAX_LENGTH) return `Please keep it under ${NAME_MAX_LENGTH} characters.`;
  // Letters (any script), spaces, hyphens and apostrophes. A space allows "Ali K" when names collide.
  if (!/^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u.test(name)) {
    return "Letters only, please. First name or nickname.";
  }
  if (name.split(" ").length > 2) return "First name only, please. No surnames needed.";
  return null;
}
