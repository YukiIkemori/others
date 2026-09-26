// BSCENE: 戦闘の場面（場面の id 'battle'、opaque）。R.Battle.start(setup) → Promise<{result, to?, rewards}>（V2_PLAN §2.5.13・§2.5.3）
//
// 順番（仮の実装 stub_battle.js と同じ。§2.11）:
//   setup.boss なら R.Save.autosave('boss') → R.Save.checkpoint('battle', {setup, seed}) → 'battle:start' → pushBgm → touchLayout('battle')
//   → ラウンド（一行の命令 → 1 人ずつの行動 → B.round() の出来事を順に演出）→ over で B.finish()（1 回）
//   → 勝ち: 勝利と報酬 / 逃げた / 負け: canLose なら 'lose'、ほかは全滅の画面（直前の戦闘から／宿から／タイトルへ）
//   → 場面を外す → popBgm → touchLayout(前) → 'battle:end' → 勝ちは autosave('battle')
//   → 全滅の宿は R.State.wipeRecover() ＋ await R.Flow.wipe('inn')、タイトルは await R.Flow.wipe('title') → 解決。
//   「直前の戦闘から」は R.Save.restore('battle') と同じ setup（setup.retry = n。戦闘の種は BATTLE が seed + retry）で続ける（Promise はまだ解決しない）。
//
// テスト・スクショの口（dev）: R.Battle.hooks.create = (setup) => 戦闘の 1 回（本物の代わり）、setup.demo = '<名前>'（demo.js の台本）、
// R.Battle.debug() → 今の状態、R.Battle.MIN（最短の表示時間の表）
(function (R) {
  'use strict';
  if (R.Stubs && R.Stubs.claim) R.Stubs.claim('Battle');
  const Bt = (R.Battle = R.Battle || {});
  const _ = (Bt._ = Bt._ || {});
  Bt.hooks = Bt.hooks || { create: null };
  let current = null;

  /** 最短の表示時間（実時間の ms。倍速・早送りでも守る）A12・MODERN_UI §3.6・§6.17 */
  Bt.MIN = { rareCard: 1500, rareCardSkip: 600, glimmerName: 900, victoryAuto: 1500 };

  Bt.debug = () => current;
  Bt.active = () => !!current;

  function speed() { const s = +R.Settings.get('battleSpeed'); return s === 2 || s === 3 ? s : 1; }

  function makeCore(setup) {
    if (setup.demo && _.demo) return _.demo.create(setup);
    if (typeof Bt.hooks.create === 'function') return Bt.hooks.create(setup);
    return R.BattleCore.create(setup);
  }

  // ---------------------------------------------------------------- 状態
  function newState(setup, info) {
    const st = {
      setup, info, B: null, retry: 0,
      L: _.layout.compute(),
      vis: {}, actors: [], ui: null, head: null, pops: [], fxs: [], hot: null, ghost: {}, activeUid: null, glowUid: null,
      clock: 0, phase: 'intro', banner: null, tele: null, card: null, dim: 0, shake: null, result: null, over: null,
      partyOpts: ['fight'], chipRects: {}, chipTap: null, collected: { gains: [], grow: [], prof: [], glimmers: [] },
      log: [],   // テスト用: 演出した出来事の種類と時間
    };
    st.speed = speed;
    st.unit = (uid) => (st.B ? st.B.units.find((u) => u.uid === uid) : null) || st.extra[uid] || null;
    st.extra = {};
    st.actor = (uid) => st.actors.find((a) => a.uid === uid) || null;
    st.partyUnits = () => (st.B ? st.B.units.filter((u) => u.side === 'party') : []);
    st.enemyUnits = () => st.actors.filter((a) => a.side === 'enemy').map((a) => st.unit(a.uid)).filter(Boolean);
    st.aliveEnemies = () => st.actors.filter((a) => a.side === 'enemy' && st.vis[a.uid] && st.vis[a.uid].alive && !(st.vis[a.uid].gone >= 1));
    /** 戦闘の時計で待つ（倍速・A の早送りに従う） */
    st.pwait = (ms) => { const at = st.clock + (ms > 0 ? ms : 0); return R.until(() => st.clock >= at || st.dead); };
    /** 実時間で待つ（最短の表示時間） */
    st.rwait = (ms) => R.wait(ms);
    st.mul = () => speed() * (st.phase === 'play' && R.Input.down('a') ? 2.5 : 1);
    return st;
  }

  function visOf(u) {
    return {
      hp: u.hp, mp: u.mp, maxHp: u.maxHp, maxMp: u.maxMp, alive: !!u.alive, status: (u.status || []).slice(),
      pose: u.alive ? 'idle' : (u.side === 'party' ? 'ko' : 'idle'), poseT: 0, dx: 0, dy: 0, flash: 0,
      gone: u.side === 'enemy' && !u.alive ? 1 : 0, appear: 1,
    };
  }
  function actorOf(u) {
    const k = _.actors.keyOf(u);
    return { uid: u.uid, side: u.side, id: u.id, name: u.name, look: u.look || u.sprite, sprite: u.sprite, wtype: u.wtype, size: u.size, boss: !!u.boss, golden: !!u.golden, key: k.key, opts: k.opts, x: 0, y: 0 };
  }
  /** 配置（最初と画面の大きさが変わったとき） */
  function place(st) {
    st.L = _.layout.compute();
    const party = st.actors.filter((a) => a.side === 'party');
    const foes = st.actors.filter((a) => a.side === 'enemy');
    const ps = _.layout.partySpots(st.L, party.map((a) => st.unit(a.uid) || a));
    const es = _.layout.enemySpots(st.L, foes.map((a) => st.unit(a.uid) || a));
    for (const a of party) Object.assign(a, ps[a.uid]);
    for (const a of foes) if (es[a.uid]) Object.assign(a, es[a.uid]);
  }
  /** 戦闘の 1 回を作る（最初と「直前の戦闘から」） */
  function initCore(st) {
    const setup = st.retry ? Object.assign({}, st.setup, { retry: st.retry }) : st.setup;
    st.B = makeCore(setup);
    st.actors = []; st.vis = {}; st.extra = {}; st.pops = []; st.fxs = [];
    st.collected = { gains: [], grow: [], prof: [], glimmers: [] };
    st.tele = null; st.card = null; st.banner = null; st.dim = 0; st.result = null; st.over = null;
    for (const u of st.B.units) { st.actors.push(actorOf(u)); st.vis[u.uid] = visOf(u); }
    place(st);
    prebake(st);
  }
  /** 戦闘の開始で足りない物だけ同期で焼く（背景 → 敵の待機 → 味方の待機。§2.10）。出撃中の 4 人の絵は pin */
  function prebake(st) {
    if (!R.Hd) return;
    try {
      const bk = bgKey(st);
      if (bk && R.Hd.has && R.Hd.has(bk) && !R.Hd.ready(bk, bgOpts())) R.Hd.now(bk, bgOpts());
      for (const a of st.actors) {
        if (!R.Hd.has || !R.Hd.has(a.key)) continue;
        if (!R.Hd.ready || !R.Hd.ready(a.key, a.opts)) R.Hd.now(a.key, a.opts);
        if (a.side === 'party' && R.Hd.pin) { R.Hd.pin(a.key); (st.pinned = st.pinned || []).push(a.key); }
      }
    } catch (e) { console.error('[battle prebake]', e); }
  }
  function bgKey(st) { const id = st.setup.bg || (st.info.troop && st.info.troop.bg); return id ? 'hd:bbg:' + id : null; }
  function bgOpts() { return { w: R.W, h: R.H }; }

  // ---------------------------------------------------------------- 流れ
  async function intro(st) {
    st.phase = 'intro';
    const foes = st.actors.filter((a) => a.side === 'enemy');
    for (const a of foes) { st.vis[a.uid].appear = 0; }
    const names = [...new Set(foes.map((a) => a.name))];
    st.head = { name: names.length ? `${names.slice(0, 3).join('・')}${names.length > 3 ? 'たち' : ''}が あらわれた！` : '戦闘', t0: R.Engine.time };
    if (st.info.boss && R.Audio.sfx) R.Audio.sfx('roar');
    if (foes.some((a) => a.golden)) { try { R.Audio.jingle('rare'); } catch (e) { /* ignore */ } st.head.sub = 'めったに出会えない魔物だ！'; }
    const t0 = st.clock;
    await R.until(() => {
      const k = Math.min(1, (st.clock - t0) / 420);
      for (const a of foes) st.vis[a.uid].appear = k;
      return k >= 1 || st.dead;
    });
    await st.pwait(500);
  }

  async function inputPhase(st) {
    const B = st.B;
    st.phase = 'input';
    st.partyOpts = (B.partyOptions && B.partyOptions()) || ['fight'];
    if (B.repeatOn) { B.repeat(); return true; }
    // 見本・テスト用: setup.autoInput なら全員「攻撃」で進める（画面の入力なし）
    if (st.setup.autoInput) {
      for (const u of st.partyUnits()) if (st.vis[u.uid] && st.vis[u.uid].alive) { const t = st.aliveEnemies()[0]; B.submit(u.uid, { cmd: 'attack', id: 'attack', target: t ? t.uid : null }); }
      await st.pwait(300);
      return true;
    }
    let choice = 'fight';
    if (!st.L.tall) choice = await _.cmd.partyMenu(st);
    for (;;) {
      if (choice === 'repeat') { B.setRepeat(true); B.repeat(); return true; }
      if (choice === 'escape') { B.escape(); return true; }
      const r = await _.cmd.commandRound(st);
      if (r === 'ok') return true;
      if (r && r.party) { choice = r.party; continue; }
      if (r === 'back' && !st.L.tall) { choice = await _.cmd.partyMenu(st); continue; }
    }
  }

  async function outcome(st) {
    const B = st.B, over = B.over;
    st.over = over;
    let rewards = null;
    try { rewards = B.finish ? B.finish() : B.rewards(); } catch (e) { console.error('[battle finish]', e); }
    if (over === 'win') { await _.result.victory(st, rewards); return { result: 'win', rewards: rewards || null }; }
    if (over === 'escape') { await _.result.escape(st); return { result: 'escape', rewards: null }; }
    // 負け
    if (st.setup.canLose) { await _.result.lose(st); return { result: 'lose', rewards: null }; }
    const ch = await _.gameover.run(st);
    if (ch === 'retry') {
      R.Save.restore('battle');
      st.retry++;
      initCore(st);
      try { R.Audio.bgm(st.info.bgm, { fade: 300 }); } catch (e) { /* ignore */ }
      await intro(st);
      return null;
    }
    return { result: 'abort', to: ch === 'title' ? 'title' : 'inn' };
  }

  async function run(st) {
    initCore(st);
    await intro(st);
    let empty = 0;
    for (;;) {
      if (st.dead) return;
      if (!st.B.over) {
        const go = await inputPhase(st);
        if (!go) continue;
        _.play.snapshot(st);
        let evs = [];
        try { evs = st.B.round() || []; } catch (e) { console.error('[battle round]', e); R.Engine.reportError && R.Engine.reportError(e); }
        empty = evs.length ? 0 : empty + 1;
        await _.play.run(st, evs);
        if (!evs.length) await st.pwait(80);
        if (empty > 50 && !st.B.over) { console.error('[battle] the core returned no events 50 times; ending as escape'); st.forceOver = 'escape'; }
      }
      if (st.B.over || st.forceOver) {
        if (st.forceOver && !st.B.over) { await st.finish({ result: 'escape', rewards: null }); return; }
        const out = await outcome(st);
        if (out) { await st.finish(out); return; }
      }
    }
  }

  // ---------------------------------------------------------------- 場面
  function makeScene(st) {
    return {
      id: 'battle',
      opaque: true,
      enter() { R.Input.touchLayout('battle'); },
      exit() {},
      onLayout() { place(st); },
      update(dt) {
        st.clock += dt * st.mul();
        const I = R.Input;
        // 倍速（R）: どの場面でも
        if (I.pressed('r') && st.phase !== 'result' && st.phase !== 'gameover') {
          const s = speed(), n = s === 1 ? 2 : s === 2 ? 3 : 1;
          R.Settings.set('battleSpeed', n);
          if (R.Audio.sfx) R.Audio.sfx('cursor');
        }
        // 縦持ちの札（タップ）
        const p = I.pointer;
        if (p && p.pressed && st.chipRects) {
          for (const k of Object.keys(st.chipRects)) {
            const r = st.chipRects[k];
            if (r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y - 6 && p.y <= r.y + r.h + 6) {
              if (k === 'speed') { const s = speed(); R.Settings.set('battleSpeed', s === 1 ? 2 : s === 2 ? 3 : 1); }
              else if (st.phase === 'play' && k === 'repeat' && st.B.repeatOn) { st.B.setRepeat(false); }
              else if (st.phase === 'input') st.chipTap = k;
              if (I.consume) I.consume();
              return;
            }
          }
        }
        // リピート中は B で止める（A6: 止めるまで毎ラウンド続く）
        if (st.phase === 'play' && st.B && st.B.repeatOn && I.pressed('b')) {
          st.B.setRepeat(false);
          if (R.UIK && R.UIK.toast) R.UIK.toast('リピートを止めた', { anchor: 'bl' });
        }
        _.play.tick(st, dt);
        _.glimmer.tick(st);
        if (st.ui && st.ui.update) st.ui.update(dt);
      },
      draw(g) { draw(g, st); },
    };
  }

  // ---------------------------------------------------------------- 戦闘背景の層と光（BEAST の依頼 22: R.Beast.stage が見本）
  function layer(c, sh, name, mode) {
    for (const i of (sh.poses && sh.poses[name]) || []) {
      if (mode) { c.save(); c.globalCompositeOperation = mode; }
      R.Hd.draw(c, sh.frames[i], 0, 0, {});
      if (mode) c.restore();
    }
  }
  const LAY = { a: null, m: null };
  function canvasOf(k, w, h) {
    let c = LAY[k];
    if (!c || c.width !== w || c.height !== h) { c = LAY[k] = R.Hd.RZ.canvas(w, h); }
    return c;
  }
  /** 光の地図（戦闘ごとに 1 回。灯りは背景のランタンの位置で動かない） */
  function stageLightMap(st, sh) {
    const m = sh.meta || {};
    const key = [sh.w, sh.h, m.mood, m.lantern && m.lantern.x, m.lantern && m.lantern.y].join('|');
    if (st.lmap && st.lmapKey === key) return st.lmap;
    const W = sh.w || R.W, H = sh.h || R.H;
    const md = R.Hd.mood ? R.Hd.mood(m.mood) : null;
    const amb = (md && md.ambient) || m.ambient || 'rgb(92,84,150)';
    const lk = Math.min(W, H * 16 / 9);
    const lx = m.lantern ? m.lantern.x : W * 0.52, ly = m.lantern ? m.lantern.y : H * 0.7;
    const lights = [{ x: lx, y: ly - 6, r: Math.round(lk * 0.34), color: 'rgb(255,200,130)', k: 0.8, sy: 0.55 }, { x: lx, y: ly - 4, r: Math.round(lk * 0.12), color: 'rgb(255,228,186)', k: 0.45, sy: 0.6 }];
    let map = null;
    try { map = R.Light && R.Light.map ? R.Light.map({ x: 0, y: 0, w: W, h: H }, { ambient: amb, k: 1, lights, mood: m.mood }) : null; } catch (e) { map = null; }
    if (!map && R.Beast && R.Beast.lightMap) { try { map = R.Beast.lightMap(W, H, { ambient: amb, lights }); } catch (e) { map = null; } }
    st.lmap = map; st.lmapKey = key;
    return map;
  }
  /**
   * 地面・影・人と敵・手前を 1 枚の層に描き、その層の不透明な所にだけ光の地図を multiply（meta.light === 'layer'）。
   * 夜空（back）を二重に暗くせず、地平より上に出る大きいボス・人も上下で明るさが割れない。層は実キャンバスの解像度で、g と同じ変換。
   */
  function litStage(g, st, sh, mid) {
    if (!g.canvas || !g.getTransform || !(R.Hd.RZ && R.Hd.RZ.canvas)) return false;
    const map = stageLightMap(st, sh);
    if (!map) return false;
    const cw = g.canvas.width, ch = g.canvas.height;
    const A = canvasOf('a', cw, ch), M = canvasOf('m', cw, ch);
    const ax = A.getContext('2d'), mx = M.getContext('2d');
    const tf = g.getTransform();
    ax.setTransform(1, 0, 0, 1, 0, 0); ax.globalCompositeOperation = 'source-over'; ax.globalAlpha = 1; ax.clearRect(0, 0, cw, ch);
    ax.setTransform(tf); ax.imageSmoothingEnabled = false;
    mid(ax);
    // 光の地図を層の形で切り抜く
    mx.setTransform(1, 0, 0, 1, 0, 0); mx.globalCompositeOperation = 'source-over'; mx.clearRect(0, 0, cw, ch);
    mx.setTransform(tf); mx.imageSmoothingEnabled = true;
    mx.drawImage(map, 0, 0, sh.w || R.W, sh.h || R.H);
    mx.setTransform(1, 0, 0, 1, 0, 0);
    mx.globalCompositeOperation = 'destination-in'; mx.drawImage(A, 0, 0);
    ax.setTransform(1, 0, 0, 1, 0, 0);
    ax.globalCompositeOperation = 'multiply'; ax.drawImage(M, 0, 0);
    ax.globalCompositeOperation = 'source-over';
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.drawImage(A, 0, 0); g.restore();
    return true;
  }

  function draw(g, st) {
    const L = st.L, t = R.Engine.time;
    g.save();
    // 画面の揺れ（設定 shake）
    if (st.shake) {
      const e = (t - st.shake.t0) / st.shake.ms;
      if (e >= 1) st.shake = null;
      else { const amp = st.shake.amp * (1 - e) * (R.Settings.get('shake') === 'weak' ? 0.4 : 1); g.translate(Math.round(Math.sin(t / 22) * amp), Math.round(Math.cos(t / 31) * amp * 0.5)); }
    }
    // 背景（BEAST の R.Beast.stage と同じ順: back → [層: ground → 影と人と敵 → front → 層にだけ光を multiply] → post（lighter）→ R.Post.frame）
    const bk = bgKey(st);
    const sh = bk && R.Hd && R.Hd.has && R.Hd.has(bk) ? R.Hd.get(bk, bgOpts()) : null;
    let lantern = L.lantern;
    const baked = !!(sh && sh.frames && sh.poses);
    if (baked && sh.meta && sh.meta.lantern) lantern = [sh.meta.lantern.x, sh.meta.lantern.y];
    const order = st.actors.slice().sort((a, b) => a.y - b.y);
    const mid = (c) => {
      if (baked) layer(c, sh, 'ground');
      _.actors.lanternPool(c, { lantern, tall: L.tall, baked }, t);
      for (const a of order) _.actors.shadow(c, st, a);
      for (const a of order) _.actors.draw(c, st, a);
      if (baked) layer(c, sh, 'front');
    };
    if (baked) {
      layer(g, sh, 'back');
      const lit = litStage(g, st, sh, mid);
      if (!lit) mid(g);
      layer(g, sh, 'post', (sh.meta && sh.meta.postMode) || 'lighter');
    } else {
      const c = _.actors.fallbackBg(L, st.setup.bg || (st.info.troop && st.info.troop.bg) || 'night');
      if (c) g.drawImage(c, 0, 0, R.W, L.stageH);
      else { g.fillStyle = '#141a38'; g.fillRect(0, 0, R.W, R.H); }
    }
    if (L.tall) {
      const gr = g.createLinearGradient(0, L.stageH - 70, 0, L.stageH);
      gr.addColorStop(0, 'rgba(12,12,20,0)'); gr.addColorStop(1, 'rgba(12,12,20,1)');
      g.fillStyle = gr; g.fillRect(0, L.stageH - 70, R.W, 70);
      g.fillStyle = '#0c0c14'; g.fillRect(0, L.stageH - 1, R.W, R.H - L.stageH + 1);
    }
    if (!baked) mid(g);
    _.play.drawFx(g, st);
    g.restore();
    // 仕上げ（世界の最後・HUD の前。RENDER の依頼: mood は背景の meta.mood）
    if (R.Post && R.Post.frame) { try { R.Post.frame(g, { mood: (sh && sh.meta && sh.meta.mood) || 'night' }); } catch (e) { /* 仕上げは無くてもよい */ } }
    if (st.dim > 0) { g.fillStyle = `rgba(6,6,14,${st.dim})`; g.fillRect(0, 0, R.W, R.H); }
    _.glimmer.drawWorld(g, st);
    // HUD
    _.hud.enemyTags(g, st);
    _.play.drawPops(g, st);
    if (!st.result && st.phase !== 'gameover') {
      _.hud.party(g, st);
      _.hud.head(g, st);
      _.hud.chips(g, st);
      _.play.drawTele(g, st);
    }
    _.glimmer.drawBanner(g, st);
    if (st.go) _.gameover.draw(g, st);
    if (st.ui && st.ui.draw) st.ui.draw(g);
    _.play.drawCard(g, st);
    const pr = st.ui && st.ui.prompts ? st.ui.prompts : st.phase === 'play' ? (st.B && st.B.repeatOn ? [{ btn: 'a', label: '早送り' }, { btn: 'b', label: 'リピートを止める' }, { btn: 'r', label: '速さ' }] : [{ btn: 'a', label: '早送り' }, { btn: 'r', label: '速さ' }]) : null;
    if (pr && !(L.tall && st.ui && st.ui.tallPrompts === false)) _.K.prompts(g, pr);
  }

  // ---------------------------------------------------------------- R.Battle.start
  Bt.start = function (setup) {
    setup = setup || {};
    return new Promise((resolve) => {
      const troop = setup.troop && R.DB.troops ? R.DB.troops[setup.troop] : null;
      const boss = !!(setup.boss || (troop && troop.boss));
      if (boss) R.Save.autosave('boss');   // ボスの直前（§3.13）。戦闘の場面を積む前に
      R.Save.checkpoint('battle', { setup, seed: R.Game ? R.Game.seed : 0 });
      R.emit('battle:start', { setup });
      const bgm = setup.bgm || (troop && troop.bgm) || (boss ? 'boss' : 'battle');
      R.Audio.pushBgm(bgm);
      const prevLayout = R.Input.layoutName;
      const st = newState(setup, { boss, bgm, troop });
      let fin = false;
      st.finish = async (res) => {
        if (fin) return; fin = true;
        st.dead = true;
        _.voice.stop();
        R.Engine.remove(st.scene, res);
        R.Audio.popBgm();
        R.Input.touchLayout(prevLayout);
        for (const k of st.pinned || []) { try { R.Hd.unpin(k); } catch (e) { /* ignore */ } }
        if (current === st) current = null;
        R.emit('battle:end', res);
        if (res.result === 'win') R.Save.autosave('battle');
        if (res.result === 'abort') {
          if (res.to === 'inn') R.State.wipeRecover();
          await R.Flow.wipe(res.to);
        }
        resolve(res);
      };
      st.scene = makeScene(st);
      current = st;
      R.Engine.push(st.scene);
      run(st).catch((e) => {
        console.error('[battle]', e);
        if (R.Engine.reportError) R.Engine.reportError(e);
        st.finish({ result: st.B && st.B.over === 'win' ? 'win' : 'escape', rewards: null });
      });
    });
  };
})(window.RPG);
