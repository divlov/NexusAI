import { type NextRequest } from 'next/server';
import { prisma } from '@nexus/db';
import { approvalDecisionSchema, ApprovalStatus } from '@nexus/shared';
import { errorResponse, json } from '@/lib/api';
import { requireSession } from '@/lib/auth/session';
import { enqueueResumeTask } from '@/lib/queue/producer';

export const runtime = 'nodejs';

/**
 * Record an approval decision and (on a non-trivial outcome) enqueue a
 * resume-task so the worker can continue the paused agent run. Tenant-scoped.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const { decision, note } = approvalDecisionSchema.parse(await req.json());

    const approval = await prisma.approval.findFirst({
      where: { id, orgId: session.orgId },
    });
    if (!approval) return json({ error: 'Approval not found' }, 404);
    if (approval.status !== ApprovalStatus.PENDING) {
      return json({ error: 'Approval already decided' }, 409);
    }

    await prisma.approval.update({
      where: { id: approval.id },
      data: {
        status: decision,
        note,
        decidedByUserId: session.userId,
        decidedAt: new Date(),
      },
    });

    await enqueueResumeTask({
      jobId: approval.jobId,
      orgId: session.orgId,
      approvalId: approval.id,
      approved: decision === ApprovalStatus.APPROVED,
    });

    return json({ ok: true, decision }, 202);
  } catch (error) {
    return errorResponse(error);
  }
}
