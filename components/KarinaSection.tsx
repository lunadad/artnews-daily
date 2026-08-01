import type { KarinaData } from "@/lib/types";

export function KarinaSection({ data }: { data: KarinaData }) {
  const date = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(`${data.date}T00:00:00+09:00`));
  return (
    <section className="pt-12">
      <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[0.12em] text-accent">KARINA 09:00</p><h2 className="mt-1 text-xl font-black tracking-[-0.03em] sm:text-2xl">카리나 브리핑</h2></div><p className="text-xs text-foreground-subtle">{date} 발송</p></div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{data.items.map((item) => <a key={`${item.rank}-${item.url}`} href={item.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_0_rgba(0,0,0,0.02)]"><div className="relative aspect-square bg-surface-muted">{item.image ? <img src={`/api/thumb?u=${encodeURIComponent(item.image)}`} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" /> : <span className="absolute inset-0 grid place-items-center text-3xl font-black text-foreground-subtle">{item.source.slice(0, 1)}</span>}</div><div className="p-3"><p className="line-clamp-3 text-sm font-semibold leading-snug">{item.titleKo}</p><p className="mt-2 text-xs text-foreground-subtle">{item.source}</p></div></a>)}</div>
    </section>
  );
}
