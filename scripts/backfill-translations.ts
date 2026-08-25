import { promises as fs } from "node:fs";
import path from "node:path";
import { createBriefing } from "../lib/briefing";
import { DATA_ROOT } from "../lib/data";
import { clearTranslationCache, translateToKorean } from "../lib/translate";
import type { NewsItem } from "../lib/types";

// Detects rows the translate.googleapis.com fallback (see lib/translate.ts)
// silently stamped with the English original instead of a Korean translation.
const HANGUL_PATTERN = /[가-힣]/;

interface StoredInternationalItem extends Partial<NewsItem> {
  titleOriginal: string;
  titleKo: string;
  summaryKo?: string;
}

interface StoredDailyData {
  top5?: StoredInternationalItem[];
  briefing?: unknown;
  [key: string]: unknown;
}

async function retranslateItem(item: StoredInternationalItem): Promise<boolean> {
  if (HANGUL_PATTERN.test(item.titleKo)) return false;
  const titleKo = await translateToKorean(item.titleOriginal);
  const summaryKo = item.summaryKo && !HANGUL_PATTERN.test(item.summaryKo)
    ? await translateToKorean(item.summaryKo)
    : item.summaryKo;
  if (!HANGUL_PATTERN.test(titleKo)) return false; // still untranslated; leave the file untouched
  item.titleKo = titleKo;
  item.summaryKo = summaryKo;
  return true;
}

async function backfillDir(dirName: "daily" | "karina", root: string): Promise<number> {
  const dir = path.join(root, dirName);
  let changedFiles = 0;
  const names = (await fs.readdir(dir).catch(() => [])).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();

  for (const name of names) {
    const file = path.join(dir, name);
    const payload = JSON.parse(await fs.readFile(file, "utf8")) as StoredDailyData & { items?: StoredInternationalItem[] };
    const rows = payload.top5 ?? payload.items ?? [];
    let changed = false;

    for (const item of rows) {
      if (await retranslateItem(item)) changed = true;
    }

    if (changed) {
      if (payload.top5) payload.briefing = createBriefing(payload.top5 as NewsItem[]);
      await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`);
      changedFiles += 1;
      console.log(`[backfill-translations] fixed ${path.relative(root, file)}`);
    }
  }

  return changedFiles;
}

export async function backfillTranslations(root = DATA_ROOT): Promise<number> {
  clearTranslationCache(); // an earlier run through the blocked fetch path may have cached English "translations"
  const dailyCount = await backfillDir("daily", root);
  const karinaCount = await backfillDir("karina", root);
  return dailyCount + karinaCount;
}

const isEntry = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isEntry) {
  backfillTranslations()
    .then((count) => console.log(`[backfill-translations] updated ${count} files`))
    .catch((error) => {
      console.error("[backfill-translations] fatal:", error);
      process.exitCode = 1;
    });
}
