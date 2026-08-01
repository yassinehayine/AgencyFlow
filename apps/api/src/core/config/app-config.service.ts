import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from './env.validation';

/**
 * Typed accessor for validated configuration.
 *
 * Feature modules inject this rather than the raw ConfigService, so that no
 * consumer has to remember a variable name as a string literal or handle a
 * possibly-undefined result. By the time this service exists, every value has
 * already been validated at boot.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  get nodeEnv(): string {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get mongodbUri(): string {
    return this.config.get('MONGODB_URI', { infer: true });
  }

  get jwtSecret(): string {
    return this.config.get('JWT_SECRET', { infer: true });
  }

  get cloudinaryUrl(): string {
    return this.config.get('CLOUDINARY_URL', { infer: true });
  }

  get cloudinaryFolder(): string {
    return this.config.get('CLOUDINARY_FOLDER', { infer: true });
  }

  get corsOrigin(): string {
    return this.config.get('CORS_ORIGIN', { infer: true });
  }
}
