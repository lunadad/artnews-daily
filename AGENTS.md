<claude-mem-context>
# Memory Context

# [Artnews] recent context, 2026-08-02 5:16pm GMT+9

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (11,885t read) | 373,758t work | 97% savings

### Aug 2, 2026
1174 10:17a ✅ All Quality Gates Pass: tsc, lint, and 41 Tests Green
1175 10:18a 🟣 collect.ts Re-run Succeeds: 5 International Stories, No Entertainment Obituaries
1176 10:19a 🔴 D1 Confirmed: Vincent Pastore Removed, D2 Confirmed: Rank 1 Has Image
1177 " 🔴 ThumbGrid Refined: Featured Slot Uses Highest-Score Image Item, Not Just First
1178 " 🔴 Live Filter Verification: Vincent Pastore Confirmed Excluded by isHardExcluded()
1179 " ✅ Commit ca8d300 Pushed to GitHub: fix: filter entertainment news and prioritize hero images
1180 " ✅ Vercel Production Deployment Triggered and Building
1181 10:20a ✅ Vercel Production Deployment Ready: dpl_AhcgPC4nYPkkcXs3mbAgKNUA2nbW
1182 " ✅ Production Verification Passed: All 5 Acceptance Criteria Met
1183 " ✅ Vercel Deployment dpl_AhcgPC4nYPkkcXs3mbAgKNUA2nbW: Ready (Production)
1187 10:23a 🟣 미술 경매·시장 뉴스 중요도 가중치 상향 (T8)
1184 " ✅ Production HTTP Verification Passed: Featured Tile Has Image, All Sections Intact
1185 " 🔴 Git State Verified Clean: HEAD=ca8d300, origin/main in Sync, Zero Entertainment Obituaries in top5
1186 " ✅ worker_done Sent to Orca Coordinator: msg_3a0a81bb04f2
1188 10:24a 🔵 Artnews 스코어링 시스템 현재 상태 확인
1189 " 🔵 docs/design.md 다양성 제약 및 국내 키워드 상한 위치 확인
1190 10:25a 🟣 T8 핵심 변경사항 패치 적용 완료
1191 10:26a 🔵 국내 키워드 서브스트링 중복 매칭 문제 발견
1192 " ✅ T8 변경 후 tsc/lint/test 전체 통과
1193 " 🟣 A/B 비교 스크립트 생성 (scratchpad/t8-market-ab.ts)
1194 " 🔵 A/B 비교 결과: 시장 기사 순위 4위→1위, 점수 65→100
1195 10:27a ✅ collect.ts 재실행 — 2026-08-02.json 생성 성공
1196 " ✅ T8 후 2026-08-02 top5 구성 변화 확인
1197 10:28a ✅ npm run build 성공 — Next.js 16 Turbopack 빌드 통과
1198 " ✅ docs/design.md 국내 스코어 표 개선 및 domestic market 보너스 테스트 추가
1199 " ✅ 최종 검증 통과 — tsc/lint/test(45개)/build 전체 성공
1200 " ✅ T8 커밋·푸시 완료 — SHA 8151cb8
1201 10:29a ✅ Vercel 배포 시작 — SHA 8151cb8 빌드 중
1202 " ✅ Vercel 프로덕션 배포 완료 — Ready 상태 확인
1203 " ✅ 프로덕션 HTTP 검증 완료 — 모든 완료 기준 통과
1204 " ✅ T8 완료 상태 최종 확인
1205 10:30a ✅ T8 완료 보고서 생성 (/tmp/artnews-t8-task_3d0796753927.md)
1206 " ✅ T8 worker_done 전송 완료
1207 4:11p 🔵 카리나 아트 브리핑 중복 기사 버그 확인
1208 " 🟣 카리나 아트 브리핑 — 피드 3종 추가 + 7일 중복 방지 + 48시간 신선도 정렬
1209 4:12p 🔵 karina_art_briefing_claude.py 전체 구조 파악
1210 " ✅ karina_art_briefing_claude.py 패치 전 백업 생성
1211 4:13p 🟣 karina_art_briefing_claude.py 패치 적용 — 피드 3종 추가 + 이력 관리 + select_items() 신설
1212 " 🟣 main() 교체 패치 — select_items() 호출 및 피드별 수집 로그 추가
1213 " 🔴 parse_date()에 timezone-naive datetime 반환 방지 패치 적용
1214 4:14p 🟣 드라이런 하네스 스크립트 생성 — 2회차 중복 방지 검증 자동화
1215 " 🔵 드라이런 1차 실패 — 샌드박스 환경에서 외부 네트워크 DNS 불통
1216 4:33p 🔵 parse_date 함수 본문 절단 — 프로덕션 크래시 원인 확인
1217 " 🔵 Artnet News RSS 피드 HTTP 403 차단 확인
1218 4:34p 🔵 karina_art_briefing_claude.py 구조적 손상 확인 — parse_date 본문이 select_items 뒤에 매몰
1219 " 🔵 Orca 런타임 비가동 상태 — 워커가 runtime_unavailable 환경에서 작업 중
1220 " 🔵 백업 diff 전수 검토 — 제거된 16줄 전부 T10 의도적 변경에 해당
1221 " 🔴 parse_date 함수 복구 및 Artnet News 피드 양쪽 제거 — 패치 적용 완료
1222 4:35p 🔴 parse_date 복구 검증 완료 — 4가지 입력 모두 tz-aware datetime 반환 확인
1223 " 🔵 드라이런 PASS — 단 실행 환경에서 모든 피드 URLError로 수집 0건 (vacuous PASS)

Access 374k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>