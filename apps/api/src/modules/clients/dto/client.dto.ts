import { CLIENT_LIMITS } from '@agencyflow/contracts';
import type {
  ClientListQuery,
  CreateClientRequest,
  UpdateClientRequest,
} from '@agencyflow/contracts';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

/** FR-013 */
export class CreateClientDto implements CreateClientRequest {
  @Transform(trimmed)
  @IsString()
  @Length(CLIENT_LIMITS.NAME_MIN, CLIENT_LIMITS.NAME_MAX)
  name!: string;

  /** The organisation's own address, not a login. Optional by design. */
  @IsOptional()
  @Transform(trimmed)
  @IsEmail()
  contactEmail?: string;

  /**
   * Free text, deliberately. Moroccan numbers are written in several formats
   * and a strict pattern would reject valid data to enforce a convention no
   * requirement asks for.
   */
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(CLIENT_LIMITS.ADDRESS_MAX)
  address?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(CLIENT_LIMITS.NOTES_MAX)
  notes?: string;
}

/**
 * FR-014. Every field optional; an omitted field means unchanged.
 *
 * Written out rather than derived with `PartialType`, because the decorators
 * are what carry the validation and a reader of this file should be able to
 * see the rules without following a helper.
 */
export class UpdateClientDto implements UpdateClientRequest {
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @Length(CLIENT_LIMITS.NAME_MIN, CLIENT_LIMITS.NAME_MAX)
  name?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(CLIENT_LIMITS.ADDRESS_MAX)
  address?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(CLIENT_LIMITS.NOTES_MAX)
  notes?: string;
}

/** FR-015 */
export class ClientListQueryDto extends PaginationQueryDto implements ClientListQuery {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  /** Archived organisations are hidden unless asked for by name (FR-018). */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeArchived?: boolean;
}
