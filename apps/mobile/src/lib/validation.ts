/** Minimal email check before hitting Clerk (clearer UX than "Identifier is invalid"). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(raw: string): boolean {
  const email = raw.trim().toLowerCase();
  if (email.length < 5) return false;
  return EMAIL_RE.test(email);
}
