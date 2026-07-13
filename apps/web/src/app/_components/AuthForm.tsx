'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ArrowRight, Building2, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { Button, cn } from '@nexus/ui';

interface Props {
  mode: 'login' | 'register';
}

const inputBaseClass =
  'w-full rounded-md border border-border bg-elevated py-2.5 pl-10 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 placeholder:text-muted-foreground/60';
const iconClass =
  'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground';
const labelClass = 'font-label text-xs uppercase tracking-wide text-muted-foreground';

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === 'register' && (
        <div className="space-y-1.5">
          <label htmlFor="organizationName" className={cn(labelClass, 'ml-1 block')}>
            Organization name
          </label>
          <div className="relative">
            <Building2 className={iconClass} aria-hidden="true" />
            <input
              id="organizationName"
              name="organizationName"
              placeholder="Acme Inc."
              required
              className={cn(inputBaseClass, 'pr-4')}
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="email" className={cn(labelClass, 'ml-1 block')}>
          Email address
        </label>
        <div className="relative">
          <Mail className={iconClass} aria-hidden="true" />
          <input
            id="email"
            name="email"
            type="email"
            placeholder="name@company.com"
            required
            className={cn(inputBaseClass, 'pr-4')}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className={cn(labelClass, 'block')}>
          Password
        </label>
        <div className="relative">
          <Lock className={iconClass} aria-hidden="true" />
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            required
            minLength={8}
            className={cn(inputBaseClass, 'pr-10')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={submitting} className="mt-2 w-full">
        {submitting ? 'Please wait…' : mode === 'register' ? 'Create Account' : 'Sign In'}
        {!submitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
      </Button>
    </form>
  );
}
