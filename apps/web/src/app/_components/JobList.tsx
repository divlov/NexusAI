'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge, Card, CardContent, CardHeader, CardTitle, cn } from '@nexus/ui';
import { statusTone } from './status';

interface JobRow {
  id: string;
  prompt: string;
  status: string;
  createdAt: string;
}

export function JobList({
  selectedJobId,
  onSelect,
}: {
  selectedJobId: string | null;
  onSelect: (id: string, prompt: string) => void;
}) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent runs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No runs yet. Create one above.</p>
        )}
        {data?.map((job) => (
          <button
            key={job.id}
            onClick={() => onSelect(job.id, job.prompt)}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm',
              selectedJobId === job.id
                ? 'border-primary/40 bg-muted'
                : 'border-transparent hover:bg-muted/60',
            )}
          >
            <span className="line-clamp-1 flex-1">{job.prompt}</span>
            <Badge tone={statusTone(job.status)}>{job.status.toLowerCase()}</Badge>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
