import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@nexus/db';
import { IS_DEMO_MODE } from '@nexus/shared';
import { Badge } from '@nexus/ui';
import { getSession } from '@/lib/auth/session';
import { JobConsole } from '../_components/JobConsole';
import { LogoutButton } from '../_components/LogoutButton';
import { ThemeToggle } from '../_components/ThemeToggle';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const org = await prisma.organization.findUnique({
    where: { id: session.orgId },
    select: { name: true },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Nexus Operations</h1>
          <p className="text-sm text-muted-foreground">
            {org?.name ?? 'Workspace'} · role {session.role.toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {IS_DEMO_MODE && <Badge tone="warn">Demo mode</Badge>}
          <Link
            href="/settings/integrations"
            className="text-sm text-muted-foreground hover:underline"
          >
            Integrations
          </Link>
          <ThemeToggle />
          {!IS_DEMO_MODE && <LogoutButton />}
        </div>
      </header>

      <JobConsole />
    </div>
  );
}
