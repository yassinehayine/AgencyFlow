import { DependencyStatus, type HealthResponse } from '@agencyflow/contracts';

import { QueryBoundary } from '../components/shared/QueryBoundary';
import { useHealth } from '../features/health/useHealth';
import { fr } from '../i18n/fr';

/**
 * Slice 1 verification page.
 *
 * Proves the full stack is wired end to end: React renders, TanStack Query
 * fetches, the Vite proxy reaches NestJS, and NestJS reports on MongoDB and
 * Cloudinary. It is replaced by the real dashboards in a later slice.
 */

function StatusPill({ status }: { status: DependencyStatus }) {
  const styles: Record<DependencyStatus, string> = {
    [DependencyStatus.UP]: 'bg-green-100 text-green-800 ring-green-600/20',
    [DependencyStatus.DOWN]: 'bg-red-100 text-red-800 ring-red-600/20',
    [DependencyStatus.UNKNOWN]: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  };

  const labels: Record<DependencyStatus, string> = {
    [DependencyStatus.UP]: fr.status.up,
    [DependencyStatus.DOWN]: fr.status.down,
    [DependencyStatus.UNKNOWN]: fr.status.unknown,
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function StatusRow({ label, status }: { label: string; status: DependencyStatus }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0">
      <span className="text-sm text-slate-700">{label}</span>
      <StatusPill status={status} />
    </div>
  );
}

export function SystemStatusPage() {
  const health = useHealth();

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">{fr.common.appName}</h1>
        <h2 className="mt-1 text-lg text-slate-700">{fr.health.title}</h2>
        <p className="mt-2 text-sm text-slate-500">{fr.health.subtitle}</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <QueryBoundary query={health}>
          {(data: HealthResponse) => (
            <>
              <StatusRow label={fr.health.apiReachable} status={DependencyStatus.UP} />
              <StatusRow label={fr.health.database} status={data.dependencies.database} />
              <StatusRow label={fr.health.storage} status={data.dependencies.storage} />

              <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
                <div>
                  <dt className="text-slate-500">{fr.health.version}</dt>
                  <dd className="font-medium text-slate-900">{data.version}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{fr.health.uptime}</dt>
                  <dd className="font-medium text-slate-900">
                    {data.uptimeSeconds}
                    {fr.health.seconds}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </QueryBoundary>
      </section>
    </main>
  );
}
