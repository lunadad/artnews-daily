import { describe, expect, it } from "vitest";
import { CATEGORY_LIMITS, clusterArticles, filterCandidates, isHardExcluded, jaccardSimilarity, keywordPoints, listiclePenalty, normalizeUrl, scoreCluster, selectTopFive, titleTokens, type ArticleCandidate } from "@/lib/score";

const candidate = (title: string, sourceDomain = "artnews.com", category: ArticleCandidate["category"] = "general", overrides: Partial<ArticleCandidate> = {}): ArticleCandidate => ({
  title,
  source: "Publisher",
  sourceDomain,
  discovery: "direct",
  resolved: true,
  category,
  url: `https://${sourceDomain}/${encodeURIComponent(title)}`,
  publishedAt: "2026-08-01T00:00:00Z",
  image: null,
  ...overrides,
});

describe("scoring and clustering", () => {
  it("normalizes tracking parameters and trailing slashes", () => expect(normalizeUrl("https://EXAMPLE.com/story/?utm_source=x&ref=y")).toBe("https://example.com/story"));

  it("uses publisher-normalized titles for Jaccard clusters", () => {
    expect(jaccardSimilarity(titleTokens("Louvre names a new museum director"), titleTokens("Louvre names new museum director today"))).toBeGreaterThanOrEqual(0.5);
    expect(clusterArticles([candidate("Louvre names a new museum director"), candidate("Louvre names new museum director today", "reuters.com")])).toHaveLength(1);
  });

  it("hard-excludes marketplace URLs, marketplace Google sources, and blocked title phrases", () => {
    const rows = [
      candidate("Painting", "artsy.net", "market", { discovery: "google", url: "https://news.google.com/rss/articles/a" }),
      candidate("Painting", "example.com", "market", { url: "https://www.1stdibs.com/art/item" }),
      candidate("Painting for sale", "example.com"),
      candidate("Artist work", "artnet.com", "artist", { url: "https://www.artnet.com/artists/name/work-for-sale" }),
    ];
    expect(rows.every(isHardExcluded)).toBe(true);
    expect(filterCandidates([...rows, candidate("Museum appoints director")])).toHaveLength(1);
  });

  it("hard-excludes entertainment URL paths but keeps dance paths", () => {
    expect(isHardExcluded(candidate("Vincent Pastore dies at 80", "nytimes.com", "artist", { url: "https://www.nytimes.com/2026/08/01/arts/television/vincent-pastore-dead.html" }))).toBe(true);
    expect(isHardExcluded(candidate("Simone Forti dies at 90", "nytimes.com", "artist", { url: "https://www.nytimes.com/2026/08/01/arts/dance/simone-forti-dead.html" }))).toBe(false);
  });

  it("keeps entertainment context when strong visual-art context is also present", () => {
    expect(isHardExcluded(candidate("Actor receives a museum retrospective", "example.com", "artist", { summary: "The actor is also a painter whose artwork is shown by the gallery." }))).toBe(false);
    expect(isHardExcluded(candidate("Actor remembered after television series", "example.com", "general"))).toBe(true);
    expect(isHardExcluded(candidate("Museum contractor completes new wing", "example.com", "museum"))).toBe(false);
  });

  it("deducts 12 for listicles and clamps at zero", () => {
    expect(listiclePenalty("8 Books We're Looking Forward To")).toBe(12);
    const normal = scoreCluster([candidate("Museum update", "unknown.test")], new Date("2026-08-10T00:00:00Z"), { includeImage: false });
    const listicle = scoreCluster([candidate("8 Books to Read", "unknown.test")], new Date("2026-08-10T00:00:00Z"), { includeImage: false });
    expect(normal.score - listicle.score).toBe(12);
    expect(listicle.score).toBeGreaterThanOrEqual(0);
  });

  it("counts coverage by registrable publisher domain, not source labels", () => {
    const cluster = [
      candidate("Same museum event", "artnews.com", "museum", { source: "ARTnews" }),
      candidate("Same museum event", "www.artnews.com", "museum", { source: "Art News Magazine", url: "https://news.google.com/rss/articles/1", discovery: "google", resolved: false }),
      candidate("Same museum event", "reuters.com", "museum", { source: "Reuters" }),
    ];
    expect(scoreCluster(cluster).coverage).toBe(2);
  });

  it("adds the five-point image bonus only during stage five", () => {
    const articles = [candidate("Sotheby's record sale", "artnews.com", "market", { image: "https://example.com/a.jpg" })];
    const stage3 = scoreCluster(articles, new Date("2026-08-01T03:00:00Z"), { includeImage: false });
    const stage5 = scoreCluster(articles, new Date("2026-08-01T03:00:00Z"), { includeImage: true });
    expect(stage5.score - stage3.score).toBe(5);
  });

  it("scores an otherwise identical market cluster exactly 15 points above museum", () => {
    const now = new Date("2026-08-01T03:00:00Z");
    const market = scoreCluster([candidate("Quarterly update", "artnews.com", "market")], now, { includeImage: false });
    const museum = scoreCluster([candidate("Quarterly update", "artnews.com", "museum")], now, { includeImage: false });
    expect(market.score - museum.score).toBe(15);
  });

  it("clamps stacked market keyword signals at 28 without changing non-market signals", () => {
    expect(keywordPoints("sold for by Sotheby's art market collector")).toBe(28);
    expect(keywordPoints("museum director restitution")).toBe(13);
  });

  it("allows three market stories while holding other categories to two", () => {
    expect(CATEGORY_LIMITS).toMatchObject({ market: 3, museum: 2 });
    const clusters = [[100, "market"], [99, "market"], [98, "market"], [97, "market"], [96, "museum"], [95, "museum"], [94, "museum"], [93, "artist"]]
      .map(([score, category], index) => ({ representative: candidate(String(score), `source${index}.test`, category as ArticleCandidate["category"]), articles: [], coverage: 1, score: score as number }));
    const selected = selectTopFive(clusters);
    expect(selected).toHaveLength(5);
    expect(selected.filter((item) => item.representative.category === "market")).toHaveLength(3);
    expect(selected.filter((item) => item.representative.category === "museum")).toHaveLength(2);
    expect(selected.map((item) => item.score)).not.toContain(97);
    expect(selected.map((item) => item.score)).not.toContain(94);
  });

  it("selects at least three publisher domains when enough eligible clusters exist", () => {
    const clusters = [
      [100, "artnews.com", "market"], [99, "artnews.com", "museum"], [98, "artnews.com", "artist"],
      [80, "theartnewspaper.com", "fair"], [70, "reuters.com", "general"], [60, "frieze.com", "market"],
    ].map(([score, domain, category]) => ({ representative: candidate(String(score), String(domain), category as ArticleCandidate["category"]), articles: [], coverage: 1, score: score as number }));
    const selected = selectTopFive(clusters);
    expect(new Set(selected.map((item) => item.representative.sourceDomain)).size).toBeGreaterThanOrEqual(3);
  });
});
