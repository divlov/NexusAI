import { prisma } from '@nexus/db';
import { decrypt, encrypt, type IntegrationProvider } from '@nexus/shared';
import type { OAuthTokens, RefreshedTokens } from './oauth.js';

/**
 * The single choke point for reading/writing OAuth credentials. All encryption
 * and decryption happens here (reusing `@nexus/shared` crypto) — tokens never
 * leave this module in plaintext except through the typed getters below.
 */

export interface StoredCredential {
  provider: IntegrationProvider;
  externalAccount: string;
  accessToken: string;
  refreshToken: string | null;
  scope: string | null;
  expiresAt: Date | null;
}

export interface AccountSummary {
  provider: IntegrationProvider;
  externalAccount: string;
  connectedAt: Date;
}

/** Create or update the org's credential for a provider (encrypts on write). */
export async function upsertAccount(
  orgId: string,
  provider: IntegrationProvider,
  tokens: OAuthTokens,
): Promise<void> {
  await prisma.oAuthAccount.upsert({
    where: {
      orgId_provider_externalAccount: {
        orgId,
        provider,
        externalAccount: tokens.externalAccount,
      },
    },
    create: {
      orgId,
      provider,
      externalAccount: tokens.externalAccount,
      accessTokenEnc: encrypt(tokens.accessToken),
      refreshTokenEnc: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      scope: tokens.scope ?? null,
      expiresAt: tokens.expiresAt ?? null,
    },
    update: {
      accessTokenEnc: encrypt(tokens.accessToken),
      // Only overwrite the refresh token when a new one is issued.
      ...(tokens.refreshToken ? { refreshTokenEnc: encrypt(tokens.refreshToken) } : {}),
      scope: tokens.scope ?? undefined,
      expiresAt: tokens.expiresAt ?? null,
    },
  });
}

/** Persist a token refresh, keeping the existing refresh token if none returned. */
export async function persistRefresh(
  orgId: string,
  provider: IntegrationProvider,
  externalAccount: string,
  refreshed: RefreshedTokens,
): Promise<void> {
  await prisma.oAuthAccount.update({
    where: { orgId_provider_externalAccount: { orgId, provider, externalAccount } },
    data: {
      accessTokenEnc: encrypt(refreshed.accessToken),
      ...(refreshed.refreshToken ? { refreshTokenEnc: encrypt(refreshed.refreshToken) } : {}),
      scope: refreshed.scope ?? undefined,
      expiresAt: refreshed.expiresAt ?? null,
    },
  });
}

/** Fetch + decrypt the org's most recent credential for a provider. */
export async function getAccount(
  orgId: string,
  provider: IntegrationProvider,
): Promise<StoredCredential | null> {
  const row = await prisma.oAuthAccount.findFirst({
    where: { orgId, provider },
    orderBy: { updatedAt: 'desc' },
  });
  if (!row) return null;
  return {
    provider: row.provider as IntegrationProvider,
    externalAccount: row.externalAccount,
    accessToken: decrypt(row.accessTokenEnc),
    refreshToken: row.refreshTokenEnc ? decrypt(row.refreshTokenEnc) : null,
    scope: row.scope,
    expiresAt: row.expiresAt,
  };
}

/** List connected providers for an org — status only, never token material. */
export async function listAccounts(orgId: string): Promise<AccountSummary[]> {
  const rows = await prisma.oAuthAccount.findMany({
    where: { orgId },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((r) => ({
    provider: r.provider as IntegrationProvider,
    externalAccount: r.externalAccount,
    connectedAt: r.createdAt,
  }));
}

/** Disconnect a provider for an org. */
export async function deleteAccount(
  orgId: string,
  provider: IntegrationProvider,
): Promise<void> {
  await prisma.oAuthAccount.deleteMany({ where: { orgId, provider } });
}
