import 'server-only';
import { Queue } from 'bullmq';
import {
  DEFAULT_JOB_OPTS,
  JOB_NAMES,
  QUEUE_NAMES,
  redisConnectionOptions,
  type AgentJobPayload,
  type ResumeJobPayload,
} from '@nexus/shared';

/**
 * BullMQ producer. The web app's ONLY interaction with execution: enqueue jobs.
 * It never imports @nexus/ai or runs agent logic (per the queue-first rules).
 *
 * The Queue is cached on globalThis to avoid creating duplicate Redis
 * connections across Next.js hot reloads.
 */

const globalForQueue = globalThis as unknown as { agentQueue?: Queue };

function getQueue(): Queue {
  if (!globalForQueue.agentQueue) {
    globalForQueue.agentQueue = new Queue(QUEUE_NAMES.AGENT_TASKS, {
      connection: redisConnectionOptions(),
      defaultJobOptions: DEFAULT_JOB_OPTS,
    });
  }
  return globalForQueue.agentQueue;
}

export async function enqueueRunTask(payload: AgentJobPayload): Promise<void> {
  // jobId keys the BullMQ job for idempotency — re-enqueuing the same agent job
  // won't create duplicates.
  await getQueue().add(JOB_NAMES.RUN_TASK, payload, { jobId: `run_${payload.jobId}` });
}

export async function enqueueResumeTask(payload: ResumeJobPayload): Promise<void> {
  await getQueue().add(JOB_NAMES.RESUME_TASK, payload, {
    jobId: `resume_${payload.jobId}_${payload.approvalId}`,
  });
}
