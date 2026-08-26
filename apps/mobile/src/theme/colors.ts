/**
 * Design tokens, aligned with the web client's Tailwind slate palette so the
 * two surfaces read as one product (09-Frontend-Design.md §10).
 *
 * Minimal on purpose — this holds what Phase 2 actually uses. It grows in
 * Phase 5, when there are screens with something to style. Declaring a full
 * palette now would be inventing tokens nobody has needed yet.
 */
export const colors = {
  background: '#f8fafc', // slate-50
  surface: '#ffffff',
  border: '#e2e8f0', // slate-200
  text: '#0f172a', // slate-900
  textMuted: '#475569', // slate-600
  textSubtle: '#94a3b8', // slate-400
  primary: '#0f172a', // slate-900 — the web's primary button
  onPrimary: '#ffffff',
  danger: '#b91c1c', // red-700
} as const;

/**
 * A single spacing scale, in points.
 *
 * `md` (16) is the screen gutter, matching the portal's `px-4`: at 375 px a
 * 24 px gutter each side spends 13% of the screen on nothing (NFR-08).
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/**
 * The minimum comfortable touch target, in points.
 *
 * 44 is the figure both Apple and Google converge on, and it is a floor rather
 * than a suggestion: the client portal's primary action is a decision on a
 * deliverable, taken by an occasional user holding a phone one-handed.
 */
export const TOUCH_TARGET = 44;
