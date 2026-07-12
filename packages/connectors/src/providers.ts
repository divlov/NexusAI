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

/** Configured connectors, keyed by id. Add `google`/`atlassian` here later. */
const CONNECTORS: Partial<Record<ConnectorId, ConnectorConfig>> = { slack };

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
