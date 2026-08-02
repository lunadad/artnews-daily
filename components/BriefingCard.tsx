import { CATEGORY_LABELS } from "@/lib/briefing";
import type { Category, DomesticData } from "@/lib/types";

export function BriefingCard({ domestic }: { domestic: DomesticData }) {
  if (!domestic.items.length) return null;
  const entries = Object.entries(domestic.distribution) as [Category, number][];
  return (
    <section id="briefing" className="scroll-mt-24 pt-12">
      <div className="flex items-end justify-between gap-4">
        <div><p className="text-xs font-bold tracking-[0.12em] text-accent">KOREAN ART NEWS</p><h2 className="mt-1 text-xl font-black tracking-[-0.03em] sm:text-2xl">오늘의 브리핑</h2></div>
        <p className="text-xs text-foreground-muted">국내 미술뉴스</p>
      </div>
      <div className="mt-4 rounded-2xl border border-border bg-surface p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] sm:p-5">
        <p className="text-lg font-bold tracking-[-0.02em]">{domestic.headline}</p>
        <div className="mt-4 flex flex-wrap gap-2">{entries.filter(([, count]) => count > 0).map(([category, count]) => <span key={category} className="rounded-full bg-tag-bg px-3 py-1 text-xs font-semibold text-tag-foreground">{CATEGORY_LABELS[category]} {count}</span>)}</div>
        <ol className="mt-5 divide-y divide-border border-t border-border">{domestic.items.map((item) => <li key={`${item.rank}-${item.url}`} className="flex gap-3 py-4 text-sm leading-relaxed"><span className="font-black text-accent">{item.rank}</span><div><a href={item.url} target="_blank" rel="noreferrer" className="font-semibold hover:text-accent">{item.title}</a>{item.summary ? <p className="mt-1 text-foreground-subtle">{item.summary}</p> : null}<p className="mt-1 text-xs text-foreground-muted">{item.source}</p></div></li>)}</ol>
      </div>
    </section>
  );
}
