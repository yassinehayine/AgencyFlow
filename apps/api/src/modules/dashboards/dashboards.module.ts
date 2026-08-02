import { Module } from '@nestjs/common';

import { ClientsModule } from '../clients/clients.module';
import { DeliverablesModule } from '../deliverables/deliverables.module';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/users.module';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';

/**
 * The read model (05-Software-Architecture.md §7, M-11).
 *
 * **It reads from four modules and is written to by none, and nothing imports
 * it.** That makes it a leaf: it can depend on whatever it needs without any
 * risk of closing a cycle, which is why these imports are direct where the
 * earlier cross-module dependencies had to be inverted through a port.
 *
 * Tasks are the exception, and deliberately so. `TasksModule` exports neither
 * its service nor its repository, so the read model reaches task data through
 * `TASK_INSIGHTS_LOOKUP` — three named questions rather than an open handle.
 * That token arrives from the `@Global()` `TasksModule` and so needs no import
 * here; the port's own file explains why the inversion is worth keeping when
 * there is no cycle to break.
 */
@Module({
  imports: [ProjectsModule, DeliverablesModule, UsersModule, ClientsModule],
  controllers: [DashboardsController],
  providers: [DashboardsService],
})
export class DashboardsModule {}
