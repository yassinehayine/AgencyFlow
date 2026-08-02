import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DELIVERABLE_LIMITS, DeliverableStatus, VersionOutcome } from '@agencyflow/contracts';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';

import { AuditableDocument } from '../../../core/database/audit.schema';
import { FileRef, FileRefSchema } from '../../../core/database/file-ref.schema';

export type DeliverableDocument = HydratedDocument<Deliverable>;

/**
 * One round of the client negotiation (06-Database-Design.md section 7.5).
 *
 * **Append-only.** BR-06 says a change request produces a NEW version and
 * preserves the previous one; every element below index `versions.length - 1`
 * is never written to again. That is what makes the version history an audit
 * record of the agency-client exchange rather than a mutable draft.
 */
@Schema({ _id: false })
export class DeliverableVersion {
  @Prop({ type: Number, required: true, min: 1 })
  versionNumber!: number;

  /** At least one is required to submit (FR-047, BR-05). Max 20 (P-9). */
  @Prop({ type: [FileRefSchema], required: true, default: [] })
  files!: FileRef[];

  /** Null while the version is still a draft. */
  @Prop({ type: Date, default: null })
  submittedAt?: Date | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  submittedById?: Types.ObjectId | null;

  @Prop({ required: true, enum: Object.values(VersionOutcome), default: VersionOutcome.PENDING })
  outcome!: VersionOutcome;

  @Prop({ type: Date, default: null })
  decidedAt?: Date | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  decidedById?: Types.ObjectId | null;

  /** Required if and only if `outcome = CHANGES_REQUESTED` (FR-049). */
  @Prop({ type: String, default: null })
  decisionComment?: string | null;

  @Prop({ type: Date, required: true, default: () => new Date() })
  createdAt!: Date;
}

export const DeliverableVersionSchema = SchemaFactory.createForClass(DeliverableVersion);

/**
 * `deliverables` — the product's differentiator.
 *
 * `projectId` is the scoping field (A-04): a deliverable has no `clientId` of
 * its own, so who may see it is decided by who may see its project — which is
 * how a Client Contact reaches exactly their own organisation's work (BR-10).
 */
@Schema({ collection: 'deliverables', timestamps: true })
export class Deliverable extends AuditableDocument {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId!: Types.ObjectId;

  @Prop({
    required: true,
    trim: true,
    minlength: DELIVERABLE_LIMITS.NAME_MIN,
    maxlength: DELIVERABLE_LIMITS.NAME_MAX,
  })
  name!: string;

  @Prop({ required: false, trim: true, maxlength: DELIVERABLE_LIMITS.DESCRIPTION_MAX })
  description?: string;

  @Prop({ type: Date, required: false })
  dueDate?: Date;

  @Prop({
    required: true,
    enum: Object.values(DeliverableStatus),
    default: DeliverableStatus.DRAFT,
  })
  status!: DeliverableStatus;

  /** Always equals `versions.length`. Denormalised for list queries only. */
  @Prop({ type: Number, required: true, default: 1, min: 1 })
  currentVersionNumber!: number;

  @Prop({ type: [DeliverableVersionSchema], required: true, default: [] })
  versions!: DeliverableVersion[];

  /** FR-053 — optional (A-05); linked tasks must be in the same project. */
  @Prop({ type: [MongooseSchema.Types.ObjectId], required: true, default: [] })
  linkedTaskIds!: Types.ObjectId[];

  /**
   * Set by the explicit `start-review` command and by nothing else.
   *
   * FR-081 and BR-31: no READ may cause this transition. A GET that mutates
   * breaks HTTP semantics and races when two contacts of the same organisation
   * open the deliverable at the same moment.
   */
  @Prop({ type: Date, default: null })
  reviewStartedAt?: Date | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  reviewStartedById?: Types.ObjectId | null;

  /** Terminal (BR-07). Once set, every write to this document is refused. */
  @Prop({ type: Date, default: null })
  approvedAt?: Date | null;

  /** The client's formal acceptance record — the point of the whole feature. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  approvedById?: Types.ObjectId | null;
}

export const DeliverableSchema = SchemaFactory.createForClass(Deliverable);

/** Indexes 15–16 of 06-Database-Design.md section 8.1. */

/** The project's deliverable list, filtered by status (FR-052). */
DeliverableSchema.index({ projectId: 1, status: 1 });

/** Due-soon and overdue, computed on read (BR-20). */
DeliverableSchema.index({ status: 1, dueDate: 1 });
