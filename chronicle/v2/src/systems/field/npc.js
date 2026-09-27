// FIELD — NPC（V2_PLAN §2.5.9、A3）: 立ち・歩き回り（wander、radius で広さ）・決まった道（route、{route, wait, speed}）、押し続けると 1 歩よける・
// 動けなければ入れ替わる・しばらくして戻る。pushable:false は動かない。歩き回る NPC は逃げ場を 2 マス未満にしない
// （周りの通れるマスが 3 つ以上ある所にしか入らない）。話すときは一行の方を向く。
//   R.Field.npc(id) → {move(path, {speed}), face(dir), act(pose), hide(), show(), setPos(x, y)}（どれも Promise）
//   立っている人の小さな動き（オーナーの依頼 2026-09-27）: 立ち止まった人は息をする（layers.js が 1 px 上下、人ごとに位相と速さ）。
//   動かない人（move:'still' か move なし）は 3〜8 秒ごとに隣の向きをちらっと見て 1〜2 秒で戻る（n.glance = 見た目の向きだけ。
//   n.dir は変えないので、話す・イベントの向きはそのまま）。見回さない人: def.fixedDir、門番・見張り（id / look に guard・gate・watch）、
//   向いた先が台（店の台の向こうの人）、イベントが face() で向きを決めた人、イベント中・話している間
//   仲間をイベントで出す（フィールドは主人公だけ、trail.js）: R.Field.partyShow(id | ids | 'all', {near, at, dir, ms, wait, stay}) /
//   partyHide(id | ids | 'all', {ms, wait}) / partyShown() → ids。出した人は一時の NPC（id = 仲間の id）なので ev.npc(id) で動かせる。
//   イベントが終わると（stay で出した人を除き）R.Events が partyHide('all') を呼ぶ。マップに入り直すと消える
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
      route: 0, stuck: 0, pose: null, rng: R.rng(m.id + ':' + d.id), isNew: false, waiters: [],
    }));
    S.npcById = {};
    for (const n of S.npcs) S.npcById[n.id] = n;
    S.partyShown = [];
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
    F._tickPartyFade();
    const now = R.Engine.time;
    const top = R.Engine.top() === F.scene;
    const calm = top && !F._locked() && !R.Events.busy();
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (n.mv && now - n.mv.t0 >= n.mv.ms) {
        n.x = n.mv.tx; n.y = n.mv.ty; n.mv = null; n.odo = (n.odo || 0) + 1;
        if (n.waiters.length) { const w = n.waiters.splice(0); for (const r of w) r(); }
      }
      if (n.pose && now >= n.pose.until) n.pose = null;
      if (n.glance && (!calm || n.talking || n.script || n.mv || n.pose || now >= n.glance.until)) n.glance = null;
      if (n.mv || n.script || n.talking || !n.vis || !calm) continue;
      const d = n.def;
      if (!n.returnAt && lookAround(n, now)) continue;
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
        if (n.x === wp[0] && n.y === wp[1]) { n.route++; n.stuck = 0; n.nextAt = now + (d.move.wait || 1200); continue; }
        const dx = Math.sign(wp[0] - n.x), dy = Math.sign(wp[1] - n.y);
        const ms = STEP_MS / (d.move.speed || 1);   // speed: 1 = 歩く、2 前後 = 走る（子ども）
        if (dx && freeWalk(n, n.x + dx, n.y)) { stepTo(n, n.x + dx, n.y, ms); n.stuck = 0; }
        else if (dy && freeWalk(n, n.x, n.y + dy)) { stepTo(n, n.x, n.y + dy, ms); n.stuck = 0; }
        else {
          // ふさがれた（一行・隊列・ほかの人）: しばらく待って、それでも通れなければ次の点へ向かう（道の途中で固まらない）
          n.nextAt = now + 600;
          if (++n.stuck >= 5) { n.stuck = 0; n.route++; }
        }
      } else n.nextAt = now + 5000;
    }
  };

  // ---------------------------------------------------------------- 見回す（動かない人）
  const SIDE = { s: ['e', 'w'], n: ['e', 'w'], e: ['n', 's'], w: ['n', 's'] };
  const FIXED_RE = /guard|gate|watch|sentry/;
  function still(d) { return !d.move || d.move === 'still'; }
  /** 見回さない人か（一度だけ調べて覚える） */
  function fixedDir(n) {
    if (n.fixedDir != null) return n.fixedDir;
    const d = n.def;
    let f = d.fixedDir === true || !!n.party;
    if (!f && d.fixedDir !== false) {
      f = FIXED_RE.test(String(d.id || '')) || FIXED_RE.test(String(d.look || ''));
      const v = DIRS[n.home.dir || n.dir];
      if (!f && v && F._objBlocks && S.map) { try { f = !!F._objBlocks(S.map, n.home.x + v[0], n.home.y + v[1], n.lv || 0); } catch (e) { /* */ } }   // 店の台の向こう
    }
    return (n.fixedDir = f);
  }
  /** 見回しの番（見ている間・待つ間は true = この後の歩き回りをしない） */
  function lookAround(n, now) {
    const d = n.def;
    if (!still(d) || n.faced || fixedDir(n) || n.x !== n.home.x || n.y !== n.home.y) return false;
    if (n.glance) return true;
    if (n.glanceAt == null) { n.glanceAt = now + 3000 + n.rng.int(0, 5000); return false; }
    if (now < n.glanceAt) return false;
    const opts = SIDE[n.dir] || SIDE.s;
    n.glance = { dir: opts[n.rng.int(0, 1)], until: now + 1000 + n.rng.int(0, 1000) };
    n.glanceAt = n.glance.until + 3000 + n.rng.int(0, 5000);
    return true;
  }
  F._npcFixedDir = fixedDir;

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
    n.glance = null;
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
      async face(dir) { if (DIRS[dir]) { n.dir = dir; n.faced = true; n.glance = null; } },   // イベントが向きを決めた人は見回さない
      async act(pose, o) { const ms = (o && o.ms) || 700; n.pose = { name: pose, until: R.Engine.time + ms }; await R.wait(ms); },
      async hide() { n.hidden = true; F._npcVis(); },
      async show() { n.hidden = false; n.fade = null; F._npcVis(); },
      /**
       * 立ち去る（持ち主 2026-09-27: 話が終わってパッと消さない）: 背を向けて数歩歩き、歩きながら薄れて消える。
       * o.path があればその道を歩く。無ければ主人公から離れる向きへ歩ける所を o.steps（既定 3）マスまで。o.ms = 薄れる時間
       */
      async leave(o) {
        o = o || {};
        n.script++;
        try {
          await idle();
          let path = o.path;
          if (!path) {
            const ax = Math.sign(n.x - S.x), ay = Math.sign(n.y - S.y);
            const order = Math.abs(n.x - S.x) >= Math.abs(n.y - S.y)
              ? [[ax || 1, 0], [0, ay || 1], [0, -(ay || 1)], [-(ax || 1), 0]]
              : [[0, ay || 1], [ax || 1, 0], [-(ax || 1), 0], [0, -(ay || 1)]];
            path = [];
            for (const [dx, dy] of order) {
              let x = n.x, y = n.y;
              const p = [];
              for (let i = 0; i < (o.steps || 3); i++) { if (!freeFor(n, x + dx, y + dy)) break; x += dx; y += dy; p.push([x, y]); }
              if (p.length > path.length) path = p;
              if (path.length >= (o.steps || 3)) break;
            }
          }
          if (path.length) {
            const f = path[0];
            const d = R.U.dirOf(f[0] - n.x, f[1] - n.y, n.dir);
            n.dir = d; n.faced = true; n.glance = null;
          }
          await R.wait(180);
          const ms = STEP_MS * 1.25;
          const fadeMs = o.ms || Math.max(360, ms * Math.max(1, path.length) * 0.8);
          fadeOf(n, 0, fadeMs);
          const t0 = R.Engine.time;
          n.fadeDone = () => { n.hidden = true; F._npcVis(); };   // 薄れ切った所で消す（_tickPartyFade）
          for (const [x, y] of path) {
            while (n.x !== x || n.y !== y) {
              const dx = Math.sign(x - n.x), dy = Math.sign(y - n.y);
              stepTo(n, n.x + (dx || 0), n.y + (dx ? 0 : dy), ms);
              await idle();
            }
          }
          const left = fadeMs - (R.Engine.time - t0);
          if (left > 0) await R.wait(left + 20);
        } finally { n.script--; }
        n.fade = null; n.fadeDone = null;
        n.hidden = true;
        F._npcVis();
      },
      async setPos(x, y) { n.mv = null; n.x = x; n.y = y; n.home = { x, y, dir: n.dir }; },
    };
  };

  // ---------------------------------------------------------------- 仲間をイベントで出す（主人公だけのフィールド）
  const FADE_MS = 220;
  // 仲間の立つ所の順（[後ろへ, 横へ]）: 真後ろ → 横 → 斜め後ろ → 2 つ後ろ → 2 つ横 → 斜め前 → 前
  const AROUND = [[1, 0], [0, -1], [0, 1], [1, -1], [1, 1], [2, 0], [0, -2], [0, 2], [-1, -1], [-1, 1], [-1, 0], [2, -1], [2, 1]];
  function partyIds(id) {
    const G = R.Game;
    if (!G) return [];
    if (id === 'all' || id == null) return (G.party || []).filter((q) => q !== F.leadId());
    return [].concat(id).filter(Boolean);
  }
  /** 一行の人（party・reserve）で、主人公でない */
  F._isMember = function (id) {
    const G = R.Game;
    if (!G || !id || !G.chars || !G.chars[id] || id === F.leadId() || id === G.hero) return false;
    return (G.party || []).includes(id) || (G.reserve || []).includes(id);
  };
  /** (cx, cy) の近くで仲間が立てるマス。後ろ（向きの反対）→ 横 → 斜め後ろ → 前の順 */
  function spotNear(cx, cy, lv, dir) {
    const m = S.map;
    const back = { s: [0, -1], n: [0, 1], e: [-1, 0], w: [1, 0] }[dir] || [0, -1];
    const side = [-back[1], back[0]];
    for (const [k, j] of AROUND) {
      const x = cx + back[0] * k + side[0] * j, y = cy + back[1] * k + side[1] * j;
      if (x === S.x && y === S.y) continue;
      if (!F._walkable(m, x, y, null, lv) || F._npcAt(x, y, lv)) continue;
      if (F._warpAt && F._warpAt(m, x, y, lv)) continue;
      if ((S.fol || []).some((a) => a.x === x && a.y === y && a.lv === lv)) continue;
      return { x, y };
    }
    return { x: cx + back[0], y: cy + back[1] };
  }
  function fadeOf(n, to, ms) {
    const now = R.Engine.time;
    n.fade = { t0: now, ms: Math.max(1, ms), from: F._npcAlpha(n), to };
  }
  /** 描く濃さ（0〜1）。フェードが終われば消す */
  F._npcAlpha = function (n) {
    const f = n.fade;
    if (!f) return 1;
    const k = Math.max(0, Math.min(1, (R.Engine.time - f.t0) / f.ms));
    return f.from + (f.to - f.from) * k;
  };
  F.partyShow = function (id, o) {
    o = o || {};
    const ids = partyIds(id);
    if (!S.map || !R.Game || !ids.length) return Promise.resolve([]);
    const shown = [];
    const ms = o.ms == null ? FADE_MS : o.ms;
    for (const pid of ids) {
      const G = R.Game, c = G.chars && G.chars[pid];
      if (!c || pid === F.leadId()) continue;
      const ex = S.npcById && S.npcById[pid];
      if (ex && !ex.party) { if (ex.hidden) { ex.hidden = false; F._npcVis(); } shown.push(pid); continue; }   // 地図の NPC がその人
      if (ex && ex.party) {   // もう出ている（消えかけなら戻す）
        if (ex.leaving) { ex.leaving = false; fadeOf(ex, 1, ms); }
        if (o.stay) ex.stay = true;
        shown.push(pid);
        continue;
      }
      let x, y, lv = S.lv || 0;
      if (Array.isArray(o.at)) { x = o.at[0]; y = o.at[1]; }
      else {
        const near = o.near && o.near !== 'hero' ? S.npcById && S.npcById[o.near] : null;
        const p = near ? spotNear(near.x, near.y, near.lv || 0, near.dir) : spotNear(S.x, S.y, lv, S.dir);
        if (near) lv = near.lv || 0;
        x = p.x; y = p.y;
      }
      const dir = o.dir || R.U.dirOf(S.x - x, S.y - y, S.dir);
      const def = { id: pid, look: c.look, x, y, lv, dir, move: 'still', pushable: false, party: true };
      const n = {
        def, id: pid, look: c.look, x, y, lv, dir, home: { x, y, dir }, party: true, stay: !!o.stay, leaving: false,
        mv: null, vis: true, hidden: false, script: 0, talking: false, nextAt: R.Engine.time + 1e9, returnAt: 0,
        route: 0, stuck: 0, pose: null, rng: R.rng(S.map.id + ':party:' + pid), isNew: false, waiters: [],
      };
      if (F._warmLook) F._warmLook(c.look);   // 絵を先に焼く（まだなら仮の人形が一瞬見える）
      fadeOf(n, 1, ms);
      n.fade.from = 0;
      S.npcs.push(n);
      S.npcById[pid] = n;
      (S.partyShown = S.partyShown || []).push(pid);
      shown.push(pid);
    }
    if (!o.wait || !shown.length) return Promise.resolve(shown);
    return R.wait(ms).then(() => shown);
  };
  F.partyHide = function (id, o) {
    o = o || {};
    const ids = id === 'all' || id == null ? (S.partyShown || []).slice() : [].concat(id);
    const ms = o.ms == null ? FADE_MS : o.ms;
    const gone = [];
    for (const pid of ids) {
      const n = S.npcById && S.npcById[pid];
      if (!n || !n.party || (o.auto && n.stay)) continue;
      n.leaving = true;
      n.stay = false;
      const done = () => {
        if (!n.leaving || !S.npcs) return;
        const i = S.npcs.indexOf(n);
        if (i >= 0) S.npcs.splice(i, 1);
        if (S.npcById && S.npcById[pid] === n) delete S.npcById[pid];
        S.partyShown = (S.partyShown || []).filter((q) => q !== pid);
        if (n.waiters.length) { const w = n.waiters.splice(0); for (const r of w) r(); }
      };
      if (ms <= 0) done();
      else { fadeOf(n, 0, ms); n.fadeDone = done; }
      gone.push(pid);
    }
    if (!o.wait || !gone.length || ms <= 0) return Promise.resolve(gone);
    return R.wait(ms).then(() => gone);
  };
  F.partyShown = function () { return (S.partyShown || []).slice(); };
  /** 毎フレーム: 消える途中の仲間を片付ける（_tickNpcs から） */
  F._tickPartyFade = function () {
    const list = S.npcs;
    if (!list) return;
    for (let i = list.length - 1; i >= 0; i--) {
      const n = list[i];
      if (!n.fade) continue;
      if (R.Engine.time - n.fade.t0 < n.fade.ms) continue;
      const f = n.fade;
      n.fade = null;
      if (f.to <= 0 && n.fadeDone) { const d = n.fadeDone; n.fadeDone = null; d(); }
    }
  };
})(window.RPG);
