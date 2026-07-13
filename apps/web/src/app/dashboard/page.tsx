import { redirect } from 'next/navigation';
import { prisma } from '@nexus/db';
import { getSession } from '@/lib/auth/session';
import { JobConsole } from '../_components/JobConsole';
import { TopNav } from '../_components/TopNav';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const org = await prisma.organization.findUnique({
    where: { id: session.orgId },
    select: { name: true },
  });

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-page">
      <TopNav />
      <JobConsole orgName={org?.name ?? 'Workspace'} role={session.role} />
    </div>
  );
}
