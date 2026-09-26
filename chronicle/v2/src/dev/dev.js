// 開発用の道具（CORE。dev.html だけに入る。index.html には入らない、§3.16 の 5）
//   R.Dev.info()        画面・場面・仮の実装の呼ばれた数の要約（shot.js --eval や playthrough が読む）
//   R.Dev.invariants()  全滅・イベントの後の不変条件（§2.5.3）: 一番上がフィールド・lock 0・イベントなし・暗転なし・会話の窓なし
//   R.Dev.press(btn, ms) 論理ボタンを押す（台本用。Engine.time で離す）
(function (R) {
  'use strict';
  const Dev = (R.Dev = R.Dev || {});
  Dev.info = function () {
    return {
      W: R.W, H: R.H, SCALE: R.SCALE, layout: R.layout, uiScale: R.uiScale, safe: R.safe,
      stack: R.Engine.stack.map((s) => s.id), time: Math.round(R.Engine.time), device: R.Input.lastDevice,
      pos: R.Game ? R.Game.pos : null, stubs: R.Stubs.report(), loadErrors: R.loadErrors.length,
    };
  };
  Dev.invariants = function () {
    const top = R.Engine.top();
    const locks = R.Field.locks ? R.Field.locks() : {};
    const r = {
      topIsField: !!top && top.id === 'field',
      unlocked: Object.keys(locks).length === 0,
      noEvent: !R.Events.busy(),
      noFade: R.Engine.fade.a < 0.01,
      inputOn: R.Input.enabled,
      noMessage: !R.UIK.Message.busy(),
    };
    r.ok = Object.values(r).every(Boolean);
    return r;
  };
  Dev.press = async function (btn, ms) {
    R.Input._set(btn, true);
    await R.wait(ms == null ? 50 : ms);
    R.Input._set(btn, false);
    await R.wait(34);
  };
})(window.RPG);
