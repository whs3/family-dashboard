import { google } from "googleapis";
import googleAuth from "./googleAuth.js";

async function getTaskLists({ maxItems = 20 } = {}) {
  const auth = googleAuth.getAuthorizedClient();
  if (!auth) {
    return { connected: false, lists: [] };
  }

  const tasksApi = google.tasks({ version: "v1", auth });
  const listsRes = await tasksApi.tasklists.list();
  const taskLists = listsRes.data.items || [];

  const lists = [];
  for (const taskList of taskLists) {
    const itemsRes = await tasksApi.tasks.list({
      tasklist: taskList.id,
      showCompleted: false,
      maxResults: maxItems,
    });
    const items = (itemsRes.data.items || [])
      .filter((t) => t.status !== "completed")
      .map((t) => ({
        id: t.id,
        title: t.title || "(No title)",
        due: t.due || null,
        notes: t.notes || null,
      }));
    lists.push({ id: taskList.id, title: taskList.title, items });
  }

  return { connected: true, lists };
}

export default { getTaskLists };
