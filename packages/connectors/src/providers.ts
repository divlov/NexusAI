import { getServerEnv, IntegrationProvider } from '@nexus/shared';

/**
 * Connector registry. A *connector* is a single OAuth app (Slack, Google,
 * Atlassian). One connector can back several `IntegrationProvider`s — e.g. the
 * Google app covers both GMAIL and GOOGLE_CALENDAR.
 *
 * Only Slack is wired today; Google/Atlassian are mapped in
 * CONNECTOR_FOR_PROVIDER but have no config yet (their getters throw until added).
 */

export type ConnectorId = 'slack' | 'google' | 'atlassian';

export interface ConnectorConfig {
  id: ConnectorId;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** How to join scopes in the authorize URL (Slack ','; OAuth2 ' '). */
  scopeSeparator: string;
  /** Extra authorize-URL params (e.g. Google's access_type=offline). */
  authorizeExtras?: Record<string, string>;
  providers: IntegrationProvider[];
  clientId: () => string;
  clientSecret: () => string;
  /**
   * Optional: derive the `externalAccount` handle after token exchange when the
   * token response doesn't include one (Slack returns team.id inline; Google
   * needs a userinfo call for the email). Given the fresh access token.
   */
  fetchExternalAccount?: (accessToken: string) => Promise<string>;
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to your environment to enable this connector.`,
    );
  }
  return value;
}

const slack: ConnectorConfig = {
  id: 'slack',
  authorizeUrl: 'https://slack.com/oauth/v2/authorize',
  tokenUrl: 'https://slack.com/api/oauth.v2.access',
  // Subset of the installed app's scopes — just what the two Slack tools need.
  scopes: ['chat:write', 'channels:read', 'channels:history'],
  scopeSeparator: ',',
  providers: [IntegrationProvider.SLACK],
  clientId: () => requireEnv('SLACK_CLIENT_ID', getServerEnv().SLACK_CLIENT_ID),
  clientSecret: () => requireEnv('SLACK_CLIENT_SECRET', getServerEnv().SLACK_CLIENT_SECRET),
};

/** Resolve the Google account email via the OpenID userinfo endpoint. */
async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google userinfo HTTP ${res.status}`);
  const data = (await res.json()) as { email?: string; sub?: string };
  return data.email ?? data.sub ?? 'google-account';
}

const google: ConnectorConfig = {
  id: 'google',
  authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: [
    'openid',
    'email',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.events',
  ],
  scopeSeparator: ' ',
  // response_type is required by Google; offline + consent guarantee a refresh token.
  authorizeExtras: {
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  },
  providers: [IntegrationProvider.GMAIL, IntegrationProvider.GOOGLE_CALENDAR],
  clientId: () => requireEnv('GOOGLE_OAUTH_CLIENT_ID', getServerEnv().GOOGLE_OAUTH_CLIENT_ID),
  clientSecret: () =>
    requireEnv('GOOGLE_OAUTH_CLIENT_SECRET', getServerEnv().GOOGLE_OAUTH_CLIENT_SECRET),
  fetchExternalAccount: fetchGoogleEmail,
};

/**
 * Resolve the Jira Cloud site id ("cloudId") this grant covers, via the
 * accessible-resources endpoint. Needed for every Jira REST call
 * (api.atlassian.com/ex/jira/{cloudId}/...) — Atlassian's token response
 * carries no site identifier of its own.
 */
async function fetchAtlassianCloudId(accessToken: string): Promise<string> {
  const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Atlassian accessible-resources HTTP ${res.status}`);
  const sites = (await res.json()) as { id: string; url?: string }[];
  if (!sites[0]) throw new Error('No accessible Atlassian site for this account.');
  return sites[0].id;
}

const atlassian: ConnectorConfig = {
  id: 'atlassian',
  authorizeUrl: 'https://auth.atlassian.com/authorize',
  tokenUrl: 'https://auth.atlassian.com/oauth/token',
  scopes: ['read:jira-work', 'write:jira-work', 'offline_access'],
  scopeSeparator: ' ',
  // audience selects the Atlassian Cloud REST APIs; prompt=consent guarantees a
  // refresh token (Atlassian access tokens expire in ~1 hour and always rotate
  // the refresh token on use — the first connector to actually exercise that path).
  authorizeExtras: {
    response_type: 'code',
    audience: 'api.atlassian.com',
    prompt: 'consent',
  },
  providers: [IntegrationProvider.JIRA],
  clientId: () => requireEnv('ATLASSIAN_CLIENT_ID', getServerEnv().ATLASSIAN_CLIENT_ID),
  clientSecret: () =>
    requireEnv('ATLASSIAN_CLIENT_SECRET', getServerEnv().ATLASSIAN_CLIENT_SECRET),
  fetchExternalAccount: fetchAtlassianCloudId,
};

/** Configured connectors, keyed by id. */
const CONNECTORS: Partial<Record<ConnectorId, ConnectorConfig>> = { slack, google, atlassian };

/** Which connector app backs a given integration provider. */
export const CONNECTOR_FOR_PROVIDER: Record<IntegrationProvider, ConnectorId> = {
  SLACK: 'slack',
  GMAIL: 'google',
  GOOGLE_CALENDAR: 'google',
  JIRA: 'atlassian',
};

export function getConnector(id: string): ConnectorConfig {
  const connector = CONNECTORS[id as ConnectorId];
  if (!connector) {
    throw new Error(`Unknown or not-yet-configured connector: "${id}".`);
  }
  return connector;
}

export function connectorForProvider(provider: IntegrationProvider): ConnectorConfig {
  return getConnector(CONNECTOR_FOR_PROVIDER[provider]);
}
