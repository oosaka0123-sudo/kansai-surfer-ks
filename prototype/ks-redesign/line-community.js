(() => {
  // ===========================================================================
  // LINE リンク設定（差し替え用の単一箇所）
  // 確定したLINE公式URL（https://line.me/... や https://lin.ee/... 等）が
  // 決まったら、該当する `url` の値を文字列に置き換えるだけでバナーが有効化されます。
  // `url: null` のままの項目は「準備中」として無効表示（タップ不可）になります。
  // 架空のURLは入力しないでください。
  //
  // memberCount は参加人数表示の設定です。将来リアルタイム取得に切り替えやすいよう、
  // 表示モードごとに分離しています。
  //   - { mode: 'fixed', text: '...' }  … 固定文言をそのまま表示
  //   - { mode: 'api', endpoint: '...' } … server-side API から取得した人数を表示
  //     （ブラウザから直接LINE APIは呼ばない。失敗時は人数を捏造せず
  //      「人数取得中」「取得できませんでした」等にフォールバックする）
  // ===========================================================================
  const SPOT_MEMBER_COUNT = { mode: 'fixed', text: '10人以下' };
  const FRIENDS_MEMBER_COUNT = { mode: 'fixed', text: '10人以下' };

  const LINE_LINKS = {
    mainOpenChat: {
      title: '関西サーファー オープンチャット',
      desc: '波情報・雑談・お知らせが集まるメインコミュニティ',
      url: null,
      memberCount: { mode: 'fixed', text: '300人以上' }
    },
    spots: [
      { id: 'isonoura', name: '磯ノ浦', area: 'WAKAYAMA', url: null },
      { id: 'kokufunohama', name: '国府の浜', area: 'MIE', url: null },
      { id: 'ikumi', name: '生見', area: 'KOCHI', url: null },
      { id: 'komatsu', name: '小松海岸', area: 'TOKUSHIMA', url: null },
      { id: 'irago', name: '伊良湖', area: 'AICHI', url: null },
      { id: 'shizunami', name: '静波', area: 'SHIZUOKA', url: null },
      { id: 'hamazume', name: '浜詰', area: 'KYOTO', url: null },
      { id: 'takahama', name: '高浜', area: 'FUKUI', url: null },
      { id: 'hakuto', name: '白兎', area: 'TOTTORI', url: null }
    ],
    community: [
      { id: 'buddy', title: 'サーフィン仲間探し', desc: '一緒に入る仲間、初心者のサポートを探す', url: null, memberCount: FRIENDS_MEMBER_COUNT },
      { id: 'carpool', title: '相乗り', desc: '現地までの移動をシェアする', url: null, memberCount: FRIENDS_MEMBER_COUNT },
      { id: 'offlineMeetup', title: 'オフ会', desc: '現地開催のイベント・交流会の案内', url: null, memberCount: FRIENDS_MEMBER_COUNT },
      {
        id: 'groupChat',
        title: '普通のグループチャット',
        desc: '雑談中心の、ゆるい交流の場',
        url: null,
        // 固定人数は表示しない。LINE Messaging API (group members count) を
        // server-side 経由で取得する。トークン等の秘密値は api/config.secret.php
        // （gitignore対象、未コミット）に設定する。詳細は api/README.md 参照。
        memberCount: { mode: 'api', endpoint: 'api/line-group-count.php' }
      }
    ]
  };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  function buildMemberCountEl(memberCount) {
    if (!memberCount) return null;
    const el = document.createElement('span');
    el.className = 'line-banner-count';

    if (memberCount.mode === 'fixed') {
      el.textContent = `参加 ${memberCount.text}`;
      el.dataset.countState = 'fixed';
    } else if (memberCount.mode === 'api') {
      el.textContent = '参加 人数取得中…';
      el.dataset.countState = 'loading';
      fetchApiMemberCount(el, memberCount.endpoint);
    }
    return el;
  }

  function fetchApiMemberCount(el, endpoint) {
    fetch(endpoint, { cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`http ${res.status}`))))
      .then(data => {
        if (data && data.status === 'ok' && Number.isInteger(data.count)) {
          el.textContent = `参加 現在${data.count}人`;
          el.dataset.countState = 'ok';
        } else {
          el.textContent = '参加 取得できませんでした';
          el.dataset.countState = 'error';
        }
      })
      .catch(() => {
        el.textContent = '参加 取得できませんでした';
        el.dataset.countState = 'error';
      });
  }

  function buildBanner({ title, desc, url, memberCount }, extraClass) {
    const enabled = typeof url === 'string' && url.trim() !== '';
    const el = document.createElement(enabled ? 'a' : 'div');
    el.className = ['line-banner', extraClass, enabled ? '' : 'is-disabled'].filter(Boolean).join(' ');

    if (enabled) {
      el.href = url;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
    } else {
      el.setAttribute('role', 'link');
      el.setAttribute('aria-disabled', 'true');
      el.tabIndex = -1;
    }

    el.innerHTML = `
      <span class="line-banner-icon" aria-hidden="true">LINE</span>
      <span class="line-banner-body">
        <strong class="line-banner-title">${esc(title)}</strong>
        ${desc ? `<span class="line-banner-desc">${esc(desc)}</span>` : ''}
      </span>
      <span class="line-banner-status">${
        enabled
          ? '<span class="line-banner-arrow" aria-hidden="true">→</span>'
          : '<span class="line-banner-badge">準備中</span>'
      }</span>
    `;

    const countEl = buildMemberCountEl(memberCount);
    if (countEl) el.querySelector('.line-banner-body').appendChild(countEl);

    return el;
  }

  const mainSlot = document.querySelector('[data-main-cta-slot]');
  if (mainSlot) mainSlot.appendChild(buildBanner(LINE_LINKS.mainOpenChat, 'line-banner--main'));

  const spotSlot = document.querySelector('[data-spot-banner-slot]');
  if (spotSlot) {
    LINE_LINKS.spots.forEach(spot => {
      spotSlot.appendChild(buildBanner({ title: spot.name, desc: spot.area, url: spot.url, memberCount: SPOT_MEMBER_COUNT }, 'line-banner--spot'));
    });
  }

  const communitySlot = document.querySelector('[data-community-banner-slot]');
  if (communitySlot) {
    LINE_LINKS.community.forEach(item => {
      communitySlot.appendChild(buildBanner(item, 'line-banner--community'));
    });
  }
})();
