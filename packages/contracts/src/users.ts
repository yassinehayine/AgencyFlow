/**
 * User contracts (06-Database-Design.md section 7.1).
 *
 * `passwordHash` appears in no shape here and in no response anywhere
 * (NFR-18). The field exists only inside the Mongoose schema and is excluded
 * from every projection.
 */
import type { PaginationQuery } from './api.js';
import type { Role, Skill } from './enums.js';

/** Field bounds, shared so the DTO and the React form cannot disagree. */
export const USER_LIMITS = {
  NAME_MIN: 2,
  NAME_MAX: 100,
} as const;

/** What a list row shows. */
export interface UserSummary {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  /** Present only for TEAM_MEMBER (CIR-1). */
  skill?: Skill;
  /** Present only for CLIENT_CONTACT (CIR-2). */
  clientId?: string;
  /** Authentication gate. Distinct from deletion (06-DB section 10.1). */
  isActive: boolean;
}

export interface UserDetail extends UserSummary {
  createdAt: string;
  updatedAt: string;
}

/**
 * Creating an internal staff account (FR-008). Administrator only.
 *
 * `role` is accepted in the body here — and only here — because choosing it
 * IS the operation, on a route no one but an Administrator can reach. What is
 * never accepted in a body is `clientId`: a Client Contact is created at
 * `POST /clients/:id/contacts`, so the organisation comes from the path and
 * cannot be chosen by the caller (BR-10, 08-Backend-Design section 2.3).
 *
 * `isActive` is likewise absent: activation is a command
 * (`POST /users/:id/activate`), never a writable field.
 */
export interface CreateUserRequest {
  name: string;
  /** Immutable once set (BR-33). It is the `@mention` handle. */
  username: string;
  email: string;
  password: string;
  /** One of the three internal roles. `CLIENT_CONTACT` is refused here. */
  role: Role;
  /** Required if and only if `role` is `TEAM_MEMBER` (CIR-1). */
  skill?: Skill;
}

/** Creating a Client Contact (FR-016). The organisation comes from the path. */
export interface CreateClientContactRequest {
  name: string;
  username: string;
  email: string;
  password: string;
}

/**
 * Editing a user (FR-009). Administrator only.
 *
 * `username` and `email` are absent by construction: the username is immutable
 * (BR-33), and an omitted field cannot be changed by accident.
 */
export interface UpdateUserRequest {
  name?: string;
  role?: Role;
  skill?: Skill;
}

/** Editing one's own profile (FR-012). Role and skill are unreachable here. */
export interface UpdateOwnProfileRequest {
  name: string;
}

/** Administrator resets another user's password (FR-006, BR-13). */
export interface ResetPasswordRequest {
  newPassword: string;
}

/** Filters for the user list (FR-011). All combinable. */
export interface UserListQuery extends PaginationQuery {
  role?: Role;
  skill?: Skill;
  isActive?: boolean;
  /** Matches name, username or email. */
  search?: string;
}

/**
 * Returned by a refused deactivation so the Administrator can act on it
 * (BR-32). Listing the blocking tasks turns a dead end into a next step.
 */
export interface OpenTaskReference {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
}
