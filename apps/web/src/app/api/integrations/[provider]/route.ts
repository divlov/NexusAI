import { type NextRequest } from 'next/server';
import { deleteAccount } from '@nexus/connectors';
import { IS_DEMO_MODE, IntegrationProvider } from '@nexus/shared';
import { json, errorResponse } from '@/lib/api';
import { requireSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

/** Disconnect a provider for the active tenant (deletes stored credentials). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const session = await requireSession();
    const { provider } = await params;

    if (!(provider in IntegrationProvider)) {
      return json({ error: `Unknown provider: ${provider}` }, 400);
    }
    if (IS_DEMO_MODE) return json({ ok: true }); // no real credentials in demo

    await deleteAccount(session.orgId, provider as IntegrationProvider);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
