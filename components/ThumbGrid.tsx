import type { NewsItem } from "@/lib/types";
import { ThumbTile } from "./ThumbTile";

export function orderThumbGridItems(items: NewsItem[]): NewsItem[] {
  const featuredIndex = items.reduce((bestIndex, item, index) => {
    if (!item.image) return bestIndex;
    return bestIndex < 0 || item.score > items[bestIndex].score ? index : bestIndex;
  }, -1);
  if (featuredIndex <= 0) return items;
  return [items[featuredIndex], ...items.slice(0, featuredIndex), ...items.slice(featuredIndex + 1)];
}

export function ThumbGrid({ items }: { items: NewsItem[] }) {
  const orderedItems = orderThumbGridItems(items);
  return <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:grid-rows-2 sm:gap-3 sm:min-h-[430px]">{orderedItems.map((item, index) => <ThumbTile key={item.id} item={item} featured={index === 0} eager />)}</div>;
}
