# 인수인계: 3편 「엄마의 번호」 — 다른 Claude 계정에서 이어가기

2026-11-28 기준. 시리즈 전체 배경은 `docs/HANDOFF.md`(오래됨), 3편 설계는 `docs/DESIGN_EP3.md`(약 850KB — 통째로 읽지 말고 `grep '^## '` / `grep '^### '`로 목차를 본 뒤 줄 범위로 읽는다), 구현 계약과 파일 소유는 `docs/ARCH_EP3.md`.

## 1. 한 줄 요약
3편은 **빌드가 끝났고(코드 · 이미지 47장 · 엄마 목소리 3줄), 문구 정리와 공개 잠금 해제까지 작업본에 들어갔지만 아직 커밋 전**이다. 남은 것은 QA 2회차, 드라이버 정리, 의뢰인 확인 3가지, 그리고 메인 합치기(푸시는 사용자 OK 뒤에만).

## 2. 워크트리 · 브랜치 지도
| 폴더 | 브랜치 | 역할 |
|---|---|---|
| `C:\Users\Admin\game1` | `ccr-a2c62b80-3ar5vk` | 메인 체크아웃. 1편(루트였다가 `/ep1.html`로 이동) · 2편 · 엔진 · 선택 화면. 의뢰인이 보는 곳 — 3편 작업 중에는 **읽기 전용으로 둔다**(상태를 바꾸는 git 금지). |
| `work/ep3wt` | `ep3` | 3편 빌드 · QA 작업본. 메인을 이미 한 번 합쳤다(a068d95). 지금 작업 트리에 **커밋 안 된 수정**이 있다(아래 3절). |
| `work/ep1r` | `ep1-retcon` | 1편 소급 복선 R1–R6(바이블 `docs/SERIES.md` §6 문구 그대로) 적용본. 1편 회귀 테스트 후 커밋만 해 둔 상태이며 **메인에는 합치지 않았다**. 라이브 1편을 바꾸는 일이라 의뢰인이 보고 OK한 뒤에만 합친다. 작업 트리에 미커밋 수정이 일부 있다(`docs/DESIGN.md`, `js/apps/haesol.js`, `js/data/browser.js`). |
| `work/appmode` | `app-mode` | 문구 정리 + 앱 스위치(`CONFIG.APP`) 작업본. **이미 메인에 합쳐졌다**(65d3403 · 77b1c8d). 새 일에는 쓰지 않는다. |
| `work/lead/scripts/` | — | 워크플로 스크립트(`ep3-make.js` · `ep3-qa.js` · `ep3-integrate-final.js` · `text-cleanup.js` · `sweep.json`). |

작업 산출물(스크린샷 · 로그)은 `work/ep3wt/work/qa/final/<라벨>/`(gitignore). 정답이 든 설계 문서가 `docs/`와 `work/`에 있으므로 배포에서는 Caddy가 404로 막는다(`deploy/Caddyfile`).

## 3. 끝난 것
- **3편 빌드**: 플랫폼 · 소리 · 셸 · 통신 · 미디어 · 방 · 흐름 일곱 영역 + 이미지 47장 + 엄마 TTS 3줄(`ep3/assets/audio`). 경로 `ep3/`(HTML `ep3/index.html`, 코드 `ep3/js/`, 설계 계약 `docs/ARCH_EP3.md`).
- **통합 2회차 리드 기록**: `DESIGN_EP3.md` §12.6.
- **공용 엔진**: 3편이 쓰는 새 시리즈 키(C-5)와 새 앱 모듈은 `engine/`에 있고 2편 회귀를 통과했다(`ep2_speedrun` 오류 0).
- **문구 정리(웹 + 앱 모두)** — 의뢰인 말: "저거뿐만아니라 쓸데없는 문구들. 다 없애야해. 저런거 ai특유의 주석같은거", "웹도같이 1편도 작업 해". 1편 · 2편은 메인에 커밋됨. 3편은 작업본에 반영, **미커밋**. 규칙과 최종 목록은 `docs/TEXT_CLEANUP.md`(§6, §6.1), 변경 기록은 `DESIGN_EP3.md` §12.7.
- **앱 스위치**: `ep3/js/config.ep3.js`의 `G.APP`(`CONFIG.APP === true` 또는 운영 호스트 밖 `?app=1`). `CONFIG.APP`이면 `G.DEBUG` 꺼짐, 화면 디버그 표시 없음. 상세 `docs/APP_RELEASE.md`.
- **공개 잠금 없음** — 의뢰인 말: "출시 그런거 없어 다 보이게". `engine/series.js` `RELEASES = { 2: 0, 3: 0 }`, 날짜 · 잠금 · `?preview=1` 없음.
- **주소 구조**: 루트 `/` = 에피소드 선택 화면, 1편 = `/ep1.html`, 부제(손글씨) `여기 있어` · `돌려줄게` · `엄마의 번호`. `deploy/`와 `docs/SERIES.md`에 반영.
- 작업본의 미커밋 수정 파일(이 문서 작성 시점): `engine/apps/phone.js`, `series/series.js`, `ep3/` 안 열두 파일(`css/ep3.css`, `index.html`, `js/config.ep3.js`, `js/data/cards.js`, `js/data/ending.js`, `js/data/objectives.js`, `js/e3.js`, `js/ending.js`, `js/gate.js`, `js/main.js`, `js/scenes.js`)과 `docs/` · `deploy/`. 먼저 `git status`와 `git diff`로 확인하고, 이상 없으면 **로컬 커밋**한다.

