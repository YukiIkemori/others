// FIELD — NPC（V2_PLAN §2.5.9、A3）: 立ち・歩き回り（wander、radius で広さ）・決まった道（route、{route, wait, speed}）、押し続けると 1 歩よける・
// 動けなければ入れ替わる・しばらくして戻る。pushable:false は動かない。歩き回る NPC は逃げ場を 2 マス未満にしない
// （周りの通れるマスが 3 つ以上ある所にしか入らない）。話すときは一行の方を向く。
//   R.Field.npc(id) → {move(path, {speed}), face(dir), act(pose), hide(), show(), setPos(x, y)}（どれも Promise）
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const S = (F._s = F._s || {});
  const STEP_MS = 320, RETURN_MS = 3000;
  const DIRS = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] };
  const ORTHO = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const OPP = { s: 'n', n: 's', e: 'w', w: 'e' };

  // 絵の look: 原画のフォルダがあればそれ。町の人の仮の型（npc_man_1 …）は地方の原画の型の色違いへ（CAST の R.Art.cast.fieldLook）。
  // 話者の名前は地図の look（d.look）のまま
  function artLook(look, m) {
    const c = R.Art && R.Art.cast;
    try { return c && c.fieldLook ? c.fieldLook(look, m) : look; } catch (e) { return look; }
  }
  F._artLook = artLook;
  F._initNpcs = function () {
    const m = S.map;
    S.npcs = (m.npcs || []).map((d) => ({
      def: d, id: d.id, look: artLook(d.look, m), x: d.x, y: d.y, lv: d.lv || 0, dir: d.dir || 's', home: { x: d.x, y: d.y, dir: d.dir || 's' },
      mv: null, vis: true, hidden: false, script: 0, talking: false, nextAt: R.Engine.time + 600 + (R.U.hash(d.id) % 1800), returnAt: 0,
      route: 0, pose: null, rng: R.rng(m.id + ':' + d.id), isNew: false, waiters: [],
    }));
    S.npcById = {};
    for (const n of S.npcs) S.npcById[n.id] = n;
    F._npcVis();
  };
  F._npcVis = function () {
    for (const n of S.npcs || []) n.vis = !n.hidden && (!n.def.cond || R.State.check(n.def.cond));
  };

  /** 人（一行・隊列・NPC）のいるマス */
  function occupied(x, y, lv, self) {
    if (S.x === x && S.y === y && (S.lv || 0) === lv) return true;
    const f = S.fol || [];
    for (let i = 0; i < f.length; i++) if (f[i].x === x && f[i].y === y && f[i].lv === lv) return true;
    const list = S.npcs || [];
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (n === self || !n.vis) continue;
      if (n.lv !== lv) continue;
      if ((n.x === x && n.y === y) || (n.mv && n.mv.tx === x && n.mv.ty === y)) return true;
    }
    return false;
  }
  function freeFor(n, x, y) {
    return F._walkable(S.map, x, y, null, n.lv) && !occupied(x, y, n.lv, n);
  }
  // 自分で歩く（wander・route・よける・戻る）ときは、戸口・出口・階段と、踏むと起きる所（step の trigger）に立たない。
  // 台本の move（ev.npc(id).move）はこの制限を受けない
  function offLimits(n, x, y) {
    const m = S.map;
    if (F._warpAt && F._warpAt(m, x, y, n.lv || 0)) return true;
    const t = m.triggers || [];
    for (let i = 0; i < t.length; i++) {
      const tr = t[i];
      if (tr.on === 'step' && tr.x != null && x >= tr.x && y >= tr.y && x < tr.x + (tr.w || 1) && y < tr.y + (tr.h || 1)) return true;
    }
    return false;
  }
  function freeWalk(n, x, y) { return freeFor(n, x, y) && !offLimits(n, x, y); }
  function openness(n, x, y) {
    let k = 0;
    for (let i = 0; i < 4; i++) if (F._walkable(S.map, x + ORTHO[i][0], y + ORTHO[i][1], null, n.lv)) k++;
    return k;
  }
  function stepTo(n, x, y, ms) {
    n.dir = R.U.dirOf(x - n.x, y - n.y, n.dir);
    n.mv = { fx: n.x, fy: n.y, tx: x, ty: y, t0: R.Engine.time, ms: ms || STEP_MS };
  }

  F._tickNpcs = function () {
    const list = S.npcs;
    if (!list) return;
    const now = R.Engine.time;
    const top = R.Engine.top() === F.scene;
    const calm = top && !F._locked() && !R.Events.busy();
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (n.mv && now - n.mv.t0 >= n.mv.ms) {
        n.x = n.mv.tx; n.y = n.mv.ty; n.mv = null;
        if (n.waiters.length) { const w = n.waiters.splice(0); for (const r of w) r(); }
      }
      if (n.pose && now >= n.pose.until) n.pose = null;
      if (n.mv || n.script || n.talking || !n.vis || !calm) continue;
      const d = n.def;
      // 押されてよけた人は、しばらくして元の場所へ戻る
      if (n.returnAt && now >= n.returnAt) {
        if (n.x === n.home.x && n.y === n.home.y) { n.returnAt = 0; if (d.move === 'still' || !d.move) n.dir = n.home.dir; continue; }
        const dx = Math.sign(n.home.x - n.x), dy = Math.sign(n.home.y - n.y);
        if (dx && freeWalk(n, n.x + dx, n.y)) stepTo(n, n.x + dx, n.y);
        else if (dy && freeWalk(n, n.x, n.y + dy)) stepTo(n, n.x, n.y + dy);
        else n.returnAt = now + 800;
        continue;
      }
      if (now < n.nextAt) continue;
      if (d.move === 'wander') {
        n.nextAt = now + 1400 + n.rng.int(0, 2600);
        const dir = ORTHO[n.rng.int(0, 3)];
        const x = n.x + dir[0], y = n.y + dir[1];
        const rad = d.radius || 3;   // 歩き回る広さ（home から縦横それぞれ radius マスまで。既定 3）
        if (Math.abs(x - n.home.x) > rad || Math.abs(y - n.home.y) > rad) continue;
        if (Math.max(Math.abs(x - S.x), Math.abs(y - S.y)) <= 1) continue;   // 一行の目の前には入らない
        if (!freeWalk(n, x, y) || openness(n, x, y) < 3) continue;           // 逃げ場を 2 マス未満にしない
        stepTo(n, x, y);
      } else if (d.move && typeof d.move === 'object' && Array.isArray(d.move.route) && d.move.route.length) {
        const r = d.move.route;
        const wp = r[n.route % r.length];
        if (n.x === wp[0] && n.y === wp[1]) { n.route++; n.nextAt = now + (d.move.wait || 1200); continue; }
        const dx = Math.sign(wp[0] - n.x), dy = Math.sign(wp[1] - n.y);
        const ms = STEP_MS / (d.move.speed || 1);   // speed: 1 = 歩く、2 前後 = 走る（子ども）
        if (dx && freeWalk(n, n.x + dx, n.y)) stepTo(n, n.x + dx, n.y, ms);
        else if (dy && freeWalk(n, n.x, n.y + dy)) stepTo(n, n.x, n.y + dy, ms);
        else n.nextAt = now + 600;
      } else n.nextAt = now + 5000;
    }
  };

  /** 一行が押し続けた: よける（→ 'dodge'）か入れ替わる（→ 'swap'）か動かない（→ null） */
  F._pushNpc = function (n, dx, dy) {
    if (!n || n.def.pushable === false || n.script || n.talking || n.mv) { try { R.Audio.sfx('bump'); } catch (e) { /* */ } return null; }
    const sides = [[-dy, dx], [dy, -dx], [dx, dy]];
    for (const s of sides) {
      const x = n.x + s[0], y = n.y + s[1];
      if (freeWalk(n, x, y)) { stepTo(n, x, y, 220); n.returnAt = R.Engine.time + RETURN_MS; return 'dodge'; }
    }
    // よけられない: 入れ替わる（NPC は一行のいたマスへ）
    stepTo(n, S.x, S.y, F.WALK_MS);
    n.returnAt = R.Engine.time + RETURN_MS;
    return 'swap';
  };

  /** 話す: 一行の方を向いて、終わったら元の向きへ */
  F._talk = function (n) {
    const back = n.dir;
    n.dir = OPP[S.dir] || n.dir;
    n.talking = true;
    const done = () => { n.talking = false; if (!n.def.move || n.def.move === 'still') n.dir = back; F.hud.refresh(); };
    let p;
    try { p = R.Events.talk(S.map, n.def); } catch (e) { done(); throw e; }
    Promise.resolve(p).then(done, (e) => { done(); console.error(e); });
  };

  const DUMMY = { move: async () => {}, face: async () => {}, act: async () => {}, hide: async () => {}, show: async () => {}, setPos: async () => {} };
  F.npc = function (id) {
    const n = S.npcById && S.npcById[id];
    if (!n) { R.warn('Field.npc: no npc ' + id + ' on ' + (S.map && S.map.id)); return DUMMY; }
    const idle = () => (n.mv ? new Promise((res) => n.waiters.push(res)) : Promise.resolve());
    return {
      async move(path, o) {
        const ms = STEP_MS / ((o && o.speed) || 1);
        n.script++;
        try {
          await idle();
          for (const p of path || []) {
            const x = p[0], y = p[1];
            // 1 マスずつ（離れた点は縦横に分けて歩く）
            while (n.x !== x || n.y !== y) {
              const dx = Math.sign(x - n.x), dy = Math.sign(y - n.y);
              stepTo(n, n.x + (dx || 0), n.y + (dx ? 0 : dy), ms);
              await idle();
            }
          }
        } finally { n.script--; }
      },
      async face(dir) { if (DIRS[dir]) n.dir = dir; },
      async act(pose, o) { const ms = (o && o.ms) || 700; n.pose = { name: pose, until: R.Engine.time + ms }; await R.wait(ms); },
      async hide() { n.hidden = true; F._npcVis(); },
      async show() { n.hidden = false; F._npcVis(); },
      async setPos(x, y) { n.mv = null; n.x = x; n.y = y; n.home = { x, y, dir: n.dir }; },
    };
  };
})(window.RPG);
