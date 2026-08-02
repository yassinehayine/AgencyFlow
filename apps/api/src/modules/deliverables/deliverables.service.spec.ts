import { DeliverableStatus, ErrorCode, Role, VersionOutcome } from '@agencyflow/contracts';
import { Types } from 'mongoose';

import { AccessScope } from '../../core/authorization/access-scope';
import { DeliverablesService } from './deliverables.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { toDeliverableDetail } from './deliverables.mapper';
import type { DeliverablesRepository } from './deliverables.repository';
import type { IStorageService } from '../../core/storage/storage.service.interface';
import type { ProjectsRepository } from '../projects/projects.repository';
import type { DeliverableDocument } from './schemas/deliverable.schema';

/**
 * The client approval loop — the product's differentiator.
 *
 * BR-05, BR-06, BR-07 and BR-31 are what make this more than a status field,
 * and each is asserted against the service rather than only through HTTP: a
 * route decorator can be deleted without anything failing to compile.
 */
const PROJECT_ID = new Types.ObjectId();

const scopeOf = (role: Role) =>
  AccessScope.forUser({
    userId: new Types.ObjectId().toString(),
    role,
    ...(role === Role.CLIENT_CONTACT ? { clientId: new Types.ObjectId().toString() } : {}),
  }).withAccessibleProjects([PROJECT_ID.toString()]);

const MANAGER = scopeOf(Role.PROJECT_MANAGER);
const CLIENT = scopeOf(Role.CLIENT_CONTACT);
const MEMBER = scopeOf(Role.TEAM_MEMBER);
const ADMIN = scopeOf(Role.ADMINISTRATOR);

function versionOf(
  number: number,
  fileCount: number,
  outcome: VersionOutcome = VersionOutcome.PENDING,
) {
  return {
    versionNumber: number,
    files: Array.from({ length: fileCount }, () => ({
      _id: new Types.ObjectId(),
      originalName: 'maquette.pdf',
      mimeType: 'application/pdf',
      extension: 'pdf',
      sizeBytes: 1024,
      storageKey: 'agencyflow/deliverables/x/maquette',
      uploadedAt: new Date(),
    })),
    outcome,
    createdAt: new Date(),
  };
}

function deliverableOf(overrides: Partial<DeliverableDocument> = {}): DeliverableDocument {
  return {
    _id: new Types.ObjectId(),
    projectId: PROJECT_ID,
    name: 'Maquette page accueil',
    status: DeliverableStatus.DRAFT,
    currentVersionNumber: 1,
    versions: [versionOf(1, 1)],
    linkedTaskIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as DeliverableDocument;
}

function build(deliverable: DeliverableDocument) {
  const applied: Record<string, unknown>[] = [];

  const echo = (_id: string, update: Record<string, unknown>) => {
    applied.push(update);
    return Promise.resolve(deliverable);
  };

  const repository = {
    findById: jest.fn().mockResolvedValue(deliverable),
    updateById: jest.fn().mockImplementation(echo),
    updateEmbedded: jest.fn().mockImplementation(echo),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue(deliverable),
  };

  const projects = {
    findById: jest.fn().mockResolvedValue({ _id: PROJECT_ID, archivedAt: null }),
    accessibleProjectIds: jest.fn().mockResolvedValue([PROJECT_ID]),
  };

  const storage = {
    upload: jest
      .fn()
      .mockResolvedValue({ storageKey: 'k', sizeBytes: 1, mimeType: 'application/pdf' }),
    getStream: jest.fn(),
    delete: jest.fn(),
    ping: jest.fn(),
  };

  const service = new DeliverablesService(
    repository as unknown as DeliverablesRepository,
    projects as unknown as ProjectsRepository,
    storage as unknown as IStorageService,
  );

  return { service, repository, storage, applied };
}

async function expectCode(promise: Promise<unknown>, code: ErrorCode): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(DomainException);
  await promise.catch((error: DomainException) => expect(error.code).toBe(code));
}

