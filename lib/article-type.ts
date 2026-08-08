import type { ArticleType } from "./types";

export const ARTICLE_TYPE_LABELS: Record<ArticleType, string> = {
  news: "보도",
  analysis: "분석",
  interview: "인터뷰",
  review: "리뷰",
  pr: "PR",
  event: "행사안내",
};

type Language = "ko" | "en";
type Input = { title: string; summary?: string; language: Language };
type ClassifiedType = Exclude<ArticleType, "news">;

const PATTERNS: Record<Language, Record<ClassifiedType, RegExp[]>> = {
  en: {
    pr: [
      /\bpress release\b/i,
      /\bsponsored\b/i,
      /\bbrand (?:launches|unveils)\b/i,
      /\bpartnership\b/i,
      /\blimited (?:edition|collaboration)\b/i,
    ],
    event: [
      /\btickets?\b/i,
      /\bregistration\b/i,
      /\bopening hours?\b/i,
      /\badmission\b/i,
      /\bvisitor guide\b/i,
    ],
    interview: [
      /^interview\b/i,
      /^q\s*&\s*a\b/i,
      /\bin conversation with\b/i,
      /\ban interview with\b/i,
    ],
    review: [
      /^review\b/i,
      /\bexhibition review\b/i,
      /\bcritics?' take\b/i,
    ],
    analysis: [
      /^analysis\b/i,
      /\boutlook\b/i,
      /\bmarket report\b/i,
      /\bwhat .+ means\b/i,
    ],
  },
  ko: {
    pr: [/보도자료/, /협업 상품/, /한정판/, /신제품/, /공식 발표/, /후원/, /출시/],
    event: [/사전 ?예약/, /관람 ?안내/, /입장료/, /운영 ?시간/, /무료 ?관람/, /참가 ?신청/, /티켓/],
    interview: [/인터뷰/, /문답/, /작가와의 대화/, /대담/],
    review: [/전시평/, /미술평/, /비평/, /리뷰/],
    analysis: [/분석/, /전망/, /해설/, /시장 ?보고서/, /동향 ?보고서/],
  },
};

const ORDER: ClassifiedType[] = ["pr", "event", "interview", "review", "analysis"];

export function classifyArticleType({ title, summary = "", language }: Input): ArticleType {
  const titleText = title.trim();
  const context = `${titleText} ${summary}`.trim();
  for (const type of ORDER) {
    const patterns = PATTERNS[language][type];
    if (patterns.some((pattern) => pattern.test(titleText))) return type;
    if ((type === "pr" || type === "event") && patterns.some((pattern) => pattern.test(context))) return type;
  }
  return "news";
}
