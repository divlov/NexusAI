import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Terminal } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { AuthForm } from '../_components/AuthForm';
import { ThemeToggle } from '../_components/ThemeToggle';

export default async function RegisterPage() {
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
            <Terminal className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Nexus</h1>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Initialize your enterprise-grade operational environment.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background p-8 shadow-2xl shadow-black/5">
          <AuthForm mode="register" />
          <div className="mt-6 border-t border-border pt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                className="font-semibold text-foreground underline decoration-accent decoration-2 underline-offset-4"
                href="/login"
              >
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
