import { Role } from '@agencyflow/contracts';
import type {
  AdministratorDashboard,
  DashboardResponse,
  DeadlineAlerts,
  ProjectManagerDashboard,
  TeamMemberDashboard,
} from '@agencyflow/contracts';

import { QueryBoundary } from '../components/shared/QueryBoundary';
import {
  DeliverableRow,
  Empty,
  List,
  Panel,
  ProjectRow,
  TaskRow,
  Tile,
} from '../features/dashboard/DashboardParts';
import { useDashboard } from '../features/dashboard/useDashboard';
import { fr } from '../i18n/fr';

/**
 * `/app/dashboard` — FR-068, FR-069, FR-070.
 *
 * Three dashboards behind one route, chosen by narrowing the discriminated
 * union the server sent. The role is never read from the session here, and
 * that is the point: the shape of the response IS the answer, so the page
 * cannot render panels the server did not fill.
 *
 * A Client Contact never reaches this component — `/app/*` redirects them to
 * their portal — so the fourth branch is a defensive fallback rather than a
 * screen anyone will see.
 */
export function DashboardPage() {
  const dashboard = useDashboard();

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <QueryBoundary query={dashboard}>{(data) => <Dashboard data={data} />}</QueryBoundary>
    </main>
  );
}

function Dashboard({ data }: { data: DashboardResponse }) {
  switch (data.role) {
    case Role.ADMINISTRATOR:
      return <AdministratorView data={data} />;
    case Role.PROJECT_MANAGER:
      return <ProjectManagerView data={data} />;
    case Role.TEAM_MEMBER:
      return <TeamMemberView data={data} />;
    default:
      return <Empty message={fr.dashboard.empty} />;
  }
}

