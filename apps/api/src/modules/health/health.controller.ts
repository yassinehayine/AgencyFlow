import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@agencyflow/contracts';

import { Public } from '../../core/authorization/authorization.decorators';
import { HealthService } from './health.service';

/**
 * Liveness and dependency status.
 *
 * Deliberately unauthenticated: it must answer before anyone can log in, and
 * it is what Render polls to decide whether the instance is up. It exposes no
 * business data — only whether the process and its two dependencies respond.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  async check(): Promise<HealthResponse> {
    return this.health.check();
  }
}
