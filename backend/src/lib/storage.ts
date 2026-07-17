// Basic local file storage for uploaded materials (Step 1 item 5).
// Swappable for S3/GCS later — the rest of the app only calls saveUpload().
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
// backend/uploads (gitignored)
const UPLOAD_ROOT = join(here, "..", "..", "uploads");

export interface SavedFile {
  storagePath: string;
  sizeBytes: number;
}

export async function saveUpload(
  userId: string,
  originalName: string,
  data: Buffer
): Promise<SavedFile> {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const dir = join(UPLOAD_ROOT, userId);
  await mkdir(dir, { recursive: true });
  const storagePath = join(dir, `${randomUUID()}-${safeName}`);
  await writeFile(storagePath, data);
  return { storagePath, sizeBytes: data.length };
}

// File types we accept (blueprint: PDF/DOCX/PPTX only).
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
]);
