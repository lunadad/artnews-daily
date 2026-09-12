# 운영 인수인계 — 현재 상태

> 최종 갱신: 2026-09-12. 2026-08-01 구축 당시의 코디네이터 교대 브리프(Orca run `run_96d488c30c74`)는 모든 태스크가 끝나 폐기했다. 당시 내용은 git 이력에 남아 있다.

## 구성

| 구성 요소 | 위치 | 상태 |
|---|---|---|
| 대시보드 (Next.js) | https://artnews-daily.vercel.app — `main` push 시 Vercel 자동 배포 | ✅ 운영 중 |
| 해외·국내 수집 | GitHub Actions `collect.yml`, 예약 07:40 KST (22:40 UTC). 2026-08-26 이후 실제 시작은 09:10~15:20 KST로 크게 지연됨 | ✅ 운영 중 |
| 수집 결과 점검 | 같은 워크플로의 `verify` 단계 (`scripts/verify-daily.ts`) | ✅ 2026-09-12 추가 |
| 해외 top5 번역 | 로컬 헤르메스 `artnews-translate` 잡 (08–23시 30분 간격, no_agent) → `~/.hermes/scripts/artnews_translate_daily.py` | ✅ 2026-09-12 추가 |
| 카리나 브리핑 4건 | 로컬 헤르메스 크론 09:00 KST → `data/karina/<날짜>.json` 직접 push | ✅ 운영 중 |

## 번역 흐름

1. 수집기는 `DEEPL_API_KEY` secret이 있으면 DeepL로 바로 번역한다. **현재는 키 없이 운영**하므로 영문 그대로 저장된다.
2. 헤르메스 `artnews-translate` 잡이 전용 클론(`~/.hermes/cache/artnews-daily-translate`)을 `origin/main`에 맞춘 뒤, `data/daily/*.json`에서 한글이 없는 `titleKo`·`summaryKo`를 카리나 스크립트의 `translate_to_korean()`(Google gtx → translate.google.com → MyMemory)으로 번역하고, 브리핑 focus 제목을 갱신해 push한다. 제목만 반복하는 요약(Google News `<제목> <매체명>`)은 비운다.
3. 할 일이 없으면 조용히 끝난다(stdout 없음 → 텔레그램 메시지 없음). 번역 서비스가 모두 실패해 영문이 남으면 하루 1회 텔레그램 경고, 스크립트가 비정상 종료하면 헤르메스가 오류 알림을 보낸다.
4. 다음 날 수집의 `verify` 단계는 **전날 파일이 여전히 미번역이면** 워크플로를 실패시킨다(GitHub 알림 메일). 당일 미번역은 경고 annotation만 남긴다.

수동 실행: `python3 ~/.hermes/scripts/artnews_translate_daily.py` (git 없이 로컬 폴더만: `--data-dir <dir>`)

## 알려진 한계

1. **Google News 링크 해석은 비공식 RPC**(`batchexecute?rpcids=Fbv4je`)에 의존한다. 서명 방식이 바뀌면 `resolved: false` 폴백(Google 링크 유지, 썸네일 없음)으로 떨어진다. 직접 RSS 4종(ARTnews·The Art Newspaper·Hyperallergic·Artforum)은 계속 동작한다.
2. **번역은 무인증 서비스에 의존한다.** 2026-09-12 기준 Google gtx 두 호스트는 429, 실제 번역은 MyMemory(익명 일일 한도 있음, 카리나와 공유)가 한다. 막히면 DeepL API Free 키를 `gh secret set DEEPL_API_KEY`로 등록하면 수집 시점 번역으로 전환된다(코드 준비됨).
3. **번역과 카리나 섹션은 사용자 맥이 켜져 있어야 채워진다.**
4. **GitHub Actions `schedule`은 정시를 보장하지 않는다** — 최근에는 1.5~7.5시간 지연되고 있다.
5. **보관은 7일**이며 그 이전 데이터는 삭제된다(사용자 확정). git 이력에는 남는다.

## 장애 대응 순서

1. Actions의 `collect` run이 빨간색이면 `verify` 단계 로그의 `::error::` 줄을 본다.
2. "still untranslated"면 맥·헤르메스 상태(`hermes cron list`)와 `python3 ~/.hermes/scripts/artnews_translate_daily.py`의 stderr를 확인한다.
3. Google 경유 기사가 사라지거나 특정 매체로 쏠리면 코드보다 먼저 위 1번(Google RPC)을 의심한다.
