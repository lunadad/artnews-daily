import type { NewsItem } from "@/lib/types";
import { ThumbTile } from "./ThumbTile";

export function ThumbGrid({ items }: { items: NewsItem[] }) {
  return <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:grid-rows-2 sm:gap-3 sm:min-h-[430px]">{items.map((item, index) => <ThumbTile key={item.id} item={item} featured={index === 0} />)}</div>;
}
