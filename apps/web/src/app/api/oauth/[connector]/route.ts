import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getConnector } from '@nexus/connectors';
import { IS_DEMO_MODE, publicEnv } from '@nexus/shared';
import { errorResponse } from '@/lib/api';
import { requireSession } from '@/lib/auth/session';
import { signOAuthState } from '@/lib/oauth/state';

export const runtime = 'nodejs';

/**
 * Initiate an OAuth connect flow. Authenticates the user, mints a signed `state`
 * carrying the tenant identity, and 302s to the provider's consent screen.
 * Demo mode makes no external call.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ connector: string }> },
) {
  try {
    const { connector } = await params;
    const session = await requireSession();

    const settings = new URL('/settings/integrations', publicEnv.NEXT_PUBLIC_APP_URL);
    if (IS_DEMO_MODE) {
      settings.searchParams.set('demo', '1');
      return NextResponse.redirect(settings);
    }

    const cfg = getConnector(connector); // throws on unknown connector
    const state = await signOAuthState({
      orgId: session.orgId,
      userId: session.userId,
      connector,
      nonce: randomUUID(),
    });

    const redirectUri = `${publicEnv.NEXT_PUBLIC_APP_URL}/api/oauth/${connector}/callback`;
    const url = new URL(cfg.authorizeUrl);
    url.searchParams.set('client_id', cfg.clientId());
    url.searchParams.set('scope', cfg.scopes.join(cfg.scopeSeparator));
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    for (const [k, v] of Object.entries(cfg.authorizeExtras ?? {})) {
      url.searchParams.set(k, v);
    }

    return NextResponse.redirect(url);
  } catch (error) {
    return errorResponse(error);
  }
}
