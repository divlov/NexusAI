import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Zap } from 'lucide-react';
import { IS_DEMO_MODE } from '@nexus/shared';
import { getSession } from '@/lib/auth/session';
import { AuthForm } from '../_components/AuthForm';
import { ThemeToggle } from '../_components/ThemeToggle';

export default async function LoginPage() {
  if (await getSession()) redirect('/dashboard');

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-page px-6 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent/10 blur-[100px]" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="absolute right-6 top-6 z-10">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary shadow-lg shadow-black/10">
            <Zap
              className="h-6 w-6 text-primary-foreground"
              fill="currentColor"
              aria-hidden="true"
            />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Nexus</h1>
          <p className="mt-1 text-sm text-muted-foreground">Operational Intelligence Platform</p>
        </div>

        <div className="rounded-xl border border-border bg-background p-8 shadow-2xl shadow-black/5">
          {IS_DEMO_MODE && (
            <p className="mb-4 rounded-md bg-warn px-3 py-2 text-sm text-warn-foreground">
              Demo mode is on — open the{' '}
              <Link className="underline" href="/dashboard">
                dashboard
              </Link>{' '}
              directly, no credentials needed.
            </p>
          )}
          <AuthForm mode="login" />
          <div className="mt-6 border-t border-border pt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link
                className="font-semibold text-foreground underline decoration-accent decoration-2 underline-offset-4"
                href="/register"
              >
                Register
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-border/50 bg-muted px-3 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-foreground" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
