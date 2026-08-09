import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ARTICLE_TYPE_LABELS, classifyArticleType } from "@/lib/article-type";
import { DomesticItemSchema, NewsItemSchema } from "@/lib/types";
import { backfillArticleTypes } from "@/scripts/backfill-article-types";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

const baseNews = {
  id: "story-1",
  rank: 1,
  score: 70,
  category: "museum" as const,
  titleOriginal: "Museum names a new director",
  titleKo: "미술관, 새 관장 임명",
  summaryKo: "새 관장을 발표했습니다.",
  url: "https://example.com/story-1",
  source: "Example",
  sourceDomain: "example.com",
  discoveredVia: "direct" as const,
  resolved: true,
  publishedAt: "2026-08-08T00:00:00.000Z",
  coverage: 1,
  image: null,
  imageWidth: null,
  imageHeight: null,
};

describe("article type labels", () => {
  it("maps all stored values to Korean labels", () => {
    expect(ARTICLE_TYPE_LABELS).toEqual({
      news: "보도",
      analysis: "분석",
      interview: "인터뷰",
      review: "리뷰",
      pr: "PR",
      event: "행사안내",
    });
  });
});

describe("classifyArticleType", () => {
  it.each([
    [{ title: "Brand launches limited artist collaboration", language: "en" as const }, "pr"],
    [{ title: "Museum tickets and opening hours for August", language: "en" as const }, "event"],
    [{ title: "Q&A: in conversation with painter Lee", language: "en" as const }, "interview"],
    [{ title: "Review: a retrospective that rewrites the canon", language: "en" as const }, "review"],
    [{ title: "Analysis: what auction contraction means", language: "en" as const }, "analysis"],
    [{ title: "Museum names a new director", language: "en" as const }, "news"],
    [{ title: "브랜드, 작가 협업 상품 출시", language: "ko" as const }, "pr"],
    [{ title: "미술관 무료 관람 사전 예약 안내", language: "ko" as const }, "event"],
    [{ title: "작가와의 대화: 김민정 인터뷰", language: "ko" as const }, "interview"],
    [{ title: "전시평: 새로운 회고전을 보다", language: "ko" as const }, "review"],
    [{ title: "미술시장 전망과 거래액 분석", language: "ko" as const }, "analysis"],
    [{ title: "국립미술관 새 관장 임명", language: "ko" as const }, "news"],
  ])("classifies $title", (input, expected) => {
    expect(classifyArticleType(input)).toBe(expected);
  });

  it("does not treat a quoted statement as an interview", () => {
    expect(classifyArticleType({ title: "Director says museum will expand", language: "en" })).toBe("news");
  });

  it("does not treat an exhibition opening as a review", () => {
    expect(classifyArticleType({ title: "Gallery opens Lee Ufan exhibition", language: "en" })).toBe("news");
  });

  it("applies PR before event when both signals appear", () => {
    expect(classifyArticleType({ title: "Brand launches sponsored exhibition with free admission", language: "en" })).toBe("pr");
  });
});

describe("stored article type compatibility", () => {
  it("defaults an old international row to news", () => {
    expect(NewsItemSchema.parse(baseNews).articleType).toBe("news");
  });

  it("defaults an old domestic row to news", () => {
    const parsed = DomesticItemSchema.parse({
      rank: 1,
      score: 60,
      category: "artist",
      title: "작가 개인전 개최",
      summary: "",
      url: "https://example.com/domestic",
      source: "예시일보",
      publishedAt: "2026-08-08T00:00:00.000Z",
      coverage: 1,
      resolved: true,
      image: null,
    });
    expect(parsed.articleType).toBe("news");
  });

  it("backfills international and domestic rows without changing ranks or scores", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "artnews-types-"));
    roots.push(root);
    await fs.mkdir(path.join(root, "daily"), { recursive: true });
    const payload = {
      date: "2026-08-08",
      generatedAt: "2026-08-08T09:00:00+09:00",
      briefing: {
        headline: "기관",
        distribution: { market: 0, museum: 1, fair: 0, artist: 0, general: 0 },
        focus: [],
      },
      domestic: {
        headline: "국내",
        distribution: { market: 0, museum: 0, fair: 0, artist: 1, general: 0 },
        items: [{
          rank: 1,
          score: 55,
          category: "artist",
          title: "작가와의 대화: 김민정 인터뷰",
          summary: "",
          url: "https://example.com/ko",
          source: "예시일보",
          publishedAt: "2026-08-08T00:00:00.000Z",
          coverage: 1,
          resolved: true,
          image: null,
        }],
      },
      top5: [{ ...baseNews, titleOriginal: "Analysis: what museum expansion means", rank: 1, score: 70, futureField: "preserve me" }],
      karina: null,
      futureTopLevel: { enabled: true },
    };
    const file = path.join(root, "daily", "2026-08-08.json");
    await fs.writeFile(file, JSON.stringify(payload));

    expect(await backfillArticleTypes(root)).toBe(1);
    const first = JSON.parse(await fs.readFile(file, "utf8"));
    expect(first.top5[0]).toMatchObject({ rank: 1, score: 70, articleType: "analysis", futureField: "preserve me" });
    expect(first.domestic.items[0]).toMatchObject({ rank: 1, score: 55, articleType: "interview" });
    expect(first.futureTopLevel).toEqual({ enabled: true });
    expect(await backfillArticleTypes(root)).toBe(0);
  });
});
