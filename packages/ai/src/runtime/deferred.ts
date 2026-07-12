/**
 * Sentinel the planner writes for an argument whose value can only be known from
 * an earlier step's output (e.g. a summary of messages read in a prior step).
 * The runtime materializes these just-in-time in `resolveArgs`, so the plan stays
 * plan-first while values that depend on live results are filled at execution.
 */
export const DEFERRED_ARG = '__FROM_RESULTS__';

/** True if any (possibly nested) string value in an args object is deferred. */
export function hasDeferredArg(args: Record<string, unknown>): boolean {
  return JSON.stringify(args).includes(DEFERRED_ARG);
}
