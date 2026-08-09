import type { MetadataRoute } from "next";
import { getAvailableDates, getDailyData } from "@/lib/data";

const SITE_URL = "https://artnews-daily.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dates = await getAvailableDates();
  const dailyData = await Promise.all(dates.map(getDailyData));
  const latestModified = dailyData.find((data) => data !== null)?.generatedAt;

  return [
    { url: SITE_URL, lastModified: latestModified },
    { url: `${SITE_URL}/archive`, lastModified: latestModified },
    { url: `${SITE_URL}/weekly`, lastModified: latestModified },
    ...dailyData.flatMap((data) => data ? [{ url: `${SITE_URL}/archive/${data.date}`, lastModified: data.generatedAt }] : []),
  ];
}
