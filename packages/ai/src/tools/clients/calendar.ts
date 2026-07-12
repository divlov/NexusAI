import { z } from 'zod';

/**
 * Minimal Google Calendar write client — pure function of (accessToken, args).
 * Creates an event on the user's primary calendar (calendar.events scope).
 */

const EVENTS_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

const eventResponse = z.object({
  id: z.string(),
  htmlLink: z.string().optional(),
});

export interface CreateEventArgs {
  title: string;
  /**
   * ISO 8601 datetime. When `timeZone` is given, this is a LOCAL wall-clock
   * value with no "Z"/offset (e.g. "2026-07-13T09:00:00") and Google localizes
   * it using `timeZone`. Without `timeZone`, treated as an absolute UTC instant.
   */
  startsAt: string;
  durationMinutes?: number;
  notes?: string;
  /** IANA timezone (e.g. "Asia/Kolkata"). Omit to treat startsAt as UTC. */
  timeZone?: string;
}

/** Add `minutes` to a wall-clock ISO string, ignoring timezone (elapsed time only). */
function addMinutesToNaive(naiveIso: string, minutes: number): string {
  // Borrow UTC parsing purely for arithmetic — the offset is irrelevant since
  // we only need elapsed time, not an absolute instant.
  const asUtc = new Date(`${naiveIso}Z`);
  if (Number.isNaN(asUtc.getTime())) throw new Error(`Invalid startsAt: ${naiveIso}`);
  return new Date(asUtc.getTime() + minutes * 60_000).toISOString().slice(0, 19);
}

export async function createEvent(
  accessToken: string,
  args: CreateEventArgs,
): Promise<{ id: string; htmlLink: string | null; title: string; startsAt: string; endsAt: string }> {
  const duration = args.durationMinutes ?? 30;
  let start: { dateTime: string; timeZone?: string };
  let end: { dateTime: string; timeZone?: string };

  if (args.timeZone) {
    const naiveStart = args.startsAt.replace(/Z$/, '');
    const naiveEnd = addMinutesToNaive(naiveStart, duration);
    start = { dateTime: naiveStart, timeZone: args.timeZone };
    end = { dateTime: naiveEnd, timeZone: args.timeZone };
  } else {
    const startDate = new Date(args.startsAt);
    if (Number.isNaN(startDate.getTime())) {
      throw new Error(`Invalid startsAt (expected ISO 8601): ${args.startsAt}`);
    }
    const endDate = new Date(startDate.getTime() + duration * 60_000);
    start = { dateTime: startDate.toISOString() };
    end = { dateTime: endDate.toISOString() };
  }

  const res = await fetch(EVENTS_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ summary: args.title, description: args.notes, start, end }),
  });
  if (!res.ok) throw new Error(`Google Calendar HTTP ${res.status}`);

  const parsed = eventResponse.parse(await res.json());
  return {
    id: parsed.id,
    htmlLink: parsed.htmlLink ?? null,
    title: args.title,
    startsAt: start.dateTime,
    endsAt: end.dateTime,
  };
}
