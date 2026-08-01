import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { resolveGoogleNewsUrl } from "@/lib/google-news";
import { extractImageUrl, parseRss } from "@/lib/sources";

describe("fixed RSS parsing", () => {
  it("removes only the matching Google publisher suffix and extracts source domain", async () => {
    const xml = await readFile(new URL("./fixtures/google-news.xml", import.meta.url), "utf8");
    const [item] = parseRss(xml, "Google News");
    expect(item.title).toBe("Museum Names New Director");
    expect(item.source).toBe("ARTnews");
    expect(item.sourceUrl).toBe("https://www.artnews.com");
    expect(item.sourceDomain).toBe("artnews.com");
    expect(item.link).toContain("news.google.com/rss/articles/");
  });

  it("prefers TAN enclosure over media thumbnail and reads ARTnews content:encoded image", async () => {
    const xml = await readFile(new URL("./fixtures/direct-images.xml", import.meta.url), "utf8");
    const [tan, artnews] = parseRss(xml, "Direct");
    expect(tan.image).toBe("https://cdn.sanity.io/full.jpg");
    expect(artnews.image).toBe("https://www.artnews.com/wp-content/uploads/lead.jpg?w=1024");
  });

  it("uses the documented article metadata and mocked batchexecute flow", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('<main data-n-a-id="article-1" data-n-a-sg="signature-1" data-n-a-ts="1785542400"></main>'))
      .mockResolvedValueOnce(new Response('[["wrb.fr","Fbv4je","{\\"url\\":\\"https:\\\/\\\/news.artnet.com/market/story\\"}"]]'));
    const result = await resolveGoogleNewsUrl("https://news.google.com/rss/articles/opaque", fetchMock, 0);
    expect(result).toEqual({ url: "https://news.artnet.com/market/story", resolved: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, postOptions] = fetchMock.mock.calls[1];
    expect(postOptions.method).toBe("POST");
    expect(postOptions.headers["content-type"]).toContain("application/x-www-form-urlencoded");
    const decodedRequest = new URLSearchParams(postOptions.body).get("f.req") ?? "";
    expect(decodedRequest).toContain("article-1");
    expect(decodedRequest).toContain("signature-1");
  });

  it("falls back to the Google URL after one mocked retry", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    const original = "https://news.google.com/rss/articles/opaque";
    expect(await resolveGoogleNewsUrl(original, fetchMock, 0)).toEqual({ url: original, resolved: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("extracts article metadata images in og, secure-og, twitter priority order", async () => {
    const html = await readFile(new URL("./fixtures/article.html", import.meta.url), "utf8");
    expect(extractImageUrl(`${html}<meta name="twitter:image" content="https://cdn.example.com/twitter.jpg">`)).toBe("https://cdn.example.com/art.jpg");
    expect(extractImageUrl('<meta property="og:image:secure_url" content="https://cdn.example.com/secure.jpg"><meta name="twitter:image" content="https://cdn.example.com/twitter.jpg">')).toBe("https://cdn.example.com/secure.jpg");
  });
});
