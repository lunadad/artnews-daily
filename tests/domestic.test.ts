import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  classifyDomesticCategory,
  domesticNoticePenalty,
  domesticKeywordPoints,
  domesticSourceWeight,
  filterDomesticCandidates,
  isDomesticHardExcluded,
  scoreDomesticCluster,
} from "@/lib/domestic";
import type { ArticleCandidate } from "@/lib/score";
import { DailyDataSchema } from "@/lib/types";

const candidate = (title: string, overrides: Partial<ArticleCandidate> = {}): ArticleCandidate => ({
  title,
  source: "테스트일보",
  sourceDomain: "example.com",
  discovery: "google",
  resolved: false,
  category: "general",
  url: `https://news.google.com/rss/articles/${encodeURIComponent(title)}`,
  publishedAt: "2026-08-02T00:00:00Z",
  image: null,
  ...overrides,
});

describe("domestic art news", () => {
  it.each([
    "이더리움 가격 급등 전망",
    "강남 아파트 청약 시작",
    "신세계 할인 쇼핑 행사",
    "서울 로컬명소 동네여행",
    "BTS 셔츠 자선 경매",
  ])("hard-excludes title noise: %s", (title) => {
    expect(isDomesticHardExcluded(candidate(title))).toBe(true);
  });

  it.each(["v.daum.net", "news.nate.com", "brunch.co.kr", "blog.naver.com", "post.naver.com", "tistory.com", "les24heures.fr"])("hard-excludes aggregator domain: %s", (domain) => {
    expect(isDomesticHardExcluded(candidate("미술관 전시 개막", { sourceDomain: domain }))).toBe(true);
  });

  it("hard-excludes the 주달 source and keeps a legitimate art article", () => {
    const blocked = candidate("전국 미술관 전시", { source: "주달" });
    const allowed = candidate("국립현대미술관 대규모 전시");
    expect(filterDomesticCandidates([blocked, allowed])).toEqual([allowed]);
  });

  it("does not confuse an ordinary co.kr publisher with blocked brunch.co.kr", () => {
    expect(isDomesticHardExcluded(candidate("미술관 전시", { sourceDomain: "sctoday.co.kr" }))).toBe(false);
  });

  it("hard-excludes domestic photo-caption corner tags", () => {
    expect(isDomesticHardExcluded(candidate("[생생갤러리] AI영상으로 새롭게 단장한 대한제국실"))).toBe(true);
  });

  it("classifies a gallery solo-show notice outside market", () => {
    expect(classifyDomesticCategory('정순이 개인전 "시간으로의 여행" 인사아트센터 G&J갤러리')).toBe("artist");
  });

  it("maps domestic publisher weights separately from international weights", () => {
    expect(domesticSourceWeight("yna.co.kr")).toBe(25);
    expect(domesticSourceWeight("www.chosun.com")).toBe(23);
    expect(domesticSourceWeight("news.mt.co.kr")).toBe(21);
    expect(domesticSourceWeight("unknown.example", "월간미술")).toBe(18);
    expect(domesticSourceWeight("unknown.example")).toBe(8);
  });

  it("deducts ten points for notice-style headlines", () => {
    expect(domesticNoticePenalty("지역 작가 초대전 관람 안내")).toBe(10);
    const now = new Date("2026-08-02T03:00:00Z");
    const regular = scoreDomesticCluster([candidate("지역 작가 전시")], now);
    const notice = scoreDomesticCluster([candidate("지역 작가 초대전")], now);
    expect(regular.score - notice.score).toBe(10);
  });

  it("raises domestic auction and art-market signals and clamps their sum at 28", () => {
    expect(domesticKeywordPoints("낙찰가 발표")).toBeGreaterThan(0);
    expect(domesticKeywordPoints("서울옥션 결과")).toBe(10);
    expect(domesticKeywordPoints("미술시장 동향")).toBe(9);
    expect(domesticKeywordPoints("서울옥션 미술시장 낙찰가 경매 결과")).toBe(28);
  });

  it("adds the market category bonus to domestic clusters", () => {
    const now = new Date("2026-08-02T03:00:00Z");
    const market = scoreDomesticCluster([candidate("분기 동향", { category: "market" })], now);
    const museum = scoreDomesticCluster([candidate("분기 동향", { category: "museum" })], now);
    expect(market.score - museum.score).toBe(15);
  });

  it("parses historical daily JSON without the optional domestic field", async () => {
    const historical = JSON.parse(await readFile(new URL("../data/daily/2026-08-01.json", import.meta.url), "utf8"));
    const parsed = DailyDataSchema.parse(historical);
    expect(parsed.domestic).toBeUndefined();
    expect(parsed.top5).toHaveLength(5);
  });
});
