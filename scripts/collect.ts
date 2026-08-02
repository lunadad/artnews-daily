import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createBriefing } from "../lib/briefing";
import { DATA_ROOT, pruneDataFiles } from "../lib/data";
import { classifyDomesticCategory, createDomesticHeadline, domesticGoogleFeedUrl, DOMESTIC_GOOGLE_QUERIES, filterDomesticCandidates, scoreDomesticCluster } from "../lib/domestic";
import { resolveGoogleNewsUrl } from "../lib/google-news";
import { clusterArticles, filterCandidates, normalizeUrl, scoreCluster, selectTopFive, type ArticleCandidate, type ScoredCluster } from "../lib/score";
import { classifyCategory, decodeEntities, DIRECT_FEEDS, extractDescription, extractImageUrl, GOOGLE_QUERIES, googleFeedUrl, parseRss, registrableDomain } from "../lib/sources";
import { translateToKorean } from "../lib/translate";
import { DailyDataSchema, type Category, type DomesticData, type DomesticItem, type NewsItem } from "../lib/types";

const USER_AGENT = "Mozilla/5.0 (compatible; ArtnewsDaily/1.0; +https://github.com/lunadad/artnews-daily)";
const pause = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function kstDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function kstIso(date = new Date()): string {
  return new Date(date.getTime() + 9 * 3_600_000).toISOString().replace("Z", "+09:00");
}

function cleanText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
}

async function fetchText(url: string, timeoutMs = 12_000): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow", headers: { "user-agent": USER_AGENT, accept: "text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

async function collectFeed(name: string, url: string, discovery: "direct" | "google"): Promise<ArticleCandidate[]> {
  try {
    const items = parseRss(await fetchText(url), name).slice(0, discovery === "google" ? 40 : 60);
    const candidates = items.map((item): ArticleCandidate => {
      const summary = cleanText(item.description).slice(0, 300);
      return {
        title: item.title,
        url: item.link,
        source: item.source || name,
        sourceDomain: item.sourceDomain || registrableDomain(item.link),
        discovery,
        resolved: discovery === "direct",
        publishedAt: item.publishedAt,
        category: classifyCategory(`${item.title} ${summary}`),
        image: item.image,
        summary,
      };
    });
    console.log(`[stage 1] ${name}: ${candidates.length} candidates`);
    return candidates;
  } catch (error) {
    console.warn(`[stage 1] ${name} failed:`, error instanceof Error ? error.message : error);
    return [];
  }
}

async function collectDomesticFeed(query: string): Promise<ArticleCandidate[]> {
  const name = `Google KR: ${query}`;
  try {
    const items = parseRss(await fetchText(domesticGoogleFeedUrl(query)), name).slice(0, 40);
    const candidates = items.map((item): ArticleCandidate => ({
      title: item.title,
      url: item.link,
      source: item.source || name,
      sourceDomain: item.sourceDomain || registrableDomain(item.link),
      discovery: "google",
      resolved: false,
      publishedAt: item.publishedAt,
      category: classifyDomesticCategory(item.title),
      image: null,
    }));
    console.log(`[domestic stage 1] ${query}: ${candidates.length} candidates`);
    return candidates;
  } catch (error) {
    console.warn(`[domestic stage 1] ${query} failed:`, error instanceof Error ? error.message : error);
    return [];
  }
}

async function enrichRepresentative(item: ArticleCandidate): Promise<ArticleCandidate> {
  let enriched = item;
  if (item.discovery === "google") {
    const resolution = await resolveGoogleNewsUrl(item.url);
    enriched = { ...item, url: resolution.url, resolved: resolution.resolved };
  }
  if (enriched.image?.startsWith("https://") || !enriched.resolved) return enriched;
  try {
    const image = extractImageUrl(await fetchText(enriched.url, 8_000));
    return { ...enriched, image: image?.startsWith("https://") ? image : null };
  } catch { return enriched; }
}

async function enrichTopClusters(clusters: ScoredCluster[]): Promise<void> {
  for (const cluster of clusters.slice(0, 12)) {
    const representative = cluster.representative;
    const enriched = await enrichRepresentative(representative);
    const index = cluster.articles.indexOf(representative);
    if (index >= 0) cluster.articles[index] = enriched;
    cluster.representative = enriched;
    if (representative.discovery === "google") await pause(500);
  }
}

async function enrichDomesticClusters(clusters: ScoredCluster[]): Promise<void> {
  for (const cluster of clusters.slice(0, 8)) {
    const representative = cluster.representative;
    const resolution = await resolveGoogleNewsUrl(representative.url);
    let summary: string | undefined;
    if (resolution.resolved) {
      try {
        const description = extractDescription(await fetchText(resolution.url, 8_000));
        const cleaned = description ? cleanText(decodeEntities(description)).slice(0, 300) : "";
        summary = cleaned || undefined;
      } catch {
        // A missing or blocked article page must not prevent the domestic briefing.
      }
    }
    const enriched = { ...representative, url: resolution.url, resolved: resolution.resolved, summary, image: null };
    const index = cluster.articles.indexOf(representative);
    if (index >= 0) cluster.articles[index] = enriched;
    cluster.representative = enriched;
    await pause(500);
  }
}

