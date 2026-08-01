import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { CLIENT_LIMITS } from '@agencyflow/contracts';
import { HydratedDocument, Types } from 'mongoose';

import { AuditableDocument, UNIQUE_WHEN_NOT_DELETED } from '../../../core/database/audit.schema';

export type ClientDocument = HydratedDocument<Client>;

/**
 * `clients` collection (06-Database-Design.md section 7.2).
 *
 * A Client is an ORGANISATION (BR-09). The people are `CLIENT_CONTACT` users
 * pointing here, which is what makes `_id` usable as the isolation key for
 * BR-10: one organisation, many logins, one boundary.
 */
@Schema({ collection: 'clients', timestamps: true })
export class Client extends AuditableDocument {
  @Prop({
    required: true,
    trim: true,
    minlength: CLIENT_LIMITS.NAME_MIN,
    maxlength: CLIENT_LIMITS.NAME_MAX,
  })
  name!: string;

  /** Organisation-level address, distinct from any contact's login email. */
  @Prop({ required: false, lowercase: true, trim: true })
  contactEmail?: string;

  @Prop({ required: false, trim: true })
  contactPhone?: string;

  @Prop({ required: false, trim: true, maxlength: CLIENT_LIMITS.ADDRESS_MAX })
  address?: string;

  @Prop({ required: false, trim: true, maxlength: CLIENT_LIMITS.NOTES_MAX })
  notes?: string;

  /**
   * Retired from active use. A third lifecycle state, distinct from both
   * `isActive` and `deletedAt` (06-DB section 10.1): archived organisations
   * are hidden from default lists and accept no new projects, while every
   * existing project and its whole history stay fully readable.
   */
  @Prop({ type: Date, default: null })
  archivedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  archivedBy?: Types.ObjectId;
}

export const ClientSchema = SchemaFactory.createForClass(Client);

/**
 * Index 5 — unique organisation name (FR-013), partial on `deletedAt: null`.
 *
 * Partial for the same reason as every other unique index here: without it a
 * soft-deleted organisation would hold its name forever, and re-creating a
 * client the agency had removed would be impossible for a reason no screen
 * could explain (principle P-4).
 */
ClientSchema.index({ name: 1 }, { unique: true, partialFilterExpression: UNIQUE_WHEN_NOT_DELETED });

/** Index 6 — the default list is "not archived, by name" (FR-015). */
ClientSchema.index({ archivedAt: 1, name: 1 });
