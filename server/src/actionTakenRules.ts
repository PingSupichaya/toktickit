// Lab 4 Action Taken pure rules (docs/lab-04/specification.md BR-03..BR-06,
// BR-12, D-01, D-09). Shared by the actions routes (app.ts §4.1–§4.3) and the
// UNIT-02 / UNIT-03 unit tests. All string inputs are trimmed before
// validation (BR-19); the backend never accepts Performed By from the client.

export const ACTION_TEXT_MIN_LENGTH = 1;
export const ACTION_TEXT_MAX_LENGTH = 2000;
export const FOLLOW_UP_NOTE_MAX_LENGTH = 1000;
export const ATTACHMENT_NOTES_MAX_LENGTH = 500;

// Clock-skew tolerance for the actionAt future-date guard (BR-06): a client
// clock up to 5 minutes ahead of the server is accepted; anything further in
// the future is rejected with 400 ACTION_AT_IN_FUTURE.
export const ACTION_AT_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export type BoundedTextResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

// Trims `value` and enforces [min, max] length. Non-string input is invalid.
export function validateBoundedText(
  value: unknown,
  min: number,
  max: number
): BoundedTextResult {
  if (typeof value !== "string") {
    return { ok: false, message: `Must be a string of ${min}–${max} characters` };
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    return {
      ok: false,
      message: `Must be between ${min} and ${max} characters`,
    };
  }
  return { ok: true, value: trimmed };
}

export type FollowUpNormalization =
  | { note: string | null }
  | { error: "FOLLOW_UP_NOTE_REQUIRED" };

// BR-04: a note is required (1–1000 chars after trim) only when follow-up is
// required. When it is not required, any supplied value is auto-cleared to
// null instead of rejected, so untoggling after typing never causes a 400.
export function normalizeFollowUpNote(
  followUpRequired: boolean,
  followUpNote: unknown
): FollowUpNormalization {
  if (!followUpRequired) return { note: null };
  if (typeof followUpNote !== "string") {
    return { error: "FOLLOW_UP_NOTE_REQUIRED" };
  }
  const trimmed = followUpNote.trim();
  if (
    trimmed.length < ACTION_TEXT_MIN_LENGTH ||
    trimmed.length > FOLLOW_UP_NOTE_MAX_LENGTH
  ) {
    return { error: "FOLLOW_UP_NOTE_REQUIRED" };
  }
  return { note: trimmed };
}

export type ActionAtParseResult =
  | { ok: true; date: Date }
  | { ok: false; message: string };

// Parses the client-supplied UTC ISO-8601 work time. Validity only — the
// future-date guard is evaluated separately so callers can return the
// dedicated ACTION_AT_IN_FUTURE code.
export function parseActionAt(value: unknown): ActionAtParseResult {
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false, message: "Action date/time is required" };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, message: "Action date/time must be a valid ISO-8601 timestamp" };
  }
  return { ok: true, date };
}

// BR-06 future guard: true when `date` is more than the tolerance ahead of
// `nowMs`. Past values (backdated logging) always pass.
export function isActionAtTooFarInFuture(
  date: Date,
  nowMs: number = Date.now(),
  toleranceMs: number = ACTION_AT_FUTURE_TOLERANCE_MS
): boolean {
  return date.getTime() - nowMs > toleranceMs;
}

// BR-12 / D-01 optimistic-concurrency comparator: strict equality against the
// stored integer version. Matching → proceed; anything else → 409
// STALE_UPDATE with no side effects. A non-integer submission is treated as
// stale here; the route reports a missing/non-integer `version` as 400 first.
export function isStaleVersion(submitted: unknown, current: number): boolean {
  return submitted !== current;
}
