'use client';

import { useState, type FormEvent } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@nexus/ui';

const EXAMPLES = [
  'Summarize urgent customer issues and create Jira tickets',
  'Scan my emails and notify Slack about high-priority leads',
  'Create follow-up reminders for unanswered conversations',
];

export function TaskForm({ onCreated }: { onCreated: (jobId: string) => void }) {
  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (res.status !== 202) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Failed to create task.');
      }
      const { jobId } = (await res.json()) as { jobId: string };
      setPrompt('');
      onCreated(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New agent task</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            required
            minLength={8}
            placeholder="Describe what the agent should do…"
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setPrompt(ex)}
                className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/70"
              >
                {ex.slice(0, 28)}…
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Dispatching…' : 'Run task'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
