// 仮の実装: FIELD（R.Field）。本物は src/systems/field/*（FIELD）。V2_PLAN §2.5.9
// マスは色の箱（素材の名前から色）、人は角丸の箱。1 歩 1 マス・8 方向（斜めは両隣が通れるときだけ）・補間で描く。
// A で向いた先の人に話す／看板を読む、Y（または start）でメニュー、出口・トリガー・出現（R.Mon.encounter）。
(function (R) {
  'use strict';
  const TILE = { near: 40, normal: 32, far: 24 };
  const WALK_MS = 250, DASH_MS = 140;
  const st = {
    map: null, x: 0, y: 0, dir: 's', lv: 0,
    mv: null, // {fx, fy, tx, ty, t0, ms}
    locks: {}, steps: 0, suppress: 0, ward: 0, trail: [], guest: null,
    cam: null, flash: null, shake: null, npcPos: {}, npcHidden: {},
  };
  const tile = () => TILE[R.Settings.get('fieldZoom')] || 32;
  const locked = () => Object.keys(st.locks).length > 0;

  function cell(map, x, y) {
    if (!map || x < 0 || y < 0 || x >= map.w || y >= map.h) return null;
    return map.legend[[...map.rows[y]][x]] || null;
  }
  function npcAt(x, y) {
    const m = st.map;
    if (!m) return null;
    for (const n of m.npcs || []) {
      if (st.npcHidden[n.id] || (n.cond && !R.State.check(n.cond))) continue;
      const p = st.npcPos[n.id] || n;
      if (p.x === x && p.y === y) return n;
    }
    return null;
  }
  function solidObj(x, y) {
    for (const o of (st.map && st.map.objects) || []) {
      if ((o.type === 'sign' || o.type === 'chest' || o.type === 'examine') && o.x === x && o.y === y) return o;
    }
    return null;
  }
  function passable(map, x, y, fromDir, lv) {
    const c = cell(map, x, y);
    if (!c || c.solid || c.walk === false) return false;
    return true;
  }
  function free(x, y) { return passable(st.map, x, y) && !npcAt(x, y) && !solidObj(x, y); }

  function vis() {
    const t = tile();
    let px = st.x, py = st.y;
    if (st.mv) {
      const k = Math.min(1, (R.Engine.time - st.mv.t0) / st.mv.ms);
      px = st.mv.fx + (st.mv.tx - st.mv.fx) * k; py = st.mv.fy + (st.mv.ty - st.mv.fy) * k;
    }
    return { px, py, t };
  }
  function camera() {
    const { px, py, t } = vis();
    const m = st.map;
    let cx = (st.cam ? st.cam.x : px) * t + t / 2 - R.W / 2, cy = (st.cam ? st.cam.y : py) * t + t / 2 - R.H / 2;
    const mw = m.w * t, mh = m.h * t;
    cx = mw <= R.W ? (mw - R.W) / 2 : Math.max(0, Math.min(mw - R.W, cx));
    cy = mh <= R.H ? (mh - R.H) / 2 : Math.max(0, Math.min(mh - R.H, cy));
    return { cx: Math.round(cx), cy: Math.round(cy), t };
  }

  async function arrive() {
    const m = st.map;
    st.steps++;
    R.Game.pos = { map: m.id, x: st.x, y: st.y, dir: st.dir };
    R.emit('step', { map: m.id, x: st.x, y: st.y });
    for (const e of m.exits || []) {
      if (st.x >= e.x && st.x < e.x + e.w && st.y >= e.y && st.y < e.y + e.h && (!e.cond || R.State.check(e.cond))) {
        await R.Field.enter(e.to.map, e.to.spawn);
        return;
      }
    }
    for (const tr of m.triggers || []) {
      if (tr.on !== 'step' || !(st.x >= tr.x && st.x < tr.x + tr.w && st.y >= tr.y && st.y < tr.y + tr.h)) continue;
      if (tr.cond && !R.State.check(tr.cond)) continue;
      if (tr.once && R.Game.flags['tr_' + m.id + '_' + tr.id]) continue;
      if (tr.once) R.Game.flags['tr_' + m.id + '_' + tr.id] = true;
      await R.Events.run(tr.event, { map: m.id, x: st.x, y: st.y, trigger: tr.id });
      return;
    }
    if (st.suppress > 0) { st.suppress--; return; }
    if (st.ward > 0) st.ward--;
    for (const z of m.zones || []) {
      const r = z.rect;
      if (r && !(st.x >= r[0] && st.x < r[0] + r[2] && st.y >= r[1] && st.y < r[1] + r[3])) continue;
      const setup = R.Mon.encounter(z.zone, { tier: R.Tier.get(), dark: false, steps: st.steps });
      if (setup) {
        R.emit('encounter', { zone: z.zone });
        R.Field.lock('battle');
        const res = await R.Battle.start(setup);
        R.Field.unlock('battle');
        if (res && res.result === 'abort') {
          if (res.to === 'title' && R.Flow) R.Flow.title();
          else if (R.Game.lastInn) R.Field.enter(R.Game.lastInn.map, R.Game.lastInn.spawn);
        }
      }
      break;
    }
  }

  function tryMove(dx, dy, dash) {
    const nx = st.x + dx, ny = st.y + dy;
    st.dir = R.U.dirOf(dx, dy, st.dir);
    let go = null;
    if (dx && dy) {
      if (free(nx, ny) && free(st.x + dx, st.y) && free(st.x, st.y + dy)) go = [dx, dy];
      else if (free(st.x + dx, st.y)) go = [dx, 0];
      else if (free(st.x, st.y + dy)) go = [0, dy];
    } else if (free(nx, ny)) go = [dx, dy];
    if (!go) return false;
    st.trail.unshift({ x: st.x, y: st.y });
    st.trail.length = Math.min(st.trail.length, 8);
    st.mv = { fx: st.x, fy: st.y, tx: st.x + go[0], ty: st.y + go[1], t0: R.Engine.time, ms: (dash ? DASH_MS : WALK_MS) * (go[0] && go[1] ? 1.41 : 1) };
    st.x += go[0]; st.y += go[1];
    return true;
  }

  function actA() {
    const [dx, dy] = R.U.DIR[st.dir];
    const tx = st.x + dx, ty = st.y + dy;
    const n = npcAt(tx, ty);
    if (n) { R.Events.talk(st.map, n); return; }
    const o = solidObj(tx, ty) || solidObj(st.x, st.y);
    if (o && o.type === 'sign') { R.Events.makeEv ? R.Events.makeEv({}).say(null, o.text) : R.UIK.Message.say({ text: o.text }); return; }
    if (o && o.type === 'examine' && o.event) R.Events.run(o.event, { map: st.map.id, x: o.x, y: o.y });
  }

  const scene = {
    id: 'field',
    opaque: true,
    enter() { R.Input.touchLayout('field'); },
    exit() {},
    onLayout() {},
    update() {
      if (!st.map) return;
      if (st.mv && R.Engine.time - st.mv.t0 >= st.mv.ms) { st.mv = null; arrive(); }
      if (st.mv || locked() || R.Engine.fade.a > 0.01) return;
      const I = R.Input;
      if (I.pressed('y') || I.pressed('start')) { R.Field.lock('menu'); R.Screens.open('menu').then(() => { R.Field.unlock('menu'); R.Input.touchLayout('field'); }); return; }
      if (I.pressed('a')) { actA(); return; }
      const d = I.dir8();
      if (d.dx || d.dy) tryMove(d.dx, d.dy, R.Settings.get('alwaysDash') ? !I.down('b') && !I.down('dash') : I.down('b') || I.down('dash'));
    },
    draw(g) {
      const m = st.map;
      if (!m) { R.Gfx.clear(); return; }
      const { cx, cy, t } = camera();
      R.Gfx.clear(R.Terrain.matColor ? R.Terrain.matColor(m.outside || 'outside', true) : '#101428');
      const x0 = Math.max(0, Math.floor(cx / t)), y0 = Math.max(0, Math.floor(cy / t));
      const x1 = Math.min(m.w - 1, Math.ceil((cx + R.W) / t)), y1 = Math.min(m.h - 1, Math.ceil((cy + R.H) / t));
      for (let y = y0; y <= y1; y++) {
        const row = [...m.rows[y]];
        for (let x = x0; x <= x1; x++) {
          const c = m.legend[row[x]] || {};
          g.fillStyle = R.Terrain.matColor ? R.Terrain.matColor(c.mat, c.solid) : '#223';
          g.fillRect(x * t - cx, y * t - cy, t, t);
          if (c.solid) { g.strokeStyle = 'rgba(240,228,200,0.08)'; g.strokeRect(x * t - cx + 0.5, y * t - cy + 0.5, t - 1, t - 1); }
        }
      }
      for (const o of m.objects || []) {
        if (o.type === 'sign') R.Gfx.roundRect(o.x * t - cx + 6, o.y * t - cy + 8, t - 12, t - 14, 3, '#7a5a38', '#c8a070', 1);
      }
      // 人（y の順）
      const people = [];
      for (const n of m.npcs || []) {
        if (st.npcHidden[n.id] || (n.cond && !R.State.check(n.cond))) continue;
        const p = st.npcPos[n.id] || n;
        people.push({ x: p.x, y: p.y, color: `hsl(${R.U.hash(n.look) % 360},32%,52%)`, label: n.name || (R.DB.looks[n.look] && R.DB.looks[n.look].name) || n.id });
      }
      const { px, py } = vis();
      const mem = R.Party.members();
      const trail = [{ x: px, y: py }].concat(st.trail);
      for (let i = mem.length - 1; i >= 1; i--) { const p = trail[Math.min(i, trail.length - 1)]; people.push({ x: p.x, y: p.y, color: '#4f6a8a' }); }
      people.push({ x: px, y: py, color: '#d8a44e', lead: true });
      people.sort((a, b) => a.y - b.y);
      for (const p of people) {
        const sx = Math.round(p.x * t - cx), sy = Math.round(p.y * t - cy);
        if (p.lead) R.Light.ring(g, sx + t / 2, sy + t / 2, 88);
        R.Gfx.roundRect(sx + t * 0.2, sy - t * 0.45, t * 0.6, t * 1.3, 6, p.color, 'rgba(246,240,227,0.7)', 1);
        if (p.label) R.UIK.text(g, p.label, sx + t / 2, sy - t * 0.45 - 16, { size: 11, align: 'center', color: R.UIK.T.color.text2, shadow: true });
      }
      if (st.lead === undefined) st.lead = null;
      // HUD: 場所の名前と操作の表示
      const k = R.uiScale, s = R.safe;
      R.UIK.fadePanel(g, { x: s.l, y: s.t + 14 * k, w: 320 * k, h: 40 * k }, { side: 'l' });
      R.UIK.text(g, m.name || m.id, s.l + 20 * k, s.t + 22 * k, { size: 19 * k, weight: 700, shadow: true });
      const [dx, dy] = R.U.DIR[st.dir];
      const n = npcAt(st.x + dx, st.y + dy);
      const top = R.Engine.top() === scene;
      if (n && !locked() && top) R.UIK.bubble(g, (st.x + dx) * t - cx + t / 2, (st.y + dy) * t - cy - t * 0.5, [{ btn: 'a', label: '話す' }]);
      if (top && !R.Input.touchVisible()) R.UIK.prompts(g, [{ btn: 'a', label: '調べる' }, { btn: 'y', label: 'メニュー' }, { btn: 'b', label: 'ダッシュ' }]);
      R.Post.frame(g, {});
    },
  };

  R.Stubs.define('Field', {
    scene,
    async enter(mapId, spawn, o) {
      o = o || {};
      const map = R.DB.maps[mapId];
      if (!map) { R.warn('no map ' + mapId); return; }
      const fade = o.fade == null ? 260 : o.fade;
      const onStack = R.Engine.stack.includes(scene);
      if (onStack && fade) await R.Engine.fadeTo(1, fade / 2);
      if (st.map) R.emit('map:leave', { map: st.map.id });
      const from = st.map ? st.map.id : null;
      let sp = typeof spawn === 'string' ? map.spawns[spawn] : spawn;
      if (!sp) sp = map.spawns[Object.keys(map.spawns)[0]] || { x: 1, y: 1 };
      st.map = map; st.x = sp.x; st.y = sp.y; st.dir = sp.dir || 's'; st.mv = null; st.trail = []; st.npcPos = {}; st.npcHidden = {}; st.cam = null;
      const G = R.Game;
      G.pos = { map: map.id, x: st.x, y: st.y, dir: st.dir };
      G.visited[map.id] = true;
      if (map.kind === 'town') G.lastTown = { map: map.id, spawn: typeof spawn === 'string' ? spawn : Object.keys(map.spawns)[0] };
      if (!onStack) { R.Engine.push(scene); if (fade) { R.Engine.fade.a = 1; } }
      R.Input.touchLayout('field');
      if (map.bgm) R.Audio.bgm(map.bgm, { fade: 600 });
      R.emit('map:enter', { map: map.id, from });
      if (fade) await R.Engine.fadeTo(0, fade / 2);
      if (!o.noAutosave) R.Save.autosave('map');
    },
    get pos() { return { map: st.map ? st.map.id : '', x: st.x, y: st.y, dir: st.dir }; },
    lock(reason) { st.locks[reason || 'x'] = (st.locks[reason || 'x'] || 0) + 1; },
    unlock(reason) { const k = reason || 'x'; if (st.locks[k] > 1) st.locks[k]--; else delete st.locks[k]; },
    locks() { return Object.assign({}, st.locks); },
    npc(id) {
      const n = ((st.map && st.map.npcs) || []).find((q) => q.id === id) || { id, x: 0, y: 0 };
      const pos = () => st.npcPos[id] || (st.npcPos[id] = { x: n.x, y: n.y });
      return {
        async move(path) { for (const [x, y] of path || []) { await R.wait(WALK_MS); const p = pos(); p.x = x; p.y = y; } },
        async face() {},
        async act() { await R.wait(300); },
        async hide() { st.npcHidden[id] = true; },
        async show() { delete st.npcHidden[id]; },
        async setPos(x, y) { const p = pos(); p.x = x; p.y = y; },
      };
    },
    setGuest(g) { st.guest = g; R.Game.guest = g; },
    camera: {
      async focus(x, y, o) { st.cam = { x, y }; await R.wait((o && o.ms) || 0); },
      follow() { st.cam = null; },
    },
    flash() {},
    shake() {},
    hud: {
      toast(text, o) { R.UIK.toast(text, Object.assign({ anchor: 'tr' }, o || {})); },
      refresh() {},
    },
    encounter: {
      suppress(n) { st.suppress = n == null ? 10 : n; },
      ward(n) { st.ward = n == null ? 100 : n; },
    },
    passable,
    warpList() {
      const out = [];
      for (const id of Object.keys((R.Game && R.Game.warps) || {})) {
        const l = R.DB.locations[id];
        if (l && (l.kind === 'town' || l.kind === 'dungeon') && (!l.warp || R.State.check(l.warp))) out.push({ id, name: l.name, region: l.region, kind: l.kind });
      }
      return out;
    },
    warp(locId) { const l = R.DB.locations[locId]; return l ? R.Field.enter(l.map, l.spawn) : Promise.resolve(); },
    escape() { const t = R.Game.lastTown; return t ? R.Field.enter(t.map, t.spawn) : Promise.resolve(); },
  });
})(window.RPG);
