import { randomUUID } from 'node:crypto';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { AgentPlan, ProgressEvent, ToolCall, ToolResult } from '@nexus/shared';
import type { AgentRuntime } from '../runtime/types.js';
import { type AgentStateShape, type PendingApproval, type RunStatus } from './state.js';

/**
 * LangGraph orchestration for an agent run.
 *
 * Flow:  plan → (execute ⇄ loop) → complete
 * Human-in-the-loop: when a risky step is reached and not yet approved, the
 * execute node records it as `pending` and routes to END. The worker persists
 * the returned state (checkpoint), records an Approval, and re-invokes the graph
 * with the decision seeded into `approvedSteps` / `rejectedSteps`.
 */

export interface GraphDeps {
  jobId: string;
  runtime: AgentRuntime;
  /** Emit a progress event (Redis pub/sub → SSE). */
  publish: (event: ProgressEvent) => Promise<void> | void;
}

const now = () => new Date().toISOString();

const AgentState = Annotation.Root({
  prompt: Annotation<string>,
  plan: Annotation<AgentPlan | null>,
  cursor: Annotation<number>,
  results: Annotation<ToolResult[]>,
  approvedSteps: Annotation<number[]>,
  rejectedSteps: Annotation<number[]>,
  status: Annotation<RunStatus>,
  pending: Annotation<PendingApproval | null>,
  finalSummary: Annotation<string | null>,
});

type State = typeof AgentState.State;

export function buildAgentGraph(deps: GraphDeps) {
  const { jobId, runtime, publish } = deps;

  async function planNode(state: State): Promise<Partial<State>> {
    // On resume the plan already exists — don't re-plan.
    if (state.plan) return {};

    await publish({ type: 'status', jobId, status: 'PLANNING', at: now() });
    await publish({ type: 'thinking', jobId, message: 'Analyzing request and drafting a plan…', at: now() });

    const plan = await runtime.plan(state.prompt);
    await publish({ type: 'plan', jobId, plan, at: now() });
    return { plan, cursor: 0 };
  }

  async function executeNode(state: State): Promise<Partial<State>> {
    const plan = state.plan;
    if (!plan) throw new Error('executeNode reached without a plan');

    const step = plan.steps[state.cursor];
    if (!step) return {}; // routing guards this, defensive.

    const call: ToolCall = {
      id: randomUUID(),
      tool: step.tool,
      args: step.args,
      risky: step.risky,
    };

    const approved = state.approvedSteps.includes(state.cursor);
    const rejected = state.rejectedSteps.includes(state.cursor);

    // Risky and undecided → pause for human approval.
    if (step.risky && !approved && !rejected) {
      return {
        status: 'awaiting_approval',
        pending: { step, call },
      };
    }

    if (rejected) {
      const result: ToolResult = {
        toolCallId: call.id,
        tool: call.tool,
        ok: false,
        output: null,
        error: 'Rejected by approver — step skipped.',
      };
      await publish({ type: 'tool_result', jobId, result, at: now() });
      return {
        results: [...state.results, result],
        cursor: state.cursor + 1,
        pending: null,
      };
    }

    await publish({ type: 'status', jobId, status: 'EXECUTING', at: now() });
    await publish({ type: 'tool_call', jobId, call, at: now() });
    const result = await runtime.executeTool(call);
    await publish({ type: 'tool_result', jobId, result, at: now() });

    return {
      results: [...state.results, result],
      cursor: state.cursor + 1,
      pending: null,
    };
  }

  async function completeNode(state: State): Promise<Partial<State>> {
    const summary = await runtime.summarize(state.prompt, state.results);
    await publish({ type: 'completed', jobId, result: { summary, results: state.results }, at: now() });
    return { status: 'completed', finalSummary: summary };
  }

  function afterPlan(state: State): 'execute' | 'complete' {
    return (state.plan?.steps.length ?? 0) > 0 ? 'execute' : 'complete';
  }

  function afterExecute(state: State): 'await' | 'execute' | 'complete' {
    if (state.status === 'awaiting_approval') return 'await';
    const total = state.plan?.steps.length ?? 0;
    return state.cursor >= total ? 'complete' : 'execute';
  }

  // Node names must not collide with state channel names (e.g. `plan`).
  const graph = new StateGraph(AgentState)
    .addNode('planner', planNode)
    .addNode('executor', executeNode)
    .addNode('finalize', completeNode)
    .addEdge(START, 'planner')
    .addConditionalEdges('planner', afterPlan, { execute: 'executor', complete: 'finalize' })
    .addConditionalEdges('executor', afterExecute, {
      await: END,
      execute: 'executor',
      complete: 'finalize',
    })
    .addEdge('finalize', END);

  return graph.compile();
}

/** Run (or resume) the graph and return the final serializable state. */
export async function runAgentGraph(
  deps: GraphDeps,
  state: AgentStateShape,
): Promise<AgentStateShape> {
  const compiled = buildAgentGraph(deps);
  // Allow enough steps for plan + execute loop + complete on larger plans.
  const final = await compiled.invoke(state, { recursionLimit: 50 });
  return final as AgentStateShape;
}
