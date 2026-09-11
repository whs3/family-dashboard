import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import apiRoutes from "./routes/api.js";
import authRoutes from "./routes/auth.js";
import scheduler from "./services/scheduler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/api", apiRoutes);
app.use("/auth", authRoutes);
app.use(express.static(path.join(__dirname, "..", "public")));

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Family dashboard running on http://0.0.0.0:${PORT}`);
  try {
    await scheduler.start();
    console.log("Initial data refresh complete.");
  } catch (err) {
    console.error("Initial data refresh failed:", err);
  }
});
