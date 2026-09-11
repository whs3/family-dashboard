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

  const items = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value);

  items.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

  const failedFeeds = results
    .map((r, i) => (r.status === "rejected" ? feeds[i].name : null))
    .filter(Boolean);

  return { items: items.slice(0, maxItems), failedFeeds };
}

export default { getHeadlines };
