import { ALLOWED_FILE_EXTENSIONS } from '@agencyflow/contracts';
import type { DeliverableDetail, ProjectDetail } from '@agencyflow/contracts';
import { useState, type ChangeEvent, type FormEvent } from 'react';

import { Field, INPUT_CLASS } from '../../components/shared/Field';
import { QueryBoundary } from '../../components/shared/QueryBoundary';
import { useAuth } from '../auth/AuthContext';
import {
  canAuthor,
  canDecide,
  canStartReview,
  canSubmit,
  currentVersionFileCount,
  isFinal,
} from './deliverable-permissions';
import {
  useCreateDeliverable,
  useDeliverable,
  useDeliverableCommand,
  useDeliverables,
  useDownloadDeliverableFile,
  useUploadDeliverableFile,
} from './useDeliverables';
import { fr } from '../../i18n/fr';
import { ApiError } from '../../lib/api-client';
import { formatDate } from '../../lib/format';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  UNDER_REVIEW: 'bg-violet-100 text-violet-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  CHANGES_REQUESTED: 'bg-amber-100 text-amber-900',
};

/**
 * FR-052 — the project's deliverables.
 *
 * Unlike the task board, this IS shown to a Client Contact: the approval loop
 * is the whole reason they have an account. What differs by role is which
 * actions appear, and that asymmetry lives in `deliverable-permissions`.
 */
