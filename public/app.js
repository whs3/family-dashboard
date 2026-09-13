(() => {
  let pollTimer = null;
  let refreshIntervalMinutes = 15;
  const THEME_KEY = "family-dashboard-theme";
  const BG_TINT_KEY = "family-dashboard-bg-tint";

  const el = (id) => document.getElementById(id);

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = el("theme-btn");
    if (theme === "light") {
      btn.textContent = "\u{1F319}";
      btn.title = "Switch to dark theme";
      btn.setAttribute("aria-label", "Switch to dark theme");
    } else {
      btn.textContent = "\u{2600}\u{FE0F}";
      btn.title = "Switch to light theme";
      btn.setAttribute("aria-label", "Switch to light theme");
    }
  }

  function initTheme() {
    let saved = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch (e) {}
    applyTheme(saved || document.documentElement.getAttribute("data-theme") || "dark");
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "light" ? "dark" : "light";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {}
    applyTheme(next);
  }

  function applyBgTint(tint) {
    document.documentElement.setAttribute("data-bg-tint", tint);
    document.querySelectorAll("#bg-tint-picker .swatch").forEach((btn) => {
      btn.classList.toggle("is-selected", btn.dataset.tint === tint);
    });
  }

  function initBgTint() {
    let saved = null;
    try {
      saved = localStorage.getItem(BG_TINT_KEY);
    } catch (e) {}
    applyBgTint(saved || document.documentElement.getAttribute("data-bg-tint") || "multi");
  }

  document.querySelectorAll("#bg-tint-picker .swatch").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tint = btn.dataset.tint;
      try {
        localStorage.setItem(BG_TINT_KEY, tint);
      } catch (e) {}
      applyBgTint(tint);
      // The color wash only renders on the light theme — switch to it so
      // picking a color always shows a visible result.
      if (document.documentElement.getAttribute("data-theme") !== "light") {
        try {
          localStorage.setItem(THEME_KEY, "light");
        } catch (e) {}
        applyTheme("light");
      }
    });
  });

  function updateClock() {
    const now = new Date();
    el("clock").textContent = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    el("date").textContent = now.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  function parseEventDate(event) {
    if (event.allDay) {
      const [y, m, d] = event.start.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date(event.start);
  }

  // "YYYY-MM-DD" parses as UTC midnight in JS, which can display as the
  // wrong weekday once toLocaleDateString converts it to a local timezone
  // behind UTC — build the Date from local y/m/d parts instead.
  function parseLocalDate(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function formatEventTime(event) {
    if (event.allDay) return "All day";
    return parseEventDate(event).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function formatDayHeading(event) {
    const d = parseEventDate(event);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  }

  function groupEventsByDay(events) {
    const groups = [];
    let current = null;
    for (const event of events) {
      const key = parseEventDate(event).toDateString();
      if (!current || current.key !== key) {
        current = { key, heading: formatDayHeading(event), isToday: key === new Date().toDateString(), events: [] };
        groups.push(current);
      }
      current.events.push(event);
    }
    return groups;
  }

  function renderCalendar(data) {
    const body = el("calendar-body");
    if (!data.connected) {
      body.innerHTML = `<p class="empty">Not connected. <a class="connect-google" href="/auth/google">Connect Google Calendar</a></p>`;
      return;
    }
    if (!data.events.length) {
      body.innerHTML = `<p class="empty">No upcoming events.</p>`;
      return;
    }
    const groups = groupEventsByDay(data.events);
    const html = groups
      .map((group) => {
        const items = group.events
          .map(
            (event) => `
            <li class="event-item">
              <span class="event-time">${formatEventTime(event)}</span>
              <span class="event-calendar-dot" style="background:${escapeAttr(event.calendarColor || "#6fb3ff")}"></span>
              <span class="event-title">${escapeHtml(event.title)}</span>
              ${event.calendarName ? `<span class="event-calendar-name">${escapeHtml(event.calendarName)}</span>` : ""}
              ${event.location ? `<div class="event-location">${escapeHtml(event.location)}</div>` : ""}
            </li>
          `
          )
          .join("");
        return `
          <div class="calendar-day-group">
            <div class="calendar-day-heading${group.isToday ? " is-today" : ""}">${escapeHtml(group.heading)}</div>
            <ul class="event-list">${items}</ul>
          </div>
        `;
      })
      .join("");
    body.innerHTML = html;
  }

  function renderTasks(data) {
    const body = el("tasks-body");
    if (!data.connected) {
      body.innerHTML = `<p class="empty">Not connected. <a class="connect-google" href="/auth/google">Connect Google Tasks</a></p>`;
      return;
    }
    const listsWithItems = data.lists.filter((l) => l.items.length);
    if (!listsWithItems.length) {
      body.innerHTML = `<p class="empty">No open tasks. 🎉</p>`;
      return;
    }
    const html = listsWithItems
      .map((list) => {
        const items = list.items
          .map(
            (task) => `
            <li class="task-item">
              ${task.due ? `<span class="task-due">Due ${new Date(task.due).toLocaleDateString()}</span>` : ""}
              <span class="task-title">${escapeHtml(task.title)}</span>
            </li>
          `
          )
          .join("");
        return `<div class="task-list-heading">${escapeHtml(list.title)}</div><ul class="task-list">${items}</ul>`;
      })
      .join("");
    body.innerHTML = html;
  }

  function renderNews(data) {
    const body = el("news-body");
    if (!data.items.length) {
      body.innerHTML = `<p class="empty">No headlines available.</p>`;
      return;
    }
    const items = data.items
      .map(
        (item) => `
        <li class="news-item">
          <span class="news-source">${escapeHtml(item.source)}</span><br />
          <a href="${escapeAttr(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
        </li>
      `
      )
      .join("");
    body.innerHTML = `<ul class="news-list">${items}</ul>`;
  }

  function renderWeather(data) {
    const body = el("weather-body");
    if (!data) {
      body.innerHTML = `<p class="error">Weather unavailable.</p>`;
      return;
    }
    const unitLabel = data.units === "imperial" ? "°F" : "°C";
    const windUnit = data.units === "imperial" ? "mph" : "km/h";
    el("location-name").textContent = data.locationName || "";

    const today = new Date();
    const forecast = data.daily
      .map((day) => {
        const d = parseLocalDate(day.date);
        const label = d.toDateString() === today.toDateString() ? "Today" : d.toLocaleDateString([], { weekday: "long" });
        const sunrise = new Date(day.sunrise).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        const sunset = new Date(day.sunset).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        return `
          <li class="forecast-day">
            <div class="forecast-day-main">
              <span class="icon">${day.icon}</span>
              <div class="forecast-day-text">
                <span class="label">${label}</span>
                <span class="condition">${escapeHtml(day.text)}</span>
              </div>
              <div class="forecast-day-temps">
                <span class="hi">${day.high}°</span>
                <span class="lo">${day.low}°</span>
              </div>
            </div>
            <div class="forecast-day-details">
              <span title="Chance of precipitation"><span class="emoji">💧</span> ${day.precipChance}%${day.precipAmount ? ` (${day.precipAmount}${data.units === "imperial" ? "in" : "mm"})` : ""}</span>
              <span title="Max wind"><span class="emoji">💨</span> ${day.windMax} ${windUnit}</span>
              <span title="Sunrise / sunset"><span class="emoji">🌅</span> ${sunrise} · <span class="emoji">🌇</span> ${sunset}</span>
            </div>
          </li>
        `;
      })
      .join("");

    body.innerHTML = `
      <div class="weather-current">
        <span class="weather-icon">${data.current.icon}</span>
        <div>
          <div class="weather-temp">${data.current.temperature}${unitLabel}</div>
          <div class="weather-meta">${data.current.text} · Feels like ${data.current.feelsLike}${unitLabel}</div>
          <div class="weather-meta">Humidity ${data.current.humidity}% · Wind ${data.current.windSpeed} ${windUnit}</div>
        </div>
      </div>
      <ul class="forecast-list">${forecast}</ul>
    `;
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function escapeAttr(str) {
    return escapeHtml(str);
  }

  function renderLastUpdated(generatedAt, errors) {
    const footer = el("last-updated");
    const time = generatedAt ? new Date(generatedAt).toLocaleTimeString() : "never";
    const errorKeys = Object.keys(errors || {});
    const errorText = errorKeys.length ? ` — issues: ${errorKeys.join(", ")}` : "";
    footer.textContent = `Last updated ${time} · refreshes every ${refreshIntervalMinutes} min${errorText}`;
  }

  function renderAll(data) {
    renderCalendar(data.calendar);
    renderTasks(data.tasks);
    renderNews(data.news);
    renderWeather(data.weather);
    renderLastUpdated(data.generatedAt, data.errors);
  }

  async function loadData() {
    try {
      const res = await fetch("/api/data");
      renderAll(await res.json());
    } catch (err) {
      el("last-updated").textContent = `Failed to load data: ${err.message}`;
    }
  }

  // "Refresh now" re-fetches from calendar/weather/news/tasks right away
  // rather than just re-reading the last cached copy (which is all
  // loadData()/GET /api/data does), so the button visibly does something.
  async function refreshNow() {
    const btn = el("refresh-btn");
    btn.disabled = true;
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      if (res.ok) {
        renderAll(await res.json());
      } else {
        const err = await res.json();
        el("last-updated").textContent = `Failed to refresh: ${err.error || res.statusText}`;
      }
    } catch (err) {
      el("last-updated").textContent = `Failed to refresh: ${err.message}`;
    } finally {
      btn.disabled = false;
    }
  }

  function schedulePolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(loadData, refreshIntervalMinutes * 60 * 1000);
  }

  async function loadConfig() {
    const res = await fetch("/api/config");
    const cfg = await res.json();
    refreshIntervalMinutes = cfg.refreshIntervalMinutes;
    el("refresh-interval-input").value = refreshIntervalMinutes;
    el("news-max-items-input").value = cfg.news.maxItems;
    schedulePolling();
  }

  async function loadGoogleStatus() {
    const res = await fetch("/auth/status");
    const { connected } = await res.json();
    const statusEl = el("google-status");
    if (connected) {
      statusEl.innerHTML = `Google account: connected <button id="disconnect-btn" class="btn btn-secondary" type="button">Disconnect</button>`;
      el("disconnect-btn").addEventListener("click", async () => {
        await fetch("/auth/google/disconnect", { method: "POST" });
        await loadGoogleStatus();
        await loadData();
      });
    } else {
      statusEl.innerHTML = `Google account: not connected — <a class="connect-google" href="/auth/google">Connect</a>`;
    }
  }

  function renderNewsFeeds(feeds) {
    const list = el("news-feeds-list");
    if (!feeds.length) {
      list.innerHTML = `<li class="feed-item empty">No feeds added.</li>`;
      return;
    }
    list.innerHTML = feeds
      .map(
        (feed, i) => `
        <li class="feed-item">
          <div class="feed-item-text">
            <span class="feed-name">${escapeHtml(feed.name)}</span>
            <span class="feed-url">${escapeHtml(feed.url)}</span>
          </div>
          <button type="button" class="feed-remove-btn" data-index="${i}" title="Remove feed" aria-label="Remove ${escapeAttr(feed.name)}">&times;</button>
        </li>
      `
      )
      .join("");
    list.querySelectorAll(".feed-remove-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        const res = await fetch(`/api/news-feeds/${btn.dataset.index}`, { method: "DELETE" });
        if (res.ok) {
          const cfg = await res.json();
          renderNewsFeeds(cfg.news.feeds);
          loadData();
        } else {
          const err = await res.json();
          alert(err.error || "Failed to remove feed.");
          btn.disabled = false;
        }
      });
    });
  }

  async function loadNewsFeeds() {
    const res = await fetch("/api/config");
    const cfg = await res.json();
    renderNewsFeeds(cfg.news.feeds || []);
    el("news-max-items-input").value = cfg.news.maxItems;
  }

  el("news-feed-add-btn").addEventListener("click", async () => {
    const nameInput = el("news-feed-name-input");
    const urlInput = el("news-feed-url-input");
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    if (!name || !url) {
      alert("Enter both a name and a feed URL.");
      return;
    }
    const btn = el("news-feed-add-btn");
    btn.disabled = true;
    btn.textContent = "Adding…";
    try {
      const res = await fetch("/api/news-feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url }),
      });
      if (res.ok) {
        const cfg = await res.json();
        renderNewsFeeds(cfg.news.feeds);
        nameInput.value = "";
        urlInput.value = "";
        loadData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to add feed.");
      }
    } finally {
      btn.disabled = false;
      btn.textContent = "Add";
    }
  });

  function openSettings() {
    loadGoogleStatus();
    loadNewsFeeds();
    el("settings-modal").hidden = false;
  }

  function closeSettings() {
    el("settings-modal").hidden = true;
  }

  el("theme-btn").addEventListener("click", toggleTheme);
  el("refresh-btn").addEventListener("click", refreshNow);
  el("settings-btn").addEventListener("click", openSettings);
  el("settings-cancel").addEventListener("click", closeSettings);

  el("settings-save").addEventListener("click", async () => {
    const minutes = Number(el("refresh-interval-input").value);
    const maxItems = Number(el("news-max-items-input").value);
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshIntervalMinutes: minutes, newsMaxItems: maxItems }),
    });
    if (res.ok) {
      const cfg = await res.json();
      refreshIntervalMinutes = cfg.refreshIntervalMinutes;
      schedulePolling();
      closeSettings();
      loadData();
    } else {
      const err = await res.json();
      alert(err.error || "Failed to save settings.");
    }
  });

  initTheme();
  initBgTint();
  updateClock();
  setInterval(updateClock, 1000 * 15);
  loadConfig();
  loadData();
})();
