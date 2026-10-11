# Supabase 연결·이전 안내

## 현재 구현과 검증 상태

기존 Database의 배열·ID·원문·참조 관계와 UI를 유지합니다. 주 저장소는 Supabase이고 localStorage에는 이전 원본, 계정별 기기 초안, 복원 전 안전 사본, 이전 완료 표시만 보관합니다. 로그인 전에는 기록 화면을 렌더링하지 않으며 계정 변경·로그아웃 시 기존 App을 언마운트합니다.

2026-10-11 로컬 설치 완료 후 검증: `npm run build`(tsc -b + Vite), `npx tsc --noEmit`, 전체 자동 테스트 53개 모두 통과했습니다. Supabase SDK 2.117.3의 실제 타입으로 client import, Auth와 CRUD 코드를 검사했습니다. package-lock도 SDK 의존성을 포함합니다.

혼합 TXT → importRecords → validation → cloud save → 재조회 및 로컬 병합 → cloud save → 재조회 흐름은 메모리 전송 계층으로 검증했습니다. 중복 가져오기, 이전 반복, 원본 보존, 네트워크 실패와 revision 충돌 테스트를 포함합니다. 실제 Supabase 인증·SQL·RLS·두 기기 동기화와 모바일 브라우저 확인은 아래 설정 후 수행해야 합니다. 현재 배포 사이트는 이번 검증으로 갱신하지 않았습니다.

## 사용자가 실행할 순서

1. Supabase 프로젝트에서 SQL Editor를 열고 `supabase/migrations/001_initial_schema.sql` **전체**를 실행합니다. 테이블·RLS 정책 4개·저장 함수를 한 번에 만듭니다. 기존 브라우저 데이터를 수정하는 SQL은 없습니다.
2. Authentication에서 Email provider를 활성화하고 이메일 확인을 유지합니다. Authentication → URL Configuration에서 Site URL을 실제 배포 URL로 지정하고 Redirect URLs에 로컬·배포 주소를 추가합니다. GitHub Pages를 유지하면 `https://temporarykorean.github.io/badminton-note/`, 로컬은 `http://localhost:5173/`, Vercel이면 그 실제 도메인입니다. 서로 다른 주소로 확인 링크가 이동하면 해당 주소에서 다시 로그인하세요.
3. 프로젝트 URL과 **sb_publishable_로 시작하는 Publishable key**를 복사합니다. service_role·secret key는 사용하지 않습니다. 이 앱은 예전 JWT anon key도 받아들이지 않도록 공개 키 접두사를 확인합니다.
4. `.env.example`을 참고해 `.env.local`을 직접 작성합니다. 파일은 Git에서 제외됩니다.

```dotenv
VITE_SUPABASE_URL=프로젝트_URL
VITE_SUPABASE_PUBLISHABLE_KEY=공개_키
```

```sh
npm install
npm test
npm run build
npm run dev
```

Node.js 24 기준입니다. .env 변경 후 dev 서버를 재시작하고 배포는 다시 빌드합니다. Vite 환경변수는 브라우저 번들에 포함되므로 공개 키만 넣습니다.

5. Vercel → Project Settings → Environment Variables에 동일한 두 변수 이름을 등록합니다. 필요한 Production/Preview 환경을 선택하고 Redeploy합니다. Framework Preset Vite, Build Command `npm run build`, Output Directory `dist`입니다. Vercel에는 `VITE_BASE_PATH`를 별도로 지정하지 않습니다.
6. GitHub Pages를 유지한다면 Repository Settings → Secrets and variables → Actions → Variables에 같은 두 이름을 등록합니다. workflow의 build에 전달됩니다. 키는 공개 키여야 합니다. 이번 변경을 main에 올리기 전 SDK 설치·빌드·실제 연결 검증을 끝내세요.

## DB 설계와 보안

`public.kokrecall_data`: `user_id` UUID 기본키/Auth FK, `revision` bigint, `created_at`·`updated_at` timestamptz는 일반 column입니다. `data` JSONB에는 기존 Database를 손실 없이 저장합니다. 기존 레슨·대회·topics·피드백·그룹·복습 기록·설정은 모두 포함됩니다. 기록별 user_id를 중복 저장하는 대신 전체 사용자 데이터 행에 user_id를 적용합니다. 기존 ID는 UUID 또는 문자열 그대로 유지합니다.

초기 단계에서 테이블을 여러 개로 나누면 레슨 편집 시 피드백/카드 교체, 백업 복원, TXT 일괄 가져오기의 원자성을 바꿔야 합니다. 현재 개인 앱은 사용자별 aggregate 행으로 이 동작을 보존합니다. 데이터가 커지면 repository에서 정규화 테이블로 전환할 수 있습니다. 단점은 매 저장마다 전체 JSON을 전송하며 서로 다른 기록 동시 편집도 충돌한다는 점입니다.

RLS는 SELECT/INSERT/UPDATE/DELETE 모두 `user_id = auth.uid()`입니다. 익명 테이블 권한을 철회하고 저장 RPC도 authenticated만 실행할 수 있습니다. RPC는 SECURITY INVOKER이고 사용자 ID를 입력받지 않습니다. 세션의 auth.uid()로만 저장합니다. revision이 다르면 아무 행도 변경하지 않아 이전 기기의 내용으로 덮어쓰지 않습니다.

SQL 실행 후 Security Advisor와 Table Editor에서 RLS 활성화를 확인하세요. 서로 다른 두 테스트 계정으로 다른 계정의 행을 조회·수정할 수 없는지 반드시 확인하세요. 프론트엔드 validation은 보안을 대체하지 않으며 DB RLS가 접근 제어를 담당합니다. Auth 토큰은 Supabase SDK가 브라우저에 보관합니다. 이전 로컬 원본과 초안은 로그아웃 후에도 기기에 남으므로 공유 기기에서는 주의하세요.

