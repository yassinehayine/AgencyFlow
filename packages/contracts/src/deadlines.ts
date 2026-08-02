/**
 * Deadline alerts (FR-072, BR-20).
 *
 * The rule these functions exist to keep honest: *due soon* and *overdue* are
 * **computed when someone looks**, never stored and never produced by a
 * scheduled job. `02-User-Stories.md` US-058 states the consequence as an
 * acceptance criterion — if nobody opens the application for a week, the alerts
 * are still correct when someone finally does, because nothing was missed:
 * there was nothing to miss.
 *
 * Both sides import this. The API turns the window into a MongoDB range query;
 * the browser turns the same window into a badge on a row. If the two computed
 * their own boundaries, a task could arrive in the "overdue" list carrying a
 * badge that said otherwise, and the interface would be arguing with itself.
 */

/** FR-072 — "due within 3 days". */
export const DUE_SOON_DAYS = 3;

export type DeadlineState = 'OVERDUE' | 'DUE_SOON' | 'LATER';

export interface DeadlineWindow {
  /** A due date STRICTLY BEFORE this instant is overdue. */
  overdueBefore: Date;
  /** Exclusive upper bound of *due soon*. */
  dueSoonBefore: Date;
}

/**
 * The two boundaries, derived from one instant.
 *
 * **UTC day boundaries, deliberately.** A due date is entered as a calendar day
 * (`<input type="date">` → `2026-08-05`) and stored as midnight UTC — it
 * carries no time of day, because "finish this by Wednesday" has none. Reading
 * it in UTC on both sides is what keeps the server's query and the browser's
 * badge in agreement; using the local day on the client would put them an hour
 * apart in Morocco (UTC+1) for one hour of every day, and the disagreement
 * would be invisible until someone noticed a task in the overdue list that the
 * row itself called on-track.
 *
 * Note what `overdueBefore` is NOT: it is not `now`. A task due today is due by
 * the END of today, so at 14:00 it is not yet late. Comparing against the
 * current instant would mark every one of today's tasks overdue from 00:01,
 * which is the single most likely way to make this feature untrustworthy.
 */
export function deadlineWindow(now: Date = new Date()): DeadlineWindow {
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const day = 24 * 60 * 60 * 1000;

  return {
    overdueBefore: new Date(startOfToday),
    // `+ 1` because a due date is a whole day: a task due three days from now
    // is due *within* three days, so the third day must be included entirely.
    dueSoonBefore: new Date(startOfToday + (DUE_SOON_DAYS + 1) * day),
  };
}

/**
 * Where one due date falls. `null` when there is nothing to say — no due date
 * means no deadline, which is not the same as a comfortable one.
 *
 * Says nothing about whether the task is finished. A `DONE` task with a date in
 * the past is not overdue, and that judgement belongs to the caller, which
 * knows the status; this function only knows the date.
 */
export function classifyDeadline(
  dueDate: string | Date | null | undefined,
  now: Date = new Date(),
): DeadlineState | null {
  if (!dueDate) {
    return null;
  }

  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;

  if (Number.isNaN(due.getTime())) {
    return null;
  }

  const { overdueBefore, dueSoonBefore } = deadlineWindow(now);

  if (due.getTime() < overdueBefore.getTime()) {
    return 'OVERDUE';
  }

  return due.getTime() < dueSoonBefore.getTime() ? 'DUE_SOON' : 'LATER';
}
