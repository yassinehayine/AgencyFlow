import { Role } from '@agencyflow/contracts';
import type { ProjectDetail } from '@agencyflow/contracts';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { INPUT_CLASS } from '../components/shared/Field';
import { QueryBoundary } from '../components/shared/QueryBoundary';
import { StatusBadge } from '../components/shared/StatusBadge';
import { useAuth } from '../features/auth/AuthContext';
import {
  availableTransitions,
  canEditProject,
  canManageTeam,
  canReassignManager,
} from '../features/projects/project-permissions';
import {
  useAddTeamMember,
  useChangeProjectStatus,
  useProject,
  useReassignManager,
  useRemoveTeamMember,
} from '../features/projects/useProjects';
import { useUsers } from '../features/users/useUsers';
import { TasksPanel } from '../features/tasks/TasksPanel';
import { DeliverablesPanel } from '../features/deliverables/DeliverablesPanel';
import { useCreateMilestone } from '../features/projects/useProjects';
import { fr } from '../i18n/fr';
import { ApiError } from '../lib/api-client';
import { formatDate } from '../lib/format';

/** FR-026 */
export function ProjectDetailPage() {
  const { id = '' } = useParams();
  const project = useProject(id);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link to="/projects" className="text-sm text-slate-600 hover:text-slate-900">
        {fr.projects.backToList}
      </Link>

      <QueryBoundary query={project}>
        {(data) => <ProjectDetailView projectId={id} project={data} />}
      </QueryBoundary>
    </main>
  );
}

function ProjectDetailView({ projectId, project }: { projectId: string; project: ProjectDetail }) {
  const { user } = useAuth();

  const changeStatus = useChangeProjectStatus(projectId);
  const transitions = availableTransitions(user, project);

  return (
    <>
      <header className="mb-6 mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{project.name}</h1>
          <StatusBadge status={project.status} />
          {project.isArchived && (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {fr.projects.archived}
            </span>
          )}
        </div>

        <p className="mt-1 text-sm text-slate-600">
          {project.clientName} · {fr.projects.manager} : {project.projectManagerName}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {formatDate(project.startDate)} → {formatDate(project.endDate)}
        </p>

        {project.description && (
          <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{project.description}</p>
        )}
      </header>

      {/* FR-021. Only the reachable transitions are offered, read from the same
          table the server enforces — a button that always 422s is worse than
          no button. A terminal status renders an explanation instead. */}
      {(transitions.length > 0 || (user && !project.isArchived)) && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-700">{fr.projects.status}</h2>

          {transitions.length === 0 ? (
            <p className="text-sm text-slate-600">{fr.projects.noTransitions}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {transitions.map((status) => (
                <button
                  key={status}
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
                  disabled={changeStatus.isPending}
                  onClick={() => changeStatus.mutate({ status })}
                >
                  {fr.projects.changeStatusTo} « {fr.projectStatus[status]} »
                </button>
              ))}
            </div>
          )}

          {changeStatus.error instanceof ApiError && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {changeStatus.error.message}
            </p>
          )}
        </section>
      )}

      <TeamPanel projectId={projectId} project={project} />
      <MilestonesPanel projectId={projectId} project={project} />

      {/* BR-28 — tasks are internal. The panel is not mounted for a client
          rather than mounted-and-empty, so no request is made that could only
          ever return 403. */}
      {!user || user.role !== Role.CLIENT_CONTACT ? <TasksPanel project={project} /> : null}

      {/* Shown to EVERY role, including a Client Contact — the approval loop
          is the whole reason they have an account (FR-052, unlike BR-28). */}
      <DeliverablesPanel project={project} />

      {canReassignManager(user) && !project.isArchived && (
        <ManagerPanel projectId={projectId} project={project} />
      )}
    </>
  );
}

/**
 * FR-023, FR-024, BR-28.
 *
 * `team` is ABSENT for a Client Contact rather than empty, so the two cases
 * are distinguishable and the client is told the roster is internal instead of
 * being shown a panel that reads as "nobody is working on this".
 */
