import type { FetchLike } from "./google-news";

// DeepL API (Free tier: 500k characters/month). The unofficial
// translate.googleapis.com `gtx` endpoint this replaced started answering every
// request with HTTP 429 in late August 2026 — from GitHub Actions and home
// networks alike — so production shipped English titles for over a week.
const DEEPL_FREE_URL = "https://api-free.deepl.com/v2/translate";
const DEEPL_PRO_URL = "https://api.deepl.com/v2/translate";

// DeepL answers these with a plain status; spell out the fix in the log.
const STATUS_HINTS: Record<number, string> = {
  403: "invalid DEEPL_API_KEY",
  456: "monthly DeepL quota exhausted",
};

export interface TranslateOptions {
  apiKey?: string;
  fetcher?: FetchLike;
  retryDelayMs?: number;
}

const cache = new Map<string, string>();

const pause = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

async function requestDeepL(texts: string[], apiKey: string, fetcher: FetchLike): Promise<string[]> {
  const response = await fetcher(apiKey.endsWith(":fx") ? DEEPL_FREE_URL : DEEPL_PRO_URL, {
    method: "POST",
    headers: { authorization: `DeepL-Auth-Key ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ text: texts, target_lang: "KO" }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const hint = STATUS_HINTS[response.status];
    throw new Error(`DeepL HTTP ${response.status}${hint ? ` (${hint})` : ""}`);
  }
  const payload = await response.json() as { translations?: Array<{ text?: string }> };
  const translated = (payload.translations ?? []).map((row) => normalize(row.text ?? ""));
  if (translated.length !== texts.length || translated.some((text) => !text)) throw new Error("DeepL returned an incomplete result");
  return translated;
}

// Translates every text in a single DeepL request. Fails soft — a translation
// outage must never block collection — by returning the originals and logging;
// scripts/verify-daily.ts then turns the run red so the outage is noticed.
export async function translateManyToKorean(texts: string[], options: TranslateOptions = {}): Promise<string[]> {
  const { apiKey = process.env.DEEPL_API_KEY ?? "", fetcher = fetch, retryDelayMs = 500 } = options;
  const clean = texts.map(normalize);
  const pending = [...new Set(clean.filter((text) => text && !cache.has(text)))];

  if (pending.length && !apiKey) {
    console.warn("[translate] DEEPL_API_KEY is not set; keeping original text");
  } else if (pending.length) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const translated = await requestDeepL(pending, apiKey, fetcher);
        pending.forEach((text, index) => cache.set(text, translated[index]));
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        if (attempt === 0 && retryDelayMs > 0) await pause(retryDelayMs);
      }
    }
    if (lastError) console.warn(`[translate] falling back to original text after retry: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  }

  return clean.map((text) => (text ? cache.get(text) ?? text : ""));
}

export async function translateToKorean(text: string, options: TranslateOptions = {}): Promise<string> {
  const [translated] = await translateManyToKorean([text], options);
  return translated;
}

export function clearTranslationCache(): void { cache.clear(); }
