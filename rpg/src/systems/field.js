// Field: the map screen (DESIGN §7.2). One opaque layer that draws tiles,
// objects and y-sorted sprites, moves the party tile by tile (caterpillar),
// runs NPC AI, doors/locks, damage floors, warps, step events, encounters and
// the ship, plus the public R.Field API used by title/menu/events/debug.
//
// Map runtime objects come from R.FieldMap.compile (field_map.js); scripted
// actions (talk, chests, signs, events) run through R.Events (events_runtime.js)
// which serialises them and freezes the field while they run.
(function (R) {
  'use strict';
  const U = R.U;
  const DB = R.DB;
  const TS = 16;

  const WALK = 8, DASH = 4, SAIL = 6, SAIL_DASH = 3, NPC_STEP = 16;
  const TURN_DELAY = 5; // frames a new direction is held before walking (a tap only turns)
  const BUMP_EVERY = 20;
  const BANNER_FRAMES = 130;
  const ANIM_RATE = { sea: 16, water: 16, lava: 24, magma: 24, poison: 24, wall_torch: 8, warp_pad: 8, barrier: 8, seal: 16 };
  const BW = 17, BH = 15; // tile buffer size in cells (covers 256x224 + one partial cell)
  const SPIN = { down: 'left', left: 'up', up: 'right', right: 'down' };

  let L = null; // the FieldLayer
  let M = null; // current map runtime (R.FieldMap)

  const dirTo = (a, b) => (b.x > a.x ? 'right' : b.x < a.x ? 'left' : b.y > a.y ? 'down' : b.y < a.y ? 'up' : null);
  const isDoor = (id) => typeof id === 'string' && id.startsWith('door');
  const leaderName = () => R.State.leader().name;

  // ------------------------------------------------------------ tile art
  let buf = null, bctx = null, bufBase = '', bufPhase = -1, bufAnim = false;
  const artWarned = {};

  function tileGfx(m, id) {
    let g = m.gfx[id];
    if (g !== undefined) return g;
    const G = R.Gfx;
    if (id === 'void' && !G.has('tile:void')) g = null;
    else if (m.theme && G.has('tile:' + m.theme + ':' + id)) g = G.get('tile:' + m.theme + ':' + id);
    else g = G.get('tile:' + id);
    return (m.gfx[id] = g);
  }
  /** canvas | canvas[] | null for a cell */
  function cellGfx(m, x, y) {
    if (!m.inBounds(x, y)) return tileGfx(m, m.outside);
    const i = m.idx(x, y);
    if (m.opened.size && m.opened.has(i)) return tileGfx(m, m.opened.get(i));
    // context-aware art (autotiling): worldTile for the overworld, localTile elsewhere
    const ctxFn = R.Art && (m.isWorld ? R.Art.worldTile : R.Art.localTile);
    if (typeof ctxFn === 'function') {
      let w = m.wcache[i];
      if (w === undefined) {
        try { w = ctxFn(m, x, y) || null; } catch (e) {
          w = null;
          if (!artWarned.ctx) { artWarned.ctx = 1; console.error('R.Art context tile failed', e); }
        }
        m.wcache[i] = w;
      }
      if (w) return w;
    }
    return tileGfx(m, m.tiles[i]);
  }
  /** decor canvas | frames | null at a cell (cached per cell) */
  function decorGfx(m, x, y) {
    const id = m.decorAt(x, y);
    if (!id) return null;
    const i = m.idx(x, y);
    m.dcache = m.dcache || [];
    let g = m.dcache[i];
    if (g === undefined) {
      g = null;
      if (R.Art && typeof R.Art.decorTile === 'function') {
        try { g = R.Art.decorTile(m, x, y) || null; } catch (e) {
          if (!artWarned.decor) { artWarned.decor = 1; console.error('R.Art.decorTile failed', e); }
        }
      }
      if (!g) g = R.Gfx.get('decor:' + id);
      m.dcache[i] = g;
    }
    return g;
  }
  function drawTiles(camX, camY) {
    const ox = Math.floor(camX / TS), oy = Math.floor(camY / TS);
    const base = M.uid + ',' + M.version + ',' + ox + ',' + oy;
    const phase = Math.floor(R.Engine.frame / 8);
    if (base !== bufBase || (bufAnim && phase !== bufPhase)) {
      if (!buf) { buf = R.Gfx.makeCanvas(BW * TS, BH * TS); bctx = buf.getContext('2d'); bctx.imageSmoothingEnabled = false; }
      bctx.fillStyle = '#000';
      bctx.fillRect(0, 0, buf.width, buf.height);
      let anim = false;
      const f = R.Engine.frame;
      for (let j = 0; j < BH; j++) {
        for (let i = 0; i < BW; i++) {
          const x = ox + i, y = oy + j;
          let g = cellGfx(M, x, y);
          if (!g) continue;
          if (Array.isArray(g)) {
            anim = true;
            g = g[Math.floor(f / (ANIM_RATE[M.tileAt(x, y)] || 16)) % g.length];
            if (!g) continue;
          }
          bctx.drawImage(g, i * TS, j * TS);
        }
      }
      // decor layer: second pass so tall props (drawn bottom-aligned, up to 32px)
      // overlap the row above; one extra row below the view for their tops
      if (M.decor) {
        for (let j = 0; j <= BH; j++) {
          for (let i = 0; i < BW; i++) {
            let g = decorGfx(M, ox + i, oy + j);
            if (!g) continue;
            if (Array.isArray(g)) {
              anim = true;
              const dd = R.DB.decor[M.decorAt(ox + i, oy + j)];
              g = g[Math.floor(f / ((dd && dd.animRate) || 12)) % g.length];
              if (!g) continue;
            }
            bctx.drawImage(g, i * TS + ((TS - g.width) >> 1), j * TS + TS - g.height);
          }
        }
      }
      bufBase = base; bufPhase = phase; bufAnim = anim;
    }
    R.Gfx.draw(buf, ox * TS - camX, oy * TS - camY);
  }
  /** pick a frame from a sprite sheet {down:[..],..} / array / canvas */
  function sheetFrame(g, dir, f) {
    if (!g) return null;
    if (g.getContext || g.width) return g;
    if (Array.isArray(g)) return g[f % g.length] || g[0];
    const a = g[dir] || g.down || g[Object.keys(g)[0]];
    if (Array.isArray(a)) return a[f % a.length] || a[0];
    return a || null;
  }

  // ------------------------------------------------------------ the layer
  class FieldLayer extends R.Layer {
    constructor() {
      super();
      this.opaque = true;
      this.P = [0, 1, 2].map(() => ({ x: 0, y: 0, dir: 'down' })); // P[0] = leader (tile coords)
      this.mv = null; // party move {t,dur,from,kind,scripted,resolve}
      this.arrived = null; // kind of the move that just completed (processed in update)
      this.locks = 0; // >0 while warping / processing a step / in battle
      this.walking = false; // walked last frame (no turn delay)
      this.turnT = 0;
      this.bumpT = 0;
      this.clock = 0; // walk animation clock
      this.lift = 0; // teleport lift (px, negative = up)
      this.liftAnim = null;
      this.banner = null;
      this.encCount = 20;
      this.spawnName = null;
      this.heldBlock = null;
      this._fm = null; this._fmT = -99;
    }

    // ------------------------------------------------------------ helpers
    get lead() { return this.P[0]; }
    place(x, y, dir) {
      for (const p of this.P) { p.x = x; p.y = y; if (dir) p.dir = dir; }
      this.mv = null; this.arrived = null; this.walking = false; this.turnT = 0;
    }
    savePos() {
      const p = this.P[0];
      R.Game.pos = { map: M.id, x: p.x, y: p.y, dir: p.dir, spawn: this.spawnName };
    }
    resetEnc() { this.encCount = M.encRate * U.rf(0.6, 1.4); }
    /** party-wide field mods: strongest encounterPct, max walkHeal, any noFloorDamage/treasureSense */
    fieldMods() {
      if (this._fm && R.Engine.frame - this._fmT < 20) return this._fm;
      const out = { encounterPct: 0, walkHeal: 0, noFloorDamage: false, treasureSense: false };
      for (const c of R.State.alive()) {
        let m;
        try { m = R.Rules.mods(c); } catch (e) { continue; }
        const e = m.encounterPct || 0, cur = out.encounterPct;
        if (Math.abs(e) > Math.abs(cur) || (Math.abs(e) === Math.abs(cur) && e < cur)) out.encounterPct = e;
        out.walkHeal = Math.max(out.walkHeal, m.walkHeal || 0);
        if (m.noFloorDamage) out.noFloorDamage = true;
        if (m.treasureSense) out.treasureSense = true;
      }
      this._fm = out; this._fmT = R.Engine.frame;
      return out;
    }
    /** order of drawn members: leader (first living) then the others in party order */
    members() {
      const party = R.Game.party, lead = R.State.leader();
      return [lead].concat(party.filter((c) => c !== lead)).slice(0, 3);
    }
    renderPos(i) {
      const p = this.P[i], mv = this.mv;
      if (!mv) return { x: p.x * TS, y: p.y * TS };
      const f = mv.from[i], k = mv.t / mv.dur;
      return { x: Math.round((f.x + (p.x - f.x) * k) * TS), y: Math.round((f.y + (p.y - f.y) * k) * TS) };
    }
    camera() {
      const lp = this.renderPos(0);
      let cx = lp.x + 8 - R.W / 2, cy = lp.y + 8 - R.H / 2;
      const mw = M.w * TS, mh = M.h * TS;
      cx = mw <= R.W ? Math.floor((mw - R.W) / 2) : U.clamp(cx, 0, mw - R.W);
      cy = mh <= R.H ? Math.floor((mh - R.H) / 2) : U.clamp(cy, 0, mh - R.H);
      return { x: cx, y: cy };
    }
    runLocked(fn) {
      this.locks++;
      this.walking = false;
      return Promise.resolve().then(fn).catch((e) => R.Engine.reportError(e)).finally(() => { this.locks = Math.max(0, this.locks - 1); });
    }
    liftTo(to, frames) {
      return new Promise((res) => { this.liftAnim = { from: this.lift, to, t: 0, dur: Math.max(1, frames), resolve: res }; });
    }

    // ------------------------------------------------------------ movement
    startMove(d, nx, ny, kind, opts) {
      const o = opts || {};
      const dash = !!R.Settings.alwaysDash !== !!R.Input.down('dash');
      const dur = o.dur || (kind === 'sail' ? (dash ? SAIL_DASH : SAIL) : (dash ? DASH : WALK));
      const from = this.P.map((p) => ({ x: p.x, y: p.y }));
      if (kind === 'sail') {
        for (const p of this.P) { p.x = nx; p.y = ny; p.dir = d; }
        R.Game.ship = { map: M.id, x: nx, y: ny, dir: d };
      } else {
        for (let i = this.P.length - 1; i > 0; i--) {
          const a = this.P[i], b = this.P[i - 1];
          a.dir = dirTo(a, b) || a.dir;
          a.x = b.x; a.y = b.y;
        }
        this.P[0].x = nx; this.P[0].y = ny; this.P[0].dir = d;
        if (kind === 'land') { R.Game.onShip = false; R.bgm(M.bgm); }
      }
      this.mv = { t: 0, dur, from, kind, scripted: !!o.scripted, resolve: o.resolve || null };
    }
    bump() {
      if (this.bumpT <= 0) { R.sfx('bump'); this.bumpT = BUMP_EVERY; }
      return false;
    }
    /** try to step the leader in direction d; true if a move/warp started */
    tryMove(d) {
      const p = this.P[0];
      const nx = p.x + U.DX[d], ny = p.y + U.DY[d];
      p.dir = d;
      const g = R.Game;
      if (g.onShip) {
        if (g.ship) g.ship.dir = d;
        if (!M.inBounds(nx, ny) || M.npcAt(nx, ny)) return this.bump();
        if (M.sailable(nx, ny)) { this.startMove(d, nx, ny, 'sail'); return true; }
        if (M.walkable(nx, ny) && !M.chestAt(nx, ny) && !M.tile(nx, ny).lock) { this.startMove(d, nx, ny, 'land'); return true; }
        return this.bump();
      }
      if (!M.inBounds(nx, ny)) {
        const ex = M.exitFor(d);
        if (!ex) return this.bump();
        this.runLocked(() => Field.warp(ex.to, ex.spawn, { dir: ex.dir || d }));
        return true;
      }
      const sh = g.ship;
      if (sh && sh.map === M.id && sh.x === nx && sh.y === ny) { this.startMove(d, nx, ny, 'board'); return true; }
      if (!M.walkable(nx, ny) || M.npcAt(nx, ny) || M.chestAt(nx, ny)) return this.bump();
      const id = M.tileAt(nx, ny), t = M.tile(nx, ny);
      const i = M.idx(nx, ny);
      if (t.lock && !M.opened.has(i)) {
        if (!R.State.hasItem(t.lock)) {
          this.heldBlock = d; // don't repeat the message while the direction stays held
          this.runLocked(() => R.Events.run(async (ev) => { R.sfx('locked'); await ev.say('かぎが かかっている。'); }, { self: 'lock' }));
          return false;
        }
      }
      if (isDoor(id) && !M.opened.has(i)) { R.sfx('door'); openDoor(i, nx, ny, d); }
      this.startMove(d, nx, ny, 'walk');
      return true;
    }
    /** scripted single step (events): no triggers, ignores collisions */
    stepScripted(d, dur) {
      return new Promise((res) => {
        const p = this.P[0];
        this.startMove(d, p.x + U.DX[d], p.y + U.DY[d], R.Game.onShip ? 'sail' : 'walk', { scripted: true, resolve: res, dur: dur || WALK });
      });
    }

    // ------------------------------------------------------------ arrival
    /** sync part of arriving on a tile; returns an async task when something must happen */
    onArrive(kind) {
      const g = R.Game;
      const p = this.P[0];
      g.steps = (g.steps || 0) + 1;
      this._fm = null;
      if (kind === 'board') {
        g.onShip = true;
        g.ship = { map: M.id, x: p.x, y: p.y, dir: p.dir };
        this.place(p.x, p.y, p.dir);
        R.sfx('ship');
        R.bgm('sea');
      }
      this.savePos();
      R.emit('step', M.id, p.x, p.y);
      const tasks = [];
      const t = M.tile(p.x, p.y);
      if (!g.onShip) {
        const fm = this.fieldMods();
        const fallen = [];
        if (t.damage > 0 && !fm.noFloorDamage) {
          for (const c of R.State.alive()) { c.hp = Math.max(0, c.hp - t.damage); if (c.hp <= 0) { c.status = {}; fallen.push(c); } }
          R.Engine.flashScreen('#ff2010', 8);
          R.sfx('step_damage');
        }
        let poisoned = false;
        for (const c of R.State.alive()) {
          if (c.status && c.status.poison) { poisoned = true; if (c.hp > 1) c.hp--; }
        }
        if (poisoned && !(t.damage > 0 && !fm.noFloorDamage)) R.Engine.flashScreen('#9020c0', 5);
        if (fm.walkHeal > 0) {
          for (const c of R.State.alive()) c.hp = Math.min(R.Rules.stats(c).hp, c.hp + fm.walkHeal);
        }
        if (!R.State.alive().length) return () => Field.gameOver();
        if (fallen.length) {
          tasks.push(() => R.Events.run(async (ev) => {
            R.sfx('death');
            for (const c of fallen) await ev.say(c.name + 'は ちからつきた……。');
          }, { self: 'floor' }));
        }
      }
      if (g.repelSteps > 0) {
        g.repelSteps--;
        if (g.repelSteps === 0) {
          tasks.push(() => R.Events.run(async (ev) => { await ev.say('まよけの こうかが きれた。'); }, { self: 'repel' }));
        }
      }
      // step events, then warps, then encounters
      const evs = M.eventsAt(p.x, p.y, 'step');
      if (evs.length) {
        const e = evs[0];
        tasks.push(() => R.Events.run(e.id, { self: e.id, trigger: 'step', once: e.once, x: p.x, y: p.y }));
        return seq(tasks);
      }
      const w = M.warpAt(p.x, p.y);
      if (w) { tasks.push(() => this.useWarp(w)); return seq(tasks); }
      if (!tasks.length) {
        const zone = this.encounterStep(t);
        if (zone) return () => Field.encounter(zone);
      }
      return tasks.length ? seq(tasks) : null;
    }
    /** advance the encounter counter; returns a zone id when a battle starts */
    encounterStep(t) {
      const g = R.Game;
      if (Field.noEncounter || g.repelSteps > 0) return null;
      const p = this.P[0];
      const zone = M.zoneAt(p.x, p.y);
      if (!zone) return null;
      const rate = t.enc == null ? 1 : t.enc;
      if (!(rate > 0)) return null;
      const mult = Math.max(0, 1 + (this.fieldMods().encounterPct || 0) / 100);
      this.encCount -= rate * mult;
      if (this.encCount > 0) return null;
      this.resetEnc();
      if (!DB.encounters[zone]) { R.FieldMap.warn(M.id, 'unknown encounter zone ' + zone); return null; }
      if (!R.Battle || !R.Battle.start) return null;
      return zone;
    }
    async useWarp(w) {
      const id = M.tileAt(this.P[0].x, this.P[0].y);
      if (w.sfx) R.sfx(w.sfx);
      else if (id === 'stairs_up' || id === 'stairs_down') R.sfx('stairs');
      else if (id === 'warp_pad') R.sfx('warp');
      await Field.warp(w.to, w.spawn, { dir: w.dir });
    }

    // ------------------------------------------------------------ A button
    examine() {
      const p = this.P[0], d = p.dir;
      const fx = p.x + U.DX[d], fy = p.y + U.DY[d];
      let npc = M.npcAt(fx, fy);
      if (!npc && M.counterAt(fx, fy)) npc = M.npcAt(fx + U.DX[d], fy + U.DY[d]);
      if (npc) return this.runLocked(() => this.talk(npc));
      const chest = M.chestAt(fx, fy);
      if (chest && !R.Game.chests[chest.id]) return this.runLocked(() => openChest(chest));
      const sign = M.signAt(fx, fy);
      if (sign) return this.runLocked(() => R.Events.run(async (ev) => { await ev.say(sign.text); }, { self: 'sign' }));
      for (const [x, y] of [[fx, fy], [p.x, p.y]]) {
        const evs = M.eventsAt(x, y, 'examine');
        if (evs.length) {
          const e = evs[0];
          return this.runLocked(() => R.Events.run(e.id, { self: e.id, trigger: 'examine', once: e.once, x, y }));
        }
        const h = M.hiddenAt(x, y);
        if (h) return this.runLocked(() => findHidden(h, x === p.x && y === p.y));
      }
      return null;
    }
    talk(npc) {
      if (npc.mv) { npc.mv = null; }
      if (!npc.sprite.startsWith('mon:') && !npc.fixedDir) npc.dir = U.opposite(this.P[0].dir);
      npc.ai = 90;
      return R.Events.talk(npc);
    }
    openMenu() {
      // no field lock: the menu sits on top (so update() pauses) and may call R.Field.* itself
      if (!R.Menu || !R.Menu.open) return;
      try { Promise.resolve(R.Menu.open()).catch((e) => R.Engine.reportError(e)); } catch (e) { R.Engine.reportError(e); }
    }

    // ------------------------------------------------------------ frame
    update() {
      if (!M || !R.Game) return;
      if (this.bumpT > 0) this.bumpT--;
      if (this.locks > 0 || R.Events.busy()) { this.walking = false; return; }
      if (this.mv) return;
      if (this.arrived) {
        const k = this.arrived;
        this.arrived = null;
        const task = this.onArrive(k);
        if (task) { this.runLocked(task); return; }
      }
      const In = R.Input;
      if (In.pressed('b')) { this.walking = false; this.openMenu(); return; }
      if (In.pressed('a')) { this.walking = false; this.examine(); return; }
      const d = In.dir();
      if (!d) { this.walking = false; this.turnT = 0; this.bumpT = 0; this.heldBlock = null; return; }
      if (d === this.heldBlock) return;
      this.heldBlock = null;
      const p = this.P[0];
      if (!this.walking && d !== p.dir) {
        p.dir = d;
        if (R.Game.onShip && R.Game.ship) R.Game.ship.dir = d;
        this.turnT = TURN_DELAY;
        this.savePos();
        return;
      }
      if (this.turnT > 0) { this.turnT--; return; }
      this.walking = this.tryMove(d);
    }
    tick() {
      const g = R.Game;
      if (!g || !M) return;
      g.playFrames = (g.playFrames || 0) + 1;
      const mv = this.mv;
      if (mv) {
        mv.t++;
        this.clock += 8 / mv.dur;
        if (mv.t >= mv.dur) {
          this.mv = null;
          if (mv.scripted) { this.savePos(); if (mv.resolve) mv.resolve(); }
          else this.arrived = mv.kind;
        }
      } else this.clock += 0.5;
      this.tickNpcs(R.Engine.top() === this && this.locks === 0 && !R.Events.busy());
      const la = this.liftAnim;
      if (la) {
        la.t++;
        const k = la.t / la.dur;
        this.lift = la.from + (la.to - la.from) * (la.to < la.from ? k * k : 1 - (1 - k) * (1 - k));
        if (la.t >= la.dur) { this.lift = la.to; this.liftAnim = null; la.resolve(); }
      }
      if (this.banner && ++this.banner.t >= BANNER_FRAMES) this.banner = null;
    }
    tickNpcs(ai) {
      for (const n of M.npcs) {
        if (!n.present) { if (n.path) finishPath(n); continue; }
        if (n.mv) {
          if (++n.mv.t >= n.mv.dur) { n.mv = null; if (n.path) nextPathStep(n); }
          continue;
        }
        if (n.path) { nextPathStep(n); continue; }
        if (!ai) continue;
        if (n.move === 'wander') this.wander(n);
        else if (n.move === 'spin') {
          if (n.ai == null) n.ai = U.ri(20, 60);
          if (--n.ai <= 0) { n.ai = U.ri(24, 56); n.dir = SPIN[n.dir] || 'down'; }
        }
      }
    }
    wander(n) {
      if (n.ai == null) n.ai = U.ri(30, 150);
      if (--n.ai > 0) return;
      n.ai = U.ri(50, 170);
      const d = U.pick(U.DIRS);
      n.dir = d;
      const nx = n.x + U.DX[d], ny = n.y + U.DY[d];
      if (Math.abs(nx - n.homeX) > 2 || Math.abs(ny - n.homeY) > 2) return;
      if (!this.npcCanEnter(nx, ny, n)) return;
      n.mv = { fx: n.x, fy: n.y, t: 0, dur: NPC_STEP };
      n.x = nx; n.y = ny;
    }
    npcCanEnter(x, y, n) {
      if (!M.walkable(x, y)) return false;
      const id = M.tileAt(x, y), t = M.tile(x, y);
      if (t.counter || t.damage || t.warpIcon || isDoor(id) || id.startsWith('stairs') || id === 'warp_pad') return false;
      if (M.warpAt(x, y) || M.chestAt(x, y) || M.eventIdx.has(M.idx(x, y)) || M.signAt(x, y)) return false;
      if (M.npcAt(x, y, n)) return false;
      for (const p of this.P) if (p.x === x && p.y === y) return false;
      if (this.mv) for (const f of this.mv.from) if (f.x === x && f.y === y) return false;
      const sh = R.Game.ship;
      if (sh && sh.map === M.id && sh.x === x && sh.y === y) return false;
      return true;
    }

    // ------------------------------------------------------------ drawing
    draw() {
      const G = R.Gfx;
      if (!M || !R.Game) { G.clear('#000'); return; }
      const cam = this.camera();
      drawTiles(cam.x, cam.y);
      this.drawObjects(cam);
      this.drawSprites(cam);
      if (this.banner) this.drawBanner();
      if (Field.showCoords) {
        const p = this.P[0];
        G.text(M.id + ' ' + p.x + ',' + p.y + (R.Game.onShip ? ' ship' : ''), 3, R.H - 11, { size: 8, color: G.C.yellow, shadow: true });
      }
    }
    inView(cam, px, py, pad) {
      return px > cam.x - pad && px < cam.x + R.W + pad && py > cam.y - pad && py < cam.y + R.H + pad;
    }
    drawObjects(cam) {
      const G = R.Gfx;
      if (M.chests.length) {
        const g = G.get('obj:chest');
        for (const c of M.chests) {
          if (!c.present || !this.inView(cam, c.x * TS, c.y * TS, 16)) continue;
          const img = Array.isArray(g) ? g[R.Game.chests[c.id] ? 1 : 0] || g[0] : g;
          G.draw(img, c.x * TS - cam.x, c.y * TS - cam.y);
        }
      }
      if (M.hidden.length && this.fieldMods().treasureSense) {
        const g = G.get('obj:sparkle');
        const f = Math.floor(R.Engine.frame / 8);
        for (const h of M.hidden) {
          if (R.Game.chests[h.id] || !R.State.check(h.cond) || !this.inView(cam, h.x * TS, h.y * TS, 16)) continue;
          const img = Array.isArray(g) ? g[f % g.length] : g;
          G.draw(img, h.x * TS - cam.x, h.y * TS - cam.y);
        }
      }
    }
    drawSprites(cam) {
      const G = R.Gfx;
      const list = [];
      const af = Math.floor(R.Engine.frame / 16);
      for (const n of M.npcs) {
        if (!n.present) continue;
        let x = n.x * TS, y = n.y * TS;
        if (n.mv) {
          const k = n.mv.t / n.mv.dur;
          x = Math.round((n.mv.fx + (n.x - n.mv.fx) * k) * TS);
          y = Math.round((n.mv.fy + (n.y - n.mv.fy) * k) * TS);
        }
        if (!this.inView(cam, x, y, 48)) continue;
        list.push({ y, pri: 1, x, npc: n });
      }
      const g = R.Game;
      const ship = g.ship && g.ship.map === M.id ? g.ship : null;
      if (ship) {
        const pos = g.onShip ? this.renderPos(0) : { x: ship.x * TS, y: ship.y * TS };
        list.push({ y: pos.y, pri: 0, x: pos.x, ship });
      }
      if (!g.onShip) {
        const mem = this.members();
        for (let i = mem.length - 1; i >= 0; i--) {
          const pos = this.renderPos(i);
          list.push({ y: pos.y, pri: 5 - i, x: pos.x, member: mem[i], i });
        }
      }
      list.sort((a, b) => a.y - b.y || a.pri - b.pri);
      const pf = Math.floor(this.clock / 8);
      for (const s of list) {
        const sx = s.x - cam.x, sy = s.y - cam.y;
        if (s.npc) {
          const n = s.npc;
          const spr = G.get(n.sprite);
          const moving = !!n.mv;
          const img = n.sprite.startsWith('mon:') ? (Array.isArray(spr) ? spr[af % spr.length] : spr) : sheetFrame(spr, n.dir, moving ? Math.floor(n.mv.t / 8) + n.seq : af + n.seq);
          if (img) G.draw(img, sx + 8 - (img.width >> 1), sy + TS - img.height);
        } else if (s.ship) {
          const img = sheetFrame(G.get('obj:ship'), s.ship.dir || 'down', af);
          if (img) {
            const bob = g.onShip && Math.floor(R.Engine.frame / 24) % 2 ? 1 : 0;
            G.draw(img, sx + 8 - (img.width >> 1), sy + TS - img.height + Math.min(4, (img.height - TS) >> 2) + bob);
          }
        } else {
          const c = s.member;
          const img = sheetFrame(G.get('party:' + c.id + ':' + c.job), this.P[s.i].dir, pf);
          if (img) G.draw(img, sx + 8 - (img.width >> 1), sy + TS - img.height + Math.round(this.lift), c.hp > 0 ? null : { alpha: 0.5 });
        }
      }
    }
    drawBanner() {
      const G = R.Gfx, b = this.banner;
      const a = b.t < 10 ? b.t / 10 : BANNER_FRAMES - b.t < 16 ? (BANNER_FRAMES - b.t) / 16 : 1;
      const w = Math.ceil(G.textWidth(b.text)) + 28;
      const x = (R.W - w) >> 1, y = 10;
      const c = G.ctx;
      c.globalAlpha = a;
      G.window(x, y, w, 26);
      G.text(b.text, R.W / 2, y + 7, { align: 'center' });
      c.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------ scripted NPC walks
  function parsePath(path) {
    if (Array.isArray(path)) return path.filter((d) => U.DX[d] !== undefined);
    const out = [];
    const MAP = { U: 'up', D: 'down', L: 'left', R: 'right' };
    const s = String(path || '').toUpperCase();
    for (let i = 0; i < s.length; i++) {
      const d = MAP[s[i]];
      if (!d) continue;
      let n = '';
      while (i + 1 < s.length && s[i + 1] >= '0' && s[i + 1] <= '9') n += s[++i];
      for (let k = 0; k < (n ? +n : 1); k++) out.push(d);
    }
    return out;
  }
  function nextPathStep(n) {
    if (!n.path || !n.path.length) return finishPath(n);
    const d = n.path.shift();
    n.dir = d;
    n.mv = { fx: n.x, fy: n.y, t: 0, dur: n.pathDur || NPC_STEP };
    n.x += U.DX[d]; n.y += U.DY[d];
  }
  function finishPath(n) {
    n.path = null;
    n.homeX = n.x; n.homeY = n.y;
    const r = n.pathResolve;
    n.pathResolve = null;
    if (r) r();
  }

  // ------------------------------------------------------------ chests & hidden items
  function openChest(c) {
    return R.Events.run(async (ev) => {
      const g = R.Game;
      const name = leaderName();
      const it = c.item && DB.items[c.item];
      if (it && R.State.count(c.item) + c.n > 99) {
        R.sfx('buzzer');
        await ev.say('たからばこの なかには ' + it.name + 'が はいっている。\nしかし もう これいじょう もてない！');
        return;
      }
      R.sfx('chest');
      if (c.troop) {
        // mimic: the box stays shut unless the monster is beaten
        await ev.wait(10);
        await ev.say('なんと たからばこは まものだった！');
        if ((await ev.battle(c.troop)) !== 'win') return;
      }
      g.chests[c.id] = true;
      await ev.wait(10);
      if (c.gold) {
        R.State.addGold(c.gold);
        R.sfx('gold');
        await ev.say(name + 'は たからばこを あけた！\n' + c.gold + 'ゴールドを てにいれた！');
      } else if (it) {
        R.State.addItem(c.item, c.n);
        await ev.gotItem(name + 'は たからばこを あけた！\n' + it.name + 'を ' + (c.n > 1 ? c.n + 'こ ' : '') + 'てにいれた！', it.type === 'key' ? 'keyitem' : 'item');
      } else {
        await ev.say(name + 'は たからばこを あけた！\nしかし からっぽだった！');
      }
    }, { self: c.id, chest: c });
  }
  function findHidden(h, underfoot) {
    return R.Events.run(async (ev) => {
      const name = leaderName();
      const look = name + 'は ' + (underfoot ? 'あしもと' : 'あたり') + 'を しらべた。\n';
      if (h.gold) {
        R.Game.chests[h.id] = true;
        R.State.addGold(h.gold);
        R.sfx('gold');
        await ev.say(look + 'なんと ' + h.gold + 'ゴールドを みつけた！');
        return;
      }
      const it = DB.items[h.item];
      if (!it) { R.Game.chests[h.id] = true; return; }
      if (R.State.count(h.item) + h.n > 99) {
        await ev.say(look + 'なんと ' + it.name + 'を みつけた！\nしかし もう これいじょう もてない！');
        return;
      }
      R.Game.chests[h.id] = true;
      R.State.addItem(h.item, h.n);
      await ev.gotItem(look + 'なんと ' + it.name + 'を ' + (h.n > 1 ? h.n + 'こ ' : '') + 'みつけた！', it.type === 'key' ? 'keyitem' : 'item');
    }, { self: h.id, hidden: h });
  }

  /** an opened door is drawn as the floor beyond it (else the floor we came from) */
  function openDoor(i, x, y, d) {
    const bx = x + U.DX[d], by = y + U.DY[d], fx = x - U.DX[d], fy = y - U.DY[d];
    const ok = (tx, ty) => M.inBounds(tx, ty) && M.walkable(tx, ty) && !isDoor(M.tileAt(tx, ty)) && !M.tile(tx, ty).warpIcon;
    M.opened.set(i, ok(bx, by) ? M.tileAt(bx, by) : ok(fx, fy) ? M.tileAt(fx, fy) : 'floor');
    M.version++;
  }
  function seq(tasks) {
    return async () => { for (const t of tasks) await t(); };
  }

  // ------------------------------------------------------------ map loading
  function ensureLayer(fresh) {
    if (fresh && L) { R.Engine.remove(L); L = null; }
    if (!L) L = new FieldLayer();
    if (!R.Engine.layers.includes(L)) {
      R.Engine.layers.unshift(L); // the field always sits at the bottom of the stack
      L.closed = false;
      L.onPush();
    }
    return L;
  }
  function unlock(lay) { lay.locks = Math.max(0, lay.locks - 1); }
  function flushPaths(m) {
    if (m) for (const n of m.npcs) if (n.path || n.pathResolve) { n.path = []; finishPath(n); }
  }
  /** load a map and place the party (no fades, no events) */
  function load(mapId, spawn, dir) {
    const m = R.FieldMap.compile(mapId);
    if (!m) return false;
    flushPaths(M);
    if (L.mv && L.mv.resolve) L.mv.resolve();
    M = m;
    let s = m.spawn(spawn == null ? 'entrance' : spawn);
    if (!m.inBounds(s.x, s.y)) { R.FieldMap.warn(m.id, 'position ' + s.x + ',' + s.y + ' is outside the map'); s = m.spawn('entrance'); }
    L.place(s.x, s.y, dir || s.dir || L.P[0].dir);
    L.spawnName = typeof spawn === 'string' ? spawn : null;
    const g = R.Game;
    const sh = g.ship;
    g.onShip = !!(sh && sh.map === m.id && sh.x === s.x && sh.y === s.y && !m.walkable(s.x, s.y));
    if (g.onShip) sh.dir = L.P[0].dir;
    if (m.location) g.visited[m.location] = true;
    L.resetEnc();
    L._fm = null;
    L.banner = null;
    R.bgm(g.onShip ? 'sea' : m.bgm);
    L.savePos();
    R.emit('mapload', m.id);
    return true;
  }
  /** after the screen is visible: banner + onEnter event (queued, never awaited) */
  function afterEnter(prev) {
    if (!M) return;
    if (M.name && !M.isWorld && (!prev || prev.name !== M.name)) L.banner = { text: M.name, t: 0 };
    if (M.onEnter) R.Events.run(M.onEnter, { trigger: 'enter', self: M.id, onlyOnMap: M.id, defer: true });
  }

  // ------------------------------------------------------------ public API
  const Field = (R.Field = {
    noEncounter: false,
    showCoords: false,
    WALK, DASH,
    get map() { return M; },
    get layer() { return L; },

    /** entry point after title / new game */
    async start(mapId, spawn) {
      if (!R.Game) R.State.newGame();
      R.Events.reset();
      const lay = ensureLayer(true);
      lay.locks++;
      try {
        R.Engine.fade(1, 0);
        const st = R.State.START;
        if (!load(mapId || st.map, spawn != null ? spawn : mapId ? 'entrance' : st.spawn)) load(st.map, st.spawn);
        await R.Engine.fadeIn(24);
      } finally { unlock(lay); }
      afterEnter(null);
    },
    /** continue from R.Game.pos (after loading a save) */
    async resume() {
      R.Events.reset();
      const lay = ensureLayer(true);
      const pos = R.Game.pos || {};
      lay.locks++;
      try {
        R.Engine.fade(1, 0);
        const st = R.State.START;
        let ok = false;
        if (pos.map && DB.maps[pos.map]) ok = load(pos.map, pos.x != null ? { x: pos.x, y: pos.y, dir: pos.dir } : pos.spawn, pos.dir);
        if (!ok) load(st.map, st.spawn);
        await R.Engine.fadeIn(24);
      } finally { unlock(lay); }
      afterEnter(null);
    },
    /** warp(map, spawnName | {x,y}, {dir, fade=true}) */
    async warp(mapId, spawn, opts) {
      const o = opts || {};
      if (!DB.maps[mapId]) { R.warn('warp: unknown map', mapId); return false; }
      const lay = ensureLayer();
      const prev = M;
      lay.locks++;
      try {
        const fade = o.fade !== false;
        if (fade) await R.Engine.fadeOut(o.frames || 12);
        load(mapId, spawn, o.dir);
        if (fade) await R.Engine.fadeIn(o.frames || 12);
      } finally { unlock(lay); }
      afterEnter(prev);
      return true;
    },
    /** fly to a visited location (ability / wing): R.DB.locations[locId] */
    async teleport(locId) {
      const loc = DB.locations[locId];
      if (!loc) { R.warn('teleport: unknown location', locId); return false; }
      const mapId = loc.map || R.FieldMap.findWorld(loc.spawn);
      if (!DB.maps[mapId]) { R.warn('teleport: unknown map', mapId); return false; }
      const lay = ensureLayer();
      const prev = M;
      lay.locks++;
      try {
        const g = R.Game;
        if (g.onShip && M) { g.onShip = false; lay.place(lay.P[0].x, lay.P[0].y, 'down'); }
        R.sfx('teleport');
        await lay.liftTo(-(R.H + 40), 26);
        await R.Engine.fadeOut(10);
        if (g.ship && loc.dock) {
          const d = R.FieldMap.spawnPos(loc.dock, mapId);
          if (d) g.ship = { map: mapId, x: d.x, y: d.y, dir: g.ship.dir || 'down' };
        }
        load(mapId, loc.spawn, 'down');
        lay.lift = -(R.H + 40);
        await R.Engine.fadeIn(10);
        await lay.liftTo(0, 22);
      } finally { lay.lift = 0; unlock(lay); }
      afterEnter(prev);
      return true;
    },
    /** visited teleport targets [{id,name}] in R.DB.locations order */
    teleportList() {
      return Object.keys(DB.locations).filter((id) => R.Game.visited[id]).map((id) => ({ id, name: DB.locations[id].name }));
    },
    canExit() { return !!(M && M.escape && M.escape.to && DB.maps[M.escape.to]); },
    /** teleport works outdoors/in towns, not inside dungeons (map.noTeleport overrides) */
    canTeleport() {
      if (!M) return false;
      if (M.def.noTeleport != null) return !M.def.noTeleport;
      return M.type !== 'dungeon';
    },
    /** leave the dungeon (ability / escape_rope) */
    async exitDungeon() {
      if (!Field.canExit()) return false;
      const lay = ensureLayer();
      const e = M.escape;
      lay.locks++;
      try {
        R.sfx('warp');
        R.Engine.flashScreen('#ffffff', 14);
        await lay.liftTo(-12, 8);
        await lay.liftTo(0, 6);
      } finally { unlock(lay); }
      return Field.warp(e.to, e.spawn, { dir: e.dir || 'down', frames: 16 });
    },
    repel(steps) { R.Game.repelSteps = Math.max(R.Game.repelSteps || 0, steps | 0); },
    setRespawnHere() {
      if (!M || !L) return;
      const p = L.P[0];
      R.Game.respawn = { map: M.id, x: p.x, y: p.y, dir: p.dir };
    },
    /** warp to R.Game.respawn (after a wipe) */
    respawn() {
      const r = R.Game.respawn || { map: R.State.START.map, spawn: R.State.START.spawn };
      const map = DB.maps[r.map] ? r.map : R.State.START.map;
      R.Game.onShip = false;
      return Field.warp(map, r.x != null ? { x: r.x, y: r.y, dir: r.dir } : r.spawn, { dir: r.dir || 'down' });
    },
    /** re-evaluate NPC conds / tilePatches (after flags change) */
    refresh() { if (M) M.refresh(); },
    isBusy() { return !!L && (L.locks > 0 || !!L.mv) || R.Events.busy(); },

    /** battle backdrop for the current position */
    battleBg(zone) {
      if (!M) return 'grass';
      const enc = zone && DB.encounters[zone];
      if (M.isWorld) {
        const p = L.P[0];
        return M.tile(p.x, p.y).bbg || (enc && enc.bg) || 'grass';
      }
      if (M.bbg) return M.bbg;
      const th = M.theme && DB.themes[M.theme];
      return (th && th.bbg) || (enc && enc.bg) || 'cave';
    },
    /** random encounter in zone (default: the current position's zone) */
    async encounter(zone) {
      zone = zone || (M && L && M.zoneAt(L.P[0].x, L.P[0].y));
      if (!zone || !R.Battle || !R.Battle.start) return null;
      const lay = ensureLayer();
      lay.locks++;
      let res;
      try {
        res = await R.Battle.start({ zone, bg: Field.battleBg(zone) });
        if (res === 'lose') await Field.gameOver();
      } finally { unlock(lay); }
      return res;
    },
    /** wipe: game-over screen (menu owner) or plain recover + respawn */
    async gameOver() {
      if (R.GameOver && R.GameOver.run) await R.GameOver.run();
      else { R.State.wipeRecover(); await Field.respawn(); }
    },

    // ---- scripting hooks (events_runtime / debug)
    npc(id) { return M ? M.npc(id) : null; },
    walkNpc(n, path, dur) {
      const steps = parsePath(path);
      if (!n || !steps.length) return Promise.resolve();
      return new Promise((res) => {
        if (n.pathResolve) { const r = n.pathResolve; n.pathResolve = null; r(); }
        n.path = steps; n.pathDur = dur || NPC_STEP; n.pathResolve = res;
        if (!n.mv) nextPathStep(n);
      });
    },
    async walkParty(path, dur) {
      if (!L || !M) return;
      for (const d of parsePath(path)) await L.stepScripted(d, dur);
    },
    facePlayer(dir) {
      if (!L || !U.DX.hasOwnProperty(dir)) return;
      L.P[0].dir = dir;
      if (R.Game.onShip && R.Game.ship) R.Game.ship.dir = dir;
      if (M) L.savePos();
    },
    setPlayerPos(x, y, dir) {
      if (!L || !M) return;
      L.place(x, y, dir || L.P[0].dir);
      L.savePos();
    },
    /** leader tile position {x,y,dir} */
    pos() { return L ? Object.assign({}, L.P[0]) : null; },
    /** the tile in front of the leader */
    front() {
      if (!L) return null;
      const p = L.P[0];
      return { x: p.x + U.DX[p.dir], y: p.y + U.DY[p.dir] };
    },
    parsePath,
  });
})(window.RPG);
