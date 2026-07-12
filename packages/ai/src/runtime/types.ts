import type { AgentPlan, ToolCall, ToolResult } from '@nexus/shared';

/**
 * The runtime abstracts *how* the agent thinks and acts, so the LangGraph
 * orchestration is identical across real providers (Gemini, OpenAI) and demo
 * (mock) mode.
 *
 * `createAgentRuntime(isDemo)` returns a runtime; the worker and graph never
 * branch on the provider beyond that single factory call.
 */
export interface AgentRuntime {
  /** Provider identifier ('gemini' | 'openai') or 'demo'. */
  readonly mode: string;

  /** Produce a structured plan of tool steps from a natural-language prompt. */
  plan(prompt: string): Promise<AgentPlan>;

  /**
   * Materialize any deferred args (planner sentinels) from prior results,
   * just before the step runs. No-op when the call has no deferred args.
   */
  resolveArgs(call: ToolCall, priorResults: ToolResult[]): Promise<ToolCall>;

  /** Execute a single (already-approved or non-risky) tool call. */
  executeTool(call: ToolCall): Promise<ToolResult>;

  /** Produce a final natural-language summary of the run. */
  summarize(prompt: string, results: ToolResult[]): Promise<string>;
}
