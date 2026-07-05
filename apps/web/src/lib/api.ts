import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthError } from './auth/service.js';
import { UnauthorizedError } from './auth/session.js';

/** Standard JSON error envelope + mapping of known error types to status codes. */
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
  const message = error instanceof Error ? error.message : 'Internal server error';
  return NextResponse.json({ error: message }, { status: 500 });
}

export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