## 기존 localStorage 이전

기록이 남아 있는 **기존 주소·브라우저**에서 로그인합니다. 기존 데이터 발견 카드 → 중복 검사 → 새 기록/중복 건수 확인 → 클라우드로 이전하기.

ID 또는 레슨 출처+정규화한 회차 범위+대표 날짜, 대회 정규화 이름+날짜로 중복을 검사합니다. 이미 클라우드에 있는 기록과 복습 상태가 우선입니다. 참조되는 그룹·피드백·카드 ID를 맞춰 병합하고 세션도 ID로 중복 제거합니다. 전체 결과를 검증한 뒤 하나의 원자적 요청으로 저장합니다. 실패 시 일부분만 저장하지 않습니다. 재실행해도 같은 항목을 생성하지 않습니다.

이전 성공 표시 `kokrecall:migration:사용자ID`를 남깁니다. 원본 데이터·원래 초안은 지우지 않습니다. 이전 카드가 다시 표시될 수 있지만 재검사하면 중복 제외됩니다. 원래 초안은 해당 계정에 초안이 없을 때 복사합니다. 주소를 변경해 원본을 찾지 못하면 로그인 화면의 로컬 원본 백업 또는 이전 버전의 백업 파일을 이용하세요. JSON 복원은 병합이 아니라 현재 계정 전체 교체이므로 preview를 확인하세요.

## TXT 이전

데이터 가져오기 → 기존 혼합 TXT 선택 → parser 실행 → 클럽/아카데미/대회/미분류 preview → 날짜·회차·유형 수정 → 중복 자동 제외 → 가져오기.

parseTXT·importRecords를 재사용합니다. 원문, 합쳐진 회차, 여러 날짜를 그대로 보존합니다. 같은 파일 내 중복도 제외합니다. 서버 revision 검사로 두 기기가 동일 파일을 동시에 가져와도 먼저 저장한 결과를 덮어쓰지 않습니다. 실패는 전체 요청 실패로 0개 완료로 표시하며, 원인은 동기화 오류에 표시됩니다. 최신 데이터를 읽고 다시 검사하면 이미 저장된 항목을 제외합니다.

번호만 있는 `1.`, `2.`, `3.` 같은 줄은 새 피드백 생성/반복 집계에서 제외하며 기존 원문은 보존하고, 잘못된 파생 피드백과 복습 문항은 안전 사본을 만든 뒤 재처리합니다.

## 회귀 검증 목록

자동 테스트 53개. 클럽/아카데미/대회 혼합 파싱·가져오기·재가져오기, 회차 범위/날짜/원문/ID/복습 기록 보존, 로컬 병합 반복, 클라우드 우선, 번호-only 제외, 계정별 초안, 가짜 전송 계층의 조회/저장/네트워크 실패/동시 수정 충돌을 검증했습니다. 실제 PostgreSQL RLS 검증은 포함되지 않습니다.

설정 완료 후 아래는 실제 테스트 계정과 별도 테스트 기록으로 확인하세요. 실제 개인 데이터나 localStorage를 지워서 테스트하지 마세요.

| 항목 | 확인 방법 | 현재 상태 |
| --- | --- | --- |
| A | 로그인→기록 저장→새로고침 유지 | 실환경 대기 |
| B/C | 두 브라우저 같은 계정→한 곳 저장→다른 곳 최신 불러오기 | 실환경 대기 |
| D | 로컬 이전 후 레슨/대회/그룹/복습 수·원문 비교 | 병합 단위 테스트 통과, 실환경 대기 |
| E/F | 혼합 TXT 가져오기→동일 파일 재가져오기 0개 | 파서·중복 테스트 통과, 실환경 대기 |
| G/H/I | 각 출처와 대회 목록/상세/회차/날짜 | 모델 테스트 통과, UI 실환경 대기 |
| J/K | 레슨·대회 수정/삭제 후 다른 브라우저 조회 | 실환경 대기 |
| L | 로그아웃 기록 화면 미노출, 다른 사용자/익명 API 권한 거부 | SQL·UI 구현, 실환경 대기 |
| M | 검색/필터/기술/그룹/통계/복습 | 기존 계산 보존, 모델 테스트 통과, UI 대기 |
| N | 375/390/430px 로그인/작성/검색/필터/import/이전/키보드 | 반응형 CSS 보존, 실제 브라우저 대기 |
| 오류 | 네트워크 끊고 저장 실패→초안 유지→재연결 저장 | 가짜 전송 테스트 통과, 실환경 대기 |
| 충돌 | 두 곳에서 같은 revision 수정→두 번째 저장 거절 | 가짜 전송 테스트 통과, SQL 실환경 대기 |

## 변경 파일

신규: `.env.example`, `src/vite-env.d.ts`, `src/lib/supabase.ts`, `src/AuthGate.tsx`, `src/data/cloudAccess.ts`, `src/data/cloudRepository.ts`, `src/data/merge.ts`, `src/cloud.test.ts`, `supabase/migrations/001_initial_schema.sql`, 이 안내 문서.

수정: `package.json`, `.gitignore`, `src/main.tsx`, `src/repository.ts`, `src/domain.ts`, `src/ImportPage.tsx`, `src/BackupPanel.tsx`, `src/style.css`, `README.md`, `.github/workflows/deploy-pages.yml`.

남은 작업: Dashboard SQL/Auth/URL 설정→두 기기·RLS·모바일 실제 검증→검증 후 배포. 실시간 구독·오프라인 저장 큐·비밀번호 재설정 UI는 이번 범위에서 구현하지 않았습니다. 이메일 회원가입/확인/로그인/로그아웃을 지원합니다.
