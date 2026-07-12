import { z } from 'zod';

/**
 * Centralized, fail-fast environment configuration.
 *
 * Per the engineering rules, `process.env` must never be read directly outside
 * this module. Import `serverEnv` / `publicEnv` instead. Validation runs once
 * at module load; an invalid environment throws immediately on boot.
 */

const booleanString = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

/** Variables that are safe to expose to the browser (NEXT_PUBLIC_*). */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_IS_DEMO_MODE: booleanString.default('false'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
});

/** Server-only secrets. Never import `serverEnv` into client components. */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  // 32-byte key, supplied as base64 (44 chars) or hex (64 chars). Validated
  // structurally here; byte-length is enforced in `crypto.ts` where it is used.
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must encode 32 bytes'),
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
  // Which LLM backs the agent runtime. Switch providers with this one var.
  AI_PROVIDER: z.enum(['gemini', 'openai']).default('gemini'),
  // Gemini — required when AI_PROVIDER=gemini and not in demo mode.
  GEMINI_API_KEY: z.string().optional(),
  // Dev default: cheap, fast, current (gemini-2.0-flash was shut down 2026-06-01).
  // Override per-environment if your API key's free-tier quota favors another.
  GEMINI_MODEL: z.string().default('gemini-3.1-flash-lite'),
  // OpenAI — required when AI_PROVIDER=openai and not in demo mode.
  OPENAI_API_KEY: z.string().optional(),
  // Cheap, JSON-mode-capable default; override with any model your key has.
  OPENAI_MODEL: z.string().default('gpt-4.1-nano'),
  // OAuth connector credentials. Optional — only required to connect that
  // provider in real mode.
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  // Google app (one app backs both Gmail and Google Calendar).
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  // Atlassian app (Jira).
  ATLASSIAN_CLIENT_ID: z.string().optional(),
  ATLASSIAN_CLIENT_SECRET: z.string().optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema> & PublicEnv;

function format(error: z.ZodError): string {
  return error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
}

function parsePublic(): PublicEnv {
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_IS_DEMO_MODE: process.env.NEXT_PUBLIC_IS_DEMO_MODE,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!result.success) {
    throw new Error(`Invalid public environment:\n${format(result.error)}`);
  }
  return result.data;
}

/**
 * Public config — always available (server and client). On the client only the
 * inlined NEXT_PUBLIC_* values exist; the schema defaults cover the rest.
 */
export const publicEnv: PublicEnv = parsePublic();

/** Convenience flag used across the codebase to gate all external calls. */
export const IS_DEMO_MODE = publicEnv.NEXT_PUBLIC_IS_DEMO_MODE;

let cachedServerEnv: ServerEnv | null = null;

/**
 * Lazily validate and return the full server environment. Lazy (rather than
 * top-level) so that importing this module from a client bundle does not throw
 * for missing server secrets — only server code calls `getServerEnv()`.
 */
export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `Invalid server environment:\n${format(result.error)}\n` +
        'Check your .env file against .env.example.',
    );
  }
  cachedServerEnv = { ...result.data, ...publicEnv };
  return cachedServerEnv;
}
