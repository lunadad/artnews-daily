import type { DailyData } from "@/lib/types";
import { BriefingCard } from "./BriefingCard";
import { CalendarPicker } from "./CalendarPicker";
import { KarinaSection } from "./KarinaSection";
import { ThumbGrid } from "./ThumbGrid";

export function DailyDashboard({ data, dates, today }: { data: DailyData; dates: string[]; today: string }) {
  const formatted = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" }).format(new Date(`${data.date}T00:00:00+09:00`));
  return <>
    <section><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[0.12em] text-accent">TODAY&apos;S PICKS</p><h1 className="mt-1 text-xl font-black tracking-[-0.03em] sm:text-2xl">오늘의 아트 뉴스 {data.top5.length}</h1></div><div className="flex items-center gap-3"><p className="hidden text-sm text-foreground-muted sm:block">{formatted}</p><CalendarPicker dates={dates} currentDate={data.date} today={today} /></div></div><p className="mt-2 text-sm text-foreground-muted sm:hidden">{formatted}</p><div className="mt-5"><ThumbGrid items={data.top5} /></div>{data.partial ? <p className="mt-3 text-xs text-foreground-subtle">일부 소스 수집이 지연되어 확보된 기사만 표시합니다.</p> : null}</section>
    {data.domestic?.items.length ? <BriefingCard domestic={data.domestic} /> : null}
    {data.karina ? <KarinaSection data={data.karina} /> : null}
  </>;
}
