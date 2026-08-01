import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@agencyflow/contracts';
import type { ClientDetail, ClientSummary, PaginatedResponse } from '@agencyflow/contracts';
import type { FilterQuery } from 'mongoose';

import { AccessScope } from '../../core/authorization/access-scope';
import { paginate } from '../../common/dto/pagination-query.dto';
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from '../../common/exceptions/domain.exception';
import { fr } from '../../i18n/fr';
import { ClientsRepository } from './clients.repository';
import type { ClientListQueryDto, CreateClientDto, UpdateClientDto } from './dto/client.dto';
import type { ClientDocument } from './schemas/client.schema';

function toSummary(document: ClientDocument): ClientSummary {
  return {
    id: document._id.toString(),
    name: document.name,
    ...(document.contactEmail ? { contactEmail: document.contactEmail } : {}),
    ...(document.contactPhone ? { contactPhone: document.contactPhone } : {}),
    // Derived, never stored twice. Two representations of one fact eventually
    // disagree, and the stored one is always the stale one.
    isArchived: Boolean(document.archivedAt),
  };
}

function toDetail(document: ClientDocument): ClientDetail {
  return {
    ...toSummary(document),
    ...(document.address ? { address: document.address } : {}),
    ...(document.notes ? { notes: document.notes } : {}),
    ...(document.archivedAt ? { archivedAt: document.archivedAt.toISOString() } : {}),
    createdAt: (document.createdAt ?? new Date()).toISOString(),
    updatedAt: (document.updatedAt ?? new Date()).toISOString(),
  };
}

/** Client organisation rules (FR-013 – FR-015). */
@Injectable()
export class ClientsService {
  constructor(private readonly repository: ClientsRepository) {}

  async create(dto: CreateClientDto, scope: AccessScope): Promise<ClientDetail> {
    await this.assertNameAvailable(dto.name);
    return toDetail(await this.repository.create({ ...dto }, scope));
  }

  async findAll(
    query: ClientListQueryDto,
    scope: AccessScope,
  ): Promise<PaginatedResponse<ClientSummary>> {
    const filter = this.buildListFilter(query);

    const [documents, totalItems] = await Promise.all([
      this.repository.findMany(filter, scope, {
        skip: query.skip,
        limit: query.pageSize,
        sort: { name: query.sortOrder === 'desc' ? -1 : 1 },
      }),
      this.repository.count(filter, scope),
    ]);

    return paginate(documents.map(toSummary), totalItems, query);
  }

  async findById(id: string, scope: AccessScope): Promise<ClientDetail> {
    return toDetail(await this.getOrFail(id, scope));
  }

  async update(id: string, dto: UpdateClientDto, scope: AccessScope): Promise<ClientDetail> {
    await this.getOrFail(id, scope);

    if (dto.name !== undefined) {
      await this.assertNameAvailable(dto.name, id);
    }

    const updated = await this.repository.updateById(id, { $set: { ...dto } }, scope);

    if (!updated) {
      throw new ResourceNotFoundException(fr.clients.notFound);
    }

    return toDetail(updated);
  }

  /**
   * Confirms an organisation exists and is open for new work.
   *
   * Exported for `UsersService`'s caller rather than kept private: creating a
   * contact for a non-existent organisation must fail before an orphaned user
   * is written, and the check belongs to whoever owns the organisation.
   */
  async assertUsableForNewWork(id: string, scope: AccessScope): Promise<ClientDocument> {
    const client = await this.getOrFail(id, scope);

    if (client.archivedAt) {
      throw new ResourceConflictException(ErrorCode.CLIENT_ARCHIVED, fr.clients.archived);
    }

    return client;
  }

  /**
   * Case-insensitive on purpose: "NewDev" and "newdev" are one organisation to
   * a human, and two of them in a project dropdown is a data-entry accident.
   *
   * The unique index is case-SENSITIVE, so this check is the only thing that
   * catches a case-only clash, and it is not atomic. Two simultaneous creates
   * differing only in case could both land. Accepted: organisations are
   * created rarely, by one Administrator, and the consequence is a duplicate
   * row rather than a corrupted one. A case-insensitive index would need a
   * collation that every query would then have to match.
   */
  private async assertNameAvailable(name: string, excludeId?: string): Promise<void> {
    if (await this.repository.nameExists(name, excludeId)) {
      throw new ResourceConflictException(
        ErrorCode.CLIENT_NAME_ALREADY_EXISTS,
        fr.clients.nameAlreadyExists,
      );
    }
  }

  private async getOrFail(id: string, scope: AccessScope): Promise<ClientDocument> {
    const found = await this.repository.findById(id, scope);

    if (!found) {
      throw new ResourceNotFoundException(fr.clients.notFound);
    }

    return found;
  }

  private buildListFilter(query: ClientListQueryDto): FilterQuery<ClientDocument> {
    const filter: FilterQuery<ClientDocument> = {};

    if (!query.includeArchived) {
      filter.archivedAt = null;
    }

    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = new RegExp(escaped, 'i');
    }

    return filter;
  }
}
