import 'server-only';
import { cookies } from 'next/headers';
import { getServerEnv, IS_DEMO_MODE, MembershipRole } from '@nexus/shared';
import {
  MAX_AGE_SECONDS,
  SESSION_COOKIE,
  signSession,
  verifySession,
  type SessionPayload,
} from './jwt.js';

/**
 * Cookie-bound session management for server components / route handlers.
 * Edge-safe JWT primitives live in `./jwt.ts` (used by middleware).
 *
 * Demo mode: `getSession()` returns a fixed demo identity and lazily seeds the
 * demo tenant — so the public deploy works with zero credentials.
 */

export { SESSION_COOKIE, verifySession };
export type { SessionPayload };

export const DEMO_SESSION: SessionPayload = {
  userId: 'demo-user',
  orgId: 'demo-org',
  role: MembershipRole.OWNER,
};

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: getServerEnv().NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Resolve the current session. In demo mode this ensures the demo tenant exists
 * and returns the demo identity.
 */
export async function getSession(): Promise<SessionPayload | null> {
  if (IS_DEMO_MODE) {
    const { ensureDemoTenant } = await import('./demo.js');
    await ensureDemoTenant();
    return DEMO_SESSION;
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}
