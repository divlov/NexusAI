import {
  createAgentRuntime,
  initialState,
  runAgentGraph,
  type AgentStateShape,
} from '@nexus/ai';
import { prisma, Prisma } from '@nexus/db';
import { buildCredentialResolver } from '@nexus/connectors';
import {
  IS_DEMO_MODE,
  JobStatus,
  type AgentJobPayload,
  type ResumeJobPayload,
} from '@nexus/shared';
import type { ToolContext } from '@nexus/ai';
import { audit } from './audit.js';
import { logger } from './logger.js';
import { makePublisher, publishStreamDone } from './publisher.js';

/**
 * Job processing. Two job names share one queue:
 *  - run-task    : fresh agent run (plan → execute loop, may pause).
 *  - resume-task : continue a paused run after an approval decision.
 */

function asJson(state: AgentStateShape): Prisma.InputJsonValue {
  return state as unknown as Prisma.InputJsonValue;
}

/**
 * Build the per-job tenant context that real tool execution needs. Undefined in
 * demo mode (DemoRuntime never touches it). Rebuilt fresh on every run/resume —
 * never persisted in the checkpoint.
 */
function toolContext(
  orgId: string,
  userId: string,
  timezone: string | null,
): ToolContext | undefined {
  if (IS_DEMO_MODE) return undefined;
  return { orgId, userId, timezone: timezone ?? undefined, getCredential: buildCredentialResolver(orgId) };
}

/**
 * Persist the graph's final state. If the run paused for approval, create the
 * Approval row, store the checkpoint, and emit `awaiting_approval`. Otherwise
 * mark the job COMPLETED. The SSE stream is closed for terminal outcomes only.
 */
async function persistFinalState(
  jobId: string,
  orgId: string,
  publish: ReturnType<typeof makePublisher>,
  state: AgentStateShape,
): Promise<void> {
  if (state.status === 'awaiting_approval' && state.pending) {
    const approval = await prisma.approval.create({
      data: {
        orgId,
        jobId,
        toolCall: state.pending.call as unknown as Prisma.InputJsonValue,
      },
    });

    await prisma.agentJob.update({
      where: { id: jobId },
      data: { status: JobStatus.AWAITING_APPROVAL, checkpoint: asJson(state) },
    });

    await publish({
      type: 'awaiting_approval',
      jobId,
      approvalId: approval.id,
      call: state.pending.call,
      at: new Date().toISOString(),
    });
    // Intentionally NOT closing the stream: the client keeps the SSE open to
    // receive resume events after the approval decision.
    return;
  }

  await prisma.agentJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.COMPLETED,
      result: {
        summary: state.finalSummary,
        results: state.results,
      } as unknown as Prisma.InputJsonValue,
      checkpoint: asJson(state),
      finishedAt: new Date(),
    },
  });
  await publish({
    type: 'status',
    jobId,
    status: JobStatus.COMPLETED,
    at: new Date().toISOString(),
  });
  await publishStreamDone(jobId);
}

export async function handleRunTask(payload: AgentJobPayload): Promise<void> {
  const { jobId, orgId, userId } = payload;
  const publish = makePublisher(jobId, orgId);

  const job = await prisma.agentJob.findFirst({ where: { id: jobId, orgId } });
  if (!job) throw new Error(`AgentJob ${jobId} not found for org ${orgId}`);

  await prisma.agentJob.update({
    where: { id: jobId },
    data: { status: JobStatus.PLANNING, startedAt: new Date() },
  });

  const runtime = createAgentRuntime(toolContext(orgId, userId, job.timezone));
  await audit({ orgId, jobId, actor: 'system', action: 'job.started', payload: { mode: runtime.mode } });

  const finalState = await runAgentGraph(
    { jobId, runtime, publish },
    initialState(job.prompt),
  );

  if (finalState.plan) {
    await prisma.agentJob.update({
      where: { id: jobId },
      data: { plan: finalState.plan as unknown as Prisma.InputJsonValue },
    });
  }

  await persistFinalState(jobId, orgId, publish, finalState);
  logger.info('run-task finished', { jobId, status: finalState.status });
}

export async function handleResumeTask(payload: ResumeJobPayload): Promise<void> {
  const { jobId, orgId, approvalId, approved } = payload;
  const publish = makePublisher(jobId, orgId);

  const job = await prisma.agentJob.findFirst({ where: { id: jobId, orgId } });
  if (!job?.checkpoint) throw new Error(`No checkpoint to resume for job ${jobId}`);

  // userId isn't on the resume payload; take it from the job row. Context is
  // rebuilt here, never read from the (graph-only) checkpoint.
  const ctx = toolContext(orgId, job.createdByUserId, job.timezone);
  const state = job.checkpoint as unknown as AgentStateShape;
  const pendingIndex = state.pending?.step.index ?? state.cursor;

  // Record the human decision into the state, then clear the pause.
  if (approved) {
    state.approvedSteps = [...new Set([...state.approvedSteps, pendingIndex])];
  } else {
    state.rejectedSteps = [...new Set([...state.rejectedSteps, pendingIndex])];
  }
  state.pending = null;
  state.status = 'running';

  await prisma.agentJob.update({
    where: { id: jobId },
    data: { status: JobStatus.RESUMING },
  });
  await audit({
    orgId,
    jobId,
    actor: 'system',
    action: 'job.resumed',
    payload: { approvalId, approved, stepIndex: pendingIndex },
  });

  const runtime = createAgentRuntime(ctx);
  const finalState = await runAgentGraph({ jobId, runtime, publish }, state);

  await persistFinalState(jobId, orgId, publish, finalState);
  logger.info('resume-task finished', { jobId, status: finalState.status });
}

/** Mark a job failed and surface the error on the stream. Used by the worker's error path. */
export async function markJobFailed(
  jobId: string,
  orgId: string,
  message: string,
): Promise<void> {
  // updateMany (not update): its where clause isn't required to be unique, so
  // this stays tenant-scoped — a mismatched orgId just updates zero rows
  // instead of writing to a job that isn't this org's.
  await prisma.agentJob
    .updateMany({
      where: { id: jobId, orgId },
      data: { status: JobStatus.FAILED, error: message, finishedAt: new Date() },
    })
    .catch(() => undefined);
  const publish = makePublisher(jobId, orgId);
  await publish({ type: 'error', jobId, message, at: new Date().toISOString() });
  await publishStreamDone(jobId);
}
