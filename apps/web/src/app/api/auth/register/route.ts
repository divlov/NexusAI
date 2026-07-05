import { type NextRequest } from 'next/server';
import { registerSchema } from '@nexus/shared';
import { errorResponse, json } from '@/lib/api';
import { registerUser } from '@/lib/auth/service';
import { setSessionCookie } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = registerSchema.parse(await req.json());
    const session = await registerUser(body);
    await setSessionCookie(session);
    return json({ ok: true, orgId: session.orgId }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
