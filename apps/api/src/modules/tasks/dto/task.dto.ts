import { TASK_LIMITS, TaskStatus } from '@agencyflow/contracts';
import type {
  AssignTaskRequest,
  BlockTaskRequest,
  CreateTaskRequest,
  TaskListQuery,
  UpdateTaskRequest,
} from '@agencyflow/contracts';
import { Transform } from 'class-transformer';
import {
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

/** FR-035. `status` is absent — a new task is always `TODO` (SRS §6.1). */
export class CreateTaskDto implements CreateTaskRequest {
  @Transform(trimmed)
  @IsString()
  @Length(TASK_LIMITS.TITLE_MIN, TASK_LIMITS.TITLE_MAX)
  title!: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(TASK_LIMITS.DESCRIPTION_MAX)
  description?: string;

  @IsMongoId()
  milestoneId!: string;

  /** Verified against the project team in the service (BR-23). */
  @IsMongoId()
  assigneeId!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

/**
 * FR-037.
 *
 * `status` and `assigneeId` are absent by construction. Status moves only
 * through named commands, which is what makes BR-04 unbypassable; assignment
 * has its own endpoint because it carries the BR-23 membership check.
 */
export class UpdateTaskDto implements UpdateTaskRequest {
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @Length(TASK_LIMITS.TITLE_MIN, TASK_LIMITS.TITLE_MAX)
  title?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(TASK_LIMITS.DESCRIPTION_MAX)
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsMongoId()
  milestoneId?: string;
}

/** FR-036 */
export class AssignTaskDto implements AssignTaskRequest {
  @IsMongoId()
  assigneeId!: string;
}

/**
 * FR-041 — BR-22.
 *
 * `@Length` with a minimum rejects an empty string, but a string of spaces
 * passes it. The service trims and re-checks, because a blocked task whose
 * reason renders as nothing satisfies the letter of the rule and defeats its
 * purpose (CIR-6).
 */
export class BlockTaskDto implements BlockTaskRequest {
  @Transform(trimmed)
  @IsString()
  @Length(TASK_LIMITS.BLOCKED_REASON_MIN, TASK_LIMITS.BLOCKED_REASON_MAX)
  reason!: string;
}

/** FR-043 */
export class TaskListQueryDto extends PaginationQueryDto implements TaskListQuery {
  @IsOptional()
  @IsMongoId()
  projectId?: string;

  @IsOptional()
  @IsMongoId()
  milestoneId?: string;

  @IsOptional()
  @IsMongoId()
  assigneeId?: string;

  @IsOptional()
  @IsIn(Object.values(TaskStatus))
  status?: TaskStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
