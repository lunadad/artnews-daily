import type { DailyData } from "./types";

const HANGUL_PATTERN = /[가-힣]/;

export interface HealthReport {
  errors: string[];
  warnings: string[];
}

// Post-collection sanity check. Every external dependency (DeepL, Google News
// resolution, the local Hermes Karina cron) fails soft by design, so without
// this the collect run stays green while the dashboard quietly degrades.
export function checkDailyHealth(daily: Pick<DailyData, "top5" | "domestic">, options: { previousKarinaPresent: boolean }): HealthReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const untranslated = daily.top5.filter((item) => !HANGUL_PATTERN.test(item.titleKo)).length;
  if (untranslated) errors.push(`${untranslated}/${daily.top5.length} international titles are untranslated — check DEEPL_API_KEY and the DeepL quota`);

  if (daily.top5.length < 5) warnings.push(`only ${daily.top5.length}/5 international stories collected`);
  const domesticCount = daily.domestic?.items.length ?? 0;
  if (domesticCount < 5) warnings.push(`only ${domesticCount}/5 domestic stories collected`);
  if (!options.previousKarinaPresent) warnings.push("previous day's Karina briefing is missing — is the Hermes 09:00 cron (and the Mac) running?");

  return { errors, warnings };
}
