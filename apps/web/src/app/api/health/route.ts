import { NextResponse } from 'next/server';
import { IS_DEMO_MODE } from '@nexus/shared';

export const runtime = 'nodejs';

export function GET() {
  return NextResponse.json({ status: 'ok', demoMode: IS_DEMO_MODE });
}
