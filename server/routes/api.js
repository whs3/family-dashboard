import { Router } from "express";
import config from "../config.js";
import scheduler from "../services/scheduler.js";
import googleAuth from "../services/googleAuth.js";
import newsService from "../services/news.js";

const router = Router();

router.get("/data", (req, res) => {
  res.json({ ...scheduler.getCache(), googleConnected: googleAuth.hasStoredToken() });
});

router.post("/refresh", async (req, res) => {
  try {
    const data = await scheduler.refresh();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/config", (req, res) => {
  res.json(config.load());
});

router.post("/config", (req, res) => {
  const { refreshIntervalMinutes } = req.body || {};
  const updates = {};

  if (refreshIntervalMinutes !== undefined) {
    const minutes = Number(refreshIntervalMinutes);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
      return res.status(400).json({ error: "refreshIntervalMinutes must be between 1 and 1440." });
    }
    updates.refreshIntervalMinutes = minutes;
  }

  const next = config.update(updates);
  scheduler.rescheduleNow();
  res.json(next);
});

router.post("/news-feeds", async (req, res) => {
  const name = String((req.body && req.body.name) || "").trim();
  const url = String((req.body && req.body.url) || "").trim();

  if (!name) {
    return res.status(400).json({ error: "Feed name is required." });
  }
  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: "A valid http(s) feed URL is required." });
  }

  const cfg = config.load();
  const feeds = (cfg.news && cfg.news.feeds) || [];
  if (feeds.some((f) => f.url === url)) {
    return res.status(400).json({ error: "That feed URL is already added." });
  }

  const check = await newsService.getHeadlines({ feeds: [{ name, url }], maxItems: 1 });
  if (check.failedFeeds.length) {
    return res.status(400).json({ error: "Couldn't read that feed — check the URL and try again." });
  }

  const next = config.update({ news: { ...cfg.news, feeds: [...feeds, { name, url }] } });
  await scheduler.refresh();
  res.json(next);
});

router.delete("/news-feeds/:index", async (req, res) => {
  const index = Number(req.params.index);
  const cfg = config.load();
  const feeds = (cfg.news && cfg.news.feeds) || [];

  if (!Number.isInteger(index) || index < 0 || index >= feeds.length) {
    return res.status(400).json({ error: "Feed not found." });
  }

  const nextFeeds = feeds.filter((_, i) => i !== index);
  const next = config.update({ news: { ...cfg.news, feeds: nextFeeds } });
  await scheduler.refresh();
  res.json(next);
});

export default router;
