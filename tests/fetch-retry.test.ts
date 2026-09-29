import { describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "@/lib/fetch-retry";

describe("fetchWithRetry", () => {
  it("retries transient 503s and returns the first successful response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("<rss/>", { status: 200 }));

    const response = await fetchWithRetry("https://example.com/feed", {}, { delaysMs: [0, 0], fetcher: fetchMock });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries 429 and network errors", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const response = await fetchWithRetry("https://example.com/feed", {}, { delaysMs: [0, 0], fetcher: fetchMock });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry permanent client errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 404 }));

    const response = await fetchWithRetry("https://example.com/feed", {}, { delaysMs: [0, 0], fetcher: fetchMock });

    expect(response.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the last transient response once retries are exhausted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 503 }));

    const response = await fetchWithRetry("https://example.com/feed", {}, { delaysMs: [0, 0], fetcher: fetchMock });

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rethrows the last network error once retries are exhausted", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    await expect(fetchWithRetry("https://example.com/feed", {}, { delaysMs: [0], fetcher: fetchMock })).rejects.toThrow("fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
