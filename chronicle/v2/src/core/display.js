// Display（CORE）: ウィンドウ／全画面（PC 版。設定 display、F11・Alt+Enter は core/input.js が R.Display.toggle() を呼ぶ）
//
//   R.Display.isFull() → bool      今、全画面か
//   R.Display.toggle()             切り替えて設定にも残す
//   R.Display.apply()              設定 display に合わせる（R.Settings.set('display') の後に呼ばれる）
//   R.Display.init()               起動の時に 1 回（main.js）
// デスクトップ版は橋（window.chronicleDesktop.setFullscreen / isFullscreen / onFullscreen）でウィンドウそのものを全画面にする。
// ブラウザは Fullscreen API（押した直後でないと断られる。起動のときの「全画面」は最初のキー・ボタンの時に入る）。
// Esc などで外から全画面を抜けたら、設定もウィンドウに戻す（設定と画面が食い違わない）。
(function (R) {
  'use strict';
  let deskFull = false;
  function desk() {
    try { const b = window.chronicleDesktop; return b && typeof b.setFullscreen === 'function' ? b : null; } catch (e) { return null; }
  }
  function doc() { return typeof document !== 'undefined' && document.documentElement ? document : null; }

  const D = (R.Display = {
    isFull() {
      if (desk()) return deskFull;
      const d = doc();
      return !!(d && (d.fullscreenElement || d.webkitFullscreenElement));
    },
    toggle() {
      const want = !D.isFull();
      if (R.Settings.get('display') === (want ? 'fullscreen' : 'window')) D.apply();
      else R.Settings.set('display', want ? 'fullscreen' : 'window');
      return want;
    },
    apply() {
      const want = R.Settings.get('display') === 'fullscreen';
      if (want === D.isFull()) return Promise.resolve(true);
      const b = desk();
      if (b) {
        deskFull = want;
        return Promise.resolve(b.setFullscreen(want)).then(() => true).catch((e) => { R.warn('[display]', e); deskFull = !want; sync(); return false; });   // 大きさが変われば resize で R.fit
      }
      const d = doc();
      if (!d) return Promise.resolve(false);
      try {
        if (want) {
          const el = d.documentElement;
          const req = el.requestFullscreen || el.webkitRequestFullscreen;
          if (!req) return Promise.resolve(false);
          return Promise.resolve(req.call(el, { navigationUI: 'hide' })).then(() => true).catch(() => { sync(); return false; });   // 断られたら設定をウィンドウに戻す
        }
        const ex = d.exitFullscreen || d.webkitExitFullscreen;
        return ex ? Promise.resolve(ex.call(d)).then(() => true).catch(() => false) : Promise.resolve(false);
      } catch (e) { return Promise.resolve(false); }
    },
    init() {
      const b = desk();
      if (b) {
        if (typeof b.onFullscreen === 'function') b.onFullscreen((v) => { deskFull = !!v; sync(); R.fit && R.fit(); });
        Promise.resolve(typeof b.isFullscreen === 'function' ? b.isFullscreen() : false).then((v) => { deskFull = !!v; D.apply(); }).catch(() => D.apply());
        return;
      }
      const d = doc();
      if (!d || !d.addEventListener) return;
      const on = () => { sync(); if (R.fit) R.fit(); };
      d.addEventListener('fullscreenchange', on);
      d.addEventListener('webkitfullscreenchange', on);
      // 前に全画面にしていたら、最初の押下（ブラウザが許す時）で入る
      if (R.Settings.get('display') === 'fullscreen' && R.Input && R.Input.onAnyPress) R.Input.onAnyPress(() => { D.apply(); });
    },
  });
  /** 外から変わった全画面を設定に写す（apply は呼ばない） */
  function sync() {
    const v = D.isFull() ? 'fullscreen' : 'window';
    if (R.Settings.get('display') !== v) R.Settings.set('display', v);
  }
})(window.RPG);
