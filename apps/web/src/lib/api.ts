import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthError } from './auth/service.js';
import { UnauthorizedError } from './auth/session.js';
import { logger } from './logger.js';

/**
 * Standard JSON error envelope + mapping of known error types to status codes.
 *
 * Only intentionally user-safe error types (validation, auth) surface their
 * message to the client. Anything else — DB errors, network failures, bugs —
 * is logged server-side with full detail and reduced to a generic message,
 * so internals (query shape, stack traces, connection strings) never leak.
 */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'Validation failed', issues: error.flatten() },
      { status: 422 },
    );
  }
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  logger.error('unhandled API error', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
