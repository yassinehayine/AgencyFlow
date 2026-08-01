import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { OPEN_TASKS_LOOKUP } from '../users/open-tasks.port';
import { ProjectsModule } from '../projects/projects.module';
import { TASK_PROGRESS_LOOKUP } from '../projects/task-progress.port';
import { UsersModule } from '../users/users.module';
import { OpenTasksAdapter } from './open-tasks.adapter';
import { Task, TaskSchema } from './schemas/task.schema';
import { TasksController } from './tasks.controller';
import { TasksRepository } from './tasks.repository';
import { TasksService } from './tasks.service';

/**
 * Tasks and their state machine (08-Backend-Design.md §1.2).
 *
 * `@Global()` for one narrow reason: it satisfies two ports declared by
 * modules it depends on, and those modules cannot import it back without
 * closing a cycle.
 *
 *   `TASK_PROGRESS_LOOKUP`  ProjectsModule needs milestone progress, but
 *                           Tasks -> Projects already exists (BR-08).
 *   `OPEN_TASKS_LOOKUP`     UsersModule needs BR-32, but
 *                           Users -> Tasks -> Projects -> Users would close.
 *
 * Only the two tokens are exported, not the service or the repository, so the
 * module boundary stays intact: nothing gains access to task data by accident,
 * only to the two questions the other modules are entitled to ask.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
    ProjectsModule,
    UsersModule,
  ],
  controllers: [TasksController],
  providers: [
    TasksService,
    TasksRepository,
    OpenTasksAdapter,
    { provide: TASK_PROGRESS_LOOKUP, useExisting: TasksRepository },
    { provide: OPEN_TASKS_LOOKUP, useExisting: OpenTasksAdapter },
  ],
  exports: [TASK_PROGRESS_LOOKUP, OPEN_TASKS_LOOKUP],
})
export class TasksModule {}
