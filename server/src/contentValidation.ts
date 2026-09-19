// Comment / Note content validation (BR-23, BR-24). Shared by the
// comments/notes create routes and the UNIT-04 unit tests. Content is trimmed,
// then must be 1-2000 characters; whitespace-only input is rejected.

export const CONTENT_MIN_LENGTH = 1;
export const CONTENT_MAX_LENGTH = 2000;

export type ContentValidationResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

// Trims and validates `content`. Returns the trimmed value on success or a
// human-safe error message on failure. A non-string payload is invalid.
export function validateContent(content: unknown): ContentValidationResult {
  if (typeof content !== "string") {
    return { ok: false, message: "Content must be a string" };
  }
  const trimmed = content.trim();
  if (trimmed.length < CONTENT_MIN_LENGTH || trimmed.length > CONTENT_MAX_LENGTH) {
    return {
      ok: false,
      message: `Content must be between ${CONTENT_MIN_LENGTH} and ${CONTENT_MAX_LENGTH} characters`,
    };
  }
  return { ok: true, value: trimmed };
}