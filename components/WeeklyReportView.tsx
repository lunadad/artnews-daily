import { formatKoreanDate } from "./date";
import { ARTICLE_TYPE_LABELS } from "@/lib/article-type";
import { WEEKLY_TOPIC_LABELS, type WeeklyReport } from "@/lib/weekly";

function compactDate(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${month}월 ${day}일`;
}

export function WeeklyReportView({ report }: { report: WeeklyReport }) {
  const range = report.startDate && report.endDate
    ? report.startDate === report.endDate ? formatKoreanDate(report.startDate) : `${compactDate(report.startDate)}–${compactDate(report.endDate)}`
    : null;
  const lead = report.leadingTopics[0];

  return (
    <section>
      <p className="text-xs font-bold tracking-[0.12em] text-accent">WEEKLY REPORT</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-xl font-black tracking-[-0.03em] sm:text-2xl">주간 미술계 동향</h1>
        {range ? <p className="text-xs text-foreground-muted">{range} · {report.days}일 집계</p> : null}
      </div>

      {!report.totalArticles ? (
        <div className="mt-5 rounded-2xl border border-border bg-surface p-5 text-sm text-foreground-muted">
          집계할 일별 뉴스가 없습니다. 다음 수집이 완료되면 주간 동향이 표시됩니다.
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["집계 기사", `${report.totalArticles}건`],
              ["수집 일수", `${report.days}일`],
              ["가장 강한 동향", lead ? WEEKLY_TOPIC_LABELS[lead.topic] : "—"],
              ["국제 · 국내", `${report.internationalArticles} · ${report.domesticArticles}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-border bg-surface p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                <p className="text-xs text-foreground-muted">{label}</p>
                <p className="mt-2 text-lg font-black tracking-[-0.02em]">{value}</p>
              </div>
            ))}
          </div>

          <section className="pt-12">
            <p className="text-xs font-bold tracking-[0.12em] text-accent">KEY TRENDS</p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.03em]">이번 주 핵심 동향</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {report.leadingTopics.map((topic, index) => (
                <article key={topic.topic} className="rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                  <div className="flex items-start justify-between gap-4">
                    <div><p className="text-xs font-black text-accent">0{index + 1}</p><h3 className="mt-1 text-lg font-black">{WEEKLY_TOPIC_LABELS[topic.topic]}</h3></div>
                    <span className="rounded-full bg-tag-bg px-2.5 py-1 text-xs font-semibold text-tag-foreground">{topic.trendScore}점</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-foreground-muted">{topic.summary}</p>
                  <p className="mt-3 text-xs text-foreground-subtle">기사 {topic.articleCount} · {topic.uniqueDates}일 · {topic.uniqueSources}개 매체</p>
                  <ol className="mt-4 divide-y divide-border border-t border-border">
                    {topic.representativeArticles.map((article) => (
                      <li key={`${article.scope}-${article.key}`} className="py-3">
                        <a href={article.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-sm font-semibold hover:text-accent">{article.title}</a>
                        <p className="mt-1 text-xs text-foreground-subtle">{article.scope === "international" ? "국제" : "국내"} · {article.source}</p>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </section>

          <section className="pt-12">
            <p className="text-xs font-bold tracking-[0.12em] text-accent">ARTICLE TYPES</p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.03em]">기사 유형 분포</h2>
            <div role="list" aria-label="기사 유형별 국제·국내 분포" className="mt-4 rounded-2xl border border-border bg-surface px-4 py-2 shadow-[0_1px_0_rgba(0,0,0,0.02)] sm:px-5">
              {report.typeDistribution.map((row) => (
                <div role="listitem" key={row.type} className="grid gap-2 border-b border-border py-3 last:border-b-0 sm:grid-cols-[7rem_1fr_auto] sm:items-center">
                  <span className="font-semibold">{ARTICLE_TYPE_LABELS[row.type]}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true"><div className="h-full rounded-full bg-accent" style={{ width: `${row.percentage}%` }} /></div>
                  <span className="break-keep text-xs text-foreground-muted">전체 {row.total} · 국제 {row.international} · 국내 {row.domestic} · {row.percentage}%</span>
                </div>
              ))}
            </div>
          </section>

          <section className="pt-12">
            <p className="text-xs font-bold tracking-[0.12em] text-accent">ALL TOPICS</p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.03em]">전체 주제 순위</h2>
            <div className="mt-4 space-y-3">
              {report.topics.map((topic, index) => (
                <details key={topic.topic} className="rounded-2xl border border-border bg-surface px-4 py-3 open:pb-4 sm:px-5">
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    <span className="w-5 text-xs font-black text-accent">{index + 1}</span>
                    <span className="flex-1 font-bold">{WEEKLY_TOPIC_LABELS[topic.topic]}</span>
                    <span className="text-xs text-foreground-muted">{topic.articleCount}건 · {topic.trendScore}점</span>
                  </summary>
                  {topic.articles.length ? <ul className="mt-3 divide-y divide-border border-t border-border pl-8">{topic.articles.map((article) => <li key={`${article.scope}-${article.key}`} className="py-3"><a href={article.url} target="_blank" rel="noreferrer" className="text-sm font-semibold hover:text-accent">{article.title}</a><p className="mt-1 text-xs text-foreground-subtle">{article.source} · {compactDate(article.date)}</p></li>)}</ul> : <p className="mt-3 pl-8 text-sm text-foreground-subtle">이번 주 관련 기사가 없습니다.</p>}
                </details>
              ))}
            </div>
          </section>

          <section className="pt-12">
            <p className="text-xs font-bold tracking-[0.12em] text-accent">DAILY FLOW</p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.03em]">일별 흐름</h2>
            <ol className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface px-4 sm:px-5">
              {report.dailyTrends.map((trend) => (
                <li key={trend.date} className="grid gap-1 py-4 sm:grid-cols-[8rem_9rem_1fr] sm:items-center sm:gap-4">
                  <time className="text-xs font-semibold text-foreground-muted">{compactDate(trend.date)}</time>
                  <span className="text-sm font-bold text-accent">{WEEKLY_TOPIC_LABELS[trend.topic]}</span>
                  <a href={trend.representativeArticle.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-sm font-semibold hover:text-accent">{trend.representativeArticle.title}</a>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </section>
  );
}
