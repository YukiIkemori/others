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

  /** 1 歩を始める。→ true（動いた） */
  F._step = function (dx, dy, dash) {
    const prevDir = S.dir;
    S.dir = R.U.dirOf(dx, dy, S.dir);
    if (S.dir !== prevDir && R.Game && R.Game.pos) R.Game.pos.dir = S.dir;
    let go = null;
    if (dx && dy) {
      // 斜めは両隣の軸も通れるときだけ。だめなら空いた軸へ滑る（A7）
      if (canGo(dx, dy) >= 0 && canGo(dx, 0) >= 0 && canGo(0, dy) >= 0) go = [dx, dy];
      else if (canGo(dx, 0) >= 0) go = [dx, 0];
      else if (canGo(0, dy) >= 0) go = [0, dy];
      if (go) S.dir = R.U.dirOf(go[0], go[1], S.dir);
    } else {
      const r = canGo(dx, dy);
      if (r >= 0) go = [dx, dy];
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
    const t0 = now - S.lastEnd < 60 ? S.lastEnd : now;
    const ms = (dash ? F.DASH_MS : F.WALK_MS) * (go[0] && go[1] ? 1.41 : 1);
    F._trailPush(S.x, S.y, S.lv, S.dir);
    S.mv = { fx: S.x, fy: S.y, tx: nx, ty: ny, t0, ms, dx: go[0], dy: go[1], dash: !!dash };
    S.x = nx; S.y = ny; S.lv = nlv;
    F._trailStart(S.mv);
    S.phase = (S.phase + 1) & 1023;
    return true;
  };

  /** 毎フレーム（tick。場面が上に積まれていても進む）: 歩き終わったら入った瞬間の判定 */
  F._tickMove = function () {
    const m = S.mv;
    if (!m) return;
    if (R.Engine.time - m.t0 < m.ms) return;
    S.lastEnd = m.t0 + m.ms;
    S.mv = null;
    F._trailEnd();
    const p = F._arrive();
    if (p && p.then) {
      S.arriving = true;
      p.then(() => { S.arriving = false; }, (e) => { S.arriving = false; console.error(e); });
    }
  };

  function inRect(x, y, r) { return x >= r.x && y >= r.y && x < r.x + (r.w || 1) && y < r.y + (r.h || 1); }

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
      (G.secrets[m.id] = G.secrets[m.id] || []).push(S.x + ',' + S.y);
      F.chunks.dirtyAt(S.x, S.y);
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
        return F.enter(o.to.map, o.to.spawn);
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
  /** 出現しない所: 泉の周り 3 マス、ともした道しるべの灯籠の周り 5 マス（E21） */
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
    else if (o.type === 'spring') label = '泉で休む';
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
    if (loot.gold) {
      G.gold += loot.gold;
      F.hud.toast(`${loot.gold} Gを手に入れた`, { icon: 'coin' });
    } else if (loot.item) {
      const r = R.State.gain(loot.item, loot.n || 1) || {};
      const nm = r.name || (R.DB.items[loot.item] && R.DB.items[loot.item].name) || loot.item;
      F.hud.toast(`${nm}${(loot.n || 1) > 1 ? ' ×' + loot.n : ''}を手に入れた`, { icon: 'chest' });
    }
    F.chunks.dirtyAt(o.x, o.y);
    F.hud.refresh();
    R.emit('chest:open', { map: m.id, id: o.id });
  };
  F._spring = function (o) {
    const G = R.Game, m = S.map;
    R.Party.restoreAll();
    const L = (G.springs[m.id] = G.springs[m.id] || []);
    if (!L.includes(o.id)) L.push(o.id);
    try { R.Audio.sfx('spring'); } catch (e) { /* */ }
    F.flash('#8fe8f0', 420);
    F.hud.toast('泉の水で元気になった', { icon: 'spring' });
    F.hud.refresh();
    R.emit('spring:use', { map: m.id, id: o.id });
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
