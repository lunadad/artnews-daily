import { describe, expect, it } from "vitest";
import { orderThumbGridItems } from "@/components/ThumbGrid";
import type { NewsItem } from "@/lib/types";

const item = (rank: number, image: string | null): NewsItem => ({
  id: String(rank),
  rank,
  score: 100 - rank,
  category: "general",
  articleType: "news",
  titleOriginal: `Story ${rank}`,
  titleKo: `기사 ${rank}`,
  summaryKo: `요약 ${rank}`,
  url: `https://example.com/${rank}`,
  source: "Example",
  sourceDomain: "example.com",
  discoveredVia: "direct",
  resolved: true,
  publishedAt: "2026-08-02T00:00:00.000Z",
  coverage: 1,
  image,
  imageWidth: null,
  imageHeight: null,
});

describe("ThumbGrid featured selection", () => {
  it("moves the highest-ranked item with an image into the featured slot", () => {
    const items = [item(1, null), item(2, null), item(3, "https://example.com/3.jpg"), { ...item(4, "https://example.com/4.jpg"), score: 50 }, item(5, null)];
    const ordered = orderThumbGridItems(items);
    expect(ordered.map((entry) => entry.rank)).toEqual([3, 1, 2, 4, 5]);
    expect(items.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it("preserves order when every image is null", () => {
    const items = [1, 2, 3, 4, 5].map((rank) => item(rank, null));
    expect(orderThumbGridItems(items)).toBe(items);
    expect(orderThumbGridItems(items).map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 5]);
  });
});
