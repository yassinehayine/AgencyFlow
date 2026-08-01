import type {
  ClientListQuery,
  CreateClientContactRequest,
  CreateClientRequest,
} from '@agencyflow/contracts';
import { useState, type FormEvent } from 'react';

import { Field, INPUT_CLASS } from '../components/shared/Field';
import { QueryBoundary } from '../components/shared/QueryBoundary';
import {
  useClientContacts,
  useClients,
  useCreateClient,
  useCreateClientContact,
} from '../features/clients/useClients';
import { fr } from '../i18n/fr';
import { ApiError } from '../lib/api-client';

const EMPTY_CLIENT: CreateClientRequest = { name: '', contactEmail: '', contactPhone: '' };
const EMPTY_CONTACT: CreateClientContactRequest = {
  name: '',
  username: '',
  email: '',
  password: '',
};

function messageOf(error: unknown): string | null {
  return error instanceof ApiError ? error.message : null;
}

/** FR-013 – FR-017. Administrator, and Project Manager for reads and contacts. */
export function ClientsPage() {
  const [query, setQuery] = useState<ClientListQuery>({ page: 1, pageSize: 20 });
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const clients = useClients(query);
  const createClient = useCreateClient();

  function handleCreateClient(event: FormEvent) {
    event.preventDefault();

    // Empty optional strings are dropped rather than sent. `contactEmail: ''`
    // fails @IsEmail on the server, which would report a validation error for
    // a field the user deliberately left blank.
    const payload: CreateClientRequest = {
      name: clientForm.name,
      ...(clientForm.contactEmail ? { contactEmail: clientForm.contactEmail } : {}),
      ...(clientForm.contactPhone ? { contactPhone: clientForm.contactPhone } : {}),
    };

    createClient.mutate(payload, { onSuccess: () => setClientForm(EMPTY_CLIENT) });
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">{fr.clients.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{fr.clients.subtitle}</p>
      </header>

      <form
        className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-3"
        onSubmit={handleCreateClient}
        noValidate
      >
        <Field label={fr.clients.name}>
          {({ id }) => (
            <input
              id={id}
              className={INPUT_CLASS}
              value={clientForm.name}
              onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })}
            />
          )}
        </Field>

        <Field label={fr.clients.contactEmail}>
          {({ id }) => (
            <input
              id={id}
              className={INPUT_CLASS}
              type="email"
              value={clientForm.contactEmail ?? ''}
              onChange={(event) =>
                setClientForm({ ...clientForm, contactEmail: event.target.value })
              }
            />
          )}
        </Field>

        <Field label={fr.clients.contactPhone}>
          {({ id }) => (
            <input
              id={id}
              className={INPUT_CLASS}
              value={clientForm.contactPhone ?? ''}
              onChange={(event) =>
                setClientForm({ ...clientForm, contactPhone: event.target.value })
              }
            />
          )}
        </Field>

        {messageOf(createClient.error) && (
          <p
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 sm:col-span-3"
            role="alert"
          >
            {messageOf(createClient.error)}
          </p>
        )}

        <div className="sm:col-span-3">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            disabled={createClient.isPending}
          >
            {createClient.isPending ? fr.common.loading : fr.common.create}
          </button>
        </div>
      </form>

      <input
        className={`${INPUT_CLASS} mb-4 max-w-xs`}
        placeholder={fr.clients.searchPlaceholder}
        aria-label={fr.common.search}
        value={query.search ?? ''}
        onChange={(event) => setQuery({ ...query, search: event.target.value, page: 1 })}
      />

      <QueryBoundary
        query={clients}
        isEmpty={(data) => data.items.length === 0}
        emptyMessage={fr.common.emptyList}
      >
        {(data) => (
          <ul className="space-y-3">
            {data.items.map((client) => (
              <li key={client.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">
                      {client.name}
                      {client.isArchived && (
                        <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {fr.clients.archived}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-slate-600">
                      {client.contactEmail ?? fr.common.none}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
                    onClick={() => setSelectedId(selectedId === client.id ? null : client.id)}
                  >
                    {fr.clients.contacts}
                  </button>
                </div>

                {selectedId === client.id && <ContactsPanel clientId={client.id} />}
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
    </main>
  );
}

/**
 * FR-016, FR-017 — the contacts of ONE organisation.
 *
 * `clientId` is a prop that becomes a path segment, mirroring the API: there
 * is no control anywhere in this form that could name a different
 * organisation, so BR-10 cannot be violated by a user-interface mistake.
 */
function ContactsPanel({ clientId }: { clientId: string }) {
  const contacts = useClientContacts(clientId);
  const createContact = useCreateClientContact(clientId);
  const [form, setForm] = useState(EMPTY_CONTACT);

  const fieldErrors =
    createContact.error instanceof ApiError
      ? Object.fromEntries(
          (createContact.error.details ?? []).map((detail) => [detail.field, detail.message]),
        )
      : {};

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createContact.mutate(form, { onSuccess: () => setForm(EMPTY_CONTACT) });
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <QueryBoundary
        query={contacts}
        isEmpty={(data) => data.length === 0}
        emptyMessage={fr.common.emptyList}
      >
        {(data) => (
          <ul className="mb-4 space-y-1 text-sm text-slate-600">
            {data.map((contact) => (
              <li key={contact.id}>
                {contact.name} · {contact.email}
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>

      <form className="grid gap-3 sm:grid-cols-4" onSubmit={handleSubmit} noValidate>
        <Field label={fr.users.name} error={fieldErrors.name}>
          {({ id }) => (
            <input
              id={id}
              className={INPUT_CLASS}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          )}
        </Field>

        <Field label={fr.users.username} error={fieldErrors.username}>
          {({ id }) => (
            <input
              id={id}
              className={INPUT_CLASS}
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
            />
          )}
        </Field>

        <Field label={fr.users.email} error={fieldErrors.email}>
          {({ id }) => (
            <input
              id={id}
              className={INPUT_CLASS}
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          )}
        </Field>

        <Field label={fr.users.password} error={fieldErrors.password}>
          {({ id }) => (
            <input
              id={id}
              className={INPUT_CLASS}
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          )}
        </Field>

        {messageOf(createContact.error) && Object.keys(fieldErrors).length === 0 && (
          <p
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 sm:col-span-4"
            role="alert"
          >
            {messageOf(createContact.error)}
          </p>
        )}

        <div className="sm:col-span-4">
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-60"
            disabled={createContact.isPending}
          >
            {fr.clients.addContact}
          </button>
        </div>
      </form>
    </div>
  );
}
