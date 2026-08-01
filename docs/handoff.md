# 인수인계 브리프 — 코디네이터 교대용

> 목적: 코디네이터(Claude Opus 5)가 사용량 한도 등으로 중단될 경우, **codex(gpt-5.6-sol)가 코디네이터 역할을 이어받아** 남은 과정을 끝낼 수 있도록 상태를 기록한다.
> 최종 갱신: 2026-08-01

## 역할 분담 (사용자 요구사항 6)
- **설계·검증**: Claude Opus 5 (코디네이터). 중단 시 codex가 대행.
- **구현**: codex `gpt-5.6-sol` (Orca orchestration 워커).

## 이어받는 방법

```bash
orca orchestration run-list --json
# Run: run_96d488c30c74  (아트 뉴스 데일리 대시보드)
orca orchestration run-use --id run_96d488c30c74 --takeover-legacy --json   # 원 코디네이터가 죽은 경우에만
orca orchestration task-list --run run_96d488c30c74 --json
orca orchestration check --wait --types worker_done,escalation,question --timeout-ms 900000 --json
```

원 코디네이터가 아직 살아 있으면 `--takeover-legacy` 를 쓰지 마라. 대신 이 문서와 `docs/design.md` 만 참고해 지시받은 작업을 수행하라.

## 태스크 현황

| Task ID | 내용 | 상태 |
|---|---|---|
| `task_8e0ac8db8bc3` (T1) | Next.js 앱 + 수집 파이프라인 전체 구현 | ✅ 완료·검증됨 |
| `task_da1062ec0c1a` (T2) | 헤르메스 카리나 스크립트 패치 (`~/.hermes/scripts/karina_art_briefing_claude.py`) | ⏳ 진행 중 |
| `task_42df1cfe0faa` (T3) | 수집 품질 수정 (Google News 링크 해석, 이미지, 중요도) | ✅ 완료·검증됨 |
| `task_7be57727cd9e` (T4) | GitHub 저장소 생성 + Vercel 프로덕션 배포 | ⏳ 진행 중 |

## 검증 완료 사항 (코디네이터가 직접 실행해 확인한 것)

- Google News RSS 링크는 opaque(`AU_yqL…`). 해석은 **기사 페이지 GET → `data-n-a-id`/`data-n-a-sg`/`data-n-a-ts` 추출 → `batchexecute?rpcids=Fbv4je` POST** 로만 가능. 실검증 완료.
- The Art Newspaper RSS는 `<enclosure>`(원본)·`<media:content>`(140px), ARTnews는 `<content:encoded>` 내 `<img>` 로 이미지를 제공.
- 2026-08-01 수집 결과: top5 / 3개 매체 도메인 / Google 경유 2건 / 이미지 5건 / 리스티클 0건 / 최고 coverage 3.

## 남은 과정 (T2·T4 완료 후 코디네이터가 할 일)

1. **T2 결과 검증**: `diff` 로 기존 브리핑 로직 무변경 확인, py_compile 통과, 드라이런 payload가 `docs/design.md` §7-2 스키마와 일치하는지 확인.
2. **T4 결과 검증**: 저장소 public 여부, Vercel↔GitHub 자동배포 연동, Actions `collect.yml` 실행 성공, 프로덕션 7개 엔드포인트 응답.
3. **엔드투엔드 확인**: 09:00 KST 카리나 크론이 실제로 `data/karina/<날짜>.json` 을 push 하고 대시보드 카리나 섹션이 렌더되는지 (다음 날 아침 또는 수동 실행으로 확인).
4. **사용자 보고**: 저장소 URL, 프로덕션 URL, 알려진 한계.

## 알려진 한계 / 개선 여지 (사용자에게 반드시 고지할 것)

1. **Google News 링크 해석은 비공식 RPC**에 의존한다. Google이 서명 방식을 바꾸면 해석이 실패하고 `resolved: false` 폴백(Google 링크 유지, 썸네일 없음)으로 떨어진다. 직접 RSS 2종은 계속 동작하므로 대시보드가 비지는 않는다.
2. **소스 풀이 좁다.** 현재 직접 피드가 ARTnews(10건)·The Art Newspaper(61건) 2종뿐이라, 무명 매체가 다중 보도(coverage) 신호로 상위에 오를 수 있다. Hyperallergic·Artforum·Artnet News 피드와 부고/인사 관련 Google 쿼리를 추가하면 판별력이 개선된다. (미적용 — 사용자 판단 필요)
3. **번역은 비공식 gtx 엔드포인트**. 차단 시 원문 노출로 fail-soft.
4. **GitHub Actions `schedule` 은 정시를 보장하지 않는다** (수 분~수십 분 지연 가능).
5. **보관은 7일**이며 그 이전 데이터는 삭제된다(사용자 확정). git 이력에는 남는다.
