import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ProjectsModule } from '../projects/projects.module';
import { Deliverable, DeliverableSchema } from './schemas/deliverable.schema';
import { DeliverablesController } from './deliverables.controller';
import { DeliverablesRepository } from './deliverables.repository';
import { DeliverablesService } from './deliverables.service';

/**
 * Deliverables, their versions and their files (08-Backend-Design.md 1.2).
 *
 * Versions are embedded (ADR-0004), so this module is their sole writer —
 * which is why there is no `VersionsModule`. `StorageModule` arrives from the
 * global core, keeping the dependency one-directional.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Deliverable.name, schema: DeliverableSchema }]),
    ProjectsModule,
  ],
  controllers: [DeliverablesController],
  providers: [DeliverablesService, DeliverablesRepository],
  exports: [DeliverablesService, DeliverablesRepository],
})
export class DeliverablesModule {}
