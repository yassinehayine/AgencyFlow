import { PROJECT_LIMITS, ProjectStatus } from '@agencyflow/contracts';
import type {
  AddTeamMemberRequest,
  ChangeProjectStatusRequest,
  CreateProjectRequest,
  ProjectListQuery,
  ReassignProjectManagerRequest,
  UpdateProjectRequest,
} from '@agencyflow/contracts';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

/**
 * FR-019.
 *
 * `status` is absent: a new project is always `PLANNED` (SRS §6.4). Accepting
 * it would let a caller create a project directly in `COMPLETED`, skipping
 * every transition rule at the one moment nothing is there to compare against.
 *
 * `@IsMongoId` rather than `@IsString` on the two references — a malformed id
 * is then a 400 naming the field, not a cast error deeper in the stack.
 */
export class CreateProjectDto implements CreateProjectRequest {
  @Transform(trimmed)
  @IsString()
  @Length(PROJECT_LIMITS.NAME_MIN, PROJECT_LIMITS.NAME_MAX)
  name!: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(PROJECT_LIMITS.DESCRIPTION_MAX)
  description?: string;

  /** Exactly one client (BR-03). Immutable afterwards — see UpdateProjectDto. */
  @IsMongoId()
  clientId!: string;

  /** Exactly one owning PM (BR-24). Role is verified in the service. */
  @IsMongoId()
  projectManagerId!: string;

  @IsDateString()
  startDate!: string;

  /** Not earlier than `startDate` — compared in the service, where both exist. */
  @IsDateString()
  endDate!: string;
}

/**
 * FR-020.
 *
 * Deliberately narrow. `clientId` is absent because moving a project to
 * another organisation would carry every task, deliverable and comment across
 * an isolation boundary in a single request (BR-10). `projectManagerId` and
 * `status` are absent because each is a named command with its own permission
 * (FR-021, FR-022) — there is no generic write path to either.
 */
export class UpdateProjectDto implements UpdateProjectRequest {
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @Length(PROJECT_LIMITS.NAME_MIN, PROJECT_LIMITS.NAME_MAX)
  name?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(PROJECT_LIMITS.DESCRIPTION_MAX)
  description?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/** FR-021 */
export class ChangeProjectStatusDto implements ChangeProjectStatusRequest {
  @IsIn(Object.values(ProjectStatus))
  status!: ProjectStatus;
}

/** FR-022 — Administrator only (BR-24). */
export class ReassignProjectManagerDto implements ReassignProjectManagerRequest {
  @IsMongoId()
  projectManagerId!: string;
}

/** FR-023 */
export class AddTeamMemberDto implements AddTeamMemberRequest {
  @IsMongoId()
  userId!: string;
}

/** FR-025 */
export class ProjectListQueryDto extends PaginationQueryDto implements ProjectListQuery {
  @IsOptional()
  @IsIn(Object.values(ProjectStatus))
  status?: ProjectStatus;

  /**
   * A filter, never a widening. It narrows within what the scope already
   * permits, because the scope filter is applied as a conjunction — a Client
   * Contact passing another organisation's id gets an empty page, not a leak.
   */
  @IsOptional()
  @IsMongoId()
  clientId?: string;

  @IsOptional()
  @IsMongoId()
  projectManagerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeArchived?: boolean;
}
