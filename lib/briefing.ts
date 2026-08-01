import type { Briefing, Category, NewsItem } from "./types";

export const CATEGORY_LABELS: Record<Category, string> = {
  market: "시장", museum: "기관", fair: "페어", artist: "작가", general: "종합",
};

const WHY: Record<Category, string> = {
  market: "시장 가격과 거래 흐름을 가늠할 핵심 신호입니다.",
  museum: "주요 기관의 운영과 전시 지형에 영향을 줄 소식입니다.",
  fair: "국제 미술계의 의제와 교류 흐름을 보여주는 소식입니다.",
  artist: "작가의 평가와 작품 세계를 새롭게 조명하는 계기입니다.",
  general: "미술계 전반의 흐름을 이해하는 데 주목할 소식입니다.",
};

export function createBriefing(items: NewsItem[]): Briefing {
  const distribution: Record<Category, number> = { market: 0, museum: 0, fair: 0, artist: 0, general: 0 };
  for (const item of items) distribution[item.category] += 1;
  const dominant = (Object.keys(distribution) as Category[]).sort((a, b) => distribution[b] - distribution[a])[0];
  return {
    headline: items.length ? `오늘은 ${CATEGORY_LABELS[dominant]} 신호가 가장 두드러집니다.` : "오늘의 주요 아트 뉴스를 준비하고 있습니다.",
    distribution,
    focus: items.slice(0, 3).map((item) => ({
      title: item.titleKo.length > 72 ? `${item.titleKo.slice(0, 69)}…` : item.titleKo,
      why: item.coverage > 1 ? `${item.coverage}개 매체가 함께 보도했습니다. ${WHY[item.category]}` : WHY[item.category],
    })),
  };
}
