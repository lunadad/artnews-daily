import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "@/components/time";
import { CATEGORY_LABELS } from "@/lib/briefing";

const NOW = "2026-08-04T12:00:00.000Z";

describe("formatRelativeTime", () => {
  it.each([
    ["2026-08-04T11:59:01.000Z", "방금"],
    ["2026-08-04T11:59:00.000Z", "1분 전"],
    ["2026-08-03T13:00:00.000Z", "23시간 전"],
    ["2026-08-03T11:00:00.000Z", "1일 전"],
  ])("formats the requested boundary for %s", (publishedAt, expected) => {
    expect(formatRelativeTime(publishedAt, NOW)).toBe(expected);
  });

  it("omits missing and invalid timestamps", () => {
    expect(formatRelativeTime(undefined, NOW)).toBeNull();
    expect(formatRelativeTime("not-a-date", NOW)).toBeNull();
  });
});

describe("CATEGORY_LABELS", () => {
  it("maps every stored category to its Korean label", () => {
    expect(CATEGORY_LABELS).toEqual({ market: "시장", museum: "기관", fair: "페어", artist: "작가", general: "일반" });
  });
});
