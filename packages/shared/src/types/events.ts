import type { AgentPlan, JobStatus, ToolCall, ToolResult } from './domain.js';

/**
 * Discriminated union of real-time progress events streamed from worker → web.
 * Published to Redis pub/sub (channel per job) and relayed over SSE to clients.
 */
export type ProgressEvent =
  | { type: 'status'; jobId: string; status: JobStatus; at: string }
  | { type: 'plan'; jobId: string; plan: AgentPlan; at: string }
  | { type: 'thinking'; jobId: string; message: string; at: string }
  | { type: 'tool_call'; jobId: string; call: ToolCall; at: string }
  | { type: 'tool_result'; jobId: string; result: ToolResult; at: string }
  | {
      type: 'awaiting_approval';
      jobId: string;
      approvalId: string;
      call: ToolCall;
      at: string;
    }
  | { type: 'log'; jobId: string; level: 'info' | 'warn'; message: string; at: string }
  | { type: 'error'; jobId: string; message: string; at: string }
  | { type: 'completed'; jobId: string; result: unknown; at: string };

export type ProgressEventType = ProgressEvent['type'];

/** Narrowing helper for consumers that switch on `event.type`. */
export function isProgressEvent(value: unknown): value is ProgressEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'jobId' in value
  );
}
