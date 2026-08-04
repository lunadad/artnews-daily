"use client";

import { useState } from "react";
import { CATEGORY_LABELS } from "@/lib/briefing";
import type { NewsItem } from "@/lib/types";

export function ThumbTile({ item, relativeTime, featured = false, eager = false }: { item: NewsItem; relativeTime: string | null; featured?: boolean; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  const showImage = item.image && !failed;
  return (
    <a href={item.url} target="_blank" rel="noreferrer" aria-label={item.titleKo} className={`group relative min-h-11 overflow-hidden rounded-2xl bg-surface-muted ${featured ? "col-span-2 aspect-video sm:row-span-2 sm:aspect-auto" : "aspect-square"}`}>
      {showImage ? <img src={`/api/thumb?u=${encodeURIComponent(item.image!)}`} alt="" loading={eager ? "eager" : "lazy"} fetchPriority={featured ? "high" : "auto"} decoding="async" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" /> : <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center"><span aria-hidden="true" className="text-3xl font-black text-foreground-subtle">{item.source.slice(0, 1).toUpperCase()}</span><span className="line-clamp-3 text-sm font-semibold text-foreground-muted">{item.titleKo}</span></div>}
      {showImage ? <div className="absolute inset-x-0 bottom-0 flex h-[45%] items-end bg-gradient-to-t from-black/80 to-transparent p-4 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-visible:opacity-100"><div><p className="line-clamp-1 text-sm font-semibold text-white [@media(hover:hover)]:line-clamp-2 sm:text-base">{item.titleKo}</p><p className="mt-1 text-xs text-white/75 [@media(hover:hover)]:hidden">{[item.source, relativeTime].filter(Boolean).join(" · ")}</p><p className="mt-1 hidden text-xs text-white/75 [@media(hover:hover)]:block">{item.source}</p><p className="mt-1 hidden text-xs text-white/75 [@media(hover:hover)]:block">{[CATEGORY_LABELS[item.category], item.source, relativeTime, item.coverage >= 2 ? `${item.coverage}개 매체` : null].filter(Boolean).join(" · ")}</p></div></div> : null}
    </a>
  );
}
