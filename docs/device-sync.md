# 기기 간 동기화 검증 · 2026-10-11

## 변경

src/main.tsx: 모바일 visibilitychange 및 online 복귀 시 안전한 화면에서 최신 조회. 작성·복습·파일 가져오기 중에는 자동 조회를 미룹니다. 조회 성공 시 기존 migration preview를 폐기하고 최신 클라우드 데이터 기준으로 다시 병합하도록 합니다.
src/cloud.test.ts: 두 기기 스냅샷의 수정·삭제 재조회와 오래된 revision 저장 거절 테스트 추가.

서버가 source of truth입니다. 로그인/최초 진입/새로고침/최신 불러오기는 서버에서 읽습니다. 저장·수정·삭제 성공 시 RPC 응답으로 UI와 revision을 갱신합니다. Realtime은 사용하지 않습니다. 다른 기기 변경은 새로고침 또는 최신 불러오기로 반영됩니다. 복귀 자동 조회는 진행 중 작업이 없는 화면에서만 수행합니다.

## 검증 결과

SDK client를 실제 .env.local의 공개 설정으로 초기화했습니다. 요청은 실행 환경에서 fetch failed(status 0)로 실패하여 실제 서버 인증·RLS·저장은 확인하지 못했습니다. 개인 데이터 읽기·쓰기 요청은 하지 않았습니다.

| 시나리오 | 로컬 검증 | 실기기/서버 |
| --- | --- | --- |
| A 로그인→추가→새로고침 | 저장/재조회 테스트 통과, Auth 타입 통과 | 대기 |
| B 다른 브라우저 같은 데이터 | 공유 전송 계층의 별도 스냅샷 조회 통과 | 대기 |
| C 수정→다른 기기 재조회 | 통과 | 대기 |
| D 삭제→다른 기기 재조회 | 통과 | 대기 |
| E 로컬 이전·원문 보존 | 통과 | 대기 |
| F 반복 이전 중복 방지 | 통과 | 대기 |
| G 로그아웃·개인정보 차단 | AuthGate 계정별 unmount, own-user RLS/권한 SQL 점검 | 실제 토큰·RLS 대기 |
| H 빌드 | npm run build, npx tsc --noEmit 통과 | 완료 |
| I 전체 테스트 | 53개 통과 | 완료 |

Vite는 500kB 초과 번들 경고를 표시했습니다(압축 약161kB). 빌드 오류는 아닙니다. 원자적 저장은 전체 사용자 JSON을 전송하므로 큰 데이터 및 동시 편집에서 충돌할 수 있습니다. 오래된 revision은 저장하지 않고 최신 조회·재시도 안내를 표시합니다. 오프라인 저장 큐는 없습니다.

## 배포 설정

Supabase SQL은 사용자가 실행 완료했습니다. Authentication의 Email provider와 URL Configuration을 확인합니다. Site URL은 실제 Vercel 운영 주소, Redirect URLs는 http://localhost:5173/ 및 https://실제-앱.vercel.app/ 입니다. Vite가 다른 포트를 사용하면 해당 주소도 추가합니다. Preview 배포에서 이메일 인증을 사용할 경우 해당 주소도 허용합니다.

Vercel: 저장소 temporarykorean/badminton-note 연결, Framework Vite, Build npm run build, Output dist, 두 환경변수 VITE_SUPABASE_URL 및 VITE_SUPABASE_PUBLISHABLE_KEY 등록 후 재배포. VITE_BASE_PATH는 설정하지 않습니다. .env.local은 제외하고 .env.example에는 변수 이름만 둡니다. 브라우저 번들에는 공개 키만 사용합니다.

## Mac / iPhone 확인 순서

1. Mac에서 npm run dev, 회원가입·확인 이메일·로그인. 테스트 기록 하나를 추가하고 새로고침하여 유지 확인.
2. 기존 기록이 있는 브라우저에서 전체 백업 후 로컬 이전 preview 확인·이전. 원문/날짜/회차/출처/대회/복습 기록 확인. 동일 이전을 다시 검사하면 새 기록 0개인지 확인.
3. Vercel에 수정본 배포. iPhone에서 같은 계정으로 로그인해 Mac의 기록 확인. 주소가 바뀌면 이전 localStorage는 자동 이동하지 않으므로 기존 주소에서 먼저 클라우드로 이전.
4. iPhone에서 테스트 기록 수정, Mac의 최신 불러오기로 수정 확인.
5. iPhone에서 해당 테스트 기록 삭제, Mac 재조회로 삭제 확인. 실제 개인 기록을 테스트로 삭제하지 않음.
6. 두 기기에서 같은 revision으로 서로 수정하여 두 번째 저장의 충돌 안내 확인. 작성 초안을 보관하고 최신 불러오기 후 재시도.
7. 로그아웃 후 기록 화면이 닫히는지 확인. 서로 다른 테스트 계정과 익명 요청으로 다른 사용자 데이터 조회/수정이 거절되는지 확인.
8. iPhone에서 로그인 유지·긴 원문·키보드·복습·검색·TXT 파일 선택 동작 확인.

현재 작업으로 Vercel/GitHub에 게시하거나 실제 사용자 계정/데이터를 변경하지 않았습니다.
