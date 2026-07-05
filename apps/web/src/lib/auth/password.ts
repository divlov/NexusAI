import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id password hashing. OWASP-aligned parameters. Centralized so hashing
 * policy lives in one place.
 */
const OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export function verifyPassword(hashString: string, plain: string): Promise<boolean> {
  return verify(hashString, plain, OPTIONS);
}
