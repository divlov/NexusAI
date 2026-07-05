'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TaskForm } from './TaskForm';
import { JobList } from './JobList';
import { AgentTimeline } from './AgentTimeline';

/** Ties together task creation, the job list, and the live agent timeline. */
export function JobConsole() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  function handleCreated(jobId: string) {
    setSelectedJobId(jobId);
    void queryClient.invalidateQueries({ queryKey: ['jobs'] });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-6">
        <TaskForm onCreated={handleCreated} />
        <JobList selectedJobId={selectedJobId} onSelect={setSelectedJobId} />
      </div>
      <AgentTimeline jobId={selectedJobId} />
    </div>
  );
}
