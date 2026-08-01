import type { AuthenticatedUser, UserDetail, UserSummary } from '@agencyflow/contracts';

import type { UserDocument } from './schemas/user.schema';

/**
 * Document to response shape.
 *
 * Mapping explicitly rather than serialising the document is the point: a
 * whitelist cannot leak a field added later, whereas an exclusion list leaks
 * every field someone forgets to exclude. `passwordHash` is `select: false`
 * as well, so NFR-18 has two independent guarantees behind it.
 */
export function toUserSummary(document: UserDocument): UserSummary {
  return {
    id: document._id.toString(),
    name: document.name,
    username: document.username,
    email: document.email,
    role: document.role,
    ...(document.skill ? { skill: document.skill } : {}),
    ...(document.clientId ? { clientId: document.clientId.toString() } : {}),
    isActive: document.isActive,
  };
}

export function toUserDetail(document: UserDocument): UserDetail {
  return {
    ...toUserSummary(document),
    createdAt: (document.createdAt ?? new Date()).toISOString(),
    updatedAt: (document.updatedAt ?? new Date()).toISOString(),
  };
}

/** The subset returned with a login token (08-Backend-Design section 3). */
export function toAuthenticatedUser(document: UserDocument): AuthenticatedUser {
  const { id, name, username, email, role, skill, clientId } = toUserSummary(document);
  return {
    id,
    name,
    username,
    email,
    role,
    ...(skill ? { skill } : {}),
    ...(clientId ? { clientId } : {}),
  };
}
