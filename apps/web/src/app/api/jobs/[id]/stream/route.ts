import { type NextRequest } from 'next/server';
import { prisma } from '@nexus/db';
import {
  ApprovalStatus,
  createRedisClient,
  jobChannel,
  JobStatus,
  STREAM_DONE,
  type ToolCall,
  type ToolResult,
} from '@nexus/shared';
import { requireSession } from '@/lib/auth/session';

export const runtime = 'nodejs';
// Disable buffering so events flush immediately.
export const dynamic = 'force-dynamic';

/**
 * Server-Sent Events stream of a job's progress.
 *
 * On connect we emit a `snapshot` (current DB state) so late subscribers catch
 * up, then relay live ProgressEvents from the job's Redis pub/sub channel until
 * the worker publishes the STREAM_DONE sentinel.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id: jobId } = await params;

  const job = await prisma.agentJob.findFirst({
    where: { id: jobId, orgId: session.orgId },
    select: { id: true, status: true, plan: true, result: true, error: true, checkpoint: true },
  });
  if (!job) {
    return new Response('Not found', { status: 404 });
  }

  // The checkpoint (serialized graph state) holds the executed tool results and
  // final summary — the pieces needed to reconstruct a finished run's timeline,
  // since live progress events are ephemeral (Redis pub/sub).
  const checkpoint = job.checkpoint as
    | { results?: ToolResult[]; finalSummary?: string | null; pending?: { call?: ToolCall } }
    | null;

  // For a paused run, surface the pending approval so a reloaded/late viewer can
  // still act on it (the live awaiting_approval event is long gone).
  let pending: { approvalId: string; call: ToolCall } | null = null;
  if (job.status === JobStatus.AWAITING_APPROVAL && checkpoint?.pending?.call) {
    const approval = await prisma.approval.findFirst({
      where: { jobId, orgId: session.orgId, status: ApprovalStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (approval) pending = { approvalId: approval.id, call: checkpoint.pending.call };
  }

  const snapshot = {
    type: 'snapshot' as const,
    jobId,
    status: job.status,
    plan: job.plan,
    error: job.error,
    results: checkpoint?.results ?? [],
    finalSummary: checkpoint?.finalSummary ?? null,
    pending,
  };

  const channel = jobChannel(jobId);
  const subscriber = createRedisClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: string) => controller.enqueue(encoder.encode(`data: ${data}\n\n`));

      // Initial snapshot for late joiners / historical runs.
      send(JSON.stringify(snapshot));

      subscriber.on('message', (_chan, message) => {
        if (message === STREAM_DONE) {
          send(JSON.stringify({ type: 'done', jobId }));
          controller.close();
          void subscriber.quit();
          return;
        }
        send(message);
      });

      await subscriber.subscribe(channel);
    },
    async cancel() {
      await subscriber.unsubscribe(channel).catch(() => undefined);
      await subscriber.quit().catch(() => undefined);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
