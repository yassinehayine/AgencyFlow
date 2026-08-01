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
   * Composes the scope filter, the soft-delete exclusion and the caller's
   * filter. Scope is spread last so a caller cannot override it - passing
   * `{ clientId: someoneElse }` cannot widen what the scope permits.
   */
  protected buildFilter(
    scope: AccessScope,
    filter: FilterQuery<TDocument> = {},
    options: { includeDeleted?: boolean } = {},
  ): FilterQuery<TDocument> {
    const base = options.includeDeleted ? {} : { deletedAt: null };

    return {
      ...filter,
      ...base,
      ...this.scopeFilter(scope),
    } as FilterQuery<TDocument>;
  }

  async findById(
    id: string,
    scope: AccessScope,
    options: { includeDeleted?: boolean } = {},
  ): Promise<TDocument | null> {
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
    return this.model
      .findOneAndUpdate(this.buildFilter(scope, { _id: id } as FilterQuery<TDocument>), update, {
        new: true,
      })
      .exec();
  }

  /** Soft delete. No repository method physically removes a record (BR-30). */
  async softDeleteById(
    id: string,
    scope: AccessScope,
    deletedBy: string,
  ): Promise<TDocument | null> {
    return this.updateById(
      id,
      { $set: { deletedAt: new Date(), deletedBy } } as UpdateQuery<TDocument>,
      scope,
    );
  }
}
