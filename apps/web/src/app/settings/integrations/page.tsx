import { redirect } from 'next/navigation';
import { ArrowRight, CircleAlert, CircleCheck, Shield, Webhook } from 'lucide-react';
import { IS_DEMO_MODE } from '@nexus/shared';
import { getSession } from '@/lib/auth/session';
import { listIntegrations } from '@/lib/integrations/service';
import { IntegrationCard } from '../../_components/IntegrationCard';
import { TopNav } from '../../_components/TopNav';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const integrations = await listIntegrations(session.orgId);
  const sp = await searchParams;
  const connected = typeof sp.connected === 'string' ? sp.connected : null;
  const error = typeof sp.error === 'string' ? sp.error : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-page">
      <TopNav />
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Connect your operational stack to Nexus for seamless agent execution and data flow.
            </p>
          </div>

          {IS_DEMO_MODE && (
            <p className="mb-6 rounded-md bg-warn px-3 py-2 text-sm text-warn-foreground">
              Demo mode is on — connections are simulated and no external accounts are modified.
            </p>
          )}
          {connected && (
            <div className="mb-6 flex items-center gap-2 rounded-md border border-success-foreground/40 bg-success px-4 py-3 text-sm text-success-foreground">
              <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              Connected <strong>{connected}</strong> successfully.
            </div>
          )}
          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-md border border-error-foreground/40 bg-error px-4 py-3 text-sm text-error-foreground">
              <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              Connection failed: <code className="font-mono">{error}</code>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {integrations.map((integration) => (
              <IntegrationCard
                key={integration.provider}
                integration={integration}
                isDemo={IS_DEMO_MODE}
              />
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-6">
              <div className="mb-3 flex items-center gap-3">
                <Shield className="h-5 w-5 text-accent" aria-hidden="true" />
                <h4 className="text-base font-semibold">Data Privacy &amp; Security</h4>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Nexus uses OAuth 2.0 for all integrations. We never store your passwords and only
                request the minimum permissions required for your agents to perform their assigned
                tasks. OAuth tokens are encrypted at rest with AES-256-GCM.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-6">
              <div className="mb-3 flex items-center gap-3">
                <Webhook className="h-5 w-5 text-accent" aria-hidden="true" />
                <h4 className="text-base font-semibold">Webhooks &amp; API</h4>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Looking to build a custom integration? Use our REST API and webhook system to
                connect your proprietary internal tools directly to the Nexus orchestration engine.
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                View API docs
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
