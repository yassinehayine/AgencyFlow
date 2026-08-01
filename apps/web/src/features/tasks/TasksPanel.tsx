import { TaskStatus } from '@agencyflow/contracts';
import type { CreateTaskRequest, ProjectDetail, TaskSummary } from '@agencyflow/contracts';
import { useState, type FormEvent } from 'react';

import { Field, INPUT_CLASS } from '../../components/shared/Field';
import { QueryBoundary } from '../../components/shared/QueryBoundary';
import { useAuth } from '../auth/AuthContext';
import { canEditProject } from '../projects/project-permissions';
import { availableCommands, canModify } from './task-permissions';
import { useCreateTask, useTaskCommand, useTasks } from './useTasks';
import { fr } from '../../i18n/fr';
import { ApiError } from '../../lib/api-client';
import { formatDate } from '../../lib/format';

/** The board's columns, in workflow order. Terminal states sit last. */
const COLUMNS: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.BLOCKED,
  TaskStatus.DONE,
];

const COLUMN_STYLES: Record<string, string> = {
  TODO: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  IN_REVIEW: 'bg-violet-100 text-violet-800',
  BLOCKED: 'bg-amber-100 text-amber-900',
  DONE: 'bg-emerald-100 text-emerald-800',
};

/**
 * FR-043 — the project's tasks, grouped by status.
 *
 * Never rendered for a Client Contact: BR-28 keeps tasks entirely internal,
 * and the API refuses `/tasks` for that role anyway. The panel is not mounted
 * rather than mounted-and-empty, so no request is made that would only ever
 * come back 403.
 *
 * `CANCELLED` has no column. Cancelled work is excluded from progress (BR-12)
 * and giving it a column would put it back in front of the team every day.
 */
