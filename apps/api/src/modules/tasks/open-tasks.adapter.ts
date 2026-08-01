import { Injectable } from '@nestjs/common';
import type { OpenTaskReference } from '@agencyflow/contracts';
import { Types } from 'mongoose';

import { AccessScope } from '../../core/authorization/access-scope';
import { ProjectsRepository } from '../projects/projects.repository';
import { TasksRepository } from './tasks.repository';
import type { OpenTasksLookup } from '../users/open-tasks.port';

/**
 * Answers BR-32 for `UsersModule`.
 *
 * A thin adapter rather than another method on the repository, because the
 * answer needs a project name that lives in a different collection — and a
 * repository that reaches into another module's data is exactly the coupling
 * the port was created to avoid.
 */
@Injectable()
export class OpenTasksAdapter implements OpenTasksLookup {
  constructor(
    private readonly tasks: TasksRepository,
    private readonly projects: ProjectsRepository,
  ) {}

  /**
   * The blocking tasks, each with the project it belongs to.
   *
   * Names are resolved in one batched read, not one per task. More
   * importantly, the whole lookup runs under the SYSTEM scope: BR-32 is an
   * invariant of the system, not a view of it, and scoping it to the asking
   * Administrator could let a deactivation succeed because they happened not
   * to see the blocking work.
   */
  async findOpenTasksForAssignee(userId: Types.ObjectId): Promise<OpenTaskReference[]> {
    const tasks = await this.tasks.findOpenTasksForAssignee(userId);

    if (tasks.length === 0) {
      return [];
    }

    const projectIds = [...new Set(tasks.map((task) => task.projectId.toString()))].map(
      (id) => new Types.ObjectId(id),
    );

    const projects = await this.projects.findMany(
      { _id: { $in: projectIds } },
      AccessScope.systemScope(),
      {},
    );

    const names = new Map(projects.map((project) => [project._id.toString(), project.name]));

    return tasks.map((task) => ({
      id: task._id.toString(),
      title: task.title,
      projectId: task.projectId.toString(),
      projectName: names.get(task.projectId.toString()) ?? '',
    }));
  }
}
