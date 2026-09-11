import config from "../config.js";
import calendarService from "./calendar.js";
import tasksService from "./tasks.js";
import newsService from "./news.js";
import weatherService from "./weather.js";

let cache = {
  generatedAt: null,
  calendar: { connected: false, events: [] },
  tasks: { connected: false, lists: [] },
  news: { items: [], failedFeeds: [] },
  weather: null,
  errors: {},
};

let timer = null;

async function refresh() {
  const cfg = config.load();
  const errors = {};

  const [calendarResult, tasksResult, newsResult, weatherResult] = await Promise.allSettled([
    calendarService.getUpcomingEvents(cfg.calendar),
    tasksService.getTaskLists(cfg.tasks),
    newsService.getHeadlines(cfg.news),
    weatherService.getWeather(cfg.weather),
  ]);

  if (calendarResult.status === "fulfilled") {
    cache.calendar = calendarResult.value;
  } else {
    errors.calendar = calendarResult.reason.message;
  }

  if (tasksResult.status === "fulfilled") {
    cache.tasks = tasksResult.value;
  } else {
    errors.tasks = tasksResult.reason.message;
  }

  if (newsResult.status === "fulfilled") {
    cache.news = newsResult.value;
  } else {
    errors.news = newsResult.reason.message;
  }

  if (weatherResult.status === "fulfilled") {
    cache.weather = weatherResult.value;
  } else {
    errors.weather = weatherResult.reason.message;
  }

  cache.generatedAt = new Date().toISOString();
  cache.errors = errors;

  return cache;
}

function getCache() {
  return cache;
}

function scheduleNext() {
  if (timer) clearTimeout(timer);
  const cfg = config.load();
  const intervalMs = Math.max(1, cfg.refreshIntervalMinutes) * 60 * 1000;
  timer = setTimeout(async () => {
    try {
      await refresh();
    } catch (err) {
      console.error("Scheduled refresh failed:", err);
    }
    scheduleNext();
  }, intervalMs);
  timer.unref?.();
}

async function start() {
  await refresh();
  scheduleNext();
}

/** Call after the refresh interval changes so the new cadence takes effect immediately. */
function rescheduleNow() {
  scheduleNext();
}

export default { start, refresh, getCache, rescheduleNow };
