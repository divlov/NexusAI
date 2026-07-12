import { z } from 'zod';

/**
 * Minimal Jira Cloud write client — pure function of (accessToken, cloudId, args).
 * Issue creation goes through the Atlassian API gateway
 * (api.atlassian.com/ex/jira/{cloudId}/...), which every 3LO-authorized app
 * must use instead of the site's own domain.
 */

const issueResponse = z.object({
  id: z.string(),
  key: z.string(),
  self: z.string().optional(),
});

const errorResponse = z.object({
  errorMessages: z.array(z.string()).default([]),
  errors: z.record(z.string()).default({}),
});

const accessibleResource = z.object({ id: z.string(), url: z.string().optional() });

export interface CreateIssueArgs {
  projectKey: string;
  summary: string;
  description: string;
  issueType: string;
}

/** Jira Cloud v3 requires the description as Atlassian Document Format, not a plain string. */
function toAdf(text: string) {
  return {
    type: 'doc',
    version: 1,
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

/**
 * The gateway host (api.atlassian.com/ex/jira/{cloudId}) isn't user-browsable —
 * resolve the site's real *.atlassian.net URL for a clickable link.
 */
async function fetchSiteUrl(accessToken: string, cloudId: string): Promise<string | null> {
  const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const sites = z.array(accessibleResource).parse(await res.json());
  return sites.find((s) => s.id === cloudId)?.url ?? null;
}

export async function createIssue(
  accessToken: string,
  cloudId: string,
  args: CreateIssueArgs,
): Promise<{ issueKey: string; url: string | null }> {
  const res = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      fields: {
        project: { key: args.projectKey },
        summary: args.summary,
        description: toAdf(args.description),
        issuetype: { name: args.issueType },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const parsed = errorResponse.safeParse(body);
    const detail = parsed.success
      ? [...parsed.data.errorMessages, ...Object.values(parsed.data.errors)].join('; ')
      : '';
    throw new Error(`Jira createIssue failed: ${detail || `HTTP ${res.status}`}`);
  }

  const parsed = issueResponse.parse(await res.json());
  const siteUrl = await fetchSiteUrl(accessToken, cloudId);
  return {
    issueKey: parsed.key,
    url: siteUrl ? `${siteUrl}/browse/${parsed.key}` : null,
  };
}
