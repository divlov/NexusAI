'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { JobList } from './JobList';
import { AgentTimeline } from './AgentTimeline';
import { TaskForm } from './TaskForm';
import { ContextPanel } from './ContextPanel';
import { useJobStream } from './useJobStream';

/** Ties together the sidebar, live thread, composer, and context panel. */
export function JobConsole({ orgName, role }: { orgName: string; role: string }) {
  const [selected, setSelected] = useState<{ id: string; prompt: string } | null>(null);
  const queryClient = useQueryClient();
  const jobId = selected?.id ?? null;
  const stream = useJobStream(jobId);

  function handleCreated(newJobId: string, prompt: string) {
    setSelected({ id: newJobId, prompt });
    void queryClient.invalidateQueries({ queryKey: ['jobs'] });
  }

  return (
    <div className="flex min-h-0 flex-1">
      <JobList
        orgName={orgName}
        role={role}
        selectedJobId={jobId}
        onSelect={(id, prompt) => setSelected({ id, prompt })}
        onNewTask={() => setSelected(null)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AgentTimeline jobId={jobId} prompt={selected?.prompt ?? null} stream={stream} />
        {jobId ? (
          <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-border bg-page px-6 py-4">
            <p className="text-sm text-muted-foreground">
              You&apos;re viewing a past run — it can&apos;t receive new messages.
            </p>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 font-label text-sm font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New task
            </button>
          </footer>
        ) : (
          <TaskForm onCreated={handleCreated} />
        )}
      </div>
      <ContextPanel jobId={jobId} stream={jobId ? stream : null} />
    </div>
  );
}
