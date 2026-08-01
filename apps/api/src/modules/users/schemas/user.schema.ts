import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Role,
  Skill,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  USER_LIMITS,
} from '@agencyflow/contracts';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';

import { AuditableDocument, UNIQUE_WHEN_NOT_DELETED } from '../../../core/database/audit.schema';

export type UserDocument = HydratedDocument<User>;

/**
 * `users` collection (06-Database-Design.md section 7.1).
 *
 * The two conditional-required rules — `skill` iff `TEAM_MEMBER` (CIR-1) and
 * `clientId` iff `CLIENT_CONTACT` (CIR-2) — are NOT expressed here. Mongoose
 * can express "required", not "required if and only if", and half a rule in
 * the schema plus half in the service is worse than the whole rule in one
 * place. `UsersService` owns both, as the design specifies.
 */
@Schema({ collection: 'users', timestamps: true })
export class User extends AuditableDocument {
  @Prop({
    required: true,
    trim: true,
    minlength: USER_LIMITS.NAME_MIN,
    maxlength: USER_LIMITS.NAME_MAX,
  })
  name!: string;

  /**
   * The `@mention` handle. Immutable after creation (BR-33, A-13) — enforced
   * in the service, because immutability is a rule about transitions and a
   * schema only sees the resulting state.
   */
  @Prop({
    required: true,
    lowercase: true,
    trim: true,
    minlength: USERNAME_MIN_LENGTH,
    maxlength: USERNAME_MAX_LENGTH,
    match: USERNAME_PATTERN,
  })
  username!: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email!: string;

  /**
   * `select: false` makes exclusion the default for every query in the
   * application, so NFR-18 holds even in code written a year from now by
   * someone who has not read it. The one place that needs the hash — login —
   * has to ask for it by name with `.select('+passwordHash')`, which is a
   * visible, greppable exception rather than a silent leak.
   */
  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ required: true, enum: Object.values(Role) })
  role!: Role;

  /** Descriptive only. A skill never grants a permission (BR-02). */
  @Prop({ required: false, enum: Object.values(Skill) })
  skill?: Skill;

  /** The BR-10 anchor for a Client Contact. Immutable once set (A-08). */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Client', required: false })
  clientId?: Types.ObjectId;

  /**
   * May authenticate. Deliberately distinct from `deletedAt`: a deactivated
   * user keeps every record they authored and stays visible everywhere they
   * appear; they simply cannot log in (BR-30, 06-DB section 10.1).
   */
  @Prop({ required: true, default: true })
  isActive!: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

/**
 * Indexes 1–4 of 06-Database-Design.md section 8.1.
 *
 * The two unique indexes are PARTIAL on `deletedAt: null`, and that is not a
 * refinement — it is the difference between working and broken. A plain unique
 * index keeps a soft-deleted user's email occupying the key forever, so the
 * address can never be reused and the system reports "already in use" for an
 * account no screen can show (principle P-4).
 */
UserSchema.index({ email: 1 }, { unique: true, partialFilterExpression: UNIQUE_WHEN_NOT_DELETED });
UserSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: UNIQUE_WHEN_NOT_DELETED },
);

/** Serves the combinable role/skill/status filters of FR-011. */
UserSchema.index({ role: 1, skill: 1, isActive: 1 });

/** Sparse: only Client Contacts carry the field, so only they enter the index. */
UserSchema.index({ clientId: 1 }, { sparse: true });