/** FR-068 — the agency at a glance. */
function AdministratorView({ data }: { data: AdministratorDashboard }) {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">{fr.dashboard.agencyTitle}</h1>

      {/* Two columns at 375 px rather than four: four tiles across a phone
          give each figure about 80 px, which is not enough for a label. */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {Object.entries(data.projectCountsByStatus).map(([status, count]) => (
          <Tile
            key={status}
            label={fr.projectStatus[status as keyof typeof fr.projectStatus]}
            value={count}
          />
        ))}
      </div>

      {/* US-055 — overdue work agency-wide, listed WITH its project. This is
          the view an Administrator does not have today, so it leads. */}
      <Panel title={fr.dashboard.overdueAgencyWide} count={data.overdueTasks} emphasis>
        {data.overdueTasks.items.length === 0 ? (
          <Empty message={fr.dashboard.noOverdue} />
        ) : (
          <List>
            {data.overdueTasks.items.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </List>
        )}
      </Panel>

      <Panel title={fr.dashboard.awaitingClient} count={data.awaitingClientApproval}>
        {data.awaitingClientApproval.items.length === 0 ? (
          <Empty message={fr.dashboard.noneAwaitingClient} />
        ) : (
          <List>
            {data.awaitingClientApproval.items.map((deliverable) => (
              <DeliverableRow key={deliverable.id} deliverable={deliverable} />
            ))}
          </List>
        )}
      </Panel>

      <Panel title={fr.dashboard.workload}>
        {data.teamWorkload.length === 0 ? (
          <Empty message={fr.dashboard.noWorkload} />
        ) : (
          <List>
            {data.teamWorkload.map((entry) => (
              <li key={entry.userId} className="flex items-baseline justify-between gap-3 py-2">
                <span className="text-sm text-slate-800">{entry.name}</span>
                <span className="text-xs text-slate-500">
                  {fr.dashboard.openTasks(entry.openTaskCount)}
                  {entry.overdueTaskCount > 0 && (
                    <span className="ml-2 rounded bg-red-100 px-2 py-0.5 font-medium text-red-800">
                      {fr.dashboard.overdueCount(entry.overdueTaskCount)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </List>
        )}
      </Panel>

      <Panel title={fr.dashboard.activeProjects} count={data.activeProjects}>
        {data.activeProjects.items.length === 0 ? (
          <Empty message={fr.dashboard.noProjects} />
        ) : (
          <List>
            {data.activeProjects.items.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </List>
        )}
      </Panel>
    </>
  );
}

/** FR-069 — what needs this Project Manager today. */
function ProjectManagerView({ data }: { data: ProjectManagerDashboard }) {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">{fr.dashboard.myDayTitle}</h1>

      {/* US-056 — the primary call to action, and first for that reason.
          `IN_REVIEW` is the one status a Team Member cannot clear themselves
          (BR-04), so everything here is waiting on this person specifically. */}
      <Panel title={fr.dashboard.awaitingMyReview} count={data.awaitingMyReview} emphasis>
        {data.awaitingMyReview.items.length === 0 ? (
          <Empty message={fr.dashboard.nothingToReview} />
        ) : (
          <List>
            {data.awaitingMyReview.items.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </List>
        )}
      </Panel>

      {/* US-056 — "so that I spend my time unblocking rather than chasing". */}
      <Panel title={fr.dashboard.blocked} count={data.blockedTasks}>
        {data.blockedTasks.items.length === 0 ? (
          <Empty message={fr.dashboard.nothingBlocked} />
        ) : (
          <List>
            {data.blockedTasks.items.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </List>
        )}
      </Panel>

      <Panel title={fr.dashboard.awaitingClient} count={data.awaitingClientResponse}>
        {data.awaitingClientResponse.items.length === 0 ? (
          <Empty message={fr.dashboard.noneAwaitingClient} />
        ) : (
          <List>
            {data.awaitingClientResponse.items.map((deliverable) => (
              <DeliverableRow key={deliverable.id} deliverable={deliverable} />
            ))}
          </List>
        )}
      </Panel>

      <AlertPanels alerts={data.alerts} />

      <Panel title={fr.dashboard.myProjects} count={data.myProjects}>
        {data.myProjects.items.length === 0 ? (
          <Empty message={fr.dashboard.noProjects} />
        ) : (
          <List>
            {data.myProjects.items.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </List>
        )}
      </Panel>
    </>
  );
}

/** FR-070 — what this Team Member has to do. */
function TeamMemberView({ data }: { data: TeamMemberDashboard }) {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">{fr.dashboard.myWorkTitle}</h1>

      <AlertPanels alerts={data.alerts} />

      {/* Every column is rendered, empty ones included. A board that dropped
          its "Bloquée" column when nothing was blocked would look broken
          rather than reassuring. */}
      {data.tasksByStatus.map((group) => (
        <Panel key={group.status} title={fr.taskStatus[group.status]}>
          {group.tasks.length === 0 ? (
            <Empty message={fr.dashboard.noTasksInColumn} />
          ) : (
            <List>
              {group.tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </List>
          )}
        </Panel>
      ))}

      <p className="text-sm text-slate-600">
        {fr.dashboard.completedTotal(data.completedTaskCount)}
      </p>
    </>
  );
}

/**
 * FR-072, US-058 — the two alert lists, shown together.
 *
 * Identical for a Project Manager and a Team Member because the question is
 * the same; only the scope of the answer differs, and the server has already
 * applied it (BR-25 against BR-26).
 */
function AlertPanels({ alerts }: { alerts: DeadlineAlerts }) {
  return (
    <>
      <Panel title={fr.dashboard.overdue} count={alerts.overdue}>
        {alerts.overdue.items.length === 0 ? (
          <Empty message={fr.dashboard.noOverdue} />
        ) : (
          <List>
            {alerts.overdue.items.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </List>
        )}
      </Panel>

      <Panel title={fr.dashboard.dueSoonTitle} count={alerts.dueSoon}>
        {alerts.dueSoon.items.length === 0 ? (
          <Empty message={fr.dashboard.nothingDueSoon} />
        ) : (
          <List>
            {alerts.dueSoon.items.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </List>
        )}
      </Panel>
    </>
  );
}
