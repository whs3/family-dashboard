import { Router } from "express";
import config from "../config.js";
import scheduler from "../services/scheduler.js";
import googleAuth from "../services/googleAuth.js";

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

export default router;
