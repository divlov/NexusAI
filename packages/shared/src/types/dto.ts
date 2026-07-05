import { z } from 'zod';
import { ApprovalStatus } from './domain.js';

/**
 * Zod schemas for all external input crossing a trust boundary (API bodies,
 * queue payloads). The inferred types are the canonical DTOs used app-wide.
 */

export const createTaskSchema = z.object({
  prompt: z
    .string()
    .min(8, 'Describe the task in at least a few words.')
    .max(2000),
});
export type CreateTaskDTO = z.infer<typeof createTaskSchema>;

export const approvalDecisionSchema = z.object({
  decision: z.enum([ApprovalStatus.APPROVED, ApprovalStatus.REJECTED]),
  note: z.string().max(500).optional(),
});
export type ApprovalDecisionDTO = z.infer<typeof approvalDecisionSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
  organizationName: z.string().min(2).max(80),
});
export type RegisterDTO = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDTO = z.infer<typeof loginSchema>;

/** Payload enqueued onto BullMQ for the worker to process. */
export const agentJobPayloadSchema = z.object({
  jobId: z.string(),
  orgId: z.string(),
  userId: z.string(),
});
export type AgentJobPayload = z.infer<typeof agentJobPayloadSchema>;

/** Payload for resuming a paused job after an approval decision. */
export const resumeJobPayloadSchema = z.object({
  jobId: z.string(),
  orgId: z.string(),
  approvalId: z.string(),
  approved: z.boolean(),
});
export type ResumeJobPayload = z.infer<typeof resumeJobPayloadSchema>;
