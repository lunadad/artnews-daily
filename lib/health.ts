import type { DailyData, NewsItem } from "./types";

const HANGUL_PATTERN = /[가-힣]/;

export interface HealthReport {
  errors: string[];
  warnings: string[];
}

export interface HealthContext {
  previousKarinaPresent: boolean;
  // The previous day's top5, or null when that file does not exist.
  previousTop5: NewsItem[] | null;
}

const untranslatedCount = (top5: NewsItem[]) => top5.filter((item) => !HANGUL_PATTERN.test(item.titleKo)).length;

// Post-collection sanity check. Every external dependency (translation, Google
// News resolution, the local Hermes cron jobs) fails soft by design, so without
// this the collect run stays green while the dashboard quietly degrades.
//
// Translation is not guaranteed at collect time: without DEEPL_API_KEY the
// collector ships English and the Hermes `artnews-translate` job on the Mac fills
// in Korean afterwards. So today's English titles are only a warning, and it is
// an error only when the previous day's file was never translated.
export function checkDailyHealth(daily: Pick<DailyData, "top5" | "domestic">, context: HealthContext): HealthReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const previousUntranslated = context.previousTop5 ? untranslatedCount(context.previousTop5) : 0;
  if (previousUntranslated) errors.push(`previous day's ${previousUntranslated}/${context.previousTop5!.length} international titles are still untranslated — is the Hermes artnews-translate job (and the Mac) running?`);

  const untranslated = untranslatedCount(daily.top5);
  if (untranslated) warnings.push(`${untranslated}/${daily.top5.length} international titles are untranslated at collect time; the Hermes artnews-translate job should fill them in`);
  if (daily.top5.length < 5) warnings.push(`only ${daily.top5.length}/5 international stories collected`);
  const domesticCount = daily.domestic?.items.length ?? 0;
  if (domesticCount < 5) warnings.push(`only ${domesticCount}/5 domestic stories collected`);
  if (!context.previousKarinaPresent) warnings.push("previous day's Karina briefing is missing — is the Hermes 09:00 cron (and the Mac) running?");

  return { errors, warnings };
}
