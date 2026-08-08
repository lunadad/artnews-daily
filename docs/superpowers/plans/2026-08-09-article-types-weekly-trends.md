# Article Types and Weekly Trends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classify every selected international and domestic article as news, analysis, interview, review, PR, or event, then derive a deterministic seven-day `/weekly` art-world trends report.

**Architecture:** A pure article-type classifier enriches stored daily JSON without affecting ranking. A separate pure weekly module normalizes international and domestic articles, detects at most two topics, deduplicates stories, and derives trend scores, type distribution, representative stories, and daily leaders; a fail-soft loader connects this module to the existing file data layer and a server-rendered page presents the result.

**Tech Stack:** Next.js 16 App Router, React 19 server/client components, TypeScript 5 strict mode, Zod 4, Tailwind CSS 4, Vitest 4, repository JSON data, Node.js 24.

## Global Constraints

- Keep the existing free, unauthenticated, static-JSON architecture; add no dependency, database, or LLM call.
- Classify international `top5` and domestic `domestic.items`; do not classify Karina items.
- Preserve all existing filters, scores, ranks, category limits, and representative-story selection.
- Store article type on new data; parse a missing historical `articleType` as `news`.
- Article-type priority is `pr → event → interview → review → analysis → news`.
- A weekly article has one primary topic and at most one secondary topic.
- Topic score is `importance + uniqueDates * 8 + uniqueSources * 4 + crossScopeBonus`, where primary score contributes 100%, secondary score contributes 50% rounded per article, and `crossScopeBonus` is 12 only when both international and domestic stories appear.
- Use the latest maximum seven dates from `data/index.json`; skip an unreadable daily file rather than failing the report.
- Render type distribution as a table-like single-hue magnitude display: one accent bar per type, direct numeric labels, and explicit international/domestic counts. Do not use categorical colors or an external chart library.
- Do not use article type to penalize or rerank stories in this implementation.

---

## File Map

### Create

- `lib/article-type.ts` — labels and deterministic Korean/English article-type classification.
- `lib/weekly.ts` — weekly topic classification, normalization, deduplication, aggregation, and report result types.
- `lib/weekly-data.ts` — fail-soft adapter from `lib/data.ts` to `buildWeeklyReport`.
- `scripts/backfill-article-types.ts` — idempotent one-shot/backfill command for retained daily JSON.
- `app/weekly/page.tsx` — server-rendered weekly report route and metadata.
- `components/ArticleTypeBadge.tsx` — shared presentation of Korean article-type labels.
- `components/WeeklyReportView.tsx` — presentational weekly report sections and empty state.
- `tests/article-type.test.ts` — classifier, schema fallback, and precedence regression tests.
- `tests/weekly.test.ts` — topic, deduplication, scoring, distribution, and empty/partial-data tests.
- `tests/weekly-presentation.test.ts` — navigation, sitemap, badges, and weekly page source-level integration checks.

### Modify

- `lib/types.ts` — add `ArticleTypeSchema` and stored `articleType` fields with historical default.
- `scripts/collect.ts` — classify selected international and domestic representatives before persistence.
- `components/ThumbTile.tsx` — expose article type in image and no-image tile presentations.
- `components/BriefingCard.tsx` — show the domestic article-type badge next to category.
- `components/Header.tsx` — add a responsive `주간 동향` navigation item and route-aware active state.
- `app/sitemap.ts` — include `/weekly` with latest retained data modification time.
- `tests/thumb-grid.test.ts` — update typed fixture with `articleType`.
- `tests/briefing.test.ts` — update typed fixture with `articleType`.
- `data/daily/2026-08-02.json` through `data/daily/2026-08-08.json` — backfill types without changing scores or ranks.
- `README.md` — document article types, weekly report, and backfill command.
- `docs/design.md` — document final schema and `/weekly` derivation rules.

---

### Task 1: Article Type Domain and Deterministic Classifier

**Files:**
- Create: `lib/article-type.ts`
- Create: `tests/article-type.test.ts`
- Modify: `lib/types.ts:1-48`
- Modify: `tests/thumb-grid.test.ts:5-23`
- Modify: `tests/briefing.test.ts:5`

**Interfaces:**
- Produces: `ArticleTypeSchema`, `ArticleType`, and required parsed `articleType` on `NewsItem` and `DomesticItem`.
- Produces: `ARTICLE_TYPE_LABELS: Record<ArticleType, string>`.
- Produces: `classifyArticleType(input: { title: string; summary?: string; language: "ko" | "en" }): ArticleType`.
- Consumes: no feature-specific prior interfaces.

- [ ] **Step 1: Write failing classifier and schema tests**

Create `tests/article-type.test.ts` with exact representative boundaries:

