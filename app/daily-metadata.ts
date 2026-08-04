import type { Metadata } from "next";
import type { DailyData } from "@/lib/types";
import { formatKoreanDate } from "@/components/date";

export function createDailyMetadata(data: DailyData, url: string): Metadata {
  const title = `오늘의 아트 뉴스 · ${formatKoreanDate(data.date).replace(/ \(.+\)$/, "")}`;
  const leadTitle = data.top5[0]?.titleKo;
  const description = `${data.briefing.headline}${leadTitle ? ` — ${leadTitle}` : ""}`.slice(0, 160);
  const image = data.top5.find((item) => item.image)?.image;
  const images = image
    ? [{ url: `/api/thumb?u=${encodeURIComponent(image)}`, width: 1200, height: 630 }]
    : undefined;

  return {
    title,
    description,
    openGraph: { title, description, type: "article", locale: "ko_KR", url, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}
