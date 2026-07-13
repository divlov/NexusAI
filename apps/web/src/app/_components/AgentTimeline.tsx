'use client';

import { useEffect, useRef } from 'react';
import { CheckCircle2, Circle, ListChecks, Loader2, TriangleAlert } from 'lucide-react';
import { Badge, Button, Card } from '@nexus/ui';
import type { PlanStep } from '@nexus/shared/types';
import { statusTone } from './status';
import { getProgress, type JobStreamState, type StreamEvent } from './useJobStream';

const CIRCUMFERENCE = 2 * Math.PI * 18;

export function AgentTimeline({
  jobId,
  prompt,
  stream,
}: {
  jobId: string | null;
  prompt?: string | null;
  stream: JobStreamState;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { events, pending, deciding, decide, status, plan } = stream;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [events]);

  if (!jobId) {
    return (
      <div className="flex flex-1 items-center justify-center bg-page">
        <p className="text-sm text-muted-foreground">
          Select or create a task to watch the agent work in real time.
        </p>
      </div>
    );
  }

  const { completed: completedSteps, pct } = getProgress(stream);
  const dashOffset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
  const statusLabel = (status ?? 'PENDING').replace(/_/g, ' ');

  const completedEvent = events.find((e) => e.type === 'completed');
  const errorEvent = events.find((e) => e.type === 'error');
  const feedEvents = events.filter(
    (e) => e.type === 'tool_call' || e.type === 'tool_result' || e.type === 'thinking' || e.type === 'log',
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-page">
      <header className="sticky top-0 z-10 flex shrink-0 items-center gap-4 border-b border-border bg-page/95 px-6 py-4 backdrop-blur">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
          <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted" />
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              className="text-accent transition-[stroke-dashoffset] duration-500"
            />
          </svg>
          <span className="font-mono text-[10px] font-bold">{pct}%</span>
        </div>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold" title={prompt ?? undefined}>
          {prompt ?? 'Task run'}
        </h1>
        <Badge tone={statusTone(status ?? 'PENDING')} className="shrink-0">
          {statusLabel}
        </Badge>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {prompt && (
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-xl rounded-tr-sm border border-border bg-elevated px-4 py-3">
              <p className="text-sm leading-relaxed">{prompt}</p>
            </div>
          </div>
        )}

        {events.length === 0 && <p className="text-sm text-muted-foreground">Connecting…</p>}

        {plan && <PlanChecklist plan={plan} completedSteps={completedSteps} />}

        {feedEvents.length > 0 && <ActivityFeed events={feedEvents} />}

        {pending && (
          <div className="rounded-lg border border-warn-foreground/30 bg-warn p-4">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warn-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-warn-foreground">Approval required</p>
                <p className="mt-1 text-sm text-warn-foreground/90">
                  The agent wants to run a risky action:{' '}
                  <code className="rounded bg-warn-foreground/15 px-1 font-mono">{pending.call.tool}</code>
                </p>
                <div className="mt-2 space-y-1 rounded bg-warn-foreground/10 p-2 font-mono text-xs text-warn-foreground">
                  {argEntries(pending.call.args).map(([k, v]) => (
                    <div key={k} className="break-words">
                      <span className="font-semibold capitalize">{k}:</span> {v}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button disabled={deciding} onClick={() => decide('APPROVED')}>
                    Approve
                  </Button>
                  <Button variant="outline" disabled={deciding} onClick={() => decide('REJECTED')}>
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {completedEvent && completedEvent.type === 'completed' && (
          <div className="rounded-lg border border-success-foreground/30 bg-success p-4">
            <p className="text-sm font-semibold text-success-foreground">Run completed</p>
            <p className="mt-1 text-sm text-success-foreground/90">
              {(completedEvent.result as { summary?: string } | undefined)?.summary ?? 'Done.'}
            </p>
          </div>
        )}

        {errorEvent && errorEvent.type === 'error' && (
          <div className="rounded-lg border border-error-foreground/30 bg-error p-4">
            <p className="text-sm font-semibold text-error-foreground">Run failed</p>
            <p className="mt-1 text-sm text-error-foreground/90">{errorEvent.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanChecklist({ plan, completedSteps }: { plan: { summary: string; steps: PlanStep[] }; completedSteps: number }) {
  return (
    <Card className="p-4">
      <h4 className="mb-3 flex items-center gap-2 font-label text-xs uppercase tracking-wide text-muted-foreground">
        <ListChecks className="h-4 w-4" aria-hidden="true" />
        Agent plan ({completedSteps} of {plan.steps.length})
      </h4>
      <ul className="space-y-2">
        {plan.steps.map((step) => {
          const done = step.index < completedSteps;
          return (
            <li
              key={step.index}
              className={`flex items-start gap-3 text-sm ${done ? 'text-muted-foreground line-through' : 'text-foreground'}`}
            >
              {done ? (
                <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-success-foreground" aria-hidden="true" />
              ) : (
                <Circle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span>
                {step.description}
                {step.risky && <span className="ml-1.5 text-xs text-warn-foreground">· risky</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function ActivityFeed({ events }: { events: StreamEvent[] }) {
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-sunken p-3 font-mono text-[11px] text-muted-foreground">
      {events.map((event, i) => {
        switch (event.type) {
          case 'tool_call': {
            const args = formatArgsInline(event.call.args);
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-accent">→</span>
                <span className="truncate">
                  {event.call.tool}
                  {args && <span className="opacity-70">({args})</span>}
                </span>
              </div>
            );
          }
          case 'tool_result':
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-accent">→</span>
                <span className="min-w-0 flex-1 truncate">{event.result.tool}</span>
                <span className={event.result.ok ? 'text-success-foreground' : 'text-error-foreground'}>
                  {event.result.ok ? 'SUCCESS' : (event.result.error ?? 'FAILED').toUpperCase()}
                </span>
              </div>
            );
          case 'thinking':
            return (
              <div key={i} className="flex items-center gap-2 italic opacity-70">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                <span className="truncate">{event.message}</span>
              </div>
            );
          case 'log':
            return (
              <div key={i} className="flex items-center gap-2 opacity-70">
                <span>#</span>
                <span className="truncate">{event.message}</span>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

/** Args as [key, string-value] pairs for readable rendering. */
function argEntries(args: Record<string, unknown>): [string, string][] {
  return Object.entries(args).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]);
}

/** Compact single-line args summary for the timeline (values truncated). */
function formatArgsInline(args: Record<string, unknown>): string {
  return argEntries(args)
    .map(([k, v]) => `${k}: ${v.length > 60 ? `${v.slice(0, 60)}…` : v}`)
    .join(' · ');
}
