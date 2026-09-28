// FIELD — 隊列のなぞり（V2_PLAN §2.5.9、E8）。先頭の歩いたマスを後ろの人が 1 歩遅れでなぞる（高さ lv も）。
// オーナーの決まり（2026-09-27）: フィールドに出るのは主人公だけ。仲間（R.Game.party の 2 人目以降）は 4 人の一行でも並ばない。
//   設定 fieldParty（既定 false）を true にしたときだけ昔どおり仲間が並ぶ（R.Field.partyTrail()）。
//   イベントで仲間が話す・動くときは npc.js の R.Field.partyShow / partyHide（ev.partyShow）で主人公の横に出す。
// ついてくる人（R.Field.setGuest、ピム・ザイード・ラクダ…。仲間ではない）は今も後ろにつく（by:'guest' の仕掛けに要る）。戦闘には出ない。
//   S.fol = [{id, look, x, y, lv, dir, fx, fy, moving}]（先頭を除く。最後が guest。既定では guest だけか空）
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const S = (F._s = F._s || {});

  /** 仲間を後ろに並べるか（設定 fieldParty。既定は主人公だけ） */
  F.partyTrail = function () { try { return !!(R.Settings && R.Settings.get('fieldParty')); } catch (e) { return false; } };
  /** フィールドで先頭に立つ人の id。隊列の順に関係なく主人公（持ち主 2026-09-27「どんな隊列でも主人公」）。主人公がいなければ隊列の先頭 */
  F.leadId = function () {
    const G = R.Game;
    if (!G) return null;
    const h = G.hero || 'hero';
    if (G.chars && G.chars[h]) return h;
    return G.party && G.party[0];
  };
  /** 並べる仲間の id（先頭の主人公を除く）。既定では空 */
  function members() {
    const G = R.Game, lead = F.leadId();
    return F.partyTrail() && G && G.party ? G.party.filter((id) => id !== lead && G.chars && G.chars[id]) : [];
  }
  function wanted() {
    const G = R.Game;
    const out = [];
    for (const id of members()) { const c = G.chars[id]; out.push({ id: c.id, look: c.look }); }
    if (S.guest) out.push({ id: S.guest.id, look: S.guest.look, guest: true });
    return out;
  }
  /** 隊列を組み直す。keep なら今の位置を残す（人の入れ替え・ついてくる人） */
  F._resetTrail = function (keep) {
    const want = wanted();
    const old = S.fol || [];
    // 入ったとき: 先頭の後ろ（向きの反対）へ 1 マスずつ並べる。通れなければ前の人と同じマス
    const back = { s: [0, -1], n: [0, 1], e: [-1, 0], w: [1, 0] }[S.dir] || [0, -1];
    let px = S.x, py = S.y;
    S.fol = want.map((w, i) => {
      const o = keep ? old[i] || old[old.length - 1] : null;
      let b = o;
      if (!b) {
        const nx = px + back[0], ny = py + back[1];
        if (S.map && F._walkable(S.map, nx, ny, null, S.lv) && !F._npcAt(nx, ny, S.lv)) { px = nx; py = ny; }
        b = { x: px, y: py, lv: S.lv, dir: S.dir };
      }
      return { id: w.id, look: w.look, guest: !!w.guest, x: b.x, y: b.y, lv: b.lv || 0, dir: b.dir || S.dir, fx: b.x, fy: b.y, moving: false };
    });
    S.folSig = sig();
  };
  function sig() {
    let s = S.guest ? S.guest.look : '';
    for (const id of members()) s += '|' + id;
    return s;
  }
  /** 並ぶ顔ぶれが変わったか（入れ替え・加入・ついてくる人・設定 fieldParty）を安く調べる */
  F._trailCheck = function () {
    if (S.folSig !== sig()) F._resetTrail(true);
  };

  /** 先頭が動く前に呼ぶ: 先頭の今の位置を 1 人目へ、1 人目を 2 人目へ… */
  F._trailPush = function (x, y, lv, dir) {
    const f = S.fol || [];
    const z = f[f.length - 1];
    S.trailTail = z ? { x: z.x, y: z.y, lv: z.lv, dir: z.dir } : null;   // 1 歩下がる（_trailBack）ときの最後の人の戻り先
    for (let i = f.length - 1; i >= 0; i--) {
      const a = f[i];
      a.fx = a.x; a.fy = a.y;
      const b = i === 0 ? null : f[i - 1];
      const nx = b ? b.x : x, ny = b ? b.y : y, nlv = b ? b.lv : lv;
      a.moving = nx !== a.x || ny !== a.y;
      if (a.moving) a.dir = R.U.dirOf(nx - a.x, ny - a.y, a.dir);
      a.x = nx; a.y = ny; a.lv = nlv;
    }
  };
  /** 先頭が 1 歩下がる前に呼ぶ（入口の確かめの「いいえ」、move.js）: 1 人目を 2 人目の所へ…最後の人は前の歩の前の所へ。向きは変えない */
  F._trailBack = function () {
    const f = S.fol || [], z = S.trailTail;
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = i + 1 < f.length ? f[i + 1] : z;
      a.fx = a.x; a.fy = a.y;
      if (!b) { a.moving = false; continue; }
      a.moving = b.x !== a.x || b.y !== a.y;
      a.x = b.x; a.y = b.y; a.lv = b.lv || 0;
    }
    S.trailTail = null;
  };
  F._trailStart = function () {};
  F._trailEnd = function () { const f = S.fol || []; for (let i = 0; i < f.length; i++) { f[i].moving = false; f[i].fx = f[i].x; f[i].fy = f[i].y; } };

  /** 人 i の見た目の位置（マス単位）。k = 先頭の歩の進み（0〜1） */
  F._folVis = function (a, k, out) {
    if (a.moving) { out.px = a.fx + (a.x - a.fx) * k; out.py = a.fy + (a.y - a.fy) * k; }
    else { out.px = a.x; out.py = a.y; }
    return out;
  };
  /** 隊列の各人が今いるマス（テスト用） */
  F.trail = function () { return (S.fol || []).map((a) => ({ id: a.id, look: a.look, x: a.x, y: a.y, lv: a.lv, guest: a.guest })); };
})(window.RPG);
