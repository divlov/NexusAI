import type { AgentPlan, PlanStep, ToolCall, ToolResult } from '@nexus/shared';

/** Internal run status of the graph (distinct from the DB JobStatus enum). */
export type RunStatus = 'running' | 'awaiting_approval' | 'completed';

/** A risky step the graph paused on, awaiting a human decision. */
export interface PendingApproval {
  step: PlanStep;
  call: ToolCall;
}

/**
 * The serializable agent state. A snapshot of this is what the worker persists
 * to `AgentJob.checkpoint` when pausing, and reconstructs to resume. Because the
 * full state round-trips through the DB as JSON, cross-process resume needs no
 * in-memory checkpointer.
 */
export interface AgentStateShape {
  prompt: string;
  plan: AgentPlan | null;
  /** Index of the next plan step to execute. */
  cursor: number;
  results: ToolResult[];
  /** Step indices a human approved (executed despite being risky). */
  approvedSteps: number[];
  /** Step indices a human rejected (skipped). */
  rejectedSteps: number[];
  status: RunStatus;
  pending: PendingApproval | null;
  finalSummary: string | null;
}

export function initialState(prompt: string): AgentStateShape {
  return {
    prompt,
    plan: null,
    cursor: 0,
    results: [],
    approvedSteps: [],
    rejectedSteps: [],
    status: 'running',
    pending: null,
    finalSummary: null,
  };
}
