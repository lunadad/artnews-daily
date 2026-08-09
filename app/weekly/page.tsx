import type { Metadata } from "next";
import { WeeklyReportView } from "@/components/WeeklyReportView";
import { getWeeklyReport } from "@/lib/weekly-data";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "주간 미술계 동향 · 아트 뉴스 데일리",
  description: "최근 7일의 국제·국내 미술뉴스에서 부상한 주제와 기사 유형을 한눈에 확인하세요.",
};

export default async function WeeklyPage() {
  return <WeeklyReportView report={await getWeeklyReport()} />;
}
