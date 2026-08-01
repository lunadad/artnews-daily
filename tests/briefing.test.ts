import { describe, expect, it } from "vitest";
import { createBriefing } from "@/lib/briefing";
import type { NewsItem } from "@/lib/types";

const item = (rank: number, category: NewsItem["category"], coverage = 1): NewsItem => ({ id: String(rank), rank, score: 50, category, titleOriginal: `Title ${rank}`, titleKo: `제목 ${rank}`, summaryKo: "요약", url: `https://example.com/${rank}`, source: "ARTnews", sourceDomain: "artnews.com", discoveredVia: "direct", resolved: true, publishedAt: "2026-08-01T00:00:00.000Z", coverage, image: null, imageWidth: null, imageHeight: null });

describe("briefing", () => {
  it("aggregates distribution, chooses the dominant headline, and creates three focus rows", () => {
    const briefing = createBriefing([item(1, "market", 3), item(2, "market"), item(3, "museum"), item(4, "artist")]);
    expect(briefing.distribution).toEqual({ market: 2, museum: 1, fair: 0, artist: 1, general: 0 });
    expect(briefing.headline).toContain("시장");
    expect(briefing.focus).toHaveLength(3);
    expect(briefing.focus[0].why).toContain("3개 매체");
  });
});
