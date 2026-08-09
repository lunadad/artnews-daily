import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";

const source = (relative: string) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");

describe("weekly report discoverability", () => {
  it("links the weekly report from desktop and mobile navigation", async () => {
    const header = await source("components/Header.tsx");
    expect(header).toContain('{ href: "/weekly", label: "주간 동향"');
    expect(header).toContain("grid-cols-4");
    expect(header.match(/item\.href === "\/weekly"/g)).toHaveLength(2);
  });

  it("includes weekly report in sitemap", async () => {
    const rows = await sitemap();
    expect(rows.some((row) => row.url === "https://artnews-daily.vercel.app/weekly")).toBe(true);
  });

  it("shows article-type badges in both story presentations", async () => {
    const [tile, briefing] = await Promise.all([
      source("components/ThumbTile.tsx"),
      source("components/BriefingCard.tsx"),
    ]);
    expect(tile).toContain("ArticleTypeBadge");
    expect(briefing).toContain("ArticleTypeBadge");
  });

  it("keeps weekly distribution directly labeled", async () => {
    const view = await source("components/WeeklyReportView.tsx");
    expect(view).toContain("전체 {row.total} · 국제 {row.international} · 국내 {row.domestic}");
    expect(view).toContain('role="list"');
  });
});
