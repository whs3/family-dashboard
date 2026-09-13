import Parser from "rss-parser";

const parser = new Parser({ timeout: 10000 });

async function getHeadlines({ feeds = [], maxItems = 8 } = {}) {
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return (parsed.items || []).map((item) => ({
        source: feed.name,
        title: item.title,
        link: item.link,
        publishedAt: item.isoDate || item.pubDate || null,
      }));
    })
  );

  // Each feed's own items, newest first.
  const perFeedItems = results.map((r) =>
    r.status === "fulfilled"
      ? [...r.value].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
      : []
  );

  // Round-robin across feeds in configured order, rather than one flat
  // sort-by-date across all of them — a handful of high-volume wires
  // (e.g. Reuters, BBC) publish so much more often than a lower-volume
  // commentary site that a flat sort would crowd the latter out of the
  // list entirely, even though its feed loaded fine.
  const items = [];
  for (let round = 0; items.length < maxItems && perFeedItems.some((list) => round < list.length); round++) {
    for (const list of perFeedItems) {
      if (items.length >= maxItems) break;
      if (round < list.length) items.push(list[round]);
    }
  }

  const failedFeeds = results
    .map((r, i) => (r.status === "rejected" ? feeds[i].name : null))
    .filter(Boolean);

  return { items, failedFeeds };
}

export default { getHeadlines };
