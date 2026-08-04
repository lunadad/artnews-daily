# 아트 뉴스 데일리 대시보드 — 설계 문서

> 작성: Claude Opus 5 (설계·검증 담당) · 2026-08-01
> 구현: codex `gpt-5.6-sol` (Orca orchestration 워커)
> 저장소: `lunadad/artnews-daily` (public) · 배포: Vercel

---

## 0. 확정된 결정사항 (사용자 확인 완료)

| # | 항목 | 결정 |
|---|---|---|
| 1 | 카리나 브리핑 연동 | **오전 9시** 잡(`90440b779c71`)에 연동. 오전 8시 잡은 별개의 시장 브리핑이므로 건드리지 않음 |
| 2 | GitHub 저장소 | `lunadad/artnews-daily`, **public** (Actions 실행시간 무제한 무료) |
| 3 | 뉴스 수집 소스 | **Google News RSS** (`news.google.com/rss/search`) 주 소스 + ARTnews / The Art Newspaper 직접 RSS 보강 |
| 4 | 날짜 이동 | **캘린더 UI**로 날짜 선택 이동 |
| 5 | 데이터 보관 | **최근 7일치만** 보관, 그 이전은 자동 삭제 |

## 1. 가정 (사용자 미확인 — 구현 시 이 전제로 진행)

1. **수집 시각은 매일 07:40 KST (22:40 UTC)** — 오전 9시 카리나 브리핑보다 앞서 대시보드가 준비되도록. GitHub Actions `schedule`은 최소 5분 간격이며 수 분~수십 분 지연될 수 있으므로 정시 보장은 하지 않는다.
2. **썸네일은 저장소에 바이너리로 커밋하지 않는다.** 7일 보관이라도 커밋 이력에는 영구 누적되어 1년이면 수백 MB가 된다. 대신 `/api/thumb` 프록시 라우트로 원본을 서버사이드 캐싱 중계한다(§5).
3. **번역은 `translate.googleapis.com/translate_a/single` (client=gtx) 무인증 엔드포인트를 사용한다.** 이미 카리나 스크립트가 동일 방식을 쓰고 있어 일관성이 있고 API 키가 필요 없다. 비공식 엔드포인트라 차단 가능성이 있으므로 실패 시 **원문을 그대로 노출**하고 파이프라인은 계속 진행한다(fail-soft).
4. **대시보드는 공개·인증 없음.** 사용자 본인 1인 사용을 전제하되 접근 제한은 두지 않는다.
5. **"중요도"는 LLM 판단이 아니라 결정론적 스코어링으로 계산한다**(§4). 크론이 매일 무인 실행되므로 재현 가능하고 비용이 0이며 디버깅이 가능해야 한다.

---

## 2. 요구사항 → 설계 매핑

| 요구사항 | 설계 반영 |
|---|---|
| 1. UI는 newbook 참고 | newbook의 디자인 토큰·컴포넌트 패턴 승계 (§3) |
| 2. 구글 검색으로 최신 주요 뉴스, 중요도 판별 | Google News RSS 다중 쿼리 → 중복 병합 → 스코어링 (§4) |
| 3. 하루 뉴스 5개 + 썸네일 | `top5` 배열, og:image 추출 → `/api/thumb` 중계 (§5) |
| 4. 초기 화면은 썸네일만, 클릭 시 기사로 이동 | 히어로 그리드: 이미지 타일만 렌더, 호버/포커스 시에만 제목 오버레이, `<a target="_blank">` (§6) |
| 5. 브리핑 | 썸네일 그리드 아래 "오늘의 브리핑" 섹션 (§4-3) |
| 6. Opus5 설계·검증 / gpt-5.6-sol 구현 | Orca orchestration Run + Task + codex 워커 (§9) |
| 7. 카리나 브리핑 뉴스 4개 한글 번역 + 썸네일 | 헤르메스 스크립트 패치 → 레포에 사이드카 JSON push (§7) |
| 8. GitHub + Vercel 배포 | §8 |
| 9. 캘린더 날짜 이동 | `<CalendarPicker>` — 최근 7일만 활성 (§6-4) |
| 10. 7일 보관 | 수집 잡 말미 prune 단계 (§4-5) |

---

## 3. UI 시스템 — newbook 승계

newbook(`/Users/haluna/workspace/newbook`)에서 **그대로 가져올 것**:

- **스택**: Next.js 16 App Router + React 19 + Tailwind CSS 4 (`@tailwindcss/postcss`) + Pretendard Variable
- **테마 토큰**: `app/globals.css`의 CSS 변수 + `@theme inline` 매핑 구조를 그대로 복제하되 아트 도메인에 맞게 색상만 교체
  ```
  라이트: --background #f7f6f4 / --surface #ffffff / --surface-muted #f0efec
          --border #e4e2dd / --foreground #1a1a19 / --foreground-muted #63615c
          --foreground-subtle #94918a / --accent #7c2d3b (deep crimson)
          --accent-foreground #ffffff / --tag-bg #f3ece4 / --tag-foreground #7a5a34
  다크:   --background #121110 / --surface #1a1917 / --surface-muted #232120
          --border #322f2c / --foreground #f0eeea / --foreground-muted #b0aca5
          --foreground-subtle #7d7972 / --accent #e0879a / --accent-foreground #2a0f16
  ```
  (책=초록 → 미술=크림슨/웜 뉴트럴. 구조는 동일하므로 newbook의 `globals.css`를 복사 후 값만 교체할 것)
