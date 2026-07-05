/** Queue + channel naming. Queue names are kebab-case per the rules. */

export const QUEUE_NAMES = {
  AGENT_TASKS: 'agent-tasks',
} as const;
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** Named jobs within the agent-tasks queue. */
export const JOB_NAMES = {
  RUN_TASK: 'run-task',
  RESUME_TASK: 'resume-task',
} as const;
export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

/** Redis pub/sub channel carrying a job's progress events (consumed by SSE). */
export function jobChannel(jobId: string): string {
  return `nexus:job:${jobId}:events`;
}

/** Sentinel published on the channel to tell SSE subscribers the stream ended. */
export const STREAM_DONE = '__stream_done__';

/** Default BullMQ job options applied by the producer. */
export const DEFAULT_JOB_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 24 * 3600 },
} as const;
