import { ProjectStatus, Role } from '@agencyflow/contracts';
import type { AuthenticatedUser, ProjectDetail } from '@agencyflow/contracts';
import { describe, expect, it } from 'vitest';

import {
  availableTransitions,
  canCreateProject,
  canEditProject,
  canManageTeam,
  canReassignManager,
} from './project-permissions';

/**
 * These rules decide what the interface OFFERS, never what it permits — the
 * API enforces all of them independently (FR-003). They are tested anyway,
 * because a screen that offers an action the server refuses trains users to
 * distrust every button on it.
 */
const OWNER_ID = 'pm-owner';

const userOf = (role: Role, id = 'someone'): AuthenticatedUser => ({
  id,
  name: 'Test',
  username: 'test.user',
  email: 'test@agencyflow.ma',
  role,
});

const projectOf = (overrides: Partial<ProjectDetail> = {}): ProjectDetail => ({
  id: 'project-1',
  name: 'Refonte site',
  clientId: 'org-1',
  clientName: 'NewDev Maroc',
  projectManagerId: OWNER_ID,
  projectManagerName: 'Salma',
  status: ProjectStatus.PLANNED,
  startDate: '2026-09-01T00:00:00.000Z',
  endDate: '2026-12-01T00:00:00.000Z',
  isArchived: false,
  teamSize: 0,
  milestoneCount: 0,
  milestones: [],
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...overrides,
});

describe('canEditProject — FR-020, BR-25', () => {
  it('allows the owning Project Manager', () => {
    expect(canEditProject(userOf(Role.PROJECT_MANAGER, OWNER_ID), projectOf())).toBe(true);
  });

  /** BR-25 is the rule most easily lost: a PM is not "a manager", they are THE manager of their own projects. */
  it('refuses a Project Manager who does not own the project', () => {
    expect(canEditProject(userOf(Role.PROJECT_MANAGER, 'other-pm'), projectOf())).toBe(false);
  });

  it('allows any Administrator (BR-29)', () => {
    expect(canEditProject(userOf(Role.ADMINISTRATOR, 'admin-1'), projectOf())).toBe(true);
  });

  it.each([Role.TEAM_MEMBER, Role.CLIENT_CONTACT])('refuses %s', (role) => {
    expect(canEditProject(userOf(role, OWNER_ID), projectOf())).toBe(false);
  });

  /** FR-027 — archived is read-only, for the owner and the Administrator alike. */
  it('refuses everyone once the project is archived', () => {
    const archived = projectOf({ isArchived: true });

    expect(canEditProject(userOf(Role.PROJECT_MANAGER, OWNER_ID), archived)).toBe(false);
    expect(canEditProject(userOf(Role.ADMINISTRATOR, 'admin-1'), archived)).toBe(false);
  });

  it('refuses an unauthenticated caller rather than throwing', () => {
    expect(canEditProject(null, projectOf())).toBe(false);
  });
});

describe('canReassignManager — FR-022, BR-24', () => {
  it('allows only an Administrator', () => {
    expect(canReassignManager(userOf(Role.ADMINISTRATOR))).toBe(true);
  });

  /** The owning PM must not be able to hand the project off — nor take one. */
  it('refuses the owning Project Manager', () => {
    expect(canReassignManager(userOf(Role.PROJECT_MANAGER, OWNER_ID))).toBe(false);
  });

  it.each([Role.TEAM_MEMBER, Role.CLIENT_CONTACT])('refuses %s', (role) => {
    expect(canReassignManager(userOf(role))).toBe(false);
  });
});

describe('canCreateProject — FR-019', () => {
  it.each([
    [Role.ADMINISTRATOR, true],
    [Role.PROJECT_MANAGER, true],
    [Role.TEAM_MEMBER, false],
    [Role.CLIENT_CONTACT, false],
  ])('%s -> %s', (role, expected) => {
    expect(canCreateProject(userOf(role))).toBe(expected);
  });
});

describe('canManageTeam — FR-023, FR-024', () => {
  it('tracks edit rights exactly', () => {
    expect(canManageTeam(userOf(Role.PROJECT_MANAGER, OWNER_ID), projectOf())).toBe(true);
    expect(canManageTeam(userOf(Role.PROJECT_MANAGER, 'other-pm'), projectOf())).toBe(false);
    expect(canManageTeam(userOf(Role.TEAM_MEMBER, OWNER_ID), projectOf())).toBe(false);
  });
});

describe('availableTransitions — SRS 6.4', () => {
  const owner = userOf(Role.PROJECT_MANAGER, OWNER_ID);

  it('offers the moves the server accepts from PLANNED', () => {
    expect(availableTransitions(owner, projectOf({ status: ProjectStatus.PLANNED }))).toEqual([
      ProjectStatus.IN_PROGRESS,
      ProjectStatus.ON_HOLD,
      ProjectStatus.CANCELLED,
    ]);
  });

  /** Paused work must be resumed before it can be finished. */
  it('does not offer COMPLETED directly from ON_HOLD', () => {
    expect(availableTransitions(owner, projectOf({ status: ProjectStatus.ON_HOLD }))).not.toContain(
      ProjectStatus.COMPLETED,
    );
  });

  it.each([ProjectStatus.COMPLETED, ProjectStatus.CANCELLED])(
    'offers nothing from the terminal status %s',
    (status) => {
      expect(availableTransitions(owner, projectOf({ status }))).toEqual([]);
    },
  );

  it('offers nothing to someone who may not edit the project', () => {
    expect(availableTransitions(userOf(Role.TEAM_MEMBER, 'tm-1'), projectOf())).toEqual([]);
    expect(availableTransitions(userOf(Role.CLIENT_CONTACT, 'cc-1'), projectOf())).toEqual([]);
  });

  it('offers nothing on an archived project', () => {
    expect(availableTransitions(owner, projectOf({ isArchived: true }))).toEqual([]);
  });
});
