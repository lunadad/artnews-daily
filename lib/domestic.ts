import { categoryPoints, freshnessPoints, KEYWORD_POINTS_CAP, type ArticleCandidate, type ScoredCluster } from "./score";
import { INSTITUTION_NOTICE_PHRASES, registrableDomain } from "./sources";
import type { Category, DomesticItem } from "./types";

export const DOMESTIC_GOOGLE_QUERIES = [
  "국립현대미술관",
  "리움미술관",
  "서울시립미술관",
  "미술품 경매 서울옥션",
  "한국 미술시장",
  "비엔날레 한국관",
  "갤러리 전시 개막 서울",
  "단색화 작가",
  "미술관 전시",
  "작가 개인전 미술",
] as const;

const BLOCKED_DOMAINS = [
  "daum.net",
  "nate.com",
  "brunch.co.kr",
  "naver.com",
  "tistory.com",
  "les24heures.fr",
] as const;

const BLOCKED_SOURCE_NAMES = ["v.daum.net", "네이트", "브런치", "blog.naver.com", "post.naver.com", "네이버 블로그", "네이버 포스트"] as const;

const BLOCKED_TITLE_WORDS = [
  "이더리움", "비트코인", "코인", "etf", "상장", "투자분석",
  "청약", "분양", "아파트", "입주",
  "신세계", "롯데백화점", "현대백화점", "쇼핑", "할인",
  "로컬명소", "동네여행", "둘레길", "서울에디션", "명소", "관광",
] as const;

const NOTICE_WORDS = ["초대전", "공모", "수상자 발표", "관람 안내", "주간분양"] as const;

const ART_DOMAIN_TOKENS = [
  "미술", "아트", "작가", "작품", "전시", "갤러리", "화랑", "미술관", "박물관", "비엔날레", "아트페어",
  "회화", "조각", "설치미술", "공예", "도예", "판화", "사진전", "개인전", "기획전", "소장품", "큐레이터",
  "화백", "경매", "낙찰", "옥션", "컬렉터", "아트테크", "예술가", "조형",
] as const;

const PRODUCT_PR_TOKENS = [
  "한정판", "프레그런스", "컬래버", "콜라보", "협업 상품", "굿즈", "에디션 출시", "신제품", "출시",
  "패키지 리뉴얼", "향수", "화장품", "리미티드",
] as const;

const PRODUCT_PR_ART_EXCEPTIONS = ["경매", "낙찰", "전시", "미술관", "비엔날레"] as const;

const DOMESTIC_DOMAIN_WEIGHTS: Record<string, number> = {
  "chosun.com": 26,
  "joongang.co.kr": 26,
  "donga.com": 26,
  "hani.co.kr": 26,
  "khan.co.kr": 26,
  "hankookilbo.com": 26,
  "seoul.co.kr": 26,
  "munhwa.com": 26,
  "yna.co.kr": 24,
  "newsis.com": 24,
  "news1.kr": 24,
  "mk.co.kr": 21,
  "hankyung.com": 21,
  "mt.co.kr": 21,
  "sedaily.com": 21,
  "kbs.co.kr": 20,
  "imnews.imbc.com": 20,
  "news.sbs.co.kr": 20,
  "ytn.co.kr": 20,
  "jtbc.co.kr": 20,
  "kartprice.net": 18,
  "artworldnews.co.kr": 18,
  "artkoreatv.com": 18,
};

const SPECIALIST_SOURCE_NAMES = ["월간미술", "아트인컬처", "퍼블릭아트"] as const;

const CATEGORY_RULES: Record<Exclude<Category, "general">, readonly string[]> = {
  market: [
    "경매", "낙찰", "낙찰가", "낙찰률", "옥션", "서울옥션", "케이옥션", "소더비", "크리스티",
    "미술시장", "거래액", "거래량", "시장 규모", "아트테크", "컬렉터", "추정가", "응찰", "출품가", "매각",
  ],
  museum: ["미술관", "박물관", "관장", "소장품", "환수", "반환", "도난", "전시"],
  fair: ["비엔날레", "한국관", "베네치아", "아트페어", "키아프", "프리즈"],
  artist: ["작가", "개인전", "회고전", "단색화", "화가", "조각가"],
};

export function domesticGoogleFeedUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:3d`)}&hl=ko&gl=KR&ceid=KR:ko`;
}

