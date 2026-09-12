import { afterEach, describe, expect, it, vi } from "vitest";
import { clearTranslationCache, translateManyToKorean, translateToKorean } from "@/lib/translate";

const deeplResponse = (...texts: string[]) => new Response(JSON.stringify({ translations: texts.map((text) => ({ detected_source_language: "EN", text })) }));

describe("translateManyToKorean", () => {
  afterEach(() => {
    clearTranslationCache();
    vi.restoreAllMocks();
  });

  it("sends one batched DeepL Free request with the auth header and returns translations in input order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(deeplResponse("안녕하세요", "세계"));

    const result = await translateManyToKorean(["Hello", "World"], { apiKey: "key:fx", fetcher: fetchMock, retryDelayMs: 0 });

    expect(result).toEqual(["안녕하세요", "세계"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api-free.deepl.com/v2/translate");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe("DeepL-Auth-Key key:fx");
    expect(JSON.parse(init.body)).toMatchObject({ text: ["Hello", "World"], target_lang: "KO" });
  });

  it("uses the DeepL Pro endpoint for keys without the free-tier :fx suffix", async () => {
    const fetchMock = vi.fn().mockResolvedValue(deeplResponse("안녕하세요"));

    await translateManyToKorean(["Hello"], { apiKey: "pro-key", fetcher: fetchMock, retryDelayMs: 0 });

    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.deepl.com/v2/translate");
  });

  it("keeps empty strings empty and never sends them to DeepL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(deeplResponse("안녕하세요"));

    const result = await translateManyToKorean(["", "Hello", "  "], { apiKey: "key:fx", fetcher: fetchMock, retryDelayMs: 0 });

    expect(result).toEqual(["", "안녕하세요", ""]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toEqual(["Hello"]);
  });

  it("serves repeated texts from the cache instead of paying for them twice", async () => {
    const fetchMock = vi.fn().mockResolvedValue(deeplResponse("안녕하세요"));

    await translateManyToKorean(["Hello"], { apiKey: "key:fx", fetcher: fetchMock, retryDelayMs: 0 });
    const second = await translateManyToKorean(["Hello"], { apiKey: "key:fx", fetcher: fetchMock, retryDelayMs: 0 });

    expect(second).toEqual(["안녕하세요"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once on a non-OK HTTP response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("Too many requests", { status: 429 }))
      .mockResolvedValueOnce(deeplResponse("안녕하세요"));

    const result = await translateManyToKorean(["Hello"], { apiKey: "key:fx", fetcher: fetchMock, retryDelayMs: 0 });

    expect(result).toEqual(["안녕하세요"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the original text after both attempts fail, without caching the failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const failing = vi.fn().mockRejectedValue(new Error("offline"));

    expect(await translateManyToKorean(["Hello"], { apiKey: "key:fx", fetcher: failing, retryDelayMs: 0 })).toEqual(["Hello"]);
    expect(failing).toHaveBeenCalledTimes(2);

    const recovered = vi.fn().mockResolvedValue(deeplResponse("안녕하세요"));
    expect(await translateManyToKorean(["Hello"], { apiKey: "key:fx", fetcher: recovered, retryDelayMs: 0 })).toEqual(["안녕하세요"]);
  });

  it("falls back to the original text without any request when no API key is configured", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn();

    const result = await translateManyToKorean(["Hello"], { apiKey: "", fetcher: fetchMock, retryDelayMs: 0 });

    expect(result).toEqual(["Hello"]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("DEEPL_API_KEY"));
  });

  it("reads the API key from DEEPL_API_KEY by default", async () => {
    vi.stubEnv("DEEPL_API_KEY", "env-key:fx");
    const fetchMock = vi.fn().mockResolvedValue(deeplResponse("안녕하세요"));

    await translateManyToKorean(["Hello"], { fetcher: fetchMock, retryDelayMs: 0 });

    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("authorization")).toBe("DeepL-Auth-Key env-key:fx");
    vi.unstubAllEnvs();
  });
});

describe("translateToKorean", () => {
  afterEach(() => clearTranslationCache());

  it("translates a single text through the same DeepL path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(deeplResponse("안녕하세요"));

    expect(await translateToKorean("Hello", { apiKey: "key:fx", fetcher: fetchMock, retryDelayMs: 0 })).toBe("안녕하세요");
  });
});