function domesticDistribution(items: DomesticItem[]): Record<Category, number> {
  const distribution: Record<Category, number> = { market: 0, museum: 0, fair: 0, artist: 0, general: 0 };
  for (const item of items) distribution[item.category] += 1;
  return distribution;
}

async function collectDomestic(now: Date): Promise<DomesticData> {
  const candidates = (await Promise.all(DOMESTIC_GOOGLE_QUERIES.map((query) => collectDomesticFeed(query)))).flat();
  const filtered = filterDomesticCandidates(candidates);
  const preliminary = clusterArticles(filtered)
    .map((articles) => scoreDomesticCluster(articles, now))
    .sort((a, b) => b.score - a.score);
  console.log(`[domestic stages 2-3] ${candidates.length} collected, ${filtered.length} after filters, ${preliminary.length} clusters`);
  await enrichDomesticClusters(preliminary);
  const top = selectTopFive(preliminary.map((cluster) => scoreDomesticCluster(cluster.articles, now)));
  const items: DomesticItem[] = top.map((cluster, index) => {
    const item = cluster.representative;
    return {
      rank: index + 1,
      score: cluster.score,
      category: item.category,
      title: item.title,
      summary: item.summary ?? "",
      url: normalizeUrl(item.url),
      source: item.source,
      publishedAt: new Date(item.publishedAt).toISOString(),
      coverage: cluster.coverage,
      resolved: item.resolved,
    };
  });
  return { headline: createDomesticHeadline(items), distribution: domesticDistribution(items), items };
}

export async function collect(): Promise<void> {
  const now = new Date();

  // Stage 1: metadata-only collection. Google links intentionally remain opaque here.
  const candidates = (await Promise.all([
    ...DIRECT_FEEDS.map(([name, url]) => collectFeed(name, url, "direct")),
    ...GOOGLE_QUERIES.map((query) => collectFeed(`Google: ${query}`, googleFeedUrl(query), "google")),
  ])).flat();
  if (!candidates.length) throw new Error("No candidates collected; existing data was left untouched");

  // Stages 2-3: titles are normalized by parseRss, then low-quality rows are filtered,
  // clustered, and scored without the image bonus.
  const filtered = filterCandidates(candidates);
  const preliminary = clusterArticles(filtered)
    .map((articles) => scoreCluster(articles, now, { includeImage: false }))
    .sort((a, b) => b.score - a.score);
  console.log(`[stages 2-3] ${candidates.length} collected, ${filtered.length} after filters, ${preliminary.length} clusters`);

  // Stage 4: only the twelve strongest cluster representatives pay the Google resolve
  // and article-page image fetch costs.
  await enrichTopClusters(preliminary);

  // Stage 5: recompute representative and image bonus, then enforce category diversity.
  const finalScored = preliminary.map((cluster) => scoreCluster(cluster.articles, now, { includeImage: true }));
  const top = selectTopFive(finalScored);
  if (!top.length) throw new Error("No scoreable candidates; existing data was left untouched");

  // Stage 6: translation is deliberately limited to the selected five stories.
  const top5: NewsItem[] = await Promise.all(top.map(async (cluster, index) => {
    const item = cluster.representative;
    const [titleKo, summaryKo] = await Promise.all([translateToKorean(item.title), translateToKorean((item.summary ?? item.title).slice(0, 300))]);
    return {
      id: createHash("sha1").update(normalizeUrl(item.url)).digest("hex").slice(0, 12),
      rank: index + 1,
      score: cluster.score,
      category: item.category,
      titleOriginal: item.title,
      titleKo,
      summaryKo,
      url: normalizeUrl(item.url),
      source: item.source,
      sourceDomain: registrableDomain(item.sourceDomain),
      discoveredVia: item.discovery,
      resolved: item.resolved,
      publishedAt: new Date(item.publishedAt).toISOString(),
      coverage: cluster.coverage,
      image: item.image?.startsWith("https://") ? item.image : null,
      imageWidth: null,
      imageHeight: null,
    };
  }));

  // Domestic coverage is an independent Korean Google News pipeline. It has no
  // thumbnails or translation and does not influence the international hero top5.
  const domestic = await collectDomestic(now);

  // Stage 7: briefing, atomic dataset replacement, seven-day pruning, and index rebuild.
  const date = kstDate(now);
  const payload = DailyDataSchema.parse({ date, generatedAt: kstIso(now), briefing: createBriefing(top5), domestic, top5, karina: null, ...(top5.length < 5 ? { partial: true } : {}) });
  await fs.mkdir(path.join(DATA_ROOT, "daily"), { recursive: true });
  const target = path.join(DATA_ROOT, "daily", `${date}.json`);
  const temporary = `${target}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`);
  await fs.rename(temporary, target);
  await pruneDataFiles(DATA_ROOT, date, 7);
  console.log(`[stage 7] wrote ${target} with ${top5.length} international and ${domestic.items.length} domestic stories`);
}

const isEntry = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isEntry) collect().catch((error) => { console.error("[collect] fatal:", error); process.exitCode = 1; });
