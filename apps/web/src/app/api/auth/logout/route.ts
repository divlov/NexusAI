import { errorResponse, json } from '@/lib/api';
import { clearSessionCookie } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST() {
  try {
    await clearSessionCookie();
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
