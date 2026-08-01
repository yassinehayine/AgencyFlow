import type {
  CreateMilestoneRequest,
  AddTeamMemberRequest,
  ChangeProjectStatusRequest,
  CreateProjectRequest,
  PaginatedResponse,
  ProjectDetail,
  ProjectListQuery,
  ProjectSummary,
  ReassignProjectManagerRequest,
  UpdateProjectRequest,
} from '@agencyflow/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';

/**
 * Drops empty and undefined filters.
 *
 * Sending `?status=` would fail `@IsIn` on the server and turn "no filter
 * selected" into a validation error — a 400 produced entirely by the client.
 */
export function toSearchParams(query: object): string {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });

  return params.toString();
}

export function useProjects(query: ProjectListQuery) {
  return useQuery({
    queryKey: queryKeys.projects.list(query),
    queryFn: () =>
      apiRequest<PaginatedResponse<ProjectSummary>>(`/projects?${toSearchParams(query)}`),
    placeholderData: (previous) => previous,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: queryKeys.projects.detail(id),
    queryFn: () => apiRequest<ProjectDetail>(`/projects/${id}`),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateProjectRequest) =>
      apiRequest<ProjectDetail>('/projects', { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
  });
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateProjectRequest) =>
      apiRequest<ProjectDetail>(`/projects/${id}`, { method: 'PATCH', body }),
    onSuccess: (project) => writeBack(queryClient, id, project),
  });
}

/**
 * FR-021 — a POST to a named sub-resource, mirroring the API.
 *
 * There is deliberately no `useUpdateProjectStatus` that PATCHes a field: the
 * client offering a write the server does not accept is how a UI ends up
 * quietly diverging from the rules it is supposed to present.
 */
export function useChangeProjectStatus(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ChangeProjectStatusRequest) =>
      apiRequest<ProjectDetail>(`/projects/${id}/status`, { method: 'POST', body }),
    onSuccess: (project) => writeBack(queryClient, id, project),
  });
}

/** FR-022 — Administrator only (BR-24). */
export function useReassignManager(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ReassignProjectManagerRequest) =>
      apiRequest<ProjectDetail>(`/projects/${id}/manager`, { method: 'POST', body }),
    onSuccess: (project) => writeBack(queryClient, id, project),
  });
}

/** FR-023 */
export function useAddTeamMember(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AddTeamMemberRequest) =>
      apiRequest<ProjectDetail>(`/projects/${id}/team`, { method: 'POST', body }),
    onSuccess: (project) => writeBack(queryClient, id, project),
  });
}

/** FR-024 */
export function useRemoveTeamMember(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      apiRequest<ProjectDetail>(`/projects/${id}/team/${userId}`, { method: 'DELETE' }),
    onSuccess: (project) => writeBack(queryClient, id, project),
  });
}

/**
 * FR-029 — milestones are written through the PROJECT, because they live
 * inside its document (ADR-0004). There is no /milestones resource, and that
 * absence is the design rather than an omission.
 */
export function useCreateMilestone(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateMilestoneRequest) =>
      apiRequest<ProjectDetail>(`/projects/${id}/milestones`, { method: 'POST', body }),
    onSuccess: (project) => writeBack(queryClient, id, project),
  });
}

/**
 * Every write returns the updated project, so the detail cache is replaced
 * with the server's answer rather than refetched.
 *
 * This is NOT an optimistic update. 09-Frontend-Design rules those out for
 * state transitions: the server may legitimately refuse a move, and showing
 * the new status before it is accepted means showing the user something
 * untrue. Here the response has already been accepted — writing it back is
 * simply using the answer we were given instead of asking again.
 *
 * The list is invalidated rather than patched, because a status change can
 * move a project in or out of the current filter.
 */
function writeBack(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  project: ProjectDetail,
): void {
  queryClient.setQueryData(queryKeys.projects.detail(id), project);
  void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all, exact: false });
}
