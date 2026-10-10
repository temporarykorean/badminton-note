# 콕리콜

좋은 코칭을 잊지 않고, 다음 플레이에 적용하는 개인용 배드민턴 웹앱입니다.

레슨 기록 → 구조화 → 반복 복습 → 기억 강화 → 반복 문제 발견 → 다음 레슨에 적용.

**Mac에서 개발 → GitHub Pages로 코드 배포 → 스마트폰에서 사용 → localStorage에 기록 보관 → JSON으로 백업.** 별도 서버나 외부 DB는 사용하지 않습니다.

## 개발과 확인

Node.js 24를 사용합니다.

```sh
npm install
npm run dev
npm test
npm run build
npm run check:pages
npm run preview
```

React + TypeScript + Vite 기반입니다. 기존 레슨 CRUD·검색, 기술별 보기, 반복 피드백 그룹 분리/병합, 간격 복습, 혼합 TXT 가져오기와 출처 비교를 유지합니다. 스마트폰에서는 하단 탭바, 데스크톱에서는 사이드바를 사용합니다.

## 스마트폰에서 시작하기

새 기기에서는 **새로 시작하기 / 백업에서 복원하기**를 선택합니다. 예시 기록은 별도의 ‘예시 기록으로 둘러보기’로만 불러옵니다. 이미 저장된 기록이 있으면 시작 화면 없이 그대로 읽습니다.

홈은 오늘의 복습 → 레슨 전 브리핑 → 최근 기록 → 반복 피드백 순서입니다. 레슨 기록 화면에서는 레슨과 대회를 각각 작성할 수 있습니다. 작성 중인 내용은 초안으로 자동 저장되며, 창을 닫거나 다시 앱을 열면 ‘이어쓰기 / 삭제’를 선택할 수 있습니다. 초안은 하나씩 보관하며 기존 초안이 있을 때 다른 기록을 작성하면 먼저 확인합니다.

iPhone은 Safari의 **공유 → 홈 화면에 추가**, Android는 브라우저 메뉴의 **홈 화면에 추가 / 앱 설치**를 사용하세요. 앱 이름·아이콘·standalone manifest와 iOS 홈 화면 설정이 포함되어 있습니다. 서비스워커 캐싱은 추가하지 않았으며, 처음 앱을 열 때는 인터넷 연결이 필요합니다. [manifest 설명](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display)

## 저장·백업·복원

저장 키는 `src/repository.ts`의 `STORAGE_KEYS`에 모아 관리합니다. **기존 데이터 키 `kok-recall-v1`은 바꾸지 않았습니다.** 코드 배포·UI 변경·parser 업데이트 시 기존 데이터를 자동 초기화하거나 마이그레이션 쓰기로 변경하지 않습니다. 저장된 JSON을 읽지 못한 경우 원본을 유지하고 일반 저장을 막으며, 설정에서 원본 다운로드 또는 백업 복원을 제공합니다.

설정의 **전체 데이터 백업**은 `kokrecall-backup-YYYY-MM-DD.json` 파일을 만듭니다.

```json
{
  "app": "kokrecall",
  "version": 1,
  "exportedAt": "...",
  "data": {"version": 1, "lessons": [], "competitions": [], "...": "..."},
  "state": {"draft": null}
}
```

`data`에는 모든 레슨·대회·출처·분석 피드백·그룹·복습 카드·복습 기록·카테고리·최근 출처·사용자 설정이 포함됩니다. `state`에는 작성 중인 레슨 또는 대회 초안이 포함됩니다. 이 예시는 구조 설명용이며 실제 파일에는 전체 데이터가 들어갑니다.

복원은 **파일 선택 → 구조·참조 검증 → 기록 수 미리보기 → ‘현재 데이터가 백업 데이터로 교체됩니다’ 확인 → 복원하기** 순서입니다. 취소하거나 검증에 실패하면 현재 저장 데이터를 변경하지 않습니다. 이전 버전에서 내보낸 metadata 없는 콕리콜 JSON도 명시적인 이전 형식으로 인식해 미리보기 후 복원할 수 있습니다. 복원 직전 원본 데이터와 초안은 별도 안전 사본으로 남으며, 설정에서 내려받을 수 있습니다. 현재는 전체 교체만 지원하고, 검증/파일 해석/저장 함수를 분리해 향후 병합 정책을 추가할 수 있도록 구성했습니다.

브라우저의 데이터 삭제, 다른 브라우저 사용, 주소(origin) 변경, 기기 변경은 서로 다른 저장소를 사용합니다. **Mac의 localhost 기록은 GitHub Pages나 스마트폰으로 자동 이동하지 않습니다.** Mac에 남긴 기록을 옮기려면 Mac에서 백업을 내려받아 스마트폰의 배포 주소에서 복원하세요. 이후에는 스마트폰에서 기록과 백업을 관리합니다.

## GitHub Pages 배포

1. GitHub에 빈 저장소를 만듭니다. 이름은 `badminton-note` 또는 원하는 이름으로 정합니다. 코드만 포함되는 공개 저장소로 시작할 수 있습니다. 실제 사용 기록은 포함하지 않습니다.
2. 아래 파일들이 포함된 프로젝트를 `main` 브랜치에 올립니다. GitHub에서 안내하는 기존 프로젝트 push 명령을 사용하세요.
3. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정합니다.
4. `main` push 또는 Actions에서 수동 실행하면 설치 → 테스트 → 빌드 → 경로 검사 → Pages 배포가 진행됩니다. 배포 URL은 Actions의 `github-pages` 환경 또는 Settings → Pages에서 확인합니다.

