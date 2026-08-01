/**
 * Project contracts (06-Database-Design.md section 7.3).
 *
 * A Project belongs to exactly one Client (BR-03) and has exactly one owning
 * Project Manager (BR-24). Those two fields are what every visibility rule in
 * the system is ultimately expressed against.
 */
import type { PaginationQuery } from './api.js';
import type { MilestoneStatus, ProjectStatus } from './enums.js';
import type { UserSummary } from './users.js';

export const PROJECT_LIMITS = {
  NAME_MIN: 2,
  NAME_MAX: 150,
  DESCRIPTION_MAX: 5000,
  MILESTONE_NAME_MIN: 2,
  MILESTONE_NAME_MAX: 150,
  MILESTONE_DESCRIPTION_MAX: 2000,
  /** Both embedded arrays are bounded — that is what makes embedding safe (P-9). */
  MAX_TEAM_MEMBERS: 50,
  MAX_MILESTONES: 50,
} as const;

/**
 * The permitted status transitions (SRS section 6.4).
 *
 * Published in the contracts package so the interface can offer only the moves
 * the server will accept. It is a convenience, never the enforcement: the
 * service checks the same table, because a client can call the endpoint
 * directly.
 *
 * `COMPLETED` and `CANCELLED` are terminal — a finished project is a record,
 * not a workspace. Note also that `ON_HOLD` cannot go straight to `COMPLETED`:
 * work that was paused has to be resumed before it can be finished.
 */
export const PROJECT_STATUS_TRANSITIONS: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> =
  {
    PLANNED: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED', 'ON_HOLD', 'CANCELLED'],
    ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  } as const;

export interface ProjectSummary {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  projectManagerId: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  isArchived: boolean;
  teamSize: number;
  milestoneCount: number;
}

export interface ProjectDetail extends ProjectSummary {
  description?: string;
  projectManagerName: string;
  /**
   * Absent for a Client Contact: the team roster is internal (BR-28). The
   * field is omitted rather than emptied, so "not permitted to see" is
   * distinguishable from "nobody is assigned".
   */
  team?: ProjectTeamMember[];
  milestones: MilestoneView[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTeamMember {
  user: UserSummary;
  addedAt: string;
}

/**
 * A milestone as READ.
 *
 * `status` and `progress` are computed from the project's tasks on every read
 * and stored nowhere (BR-08, BR-12, ADR-0004 §3). They appear in this shape
 * and in no persistence shape — which is the distinction the whole rule rests
 * on.
 */
export interface MilestoneView {
  id: string;
  name: string;
  description?: string;
  dueDate?: string;
  order: number;
  status: MilestoneStatus;
  /** 0–100. Zero when the milestone has no non-cancelled tasks. */
  progress: number;
}

/** FR-019. `status` is absent: a new project is always `PLANNED`. */
export interface CreateProjectRequest {
  name: string;
  description?: string;
  clientId: string;
  projectManagerId: string;
  startDate: string;
  endDate: string;
}

/**
 * FR-020. Neither `clientId` nor `projectManagerId` is editable here.
 *
 * Moving a project to another client would move every task, deliverable and
 * comment across an isolation boundary in one request (BR-10). Reassigning the
 * PM is an Administrator-only command with its own endpoint (FR-022, BR-24).
 * Status has its own command too (FR-021), so there is no generic write path
 * to a transition.
 */
export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}

/** FR-021 — a named command, never a PATCH of `status`. */
export interface ChangeProjectStatusRequest {
  status: ProjectStatus;
}

/** FR-022 — Administrator only (BR-24). */
export interface ReassignProjectManagerRequest {
  projectManagerId: string;
}

/** FR-023 — only a user whose role is TEAM_MEMBER may be added (BR-23). */
export interface AddTeamMemberRequest {
  userId: string;
}

export interface CreateMilestoneRequest {
  name: string;
  description?: string;
  dueDate?: string;
  order: number;
}

export type UpdateMilestoneRequest = Partial<CreateMilestoneRequest>;

export interface ProjectListQuery extends PaginationQuery {
  status?: ProjectStatus;
  clientId?: string;
  projectManagerId?: string;
  search?: string;
  includeArchived?: boolean;
}
