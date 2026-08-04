import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DailyDashboard } from "@/components/DailyDashboard";
import { createDailyMetadata } from "@/app/daily-metadata";
import { getAvailableDates, getLatestDailyData } from "@/lib/data";

export const revalidate = 300;
const todayKst = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export async function generateMetadata(): Promise<Metadata> {
  const data = await getLatestDailyData();
  return data ? createDailyMetadata(data, "/") : {};
}

export default async function HomePage() {
  const [data, dates] = await Promise.all([getLatestDailyData(), getAvailableDates()]);
  if (!data) notFound();
  return <DailyDashboard data={data} dates={dates} today={todayKst()} />;
}
