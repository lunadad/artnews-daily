import { describe, expect, it } from "vitest";
import { DIRECT_FEEDS, GOOGLE_QUERIES, isTitleEcho, sourceWeight } from "@/lib/sources";

describe("isTitleEcho", () => {
  const title = "Louisville’s Speed Art Museum Names New Director";

  it("flags Google News descriptions that only repeat the headline and publisher", () => {
    expect(isTitleEcho("Louisville’s Speed Art Museum Names New Director Artforum", title)).toBe(true);
    expect(isTitleEcho("Louisville s Speed Art Museum Names New Director  Artforum", title)).toBe(true);
  });

  it("treats a missing or blank summary as an echo", () => {
    expect(isTitleEcho(undefined, title)).toBe(true);
    expect(isTitleEcho("   ", title)).toBe(true);
  });

  it("keeps a real standfirst", () => {
    expect(isTitleEcho("The Kentucky museum has hired a curator from the Whitney to lead it.", title)).toBe(false);
  });
});

describe("source configuration", () => {
  it("includes every verified direct feed", () => {
    expect(new Map(DIRECT_FEEDS)).toEqual(new Map([
      ["ARTnews", "https://www.artnews.com/feed/"],
      ["The Art Newspaper", "https://www.theartnewspaper.com/rss.xml"],
      ["Hyperallergic", "https://hyperallergic.com/feed/"],
      ["Artforum", "https://www.artforum.com/feed/"],
    ]));
  });

  it("maps the added publishers to their configured weights", () => {
    expect(sourceWeight("hyperallergic.com")).toBe(18);
    expect(sourceWeight("www.artforum.com")).toBe(25);
    expect(sourceWeight("news.artnet.com")).toBe(25);
    expect(sourceWeight("artnet.com")).toBe(25);
  });

  it("includes obituary and museum appointment discovery queries", () => {
    expect(GOOGLE_QUERIES).toContain("artist dies gallery museum");
    expect(GOOGLE_QUERIES).not.toContain("artist dies obituary");
    expect(GOOGLE_QUERIES).toContain("museum appoints director");
  });
});
