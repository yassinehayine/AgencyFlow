import { Global, Module } from '@nestjs/common';

import { CloudinaryStorageService } from './cloudinary-storage.service';
import { STORAGE_SERVICE } from './storage.service.interface';

/**
 * Storage core module (ADR-0003).
 *
 * Exports only the STORAGE_SERVICE token, so consumers depend on the port and
 * cannot reach the Cloudinary adapter directly. Swapping providers is a change
 * to this one binding.
 */
@Global()
@Module({
  providers: [{ provide: STORAGE_SERVICE, useClass: CloudinaryStorageService }],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
