import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Environment contract, validated once at application boot.
 *
 * A missing or malformed variable fails startup immediately rather than at
 * the first request that happens to need it (08-Backend-Design.md section 1.1,
 * "fail fast"). Discovering a missing JWT secret when the first user tries to
 * log in is strictly worse than refusing to start.
 */
export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string = 'development';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  /**
   * Local development requires `?replicaSet=rs0`; transactions do not work
   * against a standalone server (06-Database-Design.md section 9.3).
   */
  @IsString()
  @IsNotEmpty()
  MONGODB_URI!: string;

  /**
   * Minimum 32 characters. A short signing secret makes the JWT forgeable,
   * which would defeat client data isolation entirely: `clientId` is trusted
   * precisely because it arrives inside a signed token (BR-10).
   */
  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters' })
  JWT_SECRET!: string;

  /** Format: cloudinary://<api_key>:<api_secret>@<cloud_name> (ADR-0003). */
  @IsString()
  @IsNotEmpty()
  CLOUDINARY_URL!: string;

  @IsString()
  @IsNotEmpty()
  CLOUDINARY_FOLDER: string = 'agencyflow';

  /** The single web origin permitted to call this API (NFR-20). */
  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN!: string;
}

/**
 * Validates process environment against the contract above.
 *
 * Reports every problem at once rather than one per restart — a developer
 * fixing four missing variables should not need four failed boots to find them.
 */
export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  const parsed = plainToInstance(EnvironmentVariables, raw, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });

  const errors = validateSync(parsed, {
    skipMissingProperties: false,
    whitelist: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => {
        const constraints = Object.values(error.constraints ?? {}).join('; ');
        return `  - ${error.property}: ${constraints || 'invalid value'}`;
      })
      .join('\n');

    throw new Error(
      `Invalid environment configuration. The application will not start.\n${details}\n` +
        `\nCopy .env.example to .env and fill in the missing values.`,
    );
  }

  return parsed;
}
