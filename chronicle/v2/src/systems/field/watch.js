// FIELD — 見回りの視線（WORLD_REDESIGN §6.6 の E10。消灯後の学院の潜入）
//   NPC の def.watch = {range: 3, event: 'star_caught', cond?, routeFlag?}（歩く道は今までの move {route, wait, speed}）
//   - 見張りの向いた方の range マス以内に一行がいると「見つかった」: R.Events.run(event, {map, x, y, npc: id})。
//     1 マス目は正面だけ、2 マス目から左右 1 マスに広がる扇。見張りと一行の間に壁（歩けないマス）があれば見えない。
//   - 見張りの手のランタンの光だまりを、向いた方の前に描く（F._doorways の後 = 地面の上・人の下。見える範囲の目安）。
//   - routeFlag の旗が立っていれば、見回りの道（route の点を結ぶ線）と曲がり角の印を床に点線で描く（夜番の日誌）。
//   cond（R.State.check）が偽の見張りは見ない（制服を着ていれば学生は騒がない、など）。見つけた後 1.5 秒は二度と起きない。
//   イベント中・暗転中・メニューの間は見ない。
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const S = (F._s = F._s || {});
  const DIRS = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] };
  let coolUntil = 0;

  function watchers() {
    const list = S.npcs || [];
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      const w = n.def && n.def.watch;
      if (!w || !n.vis || n.hidden) continue;
      if (w.cond != null && !R.State.check(w.cond)) continue;
      out.push(n);
    }
    return out;
  }
  const open = (m, x, y) => { try { return F.passable(m, x, y); } catch (e) { return true; } };
  /** 見張り n から (px, py) が見えるか */
  function sees(n, px, py) {
    const w = n.def.watch, d = DIRS[n.dir] || DIRS.s, range = w.range || 3;
    const rx = px - n.x, ry = py - n.y;
    const fwd = rx * d[0] + ry * d[1], side = d[0] ? ry : rx;
    if (fwd < 1 || fwd > range) return false;
    if (Math.abs(side) > (fwd >= 2 ? 1 : 0)) return false;
    // 正面の列を進み、最後に横へ 1 マス（その間のマスがどれも歩ける = 壁にさえぎられない）
    for (let k = 1; k < fwd; k++) if (!open(S.map, n.x + d[0] * k, n.y + d[1] * k)) return false;
    if (side) {
      const ex = n.x + d[0] * fwd, ey = n.y + d[1] * fwd;
      if (!open(S.map, ex - (d[0] ? 0 : side), ey - (d[0] ? side : 0))) return false;
    }
    return true;
  }
  F._watchSees = sees;
  F.watchCheck = function () {
    if (!S.map || !R.Events || R.Events.busy() || (F._locked && F._locked())) return false;
    if (R.Engine.fade && R.Engine.fade.a > 0.01) return false;
    if (R.Engine.top && R.Engine.top() !== F.scene) return false;
    if (R.Engine.time < coolUntil) return false;
    const list = watchers();
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (!sees(n, S.x, S.y)) continue;
      coolUntil = R.Engine.time + 1500;
      try { R.Audio.sfx('alert'); } catch (e) { /* */ }
      R.Events.run(n.def.watch.event, { map: S.map.id, x: S.x, y: S.y, npc: n.id });
      return true;
    }
    return false;
  };
  const tick0 = F._tickNpcs;
  if (tick0 && !tick0._watch) {
    F._tickNpcs = function (dt) {
      const r = tick0.apply(this, arguments);
      try { F.watchCheck(); } catch (e) { R.warn && R.warn('watch', e && e.message); }
      return r;
    };
    F._tickNpcs._watch = true;
  }

  // ---------------------------------------------------------------- 描く（ランタンの光だまり・見回りの道）
  function posOf(n) {
    if (!n.mv) return [n.x, n.y];
    const k = Math.max(0, Math.min(1, (R.Engine.time - n.mv.t0) / n.mv.ms));
    return [n.mv.fx + (n.mv.tx - n.mv.fx) * k, n.mv.fy + (n.mv.ty - n.mv.fy) * k];
  }
  function drawWatch(g, t, cx, cy) {
    const list = watchers();
    if (!list.length) return;
    g.save();
    for (let i = 0; i < list.length; i++) {
      const n = list[i], w = n.def.watch;
      const route = n.def.move && n.def.move.route;
      if (w.routeFlag && route && route.length > 1 && R.State.check(w.routeFlag)) {
        // 夜番の日誌: 見回りの道を点線で（チョークの線）、曲がり角に小さな×
        g.strokeStyle = 'rgba(236,232,210,0.5)'; g.lineWidth = Math.max(1, t / 16); g.setLineDash([t / 5, t / 6]);
        g.beginPath();
        route.forEach((p, k) => { const x = (p[0] + 0.5) * t - cx, y = (p[1] + 0.5) * t - cy; if (k) g.lineTo(x, y); else g.moveTo(x, y); });
        g.closePath(); g.stroke(); g.setLineDash([]);
        for (const p of route) {
          const x = (p[0] + 0.5) * t - cx, y = (p[1] + 0.5) * t - cy, r = t / 6;
          g.beginPath(); g.moveTo(x - r, y - r); g.lineTo(x + r, y + r); g.moveTo(x + r, y - r); g.lineTo(x - r, y + r); g.stroke();
        }
      }
      // ランタンの光だまり（向いた方の前。見える範囲の目安）
      const d = DIRS[n.dir] || DIRS.s, range = w.range || 3;
      const [nx, ny] = posOf(n);
      const lx = (nx + 0.5 + d[0] * (range / 2 + 0.3)) * t - cx, ly = (ny + 0.6 + d[1] * (range / 2 + 0.3)) * t - cy;
      const rx = (d[0] ? range / 2 + 0.7 : 1.6) * t, ry = (d[1] ? range / 2 + 0.7 : 1.6) * t * 0.8;
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.translate(lx, ly); g.scale(rx / ry, 1);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, ry);
      gr.addColorStop(0, 'rgba(255,196,120,0.30)'); gr.addColorStop(0.6, 'rgba(255,170,90,0.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(-ry, -ry, ry * 2, ry * 2);
      g.restore();
    }
    g.restore();
  }
  const door0 = F._doorways;
  F._doorways = function (g, t, cx, cy) {
    if (door0) door0.call(this, g, t, cx, cy);
    try { drawWatch(g, t, cx, cy); } catch (e) { /* 描けなくても止めない */ }
  };
})(window.RPG);
