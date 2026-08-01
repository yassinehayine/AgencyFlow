import type { HealthResponse } from '@agencyflow/contracts';
import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';

/**
 * Health probe. `/health` is unversioned so that platform probes hit a stable
 * path, hence `unversioned`.
 */
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health.status(),
    queryFn: () => apiRequest<HealthResponse>('/health', { unversioned: true }),
    // Long retry window on purpose: Render's free tier can take 30-60 seconds
    // to wake, and giving up early would report a healthy system as broken
    // (AR-09).
    retry: 3,
    retryDelay: (attempt) => Math.min(2000 * 2 ** attempt, 15000),
    refetchInterval: 30_000,
  });
}
