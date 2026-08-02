import { Inject, Injectable } from '@nestjs/common';
import {
  DELIVERABLE_LIMITS,
  DELIVERABLE_STATUS_TRANSITIONS,
  DeliverableStatus,
  ErrorCode,
  FILE_LIMITS,
  VersionOutcome,
} from '@agencyflow/contracts';
import type {
  DeliverableDetail,
  DeliverableSummary,
  PaginatedResponse,
} from '@agencyflow/contracts';
import { Types, type FilterQuery } from 'mongoose';
import type { Readable } from 'node:stream';

import { AccessScope } from '../../core/authorization/access-scope';
import { paginate } from '../../common/dto/pagination-query.dto';
import {
  AccessDeniedException,
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../common/exceptions/domain.exception';
import { validateFile } from '../../core/storage/file-validation';
import {
  STORAGE_SERVICE,
  type IStorageService,
} from '../../core/storage/storage.service.interface';
import { fr } from '../../i18n/fr';
import { ProjectsRepository } from '../projects/projects.repository';
import { DeliverablesRepository } from './deliverables.repository';
import { toDeliverableDetail, toDeliverableSummary } from './deliverables.mapper';
import type { DeliverableDocument } from './schemas/deliverable.schema';
import type {
  CreateDeliverableDto,
  DeliverableListQueryDto,
  RequestChangesDto,
  UpdateDeliverableDto,
} from './dto/deliverable.dto';

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

/**
 * The client approval loop (FR-045 – FR-054).
 *
 * `02-User-Stories.md` calls this the demonstration centrepiece, and the three
 * rules that make it more than a status field are all here:
 *
 *   BR-05  only the owning PM or an Administrator submits
 *   BR-06  a change request APPENDS a version; earlier ones are never rewritten
 *   BR-07  approval is terminal — every subsequent write is refused
 *
 * Plus BR-31: `UNDER_REVIEW` is reached only by an explicit client command,
 * never as a side effect of reading.
 */
@Injectable()
export class DeliverablesService {
  constructor(
    private readonly repository: DeliverablesRepository,
    private readonly projects: ProjectsRepository,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
  ) {}

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------

  /** FR-052 */
  async findAll(
    query: DeliverableListQueryDto,
    rawScope: AccessScope,
  ): Promise<PaginatedResponse<DeliverableSummary>> {
    const scope = await this.resolveScope(rawScope);
    const filter = this.buildListFilter(query);

    const [documents, totalItems] = await Promise.all([
      this.repository.findMany(filter, scope, {
        skip: query.skip,
        limit: query.pageSize,
        sort: { dueDate: query.sortOrder === 'desc' ? -1 : 1 },
      }),
      this.repository.count(filter, scope),
    ]);

    return paginate(documents.map(toDeliverableSummary), totalItems, query);
  }

  /**
   * FR-054 — the deliverable with its full version history.
   *
   * A pure read. It does NOT move a `SUBMITTED` deliverable to `UNDER_REVIEW`:
   * that is FR-081's explicit command, and BR-31 exists because a GET that
   * mutates breaks HTTP semantics and races when two contacts of the same
   * organisation open the page at the same moment.
   */
  async findById(id: string, rawScope: AccessScope): Promise<DeliverableDetail> {
    const scope = await this.resolveScope(rawScope);

    return toDeliverableDetail(await this.getOrFail(id, scope));
  }

  // ---------------------------------------------------------------------
  // Authoring — Project Manager side
  // ---------------------------------------------------------------------

  /** FR-045 — a new deliverable is always `DRAFT` with one empty version. */
  async create(
    projectId: string,
    dto: CreateDeliverableDto,
    rawScope: AccessScope,
  ): Promise<DeliverableDetail> {
    const scope = await this.resolveScope(rawScope);
    const project = await this.getProjectForWrite(projectId, scope);

    const created = await this.repository.create(
      {
        projectId: project._id,
        name: dto.name,
        ...(dto.description ? { description: dto.description } : {}),
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
        status: DeliverableStatus.DRAFT,
        currentVersionNumber: 1,
        // Version 1 exists from the start, so there is always somewhere to
        // attach a file before the first submission.
        versions: [
          { versionNumber: 1, files: [], outcome: VersionOutcome.PENDING, createdAt: new Date() },
        ],
        linkedTaskIds: [],
      },
      scope,
    );

    return toDeliverableDetail(created);
  }

  /** FR-045. Refused once approved (BR-07). */
  async update(
    id: string,
    dto: UpdateDeliverableDto,
    rawScope: AccessScope,
  ): Promise<DeliverableDetail> {
    const scope = await this.resolveScope(rawScope);
    const deliverable = await this.getOrFail(id, scope);

    this.assertNotApproved(deliverable);
    await this.assertMayAuthor(deliverable, scope);

    const updated = await this.repository.updateById(
      id,
      {
        $set: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.dueDate !== undefined ? { dueDate: new Date(dto.dueDate) } : {}),
        },
      },
      scope,
    );

    return toDeliverableDetail(this.orFail(updated));
  }

  /**
   * FR-046 — attach a file to the CURRENT version.
   *
   * Only ever the current one. Writing into an earlier version would rewrite
   * history the client has already decided on, which BR-06 forbids.
   */
  async addFile(
    id: string,
    upload: UploadedFile,
    rawScope: AccessScope,
  ): Promise<DeliverableDetail> {
    const scope = await this.resolveScope(rawScope);
    const deliverable = await this.getOrFail(id, scope);

    this.assertNotApproved(deliverable);
    await this.assertMayAuthor(deliverable, scope);

    const current = this.currentVersion(deliverable);

    if (current.files.length >= FILE_LIMITS.MAX_FILES_PER_VERSION) {
      throw new BusinessRuleViolationException(ErrorCode.FILE_LIMIT_REACHED, fr.files.limitReached);
    }

    const validation = validateFile(upload.buffer, upload.originalname, upload.mimetype);

    if (!validation.ok) {
      throw new BusinessRuleViolationException(
        ErrorCode.FILE_REJECTED,
        fr.files.rejected(validation.reason, validation.detail),
      );
    }

    // Uploaded to the provider BEFORE the document is written. The reverse
    // order can leave a FileRef pointing at bytes that were never stored,
    // which reads as a broken download with no way to tell why.
    const stored = await this.storage.upload(upload.buffer, {
      path: `deliverables/${id}/v${current.versionNumber}`,
      originalName: validation.file.originalName,
      mimeType: validation.file.mimeType,
    });

    const updated = await this.repository.updateEmbedded(
      id,
      {
        $push: {
          'versions.$[v].files': {
            _id: new Types.ObjectId(),
            originalName: validation.file.originalName,
            mimeType: validation.file.mimeType,
            extension: validation.file.extension,
            sizeBytes: validation.file.sizeBytes,
            storageKey: stored.storageKey,
            ...(scope.actorId ? { uploadedById: new Types.ObjectId(scope.actorId) } : {}),
            uploadedAt: new Date(),
          },
        },
      },
      [{ 'v.versionNumber': current.versionNumber }],
      scope,
    );

    return toDeliverableDetail(this.orFail(updated));
  }

  /**
   * FR-047 — submit to the client. BR-05.
   *
   * At least one file is required, and that is the rule worth stating: a
   * submission with nothing attached asks a client to approve nothing, and the
   * approval it produces would be meaningless as an acceptance record.
   */
  async submit(id: string, rawScope: AccessScope): Promise<DeliverableDetail> {
    const scope = await this.resolveScope(rawScope);
    const deliverable = await this.getOrFail(id, scope);

    this.assertNotApproved(deliverable);
    await this.assertMayAuthor(deliverable, scope);
    this.assertTransition(deliverable, DeliverableStatus.SUBMITTED);

    const current = this.currentVersion(deliverable);

    if (current.files.length === 0) {
      throw new BusinessRuleViolationException(
        ErrorCode.SUBMISSION_REQUIRES_FILE,
        fr.deliverables.submissionRequiresFile,
      );
    }

    const updated = await this.repository.updateEmbedded(
      id,
      {
        $set: {
          status: DeliverableStatus.SUBMITTED,
          'versions.$[v].submittedAt': new Date(),
          'versions.$[v].submittedById': scope.actorId ? new Types.ObjectId(scope.actorId) : null,
        },
      },
      [{ 'v.versionNumber': current.versionNumber }],
      scope,
    );

    return toDeliverableDetail(this.orFail(updated));
  }

  // ---------------------------------------------------------------------
  // Decision — Client Contact side
  // ---------------------------------------------------------------------

  /**
   * FR-081 — the client explicitly takes up the review. BR-31.
   *
   * Its whole reason for existing is that it is NOT a read. `UNDER_REVIEW`
   * tells the Project Manager the client has actually started looking, which
   * is information only an explicit action can carry.
   */
  async startReview(id: string, rawScope: AccessScope): Promise<DeliverableDetail> {
    const scope = await this.resolveScope(rawScope);
    const deliverable = await this.getOrFail(id, scope);

    this.assertClientDecider(scope);
    this.assertTransition(deliverable, DeliverableStatus.UNDER_REVIEW);

    const updated = await this.repository.updateById(
      id,
      {
        $set: {
          status: DeliverableStatus.UNDER_REVIEW,
          reviewStartedAt: new Date(),
          reviewStartedById: scope.actorId ? new Types.ObjectId(scope.actorId) : null,
        },
      },
      scope,
    );

    return toDeliverableDetail(this.orFail(updated));
  }

  /**
   * FR-048 — the client accepts. Terminal (BR-07).
   *
   * `approvedById` is the formal acceptance record: who accepted, and when.
   * It is the artefact the whole feature exists to produce.
   */
  async approve(id: string, rawScope: AccessScope): Promise<DeliverableDetail> {
    const scope = await this.resolveScope(rawScope);
    const deliverable = await this.getOrFail(id, scope);

    this.assertClientDecider(scope);
    this.assertTransition(deliverable, DeliverableStatus.APPROVED);

    const current = this.currentVersion(deliverable);
    const now = new Date();

    const updated = await this.repository.updateEmbedded(
      id,
      {
        $set: {
          status: DeliverableStatus.APPROVED,
          approvedAt: now,
          approvedById: scope.actorId ? new Types.ObjectId(scope.actorId) : null,
          'versions.$[v].outcome': VersionOutcome.APPROVED,
          'versions.$[v].decidedAt': now,
          'versions.$[v].decidedById': scope.actorId ? new Types.ObjectId(scope.actorId) : null,
        },
      },
      [{ 'v.versionNumber': current.versionNumber }],
      scope,
    );

    return toDeliverableDetail(this.orFail(updated));
  }

  /**
   * FR-049, FR-050 — the client asks for changes. BR-06.
   *
   * The decision is recorded on the CURRENT version and a NEW empty version is
   * appended in the same update. Nothing already decided is rewritten: the
   * previous version keeps its files and its comment forever, which is what
   * makes the history an audit record of the negotiation rather than a status
   * that happens to have changed.
   */
  async requestChanges(
    id: string,
    dto: RequestChangesDto,
    rawScope: AccessScope,
  ): Promise<DeliverableDetail> {
    const scope = await this.resolveScope(rawScope);
    const deliverable = await this.getOrFail(id, scope);

    this.assertClientDecider(scope);
    this.assertTransition(deliverable, DeliverableStatus.CHANGES_REQUESTED);

    const comment = dto.comment.trim();

    // The DTO enforces a minimum length, but whitespace-only survives it and
    // would produce a change request that tells the Project Manager nothing.
    if (comment.length === 0) {
      throw new BusinessRuleViolationException(
        ErrorCode.DECISION_COMMENT_REQUIRED,
        fr.deliverables.decisionCommentRequired,
      );
    }

    const current = this.currentVersion(deliverable);

    if (deliverable.versions.length >= DELIVERABLE_LIMITS.MAX_VERSIONS) {
      throw new BusinessRuleViolationException(
        ErrorCode.VERSION_LIMIT_REACHED,
        fr.deliverables.versionLimitReached,
      );
    }

    const now = new Date();
    const nextNumber = current.versionNumber + 1;

    // The decision and the new version are written as ONE `$set` of the whole
    // array, not `$set` on `versions.$[v]` plus `$push versions`. MongoDB
    // refuses that combination outright - "would create a conflict at
    // 'versions'" - because both touch the same array in one update.
    //
    // Splitting it into two writes was the other option and is worse: a change
    // request that recorded the decision and then failed to append the next
    // version would leave a deliverable a Project Manager cannot act on, and
    // BR-06 would be violated by a partial write rather than by a bug.
    //
    // Rebuilding the array is a read-modify-write, so it carries a guard on
    // `currentVersionNumber`. A concurrent decision - two contacts of the same
    // organisation clicking at once - then finds nothing to update and gets a
    // 404 rather than silently overwriting the other's comment.
    const versions = deliverable.versions.map((version, index) => {
      // Mongoose subdocuments carry prototype machinery that must not be
      // written back verbatim; `toObject` yields the plain shape.
      const subdocument = version as unknown as { toObject?: () => Record<string, unknown> };
      const plain = subdocument.toObject ? subdocument.toObject() : { ...version };

      if (index !== deliverable.versions.length - 1) {
        return plain;
      }

      return {
        ...plain,
        outcome: VersionOutcome.CHANGES_REQUESTED,
        decidedAt: now,
        decidedById: scope.actorId ? new Types.ObjectId(scope.actorId) : null,
        decisionComment: comment,
      };
    });

    versions.push({
      versionNumber: nextNumber,
      files: [],
      outcome: VersionOutcome.PENDING,
      createdAt: now,
    });

    const updated = await this.repository.updateById(
      id,
      {
        $set: {
          status: DeliverableStatus.CHANGES_REQUESTED,
          currentVersionNumber: nextNumber,
          versions,
        },
      },
      scope,
      { currentVersionNumber: current.versionNumber },
    );

    return toDeliverableDetail(this.orFail(updated));
  }

  // ---------------------------------------------------------------------
  // Download — FR-056
  // ---------------------------------------------------------------------

  /**
   * Streams one file through the API, after checking permission.
   *
   * **The provider URL is never handed to the client** (ADR-0003 S-2). A
   * Cloudinary delivery URL works for anyone who has it, forever, with no
   * authorisation — so returning one would defeat BR-10 entirely. Proxying
   * costs bandwidth and buys the only thing that matters here: the check
   * happens on every single download, not just the first.
   */
  async download(
    id: string,
    fileId: string,
    rawScope: AccessScope,
  ): Promise<{ stream: Readable; filename: string; mimeType: string }> {
    const scope = await this.resolveScope(rawScope);
    const deliverable = await this.getOrFail(id, scope);

    const file = deliverable.versions
      .flatMap((version) => version.files)
      .find((candidate) => candidate._id.toString() === fileId);

    if (!file) {
      throw new ResourceNotFoundException(fr.files.notFound);
    }

    return {
      stream: await this.storage.getStream(file.storageKey),
      filename: file.originalName,
      mimeType: file.mimeType,
    };
  }

  // ---------------------------------------------------------------------
  // Rules
  // ---------------------------------------------------------------------

  /**
   * BR-07 — approval is final.
   *
   * Checked before every write rather than relying on the transition table
   * alone, because BR-07 is wider than the state machine: it forbids editing
   * the name, adding a file, and deleting one, none of which are transitions.
   */
  private assertNotApproved(deliverable: DeliverableDocument): void {
    if (deliverable.status === DeliverableStatus.APPROVED) {
      throw new BusinessRuleViolationException(
        ErrorCode.DELIVERABLE_ALREADY_APPROVED,
        fr.deliverables.alreadyApproved,
      );
    }
  }

  /** BR-05 — only the owning Project Manager or an Administrator authors. */
  private async assertMayAuthor(
    deliverable: DeliverableDocument,
    scope: AccessScope,
  ): Promise<void> {
    if (scope.isClientContact() || scope.isTeamMember()) {
      throw new AccessDeniedException(fr.deliverables.authorIsManagerOnly);
    }

    // Reaching the project through the scoped repository is what enforces
    // "the OWNING manager": a PM who does not own it gets nothing back.
    await this.getProjectForWrite(deliverable.projectId.toString(), scope);
  }

  /**
   * FR-048, FR-049, FR-081 — only a Client Contact decides.
   *
   * Agency staff are refused even though they can see the deliverable, and an
   * Administrator is refused too. An approval that the agency could grant
   * itself would be worthless as a client acceptance record — which is the one
   * thing this document exists to be.
   */
  private assertClientDecider(scope: AccessScope): void {
    if (!scope.isClientContact()) {
      throw new AccessDeniedException(fr.deliverables.decisionIsClientOnly);
    }
  }

  private assertTransition(deliverable: DeliverableDocument, next: DeliverableStatus): void {
    if (!DELIVERABLE_STATUS_TRANSITIONS[deliverable.status].includes(next)) {
      throw new BusinessRuleViolationException(
        ErrorCode.INVALID_STATUS_TRANSITION,
        fr.deliverables.invalidTransition(deliverable.status, next),
      );
    }
  }

  private currentVersion(deliverable: DeliverableDocument) {
    const current = deliverable.versions[deliverable.versions.length - 1];

    if (!current) {
      // Unreachable: creation always writes version 1. Explicit anyway,
      // because the alternative is a confusing undefined a long way from here.
      throw new ResourceNotFoundException(fr.deliverables.notFound);
    }

    return current;
  }

  private async resolveScope(scope: AccessScope): Promise<AccessScope> {
    if (scope.isAdministrator()) {
      return scope;
    }

    const ids = await this.projects.accessibleProjectIds(scope);

    return scope.withAccessibleProjects((ids ?? []).map((id) => id.toString()));
  }

  private async getProjectForWrite(projectId: string, scope: AccessScope) {
    const project = await this.projects.findById(projectId, scope);

    if (!project) {
      throw new ResourceNotFoundException(fr.projects.notFound);
    }

    if (project.archivedAt) {
      throw new BusinessRuleViolationException(ErrorCode.PROJECT_ARCHIVED, fr.projects.archived);
    }

    return project;
  }

  private async getOrFail(id: string, scope: AccessScope): Promise<DeliverableDocument> {
    const found = await this.repository.findById(id, scope);

    if (!found) {
      throw new ResourceNotFoundException(fr.deliverables.notFound);
    }

    return found;
  }

  private orFail(document: DeliverableDocument | null): DeliverableDocument {
    if (!document) {
      throw new ResourceNotFoundException(fr.deliverables.notFound);
    }

    return document;
  }

  private buildListFilter(query: DeliverableListQueryDto): FilterQuery<DeliverableDocument> {
    const filter: FilterQuery<DeliverableDocument> = {};

    if (query.projectId) filter.projectId = new Types.ObjectId(query.projectId);
    if (query.status) filter.status = query.status;

    return filter;
  }
}
