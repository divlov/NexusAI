'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
        <TaskForm onCreated={handleCreated} />
      </div>
      <ContextPanel jobId={jobId} stream={jobId ? stream : null} />
    </div>
  );
}
