const ARTICLE_ENDPOINT = "https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je";
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36";

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface GoogleResolution {
  url: string;
  resolved: boolean;
}

const pause = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function attribute(html: string, name: string): string | null {
  return html.match(new RegExp(`${name}=["']([^"']+)["']`, "i"))?.[1] ?? null;
}

export function extractResolvedUrl(responseText: string): string | null {
  const normalized = responseText
    .replace(/\\u003d/gi, "=")
    .replace(/\\u0026/gi, "&")
    .replace(/\\\//g, "/");
  const matches = normalized.match(/https:\/\/[^\s"\\]+/g) ?? [];
  return matches.find((url) => {
    try { return new URL(url).hostname !== "news.google.com"; }
    catch { return false; }
  }) ?? null;
}

async function resolveOnce(articleUrl: string, fetcher: FetchLike): Promise<string | null> {
  const pageResponse = await fetcher(articleUrl, { headers: { "user-agent": BROWSER_UA, accept: "text/html" }, redirect: "follow" });
  if (!pageResponse.ok) throw new Error(`Google article page HTTP ${pageResponse.status}`);
  const html = await pageResponse.text();
  const articleId = attribute(html, "data-n-a-id");
  const signature = attribute(html, "data-n-a-sg");
  const timestamp = attribute(html, "data-n-a-ts");
  if (!articleId || !signature || !timestamp || !/^\d+$/.test(timestamp)) throw new Error("Google article metadata is missing");

  const innerPayload = JSON.stringify([
    "garturlreq",
    [["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1], "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
    articleId,
    timestamp,
    signature,
  ]);
  const fReq = JSON.stringify([[['Fbv4je', innerPayload, null, 'generic']]]);
  const response = await fetcher(ARTICLE_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      referer: "https://news.google.com/",
      "user-agent": BROWSER_UA,
    },
    body: new URLSearchParams({ "f.req": fReq }).toString(),
  });
  if (!response.ok) throw new Error(`Google batchexecute HTTP ${response.status}`);
  return extractResolvedUrl(await response.text());
}

export async function resolveGoogleNewsUrl(articleUrl: string, fetcher: FetchLike = fetch, retryDelayMs = 500): Promise<GoogleResolution> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const resolvedUrl = await resolveOnce(articleUrl, fetcher);
      if (resolvedUrl) return { url: resolvedUrl, resolved: true };
    } catch {
      // Fail soft after one fixed-delay retry; the Google URL remains a usable browser link.
    }
    if (attempt === 0 && retryDelayMs > 0) await pause(retryDelayMs);
  }
  return { url: articleUrl, resolved: false };
}
