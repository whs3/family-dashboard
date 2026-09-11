import { Router } from "express";
import googleAuth from "../services/googleAuth.js";
import scheduler from "../services/scheduler.js";

const router = Router();

router.get("/google", (req, res) => {
  try {
    const url = googleAuth.getAuthUrl();
    res.redirect(url);
  } catch (err) {
    res.status(500).send(`Google auth is not configured: ${err.message}`);
  }
});

router.get("/google/callback", async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    return res.status(400).send(`Google authorization failed: ${error}`);
  }
  if (!code) {
    return res.status(400).send("Missing authorization code.");
  }
  try {
    await googleAuth.handleCallback(code);
    scheduler.refresh().catch((err) => console.error("Post-auth refresh failed:", err));
    res.redirect("/?connected=1");
  } catch (err) {
    res.status(500).send(`Failed to complete Google authorization: ${err.message}`);
  }
});

router.post("/google/disconnect", (req, res) => {
  googleAuth.disconnect();
  scheduler.refresh().catch((err) => console.error("Post-disconnect refresh failed:", err));
  res.json({ ok: true });
});

router.get("/status", (req, res) => {
  res.json({ connected: googleAuth.hasStoredToken() });
});

export default router;