function TeamPanel({ projectId, project }: { projectId: string; project: ProjectDetail }) {
  const { user } = useAuth();
  const mayManage = canManageTeam(user, project);
  const [selected, setSelected] = useState('');

  const addMember = useAddTeamMember(projectId);
  const removeMember = useRemoveTeamMember(projectId);

  // Only fetched when the controls will be shown at all.
  const candidates = useUsers(
    mayManage ? { page: 1, pageSize: 100, role: Role.TEAM_MEMBER, isActive: true } : { page: 1 },
  );

  if (!project.team) {
    return (
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-700">{fr.projects.team}</h2>
        <p className="text-sm text-slate-600">{fr.projects.teamHiddenForClient}</p>
      </section>
    );
  }

  const assigned = new Set(project.team.map((member) => member.user.id));
  const available = (candidates.data?.items ?? []).filter((person) => !assigned.has(person.id));

  const error = addMember.error ?? removeMember.error;

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-slate-700">
        {fr.projects.team} ({project.team.length})
      </h2>

      {project.team.length === 0 ? (
        <p className="text-sm text-slate-600">{fr.projects.emptyTeam}</p>
      ) : (
        <ul className="mb-4 divide-y divide-slate-100">
          {project.team.map((member) => (
            <li key={member.user.id} className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-800">
                {member.user.name}
                {member.user.skill && (
                  <span className="text-slate-500"> · {fr.skills[member.user.skill]}</span>
                )}
              </span>

              {mayManage && (
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-50"
                  disabled={removeMember.isPending}
                  onClick={() => removeMember.mutate(member.user.id)}
                >
                  {fr.projects.removeMember}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {mayManage && (
        <div className="flex flex-wrap gap-2">
          <select
            className={`${INPUT_CLASS} max-w-xs`}
            aria-label={fr.projects.selectMember}
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">{fr.projects.selectMember}</option>
            {available.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            disabled={!selected || addMember.isPending}
            onClick={() =>
              addMember.mutate({ userId: selected }, { onSuccess: () => setSelected('') })
            }
          >
            {fr.projects.addMember}
          </button>
        </div>
      )}

      {error instanceof ApiError && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error.message}
        </p>
      )}
    </section>
  );
}

/**
 * Milestones, read-only in this slice.
 *
 * `status` and `progress` come from the server, where they are computed from
 * the project's tasks on every read and stored nowhere (BR-08). The client
 * never derives them — a second implementation of the formula is a second
 * chance to disagree with the first.
 */
function MilestonesPanel({ projectId, project }: { projectId: string; project: ProjectDetail }) {
  const { user } = useAuth();
  const mayManage = canEditProject(user, project);
  const createMilestone = useCreateMilestone(projectId);
  const [name, setName] = useState('');
  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-slate-700">{fr.projects.milestones}</h2>

      {mayManage && (
        <form
          className="mb-4 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            // `order` is appended, never chosen by hand: the API rejects a
            // duplicate position, and asking a user to pick an integer is a
            // conflict waiting to happen.
            createMilestone.mutate(
              { name: name.trim(), order: project.milestones.length },
              { onSuccess: () => setName('') },
            );
          }}
        >
          <input
            className={`${INPUT_CLASS} max-w-xs`}
            aria-label={fr.milestones.name}
            placeholder={fr.milestones.name}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
            disabled={createMilestone.isPending}
          >
            {fr.milestones.add}
          </button>
        </form>
      )}

      {createMilestone.error instanceof ApiError && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {createMilestone.error.message}
        </p>
      )}

      {project.milestones.length === 0 ? (
        <p className="text-sm text-slate-600">{fr.projects.emptyMilestones}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {[...project.milestones]
            .sort((a, b) => a.order - b.order)
            .map((milestone) => (
              <li key={milestone.id} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-slate-800">{milestone.name}</span>
                  <span className="text-xs text-slate-500">
                    {fr.milestoneStatus[milestone.status]} · {milestone.progress}%
                    {milestone.dueDate && ` · ${formatDate(milestone.dueDate)}`}
                  </span>
                </div>

                {/* aria-hidden: the bar duplicates the percentage already read
                    out above it, so announcing it twice adds noise. */}
                <div className="mt-1 h-1.5 w-full rounded bg-slate-100" aria-hidden="true">
                  <div
                    className="h-1.5 rounded bg-slate-700"
                    style={{ width: `${milestone.progress}%` }}
                  />
                </div>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

/** FR-022 — Administrator only (BR-24). */
function ManagerPanel({ projectId, project }: { projectId: string; project: ProjectDetail }) {
  const [selected, setSelected] = useState('');
  const reassign = useReassignManager(projectId);
  const managers = useUsers({ page: 1, pageSize: 100, role: Role.PROJECT_MANAGER, isActive: true });

  const candidates = (managers.data?.items ?? []).filter(
    (manager) => manager.id !== project.projectManagerId,
  );

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-slate-700">{fr.projects.reassignManager}</h2>

      <div className="flex flex-wrap gap-2">
        <select
          className={`${INPUT_CLASS} max-w-xs`}
          aria-label={fr.projects.selectManager}
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="">{fr.projects.selectManager}</option>
          {candidates.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
          disabled={!selected || reassign.isPending}
          onClick={() =>
            reassign.mutate({ projectManagerId: selected }, { onSuccess: () => setSelected('') })
          }
        >
          {fr.projects.reassignManager}
        </button>
      </div>

      {reassign.error instanceof ApiError && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {reassign.error.message}
        </p>
      )}
    </section>
  );
}
