'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@nexus/ui';

interface Props {
  mode: 'login' | 'register';
}

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30';

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const body =
      mode === 'register'
        ? {
            email: form.get('email'),
            password: form.get('password'),
            organizationName: form.get('organizationName'),
          }
        : { email: form.get('email'), password: form.get('password') };

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Something went wrong.');
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {mode === 'register' && (
        <input name="organizationName" placeholder="Organization name" required className={inputClass} />
      )}
      <input name="email" type="email" placeholder="Email" required className={inputClass} />
      <input
        name="password"
        type="password"
        placeholder="Password"
        required
        minLength={8}
        className={inputClass}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Please wait…' : mode === 'register' ? 'Create workspace' : 'Sign in'}
      </Button>
    </form>
  );
}