- **레이아웃**: `layout.tsx`의 `html lang="ko" className="h-full antialiased"` + `min-h-full flex flex-col` + `main` `max-w-5xl mx-auto px-4 pt-6 pb-28 sm:px-6 sm:py-10`
- **헤더**: newbook `components/Header.tsx` 패턴 — sticky top-0, `bg-surface/90 backdrop-blur-xl`, 좌측 로고블록(`h-8 w-8 rounded-xl bg-foreground text-surface` 마크 + 2줄 워드마크), 우측 데스크톱 nav, `sm:hidden` 모바일 하단 고정 탭바(`.mobile-bottom-nav`, `env(safe-area-inset-bottom)`)
  - 워드마크: `아트 뉴스` / `ART NEWS DAILY`, 마크 문자 `A`
  - nav: 홈 `/`, 브리핑 `/#briefing`, 아카이브 `/archive`
- **카드**: `rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]`
- **섹션 헤딩**: `text-xs font-bold tracking-[0.12em] text-accent` (영문 kicker) + `text-xl font-black tracking-[-0.03em] sm:text-2xl` (한글 제목)
- **접근성**: `:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px }`, `prefers-reduced-motion` 블록, 최소 터치 타겟 44px(`min-h-11`)

**가져오지 않을 것**: Drizzle/Neon/pg (DB 없음), HeroCarousel(정적 이미지 슬라이드), VendorTabs, StatusBadge의 vendor 개념.

---

## 4. 데이터 수집 파이프라인

### 4-1. 소스

```ts
// Google News RSS — hl=en-US&gl=US&ceid=US:en 로 영문 원문 확보 후 번역
const GOOGLE_QUERIES = [
  'art auction record',
  'museum exhibition opening',
  'contemporary art market',
  'art fair Basel OR Frieze',
  'artist retrospective museum',
  'art restitution OR repatriation',
  'gallery represents artist',
  'biennale OR biennial art',
  'artist dies gallery museum',
  'museum appoints director',
];
// URL: https://news.google.com/rss/search?q=<encoded>+when:2d&hl=en-US&gl=US&ceid=US:en

// 직접 RSS — 도메인 전문지, 신뢰도 가중치 상향
const DIRECT_FEEDS = [
  ['ARTnews', 'https://www.artnews.com/feed/'],
  ['The Art Newspaper', 'https://www.theartnewspaper.com/rss.xml'],
  ['Hyperallergic', 'https://hyperallergic.com/feed/'],
  ['Artforum', 'https://www.artforum.com/feed/'],
];
```

> Artnet News 직접 피드는 `news.artnet.com/feed`가 HTTP 403을 반환하도록 변경되어 2026-08-02에 제거했다. Google News 경유 기사는 계속 수집하며 기존 도메인 가중치를 적용한다.

각 직접 RSS는 독립적으로 수집하며, 한 피드가 실패하면 오류를 로그로 남기고 빈 후보 목록으로 대체해 나머지 피드와 Google News 수집을 계속한다(fail-soft).

Google News RSS의 `<link>`와 `<description>` 링크는 모두 `news.google.com/rss/articles/CBMi...` 형태의 opaque URL이다. 수집 단계에서는 이를 그대로 보존하고, 1차 점수 상위 12개 클러스터 대표에 대해서만 다음 RPC 해석을 수행한다.

1. 브라우저 UA로 Google News 기사 URL을 GET하고 HTML의 `data-n-a-id`, `data-n-a-sg`, `data-n-a-ts`를 추출한다.
2. `garturlreq` inner payload에 위 article id/signature/timestamp를 넣고 `https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je`에 `f.req` form body로 POST한다.
3. 응답에서 `news.google.com`이 아닌 첫 `https:` URL을 원문 URL로 채택한다. 기사별 요청 사이에는 500ms를 두며 실패 시 고정 지연 후 한 번만 재시도한다.
4. 끝까지 실패하면 후보를 버리지 않고 Google News URL을 유지하며 `resolved: false`로 기록한다. 이 경우 기사 페이지 이미지 보강은 생략한다.

### 4-2. 7단계 수집·정규화·중요도 스코어링

1. **Stage 1 — 수집**: 모든 RSS에서 제목, 발행시각, `<source>` 이름·URL, 요약, RSS 이미지만 수집한다. Google URL은 아직 해석하지 않는다.
2. **Stage 2 — 정규화·필터**: Google 제목의 끝이 정확히 ` - <source 텍스트>`와 일치할 때만 접미사를 제거한다. URL의 추적 쿼리/해시/말미 슬래시를 정리하고 아래 저품질 필터를 적용한 뒤, 제목 불용어 제거 토큰의 **Jaccard 유사도 ≥ 0.5**인 항목을 같은 사건으로 묶는다.
3. **Stage 3 — 1차 점수**: 이미지 보너스를 제외한 점수로 클러스터를 정렬한다.
4. **Stage 4 — 상위 12개 보강**: 상위 12개 클러스터 대표만 Google RPC 링크 해석과 기사 페이지 이미지 추출을 수행한다. 번역은 아직 하지 않는다.
5. **Stage 5 — 최종 점수·다양성**: 이미지 보너스를 포함해 다시 점수화하고, 시장·경매(`market`)는 최대 3건, 나머지 카테고리는 최대 2건을 적용한다. 한 피드의 독점을 막기 위해 가능한 경우 서로 다른 매체 도메인 3개를 먼저 확보한 뒤 점수순으로 5건을 채운다.
6. **Stage 6 — 번역**: 최종 top5의 제목과 요약만 한글로 번역한다.
7. **Stage 7 — 브리핑·저장·prune**: 브리핑 생성 후 임시 파일을 원자적으로 교체하고 7일 초과 데이터를 삭제한 뒤 `data/index.json`을 재생성한다.

