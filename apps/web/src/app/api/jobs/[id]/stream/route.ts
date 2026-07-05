import { type NextRequest } from 'next/server';
import { prisma } from '@nexus/db';
import { createRedisClient, jobChannel, STREAM_DONE } from '@nexus/shared';
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
    select: { id: true, status: true, plan: true, result: true, error: true },
  });
  if (!job) {
    return new Response('Not found', { status: 404 });
  }

  const channel = jobChannel(jobId);
  const subscriber = createRedisClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: string) => controller.enqueue(encoder.encode(`data: ${data}\n\n`));

      // Initial snapshot for late joiners.
      send(JSON.stringify({ type: 'snapshot', jobId, ...job }));

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
