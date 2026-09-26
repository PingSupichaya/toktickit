// Email normalization (BR-13). Emails are normalized to lowercase before any
// uniqueness or lookup so `Alice.John@...` and `alice.john@...` are the same
// account.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}