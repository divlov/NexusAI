import { z } from 'zod';

/**
 * Minimal Gmail read client — pure functions of (accessToken, args). Uses the
 * REST API directly (no SDK) and Zod-validates responses. `scanInbox` lists
 * matching message ids, then fetches metadata headers (From/Subject) + snippet
 * for each. Read-only (gmail.readonly scope).
 */

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

const listResponse = z.object({
  messages: z.array(z.object({ id: z.string() })).default([]),
});

const messageResponse = z.object({
  id: z.string(),
  snippet: z.string().default(''),
  payload: z
    .object({
      headers: z.array(z.object({ name: z.string(), value: z.string() })).default([]),
    })
    .default({ headers: [] }),
});

async function gmailFetch(accessToken: string, url: URL): Promise<unknown> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Gmail API HTTP ${res.status} for ${url.pathname}`);
  return res.json();
}

export interface ScanInboxArgs {
  query: string;
  maxResults?: number;
}

export interface InboxMessage {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  /** Compact one-line form, used by summaries/fallbacks. */
  text: string;
}

export async function scanInbox(
  accessToken: string,
  args: ScanInboxArgs,
): Promise<{ count: number; query: string; messages: InboxMessage[] }> {
  const max = Math.min(args.maxResults ?? 20, 25);

  const listUrl = new URL(`${GMAIL_API}/messages`);
  listUrl.searchParams.set('q', args.query);
  listUrl.searchParams.set('maxResults', String(max));
  const list = listResponse.parse(await gmailFetch(accessToken, listUrl));

  const messages: InboxMessage[] = [];
  for (const { id } of list.messages.slice(0, max)) {
    const msgUrl = new URL(`${GMAIL_API}/messages/${id}`);
    msgUrl.searchParams.set('format', 'metadata');
    msgUrl.searchParams.append('metadataHeaders', 'From');
    msgUrl.searchParams.append('metadataHeaders', 'Subject');
    const msg = messageResponse.parse(await gmailFetch(accessToken, msgUrl));

    const header = (name: string) =>
      msg.payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
    const from = header('From');
    const subject = header('Subject');
    messages.push({ id: msg.id, from, subject, snippet: msg.snippet, text: `${subject} — ${msg.snippet}` });
  }

  return { count: messages.length, query: args.query, messages };
}
