import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_FILE_SIZE_BYTES, Role } from '@agencyflow/contracts';
import type {
  DeliverableDetail,
  DeliverableSummary,
  PaginatedResponse,
} from '@agencyflow/contracts';
import type { Response } from 'express';

import { AccessScope } from '../../core/authorization/access-scope';
import { CurrentScope, Roles } from '../../core/authorization/authorization.decorators';
import {
  DeliverablesService,
  type UploadedFile as UploadedFilePayload,
} from './deliverables.service';
import {
  CreateDeliverableDto,
  DeliverableListQueryDto,
  RequestChangesDto,
  UpdateDeliverableDto,
} from './dto/deliverable.dto';

/**
 * `/api/v1/deliverables` and `/api/v1/projects/:projectId/deliverables`.
 *
 * FR-045 – FR-056. Every state change is a named POST sub-resource, so BR-05,
 * BR-07 and BR-31 have no generic write path to slip through.
 *
 * The class allows all four roles because a Client Contact belongs here — the
 * approval loop is the whole reason they have an account, unlike tasks, which
 * they never see (BR-28). Which role may do WHAT is settled per route and,
 * where it depends on ownership or state, in the service.
 */
@Controller()
@Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER, Role.TEAM_MEMBER, Role.CLIENT_CONTACT)
export class DeliverablesController {
  constructor(private readonly deliverables: DeliverablesService) {}

  /** FR-045 */
  @Post('projects/:projectId/deliverables')
  @Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER)
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateDeliverableDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<DeliverableDetail> {
    return this.deliverables.create(projectId, dto, scope);
  }

  /** FR-052 */
  @Get('deliverables')
  list(
    @Query() query: DeliverableListQueryDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<PaginatedResponse<DeliverableSummary>> {
    return this.deliverables.findAll(query, scope);
  }

  /**
   * FR-052, FR-054 — a pure read.
   *
   * Reading a `SUBMITTED` deliverable does NOT move it to `UNDER_REVIEW`.
   * BR-31 forbids it, and the reason is practical as well as principled: two
   * contacts of the same organisation opening this page would race.
   */
  @Get('deliverables/:id')
  findOne(@Param('id') id: string, @CurrentScope() scope: AccessScope): Promise<DeliverableDetail> {
    return this.deliverables.findById(id, scope);
  }

  /** FR-045 — refused once approved (BR-07). */
  @Patch('deliverables/:id')
  @Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDeliverableDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<DeliverableDetail> {
    return this.deliverables.update(id, dto, scope);
  }

  /**
   * FR-046 — attach a file to the current version.
   *
   * The multer limit is a first line only: it stops a 2 GB body from being
   * buffered at all. The authoritative check is in the service, which inspects
   * the bytes — a size limit that lives only in middleware is a size limit
   * somebody will later configure away (BR-15, NFR-24).
   *
   * Typed against the service's own `UploadedFile` rather than multer's
   * ambient `Express.Multer.File`: the shape needed is three fields, and
   * depending on a global namespace from a transport library would put a
   * middleware detail into the signature of a business call.
   */
  @Post('deliverables/:id/files')
  @Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  addFile(
    @Param('id') id: string,
    @UploadedFile() file: UploadedFilePayload,
    @CurrentScope() scope: AccessScope,
  ): Promise<DeliverableDetail> {
    return this.deliverables.addFile(id, file, scope);
  }

  /** FR-047 — BR-05. At least one file required. */
  @Post('deliverables/:id/submit')
  @Roles(Role.ADMINISTRATOR, Role.PROJECT_MANAGER)
  submit(@Param('id') id: string, @CurrentScope() scope: AccessScope): Promise<DeliverableDetail> {
    return this.deliverables.submit(id, scope);
  }

  /**
   * FR-081 — BR-31.
   *
   * Client Contact only, and deliberately a POST. This exists precisely
   * because the transition must not be a side effect of a GET.
   */
  @Post('deliverables/:id/start-review')
  @Roles(Role.CLIENT_CONTACT)
  startReview(
    @Param('id') id: string,
    @CurrentScope() scope: AccessScope,
  ): Promise<DeliverableDetail> {
    return this.deliverables.startReview(id, scope);
  }

  /** FR-048 — terminal (BR-07). The client's formal acceptance. */
  @Post('deliverables/:id/approve')
  @Roles(Role.CLIENT_CONTACT)
  approve(@Param('id') id: string, @CurrentScope() scope: AccessScope): Promise<DeliverableDetail> {
    return this.deliverables.approve(id, scope);
  }

  /** FR-049, FR-050 — appends a new version (BR-06). Comment mandatory. */
  @Post('deliverables/:id/request-changes')
  @Roles(Role.CLIENT_CONTACT)
  requestChanges(
    @Param('id') id: string,
    @Body() dto: RequestChangesDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<DeliverableDetail> {
    return this.deliverables.requestChanges(id, dto, scope);
  }

  /**
   * FR-056 — download, proxied.
   *
   * The provider URL is never returned. A Cloudinary delivery URL works for
   * anyone holding it, forever, with no authorisation — so handing one out
   * would defeat BR-10 no matter how well the surrounding endpoints are
   * guarded (ADR-0003 S-2). Streaming through the API means the permission
   * check runs on every download rather than once.
   *
   * The filename is percent-encoded into `filename*`: it has been sanitised at
   * upload, but a header built by concatenation is worth encoding regardless.
   */
  @Get('deliverables/:id/files/:fileId')
  async download(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @CurrentScope() scope: AccessScope,
    @Res() response: Response,
  ): Promise<void> {
    const { stream, filename, mimeType } = await this.deliverables.download(id, fileId, scope);

    response.setHeader('Content-Type', mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );

    stream.pipe(response);
  }
}
