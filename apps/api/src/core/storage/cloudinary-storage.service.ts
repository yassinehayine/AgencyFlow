import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'node:stream';

import { AppConfigService } from '../config/app-config.service';
import type { IStorageService, StoredFile, UploadContext } from './storage.service.interface';

/**
 * Cloudinary implementation of the storage port (ADR-0003).
 *
 * All Cloudinary-specific concepts stay inside this class. `resource_type:
 * 'raw'` is required for the Office documents and ZIP archives permitted by
 * BR-15 — Cloudinary is usually presented as an image service, and using the
 * default `image` type silently rejects them.
 */
@Injectable()
export class CloudinaryStorageService implements IStorageService, OnModuleInit {
  private readonly logger = new Logger(CloudinaryStorageService.name);

  constructor(private readonly config: AppConfigService) {}

  onModuleInit(): void {
    // CLOUDINARY_URL is parsed by the SDK from the environment; passing it
    // explicitly keeps the dependency visible rather than implicit.
    cloudinary.config({ secure: true });
    this.logger.log(`Cloudinary configured (folder: ${this.config.cloudinaryFolder})`);
  }

  async upload(buffer: Buffer, context: UploadContext): Promise<StoredFile> {
    const folder = `${this.config.cloudinaryFolder}/${context.path}`;

    return new Promise<StoredFile>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'raw', use_filename: true, unique_filename: true },
        (error, result) => {
          if (error || !result) {
            reject(new Error(`Upload failed: ${error?.message ?? 'no result returned'}`));
            return;
          }
          resolve({
            storageKey: result.public_id,
            sizeBytes: result.bytes,
            mimeType: context.mimeType,
          });
        },
      );
      stream.end(buffer);
    });
  }

  async getStream(storageKey: string): Promise<Readable> {
    const url = cloudinary.url(storageKey, { resource_type: 'raw', secure: true });
    const response = await fetch(url);

    if (!response.ok || !response.body) {
      throw new Error(`Unable to retrieve file (${response.status})`);
    }

    return Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
  }

  async delete(storageKey: string): Promise<void> {
    await cloudinary.uploader.destroy(storageKey, { resource_type: 'raw' });
  }

  async ping(): Promise<boolean> {
    try {
      const result = await cloudinary.api.ping();
      return result.status === 'ok';
    } catch (error) {
      this.logger.warn(`Cloudinary ping failed: ${(error as Error).message}`);
      return false;
    }
  }
}
