import { z } from 'zod';
import { IntegrationProvider, type ToolCall, type ToolResult } from '@nexus/shared';
import type { ToolContext } from './context.js';
import { postMessage, readChannel } from './clients/slack.js';
import { scanInbox as gmailScanInbox } from './clients/gmail.js';
import { createEvent } from './clients/calendar.js';
import { createIssue, searchIssues } from './clients/jira.js';

/**
 * Tool registry — the single source of truth for what the agent can do.
 *
 * Each tool declares a Zod input schema (used both to validate LLM-proposed
 * args and to generate the LLM function schema), a `risky` flag, and the
 * `provider` whose credential it needs (or `null` for credential-free tools).
 * Risky tools mutate external systems and therefore require human approval
 * before execution (see the worker's approval pause).
 *
 * `execute` receives the validated args plus a `ToolContext`, which exposes
 * `getCredential(provider)` — the seam where a tenant's decrypted OAuth token is
 * injected without this package depending on `@nexus/db`.
 *
 * Connectors are being wired incrementally. Tools whose provider has no live
 * client yet throw `notImplemented(...)`; demo mode bypasses execution entirely.
 */

export interface ToolDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  inputSchema: TSchema;
  /** Risky tools mutate third-party systems and require approval. */
  risky: boolean;
  /** Which integration credential this tool needs, or null if none. */
  provider: IntegrationProvider | null;
  execute: (args: z.infer<TSchema>, ctx: ToolContext) => Promise<unknown>;
}

function notImplemented(tool: string): never {
  throw new Error(
    `Tool "${tool}" has no live connector yet. Connect the provider under ` +
      'Settings → Integrations, or run with NEXT_PUBLIC_IS_DEMO_MODE=true.',
  );
}

const scanInbox: ToolDefinition = {
  name: 'gmail.scanInbox',
  description:
    'Read and summarize recent Gmail messages matching a query. Read-only.',
  risky: false,
  provider: IntegrationProvider.GMAIL,
  inputSchema: z.object({
    query: z.string().describe('Gmail search query, e.g. "is:unread newer_than:7d"'),
    maxResults: z.number().int().min(1).max(50).default(20),
  }),
  execute: async (args, ctx) => {
    const { accessToken } = await ctx.getCredential(IntegrationProvider.GMAIL);
    return gmailScanInbox(accessToken, { query: args.query, maxResults: args.maxResults });
  },
};

const readSlackChannel: ToolDefinition = {
  name: 'slack.readChannel',
  description:
    'Read the most recent messages from a Slack channel (by #name or id). Read-only.',
  risky: false,
  provider: IntegrationProvider.SLACK,
  inputSchema: z.object({
    channel: z.string().describe('Channel name (e.g. "#general") or channel id.'),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  execute: async (args, ctx) => {
    const { accessToken } = await ctx.getCredential(IntegrationProvider.SLACK);
    return readChannel(accessToken, { channel: args.channel, limit: args.limit });
  },
};

const postSlackMessage: ToolDefinition = {
  name: 'slack.postMessage',
  description: 'Post a message to a Slack channel. Mutates external state — risky.',
  risky: true,
  provider: IntegrationProvider.SLACK,
  inputSchema: z.object({
    channel: z.string(),
    text: z.string(),
  }),
  execute: async (args, ctx) => {
    const { accessToken } = await ctx.getCredential(IntegrationProvider.SLACK);
    return postMessage(accessToken, { channel: args.channel, text: args.text });
  },
};

const searchJiraIssues: ToolDefinition = {
  name: 'jira.searchIssues',
  description:
    'Search/list Jira issues via JQL (e.g. "project = OPS AND status != Done"). ' +
    'Jira rejects fully unbounded JQL (e.g. bare "ORDER BY ..." with no WHERE ' +
    'clause) — always include a restriction (project, status, assignee, or an ' +
    'updated/created time bound). Omit jql entirely for a general ' +
    'recently-updated summary across all accessible projects. Read-only.',
  risky: false,
  provider: IntegrationProvider.JIRA,
  inputSchema: z.object({
    jql: z.string().optional().describe('JQL query; omit for recently-updated issues'),
    maxResults: z.number().int().min(1).max(50).default(20),
  }),
  execute: async (args, ctx) => {
    const { accessToken, externalAccount: cloudId } = await ctx.getCredential(
      IntegrationProvider.JIRA,
    );
    return searchIssues(accessToken, cloudId, { jql: args.jql, maxResults: args.maxResults });
  },
};

const createJiraIssue: ToolDefinition = {
  name: 'jira.createIssue',
  description: 'Create a Jira issue. Mutates an external system — risky.',
  risky: true,
  provider: IntegrationProvider.JIRA,
  inputSchema: z.object({
    projectKey: z.string(),
    summary: z.string(),
    description: z.string(),
    issueType: z.enum(['Bug', 'Task', 'Story']).default('Task'),
  }),
  execute: async (args, ctx) => {
    const { accessToken, externalAccount: cloudId } = await ctx.getCredential(
      IntegrationProvider.JIRA,
    );
    return createIssue(accessToken, cloudId, {
      projectKey: args.projectKey,
      summary: args.summary,
      description: args.description,
      issueType: args.issueType,
    });
  },
};

const createCalendarEvent: ToolDefinition = {
  name: 'calendar.createEvent',
  description: 'Create a Google Calendar event/reminder. Risky.',
  risky: true,
  provider: IntegrationProvider.GOOGLE_CALENDAR,
  inputSchema: z.object({
    title: z.string(),
    startsAt: z
      .string()
      .describe('ISO 8601 datetime; local wall-clock time if a timezone is known, else UTC'),
    durationMinutes: z.number().int().min(5).max(480).default(30),
    notes: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    const { accessToken } = await ctx.getCredential(IntegrationProvider.GOOGLE_CALENDAR);
    return createEvent(accessToken, {
      title: args.title,
      startsAt: args.startsAt,
      durationMinutes: args.durationMinutes,
      notes: args.notes,
      timeZone: ctx.timezone,
    });
  },
};

export const TOOLS: ToolDefinition[] = [
  scanInbox,
  readSlackChannel,
  postSlackMessage,
  searchJiraIssues,
  createJiraIssue,
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
export async function runToolCall(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
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
    const output = await tool.execute(parsed.data, ctx);
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
