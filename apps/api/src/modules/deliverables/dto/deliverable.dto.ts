import { DELIVERABLE_LIMITS, DeliverableStatus } from '@agencyflow/contracts';
import type {
  CreateDeliverableRequest,
  DeliverableListQuery,
  RequestChangesRequest,
  UpdateDeliverableRequest,
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

/** FR-045. `status` is absent — a new deliverable is always `DRAFT`. */
export class CreateDeliverableDto implements CreateDeliverableRequest {
  @Transform(trimmed)
  @IsString()
  @Length(DELIVERABLE_LIMITS.NAME_MIN, DELIVERABLE_LIMITS.NAME_MAX)
  name!: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(DELIVERABLE_LIMITS.DESCRIPTION_MAX)
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

/** FR-045. Every write is refused once the deliverable is approved (BR-07). */
export class UpdateDeliverableDto implements UpdateDeliverableRequest {
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @Length(DELIVERABLE_LIMITS.NAME_MIN, DELIVERABLE_LIMITS.NAME_MAX)
  name?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(DELIVERABLE_LIMITS.DESCRIPTION_MAX)
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

/**
 * FR-049 — the change request comment.
 *
 * Mandatory, and re-checked after trimming in the service: a minimum length
 * rejects an empty string but not a string of spaces, and a change request
 * that says nothing leaves the Project Manager guessing what to change.
 */
export class RequestChangesDto implements RequestChangesRequest {
  @Transform(trimmed)
  @IsString()
  @Length(DELIVERABLE_LIMITS.DECISION_COMMENT_MIN, DELIVERABLE_LIMITS.DECISION_COMMENT_MAX)
  comment!: string;
}

/** FR-052 */
export class DeliverableListQueryDto extends PaginationQueryDto implements DeliverableListQuery {
  @IsOptional()
  @IsMongoId()
  projectId?: string;

  @IsOptional()
  @IsIn(Object.values(DeliverableStatus))
  status?: DeliverableStatus;
}
