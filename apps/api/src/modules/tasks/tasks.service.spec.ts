import { ErrorCode, Role, TaskStatus } from '@agencyflow/contracts';
import { Types } from 'mongoose';

import { AccessScope } from '../../core/authorization/access-scope';
import { DomainException } from '../../common/exceptions/domain.exception';
import { TasksService } from './tasks.service';
import type { ProjectsRepository } from '../projects/projects.repository';
import type { TasksRepository } from './tasks.repository';
import type { UsersRepository } from '../users/users.repository';
import type { ProjectDocument } from '../projects/schemas/project.schema';
import type { TaskDocument } from './schemas/task.schema';

/**
 * BR-04 is the rule this product is judged on, and BR-26 is the one most
 * easily lost in a refactor. Both are asserted here against the service rather
 * than only through HTTP, because a guard can be removed from a route without
 * anything failing to compile.
 */
const PROJECT_ID = new Types.ObjectId();
const ASSIGNEE_ID = new Types.ObjectId();
const OTHER_MEMBER_ID = new Types.ObjectId();

const scopeOf = (role: Role, userId: string) =>
  AccessScope.forUser({ userId, role }).withAccessibleProjects([PROJECT_ID.toString()]);

const ASSIGNEE = scopeOf(Role.TEAM_MEMBER, ASSIGNEE_ID.toString());
const OTHER_MEMBER = scopeOf(Role.TEAM_MEMBER, OTHER_MEMBER_ID.toString());
const MANAGER = scopeOf(Role.PROJECT_MANAGER, new Types.ObjectId().toString());

function taskOf(overrides: Partial<TaskDocument> = {}): TaskDocument {
  return {
    _id: new Types.ObjectId(),
    projectId: PROJECT_ID,
    milestoneId: new Types.ObjectId(),
    title: 'Maquette page accueil',
    assigneeId: ASSIGNEE_ID,
    status: TaskStatus.TODO,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as TaskDocument;
}

function projectOf(): ProjectDocument {
  return {
    _id: PROJECT_ID,
    archivedAt: null,
    teamMembers: [{ userId: ASSIGNEE_ID }, { userId: OTHER_MEMBER_ID }],
    milestones: [],
  } as unknown as ProjectDocument;
}

function build(task: TaskDocument) {
  const updateById = jest
    .fn()
    .mockImplementation((_id, update) =>
      Promise.resolve(taskOf({ ...task, ...(update.$set as Partial<TaskDocument>) })),
    );

  const tasks = {
    findById: jest.fn().mockResolvedValue(task),
    updateById,
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  };

  const projects = {
    findById: jest.fn().mockResolvedValue(projectOf()),
    accessibleProjectIds: jest.fn().mockResolvedValue([PROJECT_ID]),
  };

  const users = { findByIds: jest.fn().mockResolvedValue(new Map()) };

  const service = new TasksService(
    tasks as unknown as TasksRepository,
    projects as unknown as ProjectsRepository,
    users as unknown as UsersRepository,
  );

  return { service, updateById, tasks, projects };
}

async function expectCode(promise: Promise<unknown>, code: ErrorCode): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(DomainException);
  await promise.catch((error: DomainException) => expect(error.code).toBe(code));
}

describe('BR-04 — only a manager may complete a task', () => {
  /** FR-039: rejected server-side with 403, not merely hidden in the UI. */
  it('refuses a Team Member, even the assignee, even from IN_REVIEW', async () => {
    const { service } = build(taskOf({ status: TaskStatus.IN_REVIEW }));

    const promise = service.markDone('task-1', ASSIGNEE);

    await expect(promise).rejects.toBeInstanceOf(DomainException);
    await promise.catch((error: DomainException) => {
      expect(error.code).toBe(ErrorCode.FORBIDDEN);
      expect(error.statusCode).toBe(403);
    });
  });

  it('allows a Project Manager from IN_REVIEW', async () => {
    const { service, updateById } = build(taskOf({ status: TaskStatus.IN_REVIEW }));

    await service.markDone('task-1', MANAGER);

    expect(updateById.mock.calls[0][1].$set.status).toBe(TaskStatus.DONE);
  });

  /** The BR-04 audit trail: who approved it, and when. */
  it('records the approving manager', async () => {
    const { service, updateById } = build(taskOf({ status: TaskStatus.IN_REVIEW }));

    await service.markDone('task-1', MANAGER);

    const set = updateById.mock.calls[0][1].$set;
    expect(set.completedById.toString()).toBe(MANAGER.userId);
    expect(set.completedAt).toBeInstanceOf(Date);
  });

  /** Reachability and permission are different questions (SRS §6.1). */
  it('refuses a manager when the task is not IN_REVIEW', async () => {
    const { service } = build(taskOf({ status: TaskStatus.TODO }));

    await expectCode(service.markDone('task-1', MANAGER), ErrorCode.INVALID_STATUS_TRANSITION);
  });
});

