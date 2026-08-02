import { Controller, Get } from '@nestjs/common';
import { Role } from '@agencyflow/contracts';
import type { DashboardResponse } from '@agencyflow/contracts';

import { AccessScope } from '../../core/authorization/access-scope';
import { CurrentScope, Roles } from '../../core/authorization/authorization.decorators';
import { DashboardsService } from './dashboards.service';

/**
 * `GET /api/v1/dashboard` (08-Backend-Design.md §2.1).
 *
 * One route for four dashboards, and the alternative is worth naming: four
 * routes (`/dashboard/admin`, `/dashboard/pm`, …) would put the role in the
 * URL, which means a client choosing which one to call. It would work, right
 * up until someone requested a dashboard that was not theirs — and then the
 * only thing standing between them and it would be a guard somebody remembered
 * to add. Here the caller cannot express the question; the scope answers it.
 *
 * Singular, and not a collection: there is exactly one dashboard, yours.
 */
@Controller('dashboard')
@Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER, Role.TEAM_MEMBER, Role.CLIENT_CONTACT)
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  /** FR-068 – FR-072 */
  @Get()
  find(@CurrentScope() scope: AccessScope): Promise<DashboardResponse> {
    return this.dashboards.findForCurrentUser(scope);
  }
}
