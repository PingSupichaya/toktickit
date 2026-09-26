// CSRF origin-check helper (§1, UNIT-05). SameSite=Lax is the first line of
// defense; state-changing requests that carry a session must also present an
// `Origin` (fallback `Referer`) header that matches a trusted origin.

const DEFAULT_TRUSTED_ORIGINS =
  "http://localhost:5173,http://127.0.0.1:5173";

// Comma-separated list of allowed browser origins (the Vite dev server).
// Override with `TRUSTED_ORIGINS` in server/.env.
export function getTrustedOrigins(): string[] {
  return (process.env.TRUSTED_ORIGINS ?? DEFAULT_TRUSTED_ORIGINS)
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

// Reduces a full URL (e.g. a Referer that includes a path) to its origin.
function extractOrigin(header: string): string | null {
  try {
    return new URL(header).origin;
  } catch {
    return null;
  }
}

export function originIsAllowed(
  originHeader: string | undefined,
  refererHeader: string | undefined,
  trustedOrigins: readonly string[]
): boolean {
  const raw = originHeader ?? refererHeader;
  if (!raw) return false;
  const candidate = extractOrigin(raw);
  if (!candidate) return false;
  const normalized = candidate.toLowerCase();
  return trustedOrigins.some((origin) => origin.toLowerCase() === normalized);
}