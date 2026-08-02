import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { FILE_LIMITS, MAX_FILE_SIZE_BYTES } from '@agencyflow/contracts';
import { Types, Schema as MongooseSchema } from 'mongoose';

/**
 * `FileRef` — the embedded value object shared by all three file contexts
 * (06-Database-Design.md section 5.2, BR-16).
 *
 * Lives in `core/database` rather than in one feature module because
 * deliverable versions, task attachments and project files all embed the same
 * shape. Defining it three times would let the three drift, and the field that
 * would drift first is the one that matters most.
 */
@Schema({ _id: true })
export class FileRef {
  /** Addressable within its context (06-DB section 4.4). */
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, auto: true })
  _id!: Types.ObjectId;

  /** Sanitised at upload. Never used as a filesystem path. */
  @Prop({ required: true, trim: true, maxlength: FILE_LIMITS.ORIGINAL_NAME_MAX })
  originalName!: string;

  /** Validated server-side against BR-15; the declared value is not trusted. */
  @Prop({ required: true })
  mimeType!: string;

  @Prop({ required: true, lowercase: true })
  extension!: string;

  @Prop({ type: Number, required: true, min: 1, max: MAX_FILE_SIZE_BYTES })
  sizeBytes!: number;

  /**
   * The Cloudinary `public_id` (ADR-0003). **Never sent to a client.**
   *
   * Exposing it would hand out a URL that works for anyone who has it, with no
   * permission check — exactly what the proxied download in FR-056 exists to
   * prevent.
   *
   * `passwordHash` gets `select: false` for the same purpose, and that is
   * deliberately NOT used here: this field sits inside an embedded array, where
   * the projection behaves differently and would silently strip the key the
   * download path needs. The guarantee is instead that `toFileRefView` maps an
   * explicit whitelist and never spreads the document — a whitelist cannot leak
   * a field, and a test asserts `storageKey` appears in no response.
   */
  @Prop({ required: true })
  storageKey!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: false })
  uploadedById?: Types.ObjectId;

  @Prop({ type: Date, required: true, default: () => new Date() })
  uploadedAt!: Date;
}

export const FileRefSchema = SchemaFactory.createForClass(FileRef);
