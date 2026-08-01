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
// Explicit `.js` extensions so the ESM build is valid Node ESM as well as
// bundler-resolvable. TypeScript maps `./enums.js` back to `./enums.ts`.
export * from './enums.js';
export * from './api.js';
export * from './auth.js';
export * from './errors.js';
export * from './users.js';
export * from './clients.js';
