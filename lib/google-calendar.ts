import { google } from 'googleapis';

const MEETING_DURATION = 30; // minutes
const WORK_START = 9;
const WORK_END = 18;
const TZ = 'America/Mexico_City';

function getAuth() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
}

function hasCredentials() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

function formatSlot(date: Date): string {
  return date.toLocaleString('es-MX', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function nextWorkingSlots(count: number): Date[] {
  const slots: Date[] = [];
  const now = new Date();
  const cursor = new Date(now);
  cursor.setMinutes(Math.ceil(cursor.getMinutes() / 30) * 30, 0, 0);
  if (cursor.getHours() < WORK_START) cursor.setHours(WORK_START, 0, 0, 0);

  while (slots.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6 && cursor.getHours() < WORK_END && cursor > now) {
      slots.push(new Date(cursor));
    }
    cursor.setMinutes(cursor.getMinutes() + MEETING_DURATION);
    if (cursor.getHours() >= WORK_END) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(WORK_START, 0, 0, 0);
    }
  }
  return slots;
}

export async function getAvailableSlots(
  calendarId: string,
  daysAhead = 5,
): Promise<{ iso: string; label: string }[]> {
  if (!hasCredentials()) {
    return nextWorkingSlots(6).map(d => ({ iso: d.toISOString(), label: formatSlot(d) }));
  }

  try {
    const auth = getAuth();
    const calendar = google.calendar({ version: 'v3', auth });
    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + daysAhead);

    const fb = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: calendarId }],
      },
    });

    const busy = fb.data.calendars?.[calendarId]?.busy ?? [];
    const candidates = nextWorkingSlots(20);

    const free = candidates.filter(slot => {
      const slotEnd = new Date(slot.getTime() + MEETING_DURATION * 60000);
      return !busy.some(b => {
        const bs = new Date(b.start!);
        const be = new Date(b.end!);
        return slot < be && slotEnd > bs;
      });
    });

    return free.slice(0, 6).map(d => ({ iso: d.toISOString(), label: formatSlot(d) }));
  } catch {
    return nextWorkingSlots(6).map(d => ({ iso: d.toISOString(), label: formatSlot(d) }));
  }
}

export async function createCalendarEvent(params: {
  calendarId: string;
  responsibleEmail: string;
  siteName: string;
  name: string;
  email: string;
  datetime: string;
  topic?: string;
}): Promise<{ label: string; meetLink?: string; mock?: boolean }> {
  const { calendarId, responsibleEmail, siteName, name, email, datetime, topic } = params;
  const start = new Date(datetime);
  const end = new Date(start.getTime() + MEETING_DURATION * 60000);
  const label = formatSlot(start);

  if (!hasCredentials()) {
    return { label, mock: true };
  }

  try {
    const auth = getAuth();
    const calendar = google.calendar({ version: 'v3', auth });
    const event = await calendar.events.insert({
      calendarId,
      conferenceDataVersion: 1,
      sendUpdates: 'all', // email invitations to all attendees
      requestBody: {
        summary: `${siteName} — ${name}`,
        description: topic ?? `Reunión agendada desde el chat de ${siteName}`,
        start: { dateTime: start.toISOString(), timeZone: TZ },
        end: { dateTime: end.toISOString(), timeZone: TZ },
        attendees: [{ email }, { email: responsibleEmail }],
        conferenceData: { createRequest: { requestId: `${Date.now()}` } },
      },
    });
    return { label, meetLink: event.data.hangoutLink ?? undefined };
  } catch (err) {
    console.error('[Google Calendar] createCalendarEvent error:', err);
    return { label, mock: true };
  }
}
