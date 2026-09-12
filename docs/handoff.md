# 운영 인수인계 — 현재 상태

> 최종 갱신: 2026-09-12. 2026-08-01 구축 당시의 코디네이터 교대 브리프(Orca run `run_96d488c30c74`)는 모든 태스크가 끝나 폐기했다. 당시 내용은 git 이력에 남아 있다.

## 구성

| 구성 요소 | 위치 | 상태 |
|---|---|---|
| 대시보드 (Next.js) | https://artnews-daily.vercel.app — `main` push 시 Vercel 자동 배포 | ✅ 운영 중 |
| 해외·국내 수집 | GitHub Actions `collect.yml`, 매일 07:40 KST (22:40 UTC) | ✅ 운영 중 |
| 수집 결과 점검 | 같은 워크플로의 `verify` 단계 (`scripts/verify-daily.ts`) | ✅ 2026-09-12 추가 |
| 카리나 브리핑 4건 | 로컬 헤르메스 크론 09:00 KST → `data/karina/<날짜>.json` 직접 push | ✅ 운영 중 |

## 필요한 비밀 값

- **`DEEPL_API_KEY`** (GitHub Actions secret) — DeepL API Free 키(`…:fx`). 없거나 무효면 영문 원문이 그대로 게시되고 `verify` 단계가 실패한다.
  - 설정: `gh secret set DEEPL_API_KEY`
  - 과거 날짜 재번역: `DEEPL_API_KEY=… npx tsx scripts/backfill-translations.ts`

## 알려진 한계

1. **Google News 링크 해석은 비공식 RPC**(`batchexecute?rpcids=Fbv4je`)에 의존한다. 서명 방식이 바뀌면 `resolved: false` 폴백(Google 링크 유지, 썸네일 없음)으로 떨어진다. 직접 RSS 4종(ARTnews·The Art Newspaper·Hyperallergic·Artforum)은 계속 동작한다.
2. **번역은 DeepL Free 월 50만 자 한도.** 하루 제목·요약 10건(약 2~3천 자)이라 여유가 크다. 한도 초과(HTTP 456) 시 원문 노출 + `verify` 실패.
3. **GitHub Actions `schedule`은 정시를 보장하지 않는다** (수 분~수십 분 지연 가능).
4. **카리나 섹션은 사용자 맥이 켜져 있어야 채워진다.** 누락되면 다음 날 수집 run에 경고 annotation이 붙는다.
5. **보관은 7일**이며 그 이전 데이터는 삭제된다(사용자 확정). git 이력에는 남는다.

## 장애 대응 순서

1. Actions의 `collect` run이 빨간색이면 `verify` 단계 로그의 `::error::` 줄을 본다.
2. "untranslated"면 DeepL 키·한도를 확인하고, 고친 뒤 backfill 스크립트로 보관 중인 날짜를 재번역한다.
3. Google 경유 기사가 사라지거나 특정 매체로 쏠리면 코드보다 먼저 위 1번(Google RPC)을 의심한다.
