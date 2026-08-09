import { getAvailableDates, getDailyData } from "./data";
import type { DailyData } from "./types";
import { buildWeeklyReport, type WeeklyReport } from "./weekly";

export async function loadWeeklyReport(
  getDates: () => Promise<string[]>,
  getDay: (date: string) => Promise<DailyData | null>,
): Promise<WeeklyReport> {
  const dates = (await getDates()).slice(0, 7);
  const settled = await Promise.allSettled(dates.map((date) => getDay(date)));
  const days = settled.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
  return buildWeeklyReport(days);
}

export function getWeeklyReport(): Promise<WeeklyReport> {
  return loadWeeklyReport(getAvailableDates, getDailyData);
}
