import Link from "next/link";
import { getAvailableDates, getDailyData } from "@/lib/data";

export const revalidate = 300;

export default async function ArchivePage() {
  const dates = await getAvailableDates();
  const records = (await Promise.all(dates.map(getDailyData))).filter((record) => record !== null);
  return <section><p className="text-xs font-bold tracking-[0.12em] text-accent">ARCHIVE</p><h1 className="mt-1 text-xl font-black tracking-[-0.03em] sm:text-2xl">최근 7일의 아트 뉴스</h1><div className="mt-5 grid gap-4">{records.map((data) => <Link key={data.date} href={`/archive/${data.date}`} className="rounded-2xl border border-border bg-surface p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-colors hover:border-accent sm:p-5"><div className="flex items-start justify-between gap-4"><div><time className="text-xs font-bold tracking-[0.08em] text-accent">{data.date}</time><h2 className="mt-1 font-bold tracking-[-0.02em]">{data.briefing.headline}</h2></div><span className="text-foreground-subtle" aria-hidden="true">→</span></div><div className="mt-4 flex h-16 gap-2 overflow-hidden sm:h-20">{data.top5.map((item) => <div key={item.id} className="relative min-w-0 flex-1 overflow-hidden rounded-lg bg-surface-muted">{item.image ? <img src={`/api/thumb?u=${encodeURIComponent(item.image)}`} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" /> : <span className="absolute inset-0 grid place-items-center text-sm font-black text-foreground-subtle">{item.source.slice(0, 1)}</span>}</div>)}</div></Link>)}</div></section>;
}