`.github/workflows/deploy-pages.yml`은 `npm ci`와 `package-lock.json`으로 의존성을 고정하고, Pages가 제공하는 `base_path`를 Vite에 전달합니다. 저장소 이름을 코드에 고정하지 않으므로 저장소명 변경이나 사용자 사이트(`사용자명.github.io`)의 루트 배포도 지원합니다. 로컬 개발의 기본 경로는 `/`입니다. [Vite 공식 배포 가이드](https://vite.dev/guide/static-deploy#github-pages), [GitHub 공식 workflow 가이드](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

프로젝트 경로 배포를 로컬에서 검사하려면:

```sh
VITE_BASE_PATH=/badminton-note/ npm run build
PAGES_EXPECTED_BASE=/badminton-note/ npm run check:pages
```

GitHub는 코드와 정적 빌드만 보관합니다. 사용자 데이터는 브라우저 밖으로 자동 전송되지 않습니다. GitHub 주소나 사용자 브라우저를 변경하기 전에는 백업하세요. 저장소 공개 여부와 Pages 사용 가능 여부는 계정/조직의 Pages 설정에 따라 달라집니다.

## 개인 파일 제외

개인 TXT는 `imports/`, 기타 개인 자료는 `personal-data/`, 백업 JSON은 `backups/`에 두세요. 이 디렉터리와 앱이 내보낸 `kokrecall-backup-*.json`, `kokrecall-recovery-*.json`, 이전 `콕리콜-*.json` 파일은 `.gitignore`에서 제외합니다. 프로젝트 설정 JSON과 manifest는 유지합니다. 개인 TXT를 다른 이름으로 프로젝트 루트에 두기보다는 제외 디렉터리를 사용하세요. 테스트와 예시 데이터는 기능 검증용 샘플입니다.

## 혼합 TXT 가져오기

하나의 파일에서 클럽·더콕/아카데미·대회를 인식합니다. `===1회차===`, `===클럽 / 1회차===`, `===더콕 레슨 1회===`, `===더콕 4~5회차===`, `===아카데미 / 1회차===`, `===대회 / 강북구대회===` 등을 지원합니다. 인식 실패 블록과 구분자 앞 텍스트도 미분류 목록에 보존하며 직접 유형·출처·회차·대회명·날짜를 수정할 수 있습니다.

날짜는 `260508`, `2026-05-08`, `2026.05.08`, `2026/05/08`을 지원합니다. 여러 날짜가 있으면 첫 날짜를 대표 날짜로 쓰고 `lessonDates`에 모두 보관합니다. 회차 범위는 `displayLessonNumber`에 저장하며 `lessonNumber`는 시작 회차입니다. 하나의 합쳐진 원문은 하나의 기록으로 가져옵니다.

중복은 레슨의 경우 출처+회차(범위)+대표 날짜, 대회의 경우 대회명+날짜 기준으로 건너뜁니다. 원문은 구분자·제목·날짜까지 그대로 저장합니다. `Competition`은 `Database.competitions`에 별도로 저장하고, 개선 기록은 `Feedback.competitionId`로 연결합니다. 대회의 결과/잘한 것은 코칭 복습 정답으로 사용하지 않고, 못한 것·개선 목표만 반복 분석에 연결합니다.

## 분석과 복습

원문은 구조화 과정에서 바뀌지 않습니다. 규칙 기반 분석 결과는 저장 전에 수정할 수 있습니다. 키워드 그룹은 반복 피드백 상세에서 개별 이동/분리하거나 다른 그룹과 합칠 수 있습니다. 외부 AI 연동이나 인증은 포함하지 않습니다.

복습 정답은 저장된 피드백만 사용합니다. 빈칸과 직접 회상은 사용자가 정답을 확인한 뒤 평가합니다. 간격은 당일/1/3/7/14/30/60일이며 오답 시 두 단계 되돌립니다. 오늘 문제는 예정 카드를 우선하고 최신/오래된 기록을 보충합니다. 기록이 적으면 5문제보다 적을 수 있습니다. 출처별 회차는 독립적이며 총 레슨 수는 실제 저장된 기록 개수입니다.

## 주요 파일

- `src/domain.ts`: 모델·구조화·레슨/대회 저장·TXT 파서·그룹 통계·간격 복습.
- `src/repository.ts`: 저장 키·기존 데이터 보호·초안·백업 검증·복원·안전 사본.
- `src/BackupPanel.tsx`: 백업 다운로드·복원 미리보기·교체 확인.
- `src/CompetitionEditor.tsx`: 대회 작성·수정.
- `src/ImportPage.tsx`: 혼합 TXT 미리보기·수정·미분류·중복 표시.
- `src/main.tsx`: 기존 화면과 초안/복원/첫 시작 연결.
- `src/style.css`: 모바일/데스크톱 UI·안전 영역·입력/터치 크기.
- `public/manifest.webmanifest`, `public/icons/`: 기본 홈 화면 구성.
- `.github/workflows/deploy-pages.yml`: Pages 자동 배포.

단위 테스트는 기존 데이터 보호, 혼합 TXT, 날짜·회차 범위, 중복, 모든 데이터의 백업/복원, 초안, 잘못된 JSON/참조, 저장 공간 오류를 검증합니다. 실기기 점검 순서는 [모바일 점검 목록](docs/mobile-checklist.md)에 있습니다.
