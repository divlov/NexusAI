'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, HelpCircle, Plus, Search } from 'lucide-react';
import { cn } from '@nexus/ui';
import { statusTone } from './status';

interface JobRow {
  id: string;
  prompt: string;
  status: string;
  createdAt: string;
}

const DOT_CLASS: Record<string, string> = {
  neutral: 'bg-muted-foreground/50',
  info: 'bg-info-foreground',
  warn: 'bg-warn-foreground',
  success: 'bg-success-foreground',
  error: 'bg-error-foreground',
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'active now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function JobList({
  orgName,
  role,
  selectedJobId,
  onSelect,
  onNewTask,
}: {
  orgName: string;
  role: string;
  selectedJobId: string | null;
  onSelect: (id: string, prompt: string) => void;
  onNewTask: () => void;
}) {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: async (): Promise<JobRow[]> => {
      const res = await fetch('/api/tasks');
      if (!res.ok) throw new Error('Failed to load jobs');
      const json = (await res.json()) as { jobs: JobRow[] };
      return json.jobs;
    },
    // Light polling keeps statuses fresh without per-row SSE.
    refetchInterval: 5000,
  });

  const filtered = data?.filter((job) => job.prompt.toLowerCase().includes(search.toLowerCase()));

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-3 border-r border-border bg-background p-4">
      <div className="px-1">
        <p className="truncate text-sm font-semibold">{orgName}</p>
        <p className="font-label text-[10px] uppercase tracking-widest text-muted-foreground">
          {role.toLowerCase()}
        </p>
      </div>

      <button
        type="button"
        onClick={onNewTask}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 font-label text-sm font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
      >
        <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
        New task
      </button>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search runs…"
          className="w-full rounded-lg border border-border bg-page py-1.5 pl-9 pr-3 text-sm outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto">
        {isLoading && <p className="px-1 text-sm text-muted-foreground">Loading…</p>}
        {filtered?.length === 0 && (
          <p className="px-1 text-sm text-muted-foreground">
            {search ? 'No matching runs.' : 'No runs yet. Create one below.'}
          </p>
        )}
        {filtered?.map((job) => {
          const tone = statusTone(job.status);
          const active = selectedJobId === job.id;
          return (
            <button
              key={job.id}
              onClick={() => onSelect(job.id, job.prompt)}
              className={cn(
                'flex w-full flex-col gap-1 rounded-lg p-2.5 text-left transition-colors',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', DOT_CLASS[tone])} />
                <span className="truncate font-label text-sm">{job.prompt}</span>
              </div>
              <span
                className={cn(
                  'ml-4 font-mono text-[10px]',
                  active ? 'text-accent-foreground/70' : 'opacity-70',
                )}
              >
                {relativeTime(job.createdAt)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1 border-t border-border pt-3">
        <div className="flex items-center gap-3 rounded-lg p-2 text-muted-foreground/60">
          <HelpCircle className="h-[18px] w-[18px]" aria-hidden="true" />
          <span className="font-label text-sm">Help</span>
        </div>
        <div className="flex items-center gap-3 rounded-lg p-2 text-muted-foreground/60">
          <FileText className="h-[18px] w-[18px]" aria-hidden="true" />
          <span className="font-label text-sm">Documentation</span>
        </div>
      </div>
    </aside>
  );
}
