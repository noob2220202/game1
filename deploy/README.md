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
sudo git clone -b <브랜치> https://github.com/noob2220202/game1.git /var/www/haru
# private 레포면 deploy key 또는 토큰으로 clone
```
업데이트할 때:
```bash
cd /var/www/haru && sudo git pull
```
(빌드 과정 없음 — 정적 파일 그대로 서비스)

## 3. Caddy
`deploy/Caddyfile` 내용을 `/etc/caddy/Caddyfile` 에 추가한 뒤:
```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```
처음 접속 시 Caddy가 HTTPS 인증서를 자동 발급합니다 (몇 초~1분).

## 확인
- https://haru.pengueverything.cloud 접속 → 타이틀 화면
- 카톡에 링크 보내서 미리보기 카드가 뜨는지 확인
- `.git` 같은 경로가 404로 막히는지 확인: https://haru.pengueverything.cloud/.git/config
