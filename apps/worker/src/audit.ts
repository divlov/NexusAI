import { prisma, Prisma } from '@nexus/db';

/** Keys whose values must never reach the audit log. */
const SECRET_KEYS = /token|secret|password|authorization|apikey|api_key/i;

/** Recursively redact secret-looking fields before persisting. */
export function scrub(value: unknown): Prisma.InputJsonValue {
  if (value === null || value === undefined) return null as unknown as Prisma.InputJsonValue;
  if (Array.isArray(value)) return value.map(scrub) as Prisma.InputJsonValue;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEYS.test(k) ? '[REDACTED]' : scrub(v);
    }
    return out as Prisma.InputJsonValue;
  }
  return value as Prisma.InputJsonValue;
}

export async function audit(input: {
  orgId: string;
  jobId?: string;
  actor: string;
  action: string;
  payload?: unknown;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      orgId: input.orgId,
      jobId: input.jobId,
      actor: input.actor,
      action: input.action,
      payload: input.payload === undefined ? undefined : scrub(input.payload),
    },
  });
}
