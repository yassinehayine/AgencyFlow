import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ClientsModule } from '../clients/clients.module';
import { UsersModule } from '../users/users.module';
import { Project, ProjectSchema } from './schemas/project.schema';
import { ProjectsController } from './projects.controller';
import { ProjectsRepository } from './projects.repository';
import { ProjectsService } from './projects.service';

/**
 * Projects, with milestones and team embedded (08-Backend-Design.md 1.2).
 *
 * **This module is the sole writer of the `projects` document.** Milestones
 * and team membership are embedded (ADR-0004), so no other module may touch
 * them — which is why there is no `MilestonesModule` and never will be.
 *
 * `ProjectsRepository` is exported because tasks, deliverables and files will
 * all need `accessibleProjectIds()` to scope themselves: they carry no
 * `clientId` of their own and must ask which projects the caller can reach.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Project.name, schema: ProjectSchema }]),
    UsersModule,
    ClientsModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectsRepository],
  exports: [ProjectsService, ProjectsRepository],
})
export class ProjectsModule {}
