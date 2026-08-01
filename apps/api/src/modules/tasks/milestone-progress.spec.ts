import { MilestoneStatus, TaskStatus } from '@agencyflow/contracts';
import { Types, type Model } from 'mongoose';

import { TasksRepository } from './tasks.repository';
import type { TaskDocument } from './schemas/task.schema';

/**
 * FR-031, FR-032, BR-08, BR-12 — the milestone roll-up.
 *
 * This arithmetic is shown to a client who is deciding whether to approve
 * work, and it is never stored, so the only thing standing between the formula
 * and a wrong percentage is this file.
 *
 * The aggregation itself is exercised against real MongoDB during manual
 * verification; here the pipeline is stubbed and the DERIVATION is tested,
 * because that is where the rules live.
 */
function repositoryReturning(rollups: unknown[]): TasksRepository {
  const model = {
    aggregate: () => ({ exec: () => Promise.resolve(rollups) }),
  } as unknown as Model<TaskDocument>;

  return new TasksRepository(model);
}

const MILESTONE = new Types.ObjectId();

async function progressOf(rollup: { total: number; done: number; untouched: number }) {
  const repository = repositoryReturning([{ _id: MILESTONE, ...rollup }]);
  const map = await repository.progressByMilestone(new Types.ObjectId());

  return map.get(MILESTONE.toString());
}

describe('milestone progress — the percentage', () => {
  it('is 0 when nothing is done', async () => {
    expect(await progressOf({ total: 4, done: 0, untouched: 4 })).toMatchObject({ progress: 0 });
  });

  it('is 100 when every non-cancelled task is done', async () => {
    expect(await progressOf({ total: 4, done: 4, untouched: 0 })).toMatchObject({ progress: 100 });
  });

  /** Rounded, not floored: 2 of 3 must read 67%, not 66%. */
  it('rounds rather than truncating', async () => {
    expect(await progressOf({ total: 3, done: 2, untouched: 0 })).toMatchObject({ progress: 67 });
  });

  /**
   * The failure that would matter most: a milestone one task short of finished
   * must never display 100%, or a client approves work that is not complete.
   */
  it('never reports 100 while a task remains', async () => {
    // 199/200 is 99.5%, which plain rounding turns into 100.
    const result = await progressOf({ total: 200, done: 199, untouched: 0 });

    expect(result?.progress).toBe(99);
  });

  /** The same argument at the other end, less severe but equally misleading. */
  it('never reports 0 once work has been completed', async () => {
    const result = await progressOf({ total: 200, done: 1, untouched: 199 });

    expect(result?.progress).toBe(1);
  });
});

describe('milestone status — SRS §6.3', () => {
  it('is COMPLETED when all non-cancelled tasks are done', async () => {
    expect(await progressOf({ total: 3, done: 3, untouched: 0 })).toMatchObject({
      status: MilestoneStatus.COMPLETED,
    });
  });

  it('is NOT_STARTED while every task is still TODO', async () => {
    expect(await progressOf({ total: 3, done: 0, untouched: 3 })).toMatchObject({
      status: MilestoneStatus.NOT_STARTED,
    });
  });

  it('is IN_PROGRESS as soon as one task has moved', async () => {
    expect(await progressOf({ total: 3, done: 0, untouched: 2 })).toMatchObject({
      status: MilestoneStatus.IN_PROGRESS,
    });
  });
});

describe('BR-12 — cancelled tasks leave the calculation entirely', () => {
  /**
   * The aggregation excludes CANCELLED before grouping, so `total` is already
   * the non-cancelled count. The consequence worth pinning: cancelling the
   * last outstanding task COMPLETES the milestone rather than stalling it.
   */
  it('completes a milestone whose only remaining work was cancelled', async () => {
    // Two tasks, one done, one cancelled -> the cancelled one is not counted,
    // so the roll-up sees total 1, done 1.
    expect(await progressOf({ total: 1, done: 1, untouched: 0 })).toMatchObject({
      progress: 100,
      status: MilestoneStatus.COMPLETED,
    });
  });

  it('excludes cancelled tasks from the aggregation match', async () => {
    const stages: unknown[] = [];
    const model = {
      aggregate: (pipeline: unknown[]) => {
        stages.push(...pipeline);
        return { exec: () => Promise.resolve([]) };
      },
    } as unknown as Model<TaskDocument>;

    await new TasksRepository(model).progressByMilestone(new Types.ObjectId());

    const match = stages[0] as { $match: { status: { $ne: string } } };
    expect(match.$match.status).toEqual({ $ne: TaskStatus.CANCELLED });
  });
});

describe('a milestone with no tasks', () => {
  /**
   * Absent from the map, not zero-filled. The caller must be able to tell "no
   * tasks yet" from a real zero, and only absence carries that distinction.
   */
  it('is absent rather than reported as 0%', async () => {
    const map = await repositoryReturning([]).progressByMilestone(new Types.ObjectId());

    expect(map.size).toBe(0);
    expect(map.get(MILESTONE.toString())).toBeUndefined();
  });
});

describe('openTaskCount — FR-034', () => {
  it('counts what is left, so a milestone with work cannot be deleted', async () => {
    expect(await progressOf({ total: 5, done: 2, untouched: 1 })).toMatchObject({
      openTaskCount: 3,
    });
  });

  it('is zero once everything is done', async () => {
    expect(await progressOf({ total: 5, done: 5, untouched: 0 })).toMatchObject({
      openTaskCount: 0,
    });
  });
});