export function TasksPanel({ project }: { project: ProjectDetail }) {
  const { user } = useAuth();
  const mayManage = canEditProject(user, project);

  const tasks = useTasks({ projectId: project.id, pageSize: 100 });
  const runCommand = useTaskCommand(project.id);

  const grouped = (tasks.data?.items ?? []).reduce<Record<string, TaskSummary[]>>(
    (accumulator, task) => {
      (accumulator[task.status] ??= []).push(task);
      return accumulator;
    },
    {},
  );

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-slate-700">
          {fr.tasks.title} ({tasks.data?.totalItems ?? 0})
        </h2>
      </div>

      {mayManage && <CreateTaskForm project={project} />}

      <QueryBoundary
        query={tasks}
        isEmpty={(data) => data.items.length === 0}
        emptyMessage={fr.tasks.empty}
      >
        {() => (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {COLUMNS.map((status) => (
              <div key={status}>
                <h3
                  className={`mb-2 rounded px-2 py-1 text-xs font-medium ${COLUMN_STYLES[status]}`}
                >
                  {fr.taskStatus[status]} ({(grouped[status] ?? []).length})
                </h3>

                <ul className="space-y-2">
                  {(grouped[status] ?? []).map((task) => (
                    <li key={task.id} className="rounded-lg border border-slate-200 p-2">
                      <p className="text-sm text-slate-900">{task.title}</p>
                      <p className="text-xs text-slate-500">
                        {task.assignee.name}
                        {task.dueDate && ` · ${formatDate(task.dueDate)}`}
                      </p>

                      {task.blockedReason && (
                        <p className="mt-1 text-xs text-amber-900">
                          {fr.tasks.blockedBecause} {task.blockedReason}
                        </p>
                      )}

                      <TaskActions
                        task={task}
                        onRun={(command, reason) =>
                          runCommand.mutate({ taskId: task.id, command, reason })
                        }
                        isPending={runCommand.isPending}
                      />

                      {/* BR-04 explained rather than silently absent. A Team
                          Member whose work is awaiting review should know it is
                          waiting on someone, not wonder where the button went. */}
                      {task.status === TaskStatus.IN_REVIEW &&
                        canModify(user, task) &&
                        availableCommands(user, task).every((a) => a.command !== 'done') && (
                          <p className="mt-1 text-xs text-slate-500">
                            {fr.tasks.completionIsManagerOnly}
                          </p>
                        )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </QueryBoundary>

      {runCommand.error instanceof ApiError && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {runCommand.error.message}
        </p>
      )}
    </section>
  );
}

/**
 * The commands the current user may run on one task.
 *
 * `block` is the only one carrying input, so it is the only one that prompts.
 * A cancelled prompt runs nothing — BR-22 requires a reason, and inventing a
 * placeholder would satisfy the check while defeating it.
 */
function TaskActions({
  task,
  onRun,
  isPending,
}: {
  task: TaskSummary;
  onRun: (
    command: ReturnType<typeof availableCommands>[number]['command'],
    reason?: string,
  ) => void;
  isPending: boolean;
}) {
  const { user } = useAuth();
  const actions = availableCommands(user, task);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {actions.map(({ command }) => (
        <button
          key={command}
          type="button"
          className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100 disabled:opacity-50"
          disabled={isPending}
          onClick={() => {
            if (command !== 'block') {
              onRun(command);
              return;
            }

            const reason = window.prompt(fr.tasks.blockReasonPrompt);
            if (reason && reason.trim()) {
              onRun(command, reason);
            }
          }}
        >
          {fr.taskCommands[command]}
        </button>
      ))}
    </div>
  );
}

/** FR-035 — creation is project-nested and always starts at TODO. */
function CreateTaskForm({ project }: { project: ProjectDetail }) {
  const createTask = useCreateTask(project.id);
  const [form, setForm] = useState<CreateTaskRequest>({
    title: '',
    milestoneId: '',
    assigneeId: '',
  });

  // A task needs both a milestone and a team member. Saying which is missing
  // beats a form that submits and returns 422 (06-DB §9, BR-23).
  if (project.milestones.length === 0) {
    return <p className="mb-4 text-sm text-slate-600">{fr.tasks.milestoneRequiredFirst}</p>;
  }

  if (!project.team || project.team.length === 0) {
    return <p className="mb-4 text-sm text-slate-600">{fr.tasks.teamRequiredFirst}</p>;
  }

  const fieldErrors =
    createTask.error instanceof ApiError
      ? Object.fromEntries(
          (createTask.error.details ?? []).map((detail) => [detail.field, detail.message]),
        )
      : {};

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createTask.mutate(form, {
      onSuccess: () => setForm({ title: '', milestoneId: '', assigneeId: '' }),
    });
  }

  return (
    <form className="mb-6 grid gap-3 sm:grid-cols-4" onSubmit={handleSubmit} noValidate>
      <Field label={fr.tasks.taskTitle} error={fieldErrors.title}>
        {({ id }) => (
          <input
            id={id}
            className={INPUT_CLASS}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        )}
      </Field>

      <Field label={fr.tasks.milestone} error={fieldErrors.milestoneId}>
        {({ id }) => (
          <select
            id={id}
            className={INPUT_CLASS}
            value={form.milestoneId}
            onChange={(event) => setForm({ ...form, milestoneId: event.target.value })}
          >
            <option value="">{fr.tasks.selectMilestone}</option>
            {project.milestones.map((milestone) => (
              <option key={milestone.id} value={milestone.id}>
                {milestone.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      {/* Only project team members are offered: BR-23 refuses anyone else, so
          listing every user would be offering a guaranteed failure. */}
      <Field label={fr.tasks.assignee} error={fieldErrors.assigneeId}>
        {({ id }) => (
          <select
            id={id}
            className={INPUT_CLASS}
            value={form.assigneeId}
            onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}
          >
            <option value="">{fr.tasks.selectAssignee}</option>
            {project.team?.map((member) => (
              <option key={member.user.id} value={member.user.id}>
                {member.user.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label={fr.tasks.dueDate} error={fieldErrors.dueDate}>
        {({ id }) => (
          <input
            id={id}
            className={INPUT_CLASS}
            type="date"
            value={form.dueDate ?? ''}
            onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
          />
        )}
      </Field>

      {createTask.error instanceof ApiError && Object.keys(fieldErrors).length === 0 && (
        <p
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 sm:col-span-4"
          role="alert"
        >
          {createTask.error.message}
        </p>
      )}

      <div className="sm:col-span-4">
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          disabled={createTask.isPending}
        >
          {fr.tasks.createTitle}
        </button>
      </div>
    </form>
  );
}
