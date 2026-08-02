import { classifyDeadline } from '@agencyflow/contracts';
import type {
  DashboardDeliverable,
  DashboardList,
  DashboardProject,
  DashboardTask,
} from '@agencyflow/contracts';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { projectPath } from '../../app/routes';
import { fr } from '../../i18n/fr';
import { formatDate } from '../../lib/format';

/**
 * The pieces every dashboard is built from.
 *
 * Shared between the internal workspace and the client portal on purpose: a
 * progress bar and a deliverable row mean the same thing to both audiences, so
 * two implementations would only be two chances to disagree about what a
 * percentage is. What differs between the trees is the LAYOUT around them —
 * which is the layouts' job, not these components'.
 *
 * Everything here is sized for a 375 px viewport, because the portal uses it
 * and TC-073 is the harder constraint. The internal screens lose nothing by
 * meeting it too.
 */

/** A titled block. `total` renders the "10 of 27" that keeps a cap honest. */
export function Panel({
  title,
  count,
  emphasis = false,
  children,
}: {
  title: string;
  count?: DashboardList<unknown>;
  emphasis?: boolean;
  children: ReactNode;
}) {
  const truncated = count && count.total > count.items.length;

  return (
    <section
      className={`mb-4 rounded-xl border bg-white p-4 ${
        // US-059 — the client's pending approvals are the most prominent thing
        // on their page. Weight rather than colour alone (NFR-11).
        emphasis ? 'border-slate-900 shadow-sm' : 'border-slate-200'
      }`}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          className={`text-sm ${emphasis ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}
        >
          {title}
        </h2>

        {count && (
          <span className="text-xs text-slate-500">
            {truncated
              ? fr.dashboard.showingOf(count.items.length, count.total)
              : fr.dashboard.count(count.total)}
          </span>
        )}
      </div>

      {children}
    </section>
  );
}

export function Empty({ message }: { message: string }) {
  return <p className="text-sm text-slate-600">{message}</p>;
}

/**
 * FR-072 — where one due date falls.
 *
 * Uses `classifyDeadline` from the contracts package: the SAME function the API
 * turns into its date range. If the badge computed its own boundaries, a task
 * could arrive in the "en retard" list carrying a badge that said otherwise,
 * and the page would be arguing with itself.
 *
 * `LATER` renders the date plainly. A green "on track" badge on every dated row
 * would be a wall of reassurance that makes the two that matter harder to find.
 */
export function DeadlineBadge({ dueDate }: { dueDate?: string }) {
  const state = classifyDeadline(dueDate);

  if (!state) {
    return null;
  }

  if (state === 'LATER') {
    return <span className="text-xs text-slate-500">{formatDate(dueDate)}</span>;
  }

  const style = state === 'OVERDUE' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900';

  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${style}`}>
      {/* The word, not only the colour (NFR-11). */}
      {state === 'OVERDUE' ? fr.dashboard.overdue : fr.dashboard.dueSoon} · {formatDate(dueDate)}
    </span>
  );
}

export function ProgressBar({ progress }: { progress: number }) {
  return (
    // aria-hidden: the percentage is already text next to it, and announcing
    // the same number twice is noise for a screen reader.
    <div className="mt-1 h-1.5 w-full rounded bg-slate-100" aria-hidden="true">
      <div className="h-1.5 rounded bg-slate-700" style={{ width: `${progress}%` }} />
    </div>
  );
}

export function TaskRow({ task }: { task: DashboardTask }) {
  const { user } = useAuth();

  return (
    <li className="py-2">
      {/* `flex-wrap` and not a grid: at 375 px the badge drops onto its own
          line instead of squeezing the title into two characters a line. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm text-slate-800">{task.title}</span>
        <DeadlineBadge dueDate={task.dueDate} />
      </div>

      <p className="mt-0.5 text-xs text-slate-500">
        <Link to={projectPath(user, task.projectId)} className="hover:text-slate-900">
          {task.projectName}
        </Link>
        {task.assigneeName && ` · ${task.assigneeName}`}
      </p>

      {/* BR-22 — a blocked task without its reason is just a task nobody is
          doing. US-056 asks for the reason on the dashboard specifically. */}
      {task.blockedReason && (
        <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
          {fr.tasks.blockedBecause} {task.blockedReason}
        </p>
      )}
    </li>
  );
}

export function ProjectRow({ project }: { project: DashboardProject }) {
  const { user } = useAuth();

  return (
    <li className="py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Link
          to={projectPath(user, project.id)}
          className="text-sm font-medium text-slate-800 hover:text-slate-900 hover:underline"
        >
          {project.name}
        </Link>
        <span className="text-xs text-slate-500">
          {project.progress}% · {formatDate(project.endDate)}
        </span>
      </div>

      <p className="text-xs text-slate-500">
        {project.clientName}
        {/* Absent for a client (BR-28), so this is a presence check and not a
            truthiness one: zero outstanding tasks is a real, useful figure. */}
        {project.openTaskCount !== undefined &&
          ` · ${fr.dashboard.openTasks(project.openTaskCount)}`}
      </p>

      <ProgressBar progress={project.progress} />
    </li>
  );
}

export function DeliverableRow({ deliverable }: { deliverable: DashboardDeliverable }) {
  const { user } = useAuth();

  return (
    <li className="py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Link
          to={projectPath(user, deliverable.projectId)}
          className="text-sm font-medium text-slate-800 hover:text-slate-900 hover:underline"
        >
          {deliverable.name}
        </Link>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          {fr.deliverableStatus[deliverable.status]}
        </span>
      </div>

      <p className="text-xs text-slate-500">
        {deliverable.projectName} · {fr.deliverables.version} {deliverable.currentVersionNumber}
        {deliverable.submittedAt && ` · ${formatDate(deliverable.submittedAt)}`}
        {deliverable.approvedAt && ` · ${formatDate(deliverable.approvedAt)}`}
      </p>
    </li>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-slate-100">{children}</ul>;
}

/** A headline figure. Deliberately large: it is the answer, not a label. */
export function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-lg font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-600">{label}</p>
    </div>
  );
}