**저품질 필터**

| 처리 | 규칙 |
|---|---|
| 하드 제외 | URL 또는 Google `<source url>` 도메인이 `artsy.net`, `1stdibs.com`, `invaluable.com`, `liveauctioneers.com`, `ebay.com`, `saatchiart.com`인 상품 페이지 |
| 하드 제외 | `artnet.com/artists/*/...for-sale` 경로 또는 제목에 `for sale`, `buy now`, `price guide`, `sponsored` 포함 |
| 하드 제외 | 원문 URL 경로 세그먼트가 `television`, `movies`, `music`, `theater`, `books`, `style`, `food`, `sports` 중 하나인 기사. Google URL 해석 뒤에도 대표 기사에 다시 적용한다. `dance`, `design`, `architecture`는 허용한다. |
| 하드 제외 | 제목·요약에 `sopranos`, `sitcom`, `tv series`, `television series`, `actor`, `actress`, `film star`, `movie star`, `singer`, `rapper`, `band member`, `talk show`, `netflix series` 중 하나가 있으면 연예 문맥으로 제외한다. 단, 같은 문맥에 `painter`, `sculptor`, `gallery`, `museum`, `exhibition`, `biennale`, `auction`, `curator`, `artwork`, `retrospective` 중 하나가 함께 있으면 시각미술 기사로 인정한다. |
| 하드 제외 | 제목·요약에 `free day`, `family day`, `open house`, `members preview`, `admission`, `tickets on sale`, `opening hours`, `plan your visit`, `workshop`, `class registration`, `관람 안내`, `입장료`, `사전예약`, `관람시간`, `휴관`, `체험 프로그램`, `수강생 모집` 중 하나가 있는 기관 행사·관람 안내 페이지 |
| −12점 | 제목이 `^\d+ (books|shows|exhibitions|things|artworks|artists|museums|reasons)`이거나 `to read`, `gift guide`, `what to see`, `best of the`, `roundup`, `we're looking forward to`, `you should` 포함 |

감점 후 점수 하한은 0이다.

카테고리는 `market → museum → fair → artist` 순서로 동률을 판정한다. `market`은 `auction`, `auction house`, `sotheby`, `christie`, `phillips`, `bonhams`, `sold for`, `hammer price`, `fetched at`, `art market`, `market report`, `sales report`, `consign`, `provenance sale`, `collector`, `art dealer`, `estimate`만 사용한다. `gallery`, `market`, `sold`, `million` 단독 토큰은 시장 분류에 쓰지 않는다.

**스코어** (클러스터 단위):

   | 신호 | 배점 | 근거 |
   |---|---|---|
   | 보도 매체 수 `min(n,5) × 12` | 0–60 | **가장 강한 중요도 신호** — 여러 매체가 동시에 다루면 업계가 중요하게 본 사건 |
   | 소스 신뢰도 (클러스터 최대값) | 0–25 | 등록가능 도메인 기준: `artnews.com`/`theartnewspaper.com`/`artforum.com`/`artnet.com` = 25, `nytimes.com`/`theguardian.com`/`ft.com`/`reuters.com`/`apnews.com` = 22, `hyperallergic.com`/`frieze.com`/`apollo-magazine.com` = 18, 기타 = 8 |
   | 신선도 | 0–20 | ≤6h = 20, ≤12h = 16, ≤24h = 12, ≤48h = 6, 그 외 0 |
   | 키워드 시그널 (합산 상한 28) | 0–28 | `sold for`/`record price`/`auction record`/`hammer price`/`fetched` +12, `sotheby`/`christie`/`phillips`/`bonhams`/`auction house` +10, `art market`/`sales report`/`market report`/`turnover`/`bidding war`/`estimate` +9, `record`/`million`/`billion`/`collector`/`consign` +7. 기존 기관·환수·비엔날레·소송·회고전 신호는 그대로 유지한다. |
   | 시장·경매 카테고리 | 0 또는 15 | 클러스터 대표 기사의 카테고리가 `market`이면 +15 |
   | 썸네일 보유 | 0–5 | Stage 5에서만 RSS/기사 이미지 확보 시 +5 |
   | 리스티클·가이드 | −12 | 위 저품질 필터의 감점 규칙과 일치 |
   | 미등록 매체 단독 보도 | −12 | 클러스터 최고 소스 가중치가 8이고 `coverage = 1`일 때만 적용. `coverage ≥ 2`이면 감점하지 않음 |

`coverage`는 표시 문자열이 아니라 `<source url>` 또는 기사 URL의 등록가능 도메인(eTLD+1 근사: 마지막 두 레이블) 집합 크기로 센다. `sourceWeight`도 동일한 도메인 매핑만 사용해 `ARTnews`/`Art News Magazine` 같은 표기 차이가 중복 매체로 계산되지 않게 한다.

**이미지 우선순위**: The Art Newspaper는 `image/*` 타입의 `<enclosure url>` 원본을 최우선으로 쓰고 `<media:content>`/`<media:thumbnail>`을 폴백으로 쓴다. ARTnews는 `<content:encoded>`의 첫 HTTPS `<img src>`를 사용한다. RSS에서 못 찾은 상위 12개 대표만 기사 페이지의 `og:image` → `og:image:secure_url` → `twitter:image` 순으로 보강한다.

### 4-3. 브리핑 생성 (요구사항 5)

LLM 없이 규칙 기반으로 3부 구성:

