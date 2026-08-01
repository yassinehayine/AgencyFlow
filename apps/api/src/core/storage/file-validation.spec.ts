import { MAX_FILE_SIZE_BYTES } from '@agencyflow/contracts';

import { extensionOf, sanitiseFilename, validateFile } from './file-validation';

/**
 * BR-15 and NFR-24 — the upload boundary.
 *
 * Everything a user can put into this system that is not a form field arrives
 * through here, so the tests are written adversarially: the interesting cases
 * are not "does a PDF work" but "does a file that CLAIMS to be a PDF work".
 */
const PDF = Buffer.from('%PDF-1.4\nhello');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]);
const SVG = Buffer.from('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>');
const EXECUTABLE = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ — a Windows PE

describe('BR-15 — the allow-list', () => {
  it.each([
    ['rapport.pdf', PDF, 'application/pdf'],
    ['logo.png', PNG, 'image/png'],
    ['photo.jpg', JPEG, 'image/jpeg'],
    ['photo.jpeg', JPEG, 'image/jpeg'],
    ['archive.zip', ZIP, 'application/zip'],
    ['icone.svg', SVG, 'image/svg+xml'],
  ])('accepts %s', (name, buffer, expectedMime) => {
    const result = validateFile(buffer, name, 'application/octet-stream');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.mimeType).toBe(expectedMime);
    }
  });

  /** All three Office formats are ZIP containers and share its signature. */
  it.each(['contrat.docx', 'budget.xlsx', 'presentation.pptx'])('accepts %s', (name) => {
    expect(validateFile(ZIP, name, 'application/octet-stream').ok).toBe(true);
  });

  it.each(['virus.exe', 'script.sh', 'notes.txt', 'page.html', 'sansextension'])(
    'refuses %s by extension',
    (name) => {
      const result = validateFile(PDF, name, 'application/pdf');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('EXTENSION_NOT_ALLOWED');
    },
  );
});

describe('NFR-24 — the declared type is never trusted', () => {
  /**
   * The attack this exists to stop: an executable named `.pdf`, declared as
   * `application/pdf`. Both the name and the header say PDF; only the bytes
   * disagree, and only the bytes are believed.
   */
  it('refuses an executable renamed to .pdf and declared as a pdf', () => {
    const result = validateFile(EXECUTABLE, 'facture.pdf', 'application/pdf');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('CONTENT_MISMATCH');
  });

  it('refuses a PNG renamed to .pdf', () => {
    const result = validateFile(PNG, 'rapport.pdf', 'application/pdf');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('CONTENT_MISMATCH');
  });

  it('refuses text pretending to be an SVG', () => {
    const result = validateFile(Buffer.from('just plain text'), 'logo.svg', 'image/svg+xml');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('CONTENT_MISMATCH');
  });

  /**
   * A correct declared type is discarded too. The returned value always comes
   * from the allow-list, so no client-supplied string can reach storage or a
   * download header even when it happens to be right.
   */
  it('returns the canonical type, not the declared one, even when they agree', () => {
    const result = validateFile(JPEG, 'photo.jpg', 'image/pjpeg');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.file.mimeType).toBe('image/jpeg');
  });
});

describe('BR-15 — size', () => {
  it('refuses an empty file', () => {
    const result = validateFile(Buffer.alloc(0), 'vide.pdf', 'application/pdf');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('EMPTY');
  });

  it('accepts a file at exactly 20 MB', () => {
    const buffer = Buffer.alloc(MAX_FILE_SIZE_BYTES);
    PDF.copy(buffer);

    expect(validateFile(buffer, 'gros.pdf', 'application/pdf').ok).toBe(true);
  });

  it('refuses one byte over', () => {
    const buffer = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1);
    PDF.copy(buffer);

    const result = validateFile(buffer, 'trop-gros.pdf', 'application/pdf');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('TOO_LARGE');
  });
});

describe('filename sanitisation', () => {
  it('collapses traversal sequences', () => {
    expect(sanitiseFilename('../../etc/passwd')).not.toContain('..');
  });

  it('replaces path separators', () => {
    expect(sanitiseFilename('dossier/sous/fichier.pdf')).toBe('dossier_sous_fichier.pdf');
    expect(sanitiseFilename('dossier\\fichier.pdf')).toBe('dossier_fichier.pdf');
  });

  /** A newline here becomes header injection in a Content-Disposition. */
  it('strips control characters', () => {
    const sanitised = sanitiseFilename('rapport\r\nX-Injected: yes.pdf');

    expect(sanitised).not.toContain('\n');
    expect(sanitised).not.toContain('\r');
  });

  it('caps the length', () => {
    expect(sanitiseFilename('a'.repeat(400)).length).toBeLessThanOrEqual(255);
  });

  it('keeps an ordinary French filename intact', () => {
    expect(sanitiseFilename('Proposition commerciale — été 2026.pdf')).toBe(
      'Proposition commerciale — été 2026.pdf',
    );
  });

  it('sanitises the name it returns from validation', () => {
    const result = validateFile(PDF, '../../secret.pdf', 'application/pdf');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.file.originalName).not.toContain('..');
  });
});

describe('extensionOf', () => {
  it.each([
    ['rapport.pdf', 'pdf'],
    ['RAPPORT.PDF', 'pdf'],
    ['archive.tar.gz', 'gz'],
    ['sansextension', ''],
    ['.gitignore', 'gitignore'],
  ])('%s -> %s', (name, expected) => {
    expect(extensionOf(name)).toBe(expected);
  });
});
