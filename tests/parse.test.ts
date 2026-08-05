import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { resolveGoogleNewsUrl } from "@/lib/google-news";
import { extractDescription, extractImageUrl, parseRss } from "@/lib/sources";

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

  it("decodes the doubly escaped URL used by live batchexecute responses", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('<main data-n-a-id="article-1" data-n-a-sg="signature-1" data-n-a-ts="1785542400"></main>'))
      .mockResolvedValueOnce(new Response(String.raw`[["wrb.fr","Fbv4je","https://example.com/story?id\\u003d123\\u0026lang\\u003dko"]]`));
    expect(await resolveGoogleNewsUrl("https://news.google.com/rss/articles/opaque", fetchMock, 0)).toEqual({ url: "https://example.com/story?id=123&lang=ko", resolved: true });
  });

  it("extracts article metadata images in og, secure-og, twitter priority order", async () => {
    const html = await readFile(new URL("./fixtures/article.html", import.meta.url), "utf8");
    expect(extractImageUrl(`${html}<meta name="twitter:image" content="https://cdn.example.com/twitter.jpg">`)).toBe("https://cdn.example.com/art.jpg");
    expect(extractImageUrl('<meta property="og:image:secure_url" content="https://cdn.example.com/secure.jpg"><meta name="twitter:image" content="https://cdn.example.com/twitter.jpg">')).toBe("https://cdn.example.com/secure.jpg");
    expect(extractImageUrl('<meta name="twitter:image" content="https://cdn.example.com/twitter.jpg">')).toBe("https://cdn.example.com/twitter.jpg");
  });

  it("normalizes protocol-relative and article-relative metadata images and rejects http", () => {
    expect(extractImageUrl('<meta property="og:image" content="//cdn.example.com/photo.jpg">', "https://news.example.com/story/1")).toBe("https://cdn.example.com/photo.jpg");
    expect(extractImageUrl('<meta property="og:image" content="/img/photo.jpg">', "https://news.example.com/story/1")).toBe("https://news.example.com/img/photo.jpg");
    expect(extractImageUrl('<meta property="og:image" content="http://cdn.example.com/photo.jpg">', "https://news.example.com/story/1")).toBeNull();
  });

  it("fails soft when article image metadata is absent or invalid", () => {
    expect(extractImageUrl("<html><head></head></html>", "https://news.example.com/story/1")).toBeNull();
    expect(extractImageUrl('<meta property="og:image" content="not a url">')).toBeNull();
  });

  it("prefers og:description to the standard description", () => {
    const html = '<meta name="description" content="standard"><meta property="og:description" content="open graph">';
    expect(extractDescription(html)).toBe("open graph");
    expect(extractDescription('<meta name="description" content="standard">')).toBe("standard");
  });
});
