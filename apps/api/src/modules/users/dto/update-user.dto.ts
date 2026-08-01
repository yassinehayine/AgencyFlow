import {
  INTERNAL_ROLES,
  PASSWORD_MIN_LENGTH,
  Role,
  Skill,
  USER_LIMITS,
} from '@agencyflow/contracts';
import type {
  ChangePasswordRequest,
  ResetPasswordRequest,
  UpdateUserRequest,
} from '@agencyflow/contracts';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, MinLength } from 'class-validator';

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** FR-009 — an Administrator edits a user. */
export class UpdateUserDto implements UpdateUserRequest {
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @Length(USER_LIMITS.NAME_MIN, USER_LIMITS.NAME_MAX)
  name?: string;

  @IsOptional()
  @IsIn(INTERNAL_ROLES, {
    message: 'Le rôle doit être administrateur, chef de projet ou membre d’équipe.',
  })
  role?: Role;

  @IsOptional()
  @IsIn(Object.values(Skill))
  skill?: Skill;

  /**
   * Accepted only so that it can be refused with a reason.
   *
   * `forbidNonWhitelisted` would already reject an unknown `username` with a
   * generic 400, but US-006 asks for an explanation: the username is the
   * `@mention` handle, and changing it would silently break every existing
   * mention of that person. The service answers with USERNAME_IMMUTABLE and
   * says so (BR-33). It is never written.
   */
  @IsOptional()
  @IsString()
  username?: string;

  /** `email` is absent entirely — no requirement permits changing it in v1. */
}

/** FR-006 — an Administrator sets someone else's password. No email is sent. */
export class ResetPasswordDto implements ResetPasswordRequest {
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  newPassword!: string;
}

/** FR-005 — a user changes their own password. */
export class ChangePasswordDto implements ChangePasswordRequest {
  /**
   * Required even though the caller is already authenticated: a 12-hour token
   * on an unlocked machine is exactly the situation this defends against
   * (BR-13).
   */
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  newPassword!: string;
}
