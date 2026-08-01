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
    // Credentials are parsed from the validated configuration and passed in
    // explicitly.
    //
    // The SDK can auto-configure itself by reading CLOUDINARY_URL from
    // process.env, but it does so AT REQUIRE TIME. That makes correctness
    // depend on module load order: if anything imports `cloudinary` before
    // ConfigModule has read the .env file, the SDK initialises empty and
    // every call fails with "Must supply cloud_name". Configuring explicitly
    // here removes the ordering dependency entirely.
    const { cloudName, apiKey, apiSecret } = this.parseCloudinaryUrl(this.config.cloudinaryUrl);

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });

    this.logger.log(
      `Cloudinary configured (cloud: ${cloudName}, folder: ${this.config.cloudinaryFolder})`,
    );
  }

  /**
   * Parses `cloudinary://<api_key>:<api_secret>@<cloud_name>`.
   *
   * Throws on a malformed value rather than continuing with partial
   * credentials, so a configuration mistake surfaces at boot instead of at
   * the first upload a user attempts.
   */
  private parseCloudinaryUrl(url: string): {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
  } {
    const match = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(url);

    if (!match) {
      throw new Error(
        'CLOUDINARY_URL is malformed. Expected cloudinary://<api_key>:<api_secret>@<cloud_name>',
      );
    }

    const [, apiKey, apiSecret, cloudName] = match;
    return { cloudName, apiKey, apiSecret };
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