describe('BR-26 — a Team Member may modify only their own tasks', () => {
  it('lets the assignee start their task', async () => {
    const { service, updateById } = build(taskOf({ status: TaskStatus.TODO }));

    await service.start('task-1', ASSIGNEE);

    expect(updateById.mock.calls[0][1].$set.status).toBe(TaskStatus.IN_PROGRESS);
  });

  it('refuses another team member on the same project', async () => {
    const { service } = build(taskOf({ status: TaskStatus.TODO }));

    await expectCode(service.start('task-1', OTHER_MEMBER), ErrorCode.FORBIDDEN);
  });

  /** A manager is not the assignee and must still be able to act. */
  it('allows a manager on someone else’s task', async () => {
    const { service } = build(taskOf({ status: TaskStatus.TODO }));

    await expect(service.start('task-1', MANAGER)).resolves.toBeDefined();
  });
});

describe('BR-22 — a blocked task carries a reason', () => {
  it('refuses a whitespace-only reason that passed the DTO length check', async () => {
    const { service } = build(taskOf({ status: TaskStatus.TODO }));

    await expectCode(
      service.block('task-1', { reason: '     ' }, ASSIGNEE),
      ErrorCode.BLOCKED_REASON_REQUIRED,
    );
  });

  it('stores the trimmed reason and who blocked it', async () => {
    const { service, updateById } = build(taskOf({ status: TaskStatus.TODO }));

    await service.block('task-1', { reason: '  en attente du client  ' }, ASSIGNEE);

    const set = updateById.mock.calls[0][1].$set;
    expect(set.blockedReason).toBe('en attente du client');
    expect(set.blockedAt).toBeInstanceOf(Date);
  });

  /** A stale reason on an unblocked task is a lie the UI would display. */
  it('clears every blocked field on unblock', async () => {
    const { service, updateById } = build(
      taskOf({ status: TaskStatus.BLOCKED, blockedReason: 'en attente' }),
    );

    await service.unblock('task-1', ASSIGNEE);

    const set = updateById.mock.calls[0][1].$set;
    expect(set.status).toBe(TaskStatus.TODO);
    expect(set.blockedReason).toBeNull();
    expect(set.blockedAt).toBeNull();
    expect(set.blockedById).toBeNull();
  });
});

describe('the state machine — SRS §6.1', () => {
  /** `submitForReview` targets IN_REVIEW, reachable only from IN_PROGRESS. */
  it.each([TaskStatus.TODO, TaskStatus.DONE, TaskStatus.CANCELLED])(
    'refuses a jump to IN_REVIEW from %s',
    async (from) => {
      const { service } = build(taskOf({ status: from }));

      await expectCode(
        service.submitForReview('task-1', MANAGER),
        ErrorCode.INVALID_STATUS_TRANSITION,
      );
    },
  );

  it('lets a manager return work from IN_REVIEW to IN_PROGRESS', async () => {
    const { service, updateById } = build(taskOf({ status: TaskStatus.IN_REVIEW }));

    await service.returnToProgress('task-1', MANAGER);

    expect(updateById.mock.calls[0][1].$set.status).toBe(TaskStatus.IN_PROGRESS);
  });
});

describe('BR-23 — the assignee must be on the project team', () => {
  it('refuses a task assigned to someone outside the team', async () => {
    const { service } = build(taskOf());

    await expectCode(
      service.assign('task-1', { assigneeId: new Types.ObjectId().toString() }, MANAGER),
      ErrorCode.ASSIGNEE_NOT_ON_TEAM,
    );
  });

  it('accepts a member of the team', async () => {
    const { service } = build(taskOf());

    await expect(
      service.assign('task-1', { assigneeId: OTHER_MEMBER_ID.toString() }, MANAGER),
    ).resolves.toBeDefined();
  });
});
