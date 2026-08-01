import { Role, Skill, type CreateUserRequest, type UserListQuery } from '@agencyflow/contracts';
import { useState, type FormEvent } from 'react';

import { Field, INPUT_CLASS } from '../components/shared/Field';
import { QueryBoundary } from '../components/shared/QueryBoundary';
import { useCreateUser, useUsers } from '../features/users/useUsers';
import { fr } from '../i18n/fr';
import { ApiError } from '../lib/api-client';

const EMPTY_FORM: CreateUserRequest = {
  name: '',
  username: '',
  email: '',
  password: '',
  role: Role.TEAM_MEMBER,
  skill: Skill.BACKEND,
};

/** The three roles this form can create. A Client Contact is made from its
 *  organisation instead, so the choice never appears here (CIR-2). */
const CREATABLE_ROLES = [Role.ADMINISTRATOR, Role.PROJECT_MANAGER, Role.TEAM_MEMBER];

/** FR-008, FR-011 — Administrator only. */
export function UsersPage() {
  const [query, setQuery] = useState<UserListQuery>({ page: 1, pageSize: 20 });
  const [form, setForm] = useState<CreateUserRequest>(EMPTY_FORM);
  const [isFormOpen, setFormOpen] = useState(false);

  const users = useUsers(query);
  const createUser = useCreateUser();

  /**
   * Field-level messages from the API's `details[]`.
   *
   * The server is the authority on validity, so its answer is displayed
   * against the field it names rather than being re-derived here. Duplicating
   * the rules in the browser would create two sources of truth that drift.
   */
  const fieldErrors =
    createUser.error instanceof ApiError
      ? Object.fromEntries(
          (createUser.error.details ?? []).map((detail) => [detail.field, detail.message]),
        )
      : {};

  const generalError =
    createUser.error instanceof ApiError && (createUser.error.details ?? []).length === 0
      ? createUser.error.message
      : null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    // A skill is meaningful only for a Team Member, and sending one for any
    // other role is refused by the API (CIR-1). Omitting it here means the
    // form cannot produce a request the server will reject on that ground.
    const payload: CreateUserRequest = {
      ...form,
      ...(form.role === Role.TEAM_MEMBER ? { skill: form.skill } : { skill: undefined }),
    };

    createUser.mutate(payload, {
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
          <h1 className="text-xl font-semibold text-slate-900">{fr.users.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{fr.users.subtitle}</p>
        </div>

        <button
          type="button"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          onClick={() => setFormOpen((open) => !open)}
        >
          {isFormOpen ? fr.common.cancel : fr.users.createTitle}
        </button>
      </header>

      {isFormOpen && (
        <form
          className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2"
          onSubmit={handleSubmit}
          noValidate
        >
          <Field label={fr.users.name} error={fieldErrors.name}>
            {({ id, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                className={INPUT_CLASS}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            )}
          </Field>

          <Field
            label={fr.users.username}
            hint={fr.users.usernameHint}
            error={fieldErrors.username}
          >
            {({ id, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                className={INPUT_CLASS}
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
              />
            )}
          </Field>

          <Field label={fr.users.email} error={fieldErrors.email}>
            {({ id, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                className={INPUT_CLASS}
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            )}
          </Field>

          <Field
            label={fr.users.password}
            hint={fr.users.passwordHint}
            error={fieldErrors.password}
          >
            {({ id, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                className={INPUT_CLASS}
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            )}
          </Field>

          <Field label={fr.users.role} error={fieldErrors.role}>
            {({ id, describedBy }) => (
              <select
                id={id}
                aria-describedby={describedBy}
                className={INPUT_CLASS}
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
              >
                {CREATABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {fr.roles[role]}
                  </option>
                ))}
              </select>
            )}
          </Field>

          {/* Shown only for the role that may carry one, so the interface
              cannot suggest an impossible combination. */}
          {form.role === Role.TEAM_MEMBER && (
            <Field label={fr.users.skill} hint={fr.users.skillHint} error={fieldErrors.skill}>
              {({ id, describedBy }) => (
                <select
                  id={id}
                  aria-describedby={describedBy}
                  className={INPUT_CLASS}
                  value={form.skill}
                  onChange={(event) => setForm({ ...form, skill: event.target.value as Skill })}
                >
                  {Object.values(Skill).map((skill) => (
                    <option key={skill} value={skill}>
                      {fr.skills[skill]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}

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
              disabled={createUser.isPending}
            >
              {createUser.isPending ? fr.common.loading : fr.common.create}
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className={`${INPUT_CLASS} max-w-xs`}
          placeholder={fr.users.searchPlaceholder}
          aria-label={fr.common.search}
          value={query.search ?? ''}
          onChange={(event) => setQuery({ ...query, search: event.target.value, page: 1 })}
        />

        <select
          className={`${INPUT_CLASS} max-w-xs`}
          aria-label={fr.users.role}
          value={query.role ?? ''}
          onChange={(event) =>
            setQuery({ ...query, role: (event.target.value || undefined) as Role, page: 1 })
          }
        >
          <option value="">{fr.users.filterByRole}</option>
          {Object.values(Role).map((role) => (
            <option key={role} value={role}>
              {fr.roles[role]}
            </option>
          ))}
        </select>
      </div>

      <QueryBoundary
        query={users}
        isEmpty={(data) => data.items.length === 0}
        emptyMessage={fr.common.emptyList}
      >
        {(data) => (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">{fr.users.name}</th>
                    <th className="px-4 py-3">{fr.users.username}</th>
                    <th className="px-4 py-3">{fr.users.email}</th>
                    <th className="px-4 py-3">{fr.users.role}</th>
                    <th className="px-4 py-3">{fr.users.skill}</th>
                    <th className="px-4 py-3">{fr.users.active}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((user) => (
                    <tr key={user.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 text-slate-900">{user.name}</td>
                      <td className="px-4 py-3 text-slate-600">{user.username}</td>
                      <td className="px-4 py-3 text-slate-600">{user.email}</td>
                      <td className="px-4 py-3 text-slate-600">{fr.roles[user.role]}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {user.skill ? fr.skills[user.skill] : fr.common.none}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {user.isActive ? fr.users.active : fr.users.inactive}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <nav className="mt-4 flex items-center gap-3" aria-label={fr.common.pageOf(1, 1)}>
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
