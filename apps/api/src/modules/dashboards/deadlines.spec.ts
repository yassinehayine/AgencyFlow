import { DUE_SOON_DAYS, classifyDeadline, deadlineWindow } from '@agencyflow/contracts';

/**
 * FR-072, BR-20 — the deadline window.
 *
 * The functions live in `@agencyflow/contracts` because both sides use them;
 * the tests live here because this is where being wrong actually costs
 * something. A misplaced boundary in the browser mislabels a badge, while the
 * same mistake here selects the wrong rows out of the database — the dashboard
 * would then be confidently, quietly incorrect.
 *
 * Every case fixes `now`. A test that used the real clock would pass all
 * morning and fail near midnight, which is the worst kind of failing test:
 * one that discredits the suite rather than the code.
 */
const at = (iso: string) => new Date(iso);

/** Mid-afternoon deliberately: the time of day must not affect the answer. */
const NOW = at('2026-08-02T14:37:11.000Z');

describe('deadlineWindow', () => {
  it('starts the overdue boundary at midnight UTC, not at the current instant', () => {
    const { overdueBefore } = deadlineWindow(NOW);

    expect(overdueBefore.toISOString()).toBe('2026-08-02T00:00:00.000Z');
  });

  /**
   * The single most consequential assertion in this file. A due date is a
   * whole day — "finish this by Sunday" carries no time — so a task due today
   * is not late until today ends. Comparing against `now` instead would mark
   * every one of today's tasks overdue from one minute past midnight, and a
   * user who saw that once would never trust the panel again.
   */
  it('does not treat work due later today as overdue', () => {
    expect(classifyDeadline(at('2026-08-02T00:00:00.000Z'), NOW)).toBe('DUE_SOON');
    expect(classifyDeadline(at('2026-08-02T23:59:59.000Z'), NOW)).toBe('DUE_SOON');
  });

  it('includes the whole of the third day in due soon', () => {
    expect(DUE_SOON_DAYS).toBe(3);

    // Three days from 2 August is 5 August, and all of it counts.
    expect(classifyDeadline(at('2026-08-05T00:00:00.000Z'), NOW)).toBe('DUE_SOON');
    expect(classifyDeadline(at('2026-08-05T23:59:59.000Z'), NOW)).toBe('DUE_SOON');

    // The fourth day is four days away, whatever the hour.
    expect(classifyDeadline(at('2026-08-06T00:00:00.000Z'), NOW)).toBe('LATER');
  });

  it('reports yesterday and earlier as overdue', () => {
    expect(classifyDeadline(at('2026-08-01T23:59:59.000Z'), NOW)).toBe('OVERDUE');
    expect(classifyDeadline(at('2026-07-15T00:00:00.000Z'), NOW)).toBe('OVERDUE');
  });

  /** No due date is not a comfortable deadline — it is the absence of one. */
  it('says nothing about a task with no due date', () => {
    expect(classifyDeadline(undefined, NOW)).toBeNull();
    expect(classifyDeadline(null, NOW)).toBeNull();
    expect(classifyDeadline('', NOW)).toBeNull();
  });

  it('says nothing about an unparseable date rather than guessing', () => {
    expect(classifyDeadline('pas une date', NOW)).toBeNull();
  });

  it('accepts the ISO strings the API actually sends', () => {
    expect(classifyDeadline('2026-08-01T00:00:00.000Z', NOW)).toBe('OVERDUE');
    expect(classifyDeadline('2026-08-03T00:00:00.000Z', NOW)).toBe('DUE_SOON');
  });

  /**
   * The boundaries must not drift across a month or a year end, where
   * arithmetic on day numbers rather than on timestamps goes wrong.
   */
  it('crosses a month boundary correctly', () => {
    const newYearsEve = at('2026-12-31T09:00:00.000Z');

    expect(classifyDeadline(at('2027-01-03T00:00:00.000Z'), newYearsEve)).toBe('DUE_SOON');
    expect(classifyDeadline(at('2027-01-04T00:00:00.000Z'), newYearsEve)).toBe('LATER');
    expect(classifyDeadline(at('2026-12-30T00:00:00.000Z'), newYearsEve)).toBe('OVERDUE');
  });

  /**
   * The two boundaries are read separately — by the query and by the badge —
   * so there must be no gap or overlap between them where a task could be
   * neither, or both.
   */
  it('leaves no gap between the two boundaries', () => {
    const { overdueBefore, dueSoonBefore } = deadlineWindow(NOW);

    expect(overdueBefore.getTime()).toBeLessThan(dueSoonBefore.getTime());
    expect(classifyDeadline(new Date(overdueBefore.getTime() - 1), NOW)).toBe('OVERDUE');
    expect(classifyDeadline(overdueBefore, NOW)).toBe('DUE_SOON');
    expect(classifyDeadline(new Date(dueSoonBefore.getTime() - 1), NOW)).toBe('DUE_SOON');
    expect(classifyDeadline(dueSoonBefore, NOW)).toBe('LATER');
  });
});
