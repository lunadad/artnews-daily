import { execFile } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearTranslationCache, translateToKorean } from "@/lib/translate";

vi.mock("node:child_process", () => ({ execFile: vi.fn() }));

describe("translateToKorean", () => {
  afterEach(() => {
    clearTranslationCache();
    vi.mocked(execFile).mockReset();
  });

  it("retries once after a failed request and returns the translated text", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(new Response(JSON.stringify([[["안녕하세요", "Hello", null, null, 3]]])));

    const result = await translateToKorean("Hello", fetchMock, 0);

    expect(result).toBe("안녕하세요");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the original text after both attempts fail", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));

    const result = await translateToKorean("Hello", fetchMock, 0);

    expect(result).toBe("Hello");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on a non-OK HTTP response, not just a thrown error", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([[["안녕하세요", "Hello", null, null, 3]]])));

    const result = await translateToKorean("Hello", fetchMock, 0);

    expect(result).toBe("안녕하세요");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses curl instead of the global fetch by default, since Node's fetch is blocked by Google's bot wall for this endpoint", async () => {
    vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (error: Error | null, stdout: string, stderr: string) => void;
      callback(null, JSON.stringify([[["안녕하세요", "Hello", null, null, 3]]]), "");
      return {} as ReturnType<typeof execFile>;
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await translateToKorean("Hello");

    expect(result).toBe("안녕하세요");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(execFile).toHaveBeenCalledWith("curl", expect.arrayContaining(["-sS"]), expect.any(Function));
  });
});
