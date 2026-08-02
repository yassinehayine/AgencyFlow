import { Role } from '@agencyflow/contracts';
import type { ClientDashboard, DashboardResponse } from '@agencyflow/contracts';
import { Link } from 'react-router-dom';

import { QueryBoundary } from '../components/shared/QueryBoundary';
import {
  DeliverableRow,
  Empty,
  List,
  Panel,
  ProjectRow,
} from '../features/dashboard/DashboardParts';
import { useDashboard } from '../features/dashboard/useDashboard';
import { fr } from '../i18n/fr';
import { formatDate } from '../lib/format';

/**
 * `/portal/dashboard` — FR-071, FR-073, US-059, US-060.
 *
 * The client's landing page, and the answer to P-4: an organisation that today
 * has to email its Project Manager to find out how a project is going.
 *
 * **Ordering is the design decision here.** Pending approvals come first,
 * before progress, because US-059 requires them to be the most prominent item
 * and because they are the only thing on this page the client can *act* on —
 * everything else is a report. On a phone that ordering is not a preference:
 * the second panel is already below the fold at 375 px.
 *
 * There is no task panel, and none is possible: `ClientDashboard` has no field
 * to hold one (BR-28).
 */
export function PortalDashboardPage() {
  const dashboard = useDashboard();

  return (
    // Narrower gutters than the internal pages. At 375 px a 24 px gutter each
    // side spends 13% of the screen on nothing (NFR-08).
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <QueryBoundary query={dashboard}>{(data) => <PortalView data={data} />}</QueryBoundary>
    </main>
  );
}

function PortalView({ data }: { data: DashboardResponse }) {
  // Narrowing rather than trusting the route guard. The guard decides what
  // renders; this decides what may be read, and only one of the two survives
  // somebody rearranging the router.
  if (data.role !== Role.CLIENT_CONTACT) {
    return <Empty message={fr.dashboard.empty} />;
  }

  return <ClientView data={data} />;
}

function ClientView({ data }: { data: ClientDashboard }) {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">{fr.dashboard.portalTitle}</h1>

      {/* US-059 — "when I log in, then it is the most prominent item on the
          page". First, emphasised, and the only panel with a call to action. */}
      <Panel title={fr.dashboard.awaitingMyApproval} count={data.awaitingMyApproval} emphasis>
        {data.awaitingMyApproval.items.length === 0 ? (
          <Empty message={fr.dashboard.nothingToApprove} />
        ) : (
          <List>
            {data.awaitingMyApproval.items.map((deliverable) => (
              <DeliverableRow key={deliverable.id} deliverable={deliverable} />
            ))}
          </List>
        )}
      </Panel>

      <Panel title={fr.dashboard.myProjects} count={data.projects}>
        {data.projects.items.length === 0 ? (
          <Empty message={fr.dashboard.noProjects} />
        ) : (
          <List>
            {data.projects.items.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </List>
        )}
      </Panel>

      <Panel title={fr.dashboard.upcomingMilestones} count={data.upcomingMilestones}>
        {data.upcomingMilestones.items.length === 0 ? (
          <Empty message={fr.dashboard.noUpcomingMilestones} />
        ) : (
          <List>
            {data.upcomingMilestones.items.map((milestone) => (
              <li
                key={milestone.id}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2"
              >
                <span className="text-sm text-slate-800">{milestone.name}</span>
                <span className="text-xs text-slate-500">{formatDate(milestone.dueDate)}</span>
                <Link
                  to={`/portal/projects/${milestone.projectId}`}
                  className="w-full text-xs text-slate-500 hover:text-slate-900"
                >
                  {milestone.projectName}
                </Link>
              </li>
            ))}
          </List>
        )}
      </Panel>

      {/* Last, because it is a record rather than a request. It earns its place
          because an approval is a formal acceptance and a client should be able
          to see what they have signed off without hunting for it. */}
      <Panel title={fr.dashboard.recentlyApproved} count={data.recentlyApproved}>
        {data.recentlyApproved.items.length === 0 ? (
          <Empty message={fr.dashboard.nothingApprovedYet} />
        ) : (
          <List>
            {data.recentlyApproved.items.map((deliverable) => (
              <DeliverableRow key={deliverable.id} deliverable={deliverable} />
            ))}
          </List>
        )}
      </Panel>
    </>
  );
}
