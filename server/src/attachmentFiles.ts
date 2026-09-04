import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Attachment storage helpers (api-spec: Security and Validation Notes).
// Files are stored outside the web root under server/uploads with UUID-based
// filenames (never the user-supplied name). The original filename is preserved
// in the database for display only (FR-27, BR-27).

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB (BR-13/FR-25)
export const MAX_ATTACHMENTS = 5; // active (non-removed) attachments (BR-14/FR-26)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.resolve(__dirname, "..", "uploads");

// MIME types accepted for upload (BR-12/FR-24). Verified against the declared
// content type, not just the file extension.
export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

// Deterministic, safe extension derived from the validated content type.
export const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

// Sanitizes a client-supplied filename for safe display/storage. Removes any
// directory components (path-traversal attack) and control characters.
export function sanitizeOriginalFilename(name: string): string {
  const base = path
    .basename(name)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  return base === "" ? "attachment" : base;
}

// Generates a unique storage filename: UUID + extension derived from the
// validated content type. Throws for unrecognized MIME types.
export function buildStoredFilename(contentType: string): string {
  const ext = EXTENSION_BY_MIME[contentType];
  if (!ext) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }
  return `${crypto.randomUUID()}${ext}`;
}

export async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export async function storeFileBuffer(
  buffer: Buffer,
  contentType: string
): Promise<string> {
  await ensureUploadDir();
  const storedFilename = buildStoredFilename(contentType);
  await fs.writeFile(path.join(UPLOAD_DIR, storedFilename), buffer);
  return storedFilename;
}

export async function deleteStoredFile(storedFilename: string): Promise<void> {
  try {
    await fs.unlink(path.join(UPLOAD_DIR, storedFilename));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}