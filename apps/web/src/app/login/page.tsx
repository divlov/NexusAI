import Link from 'next/link';
import { redirect } from 'next/navigation';
import { IS_DEMO_MODE } from '@nexus/shared';
import { getSession } from '@/lib/auth/session';
import { AuthForm } from '../_components/AuthForm';
import { ThemeToggle } from '../_components/ThemeToggle';

export default async function LoginPage() {
  if (await getSession()) redirect('/dashboard');

  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <h1 className="text-2xl font-semibold">Sign in to Nexus</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        AI operations platform with human-in-the-loop approvals.
      </p>
      {IS_DEMO_MODE && (
        <p className="mt-4 rounded-md bg-warn px-3 py-2 text-sm text-warn-foreground">
          Demo mode is on — open the{' '}
          <Link className="underline" href="/dashboard">
            dashboard
          </Link>{' '}
          directly, no credentials needed.
        </p>
      )}
      <div className="mt-6">
        <AuthForm mode="login" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        No account?{' '}
        <Link className="font-medium underline" href="/register">
          Create one
        </Link>
      </p>
    </main>
  );
}
