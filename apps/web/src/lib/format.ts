/**
 * Display formatting (NFR-03, NFR-04).
 *
 * Dates are `dd/MM/yyyy` and money is MAD, both fixed during requirements
 * discovery. Written with `Intl` rather than a date library: the whole need is
 * one locale and one format, and a dependency would be more code than this.
 */

/** The agency's timezone. Fixed in v1 — no per-user preference (NFR-05). */
const TIME_ZONE = 'Africa/Casablanca';

const dateFormatter = new Intl.DateTimeFormat('fr-MA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: TIME_ZONE,
});

/**
 * Formats an ISO date for display.
 *
 * Returns an em dash for a missing or unparseable value rather than throwing
 * or printing "Invalid Date". A bad date is a cosmetic problem; a page that
 * fails to render because one field is malformed is not.
 */
export function formatDate(iso: string | undefined | null): string {
  if (!iso) {
    return '—';
  }

  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}
