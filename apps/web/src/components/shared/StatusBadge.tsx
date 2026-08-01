import type { ProjectStatus } from '@agencyflow/contracts';

import { fr } from '../../i18n/fr';

/**
 * Colour is never the only signal (NFR-11).
 *
 * Each badge carries its French label as text, so the status is readable
 * without distinguishing the colours. A palette-only status is unusable for
 * roughly one man in twelve.
 */
const STYLES: Record<ProjectStatus, string> = {
  PLANNED: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  ON_HOLD: 'bg-amber-100 text-amber-900',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {fr.projectStatus[status]}
    </span>
  );
}