## 4. 남은 일
1. **드라이버를 새 문구에 맞춘다**(없앤 글자를 기다리던 것은 글자 대신 `data-qa`를 기다리게. `data-qa` 값은 바꾸지 않는다. 검사를 느슨하게 하거나 속이 빈 검사로 만들면 실패다):
   - `tools/qa/app_mode.js`: 3편 행(옛 `만든 사람 {MAKER} · {N}에게` 기대)과 '없어야 할 조각' 목록. 3편 `webKids` = 제목 하나, `appClass: false`, 점검 카드 = 도움말 한 줄.
   - `tools/qa/ep3_root_regress.js` 71–78줄 근처: `?preview=1`과 '타이틀 링크가 `?preview=1`을 유지' 기대를 '잠금 없음'으로.
   - `tools/qa/ep3_branches.js` · `ep3_speedrun.js`: 지운 크레딧 · 타이틀 문자열을 기다리는지 확인.
2. **3편 QA 두 번**: `work/lead/scripts/ep3-qa.js`(여덟 관점 결함 찾기 → 파일이 겹치지 않는 묶음으로 분류 → 묶음마다 수정 → 통합자가 재검증, 한 번에 한 라운드. 두 번 돌린다).
   - 인자(`args`): `repo`(작업본 절대 경로, 예 `C:\Users\Admin\game1\work\ep3wt`) · `nodePath`(`C:\Users\Admin\AppData\Roaming\npm\node_modules`) · `python`(`C:\Users\Admin\AppData\Local\Programs\Python\Python312\python.exe`) · `conc`(동시 에이전트 수, 기본 8 — 의뢰인이 정하는 값에 맞춘다, 아래 규칙) · `drivers`(드라이버 설명 문자열, 기본 `tools/qa/ep3_speedrun.js [--ep1=none|done] [--ep2=none|done] and tools/qa/ep3_branches.js`).
   - 3편 전체 스피드런은 에이전트당 최대 두 번. Chromium은 에이전트당 하나, 끝나면 브라우저 · 정적 서버 · 셸 루프를 모두 닫는다.
   - 2회차 뒤에 `ep3-integrate-final.js`(인자 `ep3` · `main` · `mainBranch` · `nodePath` · `python` · `dec3` — 파일 머리 참고)로 메인에 합친다.
3. **`soup` 힌트**: `soup`(미역국) 힌트 셋은 지워져 `hints: []`이고, 엔진 수첩 `shown()`이 빈 힌트 목표를 거르므로 빈 상자는 그려지지 않는다. (끝남)
4. **문서 잔여**: `series/series.js` 머리 주석 정리는 끝, `DESIGN_EP3.md`의 옛 서술은 §12.7의 `(12.7에서 삭제/변경)` 표시로 갈음했다. 새로 바뀌는 문구는 `docs/TEXT_CLEANUP.md` §7 체크리스트로 확인.
5. **앱 포장**: `docs/APP_RELEASE.md` '포장' 절(주석 · `beats.js` `note:` · `meta.json` `_qa` 빼기, 앱 빌드에서 `<noscript>` 제거).

