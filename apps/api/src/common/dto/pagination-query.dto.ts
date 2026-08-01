import { PAGINATION_DEFAULTS, SortOrder } from '@agencyflow/contracts';
import type { PaginatedResponse, PaginationQuery } from '@agencyflow/contracts';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Query parameters accepted by every list endpoint (NFR-17).
 *
 * `MAX_PAGE_SIZE` is enforced here rather than trusted from the client: an
 * unbounded `pageSize` turns any list endpoint into a way to pull an entire
 * collection in one request, which is both a performance and a disclosure
 * problem. Exceeding it is a 400, not a silent clamp — a silently truncated
 * page looks like missing data.
 */
export class PaginationQueryDto implements PaginationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = PAGINATION_DEFAULTS.PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINATION_DEFAULTS.MAX_PAGE_SIZE)
  pageSize: number = PAGINATION_DEFAULTS.PAGE_SIZE;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(Object.values(SortOrder))
  sortOrder: SortOrder = SortOrder.ASC;

  /** Documents to skip. Derived, never accepted from the client. */
  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }
}

/**
 * Builds the list envelope. One helper rather than per-controller arithmetic,
 * because `totalPages` is computed identically everywhere and an off-by-one in
 * one endpoint is a bug nobody looks for.
 */
export function paginate<T>(
  items: T[],
  totalItems: number,
  query: Pick<PaginationQueryDto, 'page' | 'pageSize'>,
): PaginatedResponse<T> {
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    totalItems,
    // An empty result set is one empty page, not zero pages: a client that
    // renders "page 1 of 0" is showing a bug to the user.
    totalPages: Math.max(1, Math.ceil(totalItems / query.pageSize)),
  };
}
