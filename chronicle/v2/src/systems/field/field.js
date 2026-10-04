// FIELD — フィールドの場面と入口（V2_PLAN §2.5.9・§2.11、MODERN_UI §2.2・§6.2・§7）。本物の R.Field（仮の stub_field.js を置き換える）。
//   R.Field.scene（id 'field'、opaque）・enter(mapId, spawn | {x, y, dir}, {fade, noAutosave}) → Promise・pos・lock/unlock/locks・
//   setGuest・flash・shake・warpList・warp・escape（ほかは collide/move/trail/npc/camera/chunks/layers/dark/hud/minimap）
// 決まり: マスは R.MapUtil。チャンクは R.Hd.schedule、量は R.Hd.track('chunk')。R.Post.frame は draw の最後・HUD の前。
//   ハブの結果 {warp}/{escape}/{title} は閉じた後に動く。on:'enter' のトリガーは入るたび（once で 1 回、flags['tr_<map>_<id>']）。
//   lastTown は K.place。R.Game.steps を数える。戦闘の 'abort' では何もしない（片付けは R.Flow.wipe）。
(function (R) {
  'use strict';
  R.Stubs.claim('Field');   // 名前空間を丸ごと本物にした（仮の関数は中の状態を共有するので混ぜない）
  const F = (R.Field = R.Field || {});
  const S = (F._s = F._s || {});

  const TILE = { near: 40, normal: 32, far: 24 };
  const CHAR_SCALE = { near: 1.4, normal: 1.15, far: 0.9 };
  F.WALK_MS = 250;
  F.DASH_MS = 140;
  F.PLACE_MS = 2400;

  function init() {
    if (S._init) return;
    S._init = true;
    Object.assign(S, {
      map: null, x: 0, y: 0, dir: 's', lv: 0, mv: null, lastEnd: -1e9, phase: 0,
      locks: {}, arriving: false, entering: 0, guest: null, placeT0: -1e9, enterT: 0,
      suppress: 0, ward: 0, push: null, seen: {}, stat: { miss: 0, arrive: 0, emergency: 0 },
    });
    // フラグ・変数・品が変わったら: tilePatches・NPC・物の cond を読み直し、変わったチャンクだけ焼き直す
    const refresh = () => { if (S.map) F._refreshMap(); };
    R.on('flag', refresh); R.on('var', refresh); R.on('item:gain', refresh);
    R.on('lead:add', () => F.hud.refresh()); R.on('lead:pin', () => F.hud.refresh()); R.on('lead:done', () => F.hud.refresh());
    R.on('settings', (e) => { if (e && e.key === 'fieldZoom' && S.map) F.chunks.reset(); });
    R.on('tier', () => { if (S.map) { F._post(); F.chunks.dirtyAll(); } });
  }
  F._init = init;

  F._tile = function () { return TILE[R.Settings.get('fieldZoom')] || 32; };
  F._charScale = function () { return CHAR_SCALE[R.Settings.get('fieldZoom')] || 1.15; };
  F._locked = function () { for (const k in S.locks) return true; return false; };
  /** 一行の先頭の見た目の位置（マス単位、補間つき） */
  F._vis = function (out) {
    out = out || {};
    let px = S.x, py = S.y;
    const m = S.mv;
    if (m) {
      const k = Math.max(0, Math.min(1, (R.Engine.time - m.t0) / m.ms));
      px = m.fx + (m.tx - m.fx) * k; py = m.fy + (m.ty - m.fy) * k;
    }
    out.px = px; out.py = py;
    return out;
  };

  // ---------------------------------------------------------------- 場面
  const scene = {
    id: 'field',
    opaque: true,
    enter() { R.Input.touchLayout('field'); },
    exit() {},
    onLayout() { F.hud.refresh(); },
    tick(dt) {
      // 暗転の間（入る前）: 次のマップの焼きを進める（画面は暗くなっていくだけなので 1 フレーム 12 ms まで）
      if (S.entering && S.pre) F.chunks.preStep(12);
      if (S.map) { F._tickMove(); F._tickNpcs(dt); F.camera._tick(); }
    },
    update() {
      if (!S.map) return;
      const I = R.Input;
      // 暗転の間に押した A（勝利の画面を送る早押しなど）を、明けた瞬間のフィールドが「話す・調べる」に拾わない:
      //   暗い間は押したままの A を飲み込み、明けてから 100 ms（2 フレーム以上）は新しい A も拾わない。重いフレームでも同じ
      if (R.Engine.fade.a > 0.01) { I.consume('a'); S.litAt = null; return; }
      if (S.litAt === null) S.litAt = { t: R.Engine.time, f: R.Engine.frame };
      if (S.litAt && (R.Engine.frame - S.litAt.f < 2 || (!R.Engine.frozen && R.Engine.time - S.litAt.t < 100))) I.consume('a');
      else if (S.litAt) S.litAt = undefined;
      if (S.mv || S.arriving || S.entering || F._locked() || R.Events.busy()) return;
      if (I.pressed('y') || I.pressed('start')) { F._openHub('menu'); return; }
      if (I.pressed('x')) { if (!F.hud.cycleMap()) F._openHub('map', S.map.kind === 'town' ? { town: S.map.id } : undefined); return; }   // ダンジョン: 小地図 → 大きな地図 → 出さない（hud.js）。町: 町の地図（Y・R で世界の地図）。世界: 世界の地図（X・B で閉じる。Y のメニューの「地図」からも）
      if (I.pressed('a')) { F._act(); return; }
      const d = I.dir8();
      if (d.dx || d.dy) {
        const held = I.down('b') || I.down('dash');
        F._step(d.dx, d.dy, R.Settings.get('alwaysDash') ? !held : held);
      } else S.push = null;
    },
    draw(g) { F._draw(g); },
  };
  F.scene = scene;

  F._openHub = function (id, params) {
    F.lock('menu');
    R.Screens.open(id, params).then((r) => {
      F.unlock('menu');
      R.Input.touchLayout('field');
      // ハブの結果（§2.11 SCREEN_RESULTS.menu）: 閉じた後にワープ・脱出・タイトル
      if (r && r.warp) F.warp(r.warp);
      else if (r && r.escape) F.escape();
      else if (r && r.title) R.Flow.title();
      else F.hud.refresh();
    });
  };

  // ---------------------------------------------------------------- 入る
  F.enter = async function (mapId, spawn, o) {
    init();
    o = o || {};
    const map = R.DB.maps[mapId];
    if (!map) { R.warn('Field.enter: no map ' + mapId); return; }
    const fade = o.fade == null ? 260 : o.fade;
    const onStack = R.Engine.stack.includes(scene);
    S.entering++;
    try {
      // 暗くなる間に、行き先の見える範囲を焼き始める（歩いている間に始めていればその続き。§2.10）
      if (onStack && S.map !== map) F.chunks.preload(mapId, spawn);
      if (onStack && fade) await R.Engine.fadeTo(1, fade / 2);
      // 描いた下絵（map.art）は使う時に読む: 暗転の中（場面を積む前）で読み終えるのを待つ（最初の 1 枚からタイルの控えを出さない。上限 4 秒）
      try { const E = R.Terrain && R.Terrain.Env; if (map.art && E && E.awaitMap) S.stat.artWait = await E.awaitMap(map, F._tile(), 4000); } catch (e) { /* 読めなければタイルのまま */ }
      if (S.map) R.emit('map:leave', { map: S.map.id });
      const from = S.map ? S.map.id : null;
      const sp = R.MapUtil.spawn(map, spawn);
      const spDef = typeof spawn === 'string' && map.spawns ? map.spawns[spawn] : spawn;
      S.map = map; S.x = sp.x; S.y = sp.y; S.dir = sp.dir || 's'; S.lv = (spDef && spDef.lv) || 0;
      S.mv = null; S.push = null; S.arriving = false; S.cam = null; S.shakeFx = null; S.flashFx = null;
      S.enterT = R.Engine.time;
      R.MapUtil.invalidate(map.id);
      const G = R.Game;
      if (G) {
        G.pos = { map: map.id, x: S.x, y: S.y, dir: S.dir };
        G.visited[map.id] = true;
        if (map.kind === 'town') G.lastTown = { map: map.id, x: S.x, y: S.y, dir: S.dir };   // K.place（版 2）
        const loc = map.location && R.DB.locations[map.location];
        if (loc && (loc.kind === 'town' || loc.kind === 'dungeon') && loc.map === map.id) G.warps[map.location] = true;   // ワープの一覧（入口のマップに入ったとき）
        if (G.guest && !S.guest) S.guest = G.guest;
      }
      F._initNpcs();
      F._resetTrail();
      F._waylamps(true);
      F._post();
      if (!onStack) { R.Engine.push(scene); if (fade) R.Engine.fade.a = 1; }
      R.Input.touchLayout('field');
      try { if (map.bgm) R.Audio.bgm(map.bgm, { fade: 600 }); } catch (e) { /* 音が無くても止めない */ }
      // 暗転の中で: 素材・物・人の絵を先に焼き、見える範囲のチャンクを焼く（§2.10 マップに入る）
      F.camera._snap();
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (from !== map.id || S.chTile !== F._tile()) F.chunks.reset();   // 同じマップの中の移り（森の出口の入れ替え）は焼いた物を使い続ける
      else { S.stat.adopted = F.chunks.stats().ready; F.chunks.checkGrid(); }   // 焼いた物を使い続けても、フラグで変わったマス（tilePatches・変わるマスの絵）は焼き直す
      F.chunks.prewarm();
      // このマップで出る戦闘の背景を先に読み始める（env.js E.prefetchBbg）
      try {
        const E = R.Terrain && R.Terrain.Env;
        if (E && E.prefetchBbg) {
          const ids = new Set(map.bbg ? [map.bbg] : []);
          for (const z of map.zones || []) { const e = R.DB.encounters && R.DB.encounters[z.zone]; if (e && e.bg) ids.add(e.bg); }
          ids.forEach((id) => E.prefetchBbg(id));
        }
      } catch (e) { /* 先読みは無くても戦える */ }
      S.stat.enterMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
      // 人の絵（先頭・仲間・近くの人）も暗転の中で。起動の直後は原画の画像が読めるのを少しだけ待つ（enterMs の外）
      try { if (F._awaitPeopleArt) await F._awaitPeopleArt(1200); } catch (e) { /* 絵が無くても止めない */ }
      try { if (F._warmPeople) S.stat.peopleMs = F._warmPeople(300); } catch (e) { console.error(e); }
      try { if (R.Mon.resetEncounter && G) R.Mon.resetEncounter(G.steps || 0); } catch (e) { /* */ }   // 安全な歩数を数え直す（BATTLE）
      F.minimap.reveal();
      F.hud.refresh();
      S.placeT0 = R.Engine.time;
      R.emit('map:enter', { map: map.id, from });
      if (fade) await R.Engine.fadeTo(0, fade / 2);
    } finally { S.entering--; }
    F.chunks.lookAhead();   // 入口のすぐ横の出口（屋内の扉など）の先も列で先に焼いておく
    F.chunks.neighbors();   // つながっているマップの素材・物の絵を列の余りで
    if (!o.noAutosave) { try { R.Save.autosave('map'); } catch (e) { console.error(e); } }
    // on:'enter' のトリガー（onEnter。入るたび、once なら 1 回）
    const G = R.Game;
    for (const tr of map.triggers || []) {
      if (tr.on !== 'enter' || S.map !== map) continue;
      if (tr.cond && !R.State.check(tr.cond)) continue;
      const k = 'tr_' + map.id + '_' + tr.id;
      if (tr.once && G && G.flags[k]) continue;
      if (tr.once && G) G.flags[k] = true;
      await R.Events.run(tr.event, { map: map.id, x: S.x, y: S.y, trigger: tr.id });
    }
  };

  /** フラグなどが変わった: 条件つきの物・NPC・tilePatches を読み直す */
  F._refreshMap = function () {
    R.MapUtil.invalidate(S.map.id);
    F._npcVis();
    F._waylamps(false);
    F.chunks.checkGrid();
    F.hud.refresh();
  };

  /** 光の雰囲気（R.Post.frame に渡す物）をマップとティアから決める */
  F._post = function () {
    const m = S.map;
    if (!m) return;
    const amb = R.Terrain.ambient(m, R.Tier.get()) || {};
    const md = R.Hd.mood(amb.mood || (m.light && m.light.mood) || 'night', R.Tier.get()) || {};   // ティアの段で周辺減光も弱く
    S.amb = amb;
    const lv = m.light && m.light.vignette;   // map.light.vignette = その地図だけの周辺減光（町の端が暗い地図）
    S.postO = { vignette: lv != null ? lv : md.vignette != null ? md.vignette : 0.35, bloom: md.bloom != null ? md.bloom : 0.2, grade: md.grade || null, mood: amb.mood };
  };

  /** 道しるべの灯籠（E21）: lit の条件が真になったら R.Game.lamps[id] = true と 'lamp:lit' */
  F._waylamps = function (quiet) {
    const G = R.Game, m = S.map;
    if (!G || !m) return;
    // はじめから燃えている火（type 'brazier' の on: true。野営地のたき火・炉・門のかがり火）は、入った時にともした扱い
    //   （ともした火の表 G.lit だけを見る描き・暗がり・「火をともす」の札がそのまま使える）
    for (const o of m.objects || []) {
      if (o.type !== 'brazier' || o.on !== true || !o.id) continue;
      const L = (G.lit[m.id] = G.lit[m.id] || []);
      if (!L.includes(o.id)) L.push(o.id);
    }
    for (const o of m.objects || []) {
      if (o.type !== 'waylamp' || !o.id || G.lamps[o.id]) continue;
      if (o.lit != null && R.State.check(o.lit)) {
        G.lamps[o.id] = true;
        (G.lit[m.id] = G.lit[m.id] || []).includes(o.id) || G.lit[m.id].push(o.id);
        R.emit('lamp:lit', { id: o.id });
        F.chunks.dirtyAt(o.x, o.y);
        if (!quiet) { try { R.Audio.sfx('lamp'); } catch (e) { /* */ } }
      }
    }
  };

  // ---------------------------------------------------------------- 止める
  F.lock = function (reason) { init(); const k = reason || 'x'; S.locks[k] = (S.locks[k] || 0) + 1; };
  F.unlock = function (reason) { init(); const k = reason || 'x'; if (S.locks[k] > 1) S.locks[k]--; else delete S.locks[k]; };
  F.locks = function () { init(); return Object.assign({}, S.locks); };

  Object.defineProperty(F, 'pos', { enumerable: true, configurable: true, get() { return { map: S.map ? S.map.id : '', x: S.x | 0, y: S.y | 0, dir: S.dir || 's' }; } });

  // ---------------------------------------------------------------- ついてくる人（E8）
  F.setGuest = function (g) {
    init();
    S.guest = g ? { id: g.id || g.look, look: g.look || g.id } : null;
    if (R.Game) R.Game.guest = S.guest ? { id: S.guest.id, look: S.guest.look } : null;
    F._resetTrail(true);
  };

  // ---------------------------------------------------------------- 光と揺れ
  F.flash = function (color, ms) { init(); S.flashFx = { color: color || '#ffffff', t0: R.Engine.time, ms: ms || 300 }; };
  F.shake = function (px, ms) {
    init();
    const s = R.Settings.get('shake');
    if (s === 'off' || R.Settings.get('reduceMotion')) return;
    S.shakeFx = { px: (px || 4) * (s === 'weak' ? 0.5 : 1), t0: R.Engine.time, ms: ms || 300 };
  };

  // ---------------------------------------------------------------- ワープと脱出（A2・A6）
  F.warpList = function () {
    const out = [];
    const G = R.Game;
    for (const id of Object.keys((G && G.warps) || {})) {
      const l = R.DB.locations[id];
      if (l && (l.kind === 'town' || l.kind === 'dungeon') && (!l.warp || R.State.check(l.warp))) out.push({ id, name: l.name, region: l.region, kind: l.kind });
    }
    return out;
  };
  F.warp = function (locId) {
    const l = R.DB.locations[locId];
    if (!l) return Promise.resolve();
    try { R.Audio.sfx('warp'); } catch (e) { /* */ }
    return F.enter(l.map, l.spawn);
  };
  /**
   * 脱出の行き先（ダンジョンの中だけ）→ {map, spawn} | null。
   *   入口のマップ = そのダンジョンの場所（location）の map。場所がダンジョンでない（野営地の脇の旧野営地など）ときは今のマップ。
   *   入口のマップの外へ出る道（出口・階段・扉・建物の入口。cond が真の物）のうち、行き先がダンジョンでない最初の物 → 入口の外。
   *   外へ出る道が無い（千年樹・深淵の鉱脈のようにダンジョンの奥から入るダンジョン）→ その場所の入口の spawn（ワープと同じ所）。
   *   オーナーの報告「古井戸で脱出を選ぶと街の酒場に移動してしまう」: 前は出口（exits）だけを見ていたので、
   *   階段・扉で外へ出るダンジョン（古井戸・神殿・王墓・幽霊船・学院）は最後の町（lastTown）へ飛んでいた
   */
  F.escapeTarget = function (m) {
    m = m || S.map;
    if (!m || m.kind !== 'dungeon') return null;
    const loc = m.location && R.DB.locations[m.location];
    const home = loc && R.DB.maps[loc.map];
    const entry = home && home.kind === 'dungeon' ? home : m;
    const ok = (c) => c == null || R.State.check(c);
    const outside = (to) => { const t = to && R.DB.maps[to.map]; return !!(t && t.kind !== 'dungeon'); };
    const ways = [];
    for (const e of entry.exits || []) if (ok(e.cond)) ways.push(e.to);
    for (const o of entry.objects || []) {
      if (o.cond != null && !ok(o.cond)) continue;
      if ((o.type === 'stairs' || o.type === 'door') && o.to) ways.push(o.to);
      else if (o.type === 'building' && o.door && o.door.to) ways.push(o.door.to);
    }
    const out = ways.find(outside);
    if (out) return { map: out.map, spawn: out.spawn };
    if (entry === home && loc.spawn != null) return { map: home.id, spawn: loc.spawn };
    const sp = Object.keys(entry.spawns || {})[0];
    return sp ? { map: entry.id, spawn: sp } : null;
  };
  /** 脱出（ダンジョンの中だけ）: そのダンジョンの入口へ（F.escapeTarget）。見つからなければ最後の町 */
  F.escape = function () {
    const m = S.map;
    if (!m || m.kind !== 'dungeon') return Promise.resolve(false);
    const to = F.escapeTarget(m);
    try { R.Audio.sfx('teleport'); } catch (e) { /* */ }
    if (to) return F.enter(to.map, to.spawn).then(() => true);
    const t = R.Game && R.Game.lastTown;
    if (t) return F.enter(t.map, { x: t.x, y: t.y, dir: t.dir }).then(() => true);
    return Promise.resolve(false);
  };
  F.escapeOk = function () { return !!(S.map && S.map.kind === 'dungeon'); };

  F.camera = F.camera || {};
  F.hud = F.hud || {};
  F.encounter = F.encounter || {};
  init();
})(window.RPG);
