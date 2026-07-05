import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { AuthForm } from '../_components/AuthForm';
import { ThemeToggle } from '../_components/ThemeToggle';

export default async function RegisterPage() {
  if (await getSession()) redirect('/dashboard');

  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <h1 className="text-2xl font-semibold">Create your workspace</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sets up your organization and owner account.
      </p>
      <div className="mt-6">
        <AuthForm mode="register" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link className="font-medium underline" href="/login">
          Sign in
        </Link>
      </p>
    </main>
  );
}