```ts
import { describe, expect, it } from "vitest";
import { ARTICLE_TYPE_LABELS, classifyArticleType } from "@/lib/article-type";
import { DomesticItemSchema, NewsItemSchema } from "@/lib/types";

const baseNews = {
  id: "story-1", rank: 1, score: 70, category: "museum" as const,
  titleOriginal: "Museum names a new director", titleKo: "미술관, 새 관장 임명",
  summaryKo: "새 관장을 발표했습니다.", url: "https://example.com/story-1",
  source: "Example", sourceDomain: "example.com", discoveredVia: "direct" as const,
  resolved: true, publishedAt: "2026-08-08T00:00:00.000Z", coverage: 1,
  image: null, imageWidth: null, imageHeight: null,
};

describe("article type labels", () => {
  it("maps all stored values to Korean labels", () => {
    expect(ARTICLE_TYPE_LABELS).toEqual({
      news: "보도", analysis: "분석", interview: "인터뷰",
      review: "리뷰", pr: "PR", event: "행사안내",
    });
  });
});

describe("classifyArticleType", () => {
  it.each([
    [{ title: "Brand launches limited artist collaboration", language: "en" as const }, "pr"],
    [{ title: "Museum tickets and opening hours for August", language: "en" as const }, "event"],
    [{ title: "Q&A: in conversation with painter Lee", language: "en" as const }, "interview"],
    [{ title: "Review: a retrospective that rewrites the canon", language: "en" as const }, "review"],
    [{ title: "Analysis: what auction contraction means", language: "en" as const }, "analysis"],
    [{ title: "Museum names a new director", language: "en" as const }, "news"],
    [{ title: "브랜드, 작가 협업 상품 출시", language: "ko" as const }, "pr"],
    [{ title: "미술관 무료 관람 사전 예약 안내", language: "ko" as const }, "event"],
    [{ title: "작가와의 대화: 김민정 인터뷰", language: "ko" as const }, "interview"],
    [{ title: "전시평: 새로운 회고전을 보다", language: "ko" as const }, "review"],
    [{ title: "미술시장 전망과 거래액 분석", language: "ko" as const }, "analysis"],
    [{ title: "국립미술관 새 관장 임명", language: "ko" as const }, "news"],
  ])("classifies $title", (input, expected) => {
    expect(classifyArticleType(input)).toBe(expected);
  });

  it("does not treat a quoted statement as an interview", () => {
    expect(classifyArticleType({ title: "Director says museum will expand", language: "en" })).toBe("news");
  });

  it("does not treat an exhibition opening as a review", () => {
    expect(classifyArticleType({ title: "Gallery opens Lee Ufan exhibition", language: "en" })).toBe("news");
  });

  it("applies PR before event when both signals appear", () => {
    expect(classifyArticleType({ title: "Brand launches sponsored exhibition with free admission", language: "en" })).toBe("pr");
  });
});

describe("stored article type compatibility", () => {
  it("defaults an old international row to news", () => {
    expect(NewsItemSchema.parse(baseNews).articleType).toBe("news");
  });

  it("defaults an old domestic row to news", () => {
    const parsed = DomesticItemSchema.parse({
      rank: 1, score: 60, category: "artist", title: "작가 개인전 개최", summary: "",
      url: "https://example.com/domestic", source: "예시일보",
      publishedAt: "2026-08-08T00:00:00.000Z", coverage: 1, resolved: true, image: null,
    });
    expect(parsed.articleType).toBe("news");
  });
});
```

- [ ] **Step 2: Run the focused tests to verify failure**

Run:

```bash
npm test -- tests/article-type.test.ts tests/thumb-grid.test.ts tests/briefing.test.ts
```

Expected: FAIL because `lib/article-type.ts` and `ArticleTypeSchema` do not exist; typed fixtures also fail once fields become required.

- [ ] **Step 3: Add the schema and labels**

At the top of `lib/types.ts`, add:

```ts
export const ArticleTypeSchema = z.enum(["news", "analysis", "interview", "review", "pr", "event"]);
export type ArticleType = z.infer<typeof ArticleTypeSchema>;
```

Add this property to both `NewsItemSchema` and `DomesticItemSchema`:

```ts
articleType: ArticleTypeSchema.default("news"),
```

Create `lib/article-type.ts` with:

```ts
import type { ArticleType } from "./types";

export const ARTICLE_TYPE_LABELS: Record<ArticleType, string> = {
  news: "보도", analysis: "분석", interview: "인터뷰",
  review: "리뷰", pr: "PR", event: "행사안내",
};

type Language = "ko" | "en";
type Input = { title: string; summary?: string; language: Language };

const PATTERNS: Record<Language, Record<Exclude<ArticleType, "news">, RegExp[]>> = {
  en: {
    pr: [/\bpress release\b/i, /\bsponsored\b/i, /\bbrand (?:launches|unveils)\b/i, /\bpartnership\b/i, /\blimited (?:edition|collaboration)\b/i],
    event: [/\btickets?\b/i, /\bregistration\b/i, /\bopening hours?\b/i, /\badmission\b/i, /\bvisitor guide\b/i],
    interview: [/^interview\b/i, /^q\s*&\s*a\b/i, /\bin conversation with\b/i, /\ban interview with\b/i],
    review: [/^review\b/i, /\bexhibition review\b/i, /\bcritics?' take\b/i],
    analysis: [/^analysis\b/i, /\boutlook\b/i, /\bmarket report\b/i, /\bwhat .+ means\b/i],
  },
  ko: {
    pr: [/보도자료/, /협업 상품/, /한정판/, /신제품/, /공식 발표/, /후원/, /출시/],
    event: [/사전 ?예약/, /관람 ?안내/, /입장료/, /운영 ?시간/, /무료 ?관람/, /참가 ?신청/, /티켓/],
    interview: [/인터뷰/, /문답/, /작가와의 대화/, /대담/],
    review: [/전시평/, /미술평/, /비평/, /리뷰/],
    analysis: [/분석/, /전망/, /해설/, /시장 ?보고서/, /동향 ?보고서/],
  },
};

const ORDER: Exclude<ArticleType, "news">[] = ["pr", "event", "interview", "review", "analysis"];

export function classifyArticleType({ title, summary = "", language }: Input): ArticleType {
  const titleText = title.trim();
  const context = `${titleText} ${summary}`.trim();
  for (const type of ORDER) {
    const patterns = PATTERNS[language][type];
    if (patterns.some((pattern) => pattern.test(titleText))) return type;
    if ((type === "pr" || type === "event") && patterns.some((pattern) => pattern.test(context))) return type;
  }
  return "news";
}
```

