import { describe, expect, it } from "vitest";
import { ARTICLE_TYPE_LABELS, classifyArticleType } from "@/lib/article-type";
import { DomesticItemSchema, NewsItemSchema } from "@/lib/types";

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
});