```
1) 한 줄 헤드라인   : "오늘은 시장·경매 신호가 가장 두드러집니다." (카테고리 최빈값)
2) 분포 요약        : "총 N건 중 시장 2 · 기관 2 · 작가 1"  → 칩(chip)으로 시각화
3) 3줄 포커스       : top3 각각 "<한글 제목 축약> — <왜 중요한가 1문장>"
                      '왜 중요한가'는 카테고리별 템플릿 + 매체 수/키워드로 변주
```

`briefing: { headline, distribution: {market:n,...}, focus: [{title, why}] }` 형태로 JSON에 저장.

### 4-4. 산출 스키마

`data/daily/YYYY-MM-DD.json` (KST 날짜 기준):

```jsonc
{
  "date": "2026-08-01",
  "generatedAt": "2026-08-01T07:41:12+09:00",
  "briefing": {
    "headline": "오늘은 시장·경매 신호가 가장 두드러집니다.",
    "distribution": { "market": 2, "museum": 2, "artist": 1, "fair": 0, "general": 0 },
    "focus": [{ "title": "...", "why": "..." }]
  },
  "top5": [
    {
      "id": "sha1-of-normalized-url-첫12자",
      "rank": 1,
      "score": 87,
      "category": "market",
      "titleOriginal": "Sotheby's...",
      "titleKo": "소더비...",
      "summaryKo": "한 줄 요약(번역·정제)",
      "url": "https://www.artnews.com/...",
      "source": "ARTnews",
      "sourceDomain": "artnews.com",
      "discoveredVia": "google",
      "resolved": true,
      "publishedAt": "2026-08-01T02:11:00Z",
      "coverage": 3,               // 같은 사건을 다룬 고유 매체 도메인 수
      "image": "https://.../og.jpg", // 원본 og:image, 없으면 null
      "imageWidth": 1200, "imageHeight": 630
    }
  ],
  "karina": null   // 09:00 잡이 채우기 전에는 null, 채워지면 §7 스키마
}
```

`data/index.json`: `{ "dates": ["2026-08-01", "2026-07-31", ...] }` — 보관 중인 날짜 내림차순.

### 4-5. 보관 정책 (7일)

수집 잡 마지막 단계에서 `data/daily/*.json` 중 **최근 7일(오늘 포함)을 제외한 파일을 삭제**하고 `data/index.json`을 재생성한다. `data/karina/*.json`도 동일 규칙. 썸네일은 저장소에 없으므로 별도 정리 불필요.

### 4-6. 실패 처리 (fail-soft 원칙)

| 실패 지점 | 동작 |
|---|---|
| 개별 RSS 피드 실패 | 로그 남기고 나머지 피드로 진행 |
| Google News 링크 해석 실패 | 원래 Google News URL 유지, `resolved: false`, 이미지 보강 생략 |
| og:image 추출 실패 | `image: null` — UI는 플레이스홀더 타일 렌더 |
| 번역 실패 | `titleKo = titleOriginal` (원문 노출) |
| **후보가 5건 미만** | 확보된 만큼만 기록, `partial: true` 플래그 |
| **후보가 0건** | 잡을 실패시키고(exit 1) 기존 JSON을 덮어쓰지 않는다 — 대시보드는 직전 날짜를 계속 표시 |

### 4-8. 국내 미술뉴스 수집

`오늘의 브리핑`은 국제 `top5`/`briefing`과 독립된 국내 뉴스 파이프라인을 사용한다. Google News 한국어 RSS에 `when:3d`, `hl=ko`, `gl=KR`, `ceid=KR:ko`를 적용하고, 한국어 `OR` 오염을 피하기 위해 아래 열 개 쿼리를 각각 요청한다.

```
국립현대미술관 · 리움미술관 · 서울시립미술관 · 미술품 경매 서울옥션
한국 미술시장 · 비엔날레 한국관 · 갤러리 전시 개막 서울 · 단색화 작가
미술관 전시 · 작가 개인전 미술
```

수집 결과에서 `v.daum.net`, `news.nate.com`, `brunch.co.kr`, 네이버 블로그·포스트, 티스토리, `les24heures.fr`, `주달`을 제외한다. 제목의 코인·금융, 부동산, 백화점·쇼핑 PR, 관광 키워드와 `셔츠|유니폼|굿즈` + `경매` 조합도 하드 제외한다. 제목이 `[생생갤러리]`, `[포토]`, `[사진]`, `[영상]`, `[화보]`, `[오늘의 사진]`으로 시작하는 사진·영상 코너와 국제 파이프라인과 같은 기관 행사·관람 안내 문구가 제목·요약에 있는 기사도 제외한다. 제목·요약에 `미술`, `아트`, `작가`, `작품`, `전시`, `갤러리`, `화랑`, `미술관`, `박물관`, `비엔날레`, `아트페어`, `회화`, `조각`, `설치미술`, `공예`, `도예`, `판화`, `사진전`, `개인전`, `기획전`, `소장품`, `큐레이터`, `화백`, `경매`, `낙찰`, `옥션`, `컬렉터`, `아트테크`, `예술가`, `조형` 중 하나도 없으면 미술 도메인 밖 기사로 하드 제외한다. 또한 `한정판`, `프레그런스`, `컬래버`, `콜라보`, `협업 상품`, `굿즈`, `에디션 출시`, `신제품`, `출시`, `패키지 리뉴얼`, `향수`, `화장품`, `리미티드`가 있으면 상품·협업 PR로 제외하되, 같은 문맥에 `경매`, `낙찰`, `전시`, `미술관`, `비엔날레`가 있으면 정당한 미술 기사로 유지한다. `초대전`, `공모`, `수상자 발표`, `관람 안내`, `주간분양`에는 10점을 감점한다(단, `관람 안내`는 하드 제외가 먼저 적용된다).