## 5. 의뢰인에게 열려 있는 질문 (답이 오기 전에는 되돌리기 쉽게 둔다)
- **손글씨 글꼴 내려받기 괜찮은가**: 타이틀 부제와 도어 이미지 등에 Nanum Pen Script · Nanum Brush Script · Gamja Flower를 쓴다. 지금 `ep3/index.html`은 Google Fonts 링크로 불러온다. 배포 전에 `tools/get_fonts_ep3.sh` → `post_ep3.py`로 `c3_doorframe` 다시 굽기(DESIGN_EP3 §12.6-7, §10 J)도 같은 승인이 필요하다.
- **엄마 목소리 최종 승인**: TTS(coral · 50대 후반 여성 2줄 + 세아 속삭임, `v3_mom_call.wav` · `v3_mom_okay.wav` · `v3_sea_name.wav`)를 의뢰인이 직접 들어 보고 승인한다(§12.5-8). 바뀌면 `DESIGN_EP3.md` §7의 지시문만 고쳐 다시 만든다(비용 ≈ $0.01). OpenAI 키는 사용자 환경변수에 있고 **절대 출력하거나 파일에 쓰지 않는다**.
- **1편 소급 복선 R1–R6 승인**: 브랜치 `ep1-retcon`(`work/ep1r`)을 의뢰인이 보고 OK하면 메인에 합친다. 3편은 지금 라이브 1편(R1–R6 없는 상태)에서도 성립하도록 만들어져 있다(§12.5-3). OK 전에는 합치지 않는다.
- (참고) 스토어 설명의 AI 음성 표기, 한국 AI 기본법 투명성 의무 확인 — `docs/APP_RELEASE.md`.

## 6. 드라이버 · 명령 (PowerShell/Git Bash 공통, 작업본에서)
환경: Windows 11, Node 22 + 전역 Playwright, Python 3.12 전체 경로.
```
cd C:\Users\Admin\game1\work\ep3wt
$env:NODE_PATH = "C:\Users\Admin\AppData\Roaming\npm\node_modules"
$env:PYTHONUTF8 = "1"; $env:PYTHONIOENCODING = "utf-8"
node tools/qa/ep3_speedrun.js [--ep1=none|done] [--ep2=none|done|done0] [--series=S1..S13] [--headed]
node tools/qa/ep3_branches.js
node tools/qa/ep3_root_regress.js
node tools/qa/app_mode.js --ep=3        # 1/2/3 중 고른다 (표에 3편 행이 있다)
node tools/qa/app_mode_ep1.js
node tools/qa/ep1_regress.js [--clean=auto|yes|no]
node tools/qa/ep2_speedrun.js [--ep1=done]     # 약 8분
node tools/qa/ep2_branches.js
```
- 통과 = 종료 코드 0 + 콘솔 오류 0. 3편 디버그: `ep3/index.html?debug=1` → `window.haru`(운영 호스트에서는 무시됨). 앱 화면 미리보기: `?app=1`(운영 호스트 밖).
- **1편 · 2편 회귀는 BLOCKER**다. 공용 `engine/`을 건드렸으면 `ep2_speedrun`(처음부터 + `--ep1=done`) · `ep2_branches` · `ep1_regress`를 다시 돌린다.
- 로컬 서버가 필요하면 작업본 루트에서 정적 서버를 하나만 띄우고 끝나면 닫는다(`file://`은 AI 음성이 안 난다).

## 7. 규칙 (의뢰인 · 프로젝트)
- **로컬 커밋만. 푸시 · 원격 변경은 반드시 사용자 OK 뒤에.** 단계마다 로컬 커밋한다. 메인 체크아웃에서는 읽기만 하고, 3편 작업은 `work/ep3wt`에서만 한다.
- **동시 에이전트 최대 10**(의뢰인이 정한 값이 바뀔 수 있다 — 대화에서 마지막으로 말한 숫자가 우선). 에이전트당 Chromium 하나.
- **비밀 · 키는 출력도 기록도 하지 않는다**(OpenAI 키는 사용자 환경변수). 비용이 큰 일(약 $30 초과)은 먼저 묻는다.
- 의뢰인은 "다 알아서 해" 식으로 위임한다: 권장안을 받아 기록하고 진행하되, 푸시와 큰 비용은 묻는다.
- 게임 규칙: 센서 · 카메라 · 마이크 · 권한 요청 0, **자동 힌트 없음**(수첩의 3단 길게 누르기만), 1 · 2편 트릭 재사용 금지, `{N}`은 성중립, `data-qa` 값은 바꾸지 않는다, 극 밖 AI 주석식 문구 금지(`TEXT_CLEANUP.md`), 출시일 · 잠금 표시 금지.
- 보고는 한국어, 인용한 한국어 문구는 정확히.
