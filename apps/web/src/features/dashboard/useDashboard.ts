import type { DashboardResponse } from '@agencyflow/contracts';
import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';

/**
 * FR-068 – FR-072 — the one dashboard endpoint.
 *
 * No role parameter, and none is possible: the server reads it from the token's
 * user record on every request (ADR-0005). The response is a discriminated
 * union, so the caller must narrow on `role` before it can read a field — which
 * is what stops a component from rendering an Administrator's panels for
 * somebody else.
 *
 * `refetchOnMount` because a dashboard is a snapshot of now
 * (09-Frontend-Design.md §4.3). A list can afford to show a cached page while
 * it revalidates; a dashboard that opens showing yesterday's overdue count is
 * telling the user something false about their day.
 */
export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard.current(),
    queryFn: () => apiRequest<DashboardResponse>('/dashboard'),
    refetchOnMount: 'always',
  });
}
