/**
 * Dashboard contracts (FR-068 – FR-071, 08-Backend-Design.md §2.1).
 *
 * One endpoint, `GET /dashboard`, whose shape depends on who is asking. The
 * four shapes are a **discriminated union on `role`**, which is the design
 * decision worth stating: it makes the client narrow before it can read a
 * field, so there is no way to render a Team Member's task board from an
 * Administrator's response, and no optional-field soup where every property is
 * `?` because some role somewhere does not get it.
 *
 * It also encodes BR-28 in the type system. `ClientDashboard` has no task
 * field at all — not an empty array, not an optional one. A component holding a
 * client dashboard cannot display internal work, because there is nothing to
 * display and the compiler says so.
 */
import type { DeliverableStatus, ProjectStatus, TaskStatus } from './enums.js';

/**
 * A capped list and the true total.
 *
 * Every list here is bounded, because a dashboard is a call to action rather
 * than an archive and QA-4 asks it to stay fast with a thousand projects. The
 * total travels with it so the interface can say "10 of 27" — a truncated list
 * that does not admit it is truncated is worse than no list, since the reader
 * concludes there are only ten.
 */
export interface DashboardList<TItem> {
  items: TItem[];
  total: number;
}

export const DASHBOARD_LIMITS = {
  /** Attention lists: what to act on now. */
  ATTENTION: 10,
  /** A Team Member's own board — their whole open workload, not a sample. */
  MY_TASKS: 100,
  PROJECTS: 20,
  MILESTONES: 10,
  WORKLOAD: 20,
} as const;

/**
 * A task as a dashboard shows it: never in isolation.
 *
 * `projectName` is included rather than just `projectId` because these lists
 * are cross-project by nature — US-055 requires overdue tasks to be listed
 * *with their project*, and an id is not an answer to "where is this?".
 */
export interface DashboardTask {
  id: string;
  title: string;
  status: TaskStatus;
  projectId: string;
  projectName: string;
  assigneeId: string;
  assigneeName: string;
  dueDate?: string;
  /** Present only while `status` is `BLOCKED` — US-056 asks for the reason. */
  blockedReason?: string;
}

export interface DashboardDeliverable {
  id: string;
  name: string;
  status: DeliverableStatus;
  projectId: string;
  projectName: string;
  currentVersionNumber: number;
  dueDate?: string;
  submittedAt?: string;
  approvedAt?: string;
}

export interface DashboardProject {
  id: string;
  name: string;
  clientName: string;
  status: ProjectStatus;
  endDate: string;
  /**
   * 0–100 over the project's non-cancelled tasks (BR-12).
   *
   * Deliberately NOT the mean of the milestone percentages: that would weight a
   * one-task milestone the same as a forty-task one, so finishing the small one
   * would move the headline figure further than finishing most of the big one.
   */
  progress: number;
  /** Absent for a Client Contact — task counts are internal (BR-28). */
  openTaskCount?: number;
}

/**
 * A milestone still ahead (FR-071).
 *
 * Carries no `status` and no `progress`, unlike `MilestoneView`. Both are
 * computed from a task aggregation per project (BR-08), and this list answers
 * "what is coming", not "how far along" — so rather than pay for the
 * aggregation or ship a zero that means "not calculated", the fields are
 * absent. A number nobody computed is worse than no number: it looks answered.
 */
export interface DashboardMilestone {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  dueDate: string;
}

/** FR-072 — computed at read time on every request (BR-20). */
export interface DeadlineAlerts {
  dueSoon: DashboardList<DashboardTask>;
  overdue: DashboardList<DashboardTask>;
}

/** FR-068 — how much work each Team Member is carrying. */
export interface WorkloadEntry {
  userId: string;
  name: string;
  openTaskCount: number;
  overdueTaskCount: number;
}

/** FR-068 */
export interface AdministratorDashboard {
  role: 'ADMINISTRATOR';
  /** Every status is present, including the zeroes: "0 on hold" is a figure. */
  projectCountsByStatus: Record<ProjectStatus, number>;
  activeProjects: DashboardList<DashboardProject>;
  teamWorkload: WorkloadEntry[];
  /** Agency-wide, across every project — the view an Administrator lacks today. */
  overdueTasks: DashboardList<DashboardTask>;
  awaitingClientApproval: DashboardList<DashboardDeliverable>;
}

/** FR-069 — scoped to owned projects only (BR-25). */
export interface ProjectManagerDashboard {
  role: 'PROJECT_MANAGER';
  myProjects: DashboardList<DashboardProject>;
  /** The primary call to action: `IN_REVIEW` tasks only a manager can clear (BR-04). */
  awaitingMyReview: DashboardList<DashboardTask>;
  awaitingClientResponse: DashboardList<DashboardDeliverable>;
  blockedTasks: DashboardList<DashboardTask>;
  alerts: DeadlineAlerts;
}

/**
 * A column of the Team Member's board.
 *
 * An ordered array rather than `Record<TaskStatus, …>`, because the order is
 * part of the meaning — `TODO → IN_PROGRESS → IN_REVIEW → BLOCKED` is the shape
 * of the working day — and object key order is not something to rely on.
 */
export interface TaskStatusGroup {
  status: TaskStatus;
  tasks: DashboardTask[];
}

/** FR-070 — scoped to tasks assigned to the caller (BR-26). */
export interface TeamMemberDashboard {
  role: 'TEAM_MEMBER';
  tasksByStatus: TaskStatusGroup[];
  alerts: DeadlineAlerts;
  /** Finished work, as a number: it belongs on the dashboard, not in the columns. */
  completedTaskCount: number;
}

/** FR-071 — scoped strictly to the contact's own organisation (BR-10). */
export interface ClientDashboard {
  role: 'CLIENT_CONTACT';
  projects: DashboardList<DashboardProject>;
  /** US-059 — the most prominent item on the page when it is non-empty. */
  awaitingMyApproval: DashboardList<DashboardDeliverable>;
  recentlyApproved: DashboardList<DashboardDeliverable>;
  upcomingMilestones: DashboardList<DashboardMilestone>;
}

export type DashboardResponse =
  AdministratorDashboard | ProjectManagerDashboard | TeamMemberDashboard | ClientDashboard;