describe('BR-07 — an approved deliverable is final', () => {
  const approved = () =>
    deliverableOf({
      status: DeliverableStatus.APPROVED,
      versions: [versionOf(1, 1, VersionOutcome.APPROVED)],
    });

  it('refuses an edit', async () => {
    const { service } = build(approved());

    await expectCode(
      service.update('d1', { name: 'Nouveau nom' }, MANAGER),
      ErrorCode.DELIVERABLE_ALREADY_APPROVED,
    );
  });

  it('refuses a new file', async () => {
    const { service } = build(approved());

    await expectCode(
      service.addFile(
        'd1',
        { buffer: Buffer.from('%PDF-1.4'), originalname: 'x.pdf', mimetype: 'application/pdf' },
        MANAGER,
      ),
      ErrorCode.DELIVERABLE_ALREADY_APPROVED,
    );
  });

  it('refuses a resubmission', async () => {
    const { service } = build(approved());

    await expectCode(service.submit('d1', MANAGER), ErrorCode.DELIVERABLE_ALREADY_APPROVED);
  });

  /** Un-approval is not a transition — the table for APPROVED is empty. */
  it('refuses any further client decision', async () => {
    const { service } = build(approved());

    await expectCode(
      service.requestChanges('d1', { comment: 'finalement non' }, CLIENT),
      ErrorCode.INVALID_STATUS_TRANSITION,
    );
  });
});

describe('BR-05 — only the owning manager submits', () => {
  it('refuses a Team Member', async () => {
    const { service } = build(deliverableOf());

    await expectCode(service.submit('d1', MEMBER), ErrorCode.FORBIDDEN);
  });

  it('refuses a Client Contact', async () => {
    const { service } = build(deliverableOf());

    await expectCode(service.submit('d1', CLIENT), ErrorCode.FORBIDDEN);
  });

  /** FR-047 — a submission with nothing attached asks for nothing. */
  it('refuses a submission with no file', async () => {
    const { service } = build(deliverableOf({ versions: [versionOf(1, 0)] }));

    await expectCode(service.submit('d1', MANAGER), ErrorCode.SUBMISSION_REQUIRES_FILE);
  });

  it('submits and records who did it', async () => {
    const { service, applied } = build(deliverableOf());

    await service.submit('d1', MANAGER);

    expect(applied[0].$set).toMatchObject({ status: DeliverableStatus.SUBMITTED });
    expect(
      String((applied[0].$set as Record<string, unknown>)['versions.$[v].submittedById']),
    ).toBe(MANAGER.userId);
  });
});

describe('FR-048 — only a client decides', () => {
  const submitted = () => deliverableOf({ status: DeliverableStatus.SUBMITTED });

  /**
   * An Administrator is refused too, and that is the point: an approval the
   * agency could grant itself would be worthless as an acceptance record.
   */
  it.each([
    ['a Project Manager', () => MANAGER],
    ['an Administrator', () => ADMIN],
    ['a Team Member', () => MEMBER],
  ])('refuses %s', async (_label, scope) => {
    const { service } = build(submitted());

    await expectCode(service.approve('d1', scope()), ErrorCode.FORBIDDEN);
  });

  it('records the approving client and the version outcome', async () => {
    const { service, applied } = build(submitted());

    await service.approve('d1', CLIENT);

    const set = applied[0].$set as Record<string, unknown>;
    expect(set.status).toBe(DeliverableStatus.APPROVED);
    expect(String(set.approvedById)).toBe(CLIENT.userId);
    expect(set['versions.$[v].outcome']).toBe(VersionOutcome.APPROVED);
  });

  it('allows approving straight from SUBMITTED without passing UNDER_REVIEW', async () => {
    const { service } = build(submitted());

    await expect(service.approve('d1', CLIENT)).resolves.toBeDefined();
  });
});

