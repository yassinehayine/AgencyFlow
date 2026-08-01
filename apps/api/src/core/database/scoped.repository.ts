import { Types } from 'mongoose';
import type { FilterQuery, Model, QueryOptions, UpdateQuery } from 'mongoose';

import type { AccessScope } from '../authorization/access-scope';

/**
 * Base repository. Layer 4 of the authorisation pipeline.
 *
 * Every read and write takes an AccessScope, and the scope filter is applied
 * BEFORE any caller-supplied filter. There is no method without a scope
 * parameter, so omitting it does not produce a data leak - it produces a
 * compile error (05-Software-Architecture.md section 11.3).
 *
 * Two invariants are enforced here rather than in each subclass, because a
 * rule repeated in ten places is a rule that will eventually be forgotten in
 * one of them:
 *
 *   1. Scope filtering (BR-10, BR-25, BR-26)
 *   2. Soft-delete exclusion (BR-30) - deleted records are invisible by
 *      default and must be asked for by name
 */
export abstract class ScopedRepository<TDocument> {
  protected constructor(protected readonly model: Model<TDocument>) {}

  /**
   * Translates a scope into a filter fragment for this collection.
   *
   * Returning `{}` means "no restriction" and must only ever be correct for
   * an Administrator. Subclasses that get this wrong break BR-10, which is
   * why each implementation is short, explicit, and individually tested.
   */
  protected abstract scopeFilter(scope: AccessScope): FilterQuery<TDocument>;

  /**
   * Composes the caller's filter, the soft-delete exclusion and the scope
   * filter as an explicit conjunction.
   *
   * `$and` rather than object spread. Spreading looks equivalent and is not:
   * when both sides constrain the same key, the last one silently WINS rather
   * than both applying. Concretely, a repository whose scope filter pins
   * `_id` to the caller's own record would have overwritten the `_id` that
   * `findById` had just put in - so asking for another user's record would
   * have quietly returned your own instead of nothing. A wrong document is a
   * far worse failure than an empty result, and it is the kind that passes a
   * casual test.
   *
   * `$and` makes both constraints apply, so a scope can only ever narrow.
   */
  protected buildFilter(
    scope: AccessScope,
    filter: FilterQuery<TDocument> = {},
    options: { includeDeleted?: boolean } = {},
  ): FilterQuery<TDocument> {
    const clauses = [
      filter,
      options.includeDeleted ? {} : { deletedAt: null },
      this.scopeFilter(scope),
    ].filter((clause) => Object.keys(clause).length > 0) as FilterQuery<TDocument>[];

    // MongoDB rejects an empty `$and`, and a single clause needs no wrapper.
    if (clauses.length === 0) {
      return {};
    }

    return clauses.length === 1 ? clauses[0] : ({ $and: clauses } as FilterQuery<TDocument>);
  }

  /**
   * Guards every id-keyed lookup.
   *
   * A malformed id is a client mistake, not a server fault: Mongoose would
   * throw a CastError and the filter would turn it into a 500, telling an
   * attacker that the id was at least parsed. Treating it as "no such
   * document" keeps the response identical to any other miss (BR-10).
   */
  protected isValidId(id: string): boolean {
    return Types.ObjectId.isValid(id);
  }

  /**
   * Inserts a document, stamping the actor.
   *
   * Creation takes no scope FILTER - there is nothing to filter yet - but it
   * still takes the scope, because that is where the actor comes from. Audit
   * stamping done here once cannot be forgotten by a caller, which is the
   * whole point of `06-Database-Design.md` section 5.1 being a block every
   * collection carries rather than a convention each service follows.
   */
  async create(data: Partial<TDocument>, scope: AccessScope): Promise<TDocument> {
    const actorId = scope.actorId;

    const created = await this.model.create({
      ...data,
      createdBy: actorId,
      updatedBy: actorId,
    });

    return created as TDocument;
  }

  async findById(
    id: string,
    scope: AccessScope,
    options: { includeDeleted?: boolean } = {},
  ): Promise<TDocument | null> {
    if (!this.isValidId(id)) {
      return null;
    }

    return this.model
      .findOne(this.buildFilter(scope, { _id: id } as FilterQuery<TDocument>, options))
      .exec();
  }

  async findOne(
    filter: FilterQuery<TDocument>,
    scope: AccessScope,
    options: { includeDeleted?: boolean } = {},
  ): Promise<TDocument | null> {
    return this.model.findOne(this.buildFilter(scope, filter, options)).exec();
  }

  async findMany(
    filter: FilterQuery<TDocument>,
    scope: AccessScope,
    queryOptions: QueryOptions<TDocument> = {},
  ): Promise<TDocument[]> {
    return this.model.find(this.buildFilter(scope, filter), null, queryOptions).exec();
  }

  async count(filter: FilterQuery<TDocument>, scope: AccessScope): Promise<number> {
    return this.model.countDocuments(this.buildFilter(scope, filter)).exec();
  }

  async exists(filter: FilterQuery<TDocument>, scope: AccessScope): Promise<boolean> {
    const found = await this.model.exists(this.buildFilter(scope, filter)).exec();
    return found !== null;
  }

  /**
   * Updates a document the scope may reach. Returns null when the document
   * does not exist OR lies outside the scope - the caller cannot distinguish
   * the two, which is what makes a cross-organisation request indistinguishable
   * from a genuine 404 (BR-10, 08-Backend-Design.md section 5.3).
   */
  async updateById(
    id: string,
    update: UpdateQuery<TDocument>,
    scope: AccessScope,
  ): Promise<TDocument | null> {
    if (!this.isValidId(id)) {
      return null;
    }

    return this.model
      .findOneAndUpdate(
        this.buildFilter(scope, { _id: id } as FilterQuery<TDocument>),
        this.withUpdateAudit(update, scope),
        { new: true },
      )
      .exec();
  }

  /**
   * Merges `updatedBy` into the caller's `$set`.
   *
   * Applied here rather than at each call site: an update that forgets to
   * record who made it leaves an audit trail with a hole in it, and the hole
   * is invisible until someone needs the trail.
   */
  private withUpdateAudit(
    update: UpdateQuery<TDocument>,
    scope: AccessScope,
  ): UpdateQuery<TDocument> {
    const existingSet = (update.$set ?? {}) as Record<string, unknown>;

    return {
      ...update,
      $set: { ...existingSet, updatedBy: scope.actorId },
    } as UpdateQuery<TDocument>;
  }

  /**
   * Soft delete. No repository method physically removes a record (BR-30).
   *
   * The deleting actor comes from the scope rather than a separate argument:
   * two sources for one fact eventually disagree, and the scope is the one
   * that cannot be spoofed.
   */
  async softDeleteById(id: string, scope: AccessScope): Promise<TDocument | null> {
    return this.updateById(
      id,
      { $set: { deletedAt: new Date(), deletedBy: scope.actorId } } as UpdateQuery<TDocument>,
      scope,
    );
  }
}
