'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProgress, type JobStreamState } from './useJobStream';

interface IntegrationSummary {
  provider: string;
  label: string;
  connected: boolean;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Right-hand rail — live run progress and counters derived from the shared job stream. */
export function ContextPanel({ jobId, stream }: { jobId: string | null; stream: JobStreamState | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    if (!jobId) return;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [jobId]);

  const { data: integrations } = useQuery({
    queryKey: ['integrations'],
    queryFn: async (): Promise<IntegrationSummary[]> => {
      const res = await fetch('/api/integrations');
      if (!res.ok) throw new Error('Failed to load integrations');
      const json = (await res.json()) as { integrations: IntegrationSummary[] };
      return json.integrations;
    },
    staleTime: 60_000,
  });
  const connectedTools = integrations?.filter((i) => i.connected) ?? [];

  const progress = stream ? getProgress(stream) : null;

  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border bg-background p-4 xl:flex">
      <h3 className="font-label text-xs uppercase tracking-widest text-muted-foreground">
        Context metrics
      </h3>

      {stream && progress ? (
        <>
          <div className="rounded-lg border border-border bg-page p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Run progress</span>
              <span className="font-mono text-[11px]">{progress.pct}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-accent transition-all duration-500"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border bg-page p-3">
              <p className="text-[11px] text-muted-foreground">Tool calls</p>
              <p className="font-mono text-lg">{stream.toolCallCount}</p>
            </div>
            <div className="rounded-lg border border-border bg-page p-3">
              <p className="text-[11px] text-muted-foreground">Events</p>
              <p className="font-mono text-lg">{stream.events.length}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-page p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Elapsed</span>
              <span className="font-mono text-sm">{formatElapsed(elapsed)}</span>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Select a task to see live metrics.</p>
      )}

      <div className="rounded-lg border border-border bg-page p-3">
        <span className="mb-2 block text-sm text-muted-foreground">Connected tools</span>
        <div className="flex flex-wrap gap-2">
          {connectedTools.length === 0 && (
            <span className="text-xs text-muted-foreground/60">None connected</span>
          )}
          {connectedTools.map((tool) => (
            <span
              key={tool.provider}
              className="rounded bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground"
            >
              {tool.label}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}
