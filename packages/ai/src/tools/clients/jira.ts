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

// /rest/api/3/search (with a `total` count) was removed by Atlassian in favor of
// cursor-based pagination (`isLast` + `nextPageToken`, no total count available).
const searchResponse = z.object({
  issues: z
    .array(
      z.object({
        key: z.string(),
        fields: z.object({
          summary: z.string().default(''),
          status: z.object({ name: z.string() }).optional(),
          assignee: z.object({ displayName: z.string() }).nullable().optional(),
          updated: z.string().optional(),
        }),
      }),
    )
    .default([]),
  isLast: z.boolean().optional(),
});

export interface CreateIssueArgs {
  projectKey: string;
  summary: string;
  description: string;
  issueType: string;
}

export interface SearchIssuesArgs {
  jql?: string;
  maxResults?: number;
}

export interface JiraIssueSummary {
  key: string;
  summary: string;
  status: string | null;
  assignee: string | null;
  updated: string | null;
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

/** Search issues via JQL (read-only). Empty/omitted jql matches all accessible issues. */
export async function searchIssues(
  accessToken: string,
  cloudId: string,
  args: SearchIssuesArgs,
): Promise<{ count: number; hasMore: boolean; issues: JiraIssueSummary[] }> {
  const res = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      // Jira rejects fully unbounded JQL (no WHERE clause) as an anti-abuse
      // measure — "order by" alone isn't a restriction. Default to a 30-day
      // window, which is both valid and a sensible "recent activity" scope.
      jql: args.jql ?? 'updated >= -30d ORDER BY updated DESC',
      maxResults: Math.min(args.maxResults ?? 20, 50),
      fields: ['summary', 'status', 'assignee', 'updated'],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const parsed = errorResponse.safeParse(body);
    const detail = parsed.success
      ? [...parsed.data.errorMessages, ...Object.values(parsed.data.errors)].join('; ')
      : '';
    throw new Error(`Jira search failed: ${detail || `HTTP ${res.status}`}`);
  }

  const parsed = searchResponse.parse(await res.json());
  const issues: JiraIssueSummary[] = parsed.issues.map((i) => ({
    key: i.key,
    summary: i.fields.summary,
    status: i.fields.status?.name ?? null,
    assignee: i.fields.assignee?.displayName ?? null,
    updated: i.fields.updated ?? null,
  }));
  return { count: issues.length, hasMore: parsed.isLast === false, issues };
}
