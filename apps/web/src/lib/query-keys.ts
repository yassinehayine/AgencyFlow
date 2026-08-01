/**
 * Central query key factory (09-Frontend-Design.md section 4.2).
 *
 * All TanStack Query keys come from here; no component writes an inline array
 * literal. Invalidation then works by prefix and cannot miss a key someone
 * spelled differently. Retrofitting this after fifty ad-hoc keys is a painful
 * sweep, which is why it exists before the first query does.
 */
export const queryKeys = {
  health: {
    all: ['health'] as const,
    status: () => [...queryKeys.health.all, 'status'] as const,
  },

  auth: {
    all: ['auth'] as const,
    currentUser: () => [...queryKeys.auth.all, 'current-user'] as const,
  },
} as const;
