"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const formatDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function CalendarPicker({ dates, currentDate, today }: { dates: string[]; currentDate: string; today: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const initial = new Date(`${currentDate}T00:00:00`);
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const enabled = useMemo(() => new Set(dates), [dates]);
  const firstDay = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const value = index - firstDay + 1;
    return value > 0 && value <= days ? new Date(month.getFullYear(), month.getMonth(), value) : null;
  });

  useEffect(() => {
    const element = dialog.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") element?.close();
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        const active = document.activeElement as HTMLElement;
        const buttons = [...(element?.querySelectorAll<HTMLButtonElement>("button[data-date]") ?? [])];
        const index = buttons.indexOf(active as HTMLButtonElement);
        if (index >= 0) { event.preventDefault(); buttons[Math.max(0, Math.min(buttons.length - 1, index + ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key] ?? 0)))]?.focus(); }
      }
    };
    element?.addEventListener("keydown", onKey);
    return () => element?.removeEventListener("keydown", onKey);
  }, []);

  return <>
    <button type="button" onClick={() => dialog.current?.showModal()} className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-border bg-surface text-xl text-foreground-muted hover:bg-surface-muted" aria-label="날짜 선택">▦</button>
    <dialog ref={dialog} className="m-auto w-[min(22rem,calc(100%-2rem))] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/45">
      <div className="p-4 sm:p-5"><div className="flex items-center justify-between"><button type="button" className="min-h-11 min-w-11 rounded-xl hover:bg-surface-muted" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="이전 달">‹</button><strong>{month.getFullYear()}년 {month.getMonth() + 1}월</strong><button type="button" className="min-h-11 min-w-11 rounded-xl hover:bg-surface-muted" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="다음 달">›</button></div>
        <div className="mt-3 grid grid-cols-7 text-center text-xs text-foreground-subtle">{"일월화수목금토".split("").map((day) => <span key={day} className="py-2">{day}</span>)}</div>
        <div className="grid grid-cols-7 gap-1">{cells.map((date, index) => { if (!date) return <span key={`empty-${index}`} />; const key = formatDate(date); const active = enabled.has(key); return <button key={key} type="button" data-date={active ? key : undefined} disabled={!active} tabIndex={active ? 0 : -1} onClick={() => { dialog.current?.close(); router.push(key === today ? "/" : `/archive/${key}`); }} className={`min-h-11 rounded-full text-sm ${key === currentDate ? "bg-accent text-accent-foreground" : active ? "text-foreground hover:bg-surface-muted" : "pointer-events-none text-foreground-subtle opacity-40"} ${key === today ? "ring-1 ring-accent" : ""}`}>{date.getDate()}</button>; })}</div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4"><p className="text-xs text-foreground-subtle">최근 7일치만 보관합니다</p><button type="button" onClick={() => dialog.current?.close()} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-accent hover:bg-surface-muted">닫기</button></div>
      </div>
    </dialog>
  </>;
}
