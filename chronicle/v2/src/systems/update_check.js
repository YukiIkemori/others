// 新しい版のお知らせ（持ち主 2026-10-02）: 公開の版（deploy.sh が index.html に window.RPG_BUILD、public に version.json を書く）を
// 5 分ごと・タブに戻ったときに同じ所の version.json と比べ、違えば左下に小さく知らせる（勝手に読み直さない。30 分ごとにもう一度）。
// RPG_BUILD が無い（開発・テストの dist）ときは何もしない＝外へ通信しない。
(function (R) {
  'use strict';
  if (typeof window === 'undefined' || !window.RPG_BUILD || typeof fetch !== 'function') return;
  if (!/^https?:$/.test(location.protocol)) return;
  const MINE = String(window.RPG_BUILD);
  let newer = false, lastShown = -1e12;
  function notify() {
    const now = Date.now();
    if (now - lastShown < 30 * 60 * 1000) return;
    try { if (R.UIK && R.UIK.toast) { R.UIK.toast(R.T('sys.update.available'), { anchor: 'bl', icon: 'save', ms: 12000 }); lastShown = now; } } catch (e) { /* 出せないときは次の機会に */ }
  }
  function check() {
    if (newer) { notify(); return; }
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((v) => {
      if (v && v.build && String(v.build) !== MINE) { newer = true; notify(); }
    }).catch(() => { /* 通信できないときは黙る */ });
  }
  setInterval(check, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  R.UpdateCheck = { check, get newer() { return newer; } };
})(window.RPG);
