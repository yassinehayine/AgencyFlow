import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type FilterQuery } from 'mongoose';

import { AccessScope } from '../../core/authorization/access-scope';
import { ScopedRepository } from '../../core/database/scoped.repository';
import { Deliverable, type DeliverableDocument } from './schemas/deliverable.schema';

@Injectable()
export class DeliverablesRepository extends ScopedRepository<DeliverableDocument> {
  constructor(@InjectModel(Deliverable.name) model: Model<DeliverableDocument>) {
    super(model);
  }

  /**
   * A deliverable is visible exactly when its project is.
   *
   * The difference from `tasks` is the one that matters: a Client Contact sees
   * deliverables — the approval loop is the entire reason they have an account
   * — whereas they see no tasks at all (BR-28). So there is no client
   * exclusion here, only the project restriction, and for a client that
   * restriction resolves to their own organisation's projects (BR-10).
   *
   * Unresolved fails closed, as for tasks: `accessibleProjectIds` is
   * `undefined` until the service resolves it, and reading that as "no
   * restriction" would expose every deliverable in the agency.
   */
  protected scopeFilter(scope: AccessScope): FilterQuery<DeliverableDocument> {
    if (scope.isAdministrator()) {
      return {};
    }

    const projectIds = scope.accessibleProjectIds;

    if (!projectIds) {
      return { _id: null };
    }

    return { projectId: { $in: projectIds.map((id) => new Types.ObjectId(id)) } };
  }
}
