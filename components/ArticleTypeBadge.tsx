import { ARTICLE_TYPE_LABELS } from "@/lib/article-type";
import type { ArticleType } from "@/lib/types";

export function ArticleTypeBadge({ type, inverse = false }: { type: ArticleType; inverse?: boolean }) {
  return (
    <span className={inverse
      ? "rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white"
      : "rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-foreground-muted"}
    >
      {ARTICLE_TYPE_LABELS[type]}
    </span>
  );
}