국내 `market` 분류 토큰은 `경매`, `낙찰`, `낙찰가`, `낙찰률`, `옥션`, `서울옥션`, `케이옥션`, `소더비`, `크리스티`, `미술시장`, `거래액`, `거래량`, `시장 규모`, `아트테크`, `컬렉터`, `추정가`, `응찰`, `출품가`, `매각`으로 한정한다. `갤러리`, `개인전`, `전시`, `초대전`은 시장 토큰이 아니며, 해당 문맥은 다른 규칙에 따라 작가·기관 카테고리로 분류한다.

국내 클러스터링은 국제용 공백 단어 Jaccard를 사용하지 않는다. 제목의 구두점을 공백으로 바꾸고 `682억원`·`120만원`을 `682억`·`120만`으로 정규화한 뒤, 2자 이상 토큰에서 `미술관`·`전시`·`작가`·`경매`·`낙찰`·`올해`·`개최` 등 미술 기사 일반어를 제거한 **핵심 토큰 시그니처**를 만든다. 두 시그니처의 Jaccard 유사도가 `0.15` 이상일 때만 같은 사건으로 묶고, 둘 중 하나라도 비어 있으면 유사도를 0으로 보아 병합하지 않는다. `coverage`는 이 클러스터 안의 등록가능 매체 도메인 집합 크기다. `qualityCoverage`는 그중 국내 소스 가중치가 18 이상인 서로 다른 등록가능 도메인 수이며, 지역 보도자료 신디케이션을 중요도 신호로 오인하지 않도록 점수에는 이 값만 사용한다.

임계값은 2026-08-04 회귀 픽스처의 같은 사건 3쌍과 다른 사건 21쌍 실측에서 정했다.

| 방식 | 같은 사건 최소 | 다른 사건 최대 | 판정 |
|---|---:|---:|---|
| 단어 Jaccard (기존) | 0.133 | 0.071 | 간격 협소 |
| 문자 bigram Jaccard | 0.119 | 0.077 | 간격 협소 |
| 핵심 토큰 Jaccard | 0.250 | 0.000 | 완전 분리; 임계값 0.15 |

국내 점수는 이 한국어 전용 클러스터링과 기존 신선도 규칙을 사용하며 아래 표로 계산한다. 국제 `top5`는 기존 `titleTokens` Jaccard 0.5를 계속 사용한다.

| 신호 | 배점 | 근거 |
|---|---|---|
| 품질 가중 보도 매체 수 `min(qualityCoverage,5) × 12` | 0–60 | 국내 가중치 18 이상인 등록가능 도메인 수. 미술 전문지 등급을 이름 있는 매체의 하한으로 삼아 지역지 신디케이션을 제외한다. 원래 `coverage`는 디버깅·투명성을 위해 함께 보존한다. |
| 국내 소스 신뢰도 (클러스터 최대값) | 0–26 | 주요 종합일간지 26점, 통신사 24점, 경제지 21점, 방송 20점, 미술 전문지 18점, 기타 8점 |
| 신선도 | 0–20 | 국제 점수와 동일 |
| 국내 키워드 시그널 (합산 상한 28) | 0–28 | `낙찰가`/`최고가 낙찰`/`낙찰률`/`추정가`/`응찰` +12, `서울옥션`/`케이옥션`/`크리스티`/`소더비`/`경매사`/`경매장` +10, `미술시장`/`거래액`/`거래량`/`시장 규모`/`아트테크`/`컬렉터` +9, `경매`/`낙찰`/`출품`/`매각`/`판매액` +7. 기존 인사·비엔날레·환수·회고전·위작·소송 신호는 그대로 유지한다. |
| 시장·경매 카테고리 | 0 또는 15 | 클러스터 대표 기사의 카테고리가 `market`이면 +15 |
| 공지형 제목 | −10 | `초대전`, `공모`, `수상자 발표`, `관람 안내`, `주간분양` 포함 |
| 품질 매체 부재 | −15 | `qualityCoverage = 0`이면 적용. 지역지가 여러 곳에서 같은 보도자료를 신디케이션해도 감점을 면하지 않는다. |

국내 매체 가중치는 다음과 같다.

| 그룹 | 가중치 | 도메인·매체 |
|---|---:|---|
| 주요 종합일간지 | 26 | `chosun.com`, `joongang.co.kr`, `donga.com`, `hani.co.kr`, `khan.co.kr`, `hankookilbo.com`, `seoul.co.kr`, `munhwa.com` |
| 통신사 | 24 | `yna.co.kr`, `newsis.com`, `news1.kr` |
| 경제지 | 21 | `mk.co.kr`, `hankyung.com`, `mt.co.kr`, `sedaily.com` |
| 방송 | 20 | `kbs.co.kr`, `imnews.imbc.com`, `news.sbs.co.kr`, `ytn.co.kr`, `jtbc.co.kr` |
| 미술 전문지 | 18 | `kartprice.net`, `artworldnews.co.kr`, `artkoreatv.com`, 월간미술, 아트인컬처, 퍼블릭아트 |
| 그 외 | 8 | 위 목록에 없는 매체 |

국내 선정도 공용 다양성 규칙을 사용해 시장·경매는 최대 3건, 나머지 카테고리는 최대 2건으로 제한한다.

상위 8개 클러스터 대표만 기존 Google News `batchexecute` 해석기로 원문 URL을 복원한다. 원문 HTML의 `og:description`을 우선하고 `meta[name=description]`을 폴백으로 한 줄 요약을 만들며, 실패하면 제목만 노출한다. 국내 기사는 번역하거나 썸네일을 붙이지 않는다.

