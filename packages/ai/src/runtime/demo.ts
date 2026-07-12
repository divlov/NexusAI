import { isRiskyTool } from '../tools/registry.js';
import { DEFERRED_ARG, hasDeferredArg } from './deferred.js';
import type { AgentRuntime } from './types.js';
import type { AgentPlan, PlanStep, ToolCall, ToolResult } from '@nexus/shared';

/**
 * Demo runtime — used when NEXT_PUBLIC_IS_DEMO_MODE is true.
 *
 * Makes ZERO external calls and performs NO mutations. It synthesizes a
 * realistic plan from keywords in the prompt, simulates "thinking" latency, and
 * returns structured mock tool results. This keeps the public portfolio
 * deployment fully interactive with no API cost or abuse risk.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface TemplateStep {
  description: string;
  tool: string;
  args: Record<string, unknown>;
}

/** Pick a plausible plan from prompt keywords, always including a risky step. */
function planTemplate(prompt: string): { summary: string; steps: TemplateStep[] } {
  const p = prompt.toLowerCase();
  const steps: TemplateStep[] = [];

  steps.push({
    description: 'Scan recent inbox messages for relevant items',
    tool: 'gmail.scanInbox',
    args: { query: 'is:unread newer_than:7d', maxResults: 20 },
  });

  if (p.includes('jira') || p.includes('ticket') || p.includes('issue')) {
    steps.push({
      description: 'Create a Jira ticket for the highest-priority item',
      tool: 'jira.createIssue',
      args: {
        projectKey: 'OPS',
        summary: 'Urgent: customer escalation detected',
        description: 'Auto-drafted from inbox scan. Review before closing.',
        issueType: 'Task',
      },
    });
  }

  if (p.includes('slack') || p.includes('read') || p.includes('summarize')) {
    steps.push({
      description: 'Read the recent messages in the channel',
      tool: 'slack.readChannel',
      args: { channel: '#general', limit: 20 },
    });
  }

  if (p.includes('slack') || p.includes('notify') || p.includes('lead')) {
    steps.push({
      description: 'Post a summary of the recent messages back to the channel',
      tool: 'slack.postMessage',
      // Deferred: filled from the readChannel result at execution time.
      args: { channel: '#general', text: DEFERRED_ARG },
    });
  }

  if (p.includes('remind') || p.includes('follow') || p.includes('calendar')) {
    steps.push({
      description: 'Create a follow-up reminder',
      tool: 'calendar.createEvent',
      args: {
        title: 'Follow up on unanswered conversations',
        startsAt: '2026-06-16T09:00:00.000Z',
        durationMinutes: 30,
      },
    });
  }

  // Guarantee at least one risky step so the approval flow is always demoed.
  if (!steps.some((s) => isRiskyTool(s.tool))) {
    steps.push({
      description: 'Create a Jira ticket summarizing findings',
      tool: 'jira.createIssue',
      args: {
        projectKey: 'OPS',
        summary: 'Summary of agent run',
        description: 'Auto-generated summary ticket.',
        issueType: 'Task',
      },
    });
  }

  return {
    summary: `Plan to handle: "${prompt.slice(0, 80)}"`,
    steps,
  };
}

/** Deterministic-ish mock output per tool. */
function mockOutput(call: ToolCall): unknown {
  switch (call.tool) {
    case 'gmail.scanInbox':
      return {
        scanned: 18,
        highlights: [
          { from: 'acme@bigco.com', subject: 'Production outage', priority: 'high' },
          { from: 'lead@startup.io', subject: 'Pricing question', priority: 'medium' },
        ],
      };
    case 'jira.createIssue':
      return { issueKey: 'OPS-4821', url: 'https://demo.atlassian.net/browse/OPS-4821' };
    case 'jira.searchIssues':
      return {
        count: 3,
        hasMore: false,
        issues: [
          { key: 'OPS-4810', summary: 'Customer escalation follow-up', status: 'In Progress', assignee: 'Dana K.', updated: '2026-07-10T14:00:00.000Z' },
          { key: 'OPS-4805', summary: 'Pricing tier bug', status: 'To Do', assignee: null, updated: '2026-07-09T09:30:00.000Z' },
          { key: 'OPS-4790', summary: 'Onboarding checklist update', status: 'Done', assignee: 'Sam R.', updated: '2026-07-05T11:15:00.000Z' },
        ],
      };
    case 'slack.readChannel':
      return {
        channel: call.args.channel ?? '#general',
        channelId: 'C0DEMO123',
        count: 3,
        messages: [
          { user: 'U01', text: 'Deploy went out, watching dashboards.', ts: '1718000000.000100' },
          { user: 'U02', text: 'Customer asked about the pricing tier again.', ts: '1718000100.000200' },
          { user: 'U03', text: 'Standup moved to 10am tomorrow.', ts: '1718000200.000300' },
        ],
      };
    case 'slack.postMessage':
      return { ok: true, channel: call.args.channel, ts: '1718000000.000100' };
    case 'calendar.createEvent':
      return { eventId: 'evt_demo_8f3a', htmlLink: 'https://calendar.google.com/event?id=demo' };
    default:
      return { ok: true };
  }
}

/** Compose a deterministic mock summary from a prior slack.readChannel result. */
function demoSummary(priorResults: ToolResult[]): string {
  const read = priorResults.find((r) => r.tool === 'slack.readChannel');
  const output = read?.output as { messages?: { text: string }[] } | undefined;
  if (output?.messages?.length) {
    const joined = output.messages.map((m) => m.text).join(' | ');
    return `Recap of ${output.messages.length} recent messages: ${joined}`.slice(0, 200);
  }
  return 'Summary of recent activity (demo).';
}

export class DemoRuntime implements AgentRuntime {
  readonly mode = 'demo' as const;

  async plan(prompt: string): Promise<AgentPlan> {
    await sleep(600); // simulate planning latency
    const template = planTemplate(prompt);
    const steps: PlanStep[] = template.steps.map((s, index) => ({
      index,
      description: s.description,
      tool: s.tool,
      args: s.args,
      risky: isRiskyTool(s.tool),
    }));
    return { summary: template.summary, steps };
  }

  async resolveArgs(call: ToolCall, priorResults: ToolResult[]): Promise<ToolCall> {
    if (!hasDeferredArg(call.args)) return call;
    const summary = demoSummary(priorResults);
    const args = Object.fromEntries(
      Object.entries(call.args).map(([k, v]) => [k, v === DEFERRED_ARG ? summary : v]),
    );
    return { ...call, args };
  }

  async executeTool(call: ToolCall): Promise<ToolResult> {
    await sleep(500); // simulate tool latency
    return {
      toolCallId: call.id,
      tool: call.tool,
      ok: true,
      output: mockOutput(call),
    };
  }

  async summarize(prompt: string, results: ToolResult[]): Promise<string> {
    await sleep(300);
    const ok = results.filter((r) => r.ok).length;
    return `Completed ${ok} action(s) for your request. (Demo mode — no real systems were touched.)`;
  }
}
