import { prisma } from '@nexus/db';
import { errorResponse, json } from '@/lib/api';
import { requireSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

/** Full detail for one job: status, plan, result, approvals, and audit trail. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const job = await prisma.agentJob.findFirst({
      where: { id, orgId: session.orgId },
      include: {
        approvals: { orderBy: { createdAt: 'asc' } },
        auditLogs: { orderBy: { createdAt: 'asc' }, take: 100 },
      },
    });
    if (!job) return json({ error: 'Not found' }, 404);
    return json({ job });
  } catch (error) {
    return errorResponse(error);
  }
}
