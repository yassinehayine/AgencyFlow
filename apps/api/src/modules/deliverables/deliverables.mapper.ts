import { VersionOutcome } from '@agencyflow/contracts';
import type {
  DeliverableDetail,
  DeliverableSummary,
  DeliverableVersionView,
  FileRefView,
} from '@agencyflow/contracts';

import type { FileRef } from '../../core/database/file-ref.schema';
import type { DeliverableDocument, DeliverableVersion } from './schemas/deliverable.schema';

/**
 * **The guarantee that `storageKey` never leaves the server.**
 *
 * An explicit whitelist, never a spread. A whitelist cannot leak a field added
 * later; an exclusion list leaks every field somebody forgets to exclude. This
 * function is the only place a `FileRef` becomes a response, and
 * `deliverables.mapper.spec.ts` asserts the key is absent from its output.
 */
export function toFileRefView(file: FileRef): FileRefView {
  return {
    id: file._id.toString(),
    originalName: file.originalName,
    extension: file.extension,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    uploadedById: file.uploadedById?.toString() ?? '',
    uploadedAt: file.uploadedAt.toISOString(),
  };
}

function toVersionView(version: DeliverableVersion): DeliverableVersionView {
  return {
    versionNumber: version.versionNumber,
    files: version.files.map(toFileRefView),
    ...(version.submittedAt ? { submittedAt: version.submittedAt.toISOString() } : {}),
    ...(version.submittedById ? { submittedById: version.submittedById.toString() } : {}),
    outcome: version.outcome,
    ...(version.decidedAt ? { decidedAt: version.decidedAt.toISOString() } : {}),
    ...(version.decidedById ? { decidedById: version.decidedById.toString() } : {}),
    // Carried only for a change request — the outcome it belongs to (FR-049).
    ...(version.outcome === VersionOutcome.CHANGES_REQUESTED && version.decisionComment
      ? { decisionComment: version.decisionComment }
      : {}),
    createdAt: version.createdAt.toISOString(),
  };
}

export function toDeliverableSummary(document: DeliverableDocument): DeliverableSummary {
  const current = document.versions[document.versions.length - 1];

  return {
    id: document._id.toString(),
    projectId: document.projectId.toString(),
    name: document.name,
    status: document.status,
    ...(document.dueDate ? { dueDate: document.dueDate.toISOString() } : {}),
    currentVersionNumber: document.currentVersionNumber,
    fileCount: current ? current.files.length : 0,
  };
}

/** FR-054 — the whole negotiation, oldest first. */
export function toDeliverableDetail(document: DeliverableDocument): DeliverableDetail {
  return {
    ...toDeliverableSummary(document),
    ...(document.description ? { description: document.description } : {}),
    versions: [...document.versions]
      .sort((a, b) => a.versionNumber - b.versionNumber)
      .map(toVersionView),
    linkedTaskIds: document.linkedTaskIds.map((id) => id.toString()),
    ...(document.reviewStartedAt
      ? { reviewStartedAt: document.reviewStartedAt.toISOString() }
      : {}),
    ...(document.approvedAt ? { approvedAt: document.approvedAt.toISOString() } : {}),
    ...(document.approvedById ? { approvedById: document.approvedById.toString() } : {}),
    createdAt: (document.createdAt ?? new Date()).toISOString(),
    updatedAt: (document.updatedAt ?? new Date()).toISOString(),
  };
}
