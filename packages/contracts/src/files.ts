/**
 * File contracts (06-Database-Design.md section 5.2, BR-15, BR-16).
 *
 * Files exist in exactly three contexts (BR-16) — deliverable versions, task
 * attachments, and project files — and the same `FileRef` shape describes all
 * three. `storageKey` is deliberately ABSENT from every shape here: it is the
 * Cloudinary identifier, and exposing it would hand out a URL that bypasses
 * the permission check on download (ADR-0003, FR-056).
 */

/** BR-15 — the allow-list, lowercase, without the dot. */
export const ALLOWED_FILE_EXTENSIONS = [
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'svg',
  'docx',
  'xlsx',
  'pptx',
  'zip',
] as const;
export type AllowedFileExtension = (typeof ALLOWED_FILE_EXTENSIONS)[number];

/** BR-15 — 20 MB, in bytes. */
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

/**
 * The MIME type each extension must actually be, verified server-side.
 *
 * The client-declared type is not trusted (NFR-24): a browser will happily
 * label an executable `application/pdf`. These are the types the server
 * accepts AFTER inspecting the bytes.
 */
export const EXTENSION_MIME_TYPES: Readonly<Record<AllowedFileExtension, readonly string[]>> = {
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  svg: ['image/svg+xml'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  zip: ['application/zip', 'application/x-zip-compressed'],
} as const;

/** A stored file as exposed to a client. Never carries `storageKey`. */
export interface FileRefView {
  id: string;
  originalName: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  uploadedAt: string;
}

export const FILE_LIMITS = {
  ORIGINAL_NAME_MAX: 255,
  /** P-9 — bounded, which is what makes embedding the refs safe. */
  MAX_FILES_PER_VERSION: 20,
  MAX_ATTACHMENTS_PER_TASK: 20,
} as const;
