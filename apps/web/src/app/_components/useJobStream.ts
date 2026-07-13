'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AgentPlan, ProgressEvent, ToolCall, ToolResult } from '@nexus/shared/types';

/** Snapshot the stream emits on connect — full enough to rebuild a finished run. */
export interface SnapshotEvent {
  type: 'snapshot';
  jobId: string;
  status: string;
  plan?: AgentPlan | null;
  results?: ToolResult[];
  finalSummary?: string | null;
  error?: string | null;
  pending?: PendingApproval | null;
}

/** Loosened event shape: server progress events plus snapshot/done envelopes. */
export type StreamEvent = ProgressEvent | SnapshotEvent | { type: 'done'; jobId: string };

export interface PendingApproval {
  approvalId: string;
  call: ToolCall;
}

/**
 * Rebuild a timeline from a snapshot of a finished/paused run. Live progress
 * events are ephemeral, so for historical runs we synthesize the equivalent
 * rows from persisted plan + results. Returns [] for fresh runs (no plan yet),
 * letting live events drive the display instead.
 */
function reconstructFromSnapshot(snap: SnapshotEvent): StreamEvent[] {
  if (!snap.plan) return [];
  const rows: StreamEvent[] = [{ type: 'plan', jobId: snap.jobId, plan: snap.plan, at: '' }];
  const steps = snap.plan.steps ?? [];
  (snap.results ?? []).forEach((result, i) => {
    const step = steps[i];
    rows.push({
      type: 'tool_call',
      jobId: snap.jobId,
      call: { id: result.toolCallId, tool: result.tool, args: step?.args ?? {}, risky: step?.risky ?? false },
      at: '',
    });
    rows.push({ type: 'tool_result', jobId: snap.jobId, result, at: '' });
  });
  if (snap.pending) {
    rows.push({
      type: 'awaiting_approval',
      jobId: snap.jobId,
      approvalId: snap.pending.approvalId,
      call: snap.pending.call,
      at: '',
    });
  }
  if (snap.finalSummary) {
    rows.push({
      type: 'completed',
      jobId: snap.jobId,
      result: { summary: snap.finalSummary, results: snap.results ?? [] },
      at: '',
    });
  }
  if (snap.error) rows.push({ type: 'error', jobId: snap.jobId, message: snap.error, at: '' });
  return rows;
}

export interface JobStreamState {
  events: StreamEvent[];
  pending: PendingApproval | null;
  deciding: boolean;
  decide: (decision: 'APPROVED' | 'REJECTED') => Promise<void>;
  /** Latest known status string, or null before the stream has said anything. */
  status: string | null;
  /** Latest known plan, once the agent has produced one. */
  plan: AgentPlan | null;
  toolCallCount: number;
  toolResultCount: number;
}

/**
 * Owns the live SSE connection for a job so multiple UI regions (the thread
 * and the context panel) can read the same state without opening duplicate
 * EventSource connections or re-deriving approval handling twice.
 */
export function useJobStream(jobId: string | null): JobStreamState {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [pending, setPending] = useState<PendingApproval | null>(null);
  const [deciding, setDeciding] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setEvents([]);
    setPending(null);
    if (!jobId) return;

    const es = new EventSource(`/api/jobs/${jobId}/stream`);
    es.onmessage = (msg) => {
      const event = JSON.parse(msg.data) as StreamEvent;

      if (event.type === 'snapshot') {
        // Historical/paused run → rebuild the timeline; fresh run → show status
        // and let live events append.
        const rebuilt = reconstructFromSnapshot(event);
        setEvents(rebuilt.length > 0 ? rebuilt : [event]);
        if (event.pending) setPending(event.pending);
        return;
      }

      setEvents((prev) => [...prev, event]);
      if (event.type === 'awaiting_approval') {
        setPending({ approvalId: event.approvalId, call: event.call });
      }
      if (event.type === 'completed' || event.type === 'status') {
        void queryClient.invalidateQueries({ queryKey: ['jobs'] });
      }
      if (event.type === 'done') es.close();
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [jobId, queryClient]);

  async function decide(decision: 'APPROVED' | 'REJECTED') {
    if (!pending) return;
    setDeciding(true);
    try {
      await fetch(`/api/approvals/${pending.approvalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      setPending(null); // worker resumes; further events arrive on the same stream.
    } finally {
      setDeciding(false);
    }
  }

  let status: string | null = null;
  let plan: AgentPlan | null = null;
  let toolCallCount = 0;
  let toolResultCount = 0;
  for (const event of events) {
    if (event.type === 'snapshot') {
      status = event.status;
      if (event.plan) plan = event.plan;
    } else if (event.type === 'status') {
      status = event.status;
    } else if (event.type === 'plan') {
      plan = event.plan;
    } else if (event.type === 'tool_call') {
      toolCallCount += 1;
    } else if (event.type === 'tool_result') {
      toolResultCount += 1;
    }
  }

  return { events, pending, deciding, decide, status, plan, toolCallCount, toolResultCount };
}

/** Shared progress math so the thread header and context panel never disagree. */
export function getProgress(stream: JobStreamState): { completed: number; total: number; pct: number } {
  const total = stream.plan?.steps.length ?? 0;
  const completed = Math.min(stream.toolResultCount, total);
  const pct = total > 0 ? Math.round((completed / total) * 100) : stream.status === 'COMPLETED' ? 100 : 0;
  return { completed, total, pct };
}
