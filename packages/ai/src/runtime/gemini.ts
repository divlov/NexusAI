import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import {
  getServerEnv,
  type AgentPlan,
  type ToolCall,
  type ToolResult,
} from '@nexus/shared';
import { TOOLS, isRiskyTool, runToolCall } from '../tools/registry.js';
import type { AgentRuntime } from './types.js';

const MODEL = 'gemini-2.5-flash'; // fast + cheap, with a generous free tier.

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

function toolCatalogue(): string {
  return TOOLS.map(
    (t) => `- ${t.name}${t.risky ? ' (risky)' : ''}: ${t.description}`,
  ).join('\n');
}

export class GeminiRuntime implements AgentRuntime {
  readonly mode = 'gemini' as const;
  private readonly client: GoogleGenAI;

  constructor() {
    const apiKey = getServerEnv().GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is required when not in demo mode. ' +
          'Set NEXT_PUBLIC_IS_DEMO_MODE=true for keyless operation.',
      );
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  async plan(prompt: string): Promise<AgentPlan> {
    const response = await this.client.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        systemInstruction:
          'You are Nexus, an operations agent. Decompose the user request ' +
          'into an ordered list of tool steps. Only use these tools:\n' +
          `${toolCatalogue()}\n\n` +
          'Respond ONLY with JSON matching: ' +
          '{ "summary": string, "steps": [{ "description": string, ' +
          '"tool": string, "args": object }] }. Keep steps minimal.',
      },
    });

    const raw = response.text ?? '{}';
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

  async executeTool(call: ToolCall): Promise<ToolResult> {
    return runToolCall(call);
  }

  async summarize(prompt: string, results: ToolResult[]): Promise<string> {
    const response = await this.client.models.generateContent({
      model: MODEL,
      contents: `Request: ${prompt}\n\nResults: ${JSON.stringify(results)}`,
      config: {
        temperature: 0.2,
        systemInstruction:
          'Summarize, in 2-3 sentences, what was accomplished for the user ' +
          'based on the executed tool results.',
      },
    });
    return response.text ?? 'Task completed.';
  }
}
