import { z } from 'zod';
import type { ToolCall, ToolResult } from '@nexus/shared';

/**
 * Tool registry — the single source of truth for what the agent can do.
 *
 * Each tool declares a Zod input schema (used both to validate LLM-proposed
 * args and to generate the LLM function schema) and a `risky` flag. Risky
 * tools mutate external systems and therefore require human approval before
 * execution (see the worker's approval pause).
 *
 * NOTE: real provider execution (Gmail/Slack/Jira/Calendar APIs) is wired when
 * OAuth integrations land. For the backbone, real-mode `execute` performs the
 * structured action contract against an integration stub; demo mode bypasses
 * these entirely with rich mocked results.
 */

export interface ToolDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  inputSchema: TSchema;
  /** Risky tools mutate third-party systems and require approval. */
  risky: boolean;
  execute: (args: z.infer<TSchema>) => Promise<unknown>;
}

function integrationStub(tool: string): never {
  throw new Error(
    `Integration for "${tool}" is not configured. Connect the provider via ` +
      'OAuth, or run with NEXT_PUBLIC_IS_DEMO_MODE=true.',
  );
}

const scanInbox: ToolDefinition = {
  name: 'gmail.scanInbox',
  description:
    'Read and summarize recent Gmail messages matching a query. Read-only.',
  risky: false,
  inputSchema: z.object({
    query: z.string().describe('Gmail search query, e.g. "is:unread newer_than:7d"'),
    maxResults: z.number().int().min(1).max(50).default(20),
  }),
  execute: async () => integrationStub('gmail.scanInbox'),
};

const createJiraIssue: ToolDefinition = {
  name: 'jira.createIssue',
  description: 'Create a Jira issue. Mutates an external system — risky.',
  risky: true,
  inputSchema: z.object({
    projectKey: z.string(),
    summary: z.string(),
    description: z.string(),
    issueType: z.enum(['Bug', 'Task', 'Story']).default('Task'),
  }),
  execute: async () => integrationStub('jira.createIssue'),
};

const postSlackMessage: ToolDefinition = {
  name: 'slack.postMessage',
  description: 'Post a message to a Slack channel. Mutates external state — risky.',
  risky: true,
  inputSchema: z.object({
    channel: z.string(),
    text: z.string(),
  }),
  execute: async () => integrationStub('slack.postMessage'),
};

const createCalendarEvent: ToolDefinition = {
  name: 'calendar.createEvent',
  description: 'Create a Google Calendar event/reminder. Risky.',
  risky: true,
  inputSchema: z.object({
    title: z.string(),
    startsAt: z.string().describe('ISO 8601 datetime'),
    durationMinutes: z.number().int().min(5).max(480).default(30),
    notes: z.string().optional(),
  }),
  execute: async () => integrationStub('calendar.createEvent'),
};

export const TOOLS: ToolDefinition[] = [
  scanInbox,
  createJiraIssue,
  postSlackMessage,
  createCalendarEvent,
];

const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

export function getTool(name: string): ToolDefinition | undefined {
  return TOOL_MAP.get(name);
}

export function isRiskyTool(name: string): boolean {
  return getTool(name)?.risky ?? true; // unknown tools treated as risky.
}

/** Validate + execute a tool call (real mode). Returns a typed ToolResult. */
export async function runToolCall(call: ToolCall): Promise<ToolResult> {
  const tool = getTool(call.tool);
  if (!tool) {
    return {
      toolCallId: call.id,
      tool: call.tool,
      ok: false,
      output: null,
      error: `Unknown tool: ${call.tool}`,
    };
  }
  const parsed = tool.inputSchema.safeParse(call.args);
  if (!parsed.success) {
    return {
      toolCallId: call.id,
      tool: call.tool,
      ok: false,
      output: null,
      error: `Invalid args: ${parsed.error.message}`,
    };
  }
  try {
    const output = await tool.execute(parsed.data);
    return { toolCallId: call.id, tool: call.tool, ok: true, output };
  } catch (err) {
    return {
      toolCallId: call.id,
      tool: call.tool,
      ok: false,
      output: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
