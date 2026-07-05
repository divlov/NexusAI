import { isRiskyTool } from '../tools/registry.js';
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

  if (p.includes('slack') || p.includes('notify') || p.includes('lead')) {
    steps.push({
      description: 'Notify the team channel about high-priority leads',
      tool: 'slack.postMessage',
      args: { channel: '#sales-alerts', text: '2 high-priority leads need follow-up.' },
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
    case 'slack.postMessage':
      return { ok: true, channel: call.args.channel, ts: '1718000000.000100' };
    case 'calendar.createEvent':
      return { eventId: 'evt_demo_8f3a', htmlLink: 'https://calendar.google.com/event?id=demo' };
    default:
      return { ok: true };
  }
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
