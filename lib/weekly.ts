import { normalizeUrl } from "./score";
import { registrableDomain } from "./sources";
import { ArticleTypeSchema, type ArticleType, type Category, type DailyData } from "./types";

export const WEEKLY_TOPICS = ["market", "institution", "exhibition", "fair", "artist", "gallery", "restitution", "law-policy"] as const;
export type WeeklyTopic = typeof WEEKLY_TOPICS[number];
export type WeeklyScope = "international" | "domestic";

export const WEEKLY_TOPIC_LABELS: Record<WeeklyTopic, string> = {
  market: "경매·시장",
  institution: "미술관·기관",
  exhibition: "전시·회고전",
  fair: "아트페어·비엔날레",
  artist: "작가·수상·부고",
  gallery: "갤러리·화랑",
  restitution: "환수·문화재",
  "law-policy": "법률·정책",
};

const TOPIC_KEYWORDS: Record<WeeklyTopic, readonly string[]> = {
  market: ["auction", "sale", "market", "sotheby", "christie", "경매", "낙찰", "미술시장", "거래액"],
  institution: ["museum", "director", "curator", "institution", "미술관", "박물관", "관장", "큐레이터"],
  exhibition: ["exhibition", "retrospective", "show", "전시", "회고전", "개인전", "기획전"],
  fair: ["art fair", "biennale", "biennial", "frieze", "art basel", "아트페어", "비엔날레"],
  artist: ["artist", "painter", "sculptor", "award", "obituary", "dies", "작가", "화가", "조각가", "수상", "별세"],
  gallery: ["gallery", "dealer", "representation", "갤러리", "화랑", "전속"],
  restitution: ["restitution", "repatriation", "provenance", "heritage", "환수", "반환", "문화재", "약탈"],
  "law-policy": ["lawsuit", "court", "law", "policy", "regulation", "법원", "소송", "법률", "정책", "규제"],
};

const CATEGORY_FALLBACK: Record<Category, WeeklyTopic> = {
  market: "market",
  museum: "institution",
  fair: "fair",
  artist: "artist",
  general: "exhibition",
};

const ARTICLE_TYPES = ArticleTypeSchema.options;

export interface WeeklyArticle {
  key: string;
  date: string;
  scope: WeeklyScope;
  score: number;
  category: Category;
  articleType: ArticleType;
  title: string;
  summary: string;
  url: string;
  source: string;
  sourceKey: string;
  topics: WeeklyTopic[];
}

export interface WeeklyTopicResult {
  topic: WeeklyTopic;
  trendScore: number;
  importance: number;
  articleCount: number;
  uniqueDates: number;
  uniqueSources: number;
  scopes: WeeklyScope[];
  summary: string;
  representativeArticles: WeeklyArticle[];
  articles: WeeklyArticle[];
}

export interface ArticleTypeDistribution {
  type: ArticleType;
  total: number;
  international: number;
  domestic: number;
  percentage: number;
}

export interface DailyTrend {
  date: string;
  topic: WeeklyTopic;
  trendScore: number;
  representativeArticle: WeeklyArticle;
}

export interface WeeklyReport {
  startDate: string | null;
  endDate: string | null;
  days: number;
  totalArticles: number;
  internationalArticles: number;
  domesticArticles: number;
  leadingTopics: WeeklyTopicResult[];
  topics: WeeklyTopicResult[];
  typeDistribution: ArticleTypeDistribution[];
  dailyTrends: DailyTrend[];
}

function keywordCount(text: string, keywords: readonly string[]): number {
  const matched = keywords.filter((keyword) => text.includes(keyword));
  return matched.filter((keyword) => !matched.some((other) => other.length > keyword.length && other.includes(keyword))).length;
}