Only PR and event may use summary as a secondary signal; interview, review, and analysis require title evidence to avoid quoted-body false positives.

- [ ] **Step 4: Update typed fixtures**

Add `articleType: "news"` to the `NewsItem` fixture in `tests/thumb-grid.test.ts` and the one-line fixture in `tests/briefing.test.ts`.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- tests/article-type.test.ts tests/thumb-grid.test.ts tests/briefing.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the domain unit**

```bash
git add lib/article-type.ts lib/types.ts tests/article-type.test.ts tests/thumb-grid.test.ts tests/briefing.test.ts
git commit -m "feat: classify art news article types

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Persist Types and Backfill Retained Data

**Files:**
- Create: `scripts/backfill-article-types.ts`
- Modify: `scripts/collect.ts:1-12,165-180,221-243`
- Modify: `tests/article-type.test.ts`
- Modify: `data/daily/2026-08-02.json` through `data/daily/2026-08-08.json`

**Interfaces:**
- Consumes: `classifyArticleType({ title, summary, language }): ArticleType` from Task 1.
- Produces: `backfillArticleTypes(root?: string): Promise<number>` for idempotent retained-data migration.
- Produces: explicit `articleType` in all newly collected and retained international/domestic records.

- [ ] **Step 1: Add failing persistence and idempotence tests**

Append to `tests/article-type.test.ts`:

```ts
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach } from "vitest";
import { backfillArticleTypes } from "@/scripts/backfill-article-types";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

