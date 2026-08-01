import type { LoginRequest } from '@agencyflow/contracts';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

const toLowerTrimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.toLowerCase().trim() : value;

/**
 * FR-001.
 *
 * The password carries `@MinLength(1)` only. Applying the real policy here
 * would tell an attacker the minimum length before they ever guess a
 * password, and would reject a legacy credential that no longer meets a
 * tightened rule — locking out the very user who needs to log in to change it.
 * Strength is enforced where a password is SET, not where it is checked.
 */
export class LoginDto implements LoginRequest {
  @Transform(toLowerTrimmed)
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
