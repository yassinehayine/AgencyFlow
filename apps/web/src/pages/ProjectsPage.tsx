import { ProjectStatus } from '@agencyflow/contracts';
import type { CreateProjectRequest, ProjectListQuery } from '@agencyflow/contracts';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { Field, INPUT_CLASS } from '../components/shared/Field';
import { QueryBoundary } from '../components/shared/QueryBoundary';
import { StatusBadge } from '../components/shared/StatusBadge';
import { projectPath } from '../app/routes';
import { useAuth } from '../features/auth/AuthContext';
import { useClients } from '../features/clients/useClients';
import { canCreateProject } from '../features/projects/project-permissions';
import { useCreateProject, useProjects } from '../features/projects/useProjects';
import { useUsers } from '../features/users/useUsers';
import { fr } from '../i18n/fr';
import { ApiError } from '../lib/api-client';
import { formatDate } from '../lib/format';

const EMPTY_FORM: CreateProjectRequest = {
  name: '',
  clientId: '',
  projectManagerId: '',
  startDate: '',
  endDate: '',
};

/**
 * FR-025 — one screen, four different contents.
 *
 * There is no role branching in this component and that is the point: the
 * server returns what the caller may see, so a Client Contact and an
 * Administrator run identical code and get different rows. Filtering here
 * would be a second implementation of BR-10 in the least trustworthy place.
 */
export function ProjectsPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState<ProjectListQuery>({ page: 1, pageSize: 20 });
  const [form, setForm] = useState(EMPTY_FORM);
  const [isFormOpen, setFormOpen] = useState(false);

  const projects = useProjects(query);
  const createProject = useCreateProject();
  const mayCreate = canCreateProject(user);

  // The two pickers are only ever rendered for a role that may create a
  // project, so they are only fetched then. A Team Member has no business
  // issuing a request for the client list.
  const clients = useClients({ page: 1, pageSize: 100 });
  const managers = useUsers({ page: 1, pageSize: 100, role: 'PROJECT_MANAGER' });

  const fieldErrors =
    createProject.error instanceof ApiError
      ? Object.fromEntries(
          (createProject.error.details ?? []).map((detail) => [detail.field, detail.message]),
        )
      : {};

  const generalError =
    createProject.error instanceof ApiError && (createProject.error.details ?? []).length === 0
      ? createProject.error.message
      : null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    createProject.mutate(form, {
      onSuccess: () => {
        setForm(EMPTY_FORM);
        setFormOpen(false);
      },
    });
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{fr.projects.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{fr.projects.subtitle}</p>
        </div>

        {mayCreate && (
          <button
            type="button"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => setFormOpen((open) => !open)}
          >
            {isFormOpen ? fr.common.cancel : fr.projects.createTitle}
          </button>
        )}
      </header>

      {mayCreate && isFormOpen && (
        <form
          className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2"
          onSubmit={handleSubmit}
          noValidate
        >
          <Field label={fr.projects.name} error={fieldErrors.name}>
            {({ id }) => (
              <input
                id={id}
                className={INPUT_CLASS}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            )}
          </Field>

          <Field label={fr.projects.client} error={fieldErrors.clientId}>
            {({ id }) => (
              <select
                id={id}
                className={INPUT_CLASS}
                value={form.clientId}
                onChange={(event) => setForm({ ...form, clientId: event.target.value })}
              >
                <option value="">{fr.projects.selectClient}</option>
                {(clients.data?.items ?? [])
                  // An archived organisation accepts no new work, so it is not
                  // offered — the server would refuse it anyway (ADR-0004 §6).
                  .filter((client) => !client.isArchived)
                  .map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
              </select>
            )}
          </Field>

          <Field label={fr.projects.manager} error={fieldErrors.projectManagerId}>
            {({ id }) => (
              <select
                id={id}
                className={INPUT_CLASS}
                value={form.projectManagerId}
                onChange={(event) => setForm({ ...form, projectManagerId: event.target.value })}
              >
                <option value="">{fr.projects.selectManager}</option>
                {(managers.data?.items ?? []).map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label={fr.projects.description} error={fieldErrors.description}>
            {({ id }) => (
              <input
                id={id}
                className={INPUT_CLASS}
                value={form.description ?? ''}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            )}
          </Field>

          <Field label={fr.projects.startDate} error={fieldErrors.startDate}>
            {({ id }) => (
              <input
                id={id}
                className={INPUT_CLASS}
                type="date"
                value={form.startDate}
                onChange={(event) => setForm({ ...form, startDate: event.target.value })}
              />
            )}
          </Field>

          <Field label={fr.projects.endDate} error={fieldErrors.endDate}>
            {({ id }) => (
              <input
                id={id}
                className={INPUT_CLASS}
                type="date"
                value={form.endDate}
                onChange={(event) => setForm({ ...form, endDate: event.target.value })}
              />
            )}
          </Field>

          {generalError && (
            <p
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 sm:col-span-2"
              role="alert"
            >
              {generalError}
            </p>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              disabled={createProject.isPending}
            >
              {createProject.isPending ? fr.common.loading : fr.common.create}
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className={`${INPUT_CLASS} max-w-xs`}
          placeholder={fr.projects.searchPlaceholder}
          aria-label={fr.common.search}
          value={query.search ?? ''}
          onChange={(event) => setQuery({ ...query, search: event.target.value, page: 1 })}
        />

        <select
          className={`${INPUT_CLASS} max-w-xs`}
          aria-label={fr.projects.status}
          value={query.status ?? ''}
          onChange={(event) =>
            setQuery({
              ...query,
              status: (event.target.value || undefined) as ProjectStatus,
              page: 1,
            })
          }
        >
          <option value="">{fr.projects.filterByStatus}</option>
          {Object.values(ProjectStatus).map((status) => (
            <option key={status} value={status}>
              {fr.projectStatus[status]}
            </option>
          ))}
        </select>
      </div>

      <QueryBoundary
        query={projects}
        isEmpty={(data) => data.items.length === 0}
        emptyMessage={fr.common.emptyList}
      >
        {(data) => (
          <>
            <ul className="space-y-3">
              {data.items.map((project) => (
                <li key={project.id}>
                  <Link
                    to={projectPath(user, project.id)}
                    className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">
                          {project.name}
                          {project.isArchived && (
                            <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              {fr.projects.archived}
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-slate-600">
                          {project.clientName} · {formatDate(project.startDate)} →{' '}
                          {formatDate(project.endDate)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500">
                          {project.teamSize} {fr.projects.teamSize.toLowerCase()}
                        </span>
                        <StatusBadge status={project.status} />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            <nav className="mt-4 flex items-center gap-3" aria-label={fr.projects.title}>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
                disabled={data.page <= 1}
                onClick={() => setQuery({ ...query, page: data.page - 1 })}
              >
                {fr.common.previous}
              </button>
              <span className="text-sm text-slate-600">
                {fr.common.pageOf(data.page, data.totalPages)}
              </span>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
                disabled={data.page >= data.totalPages}
                onClick={() => setQuery({ ...query, page: data.page + 1 })}
              >
                {fr.common.next}
              </button>
            </nav>
          </>
        )}
      </QueryBoundary>
    </main>
  );
}
