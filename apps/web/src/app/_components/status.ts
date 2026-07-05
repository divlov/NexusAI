import type { BadgeTone } from '@nexus/ui';
// Import from the narrow subpath: the barrel pulls ioredis into the client bundle.
import { JobStatus } from '@nexus/shared/types';

/** Map a job status to a badge tone for consistent UI signalling. */
export function statusTone(status: string): BadgeTone {
  switch (status) {
    case JobStatus.COMPLETED:
      return 'success';
    case JobStatus.FAILED:
      return 'error';
    case JobStatus.AWAITING_APPROVAL:
      return 'warn';
    case JobStatus.PENDING:
      return 'neutral';
    default:
      return 'info';
  }
}
