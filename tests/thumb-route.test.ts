import { beforeEach, describe, expect, it, vi } from "vitest";

const allowedImage = "https://images.example.com/domestic.jpg";
const { getAllowedImageUrls } = vi.hoisted(() => ({
  getAllowedImageUrls: vi.fn(),
}));

vi.mock("@/lib/data", () => ({ getAllowedImageUrls }));

import { GET } from "@/app/api/thumb/route";

describe("thumbnail proxy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getAllowedImageUrls.mockResolvedValue(new Set([allowedImage]));
  });

  it("passes an allowed image at or below 8MB", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Uint8Array([1]), {
      headers: { "content-type": "image/jpeg", "content-length": String(8 * 1024 * 1024) },
    }));
    const response = await GET(new Request(`https://artnews.test/api/thumb?u=${encodeURIComponent(allowedImage)}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
  });

  it("returns 404 when content-length exceeds 8MB", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Uint8Array([1]), {
      headers: { "content-type": "image/jpeg", "content-length": String(8 * 1024 * 1024 + 1) },
    }));
    const response = await GET(new Request(`https://artnews.test/api/thumb?u=${encodeURIComponent(allowedImage)}`));
    expect(response.status).toBe(404);
  });

  it("returns 404 without fetching a URL absent from retained data", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await GET(new Request(`https://artnews.test/api/thumb?u=${encodeURIComponent("https://unapproved.example/attack.jpg")}`));
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
