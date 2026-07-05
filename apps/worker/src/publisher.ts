import {
  createRedisClient,
  jobChannel,
  STREAM_DONE,
  type ProgressEvent,
} from '@nexus/shared';
import { audit } from './audit.js';

/**
 * Publishes progress events to a per-job Redis channel (relayed to clients via
 * SSE) and mirrors meaningful events into the durable audit log.
 *
 * A single shared publisher Redis connection is reused across jobs.
 */

const pub = createRedisClient();

/** Event types worth persisting to the audit trail. */
const AUDITED = new Set<ProgressEvent['type']>([
  'plan',
  'tool_call',
  'tool_result',
  'awaiting_approval',
  'completed',
  'error',
]);

export function makePublisher(jobId: string, orgId: string) {
  const channel = jobChannel(jobId);

  return async function publish(event: ProgressEvent): Promise<void> {
    await pub.publish(channel, JSON.stringify(event));
    if (AUDITED.has(event.type)) {
      await audit({ orgId, jobId, actor: 'agent', action: event.type, payload: event });
    }
  };
}

/** Tell SSE subscribers the stream is finished for this job. */
export async function publishStreamDone(jobId: string): Promise<void> {
  await pub.publish(jobChannel(jobId), STREAM_DONE);
}

export async function closePublisher(): Promise<void> {
  await pub.quit();
}
