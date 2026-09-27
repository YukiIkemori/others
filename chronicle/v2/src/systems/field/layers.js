// FIELD — 描く順（MODERN_UI §7.2 の F0〜F8、V2_PLAN §2.10・§2.11）
//   地面（チャンクの base）→ 先頭の光の輪（地面に。人の上に重ねると白く飛ぶ）→ lv 0 の立っている物と人（足もとの y で並べる）→
//   チャンクの over（屋根の張り出し・足場・木の葉）→ lv 1 の人（足場の上）→ 発光の描き直し（芯＋にじみ、30 個まで）→ 暗がりの膜（E6）→
//   宝箱と泉のきらめき（膜の上、WORLD §6.3）→ 新しい話の印 → 光の明滅 → R.Post.frame → HUD。
//   人の絵は hd:field:<look>（opts {scale, lantern}）。登録が無い間は dev だけ仮の人形（index.html では影だけ）。
//   歩きの絵: ダッシュは run_*（無ければ walk_*）、止まれば idle_*（2 コマ以上あれば）か stand_*。コマの数と fps はシートから（cast/sprites.js が json を読む）。
//   歩き・走りのコマは歩いた道のりで進める（1 マスあたり fps × 1 マスの時間 ÷ 1000 コマ、json の stride があれば 1 巡りのマス数）: 速さが変わっても足が滑らない。
//   走り出しとダッシュ中の向き変えで足もとに小さな土ぼこり（F._dust、環境光とランタンの色）。
//   物の絵は TERRAIN のチャンクの props（R.Hd.get(p.key, p.opts) の poses[p.frame]、fps があれば時間で回す、p.cond が真の間だけ）。
//   仮の地面（fb）の間は、ここで宝箱・泉・しょく台・灯籠・建物などを簡単な形で描く。
//   光の輪は R.Light.ring(g, x, y, r, t, {mood})（環境光を渡すと輪の色が合う）。
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const S = (F._s = F._s || {});
  const cam = { cx: 0, cy: 0, t: 32 };
  const vis = { px: 0, py: 0 };
  const WALK = { s: 'walk_s', n: 'walk_n', e: 'walk_e', w: 'walk_w' };
  const STAND = { s: 'stand_s', n: 'stand_n', e: 'stand_e', w: 'stand_w' };
  const RUN = { s: 'run_s', n: 'run_n', e: 'run_e', w: 'run_w' };
  const IDLE = { s: 'idle_s', n: 'idle_n', e: 'idle_e', w: 'idle_w' };
  // 昔の速さ（json に fps の無い 3 コマの歩き・4 コマの走り・仮の絵）: 1 コマ 130 ms、ダッシュ 85 ms
  const LEG_WALK_FPS = 1000 / 130, LEG_RUN_FPS = 1000 / 85;
  const NPC_STEP_MS = 320;   // npc.js の STEP_MS（NPC の歩の足の運びの基準）
  const pool = [];
  let used = 0;
  const OPTS = {};
  const RING = { mood: null };
  const byY = (a, b) => a.y - b.y || a.o - b.o;

  function ent(kind, ref, y, lv, o) {
    let e = pool[used];
    if (!e) e = pool[used] = { kind: '', ref: null, y: 0, lv: 0, o: 0, x: 0, py: 0 };
    used++;
    e.kind = kind; e.ref = ref; e.y = y; e.lv = lv || 0; e.o = o || 0;
    return e;
  }
  function charOpts(lantern) {
    const s = F._charScale(), k = s + (lantern ? 'L' : '');
    return OPTS[k] || (OPTS[k] = { scale: s, lantern: !!lantern });
  }

  /** 暗転の中で先頭と仲間の原画の画像が読めるのを少しだけ待つ（起動の直後・つづきからの直後。読めていれば待たない）→ Promise */
  F._awaitPeopleArt = function (maxMs) {
    const G = R.Game, SP = R.Art && R.Art.cast && R.Art.cast.sprites;
    if (!G || !G.party || !SP || !R.Media || !R.Media.image) return Promise.resolve();
    const ps = [];
    for (const id of G.party) {
      const c = G.chars && G.chars[id];
      if (!c || SP.state(c.look, 'field') !== 'loading') continue;
      const rec = R.Media.image(c.look + ':field', 'sprites');
      if (rec && rec.promise) ps.push(rec.promise);
    }
    if (!ps.length) return Promise.resolve();
    return Promise.race([Promise.all(ps), R.wait(maxMs || 1200)]);
  };
  /** 暗転の中で人の絵を先に焼く（先頭・後ろの仲間・ゲスト・近くの NPC）。原画の読み込み待ちの物は列に任せる。→ 焼いた数 */
  F._warmPeople = function (limitMs) {
    if (!R.Hd || !R.Hd.now) return 0;
    const G = R.Game, t0 = Date.now(), lim = limitMs || 300;
    const list = [];
    if (G && G.party) G.party.forEach((id, i) => { const c = G.chars && G.chars[id]; if (c) list.push([c.look, i === 0]); });
    if (S.guest && S.guest.look) list.push([S.guest.look, false]);
    const near = (S.npcs || []).filter((n) => n.vis !== false && !n.hidden && Math.abs(n.x - S.x) <= 16 && Math.abs(n.y - S.y) <= 10)
      .sort((a, b) => Math.abs(a.x - S.x) + Math.abs(a.y - S.y) - (Math.abs(b.x - S.x) + Math.abs(b.y - S.y)));
    for (const n of near) list.push([n.look, false]);
    let n = 0;
    for (const [look, lantern] of list) {
      if (Date.now() - t0 > lim) break;
      const key = 'hd:field:' + look, o = charOpts(lantern);
      if (!look || !R.Hd.has(key) || (R.Hd.ready && R.Hd.ready(key, o))) continue;
      if (R.Hd._s && R.Hd._s.failed) R.Hd._s.failed.delete(R.Hd._ck(key, o));   // 読み込み待ちで null だった印を消す
      try { if (R.Hd.now(key, o)) n++; } catch (e) { console.error('[field] warm people', e); }
    }
    return n;
  };

  /** 1 人の絵をすぐ焼く（イベントで出る仲間: 仮の人形が一瞬見えないように）→ bool */
  F._warmLook = function (look, lantern) {
    if (!look || !R.Hd || !R.Hd.now) return false;
    const key = 'hd:field:' + look, o = charOpts(!!lantern);
    if (!R.Hd.has(key) || (R.Hd.ready && R.Hd.ready(key, o))) return true;
    try { if (R.Hd._s && R.Hd._s.failed) R.Hd._s.failed.delete(R.Hd._ck(key, o)); return !!R.Hd.now(key, o); } catch (e) { return false; }
  };

  // ---------------------------------------------------------------- 光の出どころ（止まった灯り）
  /** マップの物から: 光だまり {x, y, r, color, k} と芯 {gx, gy, gr, gcolor}（マップの論理 px）。状態が変わるまで使い回す */
  F._lights = function (tile) {
    const G = R.Game || {}, m = S.map;
    const sig = m.id + tile + ':' + ((G.lit && G.lit[m.id]) || []).length + ':' + Object.keys(G.lamps || {}).length + ':' + ((G.secrets && G.secrets[m.id]) || []).length;
    if (S.lightSig === sig && S.lightList) return S.lightList;
    const t = tile, u = t / 32, out = [];
    const lit = (G.lit && G.lit[m.id]) || [];
    const add = (x, y, r, color, k, gy, gcolor, gr) => out.push({ x, y, r: r * u, color, k, gx: x, gy: gy != null ? gy : y, gcolor: gcolor || color, gr: (gr || 6) * u });
    for (const o of m.objects || []) {
      if (o.cond != null && !R.State.check(o.cond)) continue;
      if (hiddenAt(m, o.x, o.y)) continue;   // 見つける前の隠し通路の先
      const cx = (o.x + 0.5) * t, cy = (o.y + 0.8) * t;
      if (o.type === 'prop') {
        const meta = (R.DB.props && R.DB.props[o.id]) || {};
        if (meta.light) add(cx, cy, 116, 'rgba(255,190,120,1)', 0.8, cy - t * 1.35, '#ffe3b0', 6);
      } else if (o.type === 'brazier') {
        if (lit.includes(o.id)) add(cx, cy, 104, 'rgba(255,170,96,1)', 0.85, cy - t * 0.7, '#ffd9a0', 7);
      } else if (o.type === 'spring') {
        add((o.x + 1) * t, (o.y + 1.2) * t, 132, 'rgba(120,220,236,1)', 0.75, (o.y + 0.7) * t, '#d8fbff', 9);
      } else if (o.type === 'waylamp') {
        if (G.lamps && G.lamps[o.id]) add(cx, cy, 112, 'rgba(255,196,120,1)', 0.8, cy - t * 1.2, '#ffe6b8', 6);
      } else if (o.type === 'building' && o.lamp && o.door) {
        add((o.door.x + 0.5) * t, (o.door.y + 0.9) * t, 90, 'rgba(255,190,110,1)', 0.75, (o.door.y + 0.05) * t, '#ffe0a8', 5);
      }
    }
    S.lightSig = sig; S.lightList = out;
    return out;
  };

  /** マップの外の色（outside の素材を 1 画素焼いて読む。黒い余白を出さない） */
  function outColor() {
    const m = S.map;
    if (S.outFor === m.id) return S.outColor;
    S.outFor = m.id; S.outColor = '#0c0e1c';
    const c = R.Gfx.canvas2d(4, 4);
    if (c) {
      try {
        const g = c.getContext('2d');
        R.Terrain.material(m.outside || 'forest_dark').bake(g, { x: 0, y: 0, w: 4, h: 4 }, R.rng(m.id), 4);
        const d = g.getImageData(1, 1, 1, 1).data;
        const k = 0.72;
        S.outColor = `rgb(${Math.max(8, d[0] * k) | 0},${Math.max(8, d[1] * k) | 0},${Math.max(14, d[2] * k) | 0})`;
      } catch (e) { /* 既定の色 */ }
    }
    return S.outColor;
  }

  // ---------------------------------------------------------------- 描く
  F._draw = function (g) {
    const m = S.map;
    if (!m) { R.Gfx.clear(); return; }
    F._trailCheck();
    F.chunks.sync();
    F._cam(cam);
    const t = cam.t, cx = cam.cx, cy = cam.cy, cs = ((R.Terrain && R.Terrain.CHUNK) || 8) * t;
    R.Gfx.clear(outColor());
    g.imageSmoothingEnabled = false;
    // F0〜F3: 地面
    let real = false;
    F.chunks.eachVisible((e) => { if (e.base) g.drawImage(e.base, e.cx * cs - cx, e.cy * cs - cy); if (!e.fb) real = true; });
    S.realTerrain = real;
    // 先頭のランタンの光の輪（STYLE_REFERENCE R4。効果 off で消える）: 地面に掛ける（人の絵の上に足すと先頭が白く飛ぶ、CAST の依頼）
    const q = R.Hd.quality();
    F._vis(vis);
    const lx = Math.round((vis.px + 0.5) * t - cx), ly = Math.round((vis.py + 0.72) * t - cy);
    if (q !== 'off') {
      RING.mood = (S.amb && S.amb.mood) || (m.light && m.light.mood) || 'night';
      R.Light.ring(g, lx, ly, F.dark.on() ? F.dark.partyR() * t : 88 * (t / 32), R.Engine.time, RING);
    }
    // 走りの土ぼこり（地面の上・人の下）
    if (S.dust && S.dust.length) drawDust(g, t, cx, cy);
    // F4: 立っている物と人
    used = 0;
    collect(t, real);
    const list = pool;
    const n = used;
    const sorted = sortPool(n);
    for (let i = 0; i < n; i++) { const e = sorted[i]; if (e.lv === 0) drawEnt(g, e, t, cx, cy); }
    // over（足場・屋根の張り出し）→ 足場の上の人
    F.chunks.eachVisible((e) => { if (e.over) g.drawImage(e.over, e.cx * cs - cx, e.cy * cs - cy); });
    for (let i = 0; i < n; i++) { const e = sorted[i]; if (e.lv === 1) drawEnt(g, e, t, cx, cy); }
    // 見つけた隠し通路の先が浮かび上がる間: 前の壁の絵を薄くしながら重ね、一行はその上に描き直す（secrets.js）
    if (S.secretFx && F._secretFxDraw && F._secretFxDraw(g, t, cx, cy)) for (let i = 0; i < n; i++) { const e = sorted[i]; if (e.kind === 'lead' || e.kind === 'fol') drawEnt(g, e, t, cx, cy); }
    void list;
    // F6: 発光の描き直し（芯＋にじみ）
    glows(g, t, cx, cy, real);
    // 天気（map.weather: 'snow' | 'blizzard'。weather.js）
    if (m.weather && F._weather) F._weather(g, m, cx, cy, t);
    // 暗がり（E6）
    F.dark.draw(g, cam);
    // 膜の上: 宝箱・泉のきらめき、新しい話の印
    // 町の道しるべ（出口の灯り・店の吊り看板。wayfind.js）: 町の絵の上、膜の上
    if (F._wayfind) F._wayfind(g, t, cx, cy);
    sparkles(g, t, cx, cy);
    newTalk(g, t, cx, cy);
    // 光の明滅
    const fl = S.flashFx;
    if (fl) {
      const k = (R.Engine.time - fl.t0) / fl.ms;
      if (k >= 1) S.flashFx = null;
      else { g.save(); g.globalAlpha = (1 - k) * (R.Settings.get('lessFlash') ? 0.2 : 0.5); g.fillStyle = fl.color; g.fillRect(0, 0, R.W, R.H); g.restore(); }
    }
    // F8: 仕上げ（HUD の前）
    R.Post.frame(g, S.postO || {});
    if (F._wayfindLabels) F._wayfindLabels(g, t, cx, cy);   // 出口の行き先・店の名前の札（近いときだけ）
    F.hud.draw(g, cam);
  };

  /** 見つける前の隠し通路の先のマスか（MapUtil.secretHidden） */
  function hiddenAt(m, x, y) { return x != null && !!(R.MapUtil.secretHidden && R.MapUtil.secretHidden(m, x, y)); }

  let sortBuf = [];
  function sortPool(n) {
    if (sortBuf.length < n) sortBuf = new Array(n);
    for (let i = 0; i < n; i++) sortBuf[i] = pool[i];
    sortBuf.length = n;
    sortBuf.sort(byY);
    return sortBuf;
  }

  function collect(t, real) {
    const m = S.map;
    // 物
    if (real) {
      F.chunks.eachVisible((e) => {
        const P = e.props || [];
        for (let i = 0; i < P.length; i++) {
          const pp = P[i];
          if (pp.cond != null && !R.State.check(pp.cond)) continue;   // 足あと（帽子を持つ間だけ）など
          ent('prop', pp, pp.sortY, pp.lv, 0);
        }
      });
    }
    const objs = m.objects || [];
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      if (o.x == null) continue;
      if (real && o.type !== 'trail') { const ce = F.chunks.at(o.x, o.y); if (!ce || !ce.fb) continue; }   // TERRAIN が焼いた物（宝箱・泉・しょく台…の今の状態もチャンクの props）
      if (o.type === 'exit' || o.type === 'examine' || o.type === 'door' && !o.look) continue;
      if (o.cond != null && o.type !== 'trail' && !R.State.check(o.cond)) continue;
      if (hiddenAt(m, o.x, o.y)) continue;
      const h = o.type === 'building' ? (o.h || 1) : o.type === 'spring' ? 2 : 1;
      ent(o.type === 'building' ? 'bld' : 'obj', o, (o.y + h) * t - (o.type === 'trail' ? t : 1), o.lv, 1);
    }
    // NPC
    const N = S.npcs || [];
    for (let i = 0; i < N.length; i++) {
      const nn = N[i];
      if (!nn.vis) continue;
      let py = nn.y;
      if (nn.mv) { const k = Math.min(1, (R.Engine.time - nn.mv.t0) / nn.mv.ms); py = nn.mv.fy + (nn.mv.ty - nn.mv.fy) * k; }
      ent('npc', nn, (py + 1) * t - 2, nn.lv, 2);
    }
    // 一行（先頭と隊列）
    const k = S.mv ? Math.min(1, (R.Engine.time - S.mv.t0) / S.mv.ms) : 1;
    const f = S.fol || [];
    for (let i = 0; i < f.length; i++) {
      F._folVis(f[i], k, vis);
      ent('fol', f[i], (vis.py + 1) * t - 2 - (i + 1) * 0.01, f[i].lv, 3);
    }
    F._vis(vis);
    ent('lead', null, (vis.py + 1) * t - 2, S.lv, 4);
  }

  function drawEnt(g, e, t, cx, cy) {
    const tm = R.Engine.time;
    if (e.kind === 'lead') {
      F._vis(vis);
      const G = R.Game, c = G && G.chars[G.party[0]];
      const dash = !!(S.mv && S.mv.dash);
      drawChar(g, c ? c.look : 'hero', Math.round((vis.px + 0.5) * t - cx), Math.round((vis.py + 1) * t - cy - t * 0.1), S.dir, !!S.mv, dash, true, null, F._gaitDist(), dash ? F.DASH_MS : F.WALK_MS, 1);
      return;
    }
    if (e.kind === 'fol') {
      const a = e.ref, k = S.mv ? Math.min(1, (tm - S.mv.t0) / S.mv.ms) : 1;
      F._folVis(a, k, vis);
      const dash = !!(S.mv && S.mv.dash);
      drawChar(g, a.look, Math.round((vis.px + 0.5) * t - cx), Math.round((vis.py + 1) * t - cy - t * 0.1), a.dir, a.moving && !!S.mv, dash, false, null, F._gaitDist(), dash ? F.DASH_MS : F.WALK_MS, 1);
      return;
    }
    if (e.kind === 'npc') {
      const n = e.ref;
      let px = n.x, py = n.y, k = 0;
      if (n.mv) { k = Math.min(1, (tm - n.mv.t0) / n.mv.ms); px = n.mv.fx + (n.mv.tx - n.mv.fx) * k; py = n.mv.fy + (n.mv.ty - n.mv.fy) * k; }
      const al = n.fade && F._npcAlpha ? F._npcAlpha(n) : 1;
      if (al <= 0.01) return;
      drawChar(g, n.look, Math.round((px + 0.5) * t - cx), Math.round((py + 1) * t - cy - t * 0.1), n.dir, !!n.mv, false, false, n.pose && n.pose.name, (n.odo || 0) + k, NPC_STEP_MS, al);
      return;
    }
    if (e.kind === 'prop') {
      const p = e.ref;
      const sh = R.Hd.get(p.key, p.opts);
      if (!sh) return;
      let fi = 0;
      if (typeof p.frame === 'number') fi = p.frame;
      else {
        // pose（無ければ default）。fps があれば時間で回す（泉のゆらぎ・かがり火）。位置で位相をずらす
        const name = typeof p.frame === 'string' && sh.poses[p.frame] ? p.frame : sh.poses.default ? 'default' : sh.poses.idle ? 'idle' : null;
        const P = name ? sh.poses[name] : [0];
        const fps = sh.fps && name && (typeof sh.fps === 'number' ? sh.fps : sh.fps[name]);
        fi = P.length > 1 && fps ? P[Math.floor((tm + (p.x * 7 + p.y * 13)) / (1000 / fps)) % P.length] : P[0];
      }
      R.Hd.draw(g, sh.frames[fi] || sh.frames[0], p.x - cx, p.y - cy);
      return;
    }
    if (e.kind === 'bld') { drawBuilding(g, e.ref, t, cx, cy); return; }
    drawObj(g, e.ref, t, cx, cy, tm);
  }

  // ---------------------------------------------------------------- 人
  /**
   * 人を 1 人描く。dist = 歩いた道のり（マス。歩き・走りのコマを道のりで進める。null なら時間で）、
   * gaitMs = その人の 1 マスの基準の時間（fps から 1 マスあたりのコマ数を出す）、alpha = 濃さ（イベントで出る仲間のフェード）
   */
  function drawChar(g, look, x, y, dir, moving, dash, lantern, pose, dist, gaitMs, alpha) {
    const t = cam.t, u = t / 32;
    const fade = alpha != null && alpha < 1;
    if (fade) { g.save(); g.globalAlpha = Math.max(0, alpha); }
    // 足もとの柔らかい影
    g.fillStyle = 'rgba(8,8,24,0.38)';
    g.beginPath(); g.ellipse(x + 2 * u, y, 9 * u, 3.2 * u, 0, 0, Math.PI * 2); g.fill();
    const key = 'hd:field:' + look;
    if (R.Hd.has(key)) {
      const sh = R.Hd.get(key, charOpts(lantern));
      if (sh) {
        const fr = sh.frames[pickFrame(sh, dir, moving, dash, pose, dist, gaitMs)] || sh.frames[0];
        R.Hd.draw(g, fr, x, y, { flip: dir === 'w' && !sh.poses.stand_w });
        if (fade) g.restore();
        return;
      }
    }
    if (R.Dev) doll(g, look, x, y, dir, moving, lantern, u);   // 絵の登録が無い間: dev だけ仮の人形（§2.5.5）
    if (fade) g.restore();
  }
  /** シートのどのコマか。歩き・走りは道のり、待ち・演技は時間 */
  function pickFrame(sh, dir, moving, dash, pose, dist, gaitMs) {
    const Ps = sh.poses;
    let name = null;
    if (pose && Ps[pose]) name = pose;
    else if (moving) name = dash && Ps[RUN[dir]] ? RUN[dir] : Ps[WALK[dir]] ? WALK[dir] : null;
    else if (Ps[IDLE[dir]] && Ps[IDLE[dir]].length > 1) name = IDLE[dir];
    const P = name ? Ps[name] : Ps[STAND[dir]] || Ps.stand_s || [0];
    if (P.length < 2) return P[0];
    const gait = !!name && (name === WALK[dir] || name === RUN[dir]);
    const fps = (sh.fps && (gait || name === IDLE[dir]) && sh.fps[name]) || (dash && gait ? LEG_RUN_FPS : LEG_WALK_FPS);
    if (gait && dist != null) {
      const st = sh.stride && sh.stride[name];
      const perTile = st ? P.length / st : (fps * (gaitMs || F.WALK_MS)) / 1000;
      return P[(Math.floor(dist * perTile + 1) % P.length + P.length) % P.length];   // +1: 歩き出しの最初のコマは足を出したところ
    }
    return P[Math.floor((R.Engine.time * fps) / 1000) % P.length];
  }
  F._pickFrame = pickFrame;
  /** 仮の人形（dev だけ）: 頭・体・足。先頭はランタンを持つ */
  function doll(g, look, x, y, dir, moving, lantern, u) {
    const h = R.U.hash(look || 'x'), hue = h % 360;
    const bob = moving ? Math.round(Math.sin(R.Engine.time / 70) * 1.2 * u) : 0;
    const s = F._charScale() / 1.15;
    const W = 14 * u * s, H = 22 * u * s, hr = 8 * u * s;
    const by = y - H - 2 * u + bob;
    g.fillStyle = `hsl(${hue},30%,22%)`;
    g.fillRect(x - W * 0.35, y - 7 * u, W * 0.25, 7 * u); g.fillRect(x + W * 0.1, y - 7 * u, W * 0.25, 7 * u);
    R.Gfx.roundRect(x - W / 2, by, W, H - 4 * u, 4 * u, `hsl(${hue},42%,44%)`, `hsl(${hue},40%,20%)`, 1);
    g.fillStyle = `hsl(${(hue + 30) % 360},40%,62%)`; g.fillRect(x - W / 2, by + H * 0.42, W, 2 * u);
    const hy = by - hr + 2 * u;
    g.fillStyle = '#e8c4a0'; g.beginPath(); g.arc(x, hy, hr, 0, Math.PI * 2); g.fill();
    g.fillStyle = `hsl(${(h >> 9) % 360},35%,${22 + ((h >> 5) % 30)}%)`;
    g.beginPath(); g.arc(x, hy - 1.5 * u, hr, Math.PI * (dir === 'n' ? -0.1 : 1.05), Math.PI * (dir === 'n' ? 1.1 : 1.95)); g.fill();
    if (dir === 'n') { g.beginPath(); g.arc(x, hy, hr, 0, Math.PI * 2); g.fill(); }
    else {
      g.fillStyle = '#2a2436';
      const ex = dir === 'e' ? 3 * u : dir === 'w' ? -3 * u : 0;
      if (dir !== 'w') g.fillRect(x + ex + 2 * u, hy, 1.6 * u, 2.4 * u);
      if (dir !== 'e') g.fillRect(x + ex - 3.6 * u, hy, 1.6 * u, 2.4 * u);
    }
    if (lantern) {
      const lxx = x + (dir === 'w' ? -W * 0.7 : W * 0.7), lyy = by + H * 0.55;
      g.fillStyle = '#6a4a2a'; g.fillRect(lxx - 2 * u, lyy - 3 * u, 4 * u, 6 * u);
      g.fillStyle = '#ffe6a8'; g.fillRect(lxx - 1.2 * u, lyy - 2 * u, 2.4 * u, 3.6 * u);
    }
  }

  // ---------------------------------------------------------------- 走りの土ぼこり
  // 走り出し・ダッシュ中の向き変えで先頭の足もとに 3〜5 粒（move.js が呼ぶ）。軽い: 最大 24 粒、各 0.46〜0.68 秒。
  // 色は地面の色（淡い土）× マップの環境光（夜は青く沈む）に、足もとを照らす先頭のランタンの暖色を半分ほど混ぜる。
  // 暗がりの膜（E6）の下に描くので、暗い所ではそのまま沈む。効果 off・動きを減らす設定では出さない
  const DUST_MAX = 24;
  const dustCol = {};
  function dustRGB() {
    const mood = (S.amb && S.amb.mood) || (S.map && S.map.light && S.map.light.mood) || 'night';
    if (dustCol[mood]) return dustCol[mood];
    let amb = [116, 104, 196];
    try { const md = R.Hd.mood(mood); if (md && md.ambient && R.Hd._rgb) amb = R.Hd._rgb(md.ambient); } catch (e) { /* 既定 */ }
    const base = [206, 190, 164], warm = [255, 214, 160];
    const out = base.map((v, i) => Math.round(Math.min(255, v * (Math.min(1, (amb[i] / 255) * 1.6) * 0.5 + (warm[i] / 255) * 0.5))));
    return (dustCol[mood] = out.join(','));
  }
  /** 土ぼこりを出す。(x, y) = マス（足もと）、(dx, dy) = 走る向き（粒は後ろへ散る） */
  F._dust = function (x, y, dx, dy, n) {
    if (R.Settings.get('reduceMotion') || (R.Hd.quality && R.Hd.quality() === 'off')) return;
    const L = (S.dust = S.dust || []);
    const now = R.Engine.time;
    const len = Math.hypot(dx, dy) || 1, bx = -dx / len, by = -dy / len;
    const seed = (S.phase || 0) * 7 + (x * 31 + y * 17);
    for (let i = 0; i < (n || 4); i++) {
      if (L.length >= DUST_MAX) L.shift();
      const h = R.U.hash(String(seed + i * 131)) % 1000 / 1000, h2 = R.U.hash(String(seed + i * 71 + 9)) % 1000 / 1000;
      const sp = 0.9 + h * 0.9, sd = (h2 - 0.5) * 1.6;
      L.push({ x: x + 0.5 + bx * 0.3 + (h2 - 0.5) * 0.35, y: y + 0.88 + by * 0.2, vx: (bx - by * sd) * sp * 1.3, vy: (by + bx * sd) * sp * 0.6 - 0.35, t0: now, life: 460 + h * 220, r: 3 + h2 * 2.2 });
    }
  };
  function drawDust(g, t, cx, cy) {
    const L = S.dust, now = R.Engine.time, u = t / 32;
    const col = dustRGB();
    let w = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i], a = (now - p.t0) / p.life;
      if (a >= 1 || a < 0) continue;
      L[w++] = p;
      const s = (now - p.t0) / 1000, ease = 1 - a * 0.5;
      const x = (p.x + p.vx * s * ease) * t - cx, y = (p.y + p.vy * s * ease) * t - cy;
      const r = p.r * u * (1 + a * 1.4);
      g.fillStyle = `rgba(${col},${(0.58 * (1 - a) * (1 - a * 0.5)).toFixed(3)})`;
      g.beginPath(); g.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2); g.fill();
    }
    L.length = w;
  }

  // ---------------------------------------------------------------- 物（仮の地面の間の簡単な形）
  function hdProp(g, id, frame, x, y) {
    const key = 'hd:prop:' + id;
    if (!R.Hd.has(key)) return false;
    const sh = R.Hd.get(key);
    if (!sh) return false;   // 焼けるまでは簡単な形で
    const P = (frame && sh.poses[frame]) || [0];
    R.Hd.draw(g, sh.frames[P[0]] || sh.frames[0], x, y);
    return true;
  }
  function drawObj(g, o, t, cx, cy, tm) {
    const G = R.Game || {}, m = S.map, u = t / 32;
    const x = o.x * t - cx, y = o.y * t - cy, fx = x + t / 2, fy = y + t - 2 * u;
    switch (o.type) {
      case 'chest': {
        const open = ((G.chests && G.chests[m.id]) || []).includes(o.id), rare = o.pool === 'p_rare';
        if (hdProp(g, 'chest', (rare ? 'rare_' : '') + (open ? 'open' : 'closed'), fx, fy)) return;
        g.fillStyle = 'rgba(8,8,24,0.4)'; g.beginPath(); g.ellipse(fx, fy, 13 * u, 4 * u, 0, 0, 7); g.fill();
        const bw = 22 * u, bh = 15 * u, bx = fx - bw / 2, by = fy - bh;
        R.Gfx.roundRect(bx, by, bw, bh, 2 * u, open ? '#4a3426' : '#5e3a22', '#1c1420', 1);
        if (!open) {
          R.Gfx.roundRect(bx - 1 * u, by - 7 * u, bw + 2 * u, 9 * u, 3 * u, rare ? '#3f5fb8' : '#c0643a', '#1c1420', 1);
          g.fillStyle = rare ? '#ffe28a' : '#f2c860'; g.fillRect(bx - 1 * u, by - 1 * u, bw + 2 * u, 2 * u); g.fillRect(fx - 2 * u, by - 3 * u, 4 * u, 6 * u);
          g.fillStyle = 'rgba(255,240,210,0.5)'; g.fillRect(bx + 1 * u, by - 6 * u, bw - 2 * u, 1 * u);
        } else {
          g.fillStyle = '#140e18'; g.fillRect(bx + 2 * u, by - 2 * u, bw - 4 * u, 4 * u);
          R.Gfx.roundRect(bx - 1 * u, by - 12 * u, bw + 2 * u, 6 * u, 2 * u, '#5a3a26', '#1c1420', 1);
        }
        return;
      }
      case 'spring': {
        const sx = o.x * t - cx + t, sy = (o.y + 2) * t - cy - 6 * u;
        if (hdProp(g, 'spring', null, sx, sy)) return;
        g.fillStyle = 'rgba(120,230,240,0.18)'; g.beginPath(); g.ellipse(sx, sy - 8 * u, 30 * u, 13 * u, 0, 0, 7); g.fill();
        R.Gfx.roundRect(sx - 22 * u, sy - 20 * u, 44 * u, 18 * u, 8 * u, '#6c6a86', '#2a2840', 1.2);
        R.Gfx.roundRect(sx - 17 * u, sy - 17 * u, 34 * u, 11 * u, 6 * u, '#58c8dc', null);
        const a = 0.55 + 0.25 * Math.sin(tm / 300);
        const gr = g.createLinearGradient(0, sy - 60 * u, 0, sy - 10 * u);
        gr.addColorStop(0, 'rgba(200,250,255,0)'); gr.addColorStop(1, `rgba(200,250,255,${a})`);
        g.fillStyle = gr; g.fillRect(sx - 7 * u, sy - 60 * u, 14 * u, 50 * u);
        return;
      }
      case 'brazier': {
        const on = ((G.lit && G.lit[m.id]) || []).includes(o.id);
        if (hdProp(g, 'brazier', on ? 'on' : 'off', fx, fy)) return;
        g.fillStyle = '#3a3448'; g.fillRect(fx - 2 * u, fy - 16 * u, 4 * u, 16 * u);
        R.Gfx.roundRect(fx - 8 * u, fy - 22 * u, 16 * u, 7 * u, 3 * u, '#5a5068', '#1c1a2a', 1);
        if (on) { const fl = Math.sin(tm / 90 + o.x) * 1.5 * u; g.fillStyle = '#ff9a4a'; g.beginPath(); g.ellipse(fx, fy - 27 * u + fl * 0.3, 5 * u, 8 * u + fl, 0, 0, 7); g.fill(); g.fillStyle = '#ffe2a0'; g.beginPath(); g.ellipse(fx, fy - 25 * u, 2.4 * u, 4 * u, 0, 0, 7); g.fill(); }
        else { g.strokeStyle = 'rgba(200,190,230,0.45)'; g.lineWidth = 1; g.strokeRect(fx - 8 * u, fy - 22 * u, 16 * u, 7 * u); }
        return;
      }
      case 'waylamp': {
        const on = !!(G.lamps && G.lamps[o.id]);
        if (hdProp(g, 'waylamp', on ? 'on' : 'off', fx, fy)) return;
        g.fillStyle = '#2e2a3c'; g.fillRect(fx - 1.5 * u, fy - 34 * u, 3 * u, 34 * u);
        R.Gfx.roundRect(fx - 5 * u, fy - 44 * u, 10 * u, 11 * u, 2 * u, on ? '#ffd690' : '#4a4660', '#1a1826', 1);
        return;
      }
      case 'switch': {
        const on = !!(G.flags && G.flags[o.flag]);
        if (hdProp(g, 'switch', on ? 'on' : 'off', fx, fy)) return;
        const col = o.color || '#8fd6d8';
        if (o.look === 'lever') { g.fillStyle = '#4a4458'; g.fillRect(fx - 6 * u, fy - 6 * u, 12 * u, 6 * u); g.strokeStyle = col; g.lineWidth = 2 * u; g.beginPath(); g.moveTo(fx, fy - 5 * u); g.lineTo(fx + (on ? 7 : -7) * u, fy - 16 * u); g.stroke(); }
        else { R.Gfx.roundRect(x + 5 * u, y + 7 * u, t - 10 * u, t - 12 * u, 4 * u, on ? col : 'rgba(40,40,60,0.8)', col, 1.2); }
        return;
      }
      case 'trail': {
        if (!(o.cond == null || R.State.check(o.cond))) return;
        const P = o.path || [];
        for (let i = 0; i < P.length; i++) {
          const a = 0.35 + 0.35 * Math.sin(tm / 400 - i * 0.6);
          g.fillStyle = `rgba(170,240,210,${a})`;
          const px = P[i][0] * t - cx + t / 2, py = P[i][1] * t - cy + t / 2;
          g.beginPath(); g.ellipse(px - 4 * u, py + (i & 1 ? 3 : -3) * u, 2.6 * u, 4 * u, 0, 0, 7); g.fill();
        }
        return;
      }
      case 'sign': {
        if (hdProp(g, 'signboard', null, fx, fy)) return;
        g.fillStyle = '#4a3424'; g.fillRect(fx - 1.5 * u, fy - 14 * u, 3 * u, 14 * u);
        R.Gfx.roundRect(fx - 11 * u, fy - 24 * u, 22 * u, 12 * u, 2 * u, '#8a6844', '#2a1c14', 1);
        return;
      }
      case 'stairs': {
        g.fillStyle = 'rgba(10,10,26,0.8)'; g.fillRect(x + 3 * u, y + 3 * u, t - 6 * u, t - 6 * u);
        g.fillStyle = 'rgba(210,200,240,0.35)';
        for (let i = 0; i < 4; i++) g.fillRect(x + 5 * u, y + (6 + i * 6) * u, t - 10 * u, 2 * u);
        return;
      }
      case 'prop': {
        const meta = (R.DB.props && R.DB.props[o.id]) || {};
        if (hdProp(g, o.id, null, fx, fy)) return;
        if (meta.light) {
          g.fillStyle = '#2a2638'; g.fillRect(fx - 1.5 * u, fy - 40 * u, 3 * u, 40 * u);
          R.Gfx.roundRect(fx - 5 * u, fy - 48 * u, 10 * u, 10 * u, 2 * u, '#ffdc96', '#1a1826', 1);
          return;
        }
        if (meta.overChars) return;
        const hh = meta.solid ? 18 * u : 9 * u, ww = meta.solid ? 20 * u : 14 * u;
        const hue = R.U.hash(o.id) % 60 + 10;
        g.fillStyle = 'rgba(8,8,24,0.35)'; g.beginPath(); g.ellipse(fx, fy, ww / 2 + 2 * u, 3 * u, 0, 0, 7); g.fill();
        R.Gfx.roundRect(fx - ww / 2, fy - hh, ww, hh, 3 * u, `hsl(${hue},28%,34%)`, `hsl(${hue},30%,14%)`, 1);
        g.fillStyle = 'rgba(255,240,220,0.14)'; g.fillRect(fx - ww / 2 + 1, fy - hh + 1, ww - 2, 2 * u);
        return;
      }
      default:
    }
  }
  /** 建物（仮）: 屋根＋正面の壁。窓は暖色、扉。hd:bld が焼けていればそれを使う */
  function drawBuilding(g, o, t, cx, cy) {
    const key = R.Terrain.building(o);
    if (key && R.Hd.has(key)) { const sh = R.Hd.get(key); if (sh) { R.Hd.draw(g, sh.frames[0], (o.x + (o.w || 1) / 2) * t - cx, (o.y + (o.h || 1)) * t - cy); return; } }
    const w = (o.w || 3) * t, h = (o.h || 3) * t, x = o.x * t - cx, y = o.y * t - cy, u = t / 32;
    const wallH = Math.min(h - t * 0.6, (o.wall || 2) * t);
    const roofH = h - wallH;
    const hue = R.U.hash(o.roof || o.id || 'r') % 50;
    // 月の影（右下へ）
    g.fillStyle = 'rgba(8,8,26,0.35)'; g.fillRect(x + 8 * u, y + roofH * 0.4 + 6 * u, w, h - roofH * 0.4);
    // 壁
    R.Gfx.roundRect(x, y + roofH, w, wallH, 0, o.mat === 'log' || o.mat === 'plank' ? '#5a4232' : '#6e6a86', '#1e1a2a', 1);
    g.fillStyle = 'rgba(10,10,30,0.25)'; g.fillRect(x, y + roofH + wallH * 0.7, w, wallH * 0.3);
    // 屋根
    g.fillStyle = `hsl(${hue + 200},26%,30%)`;
    g.beginPath(); g.moveTo(x - 6 * u, y + roofH + 2 * u); g.lineTo(x + 8 * u, y); g.lineTo(x + w - 8 * u, y); g.lineTo(x + w + 6 * u, y + roofH + 2 * u); g.closePath(); g.fill();
    g.fillStyle = 'rgba(190,190,255,0.14)'; g.fillRect(x + 8 * u, y, w - 16 * u, 3 * u);   // 月の当たる棟
    g.fillStyle = 'rgba(8,8,26,0.3)';
    for (let i = 1; i < 4; i++) g.fillRect(x - 4 * u + i, y + (roofH * i) / 4, w + 8 * u - 2 * i, 1);
    // 窓（暖色）と扉
    const nwin = o.windows != null ? o.windows : Math.max(1, Math.floor((o.w || 3) / 2));
    for (let i = 0; i < nwin; i++) {
      const wx = x + (w * (i + 1)) / (nwin + 1) - 6 * u, wy = y + roofH + wallH * 0.22;
      if (o.door && Math.abs(wx + 6 * u - ((o.door.x + 0.5) * t - cx)) < 14 * u) continue;
      g.fillStyle = '#ffd88a'; g.fillRect(wx, wy, 12 * u, 11 * u);
      g.fillStyle = 'rgba(120,70,30,0.8)'; g.fillRect(wx + 5.5 * u, wy, 1 * u, 11 * u); g.fillRect(wx, wy + 5 * u, 12 * u, 1 * u);
    }
    if (o.door) {
      const dx = o.door.x * t - cx + 7 * u, dy = y + h - 22 * u;
      g.fillStyle = o.lamp ? '#ffe7b0' : '#3a2a22'; g.fillRect(dx, dy, t - 14 * u, 22 * u);
      g.fillStyle = 'rgba(60,40,24,0.9)'; g.fillRect(dx - 1 * u, dy - 2 * u, t - 12 * u, 2 * u);
    }
    if (o.sign) {
      R.Gfx.roundRect(x + w - 26 * u, y + roofH + 4 * u, 18 * u, 10 * u, 2 * u, '#8a6844', '#2a1c14', 1);
    }
  }

  // ---------------------------------------------------------------- 発光・きらめき・新しい話
  function glows(g, t, cx, cy, real) {
    let n = 0;
    const tm = R.Engine.time;
    if (real) {
      F.chunks.eachVisible((e) => {
        if (e.fb) return;
        const L = e.glows || [];
        for (let i = 0; i < L.length && n < 30; i++, n++) R.Light.glow(g, L[i].x - cx, L[i].y - cy, L[i], tm);
      });
    }
    const L = F._lights(t);
    for (let i = 0; i < L.length && n < 30; i++) {
      const l = L[i];
      if (real) { const ce = F.chunks.at(Math.floor(l.x / t), Math.floor(l.y / t)); if (!ce || !ce.fb) continue; }
      const x = l.gx - cx, y = l.gy - cy;
      if (x < -40 || y < -40 || x > R.W + 40 || y > R.H + 40) continue;
      n++;
      R.Light.glow(g, x, y, { r: l.gr, color: l.gcolor, core: l.gcolor, halo: l.gr * 3 }, tm);
    }
  }
  function sparkles(g, t, cx, cy) {
    const G = R.Game || {}, m = S.map, tm = R.Engine.time, u = t / 32;
    const opened = (G.chests && G.chests[m.id]) || [];
    for (const o of m.objects || []) {
      if (o.type !== 'chest' || opened.includes(o.id)) continue;
      if (o.cond != null && !R.State.check(o.cond)) continue;
      if (hiddenAt(m, o.x, o.y)) continue;
      const x = o.x * t - cx, y = o.y * t - cy;
      if (x < -t || y < -t || x > R.W || y > R.H) continue;
      // 2〜3 秒ごとに 4 コマのきらめき（位置でずらす）。暗がりの膜の上でも見える
      const per = o.pool === 'p_rare' ? 1600 : 2600;
      const ph = (tm + ((o.x * 373 + o.y * 911) % per)) % per;
      const inDark = F.dark.on() && R.MapUtil.darkAt(m, o.x, o.y);
      if (inDark) { g.fillStyle = 'rgba(240,200,120,0.35)'; g.fillRect(x + t / 2 - 8 * u, y + t - 15 * u, 16 * u, 2 * u); }
      if (ph > 360) continue;
      const k = Math.sin((ph / 360) * Math.PI), sx = x + t / 2 + 8 * u, sy = y + t - 19 * u, r = 5 * u * k;
      g.fillStyle = o.pool === 'p_rare' ? `rgba(255,226,140,${k})` : `rgba(255,248,226,${k})`;
      g.fillRect(sx - r, sy - 0.6 * u, r * 2, 1.2 * u); g.fillRect(sx - 0.6 * u, sy - r, 1.2 * u, r * 2);
    }
  }
  function newTalk(g, t, cx, cy) {
    const N = S.npcs || [], u = t / 32;
    if (!S.map || R.Engine.top() !== F.scene) return;
    for (let i = 0; i < N.length; i++) {
      const n = N[i];
      if (!n.vis || !n.isNew || n.talking) continue;
      const x = Math.round((n.x + 0.5) * t - cx), y = Math.round(n.y * t - cy - 22 * u * F._charScale());
      if (x < -20 || y < -20 || x > R.W + 20 || y > R.H + 20) continue;
      const b = Math.sin(R.Engine.time / 260) * 1.5;
      R.Gfx.roundRect(x - 10, y - 16 + b, 20, 13, 6.5, 'rgba(14,16,28,0.82)', 'rgba(236,201,124,0.7)', 0.75);
      g.fillStyle = '#ecc97c';
      for (let d = -1; d <= 1; d++) { g.beginPath(); g.arc(x + d * 5, y - 9.5 + b, 1.4, 0, 7); g.fill(); }
    }
  }
})(window.RPG);
