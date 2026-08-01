import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type FilterQuery } from 'mongoose';

import { AccessScope } from '../../core/authorization/access-scope';
import { ScopedRepository } from '../../core/database/scoped.repository';
import { Project, type ProjectDocument } from './schemas/project.schema';

@Injectable()
export class ProjectsRepository extends ScopedRepository<ProjectDocument> {
  constructor(@InjectModel(Project.name) model: Model<ProjectDocument>) {
    super(model);
  }

  /**
   * The four visibility rules of FR-025, in one place.
   *
   * The translation is delegated to `AccessScope.projectScopeFilter()` rather
   * than rewritten here, because these same four rules govern tasks,
   * deliverables, files and comments through the project they belong to. Four
   * rules written five times is four rules that will eventually be written
   * four different ways.
   *
   *   Administrator   everything                          (BR-29)
   *   Project Manager projects they own                   (BR-25)
   *   Team Member     projects they belong to             (BR-26)
   *   Client Contact  their own organisation only         (BR-10)
   *
   * `_id: null` for a client token carrying no organisation — the safe
   * failure is the empty one, never the unrestricted one.
   */
  protected scopeFilter(scope: AccessScope): FilterQuery<ProjectDocument> {
    return scope.projectScopeFilter() as FilterQuery<ProjectDocument>;
  }

  /**
   * Resolves the ids this scope can reach.
   *
   * Needed by the collections that hang off a project — tasks, deliverables,
   * files — which have no `clientId` of their own and must therefore ask which
   * projects are visible before they can scope themselves. Returning ids
   * rather than exposing the filter keeps the rule in one place.
   *
   * `null` means "no restriction", which only ever happens for an
   * Administrator. That is deliberately a distinct value from an empty array,
   * which means "restricted, and nothing matches" — collapsing the two would
   * turn a user who belongs to no project into an administrator.
   */
  async accessibleProjectIds(scope: AccessScope): Promise<Types.ObjectId[] | null> {
    if (scope.isAdministrator()) {
      return null;
    }

    const projects = await this.model
      .find(this.buildFilter(scope))
      .select('_id')
      .lean<{ _id: Types.ObjectId }[]>()
      .exec();

    return projects.map((project) => project._id);
  }
}
