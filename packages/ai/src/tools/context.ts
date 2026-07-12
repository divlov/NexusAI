import type { IntegrationProvider } from '@nexus/shared';

/**
 * A credential resolved for a specific tenant + provider, ready for a real API
 * call. The access token is already decrypted (and refreshed, for providers that
 * expire). `externalAccount` is the provider-specific account handle — the Slack
 * team id, the Atlassian cloudId, the Gmail address — needed to scope requests.
 */
export interface ResolvedCredential {
  accessToken: string;
  externalAccount: string;
}

/**
 * Per-job tenant context injected into the runtime at construction (never into
 * the graph). It carries the tenant identity plus a `getCredential` callback
 * supplied by the worker — this indirection is what lets `@nexus/ai` execute
 * real third-party calls WITHOUT depending on `@nexus/db`: credential lookup,
 * decryption, and refresh all live in `@nexus/connectors` behind the callback.
 *
 * Demo mode never constructs a ToolContext; `DemoRuntime` ignores it entirely.
 */
export interface ToolContext {
  orgId: string;
  userId: string;
  /**
   * IANA timezone captured from the submitting browser (e.g. "Asia/Kolkata").
   * Undefined when unknown — tools and the planner then fall back to UTC.
   */
  timezone?: string;
  /** Resolve a fresh (refreshed if needed) credential for a provider. */
  getCredential: (provider: IntegrationProvider) => Promise<ResolvedCredential>;
}