function blockedDomain(input: string): boolean {
  const hostname = input.toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
  return BLOCKED_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

export function isDomesticHardExcluded(item: Pick<ArticleCandidate, "title" | "url" | "source" | "sourceDomain" | "summary">): boolean {
  const title = item.title.toLowerCase();
  const context = `${item.title} ${item.summary ?? ""}`.toLowerCase();
  if (/^\s*\[(?:생생갤러리|포토|사진|영상|화보|오늘의 사진)\]/.test(item.title)) return true;
  if (INSTITUTION_NOTICE_PHRASES.some((phrase) => context.includes(phrase))) return true;
  if (item.source.trim() === "주달") return true;
  if (BLOCKED_SOURCE_NAMES.some((name) => item.source.toLowerCase().includes(name.toLowerCase()))) return true;
  if (blockedDomain(item.sourceDomain)) return true;
  try { if (blockedDomain(new URL(item.url).hostname)) return true; }
  catch { return true; }
  if (BLOCKED_TITLE_WORDS.some((word) => title.includes(word))) return true;
  if (!ART_DOMAIN_TOKENS.some((token) => context.includes(token))) return true;
  const isProductPr = PRODUCT_PR_TOKENS.some((token) => context.includes(token));
  if (isProductPr && !PRODUCT_PR_ART_EXCEPTIONS.some((token) => title.includes(token))) return true;
  const merchandise = ["셔츠", "유니폼", "굿즈"].some((word) => title.includes(word));
  return merchandise && title.includes("경매");
}

export function filterDomesticCandidates(items: ArticleCandidate[]): ArticleCandidate[] {
  return items.filter((item) => !isDomesticHardExcluded(item));
}

export function domesticSourceWeight(domain: string, source = ""): number {
  const hostname = domain.toLowerCase().replace(/^www\./, "");
  const matchedDomain = Object.keys(DOMESTIC_DOMAIN_WEIGHTS).find((known) => hostname === known || hostname.endsWith(`.${known}`));
  const exact = matchedDomain ? DOMESTIC_DOMAIN_WEIGHTS[matchedDomain] : undefined;
  if (exact) return exact;
  return SPECIALIST_SOURCE_NAMES.some((name) => source.includes(name)) ? 18 : 8;
}

export function domesticNoticePenalty(title: string): number {
  const lower = title.toLowerCase();
  return NOTICE_WORDS.some((word) => lower.includes(word)) ? 10 : 0;
}

export function domesticSourceFloorPenalty(maxSourceWeight: number, coverage: number): number {
  return maxSourceWeight === 8 && coverage === 1 ? 15 : 0;
}

export function domesticKeywordPoints(text: string): number {
  const groups = [
    { words: ["낙찰가", "최고가 낙찰", "낙찰률", "추정가", "응찰"], points: 12 },
    { words: ["서울옥션", "케이옥션", "크리스티", "소더비", "경매사", "경매장"], points: 10 },
    { words: ["미술시장", "거래액", "거래량", "시장 규모", "아트테크", "컬렉터"], points: 9 },
    { words: ["경매", "낙찰", "출품", "매각", "판매액"], points: 7 },
    { words: ["관장", "선임", "임명", "사퇴"], points: 7 },
    { words: ["비엔날레", "베네치아", "한국관"], points: 7 },
    { words: ["환수", "반환", "도난"], points: 7 },
    { words: ["회고전", "대규모 전시"], points: 5 },
    { words: ["표절", "위작", "소송"], points: 6 },
  ];
  return Math.min(KEYWORD_POINTS_CAP, groups.reduce((sum, group) => sum + (group.words.some((word) => text.includes(word)) ? group.points : 0), 0));
}

export function classifyDomesticCategory(text: string): Category {
  let best: { category: Category; count: number } = { category: "general", count: 0 };
  for (const [category, words] of Object.entries(CATEGORY_RULES) as [Category, readonly string[]][]) {
    const count = words.filter((word) => text.includes(word)).length;
    if (count > best.count) best = { category, count };
  }
  return best.category;
}

export function scoreDomesticCluster(articles: ArticleCandidate[], now = new Date()): ScoredCluster {
  if (!articles.length) throw new Error("Cannot score an empty domestic cluster");
  const representative = [...articles].sort((a, b) => {
    const weight = domesticSourceWeight(b.sourceDomain, b.source) - domesticSourceWeight(a.sourceDomain, a.source);
    return weight || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  })[0];
  const coverage = new Set(articles.map((item) => registrableDomain(item.sourceDomain || item.url))).size;
  const maxSourceWeight = Math.max(...articles.map((item) => domesticSourceWeight(item.sourceDomain, item.source)));
  const score = Math.min(coverage, 5) * 12
    + maxSourceWeight
    + Math.max(...articles.map((item) => freshnessPoints(item.publishedAt, now)))
    + domesticKeywordPoints(articles.map((item) => `${item.title} ${item.summary ?? ""}`).join(" "))
    + categoryPoints(representative.category)
    - domesticNoticePenalty(representative.title)
    - domesticSourceFloorPenalty(maxSourceWeight, coverage);
  return { representative, articles, coverage, score: Math.max(0, score) };
}

export function createDomesticHeadline(items: DomesticItem[]): string {
  const labels: Record<Category, string> = { market: "시장·경매", museum: "미술관·기관", artist: "작가", fair: "비엔날레·아트페어", general: "미술계" };
  const counts = new Map<Category, number>();
  for (const item of items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  const category = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "general";
  return `오늘 국내 미술계는 ${labels[category]} 신호가 두드러집니다.`;
}