export function classifyWeeklyTopics({ title, summary = "", category }: { title: string; summary?: string; category: Category }): WeeklyTopic[] {
  const titleText = title.toLowerCase();
  const summaryText = summary.toLowerCase();
  const matches = WEEKLY_TOPICS.map((topic, index) => ({
    topic,
    index,
    score: keywordCount(titleText, TOPIC_KEYWORDS[topic]) * 2 + keywordCount(summaryText, TOPIC_KEYWORDS[topic]),
  }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 2)
    .map((match) => match.topic);
  return matches.length ? matches : [CATEGORY_FALLBACK[category]];
}

function normalizedTitle(title: string): string {
  return title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function sourceKey(url: string, source: string, storedDomain?: string): string {
  if (storedDomain) return registrableDomain(storedDomain);
  try { return registrableDomain(new URL(url).hostname); }
  catch { return source.trim().toLowerCase(); }
}

function normalizeDays(days: DailyData[]): WeeklyArticle[] {
  return days.flatMap((day) => [
    ...day.top5.map((item): WeeklyArticle => ({
      key: normalizeUrl(item.url),
      date: day.date,
      scope: "international",
      score: item.score,
      category: item.category,
      articleType: item.articleType,
      title: item.titleKo,
      summary: item.summaryKo,
      url: item.url,
      source: item.source,
      sourceKey: sourceKey(item.url, item.source, item.sourceDomain),
      topics: classifyWeeklyTopics({ title: item.titleOriginal, summary: item.summaryKo, category: item.category }),
    })),
    ...(day.domestic?.items ?? []).map((item): WeeklyArticle => ({
      key: normalizeUrl(item.url),
      date: day.date,
      scope: "domestic",
      score: item.score,
      category: item.category,
      articleType: item.articleType,
      title: item.title,
      summary: item.summary,
      url: item.url,
      source: item.source,
      sourceKey: sourceKey(item.url, item.source),
      topics: classifyWeeklyTopics({ title: item.title, summary: item.summary, category: item.category }),
    })),
  ]);
}

function deduplicate(articles: WeeklyArticle[]): WeeklyArticle[] {
  const sorted = [...articles].sort((a, b) => b.score - a.score || b.date.localeCompare(a.date) || a.url.localeCompare(b.url));
  const urls = new Set<string>();
  const titles = new Set<string>();
  return sorted.filter((article) => {
    const titleKey = `${article.date}:${normalizedTitle(article.title)}`;
    if (urls.has(article.key) || titles.has(titleKey)) return false;
    urls.add(article.key);
    titles.add(titleKey);
    return true;
  });
}

function topicResult(topic: WeeklyTopic, articles: WeeklyArticle[]): WeeklyTopicResult {
  const related = articles.filter((article) => article.topics.includes(topic));
  const importance = related.reduce((sum, article) => sum + (article.topics[0] === topic ? article.score : Math.round(article.score * 0.5)), 0);
  const uniqueDates = new Set(related.map((article) => article.date)).size;
  const uniqueSources = new Set(related.map((article) => article.sourceKey)).size;
  const scopeSet = new Set(related.map((article) => article.scope));
  const scopes = (["international", "domestic"] as const).filter((scope) => scopeSet.has(scope));
  const trendScore = importance + uniqueDates * 8 + uniqueSources * 4 + (scopes.length === 2 ? 12 : 0);
  const crossScope = scopes.length === 2 ? " 국제·국내 보도에 함께 나타났습니다." : "";
  return {
    topic,
    trendScore,
    importance,
    articleCount: related.length,
    uniqueDates,
    uniqueSources,
    scopes,
    summary: related.length ? `${uniqueDates}일 동안 ${related.length}건, ${uniqueSources}개 매체가 관련 소식을 다뤘습니다.${crossScope}` : "관련 기사가 집계되지 않았습니다.",
    representativeArticles: [...related].sort((a, b) => b.score - a.score || b.date.localeCompare(a.date) || a.url.localeCompare(b.url)).slice(0, 3),
    articles: related,
  };
}

function compareTopics(a: WeeklyTopicResult, b: WeeklyTopicResult): number {
  return b.trendScore - a.trendScore
    || b.importance - a.importance
    || b.uniqueDates - a.uniqueDates
    || b.uniqueSources - a.uniqueSources
    || WEEKLY_TOPICS.indexOf(a.topic) - WEEKLY_TOPICS.indexOf(b.topic);
}

function buildDailyTrends(articles: WeeklyArticle[]): DailyTrend[] {
  const dates = [...new Set(articles.map((article) => article.date))].sort().reverse();
  return dates.flatMap((date) => {
    const dailyArticles = articles.filter((article) => article.date === date);
    const leader = WEEKLY_TOPICS.map((topic) => topicResult(topic, dailyArticles)).filter((topic) => topic.articleCount > 0).sort(compareTopics)[0];
    return leader ? [{ date, topic: leader.topic, trendScore: leader.trendScore, representativeArticle: leader.representativeArticles[0] }] : [];
  });
}

export function buildWeeklyReport(days: DailyData[]): WeeklyReport {
  const dates = [...new Set(days.map((day) => day.date))].sort();
  const articles = deduplicate(normalizeDays(days));
  const topics = WEEKLY_TOPICS.map((topic) => topicResult(topic, articles)).sort(compareTopics);
  const typeDistribution = ARTICLE_TYPES.map((type): ArticleTypeDistribution => {
    const typed = articles.filter((article) => article.articleType === type);
    return {
      type,
      total: typed.length,
      international: typed.filter((article) => article.scope === "international").length,
      domestic: typed.filter((article) => article.scope === "domestic").length,
      percentage: articles.length ? Math.min(100, Math.max(0, Math.round(typed.length / articles.length * 100))) : 0,
    };
  });
  return {
    startDate: dates[0] ?? null,
    endDate: dates.at(-1) ?? null,
    days: dates.length,
    totalArticles: articles.length,
    internationalArticles: articles.filter((article) => article.scope === "international").length,
    domesticArticles: articles.filter((article) => article.scope === "domestic").length,
    leadingTopics: topics.filter((topic) => topic.articleCount > 0).slice(0, 3),
    topics,
    typeDistribution,
    dailyTrends: buildDailyTrends(articles),
  };
}
