import type { Category } from "./types";

export const GOOGLE_QUERIES = [
  "art auction record",
  "museum exhibition opening",
  "contemporary art market",
  "art fair Basel OR Frieze",
  "artist retrospective museum",
  "art restitution OR repatriation",
  "gallery represents artist",
  "biennale OR biennial art",
  "artist dies obituary",
  "museum appoints director",
] as const;

export const DIRECT_FEEDS = [
  ["ARTnews", "https://www.artnews.com/feed/"],
  ["The Art Newspaper", "https://www.theartnewspaper.com/rss.xml"],
  ["Hyperallergic", "https://hyperallergic.com/feed/"],
  ["Artforum", "https://www.artforum.com/feed/"],
  ["Artnet News", "https://news.artnet.com/feed"],
] as const;

export const DOMAIN_WEIGHTS: Record<string, number> = {
  "artnews.com": 25,
  "theartnewspaper.com": 25,
  "artforum.com": 25,
  "news.artnet.com": 25,
  "artnet.com": 25,
  "nytimes.com": 22,
  "theguardian.com": 22,
  "ft.com": 22,
  "reuters.com": 22,
  "apnews.com": 22,
  "hyperallergic.com": 18,
  "frieze.com": 18,
  "apollo-magazine.com": 18,
};

export const BLOCKED_MARKETPLACE_HOSTS = [
  "artsy.net",
  "1stdibs.com",
  "invaluable.com",
  "liveauctioneers.com",
  "ebay.com",
  "saatchiart.com",
] as const;

export const BLOCKED_TITLE_PHRASES = ["for sale", "buy now", "price guide", "sponsored"] as const;
export const LISTICLE_TITLE_PATTERN = /^\d+\s+(books|shows|exhibitions|things|artworks|artists|museums|reasons)\b/i;
export const LISTICLE_TITLE_PHRASES = ["to read", "gift guide", "what to see", "best of the", "roundup", "we're looking forward to", "you should"] as const;

export const KEYWORD_SIGNALS = [
  { words: ["record", "million", "sold for", "sotheby", "christie", "phillips"], points: 8 },
  { words: ["museum director", "appointed", "resigns"], points: 6 },
  { words: ["restitution", "repatriat", "looted"], points: 7 },
  { words: ["biennale", "biennial", "documenta", "venice"], points: 6 },
  { words: ["lawsuit", "fraud", "forgery"], points: 6 },
  { words: ["retrospective", "major exhibition"], points: 5 },
] as const;

export const CATEGORY_RULES: Record<Exclude<Category, "general">, readonly string[]> = {
  market: ["auction", "sotheby", "christie", "phillips", "sold", "million", "market", "gallery", "dealer"],
  museum: ["museum", "exhibition", "director", "restitution", "repatriat", "looted", "institution"],
  fair: ["fair", "basel", "frieze", "biennale", "biennial", "documenta", "venice"],
  artist: ["artist", "retrospective", "painter", "sculptor", "photographer"],
};

export function registrableDomain(input: string): string {
  try {
    const hostname = (input.includes("://") ? new URL(input).hostname : input).toLowerCase().replace(/^www\./, "");
    const labels = hostname.split(".").filter(Boolean);
    if (labels.length > 2 && labels.at(-1)?.length === 2 && ["ac", "co", "go", "ne", "or"].includes(labels.at(-2) ?? "")) return labels.slice(-3).join(".");
    return labels.length > 1 ? labels.slice(-2).join(".") : hostname;
  } catch { return input.toLowerCase().replace(/^www\./, ""); }
}

export function sourceWeight(domain: string): number {
  const hostname = domain.toLowerCase().replace(/^www\./, "");
  return DOMAIN_WEIGHTS[hostname] ?? DOMAIN_WEIGHTS[registrableDomain(hostname)] ?? 8;
}

export function classifyCategory(text: string): Category {
  const lower = text.toLowerCase();
  let best: { category: Category; count: number } = { category: "general", count: 0 };
  for (const [category, words] of Object.entries(CATEGORY_RULES) as [Category, readonly string[]][]) {
    const count = words.filter((word) => lower.includes(word)).length;
    if (count > best.count) best = { category, count };
  }
  return best.category;
}

export function googleFeedUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:2d`)}&hl=en-US&gl=US&ceid=US:en`;
}

export interface ParsedFeedItem {
  title: string;
  link: string;
  description: string;
  publishedAt: string;
  source: string;
  sourceUrl: string | null;
  sourceDomain: string;
  image: string | null;
}

export const decodeEntities = (value: string) => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));

function tag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return decodeEntities(match?.[1]?.trim() ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function rawTag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return decodeEntities(match?.[1]?.trim() ?? "");
}

function attribute(element: string | undefined, name: string): string | null {
  if (!element) return null;
  return decodeEntities(element.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"))?.[1] ?? "") || null;
}

export function stripPublisherSuffix(title: string, source: string): string {
  const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return title.replace(new RegExp(`\\s+-\\s+${escaped}\\s*$`, "i"), "").trim();
}

export function parseRss(xml: string, defaultSource: string): ParsedFeedItem[] {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(([block]) => {
    const sourceElement = block.match(/<source\b[^>]*>[\s\S]*?<\/source>/i)?.[0];
    const source = tag(block, "source") || defaultSource;
    const sourceUrl = attribute(sourceElement, "url");
    const link = tag(block, "link") || block.match(/<link>([^<]+)<\/link>/i)?.[1]?.trim() || "";
    const rawDescription = rawTag(block, "description");
    const enclosureElements = [...block.matchAll(/<enclosure\b[^>]*>/gi)].map((match) => match[0]);
    const imageEnclosure = enclosureElements.find((element) => (attribute(element, "type") ?? "").toLowerCase().startsWith("image/"));
    const mediaElement = block.match(/<media:(?:content|thumbnail)\b[^>]*>/i)?.[0];
    const contentEncoded = rawTag(block, "content:encoded");
    const image = attribute(imageEnclosure, "url")
      ?? attribute(mediaElement, "url")
      ?? extractFirstImage(contentEncoded)
      ?? extractFirstImage(rawDescription);
    const sourceDomain = registrableDomain(sourceUrl ?? link);
    return {
      title: stripPublisherSuffix(tag(block, "title"), source),
      link,
      description: rawDescription,
      publishedAt: new Date(tag(block, "pubDate") || tag(block, "dc:date") || Date.now()).toISOString(),
      source,
      sourceUrl,
      sourceDomain,
      image,
    };
  }).filter((item) => item.title && item.link);
}

export function extractFirstImage(html: string): string | null {
  const match = html.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/i)?.[1];
  return match ? decodeEntities(match) : null;
}

function metaContent(html: string, attributeName: "property" | "name", value: string): string | null {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+${attributeName}=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attributeName}=["']${escaped}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const valueFound = html.match(pattern)?.[1];
    if (valueFound) return decodeEntities(valueFound);
  }
  return null;
}

export function extractImageUrl(html: string): string | null {
  return metaContent(html, "property", "og:image")
    ?? metaContent(html, "property", "og:image:secure_url")
    ?? metaContent(html, "name", "twitter:image");
}

export function extractDescription(html: string): string | null {
  return metaContent(html, "property", "og:description")
    ?? metaContent(html, "name", "description");
}
