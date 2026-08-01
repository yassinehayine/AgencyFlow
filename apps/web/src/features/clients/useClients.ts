import type {
  ClientDetail,
  ClientListQuery,
  ClientSummary,
  CreateClientContactRequest,
  CreateClientRequest,
  PaginatedResponse,
  UserDetail,
  UserSummary,
} from '@agencyflow/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';

function toSearchParams(query: ClientListQuery): string {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });

  return params.toString();
}

export function useClients(query: ClientListQuery) {
  return useQuery({
    queryKey: queryKeys.clients.list(query),
    queryFn: () =>
      apiRequest<PaginatedResponse<ClientSummary>>(`/clients?${toSearchParams(query)}`),
    placeholderData: (previous) => previous,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateClientRequest) =>
      apiRequest<ClientDetail>('/clients', { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.clients.all }),
  });
}

/** FR-017 — enabled only once an organisation is selected. */
export function useClientContacts(clientId: string | null) {
  return useQuery({
    queryKey: queryKeys.clients.contacts(clientId ?? ''),
    queryFn: () => apiRequest<UserSummary[]>(`/clients/${clientId}/contacts`),
    enabled: clientId !== null,
  });
}

/**
 * FR-016.
 *
 * `clientId` is a function argument that becomes a path segment, never a body
 * field — the same shape the API enforces. Mirroring the server's constraint
 * on the client means there is no form control that could send the wrong
 * organisation (BR-10).
 */
export function useCreateClientContact(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateClientContactRequest) =>
      apiRequest<UserDetail>(`/clients/${clientId}/contacts`, { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.contacts(clientId) });
      // A contact is also a user, so the user list is stale too.
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}
