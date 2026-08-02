import {
  ALLOWED_FILE_EXTENSIONS,
  EXTENSION_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  type AllowedFileExtension,
} from '@agencyflow/contracts';

/**
 * Server-side file validation (BR-15, NFR-24, FR-055).
 *
 * **The client-declared MIME type is not trusted.** A browser sends whatever
 * the operating system associates with the extension, and an attacker sends
 * whatever they like — `Content-Type: application/pdf` on an executable costs
 * nothing. So the bytes are inspected.
 *
 * This is not a virus scanner and does not pretend to be. What it guarantees
 * is narrower and still worth having: the file is one of the nine types BR-15
 * permits, its extension matches its actual contents, and it is within 20 MB.
 */

export interface ValidatedFile {
  extension: AllowedFileExtension;
  /** Derived from the CONTENT, not from what the client declared. */
  mimeType: string;
  sizeBytes: number;
  originalName: string;
}

export type FileRejectionReason =
  'EMPTY' | 'TOO_LARGE' | 'EXTENSION_NOT_ALLOWED' | 'CONTENT_MISMATCH';

export type FileValidationResult =
  { ok: true; file: ValidatedFile } | { ok: false; reason: FileRejectionReason; detail?: string };

/**
 * Magic numbers, checked against the first bytes of the buffer.
 *
 * ZIP is the interesting case: `docx`, `xlsx`, `pptx` and `zip` are all ZIP
 * containers, so all four share the same signature. Telling an Office document
 * from a plain archive would mean parsing the container, which buys nothing
 * here — all four are on the allow-list, so a mislabelled one is still a
 * permitted type.
 */
const SIGNATURES: Record<string, readonly number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]], // %PDF
  png: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  jpg: [[0xff, 0xd8, 0xff]],
  jpeg: [[0xff, 0xd8, 0xff]],
  zip: [
    [0x50, 0x4b, 0x03, 0x04],
    // Empty and spanned archives. An empty .zip is unusual but valid, and
    // rejecting it would be a confusing failure with no security benefit.
    [0x50, 0x4b, 0x05, 0x06],
    [0x50, 0x4b, 0x07, 0x08],
  ],
};

/** The ZIP-container formats, which share ZIP's signature. */
const ZIP_CONTAINERS = new Set(['docx', 'xlsx', 'pptx', 'zip']);

function startsWith(buffer: Buffer, signature: readonly number[]): boolean {
  if (buffer.length < signature.length) {
    return false;
  }

  return signature.every((byte, index) => buffer[index] === byte);
}

/**
 * SVG has no magic number — it is XML.
 *
 * Checked structurally instead: the root element must be `<svg`, allowing a
 * leading XML declaration, a doctype, comments or whitespace. Only the head of
 * the file is examined; a valid SVG declares itself early, and scanning a
 * whole 20 MB buffer to be convinced would be a denial-of-service vector of
 * its own.
 */
function looksLikeSvg(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 1024).toString('utf8').trimStart();

  const withoutPreamble = head
    .replace(/^<\?xml[^>]*\?>/i, '')
    .replace(/^<!doctype[^>]*>/i, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trimStart();

  return withoutPreamble.toLowerCase().startsWith('<svg');
}

/** Lowercased extension, without the dot. Empty when there is none. */
export function extensionOf(filename: string): string {
  const index = filename.lastIndexOf('.');
  return index === -1 ? '' : filename.slice(index + 1).toLowerCase();
}

/**
 * Strips anything that could make a filename behave as something other than a
 * label.
 *
 * The name is only ever echoed back to a user — ADR-0003 addresses storage by
 * an opaque `storageKey`, never by name — but a name carrying `../`, a path
 * separator or a newline is a trap laid for whatever handles it next: a
 * `Content-Disposition` header, a log line, a future export.
 */
export function sanitiseFilename(filename: string): string {
  return (
    filename
      // Control characters and DEL. A newline in a filename becomes header
      // injection the moment that name reaches a Content-Disposition.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/[/\\]/g, '_')
      // `..` collapses to `.`, so no traversal sequence survives.
      .replace(/\.{2,}/g, '.')
      .trim()
      .slice(0, 255)
  );
}

/**
 * Validates an upload.
 *
 * `_declaredMimeType` is accepted and then deliberately DISCARDED. It stays in
 * the signature so that the discarding is visible at every call site: the type
 * the client sent plays no part in the decision, which is exactly what NFR-24
 * requires. The returned `mimeType` comes from the allow-list, keyed by the
 * verified extension.
 */
export function validateFile(
  buffer: Buffer,
  originalName: string,
  _declaredMimeType: string,
): FileValidationResult {
  if (buffer.length === 0) {
    return { ok: false, reason: 'EMPTY' };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return { ok: false, reason: 'TOO_LARGE', detail: String(buffer.length) };
  }

  const extension = extensionOf(originalName);

  if (!ALLOWED_FILE_EXTENSIONS.includes(extension as AllowedFileExtension)) {
    return { ok: false, reason: 'EXTENSION_NOT_ALLOWED', detail: extension || '-' };
  }

  const allowed = extension as AllowedFileExtension;

  if (!contentMatches(buffer, allowed)) {
    return { ok: false, reason: 'CONTENT_MISMATCH', detail: allowed };
  }

  // Taken from the allow-list, keyed by the verified extension, never from the
  // request — so no client-supplied string reaches storage or a header.
  const [canonical] = EXTENSION_MIME_TYPES[allowed];

  return {
    ok: true,
    file: {
      extension: allowed,
      mimeType: canonical,
      sizeBytes: buffer.length,
      originalName: sanitiseFilename(originalName),
    },
  };
}

function contentMatches(buffer: Buffer, extension: AllowedFileExtension): boolean {
  if (extension === 'svg') {
    return looksLikeSvg(buffer);
  }

  if (ZIP_CONTAINERS.has(extension)) {
    return SIGNATURES.zip.some((signature) => startsWith(buffer, signature));
  }

  const signatures = SIGNATURES[extension];

  return signatures ? signatures.some((signature) => startsWith(buffer, signature)) : false;
}
