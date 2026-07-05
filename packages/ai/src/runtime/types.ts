import type { AgentPlan, ToolCall, ToolResult } from '@nexus/shared';

/**
 * The runtime abstracts *how* the agent thinks and acts, so the LangGraph
 * orchestration is identical in real (Gemini) and demo (mock) modes.
 *
 * `createAgentRuntime(isDemo)` returns one of two implementations; the worker
 * and graph never branch on demo mode beyond that single factory call.
 */
export interface AgentRuntime {
  readonly mode: 'gemini' | 'demo';

  /** Produce a structured plan of tool steps from a natural-language prompt. */
  plan(prompt: string): Promise<AgentPlan>;

  /** Execute a single (already-approved or non-risky) tool call. */
  executeTool(call: ToolCall): Promise<ToolResult>;

  /** Produce a final natural-language summary of the run. */
  summarize(prompt: string, results: ToolResult[]): Promise<string>;
}
