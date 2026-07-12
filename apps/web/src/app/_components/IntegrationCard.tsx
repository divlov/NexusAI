'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@nexus/ui';
import type { IntegrationStatus } from '@/lib/integrations/service';

/**
 * One connector row: status badge + connect/disconnect action. Connect is a
 * full-page navigation to the OAuth initiate route; disconnect calls the DELETE
 * API and refreshes. In demo mode, connecting is disabled.
 */
export function IntegrationCard({
  integration,
  isDemo,
}: {
  integration: IntegrationStatus;
  isDemo: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const { provider, label, connector, available, connected, externalAccount } = integration;

  async function disconnect() {
    setBusy(true);
    try {
      await fetch(`/api/integrations/${provider}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{label}</CardTitle>
        {isDemo ? (
          <Badge tone="warn">Demo</Badge>
        ) : !available ? (
          <Badge tone="neutral">Coming soon</Badge>
        ) : connected ? (
          <Badge tone="success">Connected</Badge>
        ) : (
          <Badge tone="neutral">Not connected</Badge>
        )}
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {connected && externalAccount
            ? `Workspace ${externalAccount}`
            : available
              ? 'Connect to let the agent act on your behalf.'
              : 'Not available yet.'}
        </p>

        {available &&
          (connected ? (
            <Button variant="outline" size="sm" onClick={disconnect} disabled={busy || isDemo}>
              {busy ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          ) : isDemo ? (
            <Button variant="outline" size="sm" disabled>
              Connect
            </Button>
          ) : (
            <a
              href={`/api/oauth/${connector}`}
              className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-medium transition hover:bg-muted"
            >
              Connect
            </a>
          ))}
      </CardContent>
    </Card>
  );
}
