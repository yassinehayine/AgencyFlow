/**
 * Authentication contracts (08-Backend-Design.md section 3).
 *
 * Authentication is email + password only. No self-service reset, no 2FA,
 * no persistent sessions in v1 (BR-13).
 */
import type { Role, Skill } from './enums.js';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

/**
 * The authenticated user as exposed to the client.
 *
 * `passwordHash` is never present in any response (NFR-18), and neither is
 * any field the client has no use for.
 */
export interface AuthenticatedUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  /** Present only for TEAM_MEMBER (BR-02, CIR-1). */
  skill?: Skill;
  /** Present only for CLIENT_CONTACT (BR-09, CIR-2). This is the BR-10 anchor. */
  clientId?: string;
}

/**
 * Claims carried by the signed JWT (08-Backend-Design 3.1).
 *
 * `clientId` originates here and nowhere else. It is read from the signed
 * token and never from a request body or query parameter, which is what makes
 * client data isolation (BR-10) unforgeable.
 */
export interface JwtClaims {
  sub: string;
  role: Role;
  clientId?: string;
  iat: number;
  exp: number;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** Minimum password length (NFR-18, FR-005). */
export const PASSWORD_MIN_LENGTH = 8;

/** Session lifetime in seconds — 12 hours (BR-13, NFR-19). */
export const JWT_EXPIRY_SECONDS = 12 * 60 * 60;

/** Username format (A-13, BR-33): lowercase, 3–30 chars, immutable once set. */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
