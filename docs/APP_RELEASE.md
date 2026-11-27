# 앱 출시 체크리스트

## 규칙 (의뢰인)

> "동그라미 친 저런거 추후에 어플 출시할때는 깔끔하게 없어야해. 알았지?"
> "저거뿐만아니라 쓸데없는 문구들. 다 없애야해. 저런거 ai특유의 주석같은거"
> "웹도같이 1편도 작업 해"

처음 말은 2편 엔딩 크레딧에서 동그라미 친 작은 글씨와, 화면 아래 초록 디버그 표시(`his 20/25 · tone … · tts …`)를 앱에서 빼라는 것이었다. 같은 날(2026-11-27) 범위가 넓어졌다: **쓸데없는 극 밖 문구 전부를, 웹과 앱 모두에서, 1편까지** 뺀다.

- 문구 정리는 이제 **웹과 앱이 같다**. 규칙(O1–O12), 편별 목록, 3편 목록은 **`docs/TEXT_CLEANUP.md`**에 있다.
- 이 문서에 남는 것: 앱 빌드에서만 다른 것(디버그 차단 등)과 포장 절차.

## 웹과 앱이 같아진 것 (2026-11-27)

- **크레딧**: 제목만 남고 장면 정중앙에 온다.
  - 1편은 `ecr-title`, 2편은 `{N를} 위한 방탈출! 2` / `돌려줄게`.
  - 대기 시간, 음악, 탭해서 넘기기는 그대로다.
  - 2편의 `.fl2-credits.app` 분기는 없어졌다. 이제 배치는 한 가지다.
- **2편 점검 카드**: `스토킹·디지털 성범죄 피해: 112 · 여성긴급전화 1366`과 [계속]만 남았다.
- **AI 음성 고지**: 편마다 극 밖 설정에 한 줄 `목소리는 AI 음성입니다.`를 둔다. 1편은 타이틀 설정의 `목소리` 줄, 2편은 ⏸의 `소리` 줄이다.
- 그 밖의 문구는 TEXT_CLEANUP.md에 있다.

## 스위치: `js/config.js`의 `APP` (앱에서만 다른 것)

| 값 | 뜻 |
|---|---|
| `APP: false` (기본) | 웹. |
| `APP: true` | 앱 빌드. 아래가 적용된다. |

**두 편이 같은 규칙을 쓴다**:
- `G.APP`는 `CONFIG.APP === true`일 때 켜진다. 운영 호스트(`*.pengueverything.cloud`) 밖에서 `?app=1`을 붙여도 켜진다(미리보기).
- `G.APP_BUILD = CONFIG.APP === true`이면 `G.DEBUG = false`다. `CONFIG.DEBUG`와 `?debug=1`은 무시된다.
- 1편은 `js/core/base.js`가, 2편은 `ep2/js/config.ep2.js`가 이 값을 만든다.

**2편** (`APP: true`)
- **디버그 완전 차단**:
  - `window.haru`(치트), 시리즈 `_fixture`, `skipTo`, `?jump=`, `?series=`가 없다.
  - `G.ending.debugM8`, `G.clock._scale`, `G.audio.meter`, `G.fx.roomLook`, `G.e2.budget`도 정의하지 않는다.
- **화면 디버그 표시 없음**(미리보기를 포함한 G.APP 전체): 초록 계측기, 빨간 오류 줄, 핫스팟 점선 테두리(`.rm2-debug`), `body.debug`.
- **인앱 브라우저 카드 없음**: 카드를 그리는 조건에 `!G.APP`가 있다.

