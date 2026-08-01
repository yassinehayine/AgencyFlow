import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { TaskStatus } from '@agencyflow/contracts';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';

import { AuditableDocument } from '../../../core/database/audit.schema';

export type TaskDocument = HydratedDocument<Task>;

/** P-9 — bounded, which is what makes embedding the refs safe. */
export const MAX_ATTACHMENTS = 20;

/**
 * `tasks` (06-Database-Design.md section 7.4).
 *
 * `projectId` is the scoping field (P-5). A task has no `clientId` of its own,
 * so every visibility question about a task is answered by asking which
 * projects the caller can reach — which is why `ProjectsRepository` exports
 * `accessibleProjectIds()`.
 */
@Schema({ collection: 'tasks', timestamps: true })
export class Task extends AuditableDocument {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Project', required: true })
  projectId!: Types.ObjectId;

  /**
   * References an EMBEDDED `projects.milestones[]._id`.
   *
   * No `ref` here, deliberately: it points inside another document's array, so
   * there is no collection for Mongoose to populate from. Existence is checked
   * in the service (06-DB section 9), which is the cost of embedding
   * milestones — and the cost ADR-0004 accepted knowingly.
   */
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  milestoneId!: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 2, maxlength: 200 })
  title!: string;

  @Prop({ required: false, trim: true, maxlength: 5000 })
  description?: string;

  /** Exactly one (BR-03), and a member of the project's team (BR-23). */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  assigneeId!: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(TaskStatus), default: TaskStatus.TODO })
  status!: TaskStatus;

  /** Drives due-soon and overdue, both computed on read, never stored (BR-20). */
  @Prop({ type: Date, required: false })
  dueDate?: Date;

  /**
   * Required if and only if `status = BLOCKED`, non-empty after trimming
   * (BR-22, CIR-6). Enforced in the service: Mongoose can express "required",
   * not "required if and only if".
   */
  @Prop({ type: String, default: null })
  blockedReason?: string | null;

  @Prop({ type: Date, default: null })
  blockedAt?: Date | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  blockedById?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  completedAt?: Date | null;

  /**
   * The Project Manager who approved completion — the audit trail for BR-04.
   *
   * Worth storing precisely because BR-04 is the rule most likely to be
   * questioned later: "who marked this done?" needs an answer that does not
   * depend on anyone having watched it happen.
   */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  completedById?: Types.ObjectId | null;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

/** Indexes 11–14 of 06-Database-Design.md section 8.1. */

/** Progress aggregation FR-031/032 · Kanban FR-044. */
TaskSchema.index({ projectId: 1, milestoneId: 1, status: 1 });

/** Team Member dashboard FR-070 · due-soon/overdue FR-072 · BR-32. */
TaskSchema.index({ assigneeId: 1, status: 1, dueDate: 1 });

/** Task list and filter FR-043. */
TaskSchema.index({ projectId: 1, status: 1 });

/** Agency-wide overdue FR-068. */
TaskSchema.index({ status: 1, dueDate: 1 });
