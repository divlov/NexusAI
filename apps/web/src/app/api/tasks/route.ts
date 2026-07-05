import { type NextRequest } from 'next/server';
import { prisma } from '@nexus/db';
import { createTaskSchema, JobStatus } from '@nexus/shared';
import { errorResponse, json } from '@/lib/api';
import { requireSession } from '@/lib/auth/session';
import { enqueueRunTask } from '@/lib/queue/producer';

export const runtime = 'nodejs';

/**
 * Thin traffic controller: authenticate → validate → create job row → enqueue →
 * return 202. NO AI execution happens here (queue-first rule).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { prompt } = createTaskSchema.parse(await req.json());

    const job = await prisma.agentJob.create({
      data: {
        orgId: session.orgId,
        createdByUserId: session.userId,
        prompt,
        status: JobStatus.PENDING,
      },
    });

    await enqueueRunTask({ jobId: job.id, orgId: session.orgId, userId: session.userId });

    return json({ jobId: job.id, status: job.status }, 202);
  } catch (error) {
    return errorResponse(error);
  }
}

/** List recent jobs for the active tenant. */
export async function GET() {
  try {
    const session = await requireSession();
    const jobs = await prisma.agentJob.findMany({
      where: { orgId: session.orgId },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        prompt: true,
        status: true,
        createdAt: true,
        finishedAt: true,
      },
    });
    return json({ jobs });
  } catch (error) {
    return errorResponse(error);
  }
}
