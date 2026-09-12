import { promises as fs } from "node:fs";
import path from "node:path";
import { DATA_ROOT } from "../lib/data";
import { checkDailyHealth } from "../lib/health";
import { DailyDataSchema } from "../lib/types";

const DATE_FILE = /^\d{4}-\d{2}-\d{2}\.json$/;

function previousDate(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

// Runs after the collect workflow has committed and pushed the day's data, so a
// red run never withholds data — it only makes a silent degradation visible
// (GitHub emails the workflow owner when a scheduled run fails).
export async function verifyLatestDaily(root = DATA_ROOT): Promise<number> {
  const names = (await fs.readdir(path.join(root, "daily"))).filter((name) => DATE_FILE.test(name)).sort();
  const latest = names.at(-1);
  if (!latest) {
    console.log("::error::no daily data file found");
    return 1;
  }
  const daily = DailyDataSchema.parse(JSON.parse(await fs.readFile(path.join(root, "daily", latest), "utf8")));
  const karinaFile = path.join(root, "karina", `${previousDate(daily.date)}.json`);
  const previousKarinaPresent = await fs.access(karinaFile).then(() => true, () => false);

  const { errors, warnings } = checkDailyHealth(daily, { previousKarinaPresent });
  for (const warning of warnings) console.log(`::warning::${daily.date}: ${warning}`);
  for (const error of errors) console.log(`::error::${daily.date}: ${error}`);
  if (!errors.length) console.log(`[verify-daily] ${daily.date} ok (${warnings.length} warnings)`);
  return errors.length ? 1 : 0;
}

const isEntry = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isEntry) {
  verifyLatestDaily()
    .then((code) => { process.exitCode = code; })
    .catch((error) => {
      console.error("[verify-daily] fatal:", error);
      process.exitCode = 1;
    });
}
