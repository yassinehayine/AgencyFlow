import {
  INTERNAL_ROLES,
  PASSWORD_MIN_LENGTH,
  Role,
  Skill,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  USER_LIMITS,
} from '@agencyflow/contracts';
import type { CreateClientContactRequest, CreateUserRequest } from '@agencyflow/contracts';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

/**
 * Normalises before validating.
 *
 * Without this, `Amine.Benali` fails the username pattern for being
 * capitalised — technically correct and useless as feedback. Case is not a
 * mistake the user should have to correct.
 */
const toLowerTrimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.toLowerCase().trim() : value;

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Fields shared by both creation paths. Password rules and identity format
 * are identical for staff and for client contacts; only the role and the
 * organisation differ, and neither is ever taken from the body.
 */
abstract class BaseCreateUserDto {
  @Transform(trimmed)
  @IsString()
  @Length(USER_LIMITS.NAME_MIN, USER_LIMITS.NAME_MAX)
  name!: string;

  @Transform(toLowerTrimmed)
  @IsString()
  @Length(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH)
  @Matches(USERNAME_PATTERN, {
    message:
      "Le nom d'utilisateur doit être en minuscules et ne contenir que lettres, chiffres, points, tirets ou tirets bas.",
  })
  username!: string;

  @Transform(toLowerTrimmed)
  @IsEmail()
  email!: string;

  /**
   * Only a minimum length is imposed (FR-005, NFR-18). No composition rules:
   * they push users towards predictable substitutions and a memorised
   * `P@ssw0rd1`, which is weaker than a long ordinary phrase.
   */
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  password!: string;
}

/** FR-008 — an internal staff account. Administrator only. */
export class CreateUserDto extends BaseCreateUserDto implements CreateUserRequest {
  /**
   * `CLIENT_CONTACT` is rejected at the DTO, not merely in the service. A
   * contact belongs to exactly one organisation (CIR-2), and the organisation
   * can only come from the path — so a contact created here could never be
   * valid, and the earliest possible refusal is the clearest one.
   */
  @IsIn(INTERNAL_ROLES, {
    message: 'Le rôle doit être administrateur, chef de projet ou membre d’équipe.',
  })
  role!: Role;

  /** Required iff `role` is `TEAM_MEMBER` — checked in the service (CIR-1). */
  @IsOptional()
  @IsIn(Object.values(Skill))
  skill?: Skill;
}

/**
 * FR-016 — a Client Contact login.
 *
 * Carries neither `role` nor `clientId`: the role is fixed by the endpoint and
 * the organisation comes from the path. That is what makes BR-10 unforgeable
 * here — there is no field in which a caller could nominate a different
 * organisation.
 */
export class CreateClientContactDto
  extends BaseCreateUserDto
  implements CreateClientContactRequest {}
