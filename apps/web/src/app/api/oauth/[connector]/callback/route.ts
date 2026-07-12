import { NextResponse, type NextRequest } from 'next/server';
import { exchangeCode, getConnector, upsertAccount } from '@nexus/connectors';
import { publicEnv } from '@nexus/shared';
import { getSession } from '@/lib/auth/session';
import { verifyOAuthState } from '@/lib/oauth/state';

export const runtime = 'nodejs';

/**
 * OAuth callback. NOT session-gated (the provider redirect need not carry our
 * cookie) — the signed `state` is the trust anchor. We verify state, exchange
 * the code, and persist encrypted tokens, then bounce back to settings. All
 * outcomes redirect (never raw JSON) so the user lands on the Integrations page.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ connector: string }> },
) {
  const { connector } = await params;
  const settings = (query: Record<string, string>) => {
    const url = new URL('/settings/integrations', publicEnv.NEXT_PUBLIC_APP_URL);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    return NextResponse.redirect(url);
  };

  try {
    const url = new URL(req.url);
    const providerError = url.searchParams.get('error');
    if (providerError) return settings({ error: providerError });

    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    if (!code || !stateParam) return settings({ error: 'missing_code_or_state' });

    const state = await verifyOAuthState(stateParam);
    if (!state || state.connector !== connector) {
      return settings({ error: 'invalid_state' });
    }

    // Defense-in-depth: if a session cookie IS present, it must match the state.
    const session = await getSession();
    if (session && session.orgId !== state.orgId) {
      return settings({ error: 'tenant_mismatch' });
    }

    const cfg = getConnector(connector);
    const redirectUri = `${publicEnv.NEXT_PUBLIC_APP_URL}/api/oauth/${connector}/callback`;
    const tokens = await exchangeCode(cfg, code, redirectUri);

    // One connector can back several providers (e.g. Google → Gmail + Calendar).
    for (const provider of cfg.providers) {
      await upsertAccount(state.orgId, provider, tokens);
    }

    return settings({ connected: connector });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed';
    return settings({ error: message });
  }
}
