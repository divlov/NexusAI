import Link from 'next/link';
import { redirect } from 'next/navigation';
import { IS_DEMO_MODE } from '@nexus/shared';
import { Badge } from '@nexus/ui';
import { getSession } from '@/lib/auth/session';
import { listIntegrations } from '@/lib/integrations/service';
import { IntegrationCard } from '../../_components/IntegrationCard';

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
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Connect the tools the agent can act on.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {IS_DEMO_MODE && <Badge tone="warn">Demo mode</Badge>}
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </header>

      {connected && (
        <div className="mb-6 rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm">
          Connected <strong>{connected}</strong> successfully.
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-md border border-error/40 bg-error/10 px-4 py-3 text-sm">
          Connection failed: <code>{error}</code>
        </div>
      )}

      <div className="grid gap-4">
        {integrations.map((integration) => (
          <IntegrationCard
            key={integration.provider}
            integration={integration}
            isDemo={IS_DEMO_MODE}
          />
        ))}
      </div>
    </div>
  );
}
