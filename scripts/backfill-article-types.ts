import { promises as fs } from "node:fs";
import path from "node:path";
import { classifyArticleType } from "../lib/article-type";
import { DATA_ROOT } from "../lib/data";

interface StoredInternationalItem {
  articleType?: string;
  titleOriginal: string;
  summaryKo?: string;
  [key: string]: unknown;
}

interface StoredDomesticItem {
  articleType?: string;
  title: string;
  summary?: string;
  [key: string]: unknown;
}

interface StoredDailyData {
  top5?: StoredInternationalItem[];
  domestic?: { items?: StoredDomesticItem[] };
  [key: string]: unknown;
}

export async function backfillArticleTypes(root = DATA_ROOT): Promise<number> {
  const dir = path.join(root, "daily");
  let changedFiles = 0;
  const names = (await fs.readdir(dir)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();

  for (const name of names) {
    const file = path.join(dir, name);
    const payload = JSON.parse(await fs.readFile(file, "utf8")) as StoredDailyData;
    let changed = false;

    for (const item of payload.top5 ?? []) {
      if (!item.articleType) {
        item.articleType = classifyArticleType({
          title: item.titleOriginal,
          summary: item.summaryKo ?? "",
          language: "en",
        });
        changed = true;
      }
    }

    for (const item of payload.domestic?.items ?? []) {
      if (!item.articleType) {
        item.articleType = classifyArticleType({
          title: item.title,
          summary: item.summary ?? "",
          language: "ko",
        });
        changed = true;
      }
    }

    if (changed) {
      await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`);
      changedFiles += 1;
    }
  }

  return changedFiles;
}

const isEntry = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isEntry) {
  backfillArticleTypes()
    .then((count) => console.log(`[article types] updated ${count} daily files`))
    .catch((error) => {
      console.error("[article types] fatal:", error);
      process.exitCode = 1;
    });
}
