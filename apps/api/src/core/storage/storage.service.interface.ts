import type { Readable } from 'node:stream';

/**
 * Storage port (ADR-0003).
 *
 * Business code depends on this interface and never on Cloudinary. Replacing
 * the provider — the ADR records Cloudflare R2 as the migration target — means
 * writing one adapter and touching no business logic. It also lets Phase 9
 * test file features against an in-memory fake with no network access.
 */
export interface StoredFile {
  /** Provider identifier. Never serialized to a client (ADR-0003). */
  storageKey: string;
  sizeBytes: number;
  mimeType: string;
}

export interface UploadContext {
  /** Logical folder, e.g. `deliverables/<id>/v2`. */
  path: string;
  originalName: string;
  mimeType: string;
}

export interface IStorageService {
  upload(buffer: Buffer, context: UploadContext): Promise<StoredFile>;
  getStream(storageKey: string): Promise<Readable>;
  delete(storageKey: string): Promise<void>;
  /** Connectivity probe used by the health endpoint and the setup check. */
  ping(): Promise<boolean>;
}

/** DI token — an interface cannot be used as one at runtime. */
export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
