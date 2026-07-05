import { type NextRequest } from 'next/server';
import { loginSchema } from '@nexus/shared';
import { errorResponse, json } from '@/lib/api';
import { loginUser } from '@/lib/auth/service';
import { setSessionCookie } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = loginSchema.parse(await req.json());
    const session = await loginUser(body);
    await setSessionCookie(session);
    return json({ ok: true, orgId: session.orgId });
  } catch (error) {
    return errorResponse(error);
  }
}
