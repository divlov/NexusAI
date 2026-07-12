import { z } from 'zod';
import type { AgentPlan, ToolCall, ToolResult } from '@nexus/shared';
import { TOOLS, isRiskyTool, runToolCall } from '../tools/registry.js';
import type { ToolContext } from '../tools/context.js';
import { DEFERRED_ARG } from './deferred.js';
import type { AgentRuntime } from './types.js';
import type { LlmProvider } from './provider.js';

/**
 * Provider-agnostic agent runtime. All prompting, structured-output parsing, and
 * deferred-argument resolution live here; the concrete LLM call is delegated to
 * an injected `LlmProvider`. Switching OpenAI <-> Gemini is a factory decision
 * (AI_PROVIDER) — this class is unchanged either way.
 */

/** Structured-output schema the planner LLM must return. */
const planResponseSchema = z.object({
  summary: z.string(),
  steps: z
    .array(
      z.object({
        description: z.string(),
        tool: z.string(),
        args: z.record(z.unknown()),
      }),
    )
    .max(8),
});

/** Human-readable type name for a Zod leaf, used in the planner arg schema. */
function zodTypeName(schema: z.ZodTypeAny): string {
  if (schema instanceof z.ZodString) return 'string';
  if (schema instanceof z.ZodNumber) return 'number';
  if (schema instanceof z.ZodBoolean) return 'boolean';
  if (schema instanceof z.ZodEnum) {
    return (schema._def.values as string[]).map((v) => `"${v}"`).join(' | ');
  }
  if (schema instanceof z.ZodArray) {
    return `${zodTypeName(schema._def.type as z.ZodTypeAny)}[]`;
  }
  return 'string';
}

/**
 * Render a tool's Zod input schema as a compact arg spec so the planner emits
 * correctly-shaped `args`. Without this the LLM only sees the tool name and
 * omits required fields like `channel`/`text`.
 */
function describeArgs(schema: z.ZodTypeAny): string {
  if (!(schema instanceof z.ZodObject)) return '{}';
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const parts = Object.entries(shape).map(([key, field]) => {
    let inner: z.ZodTypeAny = field;
    let optional = false;
    while (inner instanceof z.ZodOptional || inner instanceof z.ZodDefault) {
      optional = true;
      inner = inner._def.innerType as z.ZodTypeAny;
    }
    const desc = inner._def.description ?? field._def.description;
    return `"${key}"${optional ? '?' : ''}: ${zodTypeName(inner)}${desc ? ` — ${desc}` : ''}`;
  });
  return `{ ${parts.join(', ')} }`;
}

function toolCatalogue(): string {
  return TOOLS.map(
    (t) =>
      `- ${t.name}${t.risky ? ' (risky)' : ''}: ${t.description}\n` +
      `    args: ${describeArgs(t.inputSchema)}`,
  ).join('\n');
}

/**
 * Deterministic fallback used when the model can't produce a deferred arg value.
 * Summarizes any message-bearing prior result so we never execute the raw
 * sentinel. Tool-agnostic: reads a `messages[].text` shape if present.
 */
function fallbackSummary(priorResults: ToolResult[]): string {
  for (const r of priorResults) {
    const out = r.output as { messages?: { text?: string }[] } | undefined;
    const texts = out?.messages?.map((m) => m.text ?? '').filter(Boolean) ?? [];
    if (texts.length) return `Recent activity: ${texts.join(' | ')}`.slice(0, 250);
  }
  return 'Summary of the previous step results.';
}

export class LlmRuntime implements AgentRuntime {
  readonly mode: string;

  constructor(
    private readonly provider: LlmProvider,
    private readonly ctx?: ToolContext,
  ) {
    this.mode = provider.name;
  }

  async plan(prompt: string): Promise<AgentPlan> {
    const raw = await this.provider.generate({
      system:
        'You are Nexus, an operations agent. Decompose the user request ' +
        'into an ordered list of tool steps. Only use these tools ' +
        '(each shows its required args schema):\n' +
        `${toolCatalogue()}\n\n` +
        'Respond ONLY with JSON matching: ' +
        '{ "summary": string, "steps": [{ "description": string, ' +
        '"tool": string, "args": object }] }. Each step\'s "args" MUST ' +
        'exactly match that tool\'s args schema above, filled with concrete ' +
        'values taken from the user request (channel names, queries, etc.). ' +
        'Every required (non-"?") arg must be present. If an arg\'s value can ' +
        `only be known from an EARLIER step's output (e.g. a summary of ` +
        'messages you will read first), set that arg to the exact string ' +
        `"${DEFERRED_ARG}" — it is filled in at run time; do NOT invent the ` +
        'content now. Keep steps minimal.',
      prompt,
      temperature: 0,
      json: true,
    });

    const parsed = planResponseSchema.parse(JSON.parse(raw));
    return {
      summary: parsed.summary,
      steps: parsed.steps.map((s, index) => ({
        index,
        description: s.description,
        tool: s.tool,
        args: s.args as Record<string, unknown>,
        risky: isRiskyTool(s.tool),
      })),
    };
  }

  async resolveArgs(call: ToolCall, priorResults: ToolResult[]): Promise<ToolCall> {
    const deferredKeys = Object.entries(call.args)
      .filter(([, v]) => v === DEFERRED_ARG)
      .map(([k]) => k);
    if (deferredKeys.length === 0) return call;

    // Focused generation: ask ONLY for the deferred field values, which is far
    // more reliable than asking the model to rewrite the whole args object.
    let filled: Record<string, unknown> = {};
    try {
      const raw = await this.provider.generate({
        system:
          'You finalize deferred tool arguments using the prior tool results. ' +
          'Write a concrete, human-readable value for each requested argument ' +
          '(e.g. a concise one-line summary of the messages). Respond ONLY with ' +
          'a JSON object mapping each requested argument name to its string value.',
        prompt:
          `Tool: ${call.tool}\n` +
          `Prior tool results (JSON):\n${JSON.stringify(priorResults)}\n\n` +
          `Produce a value for each of these arguments: ${deferredKeys.join(', ')}.`,
        temperature: 0.3,
        json: true,
      });
      filled = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      filled = {}; // fall through to the deterministic fallback below
    }

    // Guarantee the sentinel is never executed: use the model's value when it's
    // a usable string, otherwise a deterministic summary built from the results.
    const args: Record<string, unknown> = { ...call.args };
    for (const key of deferredKeys) {
      const value = filled[key];
      args[key] =
        typeof value === 'string' && value.trim() && value !== DEFERRED_ARG
          ? value
          : fallbackSummary(priorResults);
    }
    return { ...call, args };
  }

  async executeTool(call: ToolCall): Promise<ToolResult> {
    if (!this.ctx) {
      throw new Error(
        'LlmRuntime requires a ToolContext to execute tools. ' +
          'The worker must supply tenant context in real mode.',
      );
    }
    return runToolCall(call, this.ctx);
  }

  async summarize(prompt: string, results: ToolResult[]): Promise<string> {
    const text = await this.provider.generate({
      system:
        'Summarize, in 2-3 sentences, what was accomplished for the user ' +
        'based on the executed tool results.',
      prompt: `Request: ${prompt}\n\nResults: ${JSON.stringify(results)}`,
      temperature: 0.2,
      json: false,
    });
    return text || 'Task completed.';
  }
}
