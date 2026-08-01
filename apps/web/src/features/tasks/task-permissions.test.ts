import { Role, TaskStatus } from '@agencyflow/contracts';
import type { AuthenticatedUser, TaskSummary } from '@agencyflow/contracts';
import { describe, expect, it } from 'vitest';

import { availableCommands, canComplete, canModify } from './task-permissions';

const ASSIGNEE_ID = 'tm-assignee';

const userOf = (role: Role, id = 'someone'): AuthenticatedUser => ({
  id,
  name: 'Test',
  username: 'test.user',
  email: 'test@agencyflow.ma',
  role,
});

const taskOf = (status: TaskStatus): TaskSummary => ({
  id: 'task-1',
  projectId: 'p-1',
  milestoneId: 'm-1',
  title: 'Maquette page accueil',
  status,
  assignee: {
    id: ASSIGNEE_ID,
    name: 'Amine Benali',
    username: 'amine.benali',
    email: 'amine@agencyflow.ma',
    role: Role.TEAM_MEMBER,
    isActive: true,
  },
});

const ASSIGNEE = userOf(Role.TEAM_MEMBER, ASSIGNEE_ID);
const OTHER_MEMBER = userOf(Role.TEAM_MEMBER, 'tm-other');
const MANAGER = userOf(Role.PROJECT_MANAGER, 'pm-1');
const ADMIN = userOf(Role.ADMINISTRATOR, 'admin-1');

const commandsFor = (user: AuthenticatedUser | null, status: TaskStatus) =>
  availableCommands(user, taskOf(status)).map((action) => action.command);

describe('BR-04 — a Team Member is never offered completion', () => {
  /**
   * The rule the product is judged on. Asserted for the ASSIGNEE
   * specifically: they may modify the task in every other way, which is
   * exactly why folding completion into a general "can modify" check would
   * quietly make BR-04 advisory.
   */
  it('does not offer done to the assignee, even from IN_REVIEW', () => {
    expect(commandsFor(ASSIGNEE, TaskStatus.IN_REVIEW)).not.toContain('done');
  });

  it.each([
    [Role.PROJECT_MANAGER, true],
    [Role.ADMINISTRATOR, true],
    [Role.TEAM_MEMBER, false],
    [Role.CLIENT_CONTACT, false],
  ])('canComplete for %s is %s', (role, expected) => {
    expect(canComplete(userOf(role))).toBe(expected);
  });

  it('offers done to a manager from IN_REVIEW', () => {
    expect(commandsFor(MANAGER, TaskStatus.IN_REVIEW)).toContain('done');
    expect(commandsFor(ADMIN, TaskStatus.IN_REVIEW)).toContain('done');
  });

  /** Reachability and permission are different questions (SRS §6.1). */
  it('does not offer done to a manager when the task is not in review', () => {
    expect(commandsFor(MANAGER, TaskStatus.TODO)).not.toContain('done');
    expect(commandsFor(MANAGER, TaskStatus.IN_PROGRESS)).not.toContain('done');
  });
});

describe('BR-26 — only the assignee or a manager may act', () => {
  it('lets the assignee act on their own task', () => {
    expect(canModify(ASSIGNEE, taskOf(TaskStatus.TODO))).toBe(true);
    expect(commandsFor(ASSIGNEE, TaskStatus.TODO)).toContain('start');
  });

  it('offers another team member nothing at all', () => {
    expect(canModify(OTHER_MEMBER, taskOf(TaskStatus.TODO))).toBe(false);
    expect(commandsFor(OTHER_MEMBER, TaskStatus.TODO)).toEqual([]);
  });

  it('lets a manager act on someone else’s task', () => {
    expect(canModify(MANAGER, taskOf(TaskStatus.TODO))).toBe(true);
  });

  it('offers an unauthenticated caller nothing rather than throwing', () => {
    expect(commandsFor(null, TaskStatus.TODO)).toEqual([]);
  });
});

describe('FR-042 — cancelling is a manager’s decision', () => {
  it('is not offered to the assignee', () => {
    expect(commandsFor(ASSIGNEE, TaskStatus.TODO)).not.toContain('cancel');
  });

  it('is offered to a manager', () => {
    expect(commandsFor(MANAGER, TaskStatus.TODO)).toContain('cancel');
  });
});

describe('the state machine drives the buttons — SRS §6.1', () => {
  it('offers start and block from TODO, never submit-review', () => {
    const commands = commandsFor(ASSIGNEE, TaskStatus.TODO);

    expect(commands).toContain('start');
    expect(commands).toContain('block');
    expect(commands).not.toContain('submit-review');
  });

  it('offers submit-review from IN_PROGRESS', () => {
    expect(commandsFor(ASSIGNEE, TaskStatus.IN_PROGRESS)).toContain('submit-review');
  });

  /** From IN_REVIEW, IN_PROGRESS is a manager RETURNING work, not a restart. */
  it('maps IN_REVIEW -> IN_PROGRESS to return, and only for a manager', () => {
    expect(commandsFor(MANAGER, TaskStatus.IN_REVIEW)).toContain('return');
    expect(commandsFor(ASSIGNEE, TaskStatus.IN_REVIEW)).not.toContain('return');
    expect(commandsFor(ASSIGNEE, TaskStatus.IN_REVIEW)).not.toContain('start');
  });

  it('maps BLOCKED -> TODO to unblock rather than start', () => {
    const commands = commandsFor(ASSIGNEE, TaskStatus.BLOCKED);

    expect(commands).toContain('unblock');
    expect(commands).not.toContain('start');
  });

  it.each([TaskStatus.DONE, TaskStatus.CANCELLED])('offers nothing from %s', (status) => {
    expect(commandsFor(MANAGER, status)).toEqual([]);
    expect(commandsFor(ADMIN, status)).toEqual([]);
  });
});
