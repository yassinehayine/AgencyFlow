import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@agencyflow/contracts';
import type {
  ClientDetail,
  ClientSummary,
  PaginatedResponse,
  UserDetail,
  UserSummary,
} from '@agencyflow/contracts';

import { AccessScope } from '../../core/authorization/access-scope';
import { CurrentScope, Roles } from '../../core/authorization/authorization.decorators';
import { UsersService } from '../users/users.service';
import { ClientsService } from './clients.service';
import { CreateClientContactDto } from '../users/dto/create-user.dto';
import { ClientListQueryDto, CreateClientDto, UpdateClientDto } from './dto/client.dto';

/**
 * `/api/v1/clients` — organisations and their contact accounts.
 *
 * Permissions here are not uniform, so the class carries the WIDEST role set
 * and each narrower route says so explicitly. The permission matrix (SRS
 * section 8) is authoritative: an Administrator creates and edits
 * organisations; a Project Manager may read them and create contacts, because
 * a PM needs to give their client access without waiting for an administrator.
 */
@Controller('clients')
@Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER)
export class ClientsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly users: UsersService,
  ) {}

  /** FR-013 — Administrator only. */
  @Post()
  @Roles(Role.ADMINISTRATOR)
  create(@Body() dto: CreateClientDto, @CurrentScope() scope: AccessScope): Promise<ClientDetail> {
    return this.clients.create(dto, scope);
  }

  /** FR-015 */
  @Get()
  list(
    @Query() query: ClientListQueryDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<PaginatedResponse<ClientSummary>> {
    return this.clients.findAll(query, scope);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentScope() scope: AccessScope): Promise<ClientDetail> {
    return this.clients.findById(id, scope);
  }

  /** FR-014 — Administrator only. */
  @Patch(':id')
  @Roles(Role.ADMINISTRATOR)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<ClientDetail> {
    return this.clients.update(id, dto, scope);
  }

  /** FR-017 — the contacts of this organisation, and only this one. */
  @Get(':id/contacts')
  listContacts(
    @Param('id') id: string,
    @CurrentScope() scope: AccessScope,
  ): Promise<UserSummary[]> {
    return this.users.findContactsOfClient(id, scope);
  }

  /**
   * FR-016 — create a login for someone at this organisation.
   *
   * Nested under the organisation deliberately. The account's `clientId` is
   * the path segment, so there is no request field in which a caller could
   * name a different organisation — BR-10 holds by the shape of the route
   * rather than by a check someone has to remember (08-Backend-Design 2.3).
   *
   * The organisation is confirmed to exist and to be open for new work BEFORE
   * the user is written; otherwise a typo in the id would create an account
   * belonging to nothing.
   */
  @Post(':id/contacts')
  async createContact(
    @Param('id') id: string,
    @Body() dto: CreateClientContactDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<UserDetail> {
    await this.clients.assertUsableForNewWork(id, scope);
    return this.users.createClientContact(dto, id, scope);
  }
}
