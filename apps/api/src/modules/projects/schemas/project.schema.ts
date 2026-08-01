import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ProjectStatus } from '@agencyflow/contracts';
import { HydratedDocument, Types } from 'mongoose';

import { AuditableDocument } from '../../../core/database/audit.schema';

export type ProjectDocument = HydratedDocument<Project>;

/**
 * Upper bound on both embedded arrays (06-Database-Design.md P-9).
 *
 * Not arbitrary. An embedded array is only safe while it is BOUNDED — ADR-0004
 * embeds team and milestones precisely because they cannot grow without limit.
 * The cap is what makes that claim true rather than hopeful, and 50 is far
 * above any real agency project (NFR-13 sizes the whole agency at ~60 users).
 */
export const MAX_TEAM_MEMBERS = 50;
export const MAX_MILESTONES = 50;

/**
 * Embedded team membership (ADR-0004).
 *
 * A separate collection was rejected: membership is always read with its
 * project, never queried on its own, and it is bounded. Embedding turns "who
 * is on this project" from a join into a field.
 */
@Schema({ _id: false })
export class TeamMember {
  /** Unique within the array. Role must be TEAM_MEMBER (BR-23). */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Date, required: true, default: () => new Date() })
  addedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  addedById?: Types.ObjectId;
}

export const TeamMemberSchema = SchemaFactory.createForClass(TeamMember);

/**
 * Embedded milestone (ADR-0004).
 *
 * `_id` is kept — unlike `teamMembers` — because `tasks.milestoneId` refers to
 * it from another collection. An embedded document that something else points
 * at needs a stable identity.
 */
@Schema()
export class Milestone {
  @Prop({ type: Types.ObjectId, required: true, auto: true })
  _id!: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 2, maxlength: 150 })
  name!: string;

  @Prop({ required: false, trim: true, maxlength: 2000 })
  description?: string;

  @Prop({ type: Date, required: false })
  dueDate?: Date;

  /** Roadmap sequence. Unique within the array; enforced in the service. */
  @Prop({ type: Number, required: true, min: 0 })
  order!: number;

  @Prop({ type: Date, required: true, default: () => new Date() })
  createdAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  createdById?: Types.ObjectId;

  /**
   * 🔴 There is deliberately NO `status` and NO `progress` field here.
   *
   * BR-08 requires both to be computed, and ADR-0004 §3 chose computation on
   * read. Storing them — even "as a cache" — creates a number that can
   * disagree with the tasks it summarises, and that corruption is silent:
   * no error, no crash, just a wrong percentage shown to a client who is
   * deciding whether to approve work.
   *
   * They are derived by aggregating `tasks` by `milestoneId`, excluding
   * CANCELLED (BR-12). Adding them later is a measured migration decision,
   * not a shortcut to be taken while implementing a feature.
   */
}

export const MilestoneSchema = SchemaFactory.createForClass(Milestone);

/**
 * `projects` — the central aggregate (06-Database-Design.md section 7.3).
 *
 * `clientId` is the BR-10 scoping field: it is what makes a project reachable
 * by one client organisation and invisible to every other.
 */
@Schema({ collection: 'projects', timestamps: true })
export class Project extends AuditableDocument {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 150 })
  name!: string;

  @Prop({ required: false, trim: true, maxlength: 5000 })
  description?: string;

  /** Exactly one client (BR-03). The BR-10 anchor for everything below. */
  @Prop({ type: Types.ObjectId, ref: 'Client', required: true, index: true })
  clientId!: Types.ObjectId;

  /** Exactly one owning PM (BR-24). Only an Administrator may reassign it. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  projectManagerId!: Types.ObjectId;

  @Prop({
    required: true,
    enum: Object.values(ProjectStatus),
    default: ProjectStatus.PLANNED,
  })
  status!: ProjectStatus;

  @Prop({ type: Date, required: true })
  startDate!: Date;

  /** Never earlier than `startDate` — enforced in the service (FR-019). */
  @Prop({ type: Date, required: true })
  endDate!: Date;

  /** Provenance only. Later template edits never affect the project (FR-076). */
  @Prop({ type: Types.ObjectId, ref: 'ProjectTemplate', required: false })
  templateId?: Types.ObjectId;

  @Prop({ type: [TeamMemberSchema], required: true, default: [] })
  teamMembers!: TeamMember[];

  @Prop({ type: [MilestoneSchema], required: true, default: [] })
  milestones!: Milestone[];

  /** Archived projects are hidden from default lists and read-only (FR-027). */
  @Prop({ type: Date, default: null })
  archivedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  archivedBy?: Types.ObjectId;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

/**
 * Indexes 7–10 of 06-Database-Design.md section 8.1.
 *
 * There is no unique index on `name`: two clients may legitimately both have a
 * "Refonte site web", and forcing global uniqueness would make the second one
 * unnameable for a reason no user could guess.
 */

/** The Client Contact's entire world: their organisation's projects (BR-10). */
ProjectSchema.index({ clientId: 1, status: 1 });

/** A Project Manager's dashboard: the projects they own (BR-25). */
ProjectSchema.index({ projectManagerId: 1, status: 1 });

/**
 * A Team Member's list (BR-26). A multikey index over the embedded array —
 * available only because membership is embedded rather than joined.
 */
ProjectSchema.index({ 'teamMembers.userId': 1 });

/** Deadline and roadmap queries (BR-20, computed on read). */
ProjectSchema.index({ endDate: 1 });
