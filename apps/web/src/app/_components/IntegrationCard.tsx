'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Hash, Layers, Mail, type LucideIcon } from 'lucide-react';
import { Badge, Button, Card } from '@nexus/ui';
import { IntegrationProvider } from '@nexus/shared/types';
import type { IntegrationStatus } from '@/lib/integrations/service';

const CONNECTOR_BRAND: Record<IntegrationProvider, { Icon: LucideIcon; color: string }> = {
  [IntegrationProvider.SLACK]: { Icon: Hash, color: '#4A154B' },
  [IntegrationProvider.GMAIL]: { Icon: Mail, color: '#EA4335' },
  [IntegrationProvider.GOOGLE_CALENDAR]: { Icon: Calendar, color: '#4285F4' },
  [IntegrationProvider.JIRA]: { Icon: Layers, color: '#0052CC' },
};

/**
 * One connector card: brand tile + status badge + connect/disconnect action.
 * Connect is a full-page navigation to the OAuth initiate route; disconnect
 * calls the DELETE API and refreshes. In demo mode, connecting is disabled.
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
  const brand = CONNECTOR_BRAND[provider];

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
    <Card className="relative flex flex-col overflow-hidden p-5">
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: brand.color, opacity: 0.4 }}
        aria-hidden="true"
      />

      <div className="mb-6 flex items-start justify-between">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-lg border"
          style={{ backgroundColor: `${brand.color}1a`, borderColor: `${brand.color}33` }}
        >
          <brand.Icon className="h-6 w-6" style={{ color: brand.color }} aria-hidden="true" />
        </div>
        {isDemo ? (
          <Badge tone="warn">Demo</Badge>
        ) : !available ? (
          <Badge tone="neutral">Coming soon</Badge>
        ) : connected ? (
          <Badge tone="success">Connected</Badge>
        ) : (
          <Badge tone="neutral">Not connected</Badge>
        )}
      </div>

      <h3 className="mb-1 text-base font-semibold">{label}</h3>
      <p className="mb-6 line-clamp-2 flex-1 text-sm text-muted-foreground">
        {connected && externalAccount
          ? `Workspace ${externalAccount}`
          : available
            ? 'Connect to let the agent act on your behalf.'
            : 'Not available yet.'}
      </p>

      {available &&
        (connected ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={disconnect}
            disabled={busy || isDemo}
          >
            {busy ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        ) : isDemo ? (
          <Button variant="outline" size="sm" className="w-full" disabled>
            Connect
          </Button>
        ) : (
          <a
            href={`/api/oauth/${connector}`}
            className="flex h-8 w-full items-center justify-center rounded-md bg-primary font-label text-xs font-medium text-primary-foreground transition hover:opacity-90"
          >
            Connect
          </a>
        ))}
    </Card>
  );
}
