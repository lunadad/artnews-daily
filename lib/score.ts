import {
  BLOCKED_MARKETPLACE_HOSTS,
  BLOCKED_TITLE_PHRASES,
  KEYWORD_SIGNALS,
  LISTICLE_TITLE_PATTERN,
  LISTICLE_TITLE_PHRASES,
  registrableDomain,
  sourceWeight,
} from "./sources";
import type { Category } from "./types";

export interface ArticleCandidate {
  title: string;
  url: string;
  source: string;
  sourceDomain: string;
  discovery: "direct" | "google";
  resolved: boolean;
  publishedAt: string;
  category: Category;
  image: string | null;
  summary?: string;
}

export interface ScoredCluster {
  representative: ArticleCandidate;
  articles: ArticleCandidate[];
  coverage: number;
  score: number;
}

const STOP_WORDS = new Set(["a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "it", "of", "on", "or", "the", "to", "with"]);

export function normalizeUrl(input: string): string {
  const url = new URL(input);
  url.hostname = url.hostname.toLowerCase();
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || ["ref", "source", "campaign", "fbclid", "gclid"].includes(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.hash = "";
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\?$/, "");
}

export function titleTokens(title: string): Set<string> {
  return new Set(title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((word) => word.length > 1 && !STOP_WORDS.has(word)));
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const union = new Set([...a, ...b]);
  if (!union.size) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / union.size;
}

export function isHardExcluded(item: Pick<ArticleCandidate, "title" | "url" | "sourceDomain">): boolean {
  const title = item.title.toLowerCase();
  if (BLOCKED_TITLE_PHRASES.some((phrase) => title.includes(phrase))) return true;
  const sourceDomain = registrableDomain(item.sourceDomain);
  if (BLOCKED_MARKETPLACE_HOSTS.some((host) => sourceDomain === registrableDomain(host))) return true;
  try {
    const url = new URL(item.url);
    const domain = registrableDomain(url.hostname);
    if (BLOCKED_MARKETPLACE_HOSTS.some((host) => domain === registrableDomain(host))) return true;
    if (domain === "artnet.com" && /^\/artists\/[^/]+\/.+for-sale(?:\/|$)/i.test(url.pathname)) return true;
  } catch { return true; }
  return false;
}

export function listiclePenalty(title: string): number {
  const lower = title.toLowerCase();
  return LISTICLE_TITLE_PATTERN.test(title) || LISTICLE_TITLE_PHRASES.some((phrase) => lower.includes(phrase)) ? 12 : 0;
}

export function filterCandidates(items: ArticleCandidate[]): ArticleCandidate[] {
  return items.filter((item) => !isHardExcluded(item));
}

export function clusterArticles(items: ArticleCandidate[]): ArticleCandidate[][] {
  const unique = new Map<string, ArticleCandidate>();
  for (const item of items) unique.set(normalizeUrl(item.url), item);
  const clusters: ArticleCandidate[][] = [];
  for (const item of unique.values()) {
    const tokens = titleTokens(item.title);
    const cluster = clusters.find((group) => group.some((member) => jaccardSimilarity(tokens, titleTokens(member.title)) >= 0.5));
    if (cluster) cluster.push(item); else clusters.push([item]);
  }
  return clusters;
}

export function freshnessPoints(publishedAt: string, now = new Date()): number {
  const hours = Math.max(0, (now.getTime() - new Date(publishedAt).getTime()) / 3_600_000);
  if (hours <= 6) return 20;
  if (hours <= 12) return 16;
  if (hours <= 24) return 12;
  if (hours <= 48) return 6;
  return 0;
}

export function keywordPoints(text: string): number {
  const lower = text.toLowerCase();
  return Math.min(20, KEYWORD_SIGNALS.reduce((sum, signal) => sum + (signal.words.some((word) => lower.includes(word)) ? signal.points : 0), 0));
}

export function scoreCluster(articles: ArticleCandidate[], now = new Date(), options: { includeImage?: boolean } = {}): ScoredCluster {
  if (!articles.length) throw new Error("Cannot score an empty cluster");
  const includeImage = options.includeImage ?? true;
  const representative = [...articles].sort((a, b) => {
    const weight = sourceWeight(b.sourceDomain) - sourceWeight(a.sourceDomain);
    if (weight) return weight;
    if (a.discovery !== b.discovery) return a.discovery === "google" ? -1 : 1;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  })[0];
  const coverage = new Set(articles.map((item) => registrableDomain(item.sourceDomain || item.url))).size;
  const rawScore = Math.min(coverage, 5) * 12
    + Math.max(...articles.map((item) => sourceWeight(item.sourceDomain)))
    + Math.max(...articles.map((item) => freshnessPoints(item.publishedAt, now)))
    + keywordPoints(articles.map((item) => `${item.title} ${item.summary ?? ""}`).join(" "))
    + (includeImage && representative.image ? 5 : 0)
    - listiclePenalty(representative.title);
  return { representative, articles, coverage, score: Math.max(0, rawScore) };
}

export function selectTopFive(clusters: ScoredCluster[]): ScoredCluster[] {
  const sorted = [...clusters].sort((a, b) => b.score - a.score);
  const selected: ScoredCluster[] = [];
  const counts = new Map<Category, number>();
  const domains = new Set<string>();
  // Establish publisher diversity first so one prolific feed cannot dominate the
  // entire briefing. The highest-scoring eligible story from each domain wins.
  for (const cluster of sorted) {
    const category = cluster.representative.category;
    const domain = registrableDomain(cluster.representative.sourceDomain);
    if (domains.has(domain) || (counts.get(category) ?? 0) >= 2) continue;
    selected.push(cluster);
    domains.add(domain);
    counts.set(category, (counts.get(category) ?? 0) + 1);
    if (domains.size === 3 || selected.length === 5) break;
  }
  for (const cluster of sorted) {
    if (selected.includes(cluster)) continue;
    const category = cluster.representative.category;
    if ((counts.get(category) ?? 0) >= 2) continue;
    selected.push(cluster);
    domains.add(registrableDomain(cluster.representative.sourceDomain));
    counts.set(category, (counts.get(category) ?? 0) + 1);
    if (selected.length === 5) return selected.sort((a, b) => b.score - a.score);
  }
  for (const cluster of sorted) {
    if (!selected.includes(cluster)) selected.push(cluster);
    if (selected.length === 5) break;
  }
  return selected.sort((a, b) => b.score - a.score);
}
