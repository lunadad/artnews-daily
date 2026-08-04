const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(
  publishedAt: string | null | undefined,
  now: Date | string | number = new Date(),
): string | null {
  if (!publishedAt) return null;

  const publishedTime = new Date(publishedAt).getTime();
  const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(publishedTime) || !Number.isFinite(nowTime)) return null;

  const elapsed = Math.max(0, nowTime - publishedTime);
  if (elapsed < MINUTE) return "방금";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}분 전`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}시간 전`;
  return `${Math.floor(elapsed / DAY)}일 전`;
}
