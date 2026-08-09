# 아트 뉴스 데일리

매일 주요 미술 뉴스를 모아 중요도 순으로 다섯 건을 보여 주고, 카리나의 한국어 브리핑을 함께 제공하는 개인용 대시보드입니다. 국제·국내 기사를 보도·분석·인터뷰·리뷰·PR·행사안내로 분류하며, 최근 7일 데이터에서 주간 미술계 동향을 파생합니다.

## 기술 스택

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS 4, Pretendard
- GitHub Actions 데이터 수집, Vercel 배포
- 저장소의 JSON 파일을 사용하는 정적 데이터 구조

## 데이터 흐름

GitHub Actions가 매일 07:40 KST에 RSS 뉴스를 수집하고 `data/`에 커밋합니다. 이 커밋이 Vercel 재배포를 시작하며, 헤르메스의 09:00 KST 카리나 작업은 별도 사이드카 JSON을 `data/karina/`에 푸시합니다. 일별 데이터는 최근 7일만 보관하고 그보다 오래된 파일은 수집 과정에서 정리합니다.

## 로컬 실행

```bash
npm i
npm run dev
```

새 데이터를 직접 수집하려면 다음 명령을 실행합니다.

```bash
npx tsx scripts/collect.ts
```

보관 중인 JSON에 누락된 기사 유형을 백필하려면 다음 명령을 실행합니다. 이미 분류된 파일은 다시 쓰지 않습니다.

```bash
npx tsx scripts/backfill-article-types.ts
```

## 주요 화면

- `/` — 오늘의 국제 Top 5, 국내 브리핑, 카리나 브리핑
- `/weekly` — 최근 최대 7일의 핵심 주제, 기사 유형 분포, 일별 동향
- `/archive` — 보관 중인 날짜별 뉴스

주간 리포트는 별도 JSON으로 저장하지 않고 보관 중인 일별 데이터에서 페이지 렌더링 시 결정론적으로 계산합니다.

## 디렉터리 구조

```text
app/          페이지와 썸네일 API 라우트
components/   대시보드 UI 컴포넌트
data/         최근 7일의 뉴스와 카리나 사이드카 JSON
lib/          수집, 점수화, 데이터 로딩 로직
scripts/      일일 뉴스 수집 스크립트
tests/        파서, 점수, 보관 정책 테스트
docs/         설계 문서
.github/      일일 수집 워크플로
```

상세한 요구사항과 구조는 [설계 문서](docs/design.md)를 참고하세요.