export function DeliverablesPanel({ project }: { project: ProjectDetail }) {
  const { user } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);

  const deliverables = useDeliverables({ projectId: project.id, pageSize: 50 });
  const isManager = user?.role === 'ADMINISTRATOR' || user?.role === 'PROJECT_MANAGER';

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-slate-700">
        {fr.deliverables.title} ({deliverables.data?.totalItems ?? 0})
      </h2>

      {isManager && !project.isArchived && <CreateDeliverableForm projectId={project.id} />}

      <QueryBoundary
        query={deliverables}
        isEmpty={(data) => data.items.length === 0}
        emptyMessage={fr.deliverables.empty}
      >
        {(data) => (
          <ul className="space-y-2">
            {data.items.map((deliverable) => (
              <li key={deliverable.id} className="rounded-lg border border-slate-200 p-3">
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                  onClick={() => setOpenId(openId === deliverable.id ? null : deliverable.id)}
                  aria-expanded={openId === deliverable.id}
                >
                  <span>
                    <span className="text-sm font-medium text-slate-900">{deliverable.name}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      {fr.deliverables.version} {deliverable.currentVersionNumber}
                      {deliverable.dueDate && ` · ${formatDate(deliverable.dueDate)}`}
                    </span>
                  </span>

                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[deliverable.status]}`}
                  >
                    {fr.deliverableStatus[deliverable.status]}
                  </span>
                </button>

                {openId === deliverable.id && <DeliverableDetailPanel id={deliverable.id} />}
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
    </section>
  );
}

/** The approval loop itself. */
function DeliverableDetailPanel({ id }: { id: string }) {
  const deliverable = useDeliverable(id);

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <QueryBoundary query={deliverable}>
        {(data) => <DeliverableActions deliverable={data} />}
      </QueryBoundary>
    </div>
  );
}

function DeliverableActions({ deliverable }: { deliverable: DeliverableDetail }) {
  const { user } = useAuth();
  const command = useDeliverableCommand(deliverable.id);
  const upload = useUploadDeliverableFile(deliverable.id);
  const download = useDownloadDeliverableFile(deliverable.id);

  const current = deliverable.versions.find(
    (version) => version.versionNumber === deliverable.currentVersionNumber,
  );
  const history = deliverable.versions.filter(
    (version) => version.versionNumber !== deliverable.currentVersionNumber,
  );

  const error = command.error ?? upload.error ?? download.error;

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      upload.mutate(file);
    }
    // Cleared so selecting the same file twice fires a change event again -
    // otherwise a retry after a rejection silently does nothing.
    event.target.value = '';
  }

  return (
    <>
      {/* BR-07 stated, not merely enforced. Without this the page would simply
          have no controls, which reads as a bug rather than as finality. */}
      {isFinal(deliverable) && (
        <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {fr.deliverables.approvedNotice}
        </p>
      )}

      <div className="mb-3">
        <h3 className="text-xs font-medium uppercase text-slate-500">
          {fr.deliverables.version} {deliverable.currentVersionNumber}
        </h3>

        {current && current.files.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {current.files.map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-700">{file.originalName}</span>
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100"
                  onClick={() => download.mutate({ fileId: file.id, filename: file.originalName })}
                >
                  {fr.deliverables.download}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-slate-600">{fr.deliverables.noFiles}</p>
        )}
      </div>

      {canAuthor(user, deliverable) && (
        <div className="mb-3">
          <label className="text-sm text-slate-700">
            {fr.deliverables.addFile}
            <input
              type="file"
              className="mt-1 block w-full text-sm"
              accept={ALLOWED_FILE_EXTENSIONS.map((extension) => `.${extension}`).join(',')}
              onChange={handleUpload}
              disabled={upload.isPending}
            />
          </label>
          {/* The accept attribute is a convenience only — the server inspects
              the bytes regardless (BR-15, NFR-24). */}
          <p className="mt-1 text-xs text-slate-500">{fr.deliverables.allowedFormats}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {canAuthor(user, deliverable) && (
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            disabled={!canSubmit(user, deliverable) || command.isPending}
            title={
              currentVersionFileCount(deliverable) === 0
                ? fr.deliverables.submitNeedsFile
                : undefined
            }
            onClick={() => command.mutate({ command: 'submit' })}
          >
            {fr.deliverables.submit}
          </button>
        )}

        {canStartReview(user, deliverable) && (
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
            disabled={command.isPending}
            onClick={() => command.mutate({ command: 'start-review' })}
          >
            {fr.deliverables.startReview}
          </button>
        )}

        {canDecide(user, deliverable) && (
          <>
            <button
              type="button"
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              disabled={command.isPending}
              onClick={() => command.mutate({ command: 'approve' })}
            >
              {fr.deliverables.approve}
            </button>

            <button
              type="button"
              className="rounded-md border border-amber-400 px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-50 disabled:opacity-50"
              disabled={command.isPending}
              onClick={() => {
                // FR-049 — the comment is mandatory. A cancelled or empty
                // prompt sends nothing: inventing a placeholder would satisfy
                // the rule while leaving the manager nothing to act on.
                const comment = window.prompt(fr.deliverables.changesPrompt);
                if (comment && comment.trim()) {
                  command.mutate({ command: 'request-changes', comment });
                }
              }}
            >
              {fr.deliverables.requestChanges}
            </button>
          </>
        )}

        {deliverable.status === 'SUBMITTED' && !canDecide(user, deliverable) && (
          <span className="self-center text-sm text-slate-500">
            {fr.deliverables.awaitingClient}
          </span>
        )}
      </div>

      {/* FR-054 — the whole negotiation, preserved (BR-06). */}
      {history.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-medium uppercase text-slate-500">
            {fr.deliverables.versionHistory}
          </h3>

          <ul className="mt-1 space-y-2">
            {history
              .slice()
              .sort((a, b) => b.versionNumber - a.versionNumber)
              .map((version) => (
                <li key={version.versionNumber} className="rounded border border-slate-100 p-2">
                  <p className="text-xs text-slate-600">
                    {fr.deliverables.version} {version.versionNumber} ·{' '}
                    {fr.versionOutcome[version.outcome]}
                    {version.decidedAt && ` · ${formatDate(version.decidedAt)}`}
                  </p>

                  {version.decisionComment && (
                    <p className="mt-1 text-sm text-slate-700">
                      <span className="text-slate-500">{fr.deliverables.decisionComment} : </span>
                      {version.decisionComment}
                    </p>
                  )}

                  <ul className="mt-1 space-y-0.5">
                    {version.files.map((file) => (
                      <li key={file.id} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-600">{file.originalName}</span>
                        <button
                          type="button"
                          className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100"
                          onClick={() =>
                            download.mutate({ fileId: file.id, filename: file.originalName })
                          }
                        >
                          {fr.deliverables.download}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
          </ul>
        </div>
      )}

      {error instanceof ApiError && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error.message}
        </p>
      )}
    </>
  );
}

/** FR-045 */
function CreateDeliverableForm({ projectId }: { projectId: string }) {
  const createDeliverable = useCreateDeliverable(projectId);
  const [form, setForm] = useState({ name: '', dueDate: '' });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    createDeliverable.mutate(
      { name: form.name, ...(form.dueDate ? { dueDate: form.dueDate } : {}) },
      { onSuccess: () => setForm({ name: '', dueDate: '' }) },
    );
  }

  return (
    <form className="mb-4 grid gap-3 sm:grid-cols-3" onSubmit={handleSubmit} noValidate>
      <Field label={fr.deliverables.name}>
        {({ id }) => (
          <input
            id={id}
            className={INPUT_CLASS}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        )}
      </Field>

      <Field label={fr.deliverables.dueDate}>
        {({ id }) => (
          <input
            id={id}
            className={INPUT_CLASS}
            type="date"
            value={form.dueDate}
            onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
          />
        )}
      </Field>

      <div className="flex items-end">
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          disabled={createDeliverable.isPending}
        >
          {fr.deliverables.createTitle}
        </button>
      </div>

      {createDeliverable.error instanceof ApiError && (
        <p
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 sm:col-span-3"
          role="alert"
        >
          {createDeliverable.error.message}
        </p>
      )}
    </form>
  );
}
