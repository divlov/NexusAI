import { jwtVerify, SignJWT } from 'jose';
// Import via narrow subpaths (not the package barrel): the barrel pulls in
// node:crypto and ioredis, which break the edge runtime that middleware uses.
import { getServerEnv } from '@nexus/shared/env';
import type { MembershipRole } from '@nexus/shared/types';

/**
 * Edge-safe session JWT primitives (no next/headers, no DB) so they can be used
 * from middleware as well as server route handlers. Cookie binding lives in
 * `session.ts`.
 */

export const SESSION_COOKIE = 'nexus_session';
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  userId: string;
  orgId: string;
  role: MembershipRole;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(getServerEnv().AUTH_SECRET);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

/** Verify a token's signature/expiry. Returns null on any failure. */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (
      typeof payload.userId === 'string' &&
      typeof payload.orgId === 'string' &&
      typeof payload.role === 'string'
    ) {
      return {
        userId: payload.userId,
        orgId: payload.orgId,
        role: payload.role as MembershipRole,
      };
    }
    return null;
  } catch {
    return null;
  }
}
