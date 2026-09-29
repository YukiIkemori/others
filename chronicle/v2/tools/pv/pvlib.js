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
      PV.cleanMsg();
      if (R.Save) R.Save.autosave = () => {};   // 「オートセーブ」の札を出さない（PV の撮影ではセーブしない）
      return true;
    },
    /** 会話の窓の上の手引き（ログ・自動送り・早送り・文字の速さ）を描かない */
    cleanMsg() {
      const U = R.UIK;
      if (U.__pvClean) return true;
      U.__pvClean = true;
      const pr = U.prompts, ch = U.chip;
      U.prompts = function (g, list, o) { if (Array.isArray(list) && list.some((b) => b && b.label === 'ログ')) return; return pr.apply(this, arguments); };
      U.chip = function (g, x, y, label) { if (typeof label === 'string' && (label.startsWith('文字の速さ') || label.startsWith('自動送り'))) return; return ch.apply(this, arguments); };
      return true;
    },
    noEnc() { R.Mon.encounter = () => null; return true; },
    state(name, flags) {
      R.Dev.applyState(name);
      for (const id of Object.keys(R.DB.tips || {})) R.Game.flags['tip_' + id] = true;   // はじめての説明の札を出さない
      Object.assign(R.Game.flags, flags || {});
      return true;
    },
    /** 状態のフィクスチャの場所に入る（spawn を渡せばそこへ） */
    fixture(name, flags, spawn) { PV.state(name, flags); const fx = window.RPG_FIXTURES.states[name]; return PV.enter(fx.map.id, spawn || fx.map.spawn); },
    enter(map, spawn) { R.Engine.clear(); return R.Field.enter(map, spawn, { fade: 0, noAutosave: true }); },
    btn(o) { o = o || {}; for (const b of BTNS) R.Input._set(b, !!o[b]); return true; },
    tapQ: [],
    tap(b, n) { R.Input._set(b, true); PV.tapQ.push({ b, left: n || 3 }); return true; },
    auto: 0, fullFor: 0, autoChoose: false,
    autoMsg(n) { PV.auto = n || 0; PV.fullFor = 0; return true; },
    pan(x0, y0, x1, y1, ms) { R.Field.camera.focus(x0, y0, { ms: 0 }); return R.Field.camera.focus(x1, y1, { ms }); },
    /** 戦闘の指示を台本にする: PV.plan(st, u, round) → {cmd, id, target}（null なら攻撃）。パーティのメニューは「戦う」 */
    round: 0, plan: null,
    scriptBattle(plan) {
      const C = R.Battle._.cmd;
      PV.plan = plan; PV.round = 0;
      C.partyMenu = async () => { PV.round++; return 'fight'; };
      C.member = async (st, u) => {
        PV.st = st;
        const t = st.aliveEnemies()[0];
        const c = (PV.plan && PV.plan(st, u, PV.round)) || { cmd: 'attack', id: 'attack' };
        if (c.target == null) c.target = c.self ? u.uid : t ? t.uid : null;
        return c;
      };
      return true;
    },
    /** 敵に入るダメージを n 倍にする（戦闘を台本の長さで終わらせる用。テスト用メニューの差し込み口を使うが、切り替えは入れないので「TEST」の札は出ない） */
    dmgMul: 1,
    boost(n) {
      const Tt = R.Tester;
      if (!Tt) return false;
      Tt.enabled = true;
      Tt.hitFix = (tgt, r) => r;
      Tt.dmgFix = (tgt, dmg) => (tgt && !tgt.isParty && PV.dmgMul !== 1 ? Math.round(dmg * PV.dmgMul) : dmg);
      PV.dmgMul = n;
      return true;
    },
    /** 仲間に技・術を足す（台本用） */
    teach(id, techs, spells) { const c = R.Game.chars[id]; if (techs) c.techs = Array.from(new Set((c.techs || []).concat(techs))); if (spells) c.spells = Array.from(new Set((c.spells || []).concat(spells))); return true; },
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
