// CAST: 戦闘の味方の絵 hd:btl:<look>:<wtype>（V2_PLAN §2.5.7）。左向き、描く点は足元の中央。
//   原画（v2/assets/sprites/<look>/battle.png、A34・A35）があればそれ（cast/sprites.js）、無ければ仮の絵の骨組み（rig、はっきり「仮」）。
//   ポーズ: idle step slash thrust smash shoot cast item guard hit weak ko victory ＋ windup evade（15）。どの look もどの系統でも焼ける。
//   **焼くのは出撃中の 4 人の今の武器だけ**（§2.10）: 'battle:start' で R.Hd.pin、歩いている間に R.Hd.want で先に焼く。
//   R.Art.cast.battleKeys() → 今の 4 人のキー    R.Art.cast.wtypeOf(char)
(function (R) {
  'use strict';
  const Art = (R.Art = R.Art || {});
  const cast = (Art.cast = Art.cast || {});
  const WTYPES = ['sword', 'greatsword', 'dagger', 'bow', 'staff'];
  cast.WTYPES = WTYPES;
  cast.BTL_POSES = ['idle', 'step', 'slash', 'thrust', 'smash', 'shoot', 'cast', 'item', 'guard', 'hit', 'weak', 'ko', 'victory', 'windup', 'evade'];

  /** 1 コマずつ焼く仕事（K.bakeJob）。list = [() => コマ…]、finish(frames) → Sheet */
  cast.job = function (list, finish, kind) {
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const out = [];
    const job = {
      done: false, result: null, kind: kind || 'btl',
      step(ms) {
        const t0 = now();
        while (out.length < list.length) {
          out.push(list[out.length]());
          if (now() - t0 >= ms) break;
        }
        if (out.length >= list.length) { job.result = finish(out); job.done = true; }
        return job.done;
      },
    };
    return job;
  };

  // 骨組みの戦闘の高さ（原画の戦闘の高さ 64 に合わせる倍率。MODERN_UI §2.1 の「約 70」に近い）
  const BTL_SCALE = 1.2;
  cast.BTL_SCALE = BTL_SCALE;

  /** 仮の絵の戦闘のシート（焼く仕事） */
  function rigBattle(look, wtype) {
    const rig = R.Art.rig;
    const L0 = rig.fromLook(look);
    if (!L0) return null;
    const L = Object.assign({}, L0, { weapon: wtype });
    const RZ = R.Hd.RZ;
    const base = rig.WTYPE_IDLE[wtype] || {};
    const specs = [], poses = {}, memo = {};
    for (const pose of cast.BTL_POSES) {
      const list = rig.BATTLE[pose] || rig.BATTLE.idle;
      poses[pose] = list.map((sp) => {
        const k = JSON.stringify(sp) + (/^(idle|step|item|guard|weak|victory|evade)$/.test(pose) || /~idle|~ready/.test(sp[0]) ? '+b' : '');
        if (memo[k] != null) return memo[k];
        specs.push({ sp, useBase: k.endsWith('+b') });
        return (memo[k] = specs.length - 1);
      });
    }
    const sc = BTL_SCALE;
    let pts0 = null;
    const tasks = specs.map((s, i) => () => {
      const p = rig.frameSpec(s.sp, s.useBase ? base : null);
      const B = new RZ.Builder();
      const pt = rig.draw(B, L, p);
      const r = RZ.render(B, rig.renderOpts({ flip: true, scale: sc, light: rig.light('btl') }));
      const f = RZ.frame(r);
      const rel = (q) => [Math.round(-q[0] * sc), Math.round(q[1] * sc)];
      f.anchors = { head: rel(pt.head), hand: rel(pt.hand) };
      if (i === 0) pts0 = { pt, rel };
      return f;
    });
    return cast.job(tasks, (frames) => {
      const { pt, rel } = pts0;
      const anchors = { feet: [0, 0], head: rel(pt.head), hand: rel(pt.hand), center: [0, Math.round(rel(pt.neck)[1] * 0.55)] };
      anchors.fx = [anchors.hand[0] - 14, anchors.hand[1]];
      let w = 0, h = 0;
      for (const f of frames) { w = Math.max(w, f.c.width); h = Math.max(h, f.c.height); }
      return { frames, poses, fps: Object.assign({}, rig.BATTLE_FPS), anchors, w, h,
        meta: { look, wtype, facing: 'left', source: 'rig', placeholder: true, skin: L.skinHex, headR: Math.round(pt.headR * sc) } };
    }, 'btl');
  }
  cast._rigBattle = rigBattle;

  /** 見た目の型（人か動物か） */
  cast.isPerson = function (look) { const l = (R.DB.looks || {})[look]; return !!l && !l.animal; };

  // ---------------------------------------------------------------- 登録（データがそろった後で 1 回）
  R.onData(function () {
    if (!R.Hd || !R.Hd.def) return;
    for (const look of Object.keys(R.DB.looks || {})) {
      if (!cast.isPerson(look)) continue;
      for (const wt of WTYPES) {
        const key = `hd:btl:${look}:${wt}`;
        if (R.Hd.has(key)) continue;
        R.Hd.def(key, function () {
          const sp = cast.sprites.battle(look, wt);
          if (sp === null) return null;          // 原画を読んでいる間（後でまた）
          if (sp) return sp;
          return rigBattle(look, wt);
        }, { kind: 'btl', look, wtype: wt });
      }
    }
  });

  // ---------------------------------------------------------------- 出撃中の 4 人だけ焼いて固定する
  cast.wtypeOf = function (c) {
    const id = c && c.equip && (c.equip.weapon1 || c.equip.weapon);
    const it = id && R.DB.items && R.DB.items[id];
    return (it && it.wtype) || 'sword';
  };
  cast.battleKeys = function () {
    const G = R.Game;
    if (!G || !G.party) return [];
    return G.party.map((id) => G.chars && G.chars[id]).filter(Boolean).map((c) => `hd:btl:${c.look}:${cast.wtypeOf(c)}`).filter((k) => R.Hd.has(k));
  };
  let pinned = [];
  function repin() {
    const keys = cast.battleKeys();
    for (const k of pinned) if (!keys.includes(k) && R.Hd.unpin) R.Hd.unpin(k);
    for (const k of keys) if (R.Hd.pin) R.Hd.pin(k);
    pinned = keys;
    return keys;
  }
  cast.repin = repin;
  R.onBoot(function () {
    if (!R.on) return;
    // 歩いている間に列で（§2.10: 4 人の戦闘の絵 → 魔物 → 背景）
    R.on('map:enter', () => { for (const k of cast.battleKeys()) R.Hd.want(k, undefined, 2); });
    R.on('battle:start', () => { repin(); });
  });
})(window.RPG);
