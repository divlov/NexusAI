import { z } from 'zod';
import type { ConnectorConfig } from './providers.js';

/**
 * Pure OAuth token-exchange helpers. No DB, no crypto — callers persist via
 * `store.ts`. Slack's `oauth.v2.access` returns a bot token at top level plus a
 * `team` object and never a refresh token (bot tokens don't expire). The generic
 * OAuth2 refresh path is scaffolded for Google/Atlassian (not exercised by Slack).
 */

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  scope?: string;
  expiresAt?: Date;
  externalAccount: string;
}

export interface RefreshedTokens {
  accessToken: string;
  refreshToken?: string;
  scope?: string;
  expiresAt?: Date;
}

function expiresAtFrom(expiresIn: number | undefined): Date | undefined {
  return expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined;
}

const slackTokenResponse = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  access_token: z.string().optional(),
  scope: z.string().optional(),
  team: z.object({ id: z.string(), name: z.string().optional() }).optional(),
});

const oauth2TokenResponse = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
  expires_in: z.number().optional(),
});

async function postForm(url: string, params: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(params),
  });
  if (!res.ok) throw new Error(`OAuth token endpoint HTTP ${res.status}`);
  return res.json();
}

/** Exchange an authorization code for tokens. */
export async function exchangeCode(
  connector: ConnectorConfig,
  code: string,
  redirectUri: string,
): Promise<OAuthTokens> {
  const raw = await postForm(connector.tokenUrl, {
    client_id: connector.clientId(),
    client_secret: connector.clientSecret(),
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  if (connector.id === 'slack') {
    const parsed = slackTokenResponse.parse(raw);
    if (!parsed.ok || !parsed.access_token || !parsed.team) {
      throw new Error(`Slack OAuth failed: ${parsed.error ?? 'missing token/team'}`);
    }
    return {
      accessToken: parsed.access_token,
      scope: parsed.scope,
      externalAccount: parsed.team.id,
    };
  }

  // Generic OAuth2 (Google/Atlassian). externalAccount is derived by the caller
  // (e.g. Atlassian accessible-resources → cloudId) and merged in afterwards.
  const parsed = oauth2TokenResponse.parse(raw);
  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token,
    scope: parsed.scope,
    expiresAt: expiresAtFrom(parsed.expires_in),
    externalAccount: '',
  };
}

/** Refresh an expired access token (standard OAuth2; Google/Atlassian). */
export async function refreshTokens(
  connector: ConnectorConfig,
  refreshToken: string,
): Promise<RefreshedTokens> {
  const raw = await postForm(connector.tokenUrl, {
    client_id: connector.clientId(),
    client_secret: connector.clientSecret(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const parsed = oauth2TokenResponse.parse(raw);
  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token, // may be absent; caller keeps the old one
    scope: parsed.scope,
    expiresAt: expiresAtFrom(parsed.expires_in),
  };
}
