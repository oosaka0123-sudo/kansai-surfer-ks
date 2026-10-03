// ===========================================================
// LINE COMMUNITY ページ — リンク設定 + バナー描画
//
// 差し替え方法:
//   下の LINE_LINKS オブジェクト内、対象項目の `url` を
//   実URLの文字列に置き換えるだけで、該当バナーが自動的に
//   有効化されます（「準備中」表示が外れます）。
//   架空のURLは入れないこと。未確定のままなら null を維持する。
//
//   「普通のグループチャット」だけは固定人数を表示せず、
//   api/line-group-count.php 経由で LINE Messaging API の
//   実参加人数を取得する。API未設定/失敗時は数値を捏造せず
//   「取得できませんでした」を表示する。
// ===========================================================
(function () {
  'use strict';

  const LINE_LINKS = {
    main: {
      title: '関西サーファー オープンチャット',
      desc: '波情報の共有はもちろん、現地での交流・仲間探しまで。関西サーファーのメインLINEオープンチャット。',
      // 既存の本番 index.html で使われている「NAMI OSAKA コミュニティ」導線
      // （line-banner / floating-line / wave-report-join）と同一URLを再利用。
      // ブランド表記が異なるため、このページの「関西サーファー オープンチャット」と
      // 同一のチャットかどうか、マージ前にオーナー確認をお願いします。
      url: 'https://line.me/ti/g2/gJhhK1rx3DXRkf8XpIaUqSacY9ePlJKI3tH53A?utm_source=invitation&utm_medium=link_copy&utm_campaign=default',
      count: { mode: 'fixed', label: '300人以上' },
    },
    spots: [
      {
        key: 'isonoura',
        name: '磯ノ浦',
        // 既存の本番 isonoura.html の floating-line
        // （「磯ノ浦専用 / LINEコミュニティ」）と同一URLを再利用。
        url: 'https://line.me/ti/g2/6bEYnoBF1k3E0u33QCkDiPfTpR9v_LmQSZ82Yw?utm_source=invitation&utm_medium=link_copy&utm_campaign=default',
        count: { mode: 'fixed', label: '10人以下' },
      },
      { key: 'kounohama', name: '国府の浜', url: null, count: { mode: 'fixed', label: '10人以下' } },
      { key: 'ikumi', name: '生見', url: null, count: { mode: 'fixed', label: '10人以下' } },
      { key: 'komatsu', name: '小松海岸', url: null, count: { mode: 'fixed', label: '10人以下' } },
      { key: 'irago', name: '伊良湖', url: null, count: { mode: 'fixed', label: '10人以下' } },
      { key: 'shizunami', name: '静波', url: null, count: { mode: 'fixed', label: '10人以下' } },
      { key: 'hamadutu', name: '浜詰', url: null, count: { mode: 'fixed', label: '10人以下' } },
      { key: 'takahama', name: '高浜', url: null, count: { mode: 'fixed', label: '10人以下' } },
      { key: 'hakuto', name: '白兎', url: null, count: { mode: 'fixed', label: '10人以下' } },
    ],
    community: [
      { key: 'buddy', name: 'サーフィン仲間探し', desc: '一緒にサーフィンする仲間を探す', url: null, count: { mode: 'fixed', label: '10人以下' } },
      { key: 'carpool', name: '相乗り', desc: '遠征・移動の相乗り募集', url: null, count: { mode: 'fixed', label: '10人以下' } },
      { key: 'meetup', name: 'オフ会', desc: '現地オフ会・交流イベント', url: null, count: { mode: 'fixed', label: '10人以下' } },
      {
        key: 'groupchat',
        name: '普通のグループチャット',
        desc: '雑談用の気軽なグループチャット（参加人数はリアルタイム取得）',
        url: null,
        count: { mode: 'api', endpoint: 'api/line-group-count.php' },
      },
    ],
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  }

  function countBadgeHtml(item, countId) {
    if (item.count.mode === 'api') {
      return `<span class="lc-badge lc-badge-count" id="${countId}">人数取得中…</span>`;
    }
    return `<span class="lc-badge lc-badge-count">参加 ${esc(item.count.label)}</span>`;
  }

  function renderMainCta(item) {
    const el = document.getElementById('lcMainCta');
    if (!el) return;
    const disabled = !item.url;
    const badge = countBadgeHtml(item, 'lcMainCount');
    if (disabled) {
      el.innerHTML = `
        <div class="line-banner is-disabled" aria-disabled="true">
          <div class="content">
            <div>
              <h2><i class="fa-brands fa-line"></i>${esc(item.title)}</h2>
              <p class="lead">${esc(item.desc)}</p>
              <div class="lc-main-note">${badge} <span class="lc-badge lc-badge-pending">準備中</span></div>
            </div>
            <span class="join-btn is-disabled"><i class="fa-brands fa-line"></i> 準備中</span>
          </div>
        </div>`;
      return;
    }
    el.innerHTML = `
      <div class="line-banner">
        <div class="content">
          <div>
            <h2><i class="fa-brands fa-line"></i>${esc(item.title)}</h2>
            <p class="lead">${esc(item.desc)}</p>
            <div class="lc-main-note">${badge}</div>
          </div>
          <a href="${esc(item.url)}" target="_blank" rel="noopener" class="join-btn">
            <i class="fa-brands fa-line"></i> オープンチャットに参加
          </a>
        </div>
      </div>`;
  }

  function renderBanner(item, title, desc) {
    const disabled = !item.url;
    const countId = item.count.mode === 'api' ? `lc-count-${item.key}` : '';
    const badge = countBadgeHtml(item, countId);
    const statusBadge = disabled ? '<span class="lc-badge lc-badge-pending">準備中</span>' : '';
    const inner = `
      <span class="lc-icon"><i class="fa-brands fa-line"></i></span>
      <span class="lc-body">
        <span class="lc-title">${esc(title)}</span>
        <span class="lc-desc">${esc(desc)}</span>
        <span class="lc-badges">${badge}${statusBadge}</span>
      </span>
      <span class="lc-arrow" aria-hidden="true">→</span>`;
    if (disabled) {
      return `<span class="lc-banner is-disabled" aria-disabled="true" role="link" aria-label="${esc(title)}（準備中）">${inner}</span>`;
    }
    return `<a class="lc-banner" href="${esc(item.url)}" target="_blank" rel="noopener">${inner}</a>`;
  }

  function renderSpots() {
    const el = document.getElementById('lcSpotGrid');
    if (!el) return;
    el.innerHTML = LINE_LINKS.spots
      .map((spot) => renderBanner(spot, `${spot.name} オープンチャット`, `${spot.name}エリアの波情報・現地交流`))
      .join('');
  }

  function renderCommunity() {
    const el = document.getElementById('lcCommunityGrid');
    if (!el) return;
    el.innerHTML = LINE_LINKS.community.map((c) => renderBanner(c, c.name, c.desc)).join('');
  }

  function fetchGroupChatCount(item) {
    const el = document.getElementById(`lc-count-${item.key}`);
    if (!el || !item.count.endpoint) return;
    fetch(item.count.endpoint, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.status === 'ok' && Number.isFinite(data.count)) {
          el.textContent = `参加 ${data.count}人`;
        } else {
          el.textContent = '取得できませんでした';
        }
      })
      .catch(() => {
        el.textContent = '取得できませんでした';
      });
  }

  renderMainCta(LINE_LINKS.main);
  renderSpots();
  renderCommunity();
  LINE_LINKS.community.filter((c) => c.count.mode === 'api').forEach(fetchGroupChatCount);

  window.LINE_LINKS = LINE_LINKS;
})();
