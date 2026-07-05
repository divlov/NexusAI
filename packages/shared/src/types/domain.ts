/**
 * Core domain enums shared across web, worker, and ai packages.
 * Kept as `as const` objects + union types (not TS `enum`) so they serialize
 * cleanly across the queue/DB boundary and match Prisma string enums.
 */

export const JobStatus = {
  PENDING: 'PENDING',
  PLANNING: 'PLANNING',
  EXECUTING: 'EXECUTING',
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  RESUMING: 'RESUMING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const ApprovalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export const MembershipRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;
export type MembershipRole = (typeof MembershipRole)[keyof typeof MembershipRole];

export const IntegrationProvider = {
  GMAIL: 'GMAIL',
  SLACK: 'SLACK',
  JIRA: 'JIRA',
  GOOGLE_CALENDAR: 'GOOGLE_CALENDAR',
} as const;
export type IntegrationProvider =
  (typeof IntegrationProvider)[keyof typeof IntegrationProvider];

/** A single tool invocation the agent intends to (or did) perform. */
export interface ToolCall {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  risky: boolean;
}

export interface ToolResult {
  toolCallId: string;
  tool: string;
  ok: boolean;
  output: unknown;
  error?: string;
}

/** A step in the agent's plan, produced by the planning node. */
export interface PlanStep {
  index: number;
  description: string;
  tool: string;
  args: Record<string, unknown>;
  risky: boolean;
}

export interface AgentPlan {
  summary: string;
  steps: PlanStep[];
}
