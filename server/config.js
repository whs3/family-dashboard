import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "data", "config.json");

let cachedConfig = null;

function load() {
  if (!cachedConfig) {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    cachedConfig = JSON.parse(raw);
  }
  return cachedConfig;
}

function save(next) {
  cachedConfig = next;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2) + "\n", "utf-8");
  return cachedConfig;
}

/** Shallow-merge a partial update into the config and persist it. */
function update(partial) {
  const current = load();
  const next = { ...current, ...partial };
  return save(next);
}

export default { load, save, update, CONFIG_PATH };