```jsonc
"domestic": {
  "headline": "오늘 국내 미술계는 시장·경매 신호가 두드러집니다.",
  "distribution": { "market": 2, "museum": 2, "artist": 1, "fair": 0, "general": 0 },
  "items": [
    { "rank": 1, "score": 78, "category": "market", "title": "...", "summary": "...", "url": "https://...", "source": "...", "publishedAt": "...", "coverage": 2, "resolved": true }
  ]
}
```

`domestic`은 과거 JSON 호환을 위해 optional이다. 필드나 항목이 없으면 UI에서 국내 브리핑 섹션만 생략하며, 국제 `briefing`은 계속 생성·보관하되 화면에는 렌더하지 않는다.

---

## 5. 썸네일 전달 — `/api/thumb`

**문제**: 원본 이미지를 그대로 `<img src>`에 넣으면 임의 외부 호스트 hotlink이고, `next/image` `remotePatterns`를 와일드카드로 열면 이미지 최적화기가 오픈 프록시가 된다.

**해결**: `app/api/thumb/route.ts` — 자체 검증 프록시

```
GET /api/thumb?u=<encodeURIComponent(원본 URL)>
```

1. `u`가 **현재 보관 중인 `data/**.json` 안에 실제로 존재하는 이미지 URL인지 확인**한다(빌드 시 수집한 URL 집합을 메모리 캐시). 없으면 404. → 오픈 프록시가 되지 않으며 별도 시크릿도 불필요.
2. `https:` 스킴만 허용, 10초 타임아웃, 응답 `content-type`이 `image/*`가 아니거나 `content-length > 5MB`면 404.
3. 성공 시 원본 바이트를 그대로 스트리밍하며 헤더 설정:
   `Cache-Control: public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400`
4. `export const runtime = 'nodejs'`

UI에서는 `next/image` 대신 일반 `<img loading="lazy" decoding="async">`를 쓰고 `src="/api/thumb?u=..."`로 지정한다(같은 오리진이므로 `remotePatterns` 설정 자체가 불필요).

---

## 6. 화면 설계

### 6-1. `/` — 오늘 (요구사항 3·4·5·7)

```
┌ Header (sticky) ────────────────────────────────────┐
│  [A] 아트 뉴스 / ART NEWS DAILY      홈 브리핑 아카이브 │
└──────────────────────────────────────────────────────┘

  TODAY'S PICKS                      2026년 8월 1일 (금)
  오늘의 아트 뉴스 5                       [캘린더 아이콘]

  ┌──────────────────┐ ┌────────┐ ┌────────┐   ← 썸네일만.
  │                  │ │        │ │        │      제목·설명 없음
  │   thumb #1       │ │ #2     │ │ #3     │      호버/포커스 시에만
  │   (2×2 span)     │ │        │ │        │      하단 그라데이션 +
  │                  │ └────────┘ └────────┘      제목 오버레이
  │                  │ ┌────────┐ ┌────────┐
  │                  │ │ #4     │ │ #5     │
  └──────────────────┘ └────────┘ └────────┘

  ── #briefing ────────────────────────────────────────
  DAILY BRIEFING
  오늘의 브리핑
  ┌ card ───────────────────────────────────────────┐
  │ 오늘은 시장·경매 신호가 가장 두드러집니다.        │
  │ [시장 2] [기관 2] [작가 1]        ← 칩            │
  │ ─────────────────────────────────────────────── │
  │ 1. <제목> — <왜 중요한가>                        │
  │ 2. ...                                          │
  │ 3. ...                                          │
  └─────────────────────────────────────────────────┘

  ── 카리나 브리핑 ──────────────────────────────────
  KARINA 09:00                          8월 1일 발송
  ┌ thumb ┐ ┌ thumb ┐ ┌ thumb ┐ ┌ thumb ┐   ← 4개, 한글 제목
  └───────┘ └───────┘ └───────┘ └───────┘
```

**히어로 그리드 규격**
- 저장된 `top5`의 `rank`·`score`는 변경하지 않는다. 이미지가 있는 항목이 하나라도 있으면 그중 점수가 가장 높은 항목(기존 점수순 배열에서 가장 앞선 항목)을 1번 대표 슬롯으로 옮기고, 나머지 4개는 기존 점수 순서를 유지한다. 전원 `image: null`이면 저장 순서 그대로 렌더한다.
- 데스크톱(`sm:` 이상): `grid-cols-4 grid-rows-2 gap-3`, 1번 항목 `col-span-2 row-span-2`, 나머지 각 1칸
- 모바일: `grid-cols-2 gap-2.5`, 1번 항목 `col-span-2` (와이드 16:9), 나머지 4개 정사각
- 각 타일: `<a href={url} target="_blank" rel="noreferrer">` + `aria-label={titleKo}`
  - `relative overflow-hidden rounded-2xl bg-surface-muted`, 이미지 `absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]`
  - 제목 오버레이: hover 불가 기기는 하단 45% 이내 그라데이션 위에 제목 1줄(`line-clamp-1`)과 소스명을 항상 표시한다. `@media (hover: hover)` 기기만 `opacity-0`에서 hover/focus 시 노출하고 제목을 2줄(`line-clamp-2`)로 확장한다. 화면 폭이 아니라 입력 장치의 hover 능력으로 분기한다.
  - `image: null`인 경우: 플레이스홀더 타일 — `bg-surface-muted`에 `text-foreground-subtle` 로 소스명 이니셜 + 항상 보이는 제목(썸네일이 없으니 제목이라도 보여야 링크 목적을 알 수 있음)
  - **접근성**: 시각적으로는 썸네일만이지만 스크린리더에는 항상 제목이 노출된다(`aria-label`). `prefers-reduced-motion` 시 scale 전환 비활성.

