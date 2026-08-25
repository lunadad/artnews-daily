import { execFile } from "node:child_process";
import type { FetchLike } from "./google-news";

const cache = new Map<string, string>();

const pause = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function runCurl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("curl", ["-sS", "--max-time", "8", url], (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

// Node's own fetch (undici) is fingerprinted and hard-blocked (HTTP 429, "Sorry...
// but your computer or network may be sending automated queries") by
// translate.googleapis.com, even with a browser user-agent and retries; a plain
// `curl` request to the same URL is not. Route through curl by default so the
// collector isn't silently shipping untranslated titles (as happened on the
// 2026-08-23/24 runs). Callers can still inject a fetcher for testing.
const curlFetch: FetchLike = async (input) => {
  const url = typeof input === "string" ? input : input.toString();
  const stdout = await runCurl(url);
  return new Response(stdout, { status: 200 });
};

async function translateOnce(text: string, fetcher: FetchLike): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.search = new URLSearchParams({ client: "gtx", sl: "auto", tl: "ko", dt: "t", q: text }).toString();
    const response = await fetcher(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`translation HTTP ${response.status}`);
    const payload = await response.json() as [Array<[string]>];
    const translated = payload[0].map((part) => part[0]).join("").trim();
    if (!translated) throw new Error("translation returned an empty result");
    return translated;
  } finally {
    clearTimeout(timeout);
  }
}

export async function translateToKorean(text: string, fetcher: FetchLike = curlFetch, retryDelayMs = 500): Promise<string> {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const cached = cache.get(clean);
  if (cached) return cached;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const translated = await translateOnce(clean, fetcher);
      cache.set(clean, translated);
      return translated;
    } catch (error) {
      lastError = error;
      if (attempt === 0 && retryDelayMs > 0) await pause(retryDelayMs);
    }
  }
  // Fail soft so a stuck translation endpoint never blocks collection, but log
  // loudly: silently caching the English original as "translated" is what let
  // untranslated titles reach production undetected (2026-08-23/24).
  console.warn(`[translate] falling back to original text after retry: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  cache.set(clean, clean);
  return clean;
}

export function clearTranslationCache(): void { cache.clear(); }
