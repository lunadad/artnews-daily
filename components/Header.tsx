"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "홈", mark: "●" },
  { href: "/#briefing", label: "브리핑", mark: "B" },
  { href: "/weekly", label: "주간 동향", mark: "W" },
  { href: "/archive", label: "아카이브", mark: "□" },
] as const;

export function Header() {
  const pathname = usePathname();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border/80 bg-surface/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-15 sm:h-16 flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 text-foreground shrink-0" aria-label="아트 뉴스 홈">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-foreground text-sm font-black text-surface shadow-sm">A</span>
            <span className="flex flex-col leading-none">
              <span className="font-bold tracking-[-0.02em]">아트 뉴스</span>
              <span className="mt-1 text-[10px] font-medium tracking-[0.12em] text-foreground-subtle">ART NEWS DAILY</span>
            </span>
          </Link>
          <nav className="ml-auto hidden items-center gap-1 sm:flex" aria-label="주요 메뉴">
            {NAV_ITEMS.map((item) => {
              const active = item.href === "/archive" ? pathname.startsWith("/archive") : item.href === "/weekly" ? pathname === "/weekly" : item.href === "/" && pathname === "/";
              return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${active ? "bg-foreground text-surface" : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"}`}>{item.label}</Link>;
            })}
          </nav>
        </div>
      </header>
      <nav className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border/80 bg-surface/94 px-2 pt-1.5 backdrop-blur-xl sm:hidden" aria-label="모바일 주요 메뉴">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/archive" ? pathname.startsWith("/archive") : item.href === "/weekly" ? pathname === "/weekly" : item.href === "/" && pathname === "/";
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition-colors ${active ? "text-accent" : "text-foreground-subtle"}`}><span aria-hidden="true" className={`grid h-5 min-w-5 place-items-center rounded-md px-1 text-[10px] font-black ${active ? "bg-accent text-accent-foreground" : "bg-surface-muted text-foreground-muted"}`}>{item.mark}</span>{item.label}</Link>;
        })}
      </nav>
    </>
  );
}
