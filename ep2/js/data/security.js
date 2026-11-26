/* =========================================================
 * ep2 data — security module (DESIGN §3.3 · §3.4 · §4.6.3 · §4.6.4 · §4.6.6 · §4.6.7 · §5.4 · §9.6 ①)
 * owner: shell. Reader: shell (ep2/js/apps/security.js · engine/apps/settings.js · engine/apps/lock.js).
 *   G.STORY.security = { fingers, fingerDetail, smart, wifi, available, bt, lockScreen, verify, … }
 * Lazy lines (functions) are evaluated at render time — they read media's G.STORY.days through core's G.e2.fmt12
 * (single source for the hotspot's "마지막 연결" — §9.6 ② 자동 검산 ④).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  // today's first pause (= the hotspot's last connection) — media's G.STORY.days is the only source
  function hotspotLast() {
    const d = G.STORY.days && G.STORY.days['12-24'];
    const hm = (d && d.pause && d.pause[0]) || '05:39';
    if (G.e2 && G.e2.fmt12) return G.e2.fmt12(hm);
    const h = +hm.slice(0, 2), m = hm.slice(3, 5);
    return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${m}`;
  }

  G.STORY.security = {
    /* 설정 › 보안 및 개인정보 › 생체 인식 › 지문 (§3.4 · §4.6.3) — names/labels are not his lines (§4.11.1) */
    fingers: [
      { id: 'f1', name: '{N}', lastUsed: '2026.11.23' },                    // no 등록 row — {N}'s past is not invented
      { id: 'f2', name: '나', label: '지문 2 · 나 (2026.11.25)', added: '2026.11.25 오후 2:31', lastUsed: '오늘 오후 10:51', his: false },
    ],
    fingerText: {
      title: '지문', registered: '등록된 지문', add: '＋ 지문 추가', check: '등록된 지문 확인',
      label: (k, name) => `지문 ${k} · ${name}`,
      name: '이름', added: '등록', lastUsed: '마지막 사용', rename: '이름 변경', del: '삭제',
      enrollTitle: '지문 등록', none: '등록된 지문이 없습니다',       // '—' side (§4.6.12 · §5.2)
    },

    /* 설정 › 잠금 화면 › 스마트 잠금 (§3.3 · §4.6.4 · §5.4 S2) */
    smart: {
      places: [], onBody: false,
      devices: [{ id: '2층_스피커', line: '지정 2026.12.22 23:33 · 사용자: 나',
        detail: ['신뢰할 수 있는 기기', '연결되어 있는 동안', '잠금 해제 상태가 유지됩니다.'], at: '2026.12.22 23:33', who: '나' }],
      networks: [{ id: 'saemal_rooftop', line: '지정 2026.12.10 23:16 · 사용자: 나',
        detail: ['신뢰할 수 있는 네트워크', '이 네트워크에 연결되어 있으면', '잠금 해제 상태가 유지됩니다.'], at: '2026.12.10 23:16', who: '나' }],
    },
    smartText: {
      title: '스마트 잠금', places: '신뢰할 수 있는 장소', none: '없음', devices: '신뢰할 수 있는 기기',
      networks: '신뢰할 수 있는 네트워크', onBody: '몸에 지니고 있음 감지', off: '꺼짐', on: '켜짐',
      at: '지정', who: '사용자', del: '삭제',
    },

    /* 설정 › 잠금 화면 (§4.6.4 · §5.4 S1) */
    lockScreen: {
      title: '잠금 화면', type: '화면 잠금 유형', typeN: 'PIN · 지문', typeDash: 'PIN',
      smart: '스마트 잠금', smartSub: (k) => `신뢰할 수 있는 항목 ${k}개`,
      widget: '잠금화면 위젯', widgetText: '우리 집 ♥ since 2026.12.10', widgetEdit: '편집',
      notif: '알림 표시', notifMeta: '내용 표시',
    },

    /* 본인 확인 시트 (§5.3 · §5.4) — the system strings come from G.e2.STR */
    verify: { usePin: 'PIN 사용', cancel: '취소', pinTitle: 'PIN 입력', ok: '확인' },

    /* 설정 › 연결 › Wi-Fi › 저장된 네트워크 (§3.3 · §4.6.6) */
    wifi: [
      { id: 'saemal_rooftop', line: '연결됨 · 저장된 네트워크 · 추가 2026.12.10 · 다른 기기에서 동기화됨',
        smart: '스마트 잠금: 신뢰할 수 있는 네트워크', extra: ['보안  WPA2-개인', 'IP 주소  192.168.0.23'], pw: 'saemal0601' },
      { id: 'SM-G991N_0A3F',
        line: () => `모바일 핫스팟 · 자동 연결 · 마지막 연결 2026.12.24 ${hotspotLast()} · 추가 2026.11.25`,
        detail: ['모바일 핫스팟', '자동 연결  켜짐', () => `마지막 연결  2026.12.24 ${hotspotLast()}`, '추가  2026.11.25 오후 2:40'] },
      { id: 'Haesol_404', line: '범위 밖 · 추가 2026.11.23', detail: ['저장된 네트워크 · 범위 밖', '추가  2026.11.23'] },
    ],
    available: ['saemal_4F', 'Wi-Fi_7C21'],   // both 🔒 (§4.6.6)

    /* 설정 › 연결 › 블루투스 › 2층_스피커 ⚙ (§3.16 · §4.6.7 · §5.6) — no [등록 해제] (§0.2 T5 · D12) */
    bt: { id: '2층_스피커', kind: '스피커', added: '2026.12.22 오후 11:31', by: '나', last: '오늘 오후 10:41', vol: 15, call: false },
  };
})();
