import type { IntegrationProvider } from '@nexus/shared';
import { connectorForProvider } from './providers.js';
import { refreshTokens } from './oauth.js';
import { getAccount, persistRefresh } from './store.js';
import { withRefreshLock } from './lock.js';

/**
 * A credential resolved for a real API call. Structurally matches
 * `ToolContext['getCredential']`'s return in `@nexus/ai`, so the worker can wire
 * `buildCredentialResolver(orgId)` straight into the ToolContext without
 * `@nexus/connectors` depending on `@nexus/ai`.
 */
export interface ResolvedCredential {
  accessToken: string;
  externalAccount: string;
}

/** Treat a token as expiring within a 60s skew buffer. Null expiry = never. */
function isExpiring(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() - Date.now() < 60_000;
}

/**
 * Build the per-org credential resolver injected into the agent runtime. Returns
 * a decrypted, non-expired access token for a provider, refreshing under a Redis
 * lock when needed. Slack tokens never expire, so they skip the refresh path.
 */
export function buildCredentialResolver(orgId: string) {
  return async (provider: IntegrationProvider): Promise<ResolvedCredential> => {
    const acct = await getAccount(orgId, provider);
    if (!acct) {
      throw new Error(
        `No ${provider} connection for this organization. ` +
          'Connect it under Settings → Integrations.',
      );
    }

    if (!isExpiring(acct.expiresAt)) {
      return { accessToken: acct.accessToken, externalAccount: acct.externalAccount };
    }

    if (!acct.refreshToken) {
      throw new Error(
        `${provider} access token has expired and no refresh token is stored. ` +
          'Reconnect the provider under Settings → Integrations.',
      );
    }

    return withRefreshLock(orgId, provider, async () => {
      // Re-read inside the lock: another job may have refreshed already.
      const fresh = await getAccount(orgId, provider);
      if (fresh && !isExpiring(fresh.expiresAt)) {
        return { accessToken: fresh.accessToken, externalAccount: fresh.externalAccount };
      }
      const current = fresh ?? acct;
      const refreshed = await refreshTokens(connectorForProvider(provider), current.refreshToken!);
      await persistRefresh(orgId, provider, current.externalAccount, refreshed);
      return { accessToken: refreshed.accessToken, externalAccount: current.externalAccount };
    });
  };
}
