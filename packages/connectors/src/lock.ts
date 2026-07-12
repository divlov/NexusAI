import { createRedisClient } from '@nexus/shared';
import type { IntegrationProvider } from '@nexus/shared';

/**
 * Redis mutex serializing token refresh per (org, provider). Without it,
 * concurrent jobs could double-refresh and — for providers that rotate refresh
 * tokens (Atlassian) — invalidate each other's grant. Only exercised by
 * expiring providers (Google/Jira); Slack bot tokens never hit this path.
 */

const LOCK_TTL_MS = 10_000;
const ACQUIRE_TIMEOUT_MS = 8_000;
const RETRY_DELAY_MS = 100;

// Lazily created, reused across calls (a lock needs its own connection).
let client: ReturnType<typeof createRedisClient> | null = null;
function lockClient() {
  if (!client) client = createRedisClient();
  return client;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function withRefreshLock<T>(
  orgId: string,
  provider: IntegrationProvider,
  fn: () => Promise<T>,
): Promise<T> {
  const redis = lockClient();
  const key = `oauth-refresh-lock:${orgId}:${provider}`;
  // Unique per-holder token so we only release a lock we still own.
  const token = `${orgId}:${provider}:${process.pid}:${Date.now()}`;

  const deadline = Date.now() + ACQUIRE_TIMEOUT_MS;
  let acquired = false;
  while (Date.now() < deadline) {
    const res = await redis.set(key, token, 'PX', LOCK_TTL_MS, 'NX');
    if (res === 'OK') {
      acquired = true;
      break;
    }
    await sleep(RETRY_DELAY_MS);
  }
  if (!acquired) {
    throw new Error(`Timed out acquiring refresh lock for ${provider}.`);
  }

  try {
    return await fn();
  } finally {
    // Release only if we still hold it (compare-and-delete).
    const current = await redis.get(key);
    if (current === token) await redis.del(key);
  }
}
