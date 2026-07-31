/**
 * @agencyflow/contracts
 *
 * Shared types, enumerations and constants consumed by both the NestJS API
 * and the React client.
 *
 * ADR-0001: this package carries ZERO runtime dependencies and contains no
 * class-validator decorators. Backend DTOs implement these interfaces; the
 * browser bundle stays free of reflect-metadata. Renaming a field here makes
 * the web build fail in CI, which is the compile-time safety that justified
 * the monorepo.
 */
export * from './enums';
export * from './api';
export * from './auth';
