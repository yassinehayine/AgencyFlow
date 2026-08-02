/**
 * The one progress formula (BR-08, BR-12).
 *
 * Milestone progress and project progress are the same calculation over
 * different sets of tasks, so they share the arithmetic here rather than
 * carrying two copies that agree today.
 */

/**
 * `done / total` as a whole percentage, clamped at both ends.
 *
 * Rounding alone is wrong exactly where it matters most: 199 of 200 tasks is
 * 99.5%, which `Math.round` turns into **100%** — a milestone reported as
 * finished while work remains, shown to a client who is deciding whether to
 * approve it. The clamp costs half a percentage point of precision and buys the
 * guarantee that 100 means done.
 *
 * The lower clamp is the same argument, less severe: 1 of 200 rounds to 0, and
 * 0% on something already under way reads as nothing having happened.
 *
 * `total` must already EXCLUDE cancelled tasks (BR-12). Cancelling the last
 * outstanding task has to complete the milestone, not strand it at 50%, and
 * that only works if a cancelled task leaves both sides of the fraction.
 */
export function progressPercentage(done: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  const rounded = Math.round((done / total) * 100);

  if (rounded === 100 && done < total) {
    return 99;
  }

  if (rounded === 0 && done > 0) {
    return 1;
  }

  return rounded;
}
