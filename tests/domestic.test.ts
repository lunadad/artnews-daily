import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  classifyDomesticCategory,
  clusterDomesticArticles,
  DOMESTIC_EVENT_SIMILARITY_THRESHOLD,
  domesticCoverageBonus,
  domesticEventSignature,
  domesticEventSimilarity,
  domesticNoticePenalty,
  domesticKeywordPoints,
  domesticQualityCoverage,
  domesticSourceFloorPenalty,
  domesticSourceWeight,
  filterDomesticCandidates,
  isDomesticHardExcluded,
  scoreDomesticCluster,
} from "@/lib/domestic";
import { selectTopFive, type ArticleCandidate } from "@/lib/score";
import { DailyDataSchema, DomesticItemSchema } from "@/lib/types";

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
  const seoulAuctionTitles = [
    '서울옥션 "올해 경매 낙찰 총액 682억…지난해 연간 실적 돌파"',
    "서울옥션, 7월까지 낙찰총액 682억원…작년 연간 실적 돌파",
    '서울옥션, 오프라인 경매 호조…"7개월 만에 연간 낙찰액 경신"',
  ];
  const unrelatedTitles = [
    "광주미술관, 어린이 도슨트 42명 눈높이 전시 해설 나서",
    "충남교육청 갤러리 이음, 김정미 작가 개인전 ‘존재에 물음’ 개최",
    "국립현대미술관, 도쿄문화재연구소와 한일 미술교류사 공동 연구",
    "한국화가 조영순 개인전 '사라진 동물의 수호 서사'",
    "강릉시립미술관 솔올 김종학 전시",
    "김창열미술관, 전시형 라이브 퍼포먼스 '미술관에서의 춤' 개최",
    "이재용, 올 상반기 개인 배당액 728억 1위…정몽구·정몽준 뒤이어",
  ];

  it("clusters all three Seoul Auction reports with the Korean event signature", () => {
    for (let left = 0; left < seoulAuctionTitles.length; left += 1) {
      for (let right = left + 1; right < seoulAuctionTitles.length; right += 1) {
        expect(domesticEventSimilarity(domesticEventSignature(seoulAuctionTitles[left]), domesticEventSignature(seoulAuctionTitles[right])))
          .toBeGreaterThanOrEqual(DOMESTIC_EVENT_SIMILARITY_THRESHOLD);
      }
    }
    const articles = [
      candidate(seoulAuctionTitles[0], { source: "뉴시스", sourceDomain: "newsis.com", url: "https://newsis.com/article" }),
      candidate(seoulAuctionTitles[1], { source: "한국경제", sourceDomain: "hankyung.com", url: "https://hankyung.com/article" }),
      candidate(seoulAuctionTitles[2], { source: "뉴스핀", sourceDomain: "newspim.com", url: "https://newspim.com/article" }),
    ];
    const clusters = clusterDomesticArticles(articles);
    expect(clusters).toHaveLength(1);
    const scored = scoreDomesticCluster(clusters[0]);
    expect(scored.coverage).toBe(3);
    expect(scored.representative.source).toBe("뉴시스");
  });

  it("does not merge any pair among unrelated domestic fixtures", () => {
    let checkedPairs = 0;
    for (let left = 0; left < unrelatedTitles.length; left += 1) {
      for (let right = left + 1; right < unrelatedTitles.length; right += 1) {
        expect(domesticEventSimilarity(domesticEventSignature(unrelatedTitles[left]), domesticEventSignature(unrelatedTitles[right])))
          .toBeLessThan(DOMESTIC_EVENT_SIMILARITY_THRESHOLD);
        checkedPairs += 1;
      }
    }
    expect(checkedPairs).toBe(21);
    expect(clusterDomesticArticles(unrelatedTitles.map((title, index) => candidate(title, {
      sourceDomain: `unrelated${index}.test`,
      url: `https://unrelated${index}.test/article`,
    })))).toHaveLength(unrelatedTitles.length);
  });

  it.each([
    [
      "日에 남은 韓 근현대 미술자료 디지털화 추진",
      "日 소장 韓 근현대 미술 자료 한곳에…디지털 아카이브 구축 나선다",
    ],
    [
      "추경호 대구시장, 주말 맞아 미술관 현장 점검",
      "추경호 대구시장, 대구간송미술관·대구미술관 방문해 시민 의견 청취",
    ],
  ])("matches Korean compound-noun variants: %s", (left, right) => {
    expect(domesticEventSimilarity(domesticEventSignature(left), domesticEventSignature(right)))
      .toBeGreaterThanOrEqual(DOMESTIC_EVENT_SIMILARITY_THRESHOLD);
    expect(clusterDomesticArticles([
      candidate(left, { url: "https://left.test/article" }),
      candidate(right, { url: "https://right.test/article" }),
    ])).toHaveLength(1);
  });

  it("does not substring-match one-character tokens", () => {
    expect(domesticEventSimilarity(new Set(["日"]), new Set(["日에"]))).toBe(0);
    expect(domesticEventSimilarity(new Set(["한"]), new Set(["한곳에"]))).toBe(0);
  });

  it("uses identical images only as a same-publisher clustering signal", () => {
    const image = "https://cdn.example.com/shared.jpg";
    const first = candidate("근현대 미술자료 디지털화 추진", {
      sourceDomain: "news.example.com",
      url: "https://news.example.com/a",
      image,
    });
    const unrelated = candidate("추경호 대구시장 현장 점검", {
      sourceDomain: "m.example.com",
      url: "https://m.example.com/b",
      image,
    });
    expect(clusterDomesticArticles([first, unrelated])).toHaveLength(1);

    const otherPublisher = { ...unrelated, sourceDomain: "other.test", url: "https://other.test/b" };
    expect(clusterDomesticArticles([first, otherPublisher])).toHaveLength(2);

    const nullImage = { ...unrelated, image: null, url: "https://m.example.com/null" };
    expect(clusterDomesticArticles([{ ...first, image: null }, nullImage])).toHaveLength(2);
  });

  it("separates the Gwangju museum release from an unrelated Incheon docent story", () => {
    const gwangju = "광주미술관, 어린이 도슨트 42명 눈높이 전시 해설 나서";
    const incheon = "인천시, 어린이 도슨트 프로그램 참여자 모집";
    expect(domesticEventSimilarity(domesticEventSignature(gwangju), domesticEventSignature(incheon))).toBe(0);
    expect(clusterDomesticArticles([
      candidate(gwangju, { url: "https://gwangju.test/article" }),
      candidate(incheon, { url: "https://incheon.test/article" }),
    ])).toHaveLength(2);
  });

  it("normalizes Korean numeric units and never merges empty signatures", () => {
    expect(domesticEventSignature("서울옥션 682억")).toEqual(domesticEventSignature("서울옥션 682억원"));
    expect(domesticEventSignature("올해 경매 낙찰 총액")).toEqual(new Set());
    expect(domesticEventSimilarity(new Set(), new Set())).toBe(0);
    expect(clusterDomesticArticles([
      candidate("올해 경매 낙찰 총액", { url: "https://empty-a.test/article" }),
      candidate("작년 연간 실적 돌파", { url: "https://empty-b.test/article" }),
    ])).toHaveLength(2);
  });

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
    expect(domesticSourceWeight("www.chosun.com")).toBe(26);
    expect(domesticSourceWeight("yna.co.kr")).toBe(24);
    expect(domesticSourceWeight("news.kbs.co.kr")).toBe(20);
    expect(domesticSourceWeight("seoul.co.kr")).toBe(26);
    expect(domesticSourceWeight("artkoreatv.com")).toBe(18);
    expect(domesticSourceWeight("sj-ccnews.com")).toBe(8);
  });

  it("uses quality-weighted coverage for bonuses and the no-quality penalty", () => {
    const articlesFor = (sources: Array<[string, string]>) => sources.map(([source, sourceDomain], index) => candidate(`품질 커버리지 ${index}`, {
      source,
      sourceDomain,
      url: `https://${sourceDomain}/article-${index}`,
    }));

    const mixed = articlesFor([["뉴시스", "newsis.com"], ["한국경제", "hankyung.com"], ["뉴스핌", "newspim.com"]]);
    expect(domesticQualityCoverage(mixed)).toBe(2);
    expect(domesticCoverageBonus(domesticQualityCoverage(mixed))).toBe(24);
    expect(scoreDomesticCluster(mixed).qualityCoverage).toBe(2);

    const syndicated = articlesFor(Array.from({ length: 9 }, (_, index) => [`지역지 ${index}`, `local-${index}.test`]));
    expect(domesticQualityCoverage(syndicated)).toBe(0);
    expect(domesticCoverageBonus(domesticQualityCoverage(syndicated))).toBe(0);
    expect(domesticSourceFloorPenalty(domesticQualityCoverage(syndicated))).toBe(15);
    expect(scoreDomesticCluster(syndicated)).toMatchObject({ coverage: 9, qualityCoverage: 0 });

    const majorDaily = articlesFor([["동아일보", "donga.com"]]);
    expect(domesticQualityCoverage(majorDaily)).toBe(1);
    expect(domesticCoverageBonus(domesticQualityCoverage(majorDaily))).toBe(12);
    expect(domesticSourceFloorPenalty(domesticQualityCoverage(majorDaily))).toBe(0);

    const specialist = articlesFor([["아트코리아TV", "artkoreatv.com"]]);
    expect(domesticSourceWeight(specialist[0].sourceDomain, specialist[0].source)).toBe(18);
    expect(domesticQualityCoverage(specialist)).toBe(1);
    expect(domesticSourceFloorPenalty(domesticQualityCoverage(specialist))).toBe(0);
  });

  it("hard-excludes non-art and product-PR stories", () => {
    expect(isDomesticHardExcluded(candidate("이재용, 올 상반기 개인 배당액 728억 1위…정몽구·정몽준 뒤이어"))).toBe(true);
    expect(isDomesticHardExcluded(candidate("쿠오카, 유영국 화백의 작품 세계를 향으로 재해석한 한정판 프레그런스 컬렉션", {
      summary: "서울시립미술관 전시를 기념해 출시한 향수 컬렉션",
    }))).toBe(true);
  });

  it("keeps legitimate museum and art-market stories", () => {
    expect(isDomesticHardExcluded(candidate("국립현대미술관, 도쿄문화재연구소와 한일 미술교류사 공동 연구"))).toBe(false);
    const auction = candidate("서울옥션 근현대미술 경매 낙찰총액 120억");
    expect(isDomesticHardExcluded(auction)).toBe(false);
    expect(classifyDomesticCategory(auction.title)).toBe("market");
    expect(isDomesticHardExcluded(candidate("미술관 전시 기념 한정판 굿즈 출시"))).toBe(false);
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

  it("parses historical domestic items that have no image field", async () => {
    const historical = JSON.parse(await readFile(new URL("../data/daily/2026-08-02.json", import.meta.url), "utf8"));
    const parsed = DailyDataSchema.parse(historical);
    expect(parsed.domestic?.items).toHaveLength(5);
    expect(parsed.domestic?.items.every((item) => item.image === undefined)).toBe(true);
  });

  it("keeps image-null items and preserves domestic scores and ranking when images are added", () => {
    const titles = ["서울옥션 낙찰가 발표", "국립미술관 소장품 공개", "작가 회고전 개막"];
    const withoutImages = titles.map((title, index) => scoreDomesticCluster([candidate(title, { image: null, url: `https://news.example.com/${index}` })]));
    const withImages = titles.map((title, index) => scoreDomesticCluster([candidate(title, { image: `https://cdn.example.com/${index}.jpg`, url: `https://news.example.com/${index}` })]));
    expect(withImages.map(({ score }) => score)).toEqual(withoutImages.map(({ score }) => score));
    expect(selectTopFive(withImages).map(({ representative }) => representative.title)).toEqual(selectTopFive(withoutImages).map(({ representative }) => representative.title));
    expect(DomesticItemSchema.parse({
      rank: 1,
      score: withoutImages[1].score,
      category: "museum",
      title: "국립미술관 소장품 공개",
      summary: "",
      url: "https://news.example.com/story",
      source: "테스트일보",
      publishedAt: "2026-08-02T00:00:00.000Z",
      coverage: 1,
      resolved: true,
      image: null,
    }).image).toBeNull();
  });
});
