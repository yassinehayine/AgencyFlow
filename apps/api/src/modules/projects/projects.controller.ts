import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@agencyflow/contracts';
import type { PaginatedResponse, ProjectDetail, ProjectSummary } from '@agencyflow/contracts';

import { AccessScope } from '../../core/authorization/access-scope';
import { CurrentScope, Roles } from '../../core/authorization/authorization.decorators';
import { ProjectsService } from './projects.service';
import {
  AddTeamMemberDto,
  ChangeProjectStatusDto,
  CreateProjectDto,
  ProjectListQueryDto,
  ReassignProjectManagerDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { CreateMilestoneDto, UpdateMilestoneDto } from './dto/milestone.dto';

/**
 * `/api/v1/projects` (FR-019 – FR-026).
 *
 * The class carries no `@Roles()`, and that is deliberate rather than an
 * omission: **reads are open to every authenticated role**, because each one
 * legitimately sees a different set of projects and the scope filter is what
 * decides which (FR-025). A Client Contact reaching `GET /projects` is correct
 * behaviour — they receive their own organisation's projects and nothing else.
 *
 * Writes carry an explicit `@Roles()`. Ownership is not re-checked here: a
 * Project Manager's scope already excludes projects they do not own, so a
 * write against someone else's project finds nothing and returns 404 — the
 * same answer as for a project that does not exist (BR-10, BR-25).
 */
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  /** FR-019 */
  @Post()
  @Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER)
  create(
    @Body() dto: CreateProjectDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<ProjectDetail> {
    return this.projects.create(dto, scope);
  }

  /** FR-025 — scoped four different ways by role. */
  @Get()
  list(
    @Query() query: ProjectListQueryDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<PaginatedResponse<ProjectSummary>> {
    return this.projects.findAll(query, scope);
  }

  /** FR-026 — the roster is omitted for a Client Contact (BR-28). */
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentScope() scope: AccessScope): Promise<ProjectDetail> {
    return this.projects.findById(id, scope);
  }

  /** FR-020 */
  @Patch(':id')
  @Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<ProjectDetail> {
    return this.projects.update(id, dto, scope);
  }

  /**
   * FR-021 — a named command, not a PATCH of `status`.
   *
   * Having no generic status-write path is what makes the transition table
   * unbypassable (05-Architecture section 10.3). The same convention carries
   * BR-04, BR-05 and BR-07 in later slices.
   */
  @Post(':id/status')
  @Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER)
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeProjectStatusDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<ProjectDetail> {
    return this.projects.changeStatus(id, dto, scope);
  }

  /** FR-022 — Administrator only (BR-24). */
  @Post(':id/manager')
  @Roles(Role.ADMINISTRATOR)
  reassignManager(
    @Param('id') id: string,
    @Body() dto: ReassignProjectManagerDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<ProjectDetail> {
    return this.projects.reassignProjectManager(id, dto, scope);
  }

  /** FR-023 */
  @Post(':id/team')
  @Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER)
  addTeamMember(
    @Param('id') id: string,
    @Body() dto: AddTeamMemberDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<ProjectDetail> {
    return this.projects.addTeamMember(id, dto, scope);
  }

  /**
   * FR-029 — milestones live inside the project document (ADR-0004), so they
   * are written here. That is why there is no MilestonesModule.
   */
  @Post(':id/milestones')
  @Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER)
  createMilestone(
    @Param('id') id: string,
    @Body() dto: CreateMilestoneDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<ProjectDetail> {
    return this.projects.createMilestone(id, dto, scope);
  }

  /** FR-030 — status and progress are absent from the DTO by design (BR-08). */
  @Patch(':id/milestones/:milestoneId')
  @Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER)
  updateMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<ProjectDetail> {
    return this.projects.updateMilestone(id, milestoneId, dto, scope);
  }

  /** FR-034 — refused while the milestone still holds open tasks. */
  @Delete(':id/milestones/:milestoneId')
  @Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER)
  deleteMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentScope() scope: AccessScope,
  ): Promise<ProjectDetail> {
    return this.projects.deleteMilestone(id, milestoneId, scope);
  }

  /** FR-024 */
  @Delete(':id/team/:userId')
  @Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER)
  removeTeamMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentScope() scope: AccessScope,
  ): Promise<ProjectDetail> {
    return this.projects.removeTeamMember(id, userId, scope);
  }
}
