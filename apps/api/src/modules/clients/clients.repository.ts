import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type FilterQuery } from 'mongoose';

import { AccessScope } from '../../core/authorization/access-scope';
import { ScopedRepository } from '../../core/database/scoped.repository';
import { Client, type ClientDocument } from './schemas/client.schema';

@Injectable()
export class ClientsRepository extends ScopedRepository<ClientDocument> {
  constructor(@InjectModel(Client.name) model: Model<ClientDocument>) {
    super(model);
  }

  /**
   * A Client Contact can reach exactly one organisation: their own (BR-10).
   *
   * This is the most direct expression of client data isolation in the whole
   * system — the `clients` collection is where "their own organisation" is
   * literally a single document. Agency staff see all organisations; which of
   * them may reach the route at all is the guard's question, not this one.
   *
   * A malformed token reaching here with no `clientId` yields an unsatisfiable
   * filter rather than an unrestricted one. The safe failure is the empty one.
   */
  protected scopeFilter(scope: AccessScope): FilterQuery<ClientDocument> {
    if (!scope.isClientContact()) {
      return {};
    }

    return scope.clientId && Types.ObjectId.isValid(scope.clientId)
      ? { _id: new Types.ObjectId(scope.clientId) }
      : { _id: null };
  }

  /**
   * Resolves display names for a set of organisations in ONE query.
   *
   * Exists so a project list does not issue a lookup per row. Scope-aware like
   * every other read: an organisation the caller cannot reach is simply absent
   * from the map, and the caller renders a blank label rather than leaking a
   * name across the BR-10 boundary.
   */
  async findNamesByIds(ids: Types.ObjectId[], scope: AccessScope): Promise<Map<string, string>> {
    if (ids.length === 0) {
      return new Map();
    }

    const clients = await this.findMany({ _id: { $in: ids } }, scope, {});

    return new Map(clients.map((client) => [client._id.toString(), client.name]));
  }

  /**
   * Uniqueness pre-check, so the caller is told the name is taken rather than
   * receiving a bare conflict. Case-insensitive and anchored: "NewDev" and
   * "newdev" are the same organisation to a human, and two of them in a
   * dropdown is a data-entry accident waiting to happen.
   */
  async nameExists(name: string, excludeId?: string): Promise<boolean> {
    const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const filter: FilterQuery<ClientDocument> = {
      name: new RegExp(`^${escaped}$`, 'i'),
      deletedAt: null,
      ...(excludeId && Types.ObjectId.isValid(excludeId)
        ? { _id: { $ne: new Types.ObjectId(excludeId) } }
        : {}),
    };

    const found = await this.model.exists(filter).exec();
    return found !== null;
  }
}
