import { jwtVerify, SignJWT } from 'jose';
// Narrow subpath import (not the barrel) to avoid pulling node-only deps.
import { getServerEnv } from '@nexus/shared/env';

/**
 * Signed, short-TTL OAuth `state` — the CSRF + tenant anchor for the OAuth
 * round-trip. Signed with AUTH_SECRET so the callback can trust the orgId/userId
 * without the provider redirect carrying our session cookie. Mirrors the session
 * JWT primitives in `auth/jwt.ts`.
 */

const STATE_TTL_SECONDS = 60 * 10; // 10 minutes to complete the consent flow.

export interface OAuthState {
  orgId: string;
  userId: string;
  connector: string;
  nonce: string;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(getServerEnv().AUTH_SECRET);
}

export async function signOAuthState(state: OAuthState): Promise<string> {
  return new SignJWT({ ...state })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_SECONDS}s`)
    .sign(secret());
}

/** Verify a state token's signature/expiry. Returns null on any failure. */
export async function verifyOAuthState(token: string): Promise<OAuthState | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (
      typeof payload.orgId === 'string' &&
      typeof payload.userId === 'string' &&
      typeof payload.connector === 'string' &&
      typeof payload.nonce === 'string'
    ) {
      return {
        orgId: payload.orgId,
        userId: payload.userId,
        connector: payload.connector,
        nonce: payload.nonce,
      };
    }
    return null;
  } catch {
    return null;
  }
}
