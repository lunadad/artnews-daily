import { CATEGORY_LABELS } from "@/lib/briefing";
import { getAvailableDates, getDailyData } from "@/lib/data";

const SITE_URL = "https://artnews-daily.vercel.app";

export const revalidate = 3600;

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function wrapCdata(value: string): string {
  return `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

export async function GET() {
  const dates = await getAvailableDates();
  const dailyData = (await Promise.all(dates.map(getDailyData))).filter((data) => data !== null);
  const items = dailyData.flatMap((data) => [
    ...data.top5.map((item) => ({ title: item.titleKo, url: item.url, publishedAt: item.publishedAt, description: item.summaryKo, source: item.source, category: item.category })),
    ...(data.domestic?.items ?? []).map((item) => ({ title: item.title, url: item.url, publishedAt: item.publishedAt, description: item.summary, source: item.source, category: item.category })),
  ]).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  const itemXml = items.map((item) => `<item>
    <title>${escapeXml(item.title)}</title>
    <link>${escapeXml(item.url)}</link>
    <guid isPermaLink="true">${escapeXml(item.url)}</guid>
    <pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>
    <description>${wrapCdata(item.description)}</description>
    <source>${escapeXml(item.source)}</source>
    <category>${escapeXml(CATEGORY_LABELS[item.category])}</category>
  </item>`).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>아트 뉴스 데일리</title>
  <link>${SITE_URL}</link>
  <description>매일 엄선한 세계 미술계 주요 뉴스와 한글 브리핑</description>
  <language>ko</language>
${itemXml}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