**카리나 섹션**: 4열(`grid-cols-2 sm:grid-cols-4`) 썸네일 카드. 여기는 **한글 제목을 항상 표시**한다(요구사항 7이 "한글로 번역해서 넣어달라"이므로 번역 결과가 보여야 함). 데이터가 없으면 섹션 자체를 렌더하지 않는다.

### 6-2. `/archive/[date]`

`/`와 동일 레이아웃, 해당 날짜 데이터. 보관 범위(7일) 밖이면 `notFound()`.

### 6-3. `/archive`

보관 중인 7일을 카드 리스트로 — `2026년 8월 1일 (토)` 형식의 날짜, 그날 국제 뉴스 1위 제목(2줄 제한), 작은 보조 브리핑 문구, 썸네일 5개 미니 스트립. `top5`가 비어 있으면 브리핑 문구를 카드 제목으로 사용한다.

### 6-4. 링크 공유 메타데이터

- 루트 레이아웃의 `metadataBase`는 프로덕션 URL(`https://artnews-daily.vercel.app`)이다.
- `/`와 `/archive/[date]`는 해당 날짜로 `오늘의 아트 뉴스 · YYYY년 M월 D일` 제목과 브리핑·1위 기사 조합 설명(160자 이내)을 생성한다. Open Graph는 `article`, `ko_KR`이며 Twitter는 `summary_large_image`를 사용한다.
- 공유 이미지는 해당 날짜 `top5`에서 이미지가 있는 첫 항목만 `/api/thumb?u=...`로 중계하고 1200×630 크기를 선언한다. 이미지가 없으면 이미지 메타를 생략한다.
- `/archive`는 목록 전용 정적 제목과 설명을 사용한다.

### 6-5. 캘린더 (요구사항 9)

`components/CalendarPicker.tsx` — client component. 외부 라이브러리 없이 구현:

- 헤더의 캘린더 아이콘 버튼 클릭 → `<dialog>` 또는 팝오버로 월 그리드 표시
- 기본 표시 월 = 현재 보고 있는 날짜의 월, `‹ ›` 로 월 이동
- **보관 중인 날짜(`data/index.json`의 7일)만 활성 링크** (`text-foreground`, `hover:bg-surface-muted`), 나머지는 `text-foreground-subtle pointer-events-none opacity-40`
- 현재 날짜 = `bg-accent text-accent-foreground rounded-full`
- 오늘 = `ring-1 ring-accent`
- 날짜 클릭 → `router.push('/archive/' + date)` (오늘이면 `/`)
- 키보드: `Esc` 닫기, 방향키로 날짜 이동, 활성 날짜만 tab stop
- 팝오버 하단에 `최근 7일치만 보관합니다` 안내문

### 6-6. 반응형 / 성능

- 첫 화면 히어로 top5 이미지는 모두 `loading="eager"`; 첫 타일만 `fetchpriority="high"`, 나머지는 `fetchpriority="auto"`
- 아카이브 미니 스트립과 카리나 섹션처럼 스크롤 아래의 이미지는 `loading="lazy"` 유지
- 페이지는 `export const revalidate = 300` (ISR) — 데이터가 파일이므로 재배포 시 갱신되지만, 카리나 push가 반영되도록 짧은 revalidate 유지
- 다크모드는 `prefers-color-scheme` 자동 (newbook과 동일, 토글 없음)

---

## 7. 카리나 브리핑 연동 (요구사항 7)

**대상**: `~/.hermes/scripts/karina_art_briefing_claude.py` (cron job `90440b779c71`, `0 9 * * *`)

이 스크립트는 이미 (a) ARTnews·The Art Newspaper RSS 수집, (b) 상위 4건 선별, (c) `translate_to_korean()` 한글 번역을 수행한다. **기존 텔레그램 발송 동작은 절대 변경하지 않고**, 발송 직후 사이드카 export 단계를 추가한다.

### 7-1. 스크립트 패치 (추가만, 기존 로직 무변경)

```python
def export_to_dashboard(items: list[Item]) -> None:
    """선별된 4건을 artnews-daily 저장소에 기록. 실패해도 브리핑에는 영향 없음."""
    # 1. og:image 추출: 각 item.link 를 GET → <meta property="og:image"> 정규식 파싱
    #    (5초 타임아웃, 실패 시 None)
    # 2. titleKo = translate_to_korean(item.title)
    #    summaryKo = translate_to_korean(item.summary[:300])
    # 3. payload = {"date": KST today, "generatedAt": iso, "items": [...]}
    # 4. REPO_DIR(~/.hermes/cache/artnews-daily) 에 clone 없으면 clone,
    #    있으면 `git pull --rebase --autostash`
    # 5. data/karina/YYYY-MM-DD.json 작성 + 7일 초과분 삭제
    # 6. git add/commit/push  (실패 시 로그만, 예외 전파 금지)
```

전체를 `try/except Exception: log & return` 으로 감싼다. **브리핑 발송이 이 코드 때문에 실패해서는 안 된다.**

`main()` 말미, 텔레그램 발송 성공 이후에 `export_to_dashboard(selected)` 호출.

### 7-2. 사이드카 스키마 — `data/karina/YYYY-MM-DD.json`

