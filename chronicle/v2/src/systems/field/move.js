// FIELD — 歩く・調べる・入った瞬間の判定・出現（V2_PLAN §2.5.9、A3・A7）
//   1 歩 1 マス、8 方向、押した最初のフレームから動く、連続歩行（前の歩の終わりの時刻から次の歩を数える＝止まらない）、補間描画。
//   斜めは両隣が通れるときだけ。通れない斜めは空いた軸へ壁沿いに滑る（角を切らない）。
//   タイルに入った瞬間に 1 回だけ判定（隠し通路・スイッチの床・階段と扉・出口・step のトリガー・出現）。出現と歩数は歩いた数。
//   NPC は押し続けると 1 歩よける・動けなければ入れ替わる（npc.js）。R.Field.encounter.suppress(n) / ward(n) / lure(n)。
//   R.Field.light(r, steps)（松明 i_torch）: 暗がりで一行の灯りの半径を r マスに steps 歩のあいだ広げる（dark.js）。
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const S = (F._s = F._s || {});
  const DIRS = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] };
  const PUSH_MS = 300;

  function dirName(dx, dy) {
    if (dx && dy) return (dy > 0 ? 's' : 'n') + (dx > 0 ? 'e' : 'w');
    return dx > 0 ? 'e' : dx < 0 ? 'w' : dy > 0 ? 's' : 'n';
  }
  /** 先頭が (x, y) から (x+dx, y+dy) へ入れるか（人も含む）。→ 入った後の lv | -1 */
  function canGo(dx, dy) {
    const m = S.map, nx = S.x + dx, ny = S.y + dy;
    const dn = dirName(dx, dy);
    if (!F._canEnter(m, S.x, S.y, nx, ny, S.lv, dn)) return -1;
    const lv = F._lvAfter(m, S.x, S.y, nx, ny, S.lv);
    if (F._npcAt(nx, ny, lv)) return -2;
    return lv;
  }

  /** (S.x+dx, S.y+dy) が行き先のあるマス（戸口・扉・階段・出口）か */
  function warpNext(dx, dy) { return !!(F._warpAt && F._warpAt(S.map, S.x + dx, S.y + dy, S.lv || 0)); }
  /** 押した先が建物の（戸口でない）壁で、その建物の戸口が押す向きと直角に 1 マス隣 → 横へずれる [sx, sy] | null */
  function doorAssist(dx, dy) {
    const m = S.map, nx = S.x + dx, ny = S.y + dy, lv = S.lv || 0;
    const list = R.MapUtil.objectsAt(m, nx, ny, lv);
    for (let i = 0; i < list.length; i++) {
      const o = list[i], d = o.door;
      if (o.type !== 'building' || !d || !d.to) continue;
      for (const s of [-1, 1]) {
        const sx = dy ? s : 0, sy = dx ? s : 0;
        if (d.x === nx + sx && d.y === ny + sy && canGo(sx, sy) >= 0) return [sx, sy];
      }
    }
    return null;
  }
  /** 行き先の無い戸口（鍵の掛かった戸）を押した: 一言（1.5 秒に 1 回） */
  //   扉の物（type:'door'）で行き先の無い物も同じ（鍵・仕掛けで開く扉の閉じた方）。o.unlock = {cond, event} があり、cond が真なら
  //   一言の代わりにそのイベント（鍵を開ける場面。開いた後は行き先のある扉の物に替わる）
  function lockedBump(dx, dy) {
    const x = S.x + dx, y = S.y + dy, lv = S.lv || 0;
    const b = F._doorAt && F._doorAt(S.map, x, y, lv);
    let msg = null;
    if (b) { if (b.door.to) return; msg = b.door.locked; }
    else {
      const d = R.MapUtil.objectsAt(S.map, x, y, lv).find((o) => o.type === 'door');
      if (!d || d.to) return;
      if (d.unlock && d.unlock.event && (d.unlock.cond == null || R.State.check(d.unlock.cond))) {
        if (!(R.Events.busy && R.Events.busy())) R.Events.run(d.unlock.event, { map: S.map.id, x, y });
        return;
      }
      msg = d.locked;
    }
    const now = R.Engine.time;
    if (S.lockedAt && now - S.lockedAt < 1500) return;
    S.lockedAt = now;
    F.hud.toast(msg || '戸には鍵がかかっている', { icon: 'search', anchor: 'bl' });
  }

  /** 1 歩を始める。→ true（動いた） */
  F._step = function (dx, dy, dash) {
    const prevDir = S.dir;
    S.dir = R.U.dirOf(dx, dy, S.dir);
    if (S.dir !== prevDir && R.Game && R.Game.pos) R.Game.pos.dir = S.dir;
    let go = null;
    if (dx && dy) {
      // 斜めは両隣の軸も通れるときだけ。だめなら空いた軸へ滑る（A7）。片方の軸の先が戸口・出口なら、そちらを先に（斜めに押しても戸に入れる）
      const wx = warpNext(dx, 0), wy = warpNext(0, dy);
      if (canGo(dx, dy) >= 0 && canGo(dx, 0) >= 0 && canGo(0, dy) >= 0 && !wx && !wy) go = [dx, dy];
      else if (wy && canGo(0, dy) >= 0) go = [0, dy];
      else if (wx && canGo(dx, 0) >= 0) go = [dx, 0];
      else if (canGo(dx, dy) >= 0 && canGo(dx, 0) >= 0 && canGo(0, dy) >= 0) go = [dx, dy];
      else if (canGo(dx, 0) >= 0) go = [dx, 0];
      else if (canGo(0, dy) >= 0) go = [0, dy];
      if (go) S.dir = R.U.dirOf(go[0], go[1], S.dir);
    } else {
      const r = canGo(dx, dy);
      if (r >= 0) go = [dx, dy];
      else if (r === -1) {
        // 戸口の寄せ: 建物の壁を押していて、戸口がすぐ横（1 マス）なら、戸口の前へ 1 歩ずれる（押し続ければそのまま入る）
        const side = doorAssist(dx, dy);
        if (side) { go = side; S.push = null; }
        else lockedBump(dx, dy);
      }
      else if (r === -2) {
        // NPC を押す: 押し続けると よける／入れ替わる（A3）
        const n = F._npcAt(S.x + dx, S.y + dy, F._lvAfter(S.map, S.x, S.y, S.x + dx, S.y + dy, S.lv));
        const now = R.Engine.time;
        if (!S.push || S.push.npc !== n || S.push.dx !== dx || S.push.dy !== dy) S.push = { npc: n, dx, dy, t0: now };
        else if (now - S.push.t0 >= PUSH_MS) {
          S.push = null;
          const r2 = F._pushNpc(n, dx, dy);
          if (r2 === 'swap') go = [dx, dy];
        }
      } else S.push = null;
    }
    if (!go) return false;
    S.push = null;
    const nx = S.x + go[0], ny = S.y + go[1];
    const nlv = F._lvAfter(S.map, S.x, S.y, nx, ny, S.lv);
    const now = R.Engine.time;
    // 連続歩行: 前の歩が終わった時刻から数える（1 フレームの遅れで止まって見えない）
    const chained = now - S.lastEnd < 60;
    const t0 = chained ? S.lastEnd : now;
    const diag = !!(go[0] && go[1]);
    const ms = (dash ? F.DASH_MS : F.WALK_MS) * (diag ? 1.41 : 1);
    // 歩きのコマは道のりで進める（layers.js）: 止まった所から歩き出したら数え直す
    if (!chained) S.gait0 = S.odo || 0;
    // 走り出し・ダッシュ中の向き変え: 足もとに土ぼこり
    const prev = S.lastGo;
    if (dash && F._dust) {
      if (!chained || !S.lastDash) F._dust(S.x, S.y, go[0], go[1], 5);
      else if (prev && (prev[0] !== go[0] || prev[1] !== go[1])) F._dust(S.x, S.y, go[0], go[1], 3);
    }
    S.lastDash = !!dash; S.lastGo = go;
    F._trailPush(S.x, S.y, S.lv, S.dir);
    S.mv = { fx: S.x, fy: S.y, tx: nx, ty: ny, t0, ms, dx: go[0], dy: go[1], dash: !!dash, len: diag ? Math.SQRT2 : 1 };
    S.x = nx; S.y = ny; S.lv = nlv;
    F._trailStart(S.mv);
    S.phase = (S.phase + 1) & 1023;
    return true;
  };

  /** 先頭が歩き出してからの道のり（マス、今の歩の途中まで）。歩き・走りのコマを進める（layers.js） */
  F._gaitDist = function () {
    const m = S.mv;
    let d = (S.odo || 0) - (S.gait0 || 0);
    if (m) d += (m.len || 1) * Math.max(0, Math.min(1, (R.Engine.time - m.t0) / m.ms));
    return d;
  };

  /** 毎フレーム（tick。場面が上に積まれていても進む）: 歩き終わったら入った瞬間の判定 */
  F._tickMove = function () {
    const m = S.mv;
    if (!m) return;
    if (R.Engine.time - m.t0 < m.ms) return;
    S.lastEnd = m.t0 + m.ms;
    S.odo = (S.odo || 0) + (m.len || 1);
    S.mv = null;
    F._trailEnd();
    const p = F._arrive();
    if (p && p.then) {
      S.arriving = true;
      p.then(() => { S.arriving = false; }, (e) => { S.arriving = false; console.error(e); });
    }
  };

  function inRect(x, y, r) { return x >= r.x && y >= r.y && x < r.x + (r.w || 1) && y < r.y + (r.h || 1); }

  /**
   * 階段で着くマス（オーナーの報告「階段を上り下りすると 1 マス左に出る」）。
   *   名前つきの spawn は地図ごとに手で置いた所で、階段の横（灯台は左）・斜め・2 マス先とばらばらだった。
   *   行き先の spawn の近く（3 マス以内）の階段（戻る階段を優先）を見つけ、その「前」のマスに着く:
   *   上下左右の隣のうち、階段から歩いて入れて（当たり・一方通行）、ほかの出入り口でなく、動かない人がいないマス。
   *   その向きにまっすぐ開けている（3 マスまで）所ほど良い＝部屋の側。同じなら南 → 北 → 東 → 西。
   *   向きは階段から離れる向き。当てはまる所が無ければ spawn のまま。→ {x, y, dir, lv} | spawn（名前）
   */
  const LAND = [['s', 0, 1], ['n', 0, -1], ['e', 1, 0], ['w', -1, 0]];
  function condOk(c) { if (c == null) return true; try { return !!R.State.check(c); } catch (e) { return false; } }
  F.stairsLanding = function (mapId, spawn, fromId) {
    const map = R.DB.maps[mapId];
    if (!map || typeof spawn !== 'string' || !(map.spawns || {})[spawn]) return spawn;
    const def = map.spawns[spawn], lv = def.lv || 0;
    let st = null, best = 1e9;
    for (const o of map.objects || []) {
      if (o.type !== 'stairs' || !o.to || (o.lv || 0) !== lv) continue;   // cond は見ない（位置の目印。戻る階段の cond が偽でも、その前に着く）
      const d = Math.max(Math.abs(o.x - def.x), Math.abs(o.y - def.y));
      if (d > 3) continue;
      const k = d + (o.to.map === fromId ? 0 : 10);
      if (k < best) { best = k; st = o; }
    }
    if (!st) return spawn;
    const npcAt = (x, y) => (map.npcs || []).some((n) => n.x === x && n.y === y && (n.lv || 0) === lv && condOk(n.cond));
    const free = (fx, fy, x, y, dir) => F._canEnter(map, fx, fy, x, y, lv, dir) && F._lvAfter(map, fx, fy, x, y, lv) === lv && !F._warpAt(map, x, y, lv) && !npcAt(x, y);
    let out = null, open = -1;
    for (const [dir, dx, dy] of LAND) {
      const x = st.x + dx, y = st.y + dy;
      if (!free(st.x, st.y, x, y, dir)) continue;
      let k = 1;
      while (k < 3 && free(x + dx * (k - 1), y + dy * (k - 1), x + dx * k, y + dy * k, dir)) k++;
      if (k > open) { open = k; out = { x, y, dir, lv }; }
    }
    return out || spawn;
  };

  /** 入った瞬間の判定（1 マスに 1 回）。非同期の仕事（マップの移動・イベント・戦闘）があれば Promise を返す */
  F._arrive = function () {
    const m = S.map, G = R.Game;
    S.stat.arrive++;
    if (S.torch && S.torch.steps > 0 && --S.torch.steps <= 0) { S.torch = null; F.hud.toast('松明の火が消えた', { icon: 'lamp', anchor: 'bl' }); }
    if (G) {
      G.steps = (G.steps || 0) + 1;
      const p = G.pos || (G.pos = {});
      p.map = m.id; p.x = S.x; p.y = S.y; p.dir = S.dir;
    }
    R.emit('step', { map: m.id, x: S.x, y: S.y });
    F.minimap.reveal();
    F.chunks.lookAhead();
    F.hud.step();
    // 隠し通路（入った瞬間に見つける）
    const c = R.MapUtil.cell(m, S.x, S.y);
    if (c && c.secret && G && !R.MapUtil.secretFound(m.id, S.x, S.y)) {
      if (F._secretFound) F._secretFound(m, S.x, S.y);   // ひと続きの通路と先の部屋を出す（やわらかく浮かび上がる。secrets.js）
      else { (G.secrets[m.id] = G.secrets[m.id] || []).push(S.x + ',' + S.y); F.chunks.dirtyAt(S.x, S.y); }
      try { R.Audio.sfx('secret'); } catch (e) { /* */ }
      F.hud.toast('隠し通路を見つけた！', { icon: 'secret' });
      R.emit('secret:found', { map: m.id, x: S.x, y: S.y });
    }
    // 床のスイッチ・階段・扉・建物の入口
    const objs = R.MapUtil.objectsAt(m, S.x, S.y, S.lv);
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      if (o.type === 'switch' && o.look === 'plate') F._switch(o, 'step');
      if ((o.type === 'stairs' || o.type === 'door') && o.to && (!o.cond || R.State.check(o.cond))) {
        try { R.Audio.sfx(o.type === 'stairs' ? 'stairs' : 'door'); } catch (e) { /* */ }
        return F.enter(o.to.map, o.type === 'stairs' ? F.stairsLanding(o.to.map, o.to.spawn, m.id) : o.to.spawn);
      }
      if (o.type === 'building' && o.door && o.door.x === S.x && o.door.y === S.y && o.door.to) {
        try { R.Audio.sfx('door'); } catch (e) { /* */ }
        return F.enter(o.door.to.map, o.door.to.spawn);
      }
    }
    // 出口（上から順に最初に cond の合う物）
    for (const e of m.exits || []) {
      if (inRect(S.x, S.y, e) && (!e.cond || R.State.check(e.cond))) return F.enter(e.to.map, e.to.spawn);
    }
    // step のトリガー
    for (const tr of m.triggers || []) {
      if (tr.on !== 'step' || !inRect(S.x, S.y, tr)) continue;
      if ((tr.lv || 0) !== S.lv) continue;
      if (tr.cond && !R.State.check(tr.cond)) continue;
      const k = 'tr_' + m.id + '_' + tr.id;
      if (tr.once && G && G.flags[k]) continue;
      if (tr.once && G) G.flags[k] = true;
      return R.Events.run(tr.event, { map: m.id, x: S.x, y: S.y, trigger: tr.id });
    }
    return F._encounterStep();
  };

  // ---------------------------------------------------------------- 出現（歩数）
  /** 出現しない所: 泉（女神の像）の周り 3 マス、ともした道しるべの灯籠の周り 5 マス（E21） */
  F.safeAt = function (x, y) {
    const m = S.map, G = R.Game;
    for (const o of m.objects || []) {
      if (o.type === 'spring') {
        const dx = Math.max(o.x - x, 0, x - (o.x + 1)), dy = Math.max(o.y - y, 0, y - (o.y + 1));
        if (Math.max(dx, dy) <= 3) return 'spring';
      } else if (o.type === 'waylamp' && o.id && G && (G.lamps[o.id] || (o.lit != null && R.State.check(o.lit)))) {
        if (Math.max(Math.abs(o.x - x), Math.abs(o.y - y)) <= 5) return 'waylamp';
      }
    }
    return null;
  };
  F._encounterStep = function () {
    const m = S.map, G = R.Game;
    if (!G || m.kind === 'town' || m.kind === 'interior') return null;
    if (S.suppress > 0) { S.suppress--; return null; }
    const ward = S.ward > 0;
    if (S.ward > 0) S.ward--;
    const lure = S.lure > 0;
    if (S.lure > 0) S.lure--;
    const zone = R.MapUtil.zoneAt(m, S.x, S.y);
    if (!zone || F.safeAt(S.x, S.y)) return null;
    const o = { tier: R.Tier.get(), dark: F.dark.battleDark(S.x, S.y), steps: G.steps || 0, ward };
    let setup = R.Mon.encounter(zone, o);
    // 呼び寄せの香（i_lure、出現 +100%）: 出なかった歩にもう 1 回だけ同じ率で振る（前の戦闘から 6 歩の間は振らない）
    if (!setup && lure && (G.steps || 0) - (S.lastBattleStep || -1e9) >= 6) {
      const z = R.DB.encounters && R.DB.encounters[zone];
      const p = z && R.Mon.stepChance ? R.Mon.stepChance(zone, z) : 0;
      if (p > 0 && R.rng(G.seed + ':lure:' + zone + ':' + G.steps).next() < p) setup = R.Mon.encounter(zone, Object.assign({}, o, { force: true }));
    }
    if (!setup) return null;
    if (!setup.bg && S.map.bbg) setup.bg = S.map.bbg;   // 出現表に背景が無ければマップの bbg（BATTLE の依頼）
    S.lastBattleStep = G.steps || 0;
    return (async () => {
      R.emit('encounter', { zone });
      F.lock('battle');
      try { await R.Battle.start(setup); }   // 'abort'（全滅して宿・タイトル）の片付けは BSCENE が R.Flow.wipe で済ませている
      finally { F.unlock('battle'); }
    })();
  };
  const E = (F.encounter = F.encounter || {});
  E.suppress = function (n) { S.suppress = n == null ? 10 : n; };
  E.ward = function (n) { S.ward = n == null ? 100 : n; };
  /** 呼び寄せの香（MENUS の依頼。i_lure: encounter +100%）: n 歩のあいだ出現の率を 2 倍に */
  E.lure = function (n) { S.lure = n == null ? 100 : n; };
  /** 松明（RULES・MENUS の依頼。i_torch: use.effects [{type:'light', r, steps}]）。暗がりの外で使っても働く（歩数は減る） → true */
  F.light = function (r, steps) {
    S.torch = { r: Math.max(1, r || 6), steps: steps == null ? 200 : steps };
    try { R.Audio.sfx('lamp'); } catch (e) { /* */ }
    return true;
  };
  /** 今の松明 {r, steps} | null（HUD・テスト用） */
  F.torch = function () { return S.torch && S.torch.steps > 0 ? { r: S.torch.r, steps: S.torch.steps } : null; };

  // ---------------------------------------------------------------- 調べる（A）
  function frontObj(x, y, lv) {
    const list = R.MapUtil.objectsAt(S.map, x, y, lv);
    let best = null;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o.type === 'chest' || o.type === 'spring' || o.type === 'brazier' || o.type === 'sign' || o.type === 'examine' || o.type === 'waylamp' ||
        (o.type === 'switch' && o.look !== 'plate')) { best = o; break; }
    }
    return best;
  }
  /** 向いた先の調べられる物 → {kind:'npc'|'obj', npc?, obj?, x, y, label} | null（HUD の吹き出しも使う） */
  F._front = function () {
    if (!S.map) return null;
    const d = DIRS[S.dir] || DIRS.s;
    const tx = S.x + d[0], ty = S.y + d[1];
    let n = F._npcAt(tx, ty, S.lv);
    // 店の台の向こうの人にも話せる（台が solid の物で、その先に人）
    if (!n && F._objBlocks(S.map, tx, ty, S.lv) && !frontObj(tx, ty, S.lv)) n = F._npcAt(tx + d[0], ty + d[1], S.lv);
    if (n) return { kind: 'npc', npc: n, x: n.x, y: n.y, label: '話す' };
    const o = frontObj(tx, ty, S.lv) || frontObj(S.x, S.y, S.lv);
    if (!o) return null;
    let label = '調べる';
    const G = R.Game;
    if (o.type === 'chest') { if (G && (G.chests[S.map.id] || []).includes(o.id)) return null; label = '開ける'; }
    else if (o.type === 'spring') label = R.MapUtil.springLook(S.map, o) === 'goddess' ? '女神の像に祈る' : '泉で休む';
    else if (o.type === 'sign') label = '読む';
    else if (o.type === 'brazier') { if (G && (G.lit[S.map.id] || []).includes(o.id)) return null; label = '火をともす'; }
    else if (o.type === 'waylamp') { if (G && G.lamps[o.id]) return null; }
    return { kind: 'obj', obj: o, x: o.x, y: o.y, label };
  };

  F._act = function () {
    const f = F._front();
    if (!f) return;
    if (f.kind === 'npc') { F._talk(f.npc); return; }
    const o = f.obj, m = S.map;
    if (o.type === 'sign') { F._run(() => (R.Events.makeEv ? R.Events.makeEv({ map: m.id }).say(null, o.text) : R.UIK.Message.say({ text: o.text, face: false }))); return; }
    if (o.type === 'examine' && o.event) { R.Events.run(o.event, { map: m.id, x: o.x, y: o.y }); return; }
    if (o.type === 'chest') { F._openChest(o); return; }
    if (o.type === 'spring') { F._spring(o); return; }
    if (o.type === 'brazier') { F._brazier(o); return; }
    if (o.type === 'switch') { F._switch(o, 'act'); return; }
    if (o.type === 'waylamp' && o.event) R.Events.run(o.event, { map: m.id, x: o.x, y: o.y });
  };
  /** 看板のようにイベントの外で会話を出すとき: 止めて、終わったら外す */
  F._run = async function (fn) {
    F.lock('talk');
    try { await fn(); } finally { F.unlock('talk'); }
  };

  F._openChest = function (o) {
    const G = R.Game, m = S.map;
    const list = (G.chests[m.id] = G.chests[m.id] || []);
    if (list.includes(o.id)) return;
    list.push(o.id);
    const loot = R.Rules.chestLoot(o, R.Tier.get(), R.rng(G.seed + ':' + m.id + ':' + o.id)) || {};
    try { R.Audio.sfx('chest'); } catch (e) { /* */ }
    // 手に入れた物は画面下の文の窓で出す（持ち主の決まり 2026-09-27: 右上の通知だと気づきにくい）
    let text = '宝箱は、からっぽだった。';
    if (loot.gold) {
      G.gold += loot.gold;
      text = `宝箱を開けた！\n${loot.gold} ゴールドを手に入れた！`;
    } else if (loot.item) {
      const r = R.State.gain(loot.item, loot.n || 1) || {};
      const it = R.DB.items[loot.item] || {};
      const nm = r.name || it.name || loot.item;
      const star = it.grade === 'super' ? '★★' : it.grade === 'rare' ? '★' : '';
      text = `宝箱を開けた！\n${star}${nm}${(loot.n || 1) > 1 ? ' ×' + loot.n : ''}を手に入れた！`;
    }
    F.chunks.dirtyAt(o.x, o.y);
    F.hud.refresh();
    R.emit('chest:open', { map: m.id, id: o.id });
    F._run(() => R.UIK.Message.say({ text, face: false }));
  };
  F._spring = function (o) {
    const G = R.Game, m = S.map;
    R.Party.restoreAll();
    const L = (G.springs[m.id] = G.springs[m.id] || []);
    if (!L.includes(o.id)) L.push(o.id);
    try { R.Audio.sfx('spring'); } catch (e) { /* */ }
    const goddess = R.MapUtil.springLook(m, o) === 'goddess';   // ダンジョンの中は女神の像（持ち主の決まり 2026-09）
    F.flash(goddess ? '#ffe8b8' : '#8fe8f0', 420);
    F.hud.refresh();
    R.emit('spring:use', { map: m.id, id: o.id });
    if (!goddess) { F.hud.toast('泉の水で元気になった', { icon: 'spring' }); return; }
    // 女神の像: 祈りの文（画面下の窓）を読んでから、回復の知らせ（全快そのものは上で済んでいる）
    F._run(async () => {
      await R.UIK.Message.say({ text: '女神の像に祈りをささげた。\n……体に力が満ちていく。', face: false });
      F.hud.toast('女神の像の加護で HP・MP が回復した', { icon: 'spring' });
    });
  };
  F._brazier = function (o) {
    const G = R.Game, m = S.map;
    const L = (G.lit[m.id] = G.lit[m.id] || []);
    if (L.includes(o.id)) return;
    L.push(o.id);
    try { R.Audio.sfx('lamp'); } catch (e) { /* */ }
    F.chunks.dirtyAt(o.x, o.y);
    R.emit('lamp:lit', { id: o.id, map: m.id });
    if (o.event) R.Events.run(o.event, { map: m.id, x: o.x, y: o.y });
  };
  /** スイッチ（E7）: plate は踏むと、lever・hole は調べると。by:'guest' はついてくる人がいるときだけ */
  F._switch = function (o, how) {
    const G = R.Game, m = S.map;
    if (!G || !o.flag) return;
    if (o.by === 'guest' && !S.guest) {
      if (how === 'act') F.hud.toast('小さな穴だ。ここを通れる人がいれば……。', { icon: 'search', anchor: 'bl' });
      return;
    }
    const on = o.look === 'plate' ? true : !G.flags[o.flag];
    if (!!G.flags[o.flag] === on) return;
    G.flags[o.flag] = on;
    try { R.Audio.sfx(on ? 'unlock' : 'cursor'); } catch (e) { /* */ }
    R.emit('switch', { map: m.id, id: o.id, on });
    R.emit('flag', { id: o.flag, v: on });
  };
})(window.RPG);
