import { describe, expect, it } from "vitest";
import { loadWeeklyReport } from "@/lib/weekly-data";
import { buildWeeklyReport, classifyWeeklyTopics, WEEKLY_TOPIC_LABELS } from "@/lib/weekly";
import type { ArticleType, Category, DailyData } from "@/lib/types";

function international(overrides: Partial<DailyData["top5"][number]> = {}): DailyData["top5"][number] {
  return {
    id: "i1",
    rank: 1,
    score: 80,
    category: "market",
    articleType: "news",
    titleOriginal: "Auction market report",
    titleKo: "경매 시장 보고서",
    summaryKo: "",
    url: "https://artnews.com/story",
    source: "ARTnews",
    sourceDomain: "artnews.com",
    discoveredVia: "direct",
    resolved: true,
    publishedAt: "2026-08-08T00:00:00.000Z",
    coverage: 2,
    image: null,
    imageWidth: null,
    imageHeight: null,
    ...overrides,
  };
}

function domestic(overrides: Partial<NonNullable<DailyData["domestic"]>["items"][number]> = {}): NonNullable<DailyData["domestic"]>["items"][number] {
  return {
    rank: 1,
    score: 60,
    category: "museum" as Category,
    articleType: "analysis" as ArticleType,
    title: "미술관 정책 분석",
    summary: "기관 운영과 법률 변화",
    url: "https://example.kr/story",
    source: "예시일보",
    publishedAt: "2026-08-08T01:00:00.000Z",
    coverage: 1,
    resolved: true,
    image: null,
    ...overrides,
  };
}

function distribution(categories: Category[]): Record<Category, number> {
  return categories.reduce<Record<Category, number>>((counts, category) => {
    counts[category] += 1;
    return counts;
  }, { market: 0, museum: 0, fair: 0, artist: 0, general: 0 });
}

function day(date: string, top5 = [international()], domesticItems = [domestic()]): DailyData {
  return {
    date,
    generatedAt: `${date}T09:00:00+09:00`,
    briefing: { headline: "주간", distribution: distribution(top5.map((item) => item.category)), focus: [] },
    domestic: { headline: "국내", distribution: distribution(domesticItems.map((item) => item.category)), items: domesticItems },
    top5,
    karina: null,
  };
}

describe("weekly topic classification", () => {
  it("returns at most a primary and secondary topic", () => {
    expect(classifyWeeklyTopics({ title: "Museum exhibition restitution lawsuit", summary: "Biennale gallery auction", category: "museum" })).toEqual(["institution", "exhibition"]);
  });

  it("does not double-count a keyword contained in a longer matched phrase", () => {
    expect(classifyWeeklyTopics({ title: "Lawsuit museum", summary: "", category: "general" })).toEqual(["institution", "law-policy"]);
  });

  it("falls back from the stored category", () => {
    expect(classifyWeeklyTopics({ title: "Unspecified update", summary: "", category: "fair" })).toEqual(["fair"]);
  });

  it("exposes the fixed Korean topic names", () => {
    expect(WEEKLY_TOPIC_LABELS.market).toBe("경매·시장");
    expect(WEEKLY_TOPIC_LABELS["law-policy"]).toBe("법률·정책");
  });
});

describe("buildWeeklyReport", () => {
  it("deduplicates normalized URLs before counting", () => {
    const report = buildWeeklyReport([
      day("2026-08-08", [international()], []),
      day("2026-08-07", [international({ id: "i2", url: "https://artnews.com/story?utm_source=x", score: 75 })], []),
    ]);
    expect(report.totalArticles).toBe(1);
  });

  it("deduplicates the same normalized title within a date", () => {
    const report = buildWeeklyReport([
      day("2026-08-08", [international({ titleKo: "경매 시장, 새 기록" })], [
        domestic({ title: "경매 시장 새 기록", score: 40 }),
      ]),
    ]);
    expect(report.totalArticles).toBe(1);
    expect(report.internationalArticles).toBe(1);
  });

  it("uses primary 100%, secondary 50%, date/source bonuses, and cross-scope bonus", () => {
    const report = buildWeeklyReport([
      day("2026-08-08", [international({ score: 80, titleOriginal: "Museum auction", summaryKo: "" })], [
        domestic({ score: 60, title: "미술관 경매 동향", summary: "" }),
      ]),
    ]);
    const market = report.topics.find((topic) => topic.topic === "market")!;
    expect(market.importance).toBe(140);
    expect(market.uniqueDates).toBe(1);
    expect(market.uniqueSources).toBe(2);
    expect(market.trendScore).toBe(168);
    expect(market.scopes).toEqual(["international", "domestic"]);
  });

  it("counts international and domestic article types with direct totals", () => {
    const report = buildWeeklyReport([day("2026-08-08")]);
    expect(report.typeDistribution.find((row) => row.type === "news")).toMatchObject({ total: 1, international: 1, domestic: 0 });
    expect(report.typeDistribution.find((row) => row.type === "analysis")).toMatchObject({ total: 1, international: 0, domestic: 1 });
  });

  it("returns three leading topics, deterministic full ranking, and one daily leader", () => {
    const report = buildWeeklyReport([day("2026-08-08")]);
    expect(report.leadingTopics).toEqual(report.topics.filter((topic) => topic.articleCount > 0).slice(0, 3));
    expect(report.dailyTrends).toHaveLength(1);
    expect(report.dailyTrends[0].date).toBe("2026-08-08");
  });

  it("returns an explicit empty report", () => {
    expect(buildWeeklyReport([])).toMatchObject({
      days: 0,
      totalArticles: 0,
      internationalArticles: 0,
      domesticArticles: 0,
      leadingTopics: [],
      dailyTrends: [],
    });
  });

  it("skips missing and rejected days and reports the dates it could load", async () => {
    const valid = day("2026-08-08");
    const report = await loadWeeklyReport(
      async () => ["2026-08-08", "2026-08-07", "2026-08-06"],
      async (date) => {
        if (date === "2026-08-08") return valid;
        if (date === "2026-08-07") return null;
        throw new Error("malformed retained data");
      },
    );
    expect(report.days).toBe(1);
    expect(report.startDate).toBe("2026-08-08");
    expect(report.endDate).toBe("2026-08-08");
  });
});
