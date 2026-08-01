import { Inject, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { DependencyStatus, type HealthResponse } from '@agencyflow/contracts';
import type { Connection } from 'mongoose';

import {
  STORAGE_SERVICE,
  type IStorageService,
} from '../../core/storage/storage.service.interface';

/** How long a storage probe result is reused before re-checking. */
const STORAGE_PROBE_TTL_MS = 60_000;

@Injectable()
export class HealthService {
  private storageProbe: { status: DependencyStatus; checkedAt: number } = {
    status: DependencyStatus.UNKNOWN,
    checkedAt: 0,
  };

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
  ) {}

  async check(): Promise<HealthResponse> {
    const database = this.checkDatabase();
    const storage = await this.checkStorage();

    return {
      status: database === DependencyStatus.UP ? 'ok' : 'degraded',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.1.0',
      dependencies: { database, storage },
    };
  }

  /**
   * Mongoose reports connection state in memory, so this costs nothing and is
   * safe to call on every request — including Render's frequent health probes.
   */
  private checkDatabase(): DependencyStatus {
    return this.connection.readyState === 1 ? DependencyStatus.UP : DependencyStatus.DOWN;
  }

  /**
   * The storage probe is a real network call, so its result is cached.
   * Without the cache, an uptime monitor polling this endpoint would generate
   * continuous Cloudinary traffic and consume free-tier quota for no benefit.
   */
  private async checkStorage(): Promise<DependencyStatus> {
    const now = Date.now();

    if (now - this.storageProbe.checkedAt < STORAGE_PROBE_TTL_MS) {
      return this.storageProbe.status;
    }

    const reachable = await this.storage.ping();
    this.storageProbe = {
      status: reachable ? DependencyStatus.UP : DependencyStatus.DOWN,
      checkedAt: now,
    };

    return this.storageProbe.status;
  }
}
