import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { getServerEnv } from './env.js';

/**
 * Centralized AES-256-GCM encryption for third-party credentials (OAuth tokens).
 *
 * Per the engineering rules, secrets are NEVER stored in plain text and this is
 * the single place encryption logic lives. The serialized format is:
 *
 *   v1:<iv-base64>:<authTag-base64>:<ciphertext-base64>
 *
 * The `v1` prefix allows key/algorithm rotation later without ambiguity.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96-bit nonce, recommended for GCM.
const KEY_BYTES = 32; // AES-256.
const VERSION = 'v1';

let cachedKey: Buffer | null = null;

/** Decode the configured ENCRYPTION_KEY (base64 or hex) into exactly 32 bytes. */
function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = getServerEnv().ENCRYPTION_KEY;

  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else {
    key = Buffer.from(raw, 'base64');
  }

  if (key.length !== KEY_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}). ` +
        'Generate one with `openssl rand -base64 32`.',
    );
  }

  cachedKey = key;
  return key;
}

/** Encrypt UTF-8 plaintext. Returns the versioned, serialized ciphertext. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

/** Decrypt a value produced by {@link encrypt}. Throws on tampering/format errors. */
export function decrypt(serialized: string): string {
  const parts = serialized.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Malformed ciphertext: unexpected format or version.');
  }
  const [, ivB64, tagB64, dataB64] = parts;

  const iv = Buffer.from(ivB64!, 'base64');
  const authTag = Buffer.from(tagB64!, 'base64');
  const ciphertext = Buffer.from(dataB64!, 'base64');

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/** Constant-time string comparison (e.g. for token/secret checks). */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
