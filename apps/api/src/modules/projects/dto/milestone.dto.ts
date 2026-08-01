import { PROJECT_LIMITS } from '@agencyflow/contracts';
import type { CreateMilestoneRequest, UpdateMilestoneRequest } from '@agencyflow/contracts';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Length, MaxLength, Min } from 'class-validator';

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * FR-029.
 *
 * There is no `status` and no `progress` field, and there never will be: both
 * are computed from the milestone's tasks on every read (BR-08, FR-030). A
 * writable `status` would be the first step towards storing it.
 */
export class CreateMilestoneDto implements CreateMilestoneRequest {
  @Transform(trimmed)
  @IsString()
  @Length(PROJECT_LIMITS.MILESTONE_NAME_MIN, PROJECT_LIMITS.MILESTONE_NAME_MAX)
  name!: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(PROJECT_LIMITS.MILESTONE_DESCRIPTION_MAX)
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  /** Roadmap position. Unique within the project — checked in the service. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order!: number;
}

/** FR-030 */
export class UpdateMilestoneDto implements UpdateMilestoneRequest {
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @Length(PROJECT_LIMITS.MILESTONE_NAME_MIN, PROJECT_LIMITS.MILESTONE_NAME_MAX)
  name?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(PROJECT_LIMITS.MILESTONE_DESCRIPTION_MAX)
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
}
