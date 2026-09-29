// PV の撮影でページに入れる小道具（window.PV）。ゲームのファイルは変えず、開いたページの中の関数を包む・差し替えるだけ。
//   PV.clean()            HUD・行き先の札・矢印を描かない（すっきりした画面）
//   PV.noEnc()            歩いて出る戦闘を出さない（テスト用メニューの札「TEST」を出さないため、切り替えではなくここで）
//   PV.state(name, flags) 状態のフィクスチャを当ててフラグを足す
//   PV.enter(map, spawn)  暗転なしでマップに入る → Promise
//   PV.btn({right:1, b:1}) 押しているボタンをまとめて決める（書かないボタンは離す）
//   PV.autoMsg(n)         会話が出そろってから n フレームで送る（0 で止める）
//   PV.pan(x0, y0, x1, y1, ms) カメラをマスの座標で動かす
//   PV.lastLine()         いちばん新しい会話の文（ログの最後）
module.exports = `(() => {
  const R = window.RPG;
  const BTNS = ['up', 'down', 'left', 'right', 'a', 'b', 'x', 'y', 'l', 'r', 'start'];
  const PV = (window.PV = {
    clean() {
      R.Field.hud.draw = () => {};
      R.Field._wayfindLabels = () => {};
      R.Field._wayfind = () => {};
      return true;
    },
    noEnc() { R.Mon.encounter = () => null; return true; },
    state(name, flags) {
      R.Dev.applyState(name);
      for (const id of Object.keys(R.DB.tips || {})) R.Game.flags['tip_' + id] = true;   // はじめての説明の札を出さない
      Object.assign(R.Game.flags, flags || {});
      return true;
    },
    enter(map, spawn) { R.Engine.clear(); return R.Field.enter(map, spawn, { fade: 0, noAutosave: true }); },
    btn(o) { o = o || {}; for (const b of BTNS) R.Input._set(b, !!o[b]); return true; },
    tapQ: [],
    tap(b, n) { R.Input._set(b, true); PV.tapQ.push({ b, left: n || 3 }); return true; },
    auto: 0, fullFor: 0, autoChoose: false,
    autoMsg(n) { PV.auto = n || 0; PV.fullFor = 0; return true; },
    pan(x0, y0, x1, y1, ms) { R.Field.camera.focus(x0, y0, { ms: 0 }); return R.Field.camera.focus(x1, y1, { ms }); },
    lastLine() { const L = R.UIK.Message.log(); return L.length ? L[L.length - 1].text : ''; },
  });
  R.Engine.addTick(() => {
    for (let i = PV.tapQ.length - 1; i >= 0; i--) { const q = PV.tapQ[i]; if (--q.left <= 0) { R.Input._set(q.b, false); PV.tapQ.splice(i, 1); } }
    if (PV.auto > 0) {
      const st = R.UIK.Message.state();
      if (st && st.full && (st.choiceRect == null || PV.autoChoose)) { if (++PV.fullFor >= PV.auto) { PV.fullFor = 0; PV.tap('a', 2); } } else PV.fullFor = 0;
    }
  });
  return true;
})()`;
