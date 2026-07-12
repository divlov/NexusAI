import { z } from 'zod';

/**
 * Minimal Slack Web API client — pure functions of (accessToken, args).
 *
 * Raw `fetch` (no SDK) keeps this small and lets us Zod-validate every response
 * per the engineering rules (never trust tool responses). Slack returns HTTP 200
 * even on logical failures, signalling errors via `{ ok: false, error }`, so we
 * always parse and check `ok`.
 */

const SLACK_API = 'https://slack.com/api';

/** Common envelope: every Slack response carries `ok` and, on failure, `error`. */
const okEnvelope = z.object({ ok: z.boolean(), error: z.string().optional() });

async function slackFetch(
  accessToken: string,
  method: string,
  init: { query?: Record<string, string>; body?: unknown },
): Promise<unknown> {
  const url = new URL(`${SLACK_API}/${method}`);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, v);
  }

  const res = await fetch(url, {
    method: init.body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`Slack ${method} HTTP ${res.status}`);
  }
  return res.json();
}

/** Assert a Slack response is `ok`, surfacing the API error code otherwise. */
function assertOk(raw: unknown, method: string): void {
  const env = okEnvelope.parse(raw);
  if (!env.ok) throw new Error(`Slack ${method} failed: ${env.error ?? 'unknown_error'}`);
}

// --- chat.postMessage -------------------------------------------------------

const postMessageResponse = z.object({
  ok: z.literal(true),
  channel: z.string(),
  ts: z.string(),
});

export interface PostMessageArgs {
  channel: string;
  text: string;
}

export async function postMessage(
  accessToken: string,
  args: PostMessageArgs,
): Promise<{ ok: true; channel: string; ts: string }> {
  const raw = await slackFetch(accessToken, 'chat.postMessage', { body: args });
  const env = okEnvelope.parse(raw);
  if (!env.ok) {
    const detail =
      env.error === 'channel_not_found'
        ? `channel "${args.channel}" not found — the bot isn't a member, or it doesn't exist`
        : env.error === 'not_in_channel'
          ? `the bot isn't in "${args.channel}" — invite it with /invite @NexusAI`
          : (env.error ?? 'unknown_error');
    throw new Error(`Slack chat.postMessage failed: ${detail}`);
  }
  const parsed = postMessageResponse.parse(raw);
  return { ok: true, channel: parsed.channel, ts: parsed.ts };
}

// --- conversations.list + conversations.history -----------------------------

const conversationsListResponse = z.object({
  ok: z.literal(true),
  channels: z.array(z.object({ id: z.string(), name: z.string() })),
});

const historyResponse = z.object({
  ok: z.literal(true),
  messages: z.array(
    z.object({
      user: z.string().optional(),
      text: z.string().default(''),
      ts: z.string(),
    }),
  ),
});

/** A Slack channel id looks like C0..., G0..., or D0... (uppercase alnum). */
function looksLikeChannelId(value: string): boolean {
  return /^[CGD][A-Z0-9]{6,}$/.test(value);
}

/** Resolve a channel name (with or without leading '#') to its channel id. */
async function resolveChannelId(accessToken: string, channel: string): Promise<string> {
  if (looksLikeChannelId(channel)) return channel;
  const wanted = channel.replace(/^#/, '').toLowerCase();

  const raw = await slackFetch(accessToken, 'conversations.list', {
    query: { types: 'public_channel,private_channel', limit: '1000' },
  });
  assertOk(raw, 'conversations.list');
  const parsed = conversationsListResponse.parse(raw);

  const match = parsed.channels.find((c) => c.name.toLowerCase() === wanted);
  if (!match) throw new Error(`Slack channel not found: ${channel}`);
  return match.id;
}

export interface ReadChannelArgs {
  channel: string;
  limit?: number;
}

export interface SlackMessage {
  user: string | null;
  text: string;
  ts: string;
}

export async function readChannel(
  accessToken: string,
  args: ReadChannelArgs,
): Promise<{ channel: string; channelId: string; count: number; messages: SlackMessage[] }> {
  const channelId = await resolveChannelId(accessToken, args.channel);
  const raw = await slackFetch(accessToken, 'conversations.history', {
    query: { channel: channelId, limit: String(args.limit ?? 20) },
  });
  assertOk(raw, 'conversations.history');
  const parsed = historyResponse.parse(raw);

  const messages: SlackMessage[] = parsed.messages.map((m) => ({
    user: m.user ?? null,
    text: m.text,
    ts: m.ts,
  }));
  return { channel: args.channel, channelId, count: messages.length, messages };
}
