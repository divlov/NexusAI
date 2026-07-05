'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, CardHeader, CardTitle } from '@nexus/ui';
import type { ProgressEvent, ToolCall } from '@nexus/shared/types';

/** Loosened event shape: server progress events plus snapshot/done envelopes. */
type StreamEvent =
  | ProgressEvent
  | { type: 'snapshot'; jobId: string; status: string; plan?: unknown; result?: unknown }
  | { type: 'done'; jobId: string };

interface PendingApproval {
  approvalId: string;
  call: ToolCall;
}

export function AgentTimeline({ jobId }: { jobId: string | null }) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [pending, setPending] = useState<PendingApproval | null>(null);
  const [deciding, setDeciding] = useState(false);
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEvents([]);
    setPending(null);
    if (!jobId) return;

    const es = new EventSource(`/api/jobs/${jobId}/stream`);
    es.onmessage = (msg) => {
      const event = JSON.parse(msg.data) as StreamEvent;
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [events]);

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

  if (!jobId) {
    return (
      <Card className="flex min-h-[420px] items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Select or create a task to watch the agent work in real time.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex min-h-[420px] flex-col">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Agent timeline</CardTitle>
        <code className="text-xs text-muted-foreground">{jobId.slice(0, 12)}</code>
      </CardHeader>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
        {events.length === 0 && (
          <p className="text-sm text-muted-foreground">Connecting…</p>
        )}
        {events.map((event, i) => (
          <TimelineRow key={i} event={event} />
        ))}

        {pending && (
          <div className="mt-3 rounded-lg border border-warn-foreground/30 bg-warn p-4">
            <p className="text-sm font-semibold text-warn-foreground">Approval required</p>
            <p className="mt-1 text-sm text-warn-foreground/90">
              The agent wants to run a risky action:{' '}
              <code className="rounded bg-warn-foreground/15 px-1">{pending.call.tool}</code>
            </p>
            <pre className="mt-2 overflow-x-auto rounded bg-warn-foreground/10 p-2 text-xs text-warn-foreground">
              {JSON.stringify(pending.call.args, null, 2)}
            </pre>
            <div className="mt-3 flex gap-2">
              <Button disabled={deciding} onClick={() => decide('APPROVED')}>
                Approve
              </Button>
              <Button variant="outline" disabled={deciding} onClick={() => decide('REJECTED')}>
                Reject
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function TimelineRow({ event }: { event: StreamEvent }) {
  switch (event.type) {
    case 'snapshot':
      return <Line tone="neutral" label="snapshot" text={`status: ${event.status}`} />;
    case 'status':
      return <Line tone="info" label="status" text={event.status} />;
    case 'thinking':
      return <Line tone="info" label="thinking" text={event.message} />;
    case 'plan':
      return (
        <div>
          <Line tone="info" label="plan" text={event.plan.summary} />
          <ul className="ml-4 mt-1 list-decimal space-y-0.5 text-xs text-muted-foreground">
            {event.plan.steps.map((s) => (
              <li key={s.index}>
                {s.description} <code>({s.tool})</code>
                {s.risky && <span className="ml-1 text-warn-foreground">· risky</span>}
              </li>
            ))}
          </ul>
        </div>
      );
    case 'tool_call':
      return <Line tone="info" label="tool →" text={event.call.tool} />;
    case 'tool_result':
      return (
        <Line
          tone={event.result.ok ? 'success' : 'error'}
          label="tool ←"
          text={`${event.result.tool}: ${event.result.ok ? 'ok' : event.result.error ?? 'failed'}`}
        />
      );
    case 'awaiting_approval':
      return <Line tone="warn" label="paused" text={`awaiting approval for ${event.call.tool}`} />;
    case 'completed':
      return <Line tone="success" label="done" text="run completed" />;
    case 'error':
      return <Line tone="error" label="error" text={event.message} />;
    default:
      return null;
  }
}

function Line({
  tone,
  label,
  text,
}: {
  tone: 'neutral' | 'info' | 'warn' | 'success' | 'error';
  label: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Badge tone={tone} className="mt-0.5 shrink-0">
        {label}
      </Badge>
      <span className="text-foreground/90">{text}</span>
    </div>
  );
}
