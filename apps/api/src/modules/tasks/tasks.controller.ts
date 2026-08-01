import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@agencyflow/contracts';
import type { PaginatedResponse, TaskDetail, TaskSummary } from '@agencyflow/contracts';

import { AccessScope } from '../../core/authorization/access-scope';
import { CurrentScope, Roles } from '../../core/authorization/authorization.decorators';
import { TasksService } from './tasks.service';
import {
  AssignTaskDto,
  BlockTaskDto,
  CreateTaskDto,
  TaskListQueryDto,
  UpdateTaskDto,
} from './dto/task.dto';

/**
 * `/api/v1/tasks` and `/api/v1/projects/:projectId/tasks` (FR-035 – FR-043).
 *
 * **Every state transition is a named POST sub-resource, never a `PATCH`
 * carrying a status** (05-Architecture §10.3). That is what makes BR-04
 * unbypassable: there is no generic write path to `status`, so "a Team Member
 * cannot mark a task Done" is a property of the route map rather than a check
 * somebody has to remember on every endpoint.
 *
 * Guards here are coarse. `@Roles(TEAM_MEMBER, ...)` answers "may this role
 * reach the route"; only the service can answer "is this the assignee, and is
 * the task actually in review" (BR-26, BR-04).
 */
@Controller()
@Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER, Role.TEAM_MEMBER)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  /** FR-035 — creation is always project-nested (08-Backend-Design §2.1). */
  @Post('projects/:projectId/tasks')
  @Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER)
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<TaskDetail> {
    return this.tasks.create(projectId, dto, scope);
  }

  /**
   * FR-043.
   *
   * Client Contacts are excluded at the route (BR-28) AND match nothing in the
   * repository scope. Two layers, because this is the boundary a client must
   * never cross.
   */
  @Get('tasks')
  list(
    @Query() query: TaskListQueryDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<PaginatedResponse<TaskSummary>> {
    return this.tasks.findAll(query, scope);
  }

  @Get('tasks/:id')
  findOne(@Param('id') id: string, @CurrentScope() scope: AccessScope): Promise<TaskDetail> {
    return this.tasks.findById(id, scope);
  }

  /** FR-037 */
  @Patch('tasks/:id')
  @Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<TaskDetail> {
    return this.tasks.update(id, dto, scope);
  }

  /** FR-036 — BR-23 is checked in the service. */
  @Post('tasks/:id/assignee')
  @Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER)
  assign(
    @Param('id') id: string,
    @Body() dto: AssignTaskDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<TaskDetail> {
    return this.tasks.assign(id, dto, scope);
  }

  /** FR-038 — assignee only, enforced in the service (BR-26). */
  @Post('tasks/:id/start')
  start(@Param('id') id: string, @CurrentScope() scope: AccessScope): Promise<TaskDetail> {
    return this.tasks.start(id, scope);
  }

  /** FR-038 */
  @Post('tasks/:id/submit-review')
  submitForReview(
    @Param('id') id: string,
    @CurrentScope() scope: AccessScope,
  ): Promise<TaskDetail> {
    return this.tasks.submitForReview(id, scope);
  }

  /**
   * FR-039, FR-040 — BR-04.
   *
   * A Team Member reaches this route (the class allows it) and is refused by
   * the service with 403. That is deliberate: FR-039 requires the rejection to
   * be server-side and explicit, not merely a route they cannot address.
   */
  @Post('tasks/:id/done')
  markDone(@Param('id') id: string, @CurrentScope() scope: AccessScope): Promise<TaskDetail> {
    return this.tasks.markDone(id, scope);
  }

  /** FR-040 — a manager returns work to the assignee. */
  @Post('tasks/:id/return')
  @Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER)
  returnToProgress(
    @Param('id') id: string,
    @CurrentScope() scope: AccessScope,
  ): Promise<TaskDetail> {
    return this.tasks.returnToProgress(id, scope);
  }

  /** FR-041 — BR-22, reason mandatory. */
  @Post('tasks/:id/block')
  block(
    @Param('id') id: string,
    @Body() dto: BlockTaskDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<TaskDetail> {
    return this.tasks.block(id, dto, scope);
  }

  /** FR-041 — clearing BLOCKED also clears the reason (BR-22). */
  @Post('tasks/:id/unblock')
  unblock(@Param('id') id: string, @CurrentScope() scope: AccessScope): Promise<TaskDetail> {
    return this.tasks.unblock(id, scope);
  }

  /** FR-042 — cancelled tasks leave milestone progress entirely (BR-12). */
  @Post('tasks/:id/cancel')
  @Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER)
  cancel(@Param('id') id: string, @CurrentScope() scope: AccessScope): Promise<TaskDetail> {
    return this.tasks.cancel(id, scope);
  }
}