**1편** (`APP: true`)
- `G.DEBUG = false`.
- `window.haru`(`flags` · `set` · `skip` · `reset`)와 `G.climax.debug`(`jump` · `hide` · `state`)를 정의하지 않는다.
- **화면 디버그 표시 없음**(G.APP): `body.debug`의 핫스팟 빨간 점선(`css/room.css:67`, `css/scenes.css:22`)이 나오지 않는다.
- **클라이맥스 안내**: `(PC: 마우스 또는 Space)`가 붙지 않는다(G.APP).
- 1편에는 원래 `?debug=1`이 없다. 웹에서는 `CONFIG.DEBUG`를 그대로 읽는다.
- **남는 콘솔 도우미**: 화면에 아무것도 그리지 않아 앱에서도 해가 없으므로 그대로 둔다.
  - `R.layerState`(`js/room/room.js`)
  - `R._session`(`js/apps/recorder.js`)
  - `G.vault.open()`(`js/apps/calculator.js`)
- **인앱 브라우저 카드 없음**: 2편처럼 카드를 그리는 조건에 `!G.APP`가 있다(`js/main.js` 75행). 웹에서는 KAKAOTALK·Instagram·FBAN/FBAV·Line·NAVER·DaumApps UA일 때 그대로 나온다.

**웹에만 있는 것** (앱에서는 안 보이거나 패키지에서 빠진다)
- `<noscript>` 줄
- 인앱 브라우저 카드
- `404.html`
- `q/404.html`: 문 스티커의 실제 QR이 여는 웹 페이지다. 게임 안의 QR 칩은 이 파일이 아니라 브라우저 앱 데이터를 쓴다.

## 편별 상태

| 편 | 상태 |
|---|---|
| 1편 | **완료(커밋 전).** 문구 정리와 `G.APP` 스위치가 들어갔다. `tools/qa/ep1_regress.js`와 `tools/qa/app_mode_ep1.js`가 통과했다(1편 담당 보고, 2026-11-27). |
| 2편 | **완료(커밋 전).** 문구 정리가 들어갔고, 디버그 차단은 77b1c8d에 있다. 확인할 드라이버: `tools/qa/app_mode.js --ep=2`(웹 run a도 이제 제목만), `ep2_branches.js`(G가 `credits.skip`을 기다린다), `ep2_speedrun.js`. |
| 3편 | **제작·QA 때 한다.** 할 일은 다음과 같다. |

3편 할 일:
- TEXT_CLEANUP.md의 3편 목록을 적용한다.
- 크레딧은 G.APP 분기 없이 제목만 남긴다.
- G.APP이면 화면 디버그 표시를 그리지 않는다. CONFIG.APP이면 G.DEBUG를 끈다.
- 인앱 카드 조건에 `!G.APP`를 더한다.
- `app_mode.js`의 `EPS`에 3편 항목을 더한다: `webKids` = 제목 하나, `appClass: false`, 점검 카드 = 도움말 한 줄.

## AI 음성 고지

- **정했다(2026-11-27).** 화면에는 편마다 극 밖 설정에 한 줄 `목소리는 AI 음성입니다.`만 둔다. 크레딧에서는 뺐다. OpenAI TTS 이용 정책(최종 사용자에게 그 목소리가 AI로 만든 것임을 명확히 알릴 것)은 이 줄로 지킨다.
- **출시 전에 의뢰인과 정할 것**:
  - 스토어 설명에도 같은 뜻을 적을지. 스토어 설명은 화면 밖이라 '화면엔 한 곳' 규칙과 부딪히지 않는다.
  - 사진의 AI 생성 표기가 크레딧에서 빠졌다. 한국 **AI 기본법**(인공지능 발전과 신뢰 기반 조성 등에 관한 기본법)의 투명성 의무(생성형 AI 사용 고지, 생성물 표시 등)가 출시 시점에 이 게임에 걸리는지 확인한다. 걸리면 스토어 설명 쪽에 적는다.

## 미리보기

- `index.html?app=1`(1편) · `ep2/index.html?app=1`(2편): 운영 호스트 **밖에서만** 켜진다(로컬 `file://`, 스테이징). 앱과 같은 화면이다.
- `ep2/index.html?app=1&debug=1`: 같은 화면에 QA용 점프(`haru.jump` 등)만 살아 있다. 화면 디버그 표시는 그래도 안 보인다. 1편에는 `?debug=1`이 없고, `js/config.js`의 `DEBUG: true`로 켠다.
- 운영 호스트에서는 `?app=1`을 무시한다(웹 그대로).

