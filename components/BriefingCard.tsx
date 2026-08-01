import { CATEGORY_LABELS } from "@/lib/briefing";
import type { Briefing, Category } from "@/lib/types";

export function BriefingCard({ briefing }: { briefing: Briefing }) {
  const entries = Object.entries(briefing.distribution) as [Category, number][];
  return (
    <section id="briefing" className="scroll-mt-24 pt-12">
      <p className="text-xs font-bold tracking-[0.12em] text-accent">DAILY BRIEFING</p>
      <h2 className="mt-1 text-xl font-black tracking-[-0.03em] sm:text-2xl">오늘의 브리핑</h2>
      <div className="mt-4 rounded-2xl border border-border bg-surface p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] sm:p-5">
        <p className="text-lg font-bold tracking-[-0.02em]">{briefing.headline}</p>
        <div className="mt-4 flex flex-wrap gap-2">{entries.filter(([, count]) => count > 0).map(([category, count]) => <span key={category} className="rounded-full bg-tag-bg px-3 py-1 text-xs font-semibold text-tag-foreground">{CATEGORY_LABELS[category]} {count}</span>)}</div>
        <ol className="mt-5 divide-y divide-border border-t border-border">{briefing.focus.map((focus, index) => <li key={focus.title} className="flex gap-3 py-4 text-sm leading-relaxed"><span className="font-black text-accent">{index + 1}</span><p><strong className="font-semibold">{focus.title}</strong><span className="text-foreground-muted"> — {focus.why}</span></p></li>)}</ol>
      </div>
    </section>
  );
}
