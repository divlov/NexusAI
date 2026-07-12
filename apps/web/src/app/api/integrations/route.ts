import { json, errorResponse } from '@/lib/api';
import { requireSession } from '@/lib/auth/session';
import { listIntegrations } from '@/lib/integrations/service';

export const runtime = 'nodejs';

/** List the connector catalogue with this tenant's connection status. */
export async function GET() {
  try {
    const session = await requireSession();
    const integrations = await listIntegrations(session.orgId);
    return json({ integrations });
  } catch (error) {
    return errorResponse(error);
  }
}