## 확인

```
NODE_PATH=<전역 node_modules> node tools/qa/app_mode.js [--ep=2] [--only=a,b,c] [--baseline=<원본 체크아웃>]
NODE_PATH=<전역 node_modules> node tools/qa/app_mode_ep1.js [--only=a,b,c] [--out=<스크린샷 폴더>]
NODE_PATH=<전역 node_modules> node tools/qa/ep1_regress.js [--clean=auto|yes|no] [--root=<사이트 폴더>]
```

**`app_mode.js` (2편)**
- **a 웹** `?debug=1`:
  - 크레딧은 제목 블록만이고 정중앙이며, 지운 줄이 하나도 없다.
  - 디버그 표시는 보인다(검사가 제대로 보는지 확인하는 용도).
  - `--baseline`의 크레딧 HTML 비교는 정리 전 체크아웃과는 일부러 다르다.
- **b 앱 미리보기** `?app=1&debug=1`:
  - 제목만 남고, 지운 네 줄이 `document.body.innerText` 어디에도 없다.
  - `.app` 클래스와 디버그 표시가 없다.
  - 360×740 · 390×844 · 430×932 화면, 글자 크기 1 · 1.3에서 모두 정중앙(±4 px)이다.
  - 탭하면 점검 카드로 가고, 카드는 도움말 한 줄이다.
- **c 실제 앱 빌드**(`js/config.js`를 `APP: true`로 바꿔 서빙):
  - `G.DEBUG`가 false이고 디버그 도우미가 없다.
  - 타이틀 → 경고 → 이어폰 테스트 → 오프닝 → 첫 시점 화면으로 이어진다.
  - `CONFIG.DEBUG: true`여도 `G.DEBUG`는 false다.
  - 저장을 이어하면 크레딧은 제목만이다.

**`app_mode_ep1.js` (1편)**
- **a1–a3 웹**: 도우미가 있고 PC 덧말이 붙는다. `DEBUG: true`이면 핫스팟 점선이 보인다. 크레딧은 제목만이고 정중앙이다.
- **b** `?app=1`: `body.debug`와 점선이 없다. `🔒 잠금 상태`가 보이고 PC 덧말은 없다.
- **c1–c3 앱 빌드**:
  - `G.DEBUG`가 false이고 `window.haru`와 `G.climax.debug`가 없다.
  - 설정에 `목소리` 줄과 AI 음성 한 줄이 있다.
  - 경고는 한 줄에 수첩 줄이 붙는다. 이어폰 테스트 안내는 한 줄이다.
  - 크레딧은 제목만이다.

**`ep1_regress.js`**: 1편을 처음부터 편지까지 하면서 정리 검사를 한다. 지운 문구가 한 번이라도 화면에 그려지면 실패다.

**모든 실행 공통**:
- 콘솔 오류 0.
- 스크린샷은 `work/qa/appmode/`에 저장된다.
- 통과 = 종료 코드 0.
- 회귀: `ep2_speedrun.js`, `ep2_speedrun.js --ep1=done`, `ep2_branches.js`.

## 포장 — 앱 dist 빌드 (주석 · QA 메모 빼기)

원본 소스는 그대로 둔다(TEXT_CLEANUP O12). 설계·QA 주석은 개발에 쓰고, 포장 단계가 빼고 지운다.
- 2026-11-27 측정으로 주석은 배포 코드 바이트의 약 10.6 %다(3편 작업본은 12.4 %).
- 대부분은 설계 § 참조, 담당 표시, LEAD·의뢰인 결정, QA 기록, 측정 로그다.
- 앱 패키지 안에서는 이 주석이 평문으로 그대로 읽힌다.

