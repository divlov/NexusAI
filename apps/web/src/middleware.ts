import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth/jwt';

/**
 * Route protection. Runs on the edge — no DB access. In demo mode everything is
 * allowed (the demo session is injected server-side). Otherwise we verify the
 * session JWT signature and redirect/401 when missing.
 *
 * NOTE: NEXT_PUBLIC_IS_DEMO_MODE is inlined at build time, so this check is safe
 * in the edge runtime.
 */
const IS_DEMO = process.env.NEXT_PUBLIC_IS_DEMO_MODE === 'true';

const PROTECTED_PAGES = ['/dashboard', '/settings'];
// NOTE: /api/oauth is intentionally NOT here — the provider callback must not be
// session-gated; its trust anchor is the signed `state` (see lib/oauth/state.ts).
const PROTECTED_API = ['/api/tasks', '/api/approvals', '/api/jobs', '/api/integrations'];

export async function middleware(req: NextRequest) {
  if (IS_DEMO) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const isProtectedPage = PROTECTED_PAGES.some((p) => pathname.startsWith(p));
  const isProtectedApi = PROTECTED_API.some((p) => pathname.startsWith(p));
  if (!isProtectedPage && !isProtectedApi) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const valid = token ? await verifySession(token) : null;

  if (!valid) {
    if (isProtectedApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/settings/:path*',
    '/api/tasks/:path*',
    '/api/approvals/:path*',
    '/api/jobs/:path*',
    '/api/integrations/:path*',
  ],
};
