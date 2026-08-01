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

  /**
   * List keys embed their filters, so two different filter sets are two
   * different cache entries rather than one that flickers between them.
   * `all` stays a prefix, so invalidating after a create refreshes every
   * filtered view at once without naming any of them.
   */
  /**
   * `object`, not `Record<string, unknown>`: a plain interface such as
   * `UserListQuery` has no index signature and would be rejected, which would
   * push callers into casting at every call site — exactly the ad-hoc key
   * construction this factory exists to prevent.
   */
  users: {
    all: ['users'] as const,
    list: (filters: object) => [...queryKeys.users.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.users.all, 'detail', id] as const,
  },

  projects: {
    all: ['projects'] as const,
    list: (filters: object) => [...queryKeys.projects.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.projects.all, 'detail', id] as const,
  },

  clients: {
    all: ['clients'] as const,
    list: (filters: object) => [...queryKeys.clients.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.clients.all, 'detail', id] as const,
    contacts: (id: string) => [...queryKeys.clients.all, 'contacts', id] as const,
  },
} as const;