1. **허용 목록으로 복사**해 새 `work/dist/`를 만든다. 저장소를 통째로 복사하지 않는다.
   - 넣는 것: `index.html`, `manifest.webmanifest`, `js/`, `css/`, `assets/`, `engine/`, `ep2/`, `series/`, 그리고 공개 뒤에 `ep3/`.
   - 빼는 것:
     - `*/assets/img/meta.json`: QA 메모, AI 생성 메모, 퍼즐 정답이 들어 있다. 런타임은 인라인 `G.IMGMETA`를 쓰고 이 파일을 읽지 않는다.
     - `404.html`, `q/`, `README.md`, `docs/`, `tools/`, `deploy/`, `work/`, `.gitignore`, `.git`.
2. **JS는 파일마다 따로** terser를 돌린다:
   `minify(src, { compress: false, mangle: false, format: { comments: false, ascii_only: false }, sourceMap: false })`
   - 주석과 공백만 빠지고 이름은 그대로다. 그대로 남아야 하는 것: `window.G` · `window.CONFIG` · `window.E2` · `window.haru`, `G.*`, CONFIG 키, beat `owner`, 저장 키 `haru-escape.*`, 드라이버가 찾는 클래스, data-qa.
   - `ascii_only: false`로 둔다. 한글을 `\uXXXX`로 바꾸면 파일이 커지고 grep이 안 된다.
   - **하지 않는다**:
     - 묶기·합치기: 고정 순서로 읽는 일반 스크립트이고, 없는 선택 파일이 부팅을 막지 않는 구조라서.
     - 이름 줄이기(mangle · mangle-props · toplevel).
     - `drop_console`: 드라이버가 콘솔 오류로 실패를 잡기 때문.
     - compress.
     - 소스맵: 원본 주석을 다시 싣는다.
   - **예외는 `js/config.js`**: 주석 줄만 지우고 키는 한 줄에 하나(`  APP: false,`)로 둔다. `app_mode*.js`가 `^\s*APP:\s*false,` 줄을 찾아 뒤집고, 마지막 고정도 이 줄을 바꾸기 때문이다.
3. **CSS는 주석만** 지운다. csso나 lightningcss를 쓰되 구조 재배치와 선택자 병합은 끈다. 클래스 이름은 그대로다.
   **HTML은** `<script>`·`<style>` 밖의 `<!-- … -->`만 지운다(2편 `index.html`에 3곳, 3편은 더 있다).
4. **주석이 아니라서 남는 것**:
   - `ep2/js/data/beats.js`(3편도)의 `note:` 문자열: 읽는 코드가 없는 데이터다. dist 사본에서만 스크립트로 지우고 `node --check`로 확인한다. `owner`는 `engine/director.js`가 읽으므로 남긴다.
   - 콘솔 문자열 속 `§`·`QA`: 그대로 둔다. 플레이어에게는 안 보이고, 드라이버가 콘솔 호출에 기댄다.
   - DEBUG 전용 QA 데이터(`ep2/js/e2.js`의 FIXTURES · ANSWER_TABLE): 그대로 둔다. 앱에서는 G.DEBUG가 꺼져 닿지 않고, 지우면 QA를 거친 빌드와 달라진다.
5. **검증**: dist는 처음에 `APP: false` 그대로 둔다.
   1. `tools/qa/*.js`를 `work/dist/tools/qa/`로 복사한다. 드라이버의 ROOT는 스크립트에서 두 단계 위다. `ep1_regress.js`는 `--root=work/dist`로도 돌릴 수 있다.
   2. 여섯 드라이버가 모두 종료 코드 0이어야 한다: `ep2_speedrun.js`, `ep2_speedrun.js --ep1=done`, `ep2_branches.js`, `ep1_regress.js`, `app_mode.js --ep=2`, `app_mode_ep1.js`.
   3. **마지막 한 줄을 바꾼다**: `work/dist/js/config.js`의 `APP: false,` → `APP: true,`. `DEBUG: false`는 그대로다.
   4. **고정본 스모크**: 1편 · 2편 · `series/`를 부팅해 페이지 오류가 0인지 보고, 타이틀 → 경고 → 이어폰 테스트 → 오프닝까지 간다. `app_mode*.js`의 run c는 `KEY: false,`를 찾아 뒤집는 방식이라 고정본에는 쓸 수 없다. run c는 2단계에서 이미 돌았다.
   5. grep 게이트(6)를 통과하면 `work/dist/tools`와 `work/dist/work`를 지우고 포장한다.