```jsonc
{
  "date": "2026-08-01",
  "generatedAt": "2026-08-01T09:00:31+09:00",
  "items": [
    {
      "rank": 1,
      "titleKo": "루브르, 새 관장 임명",
      "titleOriginal": "Louvre Names New Director",
      "summaryKo": "한 줄 요약(한글)",
      "url": "https://www.theartnewspaper.com/...",
      "source": "The Art Newspaper",
      "category": "museum",
      "image": "https://.../og.jpg"
    }
  ]
}
```

Next.js 페이지는 `data/karina/<date>.json`이 있으면 카리나 섹션을 렌더하고, 없으면 생략한다.

### 7-3. 푸시 충돌 회피

07:40 KST 수집 잡(Actions)과 09:00 KST 카리나 push는 시각이 다르고 **디렉터리도 다르다**(`data/daily/` vs `data/karina/`). 그래도 안전하게 카리나 쪽은 push 전 `git pull --rebase --autostash`, push 실패 시 1회 재시도한다.

카리나 push는 Vercel 자동 재배포를 트리거하므로 09:0x 경에 대시보드에 반영된다.

---

## 8. 배포

### 8-1. GitHub Actions — `.github/workflows/collect.yml`

```yaml
name: collect
on:
  schedule: [{ cron: '40 22 * * *' }]   # 22:40 UTC = 07:40 KST
  workflow_dispatch:
permissions: { contents: write }
concurrency: { group: collect, cancel-in-progress: false }
jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npx tsx scripts/collect.ts
      - name: commit
        run: |
          git config user.name  "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add data
          git diff --staged --quiet || git commit -m "chore(data): daily art news $(date -u +%F)"
          git pull --rebase --autostash
          git push
```

시크릿 불필요 (모든 소스가 무인증). `GITHUB_TOKEN`의 `contents: write`만 사용.

### 8-2. Vercel

- `vercel link` → 프로젝트 `artnews-daily`
- Git 연동으로 `main` push 시 자동 배포 (환경변수 없음)
- `vercel --prod` 최초 1회 수동 배포로 URL 확보

### 8-3. 저장소 구조

```
artnews-daily/
├─ .github/workflows/collect.yml
├─ app/
│  ├─ layout.tsx  globals.css  page.tsx
│  ├─ archive/page.tsx
│  ├─ archive/[date]/page.tsx
│  └─ api/thumb/route.ts
├─ components/
│  ├─ Header.tsx  ThumbGrid.tsx  ThumbTile.tsx
│  ├─ BriefingCard.tsx  KarinaSection.tsx  CalendarPicker.tsx
├─ lib/
│  ├─ data.ts        # data/ JSON 로딩·캐싱, 이미지 URL 허용 집합
│  ├─ types.ts       # DailyData / NewsItem / KarinaData zod 스키마
│  ├─ score.ts       # 스코어링·클러스터링 (순수 함수)
│  ├─ briefing.ts    # 브리핑 생성 (순수 함수)
│  ├─ sources.ts     # 피드 목록·소스 가중치·키워드 테이블
│  └─ translate.ts   # 번역 (fail-soft)
├─ scripts/collect.ts
├─ data/daily/*.json  data/karina/*.json  data/index.json
├─ tests/  (vitest — score/briefing/clustering 순수 함수 + 고정 RSS 픽스처)
└─ docs/design.md (이 문서)
```

### 8-4. 테스트 (vitest)

DB·네트워크 없는 순수 함수 위주:
- `score.test.ts` — 클러스터링(Jaccard), 점수 계산, 카테고리 다양성 제약
- `briefing.test.ts` — 분포 집계, 헤드라인 선택, 포커스 3건 생성
- `parse.test.ts` — 고정 RSS 픽스처(`tests/fixtures/*.xml`)로 Google News 링크 해석·og:image 추출
- `retention.test.ts` — 7일 prune 로직이 정확히 7개만 남기는지

---

## 9. 실행 체계 (요구사항 6)

| 역할 | 담당 | 산출물 |
|---|---|---|
| 설계 | Claude Opus 5 | 이 문서 |
| 구현 | codex `gpt-5.6-sol` (Orca orchestration 워커) | 위 저장소 전체 |
| 검증 | Claude Opus 5 | 빌드/테스트/실제 수집 실행/배포 URL 응답 확인 |

Orca Run → Task 생성 → `worker-start --agent codex` → `check --wait`로 `worker_done` 수신 → Opus 5 검증.

---

## 10. 리스크

| # | 리스크 | 완화 |
|---|---|---|
| 1 | Google News RSS는 비공식 인터페이스 — 구조 변경·차단 가능 | 직접 RSS(ARTnews/TAN/Hyperallergic/Artforum) 4종을 항상 병행 수집. 개별 피드는 fail-soft로 격리하며 Google 실패 시에도 후보 풀을 확보 |
| 2 | 번역 엔드포인트(gtx) 차단 | fail-soft — 원문 노출, 파이프라인 중단 없음 |
| 3 | og:image 핫링크 → 원본 사이트 대역폭 사용 | `/api/thumb`가 s-maxage 7일로 엣지 캐싱, 실제 원본 요청은 하루 수 회 수준 |
| 4 | 원본 기사 삭제 시 이미지 404 | `<img onerror>`로 플레이스홀더 대체 |
| 5 | GitHub Actions `schedule` 지연(수 분~1시간) | 정시 보장하지 않음을 전제. 09:00 카리나 push가 별도로 재배포를 트리거 |
| 6 | 헤르메스 로컬 머신이 꺼져 있으면 카리나 섹션 누락 | 섹션 조건부 렌더 — 없으면 그냥 표시 안 함 |
| 7 | 7일 보관이라 과거 데이터 영구 소실 | 사용자 확정 요구사항. git 이력에는 남으므로 필요 시 복원 가능 |
