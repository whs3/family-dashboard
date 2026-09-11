import { google } from "googleapis";
import googleAuth from "./googleAuth.js";

async function getUpcomingEvents({ maxEvents = 30, daysAhead = 10 } = {}) {
  const auth = googleAuth.getAuthorizedClient();
  if (!auth) {
    return { connected: false, events: [] };
  }

  const calendar = google.calendar({ version: "v3", auth });
  const now = new Date();
  const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const calendarListRes = await calendar.calendarList.list();
  // Only calendars visible in the user's own Google Calendar UI — this is
  // what makes shared calendars (e.g. a spouse's) show up, same as the app.
  const visibleCalendars = (calendarListRes.data.items || []).filter((c) => c.selected !== false);

  const results = await Promise.allSettled(
    visibleCalendars.map(async (cal) => {
      const res = await calendar.events.list({
        calendarId: cal.id,
        timeMin: now.toISOString(),
        timeMax: end.toISOString(),
        maxResults: maxEvents,
        singleEvents: true,
        orderBy: "startTime",
      });
      return (res.data.items || []).map((event) => ({
        id: `${cal.id}:${event.id}`,
        title: event.summary || "(No title)",
        location: event.location || null,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        allDay: Boolean(event.start?.date && !event.start?.dateTime),
        calendarName: cal.summaryOverride || cal.summary,
        calendarColor: cal.backgroundColor || "#6fb3ff",
      }));
    })
  );

  const events = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, maxEvents);

  return { connected: true, events };
}

export default { getUpcomingEvents };