6. **grep 게이트**: `work/dist/`에서 아래 패턴을 찾는다. **허용 목록(미리 검토한 줄) 밖의 줄이 하나라도 있으면 포장하지 않는다.**
   - 패턴: `§` · `owner:` · `LEAD` · `CLIENT` · `QA` · `DESIGN` · `ARCH` · `<!--` · `AI 음성` · `AI 생성` · `데이터도` · `단순화` · `made by` · `만든 사람 {MAKER}` · `플레이 {m}` · `플레이 ${` · `불이익` · `이 게임` · `방향이 있습니다` · `이어폰 권장` · beats.js의 `note:`
   - 허용 목록(이유가 있는 줄만):
     - `목소리는 AI 음성입니다.`: 1편 `js/main.js`, 2편 `ep2/js/scenes.js`, 3편 1곳.
     - `<noscript>`의 `이 게임은 JavaScript가 필요합니다.`: 앱 웹뷰에서는 안 보인다.
     - beat 데이터의 `owner:`.
     - 콘솔 문자열.
     - DEBUG 전용 QA 데이터.
7. **도구**: 아직 설치된 압축기가 없다. 2026-11-27에 확인한 결과, 전역 npm에 terser · esbuild · csso · lightningcss가 하나도 없고 저장소에도 `node_modules`가 없다.
   - 설치는 npm 다운로드라서 **의뢰인 OK가 필요하다**.
   - OK를 받으면 정확한 버전으로, 버릴 폴더 `work/build/`(gitignore됨)에 `npm i --no-save`로 받는다.
   - 의존성 없는 대안: 토크나이저 시제품 `C:\Users\Admin\game1\work\qa\sweep\comments\build_strip.js` + `measure_lib.js`(주석만 지움). 이 시제품으로 만든 빌드에서 `ep2_speedrun.js`가 오류 0으로 통과했다. 다만 실제 파서가 더 안전하다.

## 포장 때 앱에서만 고칠 것 (의뢰인 결정)

- **1편 공유**: `js/scenes.js`의 `share()`는 `location.origin`으로 링크를 만든다. 앱 웹뷰에서는 이것이 `https://localhost/…` 같은 앱 안 주소가 된다. 문구와 웹 주소는 바꾸지 않는다(O8). 앱에서는 링크를 웹 주소 `https://haru.pengueverything.cloud/`(또는 스토어 주소)로 고정한다.
- **1편 인터넷 기록 첫 줄(이스터에그)**: `location.host`를 보여 준다(`js/apps/browser.js` 134행). 앱에서는 `localhost`로 보이므로, 같은 방식으로 고정한다.

## 포장할 때

- [ ] dist 빌드: 허용 목록으로 복사, 주석 제거, `meta.json` 제외, beats `note:` 제거
- [ ] dist에서 드라이버 여섯 개 통과(`APP: false`)
- [ ] `js/config.js`: `APP: true`, `DEBUG: false` (dist에서만, 마지막 한 줄)
- [ ] 고정본 스모크 통과, grep 게이트 0
- [ ] 1편 공유 링크와 브라우저 호스트 고정(위)
- [ ] 스토어 설명의 AI 음성 문구 여부 결정, AI 기본법 투명성 의무 확인
- [ ] 압축기 설치 OK(의뢰인)
- [ ] 앱이 여는 주소에 `?debug=1` / `?preview=1`을 넣지 않는다. 둘 다 공개일 게이트를 우회한다. 앱 빌드에서 `G.DEBUG`는 꺼져 있어도 게이트는 열린다.
- [ ] 3편: TEXT_CLEANUP.md §6 적용, `app_mode.js`에 3편 항목 추가
