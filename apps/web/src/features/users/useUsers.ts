import type {
  CreateUserRequest,
  PaginatedResponse,
  UserDetail,
  UserListQuery,
  UserSummary,
} from '@agencyflow/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';

/** Drops empty filters so `?role=` never reaches the API as a blank value. */
function toSearchParams(query: UserListQuery): string {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });

  return params.toString();
}

export function useUsers(query: UserListQuery) {
  return useQuery({
    queryKey: queryKeys.users.list(query),
    queryFn: () => apiRequest<PaginatedResponse<UserSummary>>(`/users?${toSearchParams(query)}`),
    // Keeps the previous page visible while the next one loads, so paging does
    // not blank the table and shift the layout under the user's cursor.
    placeholderData: (previous) => previous,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateUserRequest) =>
      apiRequest<UserDetail>('/users', { method: 'POST', body }),
    // Invalidated by prefix: every filtered list refreshes without this
    // mutation needing to know which filters are currently on screen.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}
