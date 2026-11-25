# 인수인계: 2편 + 시리즈 작업을 PC에서 이어가기

## 지금 상태
- **1편**: 완성 및 배포 가능 (레포 루트). 전체 플레이 QA 통과, 하드모드(자동 힌트 없음) 적용됨.
- **2편 + 시리즈 바이블**: 브리프만 있음 → `docs/EP2_BRIEF.md`.
  클라우드에서 돌리던 설계 워크플로우 2개(2편 설계 / 시리즈 바이블)는 **아이디어 단계에서 중단**했어요. 결과물 없음 → PC에서 처음부터 다시 돌리면 됩니다.
- 엔진 준비: 세이브 키(`CONFIG.SAVE_KEY`)와 음성 경로(`G.AUDIO_BASE`)를 에피소드별로 바꿀 수 있게 해둠.

## PC 준비 (한 번만)
```bash
git clone https://github.com/noob2220202/game1.git
cd game1
git checkout ccr-a2c62b80-3ar5vk

# 에셋 도구용
pip install pillow numpy scipy qrcode
./tools/get_fonts.sh                     # 한글 합성용 폰트 → work/fonts/

# 테스트용 (Playwright + Chromium)
npm install -g playwright
npx playwright install chromium

# OpenAI (이미지·음성 생성)
export OPENAI_API_KEY=sk-...             # Windows PowerShell: $env:OPENAI_API_KEY="sk-..."
```
로컬 실행: `python3 -m http.server 8765` → http://localhost:8765 (`file://`로 열면 AI 음성이 안 나와요)

> 1편 생성 원본(PNG)은 레포에 없어요. 일관성 있는 편집(edit)에 참조 이미지가 필요하면 `assets/img/*.jpg`를 쓰면 됩니다.

## 진행 순서 (1편과 같은 방식)
1. **시리즈 바이블** → `docs/SERIES.md`
   - 그 남자의 정체, 세아의 행방, 큰 미스터리 정답, 최소 3시즌·24편 라인업
   - 복선 장부 (심는 편 → 회수하는 편), 1편 소급 복선 최대 6개, 편 간 세이브 규약(`haru-escape.series.v1`), 트릭 배정표
2. **2편 설계** → `docs/DESIGN_EP2.md`
   - 5개 관점 아이디어 → 심사 3명 → 합성. 바이블의 복선을 반영
3. **구조 개편**: 공용 엔진 `/engine` + 에피소드 콘텐츠 `/ep2/` + 루트 에피소드 선택. 1편은 현재 루트 그대로 유지(안정성).
4. **에셋**: gpt-image 이미지 ~40장 + TTS. 도구는 `tools/`
5. **구현**: 영역별 병렬 에이전트 (`docs/ARCH.md` 형식의 모듈 소유권·API 계약 먼저 작성)
6. **전체 플레이 QA** + 하드모드 점검(자동 힌트 금지) + 1편 소급 복선 적용
7. 커밋·푸시 → 서버에서 `git pull`

## 꼭 지킬 규칙 (클라이언트 결정)
- 카메라·마이크·모션 센서·권한 요청 **전부 금지**. 앱 안에서만 되는 트릭만.
- **자동 힌트 금지**: 자동 메모, 튜토리얼 자막, "~해 보자" 토스트, 오답 메시지에 힌트 넣기 전부 안 됨. 수첩의 "꾹 눌러 보는 힌트"만 허용.
- 어렵지만 공정하게: 모든 정답은 게임 속 증거로 도출 가능해야 함.
- 1편 트릭 재사용 금지 (목록: `docs/EP2_BRIEF.md`).
- 플레이어 이름 `CONFIG.PLAYER_NAME`, 만든 사람 `CONFIG.MAKER_NAME` (2편에서 캐릭터로 등장 가능).

## PC의 Claude Code에 붙여넣을 시작 프롬프트
```
이 레포는 모바일 웹 공포 방탈출 시리즈 "하루를 위한 방탈출!"이야. 1편은 완성돼 있어(루트).
docs/HANDOFF.md, docs/EP2_BRIEF.md, docs/DESIGN.md, docs/ARCH.md를 먼저 읽어.
ultracode로 진행해줘. 1단계: 시리즈 바이블(docs/SERIES.md)을 쇼러너 여러 관점 → 심사 → 합성 워크플로우로 만들고,
2단계: 2편 설계(docs/DESIGN_EP2.md)를 5개 관점 아이디어 → 심사 3명 → 합성으로 만들어(바이블 복선 반영).
두 문서가 나오면 요약해서 보여주고 내 OK를 받은 다음에 에셋·구현으로 넘어가.
규칙: 센서/카메라/마이크 금지, 자동 힌트 금지(하드모드), 1편 트릭 재사용 금지, 커밋은 단계마다.
```
