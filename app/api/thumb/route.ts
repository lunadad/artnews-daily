import { getAllowedImageUrls } from "@/lib/data";

export const runtime = "nodejs";
const MAX_BYTES = 8 * 1024 * 1024;
const CACHE_CONTROL = "public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400";

export async function GET(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get("u");
  if (!raw || !(await getAllowedImageUrls()).has(raw)) return new Response("Not found", { status: 404 });
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return new Response("Not found", { status: 404 });
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: "follow", headers: { "user-agent": "Mozilla/5.0 ArtnewsDaily/1.0", accept: "image/*" } });
    const contentType = response.headers.get("content-type") ?? "";
    const length = Number(response.headers.get("content-length") ?? 0);
    if (!response.ok || !contentType.toLowerCase().startsWith("image/") || length > MAX_BYTES || !response.body) return new Response("Not found", { status: 404 });
    if (!length) {
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > MAX_BYTES) return new Response("Not found", { status: 404 });
      return new Response(bytes, { headers: { "content-type": contentType, "cache-control": CACHE_CONTROL } });
    }
    return new Response(response.body, { headers: { "content-type": contentType, "content-length": String(length), "cache-control": CACHE_CONTROL } });
  } catch { return new Response("Not found", { status: 404 }); }
}
