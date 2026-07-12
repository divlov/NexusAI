'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TaskForm } from './TaskForm';
import { JobList } from './JobList';
import { AgentTimeline } from './AgentTimeline';

/** Ties together task creation, the job list, and the live agent timeline. */
export function JobConsole() {
  const [selected, setSelected] = useState<{ id: string; prompt: string } | null>(null);
  const queryClient = useQueryClient();

  function handleCreated(jobId: string, prompt: string) {
    setSelected({ id: jobId, prompt });
    void queryClient.invalidateQueries({ queryKey: ['jobs'] });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-6">
        <TaskForm onCreated={handleCreated} />
        <JobList
          selectedJobId={selected?.id ?? null}
          onSelect={(id, prompt) => setSelected({ id, prompt })}
        />
      </div>
      <AgentTimeline jobId={selected?.id ?? null} prompt={selected?.prompt ?? null} />
    </div>
  );
}