describe('BR-06 — a change request appends a version', () => {
  const submitted = () => deliverableOf({ status: DeliverableStatus.SUBMITTED });

  it('refuses a whitespace-only comment that passed the DTO length check', async () => {
    const { service } = build(submitted());

    await expectCode(
      service.requestChanges('d1', { comment: '    ' }, CLIENT),
      ErrorCode.DECISION_COMMENT_REQUIRED,
    );
  });

  /**
   * The heart of BR-06.
   *
   * The decision lands on the CURRENT version and a new empty one is appended
   * in the SAME update. MongoDB refuses a positional `$set` on `versions.$[v]`
   * alongside a `$push versions` - "would create a conflict at 'versions'" -
   * so the whole array is set at once. Splitting it in two would risk a change
   * request that records the decision and then fails to append the version.
   */
  it('records the decision on v1 and appends an empty v2 in one write', async () => {
    const { service, applied, repository } = build(submitted());

    await service.requestChanges('d1', { comment: '  revoir la palette  ' }, CLIENT);

    expect(repository.updateById).toHaveBeenCalledTimes(1);

    const set = applied[0].$set as Record<string, unknown>;
    const versions = set.versions as Array<Record<string, unknown>>;

    expect(set.status).toBe(DeliverableStatus.CHANGES_REQUESTED);
    expect(set.currentVersionNumber).toBe(2);
    expect(versions).toHaveLength(2);

    expect(versions[0].outcome).toBe(VersionOutcome.CHANGES_REQUESTED);
    expect(versions[0].decisionComment).toBe('revoir la palette');
    expect((versions[0].files as unknown[]).length).toBe(1);

    expect(versions[1].versionNumber).toBe(2);
    expect(versions[1].outcome).toBe(VersionOutcome.PENDING);
    expect(versions[1].files).toEqual([]);
  });

  /**
   * BR-06's actual promise: "prior versions are preserved". Asserted by
   * comparing every already-decided version before and after - a rebuild of
   * the array is only safe if it rebuilds them unchanged.
   */
  it('leaves every already-decided version byte-identical', async () => {
    const original = deliverableOf({
      status: DeliverableStatus.SUBMITTED,
      currentVersionNumber: 3,
      versions: [
        versionOf(1, 2, VersionOutcome.CHANGES_REQUESTED),
        versionOf(2, 1, VersionOutcome.CHANGES_REQUESTED),
        versionOf(3, 1),
      ],
    });
    const before = JSON.parse(JSON.stringify(original.versions.slice(0, 2)));

    const { service, applied } = build(original);

    await service.requestChanges('d1', { comment: 'encore une fois' }, CLIENT);

    const versions = (applied[0].$set as Record<string, unknown>).versions as unknown[];

    expect(JSON.parse(JSON.stringify(versions.slice(0, 2)))).toEqual(before);
    expect(versions).toHaveLength(4);
  });

  /**
   * The rebuild is a read-modify-write, so it carries an optimistic guard.
   * Without it, two contacts of the same organisation deciding at the same
   * moment would have one silently overwrite the other's comment.
   */
  it('guards the write against a concurrent decision', async () => {
    const { service, repository } = build(submitted());

    await service.requestChanges('d1', { comment: 'revoir la palette' }, CLIENT);

    expect(repository.updateById.mock.calls[0][3]).toEqual({ currentVersionNumber: 1 });
  });
});

describe('BR-31 — UNDER_REVIEW is only ever explicit', () => {
  it('is not reachable from a read', async () => {
    const { service, repository } = build(deliverableOf({ status: DeliverableStatus.SUBMITTED }));

    await service.findById('d1', CLIENT);

    expect(repository.updateById).not.toHaveBeenCalled();
    expect(repository.updateEmbedded).not.toHaveBeenCalled();
  });

  it('is reachable by the explicit command, for a client only', async () => {
    const { service, applied } = build(deliverableOf({ status: DeliverableStatus.SUBMITTED }));

    await service.startReview('d1', CLIENT);

    expect((applied[0].$set as Record<string, unknown>).status).toBe(
      DeliverableStatus.UNDER_REVIEW,
    );
  });

  it('refuses start-review from DRAFT', async () => {
    const { service } = build(deliverableOf({ status: DeliverableStatus.DRAFT }));

    await expectCode(service.startReview('d1', CLIENT), ErrorCode.INVALID_STATUS_TRANSITION);
  });
});

describe('ADR-0003 — the storage key never leaves the server', () => {
  /**
   * The one leak that would defeat BR-10 regardless of every guard above it: a
   * Cloudinary URL works for anyone holding it, forever, with no permission
   * check. The mapper whitelists fields, and this asserts the result.
   */
  it('is absent from the mapped detail, at every version', () => {
    const detail = toDeliverableDetail(
      deliverableOf({
        versions: [versionOf(1, 2, VersionOutcome.CHANGES_REQUESTED), versionOf(2, 1)],
      }),
    );

    expect(JSON.stringify(detail)).not.toContain('storageKey');
    expect(JSON.stringify(detail)).not.toContain('agencyflow/deliverables');
    expect(detail.versions.flatMap((version) => version.files).length).toBe(3);
  });
});
