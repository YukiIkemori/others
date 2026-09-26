// FIELD — 隊列のなぞり（V2_PLAN §2.5.9、E8）。先頭の歩いたマスを 2 人目以降が 1 歩遅れでなぞる（高さ lv も）。
// ついてくる人（R.Field.setGuest、ピム）は隊列の最後。戦闘には出ない。
//   S.fol = [{id, look, x, y, lv, dir, fx, fy, moving}]（先頭を除く。最後が guest）
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const S = (F._s = F._s || {});

  function wanted() {
    const G = R.Game;
    const out = [];
    if (G && G.party) for (let i = 1; i < G.party.length; i++) { const c = G.chars[G.party[i]]; if (c) out.push({ id: c.id, look: c.look }); }
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
        if (S.map && F.passable(S.map, nx, ny, null, S.lv) && !F._npcAt(nx, ny, S.lv)) { px = nx; py = ny; }
        b = { x: px, y: py, lv: S.lv, dir: S.dir };
      }
      return { id: w.id, look: w.look, guest: !!w.guest, x: b.x, y: b.y, lv: b.lv || 0, dir: b.dir || S.dir, fx: b.x, fy: b.y, moving: false };
    });
    S.folSig = sig();
  };
  function sig() {
    const G = R.Game;
    let s = S.guest ? S.guest.look : '';
    if (G && G.party) for (let i = 1; i < G.party.length; i++) s += '|' + G.party[i];
    return s;
  }
  /** 仲間の顔ぶれが変わったか（入れ替え・加入）を安く調べる */
  F._trailCheck = function () {
    const G = R.Game;
    const n = (G && G.party ? Math.max(0, G.party.length - 1) : 0) + (S.guest ? 1 : 0);
    const f = S.fol || [];
    let same = f.length === n;
    for (let i = 0; same && G && i < G.party.length - 1; i++) if (f[i].id !== G.party[i + 1]) same = false;
    if (!same) F._resetTrail(true);
  };

  /** 先頭が動く前に呼ぶ: 先頭の今の位置を 1 人目へ、1 人目を 2 人目へ… */
  F._trailPush = function (x, y, lv, dir) {
    const f = S.fol || [];
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
