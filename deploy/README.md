# VPS 배포 (Caddy)

## 1. DNS
도메인 관리 페이지에서 레코드 추가:

| 타입 | 이름 | 값 |
|---|---|---|
| A | `haru` | VPS의 공인 IPv4 |
| AAAA (선택) | `haru` | VPS의 IPv6 |

`dig +short haru.pengueverything.cloud` 로 VPS IP가 나오면 OK.
방화벽에서 **80, 443 포트**가 열려 있어야 Caddy가 인증서를 받을 수 있습니다.

## 2. 파일 올리기 (서버에서)
```bash
sudo git clone -b ccr-a2c62b80-3ar5vk https://github.com/noob2220202/game1.git /var/www/haru
# private 레포면 deploy key 또는 토큰으로 clone
```
업데이트할 때 — **Caddy 설정을 먼저 바꾼 뒤** `git pull` 합니다(아래 3번의 `/work/*` 차단이 들어가기 전에 pull하면 설계·정답 문서가 잠깐 공개됩니다):
```bash
cd /var/www/haru && sudo git pull
```
(빌드 과정 없음 — 정적 파일 그대로 서비스. 1편 = `/`, 2편 = `/ep2/`)

## 3. Caddy
`deploy/Caddyfile` 내용을 `/etc/caddy/Caddyfile` 에 추가(또는 교체)한 뒤:
```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```
처음 접속 시 Caddy가 HTTPS 인증서를 자동 발급합니다 (몇 초~1분).

이 설정이 하는 일:
- `/.git` `/deploy/*` `/docs/*` `/tools/*` **`/work/*`** `/README.md` `/.gitignore` `/ep2/assets/img/meta.json` → 404 (정답·설계 문서 비공개)
- `/assets/*` · `/ep2/assets/*` → 1주 캐시, HTML·JS·CSS(`engine/`·`ep2/` 포함) → `no-cache`
- `Permissions-Policy`: 카메라·마이크·위치·블루투스·가속도·자이로·자기장·클립보드 읽기 전부 끔 (게임은 이 권한을 하나도 요청하지 않습니다)
- `/ep2/` 는 디렉터리 인덱스(`ep2/index.html`)로 열립니다. 루트 `404.html`은 그대로.

## 확인
- https://haru.pengueverything.cloud 접속 → 1편 타이틀 화면
- https://haru.pengueverything.cloud/ep2/ 접속 → 2편 타이틀 화면
- 카톡에 링크 보내서 미리보기 카드가 뜨는지 확인 (2편 OG 이미지 `ep2/assets/img/og_ep2.jpg`)
- 막혀야 하는 경로가 404인지 확인:
  - https://haru.pengueverything.cloud/.git/config
  - https://haru.pengueverything.cloud/work/ (작업 폴더 — 반드시 404)
  - https://haru.pengueverything.cloud/docs/DESIGN_EP2.md
- 응답 헤더 확인: `curl -sI https://haru.pengueverything.cloud/ep2/ | grep -i permissions-policy`
- 배포 주소에서는 `?debug=1` 이 무시됩니다(`*.pengueverything.cloud` 호스트 규칙). QA 도구는 로컬(`file://` 또는 localhost)에서만.

## 배포 전 체크리스트
- [ ] **Caddy `@hidden`에 `/work/*`가 들어 있는지** (2편 작업과 별개로 가장 먼저)
- [ ] `js/config.js` 에서 `MAKER_NAME`, `ENDING_LETTER` 를 직접 쓴 내용으로 바꾸기
- [ ] (선택) 2편용 `MAKER_CONTACT` · `MAKER_HANDLE` · `MAKER_AVATAR` · `LETTERS.ep2` — 비워 두어도 전 구간이 성립합니다
- [ ] 내 폰(가능하면 하루와 같은 기종)으로 1편·2편을 처음부터 한 번씩 플레이해 보기 — 이어폰 끼고
- [ ] 아이폰이라면 무음 스위치를 켠 상태에서도 소리가 나는지 확인
- [ ] 카톡으로 링크를 보내면 인앱 브라우저로 열려요 → 게임이 "다른 브라우저로 열기"를 안내합니다
- [ ] 1편 엔딩까지 가면 시리즈 기록(`haru-escape.series.v1`)이 남는지 — 1편 '처음부터'를 눌러도 지워지지 않아야 합니다
- [ ] 1편을 다시 처음부터 하려면: 게임 속 설정 앱 › 게임 설정 › 처음부터 다시 하기
- [ ] 2편을 다시 처음부터 하려면: 2편 타이틀 › `처음부터` (2편 진행만 지워지고 시리즈 기록은 남습니다)
