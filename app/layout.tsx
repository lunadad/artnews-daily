import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "아트 뉴스 데일리",
  description: "매일 엄선한 세계 미술계 주요 뉴스와 한글 브리핑",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Header />
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 pt-6 pb-28 sm:px-6 sm:py-10">{children}</main>
      </body>
    </html>
  );
}
