import { Prop } from '@nestjs/mongoose';
import { Types, Schema as MongooseSchema } from 'mongoose';

/**
 * Audit fields applied to every collection (06-Database-Design.md section 5.1).
 *
 * `createdAt` and `updatedAt` are managed by Mongoose timestamps; the actor
 * fields and the soft-delete pair are declared here so that all ten
 * collections carry an identical, recognisable block.
 *
 * `activities` deliberately omits the update fields: a schema with no way to
 * record a modification is a structure that cannot be modified, which is a
 * stronger guarantee than a comment saying so (06-Database-Design section 5.4).
 */
export abstract class AuditableDocument {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: false })
  createdBy?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: false })
  updatedBy?: Types.ObjectId;

  /** `null` means live. The single indicator of deletion (BR-30). */
  @Prop({ type: Date, default: null, index: true })
  deletedAt?: Date | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: false })
  deletedBy?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Partial-index filter for every unique constraint in the system.
 *
 * Without this, soft delete silently breaks uniqueness: a deleted user's email
 * still occupies the index, so the address can never be reused and the system
 * reports "already in use" for an account no interface can show
 * (06-Database-Design.md section 8.2, principle P-4). Non-negotiable.
 */
export const UNIQUE_WHEN_NOT_DELETED = { deletedAt: null } as const;
