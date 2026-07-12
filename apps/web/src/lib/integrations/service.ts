import 'server-only';
import { listAccounts } from '@nexus/connectors';
import { IntegrationProvider } from '@nexus/shared';

/**
 * Integrations service — presents the connector catalogue with per-org
 * connection status. Never returns token material (only presence + metadata).
 */

export interface IntegrationStatus {
  provider: IntegrationProvider;
  label: string;
  /** OAuth connector to hit for /api/oauth/<connector>. */
  connector: string;
  /** Whether the connector is wired for real connection yet. */
  available: boolean;
  connected: boolean;
  externalAccount?: string;
  connectedAt?: string;
}

interface CatalogEntry {
  provider: IntegrationProvider;
  label: string;
  connector: string;
  available: boolean;
}

/** The connectors surfaced in the UI. Only Slack is live today. */
const CATALOG: CatalogEntry[] = [
  { provider: IntegrationProvider.SLACK, label: 'Slack', connector: 'slack', available: true },
  { provider: IntegrationProvider.GMAIL, label: 'Gmail', connector: 'google', available: true },
  {
    provider: IntegrationProvider.GOOGLE_CALENDAR,
    label: 'Google Calendar',
    connector: 'google',
    available: true,
  },
  { provider: IntegrationProvider.JIRA, label: 'Jira', connector: 'atlassian', available: false },
];

export async function listIntegrations(orgId: string): Promise<IntegrationStatus[]> {
  const accounts = await listAccounts(orgId);
  const byProvider = new Map(accounts.map((a) => [a.provider, a]));

  return CATALOG.map((entry) => {
    const account = byProvider.get(entry.provider);
    return {
      ...entry,
      connected: Boolean(account),
      externalAccount: account?.externalAccount,
      connectedAt: account?.connectedAt.toISOString(),
    };
  });
}
