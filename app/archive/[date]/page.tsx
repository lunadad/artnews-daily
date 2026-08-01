import { notFound } from "next/navigation";
import { DailyDashboard } from "@/components/DailyDashboard";
import { getAvailableDates, getDailyData } from "@/lib/data";

export const revalidate = 300;
const todayKst = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export async function generateStaticParams() { return (await getAvailableDates()).map((date) => ({ date })); }

export default async function ArchiveDatePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const dates = await getAvailableDates();
  if (!dates.includes(date)) notFound();
  const data = await getDailyData(date);
  if (!data) notFound();
  return <DailyDashboard data={data} dates={dates} today={todayKst()} />;
}
