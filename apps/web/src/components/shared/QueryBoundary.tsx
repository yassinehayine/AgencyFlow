import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { fr } from '../../i18n/fr';

/**
 * Renders the four states every data view must handle: loading, error, empty
 * and success (09-Frontend-Design.md section 9.1).
 *
 * Handling them here rather than per screen makes omission impossible: a
 * component cannot forget a state it never writes. NFR-09 requires that every
 * action produces visible feedback, and this is the structural way to get it.
 */

/** After this long, a pending first request is treated as a cold start. */
const COLD_START_HINT_MS = 5000;

interface QueryBoundaryProps<TData> {
  query: UseQueryResult<TData>;
  children: (data: TData) => ReactNode;
  isEmpty?: (data: TData) => boolean;
  emptyMessage?: string;
}

export function QueryBoundary<TData>({
  query,
  children,
  isEmpty,
  emptyMessage,
}: QueryBoundaryProps<TData>) {
  const [showColdStartHint, setShowColdStartHint] = useState(false);
  const isPending = query.isPending;

  useEffect(() => {
    if (!isPending) {
      setShowColdStartHint(false);
      return;
    }

    const timer = setTimeout(() => setShowColdStartHint(true), COLD_START_HINT_MS);
    return () => clearTimeout(timer);
  }, [isPending]);

  if (isPending) {
    return (
      <div className="flex flex-col items-center gap-3 py-10" role="status" aria-live="polite">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
          aria-hidden="true"
        />
        <p className="text-sm text-slate-600">
          {showColdStartHint ? fr.coldStart.message : fr.common.loading}
        </p>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
        <p className="text-sm font-medium text-red-800">{fr.common.error}</p>
        <p className="mt-1 text-sm text-red-700">{query.error.message}</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          {fr.common.retry}
        </button>
      </div>
    );
  }

  if (isEmpty?.(query.data)) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
        <p className="text-sm text-slate-600">{emptyMessage ?? ''}</p>
      </div>
    );
  }

  return <>{children(query.data)}</>;
}
