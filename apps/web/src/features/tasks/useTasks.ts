import type {
  AssignTaskRequest,
  BlockTaskRequest,
  CreateTaskRequest,
  PaginatedResponse,
  TaskDetail,
  TaskListQuery,
  TaskSummary,
} from '@agencyflow/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import { toSearchParams } from '../projects/useProjects';
import type { TaskCommand } from './task-permissions';

export function useTasks(query: TaskListQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tasks.list(query),
    queryFn: () => apiRequest<PaginatedResponse<TaskSummary>>(`/tasks?${toSearchParams(query)}`),
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateTaskRequest) =>
      apiRequest<TaskDetail>(`/projects/${projectId}/tasks`, { method: 'POST', body }),
    onSuccess: () => invalidate(queryClient, projectId),
  });
}

export function useAssignTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, ...body }: AssignTaskRequest & { taskId: string }) =>
      apiRequest<TaskDetail>(`/tasks/${taskId}/assignee`, { method: 'POST', body }),
    onSuccess: () => invalidate(queryClient, projectId),
  });
}

/**
 * Runs one of the named transition commands.
 *
 * A single hook rather than seven, because the shape is identical and the
 * command is data. What must NOT be shared is the decision of which command to
 * offer — that is `availableCommands`, where BR-04 lives.
 *
 * Deliberately not optimistic. The server may refuse a transition it alone can
 * judge (BR-04, the state machine, a stale view), and showing the new status
 * before it is accepted means showing the user something untrue
 * (09-Frontend-Design §4.3).
 */
export function useTaskCommand(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      command,
      reason,
    }: {
      taskId: string;
      command: TaskCommand;
      reason?: string;
    }) =>
      apiRequest<TaskDetail>(`/tasks/${taskId}/${command}`, {
        method: 'POST',
        ...(reason !== undefined ? { body: { reason } satisfies BlockTaskRequest } : {}),
      }),
    onSuccess: () => invalidate(queryClient, projectId),
  });
}

/**
 * A task change moves milestone progress, so the PROJECT is stale too.
 *
 * Easy to forget, and the symptom is subtle: the board updates while the
 * progress bar above it keeps yesterday's number (BR-08 — progress is computed
 * server-side on every read, so only a refetch reflects it).
 */
function invalidate(queryClient: ReturnType<typeof useQueryClient>, projectId: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
}