it("backfills international and domestic rows without changing ranks or scores", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "artnews-types-"));
  roots.push(root);
  await fs.mkdir(path.join(root, "daily"), { recursive: true });
  const payload = {
    date: "2026-08-08", generatedAt: "2026-08-08T09:00:00+09:00",
    briefing: { headline: "기관", distribution: { market: 0, museum: 1, fair: 0, artist: 0, general: 0 }, focus: [] },
    domestic: { headline: "국내", distribution: { market: 0, museum: 0, fair: 0, artist: 1, general: 0 }, items: [{
      rank: 1, score: 55, category: "artist", title: "작가와의 대화: 김민정 인터뷰", summary: "",
      url: "https://example.com/ko", source: "예시일보", publishedAt: "2026-08-08T00:00:00.000Z",
      coverage: 1, resolved: true, image: null,
    }] },
    top5: [{ ...baseNews, titleOriginal: "Analysis: what museum expansion means", rank: 1, score: 70 }],
    karina: null,
  };
  const file = path.join(root, "daily", "2026-08-08.json");
  await fs.writeFile(file, JSON.stringify(payload));

  expect(await backfillArticleTypes(root)).toBe(1);
  const first = JSON.parse(await fs.readFile(file, "utf8"));
  expect(first.top5[0]).toMatchObject({ rank: 1, score: 70, articleType: "analysis" });
  expect(first.domestic.items[0]).toMatchObject({ rank: 1, score: 55, articleType: "interview" });
  expect(await backfillArticleTypes(root)).toBe(0);
});
```

- [ ] **Step 2: Verify the migration test fails**

Run:

```bash
npm test -- tests/article-type.test.ts
```

Expected: FAIL because `scripts/backfill-article-types.ts` does not exist.

- [ ] **Step 3: Classify newly collected rows**

Import `classifyArticleType` in `scripts/collect.ts`. Add to each domestic item returned in `collectDomestic`:

```ts
articleType: classifyArticleType({
  title: item.title,
  summary: item.summary ?? "",
  language: "ko",
}),
```

Add to each international `top5` item after translation:

```ts
articleType: classifyArticleType({
  title: item.title,
  summary: item.summary ?? "",
  language: "en",
}),
```

Do not reference `articleType` in scoring, filtering, cluster selection, or diversity code.

- [ ] **Step 4: Implement the idempotent backfill**

Create `scripts/backfill-article-types.ts` with an exported function and entry-point guard. It must:

1. Read sorted `data/daily/*.json` files.
2. Preserve unknown top-level and article fields.
3. Fill only missing `articleType` fields.
4. Derive international type from `titleOriginal` and `summaryKo` using `language: "en"` only when no original summary exists; classification remains title-led for analysis/interview/review.
5. Derive domestic type from `title` and `summary` using `language: "ko"`.
6. Write a file only when at least one field was added.
7. Return the number of changed files.

Use this concrete structure:

```ts
import { promises as fs } from "node:fs";
import path from "node:path";
import { classifyArticleType } from "../lib/article-type";
import { DATA_ROOT } from "../lib/data";

export async function backfillArticleTypes(root = DATA_ROOT): Promise<number> {
  const dir = path.join(root, "daily");
  let changedFiles = 0;
  for (const name of (await fs.readdir(dir)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort()) {
    const file = path.join(dir, name);
    const payload = JSON.parse(await fs.readFile(file, "utf8"));
    let changed = false;
    for (const item of payload.top5 ?? []) {
      if (!item.articleType) {
        item.articleType = classifyArticleType({ title: item.titleOriginal, summary: item.summaryKo ?? "", language: "en" });
        changed = true;
      }
    }
    for (const item of payload.domestic?.items ?? []) {
      if (!item.articleType) {
        item.articleType = classifyArticleType({ title: item.title, summary: item.summary ?? "", language: "ko" });
        changed = true;
      }
    }
    if (changed) {
      await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`);
      changedFiles += 1;
    }
  }
  return changedFiles;
}

const isEntry = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isEntry) backfillArticleTypes().then((count) => console.log(`[article types] updated ${count} daily files`)).catch((error) => {
  console.error("[article types] fatal:", error);
  process.exitCode = 1;
});
```

- [ ] **Step 5: Run the focused tests**

Run:

```bash
npm test -- tests/article-type.test.ts
```

Expected: PASS, including the second-run `0` assertion.

- [ ] **Step 6: Capture rank/score checksums, run the backfill, and compare**

Before migration:

```bash
node -e 'const fs=require("fs"),p=require("path"),c=require("crypto"); const rows=fs.readdirSync("data/daily").filter(x=>/\.json$/.test(x)).sort().map(f=>{const d=JSON.parse(fs.readFileSync(p.join("data/daily",f))); return [f,d.top5.map(x=>[x.rank,x.score,x.url]),(d.domestic?.items??[]).map(x=>[x.rank,x.score,x.url])]} ); fs.writeFileSync(process.env.CLAUDE_JOB_DIR+"/tmp/article-ranks-before.json",JSON.stringify(rows)); console.log(c.createHash("sha256").update(JSON.stringify(rows)).digest("hex"))'
```

Run migration twice:

```bash
npx tsx scripts/backfill-article-types.ts
npx tsx scripts/backfill-article-types.ts
```

Expected: first run reports seven updated files; second run reports zero.

Compare after migration:

```bash
node -e 'const fs=require("fs"),p=require("path"); const rows=fs.readdirSync("data/daily").filter(x=>/\.json$/.test(x)).sort().map(f=>{const d=JSON.parse(fs.readFileSync(p.join("data/daily",f))); return [f,d.top5.map(x=>[x.rank,x.score,x.url]),(d.domestic?.items??[]).map(x=>[x.rank,x.score,x.url])]} ); const before=JSON.parse(fs.readFileSync(process.env.CLAUDE_JOB_DIR+"/tmp/article-ranks-before.json")); if(JSON.stringify(rows)!==JSON.stringify(before)) process.exit(1); console.log("ranks and scores unchanged")'
```

Expected: `ranks and scores unchanged`.

- [ ] **Step 7: Validate every retained row through Zod**

```bash
npx tsx -e 'import { readFile } from "node:fs/promises"; import { readdir } from "node:fs/promises"; import { DailyDataSchema } from "./lib/types"; for (const file of await readdir("data/daily")) if (file.endsWith(".json")) DailyDataSchema.parse(JSON.parse(await readFile(`data/daily/${file}`, "utf8"))); console.log("all retained daily files valid")'
```

Expected: `all retained daily files valid`.

- [ ] **Step 8: Commit persistence and data migration**

```bash
git add scripts/collect.ts scripts/backfill-article-types.ts tests/article-type.test.ts data/daily
git commit -m "feat: persist article types in daily data

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Weekly Topic Classification and Report Aggregation

**Files:**
- Create: `lib/weekly.ts`
- Create: `tests/weekly.test.ts`

**Interfaces:**
- Consumes: `DailyData`, `ArticleType`, and historical `articleType` defaults from Task 1.
- Produces: `WeeklyTopic`, `WEEKLY_TOPIC_LABELS`, `classifyWeeklyTopics`, `buildWeeklyReport`.
- Produces result types `WeeklyArticle`, `WeeklyTopicResult`, `ArticleTypeDistribution`, `DailyTrend`, and `WeeklyReport`.

- [ ] **Step 1: Write failing topic tests**

Create `tests/weekly.test.ts` with fixtures that include explicit types. Begin with:

```ts
import { describe, expect, it } from "vitest";
import { buildWeeklyReport, classifyWeeklyTopics, WEEKLY_TOPIC_LABELS } from "@/lib/weekly";
import type { ArticleType, Category, DailyData } from "@/lib/types";

function international(overrides: Partial<DailyData["top5"][number]> = {}): DailyData["top5"][number] {
  return {
    id: "i1", rank: 1, score: 80, category: "market", articleType: "news",
    titleOriginal: "Auction market report", titleKo: "경매 시장 보고서", summaryKo: "",
    url: "https://artnews.com/story", source: "ARTnews", sourceDomain: "artnews.com",
    discoveredVia: "direct", resolved: true, publishedAt: "2026-08-08T00:00:00.000Z",
    coverage: 2, image: null, imageWidth: null, imageHeight: null, ...overrides,
  };
}

function domestic(overrides: Partial<NonNullable<DailyData["domestic"]>["items"][number]> = {}) {
  return {
    rank: 1, score: 60, category: "museum" as Category, articleType: "analysis" as ArticleType,
    title: "미술관 정책 분석", summary: "기관 운영과 법률 변화",
    url: "https://example.kr/story", source: "예시일보", publishedAt: "2026-08-08T01:00:00.000Z",
    coverage: 1, resolved: true, image: null, ...overrides,
  };
}

function day(date: string, top5 = [international()], domesticItems = [domestic()]): DailyData {
  return {
    date, generatedAt: `${date}T09:00:00+09:00`,
    briefing: { headline: "주간", distribution: { market: top5.filter(x => x.category === "market").length, museum: 0, fair: 0, artist: 0, general: 0 }, focus: [] },
    domestic: { headline: "국내", distribution: { market: 0, museum: domesticItems.length, fair: 0, artist: 0, general: 0 }, items: domesticItems },
    top5, karina: null,
  };
}

describe("weekly topic classification", () => {
  it("returns at most a primary and secondary topic", () => {
    expect(classifyWeeklyTopics({ title: "Museum exhibition restitution lawsuit", summary: "Biennale gallery auction", category: "museum" })).toEqual(["institution", "exhibition"]);
  });

  it("falls back from the stored category", () => {
    expect(classifyWeeklyTopics({ title: "Unspecified update", summary: "", category: "fair" })).toEqual(["fair"]);
  });

  it("exposes the fixed Korean topic names", () => {
    expect(WEEKLY_TOPIC_LABELS.market).toBe("경매·시장");
    expect(WEEKLY_TOPIC_LABELS["law-policy"]).toBe("법률·정책");
  });
});
```

Use fixed topic order `market, institution, exhibition, fair, artist, gallery, restitution, law-policy`. Use keyword-match counts to select the first two positive topics, sorted by `match count desc → fixed order`. Exact keyword groups must include:

- `market`: auction, sale, market, Sotheby, Christie, 경매, 낙찰, 미술시장, 거래액
- `institution`: museum, director, curator, institution, 미술관, 박물관, 관장, 큐레이터
- `exhibition`: exhibition, retrospective, show, 전시, 회고전, 개인전, 기획전
- `fair`: art fair, biennale, biennial, Frieze, Art Basel, 아트페어, 비엔날레
- `artist`: artist, painter, sculptor, award, obituary, dies, 작가, 화가, 조각가, 수상, 별세
- `gallery`: gallery, dealer, representation, 갤러리, 화랑, 전속
- `restitution`: restitution, repatriation, provenance, heritage, 환수, 반환, 문화재, 약탈
- `law-policy`: lawsuit, court, law, policy, regulation, 법원, 소송, 법률, 정책, 규제

- [ ] **Step 2: Write failing aggregation tests**

Append tests that prove the exact formula and behavior:

```ts
describe("buildWeeklyReport", () => {
  it("deduplicates normalized URLs before counting", () => {
    const report = buildWeeklyReport([
      day("2026-08-08", [international()], []),
      day("2026-08-07", [international({ id: "i2", url: "https://artnews.com/story?utm_source=x", score: 75 })], []),
    ]);
    expect(report.totalArticles).toBe(1);
  });

  it("uses primary 100%, secondary 50%, date/source bonuses, and cross-scope bonus", () => {
    const report = buildWeeklyReport([
      day("2026-08-08", [international({ score: 80, titleOriginal: "Museum auction", summaryKo: "" })], [
        domestic({ score: 60, title: "미술관 경매 동향", summary: "" }),
      ]),
    ]);
    const market = report.topics.find((topic) => topic.topic === "market")!;
    expect(market.importance).toBe(140);
    expect(market.uniqueDates).toBe(1);
    expect(market.uniqueSources).toBe(2);
    expect(market.trendScore).toBe(168); // 140 + 8 + 8 + 12
    expect(market.scopes).toEqual(["international", "domestic"]);
  });

  it("counts international and domestic article types with direct totals", () => {
    const report = buildWeeklyReport([day("2026-08-08")]);
    expect(report.typeDistribution.find((row) => row.type === "news")).toMatchObject({ total: 1, international: 1, domestic: 0 });
    expect(report.typeDistribution.find((row) => row.type === "analysis")).toMatchObject({ total: 1, international: 0, domestic: 1 });
  });

  it("returns three leading topics, deterministic full ranking, and one daily leader", () => {
    const report = buildWeeklyReport([day("2026-08-08")]);
    expect(report.leadingTopics).toEqual(report.topics.slice(0, 3));
    expect(report.dailyTrends).toHaveLength(1);
    expect(report.dailyTrends[0].date).toBe("2026-08-08");
  });

  it("returns an explicit empty report", () => {
    expect(buildWeeklyReport([])).toMatchObject({ days: 0, totalArticles: 0, internationalArticles: 0, domesticArticles: 0, leadingTopics: [], dailyTrends: [] });
  });
});
```

- [ ] **Step 3: Verify weekly tests fail**

Run:

```bash
npm test -- tests/weekly.test.ts
```

Expected: FAIL because `lib/weekly.ts` does not exist.

- [ ] **Step 4: Implement weekly result types and topic classifier**

Create `lib/weekly.ts` with these public types:

```ts
export const WEEKLY_TOPICS = ["market", "institution", "exhibition", "fair", "artist", "gallery", "restitution", "law-policy"] as const;
export type WeeklyTopic = typeof WEEKLY_TOPICS[number];
export type WeeklyScope = "international" | "domestic";

export interface WeeklyArticle {
  key: string;
  date: string;
  scope: WeeklyScope;
  score: number;
  category: Category;
  articleType: ArticleType;
  title: string;
  summary: string;
  url: string;
  source: string;
  sourceKey: string;
  topics: WeeklyTopic[];
}

export interface WeeklyTopicResult {
  topic: WeeklyTopic;
  trendScore: number;
  importance: number;
  articleCount: number;
  uniqueDates: number;
  uniqueSources: number;
  scopes: WeeklyScope[];
  summary: string;
  representativeArticles: WeeklyArticle[];
  articles: WeeklyArticle[];
}

export interface ArticleTypeDistribution {
  type: ArticleType;
  total: number;
  international: number;
  domestic: number;
  percentage: number;
}

export interface DailyTrend {
  date: string;
  topic: WeeklyTopic;
  trendScore: number;
  representativeArticle: WeeklyArticle;
}

export interface WeeklyReport {
  startDate: string | null;
  endDate: string | null;
  days: number;
  totalArticles: number;
  internationalArticles: number;
  domesticArticles: number;
  leadingTopics: WeeklyTopicResult[];
  topics: WeeklyTopicResult[];
  typeDistribution: ArticleTypeDistribution[];
  dailyTrends: DailyTrend[];
}
```

Implement topic matching with lowercase string inclusion for English and direct inclusion for Korean. Count each keyword at most once. Return the two strongest positive topics; if none are positive, use:

```ts
const CATEGORY_FALLBACK: Record<Category, WeeklyTopic> = {
  market: "market", museum: "institution", fair: "fair", artist: "artist", general: "exhibition",
};
```

- [ ] **Step 5: Implement normalization, deduplication, and aggregation**

Use `normalizeUrl` from `lib/score.ts` for URL keys. Sort candidate articles by `score desc → date desc → url` before deduplication. Deduplicate by:

1. normalized URL key; then
2. `${date}:${normalizedTitle}`, where normalized title is lowercase, punctuation replaced with spaces, and whitespace collapsed.

For domestic `sourceKey`, parse the URL and pass hostname through `registrableDomain`; on URL parse failure use lowercased `source`. International rows already have `sourceDomain`, which should pass through `registrableDomain`.

For each topic membership, assign article importance:

```ts
const contribution = article.topics[0] === topic ? article.score : Math.round(article.score * 0.5);
```

Compute `trendScore` exactly from Global Constraints. Sort topic results by:

```text
trendScore desc → importance desc → uniqueDates desc → uniqueSources desc → WEEKLY_TOPICS index asc
```

Use at most three unique representative articles sorted by score. Build summaries with deterministic Korean templates:

```ts
const crossScope = scopes.length === 2 ? " 국제·국내 보도에 함께 나타났습니다." : "";
summary = `${uniqueDates}일 동안 ${articleCount}건, ${uniqueSources}개 매체가 관련 소식을 다뤘습니다.${crossScope}`;
```

Keep zero-score topics in `topics` so the full eight-topic list is stable, but exclude them from `leadingTopics` and daily leaders.

- [ ] **Step 6: Run weekly tests**

```bash
npm test -- tests/weekly.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit aggregation unit**

```bash
git add lib/weekly.ts tests/weekly.test.ts
git commit -m "feat: aggregate weekly art world trends

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Fail-Soft Weekly Loader and Weekly Report Page

**Files:**
- Create: `lib/weekly-data.ts`
- Create: `components/WeeklyReportView.tsx`
- Create: `app/weekly/page.tsx`
- Modify: `tests/weekly.test.ts`

**Interfaces:**
- Consumes: `buildWeeklyReport(days: DailyData[]): WeeklyReport` from Task 3.
- Produces: `getWeeklyReport(): Promise<WeeklyReport>`.
- Consumes in UI: `WeeklyReport`, `WEEKLY_TOPIC_LABELS`, and `ARTICLE_TYPE_LABELS`.

- [ ] **Step 1: Add a failing fail-soft loader test**

The existing `getDailyData` already returns `null` for missing/malformed data. Export a dependency-injected helper from `lib/weekly-data.ts` so behavior can be tested without changing `process.cwd()`:

```ts
export async function loadWeeklyReport(
  getDates: () => Promise<string[]>,
  getDay: (date: string) => Promise<DailyData | null>,
): Promise<WeeklyReport>
```

Append to `tests/weekly.test.ts`:

```ts
import { loadWeeklyReport } from "@/lib/weekly-data";

it("skips a missing or malformed day and reports the dates it could load", async () => {
  const valid = day("2026-08-08");
  const report = await loadWeeklyReport(
    async () => ["2026-08-08", "2026-08-07"],
    async (date) => date === "2026-08-08" ? valid : null,
  );
  expect(report.days).toBe(1);
  expect(report.startDate).toBe("2026-08-08");
  expect(report.endDate).toBe("2026-08-08");
});
```

- [ ] **Step 2: Verify loader test fails**

```bash
npm test -- tests/weekly.test.ts
```

Expected: FAIL because `lib/weekly-data.ts` does not exist.

- [ ] **Step 3: Implement loader adapter**

Create `lib/weekly-data.ts`:

```ts
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
```

- [ ] **Step 4: Run loader and aggregation tests**

```bash
npm test -- tests/weekly.test.ts
```

Expected: PASS.

- [ ] **Step 5: Implement the server-rendered page shell and metadata**

Create `app/weekly/page.tsx`:

```tsx
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
```

- [ ] **Step 6: Implement the weekly report view**

Create `components/WeeklyReportView.tsx` as a pure server component with five sections in this order:

1. `WEEKLY REPORT / 주간 미술계 동향` heading and formatted actual range.
2. Four stat tiles: analyzed stories, collection days, leading topic, international/domestic split.
3. Up to three leading-topic cards with summary, score evidence, and representative links.
4. Article-type distribution rows.
5. All topics in `<details>` and daily trend timeline.

For an empty report, render the heading plus this explicit state and no fake metrics:

```tsx
<div className="mt-5 rounded-2xl border border-border bg-surface p-5 text-sm text-foreground-muted">
  집계할 일별 뉴스가 없습니다. 다음 수집이 완료되면 주간 동향이 표시됩니다.
</div>
```

The distribution must be an accessible table-like list, not six categorical colors. For every type row render:

```tsx
<div role="listitem" className="grid gap-2 py-3 sm:grid-cols-[7rem_1fr_auto] sm:items-center">
  <span className="font-semibold">{ARTICLE_TYPE_LABELS[row.type]}</span>
  <div className="h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
    <div className="h-full rounded-full bg-accent" style={{ width: `${row.percentage}%` }} />
  </div>
  <span className="text-xs text-foreground-muted">
    전체 {row.total} · 국제 {row.international} · 국내 {row.domestic} · {row.percentage}%
  </span>
</div>
```

Requirements from the data-visualization guidance:

- The mark encodes one magnitude only (`percentage`) using the existing single accent hue.
- Every bar has direct text values, so color is never the only carrier.
- The six types are always rendered in fixed `ArticleTypeSchema` order, including zero values.
- No tooltip is necessary because every mark is directly labeled and each row is a large hit/read target rather than an interactive plot.
- `role="list"` and `role="listitem"` expose the text table to assistive technology.
- Existing dark-mode tokens supply the selected dark surface/accent; add no hard-coded chart color.
- Clamp widths to `0–100` in aggregation, and use rounded data ends anchored at the left baseline.

- [ ] **Step 7: Run tests and a page type-check**

```bash
npm test -- tests/weekly.test.ts
npx tsc --noEmit
```

Expected: PASS with no diagnostics.

- [ ] **Step 8: Commit loader and page**

```bash
git add lib/weekly-data.ts components/WeeklyReportView.tsx app/weekly/page.tsx tests/weekly.test.ts
git commit -m "feat: add weekly art trends report

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Article-Type Badges, Navigation, and Discoverability

**Files:**
- Create: `components/ArticleTypeBadge.tsx`
- Create: `tests/weekly-presentation.test.ts`
- Modify: `components/ThumbTile.tsx:1-16`
- Modify: `components/BriefingCard.tsx:1-26`
- Modify: `components/Header.tsx:6-36`
- Modify: `app/sitemap.ts:1-16`

**Interfaces:**
- Consumes: `ArticleType` and `ARTICLE_TYPE_LABELS` from Task 1.
- Consumes: `/weekly` route from Task 4.
- Produces: `ArticleTypeBadge({ type, inverse? }: { type: ArticleType; inverse?: boolean })`.

- [ ] **Step 1: Write failing source-level integration checks**

Create `tests/weekly-presentation.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";

const source = (relative: string) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");

describe("weekly report discoverability", () => {
  it("links the weekly report from desktop and mobile navigation", async () => {
    const header = await source("components/Header.tsx");
    expect(header).toContain('{ href: "/weekly", label: "주간 동향"');
    expect(header).toContain("grid-cols-4");
  });

  it("includes weekly report in sitemap", async () => {
    const rows = await sitemap();
    expect(rows.some((row) => row.url === "https://artnews-daily.vercel.app/weekly")).toBe(true);
  });

  it("shows article-type badges in both story presentations", async () => {
    const [tile, briefing] = await Promise.all([source("components/ThumbTile.tsx"), source("components/BriefingCard.tsx")]);
    expect(tile).toContain("ArticleTypeBadge");
    expect(briefing).toContain("ArticleTypeBadge");
  });

  it("keeps weekly distribution directly labeled", async () => {
    const view = await source("components/WeeklyReportView.tsx");
    expect(view).toContain("전체 {row.total} · 국제 {row.international} · 국내 {row.domestic}");
    expect(view).toContain('role="list"');
  });
});
```

- [ ] **Step 2: Verify presentation tests fail**

```bash
npm test -- tests/weekly-presentation.test.ts
```

Expected: FAIL because the badge and navigation changes do not exist.

- [ ] **Step 3: Add shared article-type badge**

Create `components/ArticleTypeBadge.tsx`:

```tsx
import { ARTICLE_TYPE_LABELS } from "@/lib/article-type";
import type { ArticleType } from "@/lib/types";

export function ArticleTypeBadge({ type, inverse = false }: { type: ArticleType; inverse?: boolean }) {
  return (
    <span className={inverse
      ? "rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white"
      : "rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-foreground-muted"}
    >
      {ARTICLE_TYPE_LABELS[type]}
    </span>
  );
}
```

- [ ] **Step 4: Add badges to international and domestic items**

In `ThumbTile.tsx`:

- Import `ArticleTypeBadge`.
- For image tiles, add `<ArticleTypeBadge type={item.articleType} inverse />` above title inside the overlay.
- For no-image tiles, add `<ArticleTypeBadge type={item.articleType} />` between source initial and title.
- Keep `aria-label={item.titleKo}` unchanged.

In `BriefingCard.tsx`:

- Import `ArticleTypeBadge`.
- Render it beside the category badge in the metadata row.
- Keep source, relative time, and quality coverage text unchanged.

- [ ] **Step 5: Add `/weekly` to responsive navigation**

Update `NAV_ITEMS` in `Header.tsx` to:

```ts
const NAV_ITEMS = [
  { href: "/", label: "홈", mark: "●" },
  { href: "/#briefing", label: "브리핑", mark: "B" },
  { href: "/weekly", label: "주간 동향", mark: "W" },
  { href: "/archive", label: "아카이브", mark: "□" },
] as const;
```

Extract or inline route activity with these exact rules:

```ts
const active = item.href === "/archive"
  ? pathname.startsWith("/archive")
  : item.href === "/weekly"
    ? pathname === "/weekly"
    : item.href === "/" && pathname === "/";
```

Change the mobile nav grid from `grid-cols-3` to `grid-cols-4`. The briefing hash link remains intentionally inactive because `usePathname()` cannot distinguish the hash.

- [ ] **Step 6: Add weekly sitemap entry**

In `app/sitemap.ts`, add:

```ts
{ url: `${SITE_URL}/weekly`, lastModified: latestModified },
```

Place it after the archive entry and before dated archive rows.

- [ ] **Step 7: Run presentation and regression tests**

```bash
npm test -- tests/weekly-presentation.test.ts tests/presentation.test.ts tests/thumb-grid.test.ts tests/briefing.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit presentation integration**

```bash
git add components/ArticleTypeBadge.tsx components/ThumbTile.tsx components/BriefingCard.tsx components/Header.tsx app/sitemap.ts tests/weekly-presentation.test.ts
git commit -m "feat: surface article types and weekly navigation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Documentation, Full Verification, and Visual Check

**Files:**
- Modify: `README.md:1-42`
- Modify: `docs/design.md:169-210,312-397`
- Verify: all modified source, tests, and retained data files.

**Interfaces:**
- Consumes: final schema, backfill command, weekly formula, and `/weekly` UI from Tasks 1–5.
- Produces: documented operating and data contracts; no new runtime API.

- [ ] **Step 1: Update README feature and flow documentation**

Add to the opening description that the dashboard now classifies selected international/domestic stories and derives a seven-day weekly report. Add these commands:

```bash
# retained JSON에 누락된 기사 유형을 백필
npx tsx scripts/backfill-article-types.ts
```

Add `/weekly` to the directory/route description and state that weekly results are derived at render time rather than stored separately.

- [ ] **Step 2: Update the canonical design document**

In `docs/design.md`:

- Add `articleType: "news"` to both international and domestic JSON schema examples.
- Document the six values and Korean labels.
- State that article type does not modify ranking.
- Add `/weekly` to screen design with the exact formula:

```text
importance = primary score sum + round(secondary score × 0.5) sum
trendScore = importance + uniqueDates × 8 + uniqueSources × 4 + crossScopeBonus(12)
```

- Document the eight fixed topics and maximum two topics per article.
- Document fail-soft skipping of invalid retained dates.

- [ ] **Step 3: Run all automated quality gates**

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected:

- Every Vitest test passes.
- TypeScript exits 0 with no diagnostics.
- ESLint exits 0 with no warnings promoted to errors.
- Next.js production build succeeds and includes `/weekly`.

- [ ] **Step 4: Verify retained data completeness and rank preservation**

```bash
npx tsx -e 'import { readFile, readdir } from "node:fs/promises"; import { DailyDataSchema } from "./lib/types"; let rows=0; for (const file of await readdir("data/daily")) { if (!file.endsWith(".json")) continue; const data=DailyDataSchema.parse(JSON.parse(await readFile(`data/daily/${file}`, "utf8"))); for (const item of [...data.top5, ...(data.domestic?.items ?? [])]) { if (!item.articleType) throw new Error(`${file} missing articleType`); rows += 1; } } console.log(`validated ${rows} typed stories`)'
```

Then rerun the checksum comparison from Task 2 against `$CLAUDE_JOB_DIR/tmp/article-ranks-before.json`.

Expected: every retained article is typed and ranks/scores/URLs are unchanged.

- [ ] **Step 5: Launch and inspect the real page**

Use the project `run` skill to start the app. Open `/weekly` in the browser and inspect desktop and mobile widths.

Verify visually:

- No horizontal page overflow.
- Four mobile navigation items fit without clipped labels.
- Leading-topic cards and representative links are readable.
- Type bars remain inside their tracks at 0% and 100%.
- Every type row has direct total, international, domestic, and percentage text.
- Dark mode uses existing theme tokens and maintains readable text/track contrast.
- `<details>` lists and daily flow remain readable with long Korean titles.
- No label collisions or clipped stat values.

Also inspect `/` and one `/archive/[date]` route to confirm badges do not obscure image titles or break domestic item layout.

- [ ] **Step 6: Inspect browser console and route responses**

Check that `/weekly`, `/`, and one archived date return 200. Read browser console errors filtered with `error|warning|hydration`; expected result is no application errors or hydration mismatch.

- [ ] **Step 7: Commit documentation and final corrections**

```bash
git add README.md docs/design.md
git add -u
git commit -m "docs: document weekly art trends report

Co-Authored-By: Claude <noreply@anthropic.com>"
```

If visual inspection required source corrections, include those exact files in this final commit only after rerunning their focused tests and the full quality gates.

- [ ] **Step 8: Review final branch state**

```bash
git status --short
git log --oneline main..HEAD
git diff --stat main...HEAD
```

Expected: clean working tree, design/plan commits plus implementation commits, and only feature-related files changed.
