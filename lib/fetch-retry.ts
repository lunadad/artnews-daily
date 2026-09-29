import type { FetchLike } from "./google-news";

// Google News RSS answered every request with HTTP 503 for about 15 seconds on
// 2026-09-29 07:40 KST, which emptied the domestic briefing. Transient statuses
// and network errors are retried with a growing delay; other statuses return as-is.
const isTransient = (status: number) => status === 429 || status >= 500;
const pause = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export interface RetryOptions {
  delaysMs?: number[];
  timeoutMs?: number;
  fetcher?: FetchLike;
}

export async function fetchWithRetry(url: string, init: RequestInit = {}, options: RetryOptions = {}): Promise<Response> {
  const { delaysMs = [3_000, 10_000], timeoutMs, fetcher = fetch } = options;
  for (let attempt = 0; ; attempt += 1) {
    const isLast = attempt >= delaysMs.length;
    try {
      // Each attempt gets a fresh timeout signal; a shared one would already be spent.
      const response = await fetcher(url, timeoutMs ? { ...init, signal: AbortSignal.timeout(timeoutMs) } : init);
      if (isLast || !isTransient(response.status)) return response;
    } catch (error) {
      if (isLast) throw error;
    }
    if (delaysMs[attempt] > 0) await pause(delaysMs[attempt]);
  }
}
