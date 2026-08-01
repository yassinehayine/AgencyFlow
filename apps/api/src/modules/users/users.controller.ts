import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@agencyflow/contracts';
import type { PaginatedResponse, UserDetail, UserSummary } from '@agencyflow/contracts';

import { AccessScope } from '../../core/authorization/access-scope';
import { CurrentScope, Roles } from '../../core/authorization/authorization.decorators';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto, UpdateUserDto } from './dto/update-user.dto';
import { UserListQueryDto } from './dto/user-list-query.dto';
import { UsersService } from './users.service';

/**
 * `/api/v1/users` — internal account administration (FR-008 – FR-011).
 *
 * `@Roles(ADMINISTRATOR)` on the CLASS, not on each method. A decorator that
 * has to be repeated is a decorator that will eventually be omitted, and the
 * failure mode of omitting it here is an open endpoint. Any route that should
 * be reachable more widely has to be moved out or annotated deliberately,
 * which makes the exception visible in review.
 *
 * The controller does no work beyond binding HTTP to the service: no rule, no
 * query, no mapping (05-Software-Architecture.md section 8.1).
 */
@Controller('users')
@Roles(Role.ADMINISTRATOR)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** FR-008 */
  @Post()
  create(@Body() dto: CreateUserDto, @CurrentScope() scope: AccessScope): Promise<UserDetail> {
    return this.users.createStaff(dto, scope);
  }

  /** FR-011 */
  @Get()
  list(
    @Query() query: UserListQueryDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<PaginatedResponse<UserSummary>> {
    return this.users.findAll(query, scope);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentScope() scope: AccessScope): Promise<UserDetail> {
    return this.users.findById(id, scope);
  }

  /** FR-009 */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<UserDetail> {
    return this.users.update(id, dto, scope);
  }

  /**
   * FR-010, US-008 — deactivate an account.
   *
   * A named command, not a `PATCH { isActive }`. Deactivation carries BR-32,
   * A-10 and a self-lockout check; a writable boolean would be a path around
   * all three.
   */
  @Post(':id/deactivate')
  deactivate(@Param('id') id: string, @CurrentScope() scope: AccessScope): Promise<UserDetail> {
    return this.users.deactivate(id, scope);
  }

  /** The reverse. No BR-32 constraint applies to re-enabling an account. */
  @Post(':id/activate')
  activate(@Param('id') id: string, @CurrentScope() scope: AccessScope): Promise<UserDetail> {
    return this.users.activate(id, scope);
  }

  /**
   * FR-006 — reset another user's password.
   *
   * A named sub-resource rather than a field on PATCH /users/:id. Setting a
   * password is not editing an attribute: it needs its own permission, its own
   * audit meaning, and no generic write path that could reach it by accident.
   * 204 because there is nothing to return and nothing that should be.
   */
  @Post(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<void> {
    return this.users.resetPassword(id, dto, scope);
  }
}
