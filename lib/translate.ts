const cache = new Map<string, string>();

export async function translateToKorean(text: string): Promise<string> {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const cached = cache.get(clean);
  if (cached) return cached;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.search = new URLSearchParams({ client: "gtx", sl: "auto", tl: "ko", dt: "t", q: clean }).toString();
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`translation HTTP ${response.status}`);
    const payload = await response.json() as [Array<[string]>];
    const translated = payload[0].map((part) => part[0]).join("").trim() || clean;
    cache.set(clean, translated);
    return translated;
  } catch {
    cache.set(clean, clean);
    return clean;
  }
}

export function clearTranslationCache(): void { cache.clear(); }
