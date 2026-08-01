import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { DailyDataSchema, DataIndexSchema, KarinaDataSchema, type DailyData, type KarinaData } from "./types";

export const DATA_ROOT = path.join(process.cwd(), "data");

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export const getAvailableDates = cache(async (): Promise<string[]> => {
  try { return DataIndexSchema.parse(await readJson(path.join(DATA_ROOT, "index.json"))).dates; }
  catch { return []; }
});

export const getKarinaData = cache(async (date: string): Promise<KarinaData | null> => {
  try { return KarinaDataSchema.parse(await readJson(path.join(DATA_ROOT, "karina", `${date}.json`))); }
  catch { return null; }
});

export const getDailyData = cache(async (date: string): Promise<DailyData | null> => {
  try {
    const daily = DailyDataSchema.parse(await readJson(path.join(DATA_ROOT, "daily", `${date}.json`)));
    return { ...daily, karina: await getKarinaData(date) };
  } catch { return null; }
});

export async function getLatestDailyData(): Promise<DailyData | null> {
  const [latest] = await getAvailableDates();
  return latest ? getDailyData(latest) : null;
}

export async function getAllowedImageUrls(): Promise<Set<string>> {
  const urls = new Set<string>();
  for (const date of await getAvailableDates()) {
    const daily = await getDailyData(date);
    for (const item of daily?.top5 ?? []) if (item.image) urls.add(item.image);
    for (const item of daily?.karina?.items ?? []) if (item.image) urls.add(item.image);
  }
  return urls;
}

export function retainedDates(today: string, keepDays = 7): string[] {
  const end = new Date(`${today}T00:00:00Z`);
  return Array.from({ length: keepDays }, (_, offset) => new Date(end.getTime() - offset * 86_400_000).toISOString().slice(0, 10));
}

export async function pruneDataFiles(root: string, today: string, keepDays = 7): Promise<string[]> {
  const keep = new Set(retainedDates(today, keepDays));
  const dailyDir = path.join(root, "daily");
  const karinaDir = path.join(root, "karina");
  await Promise.all([fs.mkdir(dailyDir, { recursive: true }), fs.mkdir(karinaDir, { recursive: true })]);
  for (const dir of [dailyDir, karinaDir]) {
    for (const file of await fs.readdir(dir)) {
      if (/^\d{4}-\d{2}-\d{2}\.json$/.test(file) && !keep.has(file.slice(0, 10))) await fs.unlink(path.join(dir, file));
    }
  }
  const dates = (await fs.readdir(dailyDir)).filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file)).map((file) => file.slice(0, 10)).sort().reverse().slice(0, keepDays);
  await fs.writeFile(path.join(root, "index.json"), `${JSON.stringify({ dates }, null, 2)}\n`);
  return dates;
}
