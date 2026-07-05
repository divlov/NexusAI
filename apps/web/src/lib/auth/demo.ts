import 'server-only';
import { prisma, MembershipRole } from '@nexus/db';
import { DEMO_SESSION } from './session.js';

/**
 * Idempotently seed the demo organization/user/membership referenced by the
 * demo session, so foreign keys resolve when creating agent jobs in demo mode.
 */
export async function ensureDemoTenant(): Promise<void> {
  await prisma.organization.upsert({
    where: { id: DEMO_SESSION.orgId },
    update: {},
    create: { id: DEMO_SESSION.orgId, name: 'Demo Workspace', slug: 'demo' },
  });

  await prisma.user.upsert({
    where: { id: DEMO_SESSION.userId },
    update: {},
    create: {
      id: DEMO_SESSION.userId,
      email: 'demo@nexus.local',
      passwordHash: 'demo-no-login',
      name: 'Demo User',
    },
  });

  await prisma.membership.upsert({
    where: { orgId_userId: { orgId: DEMO_SESSION.orgId, userId: DEMO_SESSION.userId } },
    update: {},
    create: {
      orgId: DEMO_SESSION.orgId,
      userId: DEMO_SESSION.userId,
      role: MembershipRole.OWNER,
    },
  });
}
