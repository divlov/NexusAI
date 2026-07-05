import { Worker, type Job } from 'bullmq';
import {
  agentJobPayloadSchema,
  getServerEnv,
  JOB_NAMES,
  QUEUE_NAMES,
  redisConnectionOptions,
  resumeJobPayloadSchema,
} from '@nexus/shared';
import { logger } from './logger.js';
import { closePublisher } from './publisher.js';
import { handleResumeTask, handleRunTask, markJobFailed } from './processor.js';

// Fail fast on a bad environment before connecting to anything.
const env = getServerEnv();
logger.info('Worker starting', { mode: env.NEXT_PUBLIC_IS_DEMO_MODE ? 'demo' : 'gemini' });

async function processJob(job: Job): Promise<void> {
  switch (job.name) {
    case JOB_NAMES.RUN_TASK:
      await handleRunTask(agentJobPayloadSchema.parse(job.data));
      return;
    case JOB_NAMES.RESUME_TASK:
      await handleResumeTask(resumeJobPayloadSchema.parse(job.data));
      return;
    default:
      throw new Error(`Unknown job name: ${job.name}`);
  }
}

const worker = new Worker(QUEUE_NAMES.AGENT_TASKS, processJob, {
  connection: redisConnectionOptions(),
  concurrency: 5,
});

worker.on('completed', (job) => {
  logger.info('job completed', { id: job.id, name: job.name });
});

worker.on('failed', async (job, err) => {
  logger.error('job failed', { id: job?.id, name: job?.name, error: err.message });
  if (!job) return;

  const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
  if (exhausted) {
    // Surface a terminal failure to the DB + SSE stream.
    const data = job.data as { jobId?: string; orgId?: string };
    if (data.jobId && data.orgId) {
      await markJobFailed(data.jobId, data.orgId, err.message);
    }
  }
});

async function shutdown(signal: string): Promise<void> {
  logger.info('shutting down', { signal });
  await worker.close();
  await closePublisher();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

logger.info('Worker ready', { queue: QUEUE_NAMES.AGENT_TASKS });
