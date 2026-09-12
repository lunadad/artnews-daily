import { describe, expect, it } from "vitest";
import { checkDailyHealth } from "@/lib/health";
import type { DailyData, DomesticItem, NewsItem } from "@/lib/types";

const newsItem = (rank: number, titleOriginal: string, titleKo: string): NewsItem => ({
  id: `id${rank}`, rank, score: 50, category: "museum", articleType: "news",
  titleOriginal, titleKo, summaryKo: "", url: `https://example.com/${rank}`,
  source: "ARTnews", sourceDomain: "artnews.com", discoveredVia: "direct", resolved: true,
  publishedAt: "2026-09-12T00:00:00.000Z", coverage: 1, image: null, imageWidth: null, imageHeight: null,
});

const domesticItem = (rank: number): DomesticItem => ({
  rank, score: 50, category: "museum", articleType: "news", title: `국내 기사 ${rank}`, summary: "",
  url: `https://example.kr/${rank}`, source: "연합뉴스", publishedAt: "2026-09-12T00:00:00.000Z", coverage: 1, resolved: true,
});

const translatedTop5 = [1, 2, 3, 4, 5].map((rank) => newsItem(rank, `Museum names director ${rank}`, `미술관, 관장 선임 ${rank}`));
const daily = (top5: NewsItem[], domesticCount = 5): Pick<DailyData, "top5" | "domestic"> => ({
  top5,
  domestic: { headline: "국내", distribution: { market: 0, museum: domesticCount, fair: 0, artist: 0, general: 0 }, items: Array.from({ length: domesticCount }, (_, index) => domesticItem(index + 1)) },
});

const untranslated = (count: number) => translatedTop5.map((item, index) => index < count ? { ...item, titleKo: item.titleOriginal } : item);
const healthy = { previousKarinaPresent: true, previousTop5: translatedTop5 };

describe("checkDailyHealth", () => {
  it("passes a fully translated, complete dataset", () => {
    expect(checkDailyHealth(daily(translatedTop5), healthy)).toEqual({ errors: [], warnings: [] });
  });

  it("only warns about today's untranslated titles, since the Hermes job translates them after collection", () => {
    const report = checkDailyHealth(daily(untranslated(3)), healthy);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([expect.stringContaining("3/5")]);
  });

  it("reports an error when the previous day's titles are still untranslated", () => {
    const report = checkDailyHealth(daily(translatedTop5), { ...healthy, previousTop5: untranslated(2) });
    expect(report.errors).toEqual([expect.stringContaining("2/5")]);
    expect(report.errors[0]).toContain("Hermes");
  });

  it("skips the previous-day translation check when there is no previous file", () => {
    expect(checkDailyHealth(daily(translatedTop5), { ...healthy, previousTop5: null }).errors).toEqual([]);
  });

  it("warns, without failing, about short international or domestic lists", () => {
    const report = checkDailyHealth(daily(translatedTop5.slice(0, 4), 3), healthy);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toHaveLength(2);
  });

  it("warns when the previous day's Karina briefing never arrived", () => {
    const report = checkDailyHealth(daily(translatedTop5), { ...healthy, previousKarinaPresent: false });
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([expect.stringContaining("Karina")]);
  });
});
