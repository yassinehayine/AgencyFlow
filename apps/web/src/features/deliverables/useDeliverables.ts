import type {
  CreateDeliverableRequest,
  DeliverableDetail,
  DeliverableListQuery,
  DeliverableSummary,
  PaginatedResponse,
  RequestChangesRequest,
} from '@agencyflow/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest, apiUpload, downloadFile } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import { toSearchParams } from '../projects/useProjects';

export function useDeliverables(query: DeliverableListQuery) {
  return useQuery({
    queryKey: queryKeys.deliverables.list(query),
    queryFn: () =>
      apiRequest<PaginatedResponse<DeliverableSummary>>(`/deliverables?${toSearchParams(query)}`),
    placeholderData: (previous) => previous,
  });
}

/**
 * FR-052, FR-054 — the deliverable and its whole version history.
 *
 * A plain read, and it must stay one: BR-31 forbids a read from moving a
 * submitted deliverable to `UNDER_REVIEW`. That transition has its own
 * mutation below, triggered by the client pressing a button.
 */
export function useDeliverable(id: string) {
  return useQuery({
    queryKey: queryKeys.deliverables.detail(id),
    queryFn: () => apiRequest<DeliverableDetail>(`/deliverables/${id}`),
    enabled: id !== '',
  });
}

export function useCreateDeliverable(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateDeliverableRequest) =>
      apiRequest<DeliverableDetail>(`/projects/${projectId}/deliverables`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => invalidate(queryClient),
  });
}

/** FR-046 — multipart, so it bypasses the JSON request helper. */
export function useUploadDeliverableFile(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => apiUpload<DeliverableDetail>(`/deliverables/${id}/files`, file),
    onSuccess: (deliverable) => writeBack(queryClient, id, deliverable),
  });
}

/**
 * The four named commands, mirroring the API's sub-resources.
 *
 * One hook, because the shape is identical. What is NOT shared is who may run
 * each — that lives in `deliverable-permissions`, where the agency/client
 * asymmetry is expressed once and tested.
 */
export type DeliverableCommand = 'submit' | 'start-review' | 'approve' | 'request-changes';

export function useDeliverableCommand(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ command, comment }: { command: DeliverableCommand; comment?: string }) =>
      apiRequest<DeliverableDetail>(`/deliverables/${id}/${command}`, {
        method: 'POST',
        ...(comment !== undefined ? { body: { comment } satisfies RequestChangesRequest } : {}),
      }),
    onSuccess: (deliverable) => writeBack(queryClient, id, deliverable),
  });
}

/**
 * FR-056 — downloads go through the API, never to the provider.
 *
 * There is no URL to link to: the response is streamed with a permission check
 * in front of it, so the file is fetched with the bearer token and handed to
 * the browser as a blob (ADR-0003 S-2).
 */
export function useDownloadDeliverableFile(id: string) {
  return useMutation({
    mutationFn: ({ fileId, filename }: { fileId: string; filename: string }) =>
      downloadFile(`/deliverables/${id}/files/${fileId}`, filename),
  });
}

function writeBack(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  deliverable: DeliverableDetail,
): void {
  queryClient.setQueryData(queryKeys.deliverables.detail(id), deliverable);
  void queryClient.invalidateQueries({ queryKey: queryKeys.deliverables.all });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.deliverables.all });
}
