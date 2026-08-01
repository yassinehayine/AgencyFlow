import { Role, Skill } from '@agencyflow/contracts';
import type { UserListQuery } from '@agencyflow/contracts';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/**
 * `Boolean('false') === true`, so relying on implicit conversion for a query
 * string would silently turn `?isActive=false` into a filter for active users
 * — a filter that returns the exact opposite of what was asked, with no error
 * anywhere. Mapped explicitly instead; anything else stays a string and fails
 * `@IsBoolean()` visibly.
 */
const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

/** FR-011 — list and filter users. Filters combine as a conjunction. */
export class UserListQueryDto extends PaginationQueryDto implements UserListQuery {
  @IsOptional()
  @IsIn(Object.values(Role))
  role?: Role;

  @IsOptional()
  @IsIn(Object.values(Skill))
  skill?: Skill;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  /** Matches name, username or email. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
