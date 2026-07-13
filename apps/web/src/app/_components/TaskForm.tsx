'use client';

import { useRef, useState, type FormEvent } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@nexus/ui';

const EXAMPLES = [
  'Summarize urgent customer issues and create Jira tickets',
  'Scan my emails and notify Slack about high-priority leads',
  'Create follow-up reminders for unanswered conversations',
];

export function TaskForm({ onCreated }: { onCreated: (jobId: string, prompt: string) => void }) {
  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function resize(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, timezone }),
      });
      if (res.status !== 202) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Failed to create task.');
      }
      const { jobId } = (await res.json()) as { jobId: string };
      const submitted = prompt;
      setPrompt('');
      resize(textareaRef.current);
      onCreated(jobId, submitted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
    } finally {
      setSubmitting(false);
    }
  }

  function pick(example: string) {
    setPrompt(example);
    textareaRef.current?.focus();
    resize(textareaRef.current);
  }

  return (
    <footer className="shrink-0 border-t border-border bg-page px-6 py-4">
      <form onSubmit={submit} className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => pick(ex)}
              className="shrink-0 whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              resize(e.target);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void submit(e);
              }
            }}
            rows={1}
            required
            minLength={8}
            placeholder="Message Nexus Agent…"
            className="min-h-[52px] w-full resize-none rounded-2xl border border-border bg-elevated py-3.5 pl-5 pr-14 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
          <button
            type="submit"
            disabled={submitting || !prompt.trim()}
            className={cn(
              'absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl transition',
              'bg-primary text-primary-foreground hover:opacity-90 disabled:pointer-events-none disabled:opacity-40',
            )}
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p className="text-center text-[10px] text-muted-foreground/70">
          Agent may produce inaccurate information. All actions on connected tools require approval.
        </p>
      </form>
    </footer>
  );
}
