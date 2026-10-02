// BSCENE: 戦闘の場面（場面の id 'battle'、opaque）。R.Battle.start(setup) → Promise<{result, to?, rewards}>（V2_PLAN §2.5.13・§2.5.3）
//
// 順番（仮の実装 stub_battle.js と同じ。§2.11）:
//   setup.boss なら R.Save.autosave('boss') → R.Save.checkpoint('battle', {setup, seed}) → 'battle:start' → pushBgm → touchLayout('battle')
//   → 入る移り（trans.js: 今の画面が砕ける／ボスは闇に閉じる）→ 真っ暗で場面を積む → intro（明ける・一行が右から入る・敵が浮かぶ・ボスは名前の札）
//   → ラウンド（一行の命令 → 1 人ずつの行動 → B.round() の出来事を順に演出）→ over で B.finish()（1 回）
//   → 勝ち: 勝利と報酬 / 逃げた / 負け: canLose なら 'lose'、ほかは全滅の画面（直前の戦闘から／宿から／タイトルへ）
//   → [決定を待つ（勝利・逃げた・負け。自動では閉じない、2026-09-27）] → 声を切らない（勝利の声は手放す・ほかは鳴り終わりを待つ）
//   → 暗くなる（Bt.FADE.out）→ 場面を外す → popBgm → touchLayout(前) → 'battle:end' → 勝ちは autosave('battle') → フィールドが明ける（Bt.FADE.in）
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
  Bt.MIN = { rareCard: 1500, rareCardSkip: 600, glimmerName: 900, victoryAuto: 1500 };   // victoryAuto は使わない（2026-09-27: 勝利の札は決定を押すまで閉じない）
  /** 出る暗転・フィールドが明ける時間（実時間の ms） */
  Bt.FADE = { out: 500, in: 450, reduce: 250 };

  Bt.debug = () => current;
  Bt.active = () => !!current;

  // ---------------------------------------------------------------- 戦闘をまたぐリピート（2026-09-27 の持ち主の決まり）
  // 入れたら次の戦闘でも最初のラウンドから続く（最後の命令をそのまま、相手は生きている最初の敵。使えない命令は攻撃）。
  // ボス・レア・金色の戦闘は一時止める（ふつうの入力で始まる。次のふつうの戦闘でまた続く）。B で止めたら次の戦闘からも止まる。
  // 覚える所: R.Game.battle.repeat = {on, cmds}（セーブにも入る）。R.Game が無いときはこの場の記憶。
  const repMem = { on: false, cmds: null };
  Bt.repeatMemory = function () {
    const G = R.Game;
    if (!G) return repMem;
    G.battle = G.battle || { cursor: {}, lastRound: [] };
    if (!G.battle.repeat || typeof G.battle.repeat !== 'object') G.battle.repeat = { on: false, cmds: null };
    return G.battle.repeat;
  };
  /** リピートを一時止める戦闘（ボス・レア・金色・メタル） */
  Bt.repeatSuspends = function (st) {
    if (st.info && (st.info.boss || st.info.heavy)) return true;
    if (st.setup && (st.setup.rare || st.setup.boss)) return true;
    const us = (st.B && st.B.units) || [];
    return us.some((u) => u.side === 'enemy' && (u.boss || u.golden || u.rare || u.metal));
  };
  function repeatCarry(st) {
    const m = Bt.repeatMemory();
    st.repeatSuspended = false;
    if (m.on && st.B && typeof st.B.seedRepeat === 'function') {
      if (Bt.repeatSuspends(st)) st.repeatSuspended = true;
      else if (st.B.seedRepeat(m.cmds || {})) { st.B.setRepeat(true); st.repeatCarried = true; }
    }
    st._repOn = !!(st.B && st.B.repeatOn);
  }
  /** 毎フレーム: 入れた・止めたを覚える（一時止めの戦闘で何もしなければ on のまま） */
  function repeatWatch(st) {
    if (!st.B) return;
    const on = !!st.B.repeatOn;
    if (on !== st._repOn) { st._repOn = on; Bt.repeatMemory().on = on; }
  }
  function repeatRemember(st) {
    if (!st.B || typeof st.B.lastCommands !== 'function') return;
    const c = st.B.lastCommands();
    if (c) Bt.repeatMemory().cmds = c;
  }

  // 速さの段（倍率）: 通常 ×1・＋1 ×2・＋2 ×3・＋4 ×5（持ち主 2026-09-27「＋4 も」）
  const SPEEDS = [1, 2, 3, 5];
  const norm = (s) => (SPEEDS.includes(+s) ? +s : 1);
  function speed() { return norm(R.Settings.get('battleSpeed')); }
  /**
   * 戦闘の速さ（2026-09-27 の持ち主の決まり）: 1 つのボタン（R・縦持ちは札のタップ）で 通常 → ＋1 → ＋2 → ＋4 → 通常。
   * 設定 battleSpeed（1 | 2 | 3 | 5）に書くので、次の戦闘も読み込み直した後も同じ速さ。A の押しっぱなしの早送りは無くした（A は決定）。
   */
  Bt.SPEED_LABEL = { 1: R.T('battle.scene.SPEED_LABEL.1'), 2: R.T('battle.scene.SPEED_LABEL.2'), 3: R.T('battle.scene.SPEED_LABEL.3'), 5: R.T('battle.scene.SPEED_LABEL.5') };
  Bt.SPEEDS = SPEEDS;
  /** 札の ▶ の数（通常 1・＋1 2・＋2 3・＋4 4） */
  Bt.speedArrows = (s) => SPEEDS.indexOf(norm(s)) + 1;
  Bt.speedLabel = (s) => Bt.SPEED_LABEL[norm(s)];
  Bt.speedText = (s) => '▶'.repeat(Bt.speedArrows(s)) + ' ' + Bt.speedLabel(s);
  Bt.cycleSpeed = function () {
    const s = speed(), n = SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length];
    R.Settings.set('battleSpeed', n);
    try { if (R.Audio.sfx) R.Audio.sfx('cursor'); } catch (e) { /* ignore */ }
    if (current) current.speedFx = R.Engine.time;
    try { if (R.UIK && R.UIK.toast) R.UIK.toast(R.T('battle.scene.cycleSpeed.toast', { speedLabel: Bt.speedLabel(n) }), { anchor: 'bl' }); } catch (e) { /* ignore */ }
    return n;
  };

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
      clock: 0, phase: 'intro', cover: 1, hudIn: 0, bossCard: null, banner: null, tele: null, card: null, dim: 0, shake: null, result: null, over: null,
      partyOpts: ['fight'], chipRects: {}, chipTap: null, collected: { gains: [], grow: [], prof: [], glimmers: [] },
      log: [],   // テスト用: 演出した出来事の種類と時間
    };
    st.speed = speed;
    st.unit = (uid) => (st.B ? st.B.units.find((u) => u.uid === uid) : null) || st.extra[uid] || null;
    st.extra = {};
    st.actor = (uid) => st.actors.find((a) => a.uid === uid) || null;
    // 味方は隊列の順（R.Party.members() / setup.members）に並べる。人の札・顔・勝利の札はこの順（前列・後列で分けない。2026-09-27）
    st.partyUnits = () => {
      if (!st.B) return [];
      const us = st.B.units.filter((u) => u.side === 'party');
      const ord = st.partyOrder || [];
      if (!ord.length) return us;
      const at = (u) => { const i = ord.indexOf(String(u.id)); return i < 0 ? 99 + us.indexOf(u) : i; };
      return us.slice().sort((a, b) => at(a) - at(b));
    };
    st.enemyUnits = () => st.actors.filter((a) => a.side === 'enemy').map((a) => st.unit(a.uid)).filter(Boolean);
    // ねらえる敵: 絵が見えていて、中でも生きている物（呼ばれた敵も actors に入る。仮の絵・逃げた物は入れない）
    st.aliveEnemies = () => st.actors.filter((a) => {
      if (a.side !== 'enemy') return false;
      const v = st.vis[a.uid], u = st.unit(a.uid);
      return !!(v && v.alive && !(v.gone >= 1) && (!u || u.alive !== false));
    });
    /** 戦闘の時計で待つ（戦闘の速さに従う） */
    st.pwait = (ms) => { const at = st.clock + (ms > 0 ? ms : 0); return R.until(() => st.clock >= at || st.dead); };
    /** 実時間で待つ（最短の表示時間） */
    st.rwait = (ms) => R.wait(ms);
    st.mul = () => speed();
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
    return { uid: u.uid, side: u.side, id: u.id, name: u.name, look: u.look || u.sprite, sprite: u.sprite, wtype: u.wtype, size: u.size, boss: !!u.boss, golden: !!u.golden, special: !u.boss && !!(u.golden || u.rare || u.metal), metal: !!u.metal, key: k.key, opts: k.opts, x: 0, y: 0 };
  }
  /** 配置（最初と画面の大きさが変わったとき） */
  function place(st) {
    st.L = _.layout.compute();
    // 味方は隊列の順（人の札と同じ）で場所を取る
    const pord = st.partyUnits().map((u) => u.uid);
    const party = st.actors.filter((a) => a.side === 'party').sort((a, b) => pord.indexOf(a.uid) - pord.indexOf(b.uid));
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
    try { repeatCarry(st); } catch (e) { console.error('[battle repeat carry]', e); }
    try {
      const ids = setup.members && setup.members.length ? setup.members : (R.Party && R.Party.members ? R.Party.members().map((c) => c.id) : []);
      st.partyOrder = (ids || []).map(String);
    } catch (e) { st.partyOrder = []; }
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
      if (bk && R.Hd.has && R.Hd.has(bk) && !R.Hd.ready(bk, bgOpts(st))) R.Hd.now(bk, bgOpts(st));
      for (const a of st.actors) {
        if (!R.Hd.has || !R.Hd.has(a.key)) continue;
        if (!R.Hd.ready || !R.Hd.ready(a.key, a.opts)) R.Hd.now(a.key, a.opts);
        if (a.side === 'party' && R.Hd.pin) { R.Hd.pin(a.key); (st.pinned = st.pinned || []).push(a.key); }
      }
    } catch (e) { console.error('[battle prebake]', e); }
  }
  function bgKey(st) { const id = st.setup.bg || (st.info.troop && st.info.troop.bg); return id ? 'hd:bbg:' + id : null; }
  /** 戦闘背景を焼く大きさ。縦長の PC の窓は戦場の高さで（layout.js の bgH） */
  function bgOpts(st) { return { w: R.W, h: (st && st.L && st.L.bgH) || R.H }; }

  // ---------------------------------------------------------------- 流れ
  /**
   * 始まりの演出（2026-09-27）: 真っ暗（st.cover = 1、入る移りの続き）から戦場が明け、一行が右から歩いて位置につき、敵が浮かび上がる
   * → 「〜があらわれた！」→ ボスは名前の札と唸り → 命令。reduceMotion はただ明けるだけ。時間は戦闘の時計（倍速で短くなる）
   */
  async function intro(st) {
    st.phase = 'intro';
    const reduce = _.trans.reduce();
    const boss = !!(st.info.boss || st.info.heavy || st.actors.some((a) => a.side === 'enemy' && a.boss));
    const foes = st.actors.filter((a) => a.side === 'enemy');
    const party = st.actors.filter((a) => a.side === 'party');
    for (const a of foes) { const v = st.vis[a.uid]; v.appear = 0; if (!reduce) v.dy = a.boss ? 26 : 14; }
    for (const a of party) { const v = st.vis[a.uid]; if (!reduce && v.alive) { v.dx = 240 + (a.x > 650 ? 40 : 0); v.pose = 'step'; v.poseT = R.Engine.time; } }
    st.hudIn = 0;
    if (st.cover == null) st.cover = 0;
    const tw = _.play.tween;
    const lit = reduce ? 300 : boss ? 780 : 460;
    tw(st, st, 'cover', 0, lit);
    if (!reduce) {
      // 一行: 前列から順に（少しずつずらして）
      party.slice().sort((a, b) => a.x - b.x).forEach((a, i) => {
        const v = st.vis[a.uid];
        if (!v.alive) return;
        st.pwait(80 + i * 70).then(() => tw(st, v, 'dx', 0, 560, 'out3')).then(() => { if (v.pose === 'step') { v.pose = 'idle'; v.poseT = R.Engine.time; } });
      });
      // 敵: 浮かび上がる（ボスは遅く、重く）
      foes.forEach((a, i) => {
        const v = st.vis[a.uid];
        const d = a.boss ? 260 : 140 + i * 70, ms = a.boss ? 900 : 380;
        st.pwait(d).then(() => { tw(st, v, 'appear', 1, ms, 'out'); tw(st, v, 'dy', 0, ms, 'out3'); });
      });
      await st.pwait(boss ? 1000 : 620);
    } else {
      for (const a of foes) tw(st, st.vis[a.uid], 'appear', 1, 300);
      await st.pwait(320);
    }
    for (const a of foes) { const v = st.vis[a.uid]; v.appear = 1; v.dy = 0; }
    for (const a of party) { const v = st.vis[a.uid]; v.dx = 0; if (v.pose === 'step') { v.pose = 'idle'; v.poseT = R.Engine.time; } }
    st.cover = 0;
    if (boss) {
      const bu = foes.find((a) => a.boss) || foes[0];
      if (R.Audio.sfx) R.Audio.sfx('roar');
      if (!reduce && R.Settings.get('shake') !== 'off') st.shake = { t0: R.Engine.time, ms: 520, amp: 5 };
      st.bossCard = { name: bu ? bu.name : '', sub: (st.info.troop && st.info.troop.title) || R.T('battle.scene.intro.bossCard.sub'), t0: R.Engine.time, ms: 1700 };
      await R.until(() => st.dead || R.Engine.time - st.bossCard.t0 >= st.bossCard.ms * (st.speed() > 1 ? 0.6 : 1));
      st.bossCard = null;
    }
    const names = [...new Set(foes.map((a) => a.name))];
    st.head = { name: names.length ? R.T('battle.scene.intro.head.name', { join: names.slice(0, 3).join(R.T('battle.scene.intro.head.name.join')), p1: names.length > 3 ? R.T('battle.scene.intro.head.name_2') : '' }) : R.T('battle.scene.intro.head.name_3'), t0: R.Engine.time };
    if (foes.some((a) => a.golden)) { try { R.Audio.jingle('rare'); } catch (e) { /* ignore */ } st.head.sub = R.T('battle.scene.intro.sub'); }
    tw(st, st, 'hudIn', 1, 260);
    await st.pwait(boss ? 380 : 520);
    st.hudIn = 1;
  }

  /**
   * 右下の操作の案内（2026-09-27 の持ち主の決まり: 速さとリピートはここに 1 つだけ）。
   *   速さ: 「[R] 速さ：通常／＋1／＋2」（押すたびに変わる）。リピート: 動いている間は「リピート中：[L]でやめる」（B でも止まる）、
   *   選べるときは「[L] リピート」。勝利・全滅・閉じる間は出さない。縦持ちは下の札（速さ・リピート・逃げる、タップ）が同じ役。
   * → {list, repeatOn}
   */
  Bt.prompts = function (st) {
    const base = st.ui && st.ui.prompts ? st.ui.prompts : [];
    let list = base.filter((p) => p.btn !== 'r');
    const live = st.phase === 'input' || st.phase === 'play' || st.phase === 'intro';
    // 命令の窓の間に ON にしたリピート（まだ繰り返す命令が無い）は「リピート中」と出さない（テスター 2026-10-02 Q9:
    //   金色の魔物でリピートが止まった戦闘で、手で命令している間も「リピート中」の帯が出ていた）。次のラウンドから、と出す
    const armed = !!(live && st.B && st.B.repeatOn && st.phase === 'input');
    const repeatOn = !!(live && st.B && st.B.repeatOn) && !armed;
    if (live && !st.L.tall) {
      if (armed) list = list.filter((p) => p.btn !== 'l').concat([{ btn: 'l', label: R.T('battle.scene.prompts.armed') }]);
      else if (repeatOn) list = [{ btn: 'l', label: R.T('battle.scene.prompts.list.0.label'), repeat: true }].concat(list.filter((p) => p.btn !== 'b' && p.btn !== 'l'));
      else list = list.concat([{ btn: 'l', label: R.T('battle.scene.prompts.list.0.label_2') }]);
      list = list.concat([{ btn: 'r', label: R.T('battle.scene.prompts.list.0.label_3', { speedLabel: Bt.speedLabel(speed()) }) }]);
    }
    return { list, repeatOn: repeatOn && !st.L.tall };
  };
  /** 「リピート中：」の金の札（案内の [L]でやめる の左） */
  function drawRepeatTag(g, rect) {
    const k = R.uiScale || 1, Kt = _.K, s = 12 * k;
    const label = R.T('battle.scene.drawRepeatTag.label');
    const w = Kt.measure(label, { size: s, weight: 700 }) + 22 * k;
    const x = rect.x - w - 2 * k, y = rect.y + rect.h / 2;
    const pulse = R.Settings.get('reduceMotion') ? 1 : 0.6 + 0.4 * Math.sin(R.Engine.time / 240);
    g.save();
    g.fillStyle = `rgba(242,208,138,${pulse})`;
    g.beginPath(); g.arc(x + 8 * k, y, 3.5 * k, 0, 7); g.fill();
    g.restore();
    Kt.text(g, label, x + 16 * k, y - s / 2 - 1 * k, { size: s, weight: 700, color: Kt.COL.gold, raw: true, shadow: true });
  }

  /** ボスの名前の札（戦場の上の方、真ん中） */
  function drawBossCard(g, st) {
    const c = st.bossCard;
    if (!c) return;
    const t = R.Engine.time - c.t0, k = R.uiScale || 1;
    const a = Math.min(1, t / 260) * Math.min(1, Math.max(0, (c.ms - t) / 380));
    if (a <= 0) return;
    const cx = R.W / 2, cy = (st.L.tall ? st.L.stageH * 0.3 : R.H * 0.3);
    const grow = 1 - Math.pow(1 - Math.min(1, t / 520), 3);
    g.save();
    g.globalAlpha = a;
    const bw = Math.min(R.W, 760 * k);
    const gr = g.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
    gr.addColorStop(0, 'rgba(8,6,14,0)'); gr.addColorStop(0.5, 'rgba(8,6,14,0.72)'); gr.addColorStop(1, 'rgba(8,6,14,0)');
    g.fillStyle = gr; g.fillRect(cx - bw / 2, cy - 44 * k, bw, 92 * k);
    const lw = (bw * 0.42) * grow;
    _.K.hline(g, cx - lw, cx + lw, cy - 30 * k, 0.6, '255,190,150');
    _.K.hline(g, cx - lw, cx + lw, cy + 36 * k, 0.6, '255,190,150');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = R.Gfx.font(12.5 * k, 700);
    if ('letterSpacing' in g) g.letterSpacing = 8 * k + 'px';
    g.fillStyle = 'rgba(255,196,170,0.9)'; g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 6;
    g.fillText(c.sub, cx, cy - 16 * k);
    g.font = R.Gfx.font(30 * k, 700);
    if ('letterSpacing' in g) g.letterSpacing = 6 * k + 'px';
    const tg = g.createLinearGradient(0, cy - 4 * k, 0, cy + 30 * k); tg.addColorStop(0, '#fff6ec'); tg.addColorStop(1, '#f0b98e');
    g.fillStyle = tg; g.shadowBlur = 10;
    g.fillText(c.name, cx, cy + 12 * k + (1 - grow) * 6 * k);
    g.restore();
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

  /** やり直しで残す物を写す（B.finish() の後の R.Game から）: 人ごとの技・術・派生の元、NEW の印、初めての説明の既読（flags.tip_*） */
  function retryKeep() {
    const G = R.Game;
    if (!G) return null;
    const chars = {};
    for (const id of Object.keys(G.chars || {})) {
      const c = G.chars[id];
      if (!c) continue;
      chars[id] = { techs: (c.techs || []).slice(), spells: (c.spells || []).slice(), derived: Object.assign({}, c.derived || {}) };
    }
    const tips = Object.keys(G.flags || {}).filter((k) => /^tip_/.test(k) && G.flags[k]);
    return { chars, tips, seen: Object.assign({}, G.seenSkill || {}) };
  }
  /** 戻した R.Game に足す（減らさない。戻した後に無い人は飛ばす） */
  function retryApply(keep) {
    const G = R.Game;
    if (!keep || !G) return;
    try {
      for (const id of Object.keys(keep.chars)) {
        const c = G.chars && G.chars[id], k = keep.chars[id];
        if (!c) continue;
        for (const key of ['techs', 'spells']) {
          c[key] = c[key] || [];
          for (const x of k[key]) {
            if (c[key].includes(x)) continue;
            c[key].push(x);
            const sk = id + ':' + x;
            if (keep.seen[sk] === false) { G.seenSkill = G.seenSkill || {}; G.seenSkill[sk] = false; }   // NEW の印も残す
          }
        }
        for (const t of Object.keys(k.derived)) if (c.techs.includes(t)) { c.derived = c.derived || {}; if (!c.derived[t]) c.derived[t] = k.derived[t]; }
      }
      G.flags = G.flags || {};
      for (const f of keep.tips) G.flags[f] = true;
    } catch (e) { console.error('[battle retry keep]', e); }
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
      await R.Engine.fadeTo(1, _.trans.reduce() ? Bt.FADE.reduce : 420);
      // 「失う物はない」（2026-09-30 テスター 1-5・1-6）: 戦闘の前に戻しても、負けた戦闘で閃いた技・術と、読んだ初めての説明は残す
      const keep = retryKeep();
      R.Save.restore('battle');
      retryApply(keep);
      st.retry++;
      initCore(st);
      st.cover = 1; st.go = null;
      R.Engine.fade.a = 0;
      try { if (R.Audio.setTempo) R.Audio.setTempo(1); R.Audio.bgm(st.info.bgm, { fade: 300 }); } catch (e) { /* ignore */ }   // やり直しは暴走の前の速さから
      st.rage = null; st.enraged = 0;
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
        repeatRemember(st);
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
  /**
   * 縦長の PC の窓（800×885 など）は戦闘の部品を少し小さく描く（layout.js の L.k。下の部品が画面に収まるように）。
   * 戦闘の場面を動かす・描く間だけ R.uiScale をそれにする（部品の当たりも同じ大きさで決まる）。ほかの窓は L.k = R.uiScale で何もしない
   */
  function withK(st, fn) {
    const k0 = R.uiScale, k = st.L && st.L.k;
    if (!k || k === k0) return fn();
    R.uiScale = k;
    try { return fn(); } finally { R.uiScale = k0; }
  }
  function makeScene(st) {
    return {
      id: 'battle',
      opaque: true,
      enter() { R.Input.touchLayout('battle'); },
      exit() {},
      onLayout() { keepBg(st); place(st); st.bgRebake = R.Engine.time + 250; },
      update(dt) { withK(st, () => update(dt)); },
      draw(g) { withK(st, () => draw(g, st)); },
    };
    function update(dt) {
        // ヒットストップ（当たった瞬間、実時間で 35〜55 ms だけ戦闘の時計を止める。playback.js の P.hitstop）
        if (!(st.hitstopUntil && R.Engine.time < st.hitstopUntil)) st.clock += dt * st.mul();
        const I = R.Input;
        // 戦闘の速さ（R）: 通常 → ＋1 → ＋2 → 通常（どの場面でも。勝利の札・全滅の画面では変えない）
        if (I.pressed('r') && st.phase !== 'result' && st.phase !== 'gameover' && st.phase !== 'closing') Bt.cycleSpeed();
        // リピートの ON／OFF（L。持ち主 2026-09-28「L でリピートの切り替え」）。命令の窓では今すぐ始め、動いている間は次のラウンドから
        if (I.pressed('l') && st.B && (st.phase === 'input' || st.phase === 'play' || st.phase === 'intro')) {
          const can = (st.partyOpts || []).includes('repeat');
          if (st.B.repeatOn) { st.B.setRepeat(false); if (R.UIK && R.UIK.toast) R.UIK.toast(R.T('battle.scene.makeScene.battle.update.toast'), { anchor: 'bl' }); }
          else if (can && st.phase === 'input') st.chipTap = 'repeat';
          // 繰り返す命令がまだ無い（最初のラウンド）: ON だけ先に立て、このラウンドの命令を次から繰り返す（持ち主 2026-09-28「最初のターンでも ON に」）
          else { st.B.setRepeat(true); if (R.UIK && R.UIK.toast) R.UIK.toast(can ? R.T('battle.scene.makeScene.battle.update.toast_2') : R.T('battle.scene.makeScene.battle.update.toast_3'), { anchor: 'bl' }); }
        }
        // 縦持ちの札（タップ）
        const p = I.pointer;
        if (p && p.pressed && st.chipRects) {
          for (const k of Object.keys(st.chipRects)) {
            const r = st.chipRects[k];
            if (r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y - 6 && p.y <= r.y + r.h + 6) {
              if (k === 'speed') Bt.cycleSpeed();
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
          if (R.UIK && R.UIK.toast) R.UIK.toast(R.T('battle.scene.makeScene.battle.update.toast_4'), { anchor: 'bl' });
        }
        repeatWatch(st);
        _.play.tick(st, dt);
        _.glimmer.tick(st);
        rebakeBg(st);
        if (st.ui && st.ui.update) st.ui.update(dt);
    }
  }

  // ---------------------------------------------------------------- 戦闘背景の層と光（BEAST の依頼 22: R.Beast.stage が見本）
  function layer(c, sh, name, mode) {
    for (const i of (sh.poses && sh.poses[name]) || []) {
      if (mode) { c.save(); c.globalCompositeOperation = mode; }
      R.Hd.draw(c, sh.frames[i], 0, 0, {});
      if (mode) c.restore();
    }
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
   * 戦闘背景の光（BEAST の依頼 22、meta.light === 'layer'）: 地面・人と敵・手前にだけ光の地図を multiply し、夜空（back）には掛けない。
   * 重さを抑える形（§2.10 の戦闘 3 ms）: 動かない ground と front は戦闘ごとに 1 回だけ「光を掛けた絵」に焼き（実キャンバスの解像度）、
   * 人と敵は光の地図を体の中ほどの 1 点で読み、その色を掛けたコマ（覚えておく）で描く（毎フレームの画面全体の合成をしない）。
   * 描く順: back → 光を掛けた ground → ランタンのゆらぎ → 影 → 人と敵（1 人ずつ光）→ 光を掛けた front → post → R.Post.frame
   */
  function litStatic(st, sh, g, name) {
    const map = stageLightMap(st, sh);
    const cw = g.canvas.width, ch = g.canvas.height;
    const tf = g.getTransform();
    const key = [name, cw, ch, tf.a, tf.e, tf.f, st.lmapKey].join('|');
    st.litCache = st.litCache || {};
    if (st.litCache[name] && st.litCache[name].key === key) return st.litCache[name].c;
    const idx = (sh.poses && sh.poses[name]) || [];
    if (!idx.length || !map) { st.litCache[name] = { key, c: null }; return null; }
    const c = R.Hd.RZ.canvas(cw, ch), x = c.getContext('2d');
    x.setTransform(tf); x.imageSmoothingEnabled = false;
    layer(x, sh, name);
    const m = R.Hd.RZ.canvas(cw, ch), mx = m.getContext('2d');
    mx.setTransform(tf); mx.imageSmoothingEnabled = true;
    mx.drawImage(map, 0, 0, sh.w || R.W, sh.h || R.H);
    mx.setTransform(1, 0, 0, 1, 0, 0);
    mx.globalCompositeOperation = 'destination-in'; mx.drawImage(c, 0, 0);
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.drawImage(m, 0, 0);
    x.globalCompositeOperation = 'source-over';
    st.litCache[name] = { key, c };
    try { if (R.Hd.track) R.Hd.track('bbg', 'bscene:lit:' + name, cw * ch * 4); } catch (e) { /* 量の届けは無くてもよい */ }
    return c;
  }
  /**
   * 手前の層（front）が人と敵を隠さないように、体の所だけ前の層を薄くする（2026-09-27、敵の 3 つ目の場所・ボスが草や木箱の後ろに隠れた）。
   * 体の中ほどを中心にした柔らかい楕円で destination-out（中心 88%）。足もとの位置と高さが変わったときだけ作り直す。
   * src = 実キャンバスの大きさの前の層（光を掛けた物）か null（そのときは layer で描く）。tf = 論理 → 実画素の変換
   */
  function holes(st) {
    const out = [];
    for (const a of st.actors) {
      const v = st.vis[a.uid] || {};
      if (v.gone >= 1 || v.hidden) continue;
      const h = _.actors.height(a);
      out.push([Math.round(a.x), Math.round(a.y), Math.round(h)]);
    }
    return out;
  }
  /** dy: 背景を下へずらして置く量（論理 px。layout.js の bgDy）。src（焼いた前の層）は呼んだ側がずらして置くので穴を上へ、src の無いときは層をずらす */
  function maskedFront(st, sh, g, src, tf, dy) {
    dy = dy || 0;
    const cw = g.canvas.width, ch = g.canvas.height;
    const hs = holes(st);
    const key = [cw, ch, tf.a, tf.d, tf.e, tf.f, dy, src ? (st.litCache && st.litCache.front && st.litCache.front.key) : 'flat', JSON.stringify(hs)].join('|');
    st.frontMask = st.frontMask || {};
    if (st.frontMask.key === key && st.frontMask.c) return st.frontMask.c;
    const c = (st.frontMask.c && st.frontMask.c.width === cw && st.frontMask.c.height === ch) ? st.frontMask.c : R.Hd.RZ.canvas(cw, ch);
    const x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    x.clearRect(0, 0, cw, ch);
    if (src) x.drawImage(src, 0, 0);
    else { x.setTransform(tf); x.translate(0, dy); x.imageSmoothingEnabled = false; layer(x, sh, 'front'); }
    x.setTransform(tf);
    if (src && dy) x.translate(0, -dy);
    x.globalCompositeOperation = 'destination-out';
    for (const [ax, ay, h] of hs) {
      const cx = ax, cy = ay - h * 0.45, r = Math.max(26, h * 0.62);
      const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, 'rgba(0,0,0,0.88)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr;
      x.save(); x.translate(cx, cy); x.scale(0.85, 1.15); x.translate(-cx, -cy);
      x.fillRect(cx - r, cy - r, r * 2, r * 2);
      x.restore();
    }
    x.globalCompositeOperation = 'source-over';
    x.setTransform(1, 0, 0, 1, 0, 0);
    st.frontMask = { key, c };
    return c;
  }
  function blit(g, c) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.drawImage(c, 0, 0); g.restore(); }
  /** 光の地図の 1 点の色（論理 px）→ [r, g, b]。地図の画素は戦闘ごとに 1 回だけ読む */
  function lightSampler(st, sh, map) {
    if (st.lmapPx && st.lmapPx.map === map) return st.lmapPx.at;
    let data = null;
    try { data = map.getContext('2d').getImageData(0, 0, map.width, map.height).data; } catch (e) { data = null; }
    const W = sh.w || R.W, H = sh.h || R.H, mw = map.width, mh = map.height;
    const at = data ? (x, y) => {
      const px = Math.max(0, Math.min(mw - 1, Math.round(x * mw / W))), py = Math.max(0, Math.min(mh - 1, Math.round(y * mh / H)));
      const i = (py * mw + px) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    } : null;
    st.lmapPx = { map, at };
    return at;
  }
  function litStage(g, st, sh, parts) {
    if (_.flatStage || !g.canvas || !g.getTransform || !(R.Hd.RZ && R.Hd.RZ.canvas)) return false;
    const map = stageLightMap(st, sh);
    if (!map) return false;
    const tf = g.getTransform();
    // 焼いた絵は揺れの前の変換（st.baseTf、draw の初め）で焼き、揺れの間は同じだけずらして置く
    const bt = st.baseTf || tf;
    const gTf = new DOMMatrix([bt.a, 0, 0, bt.d, bt.e, bt.f]);
    const ground = litStatic(st, sh, { canvas: g.canvas, getTransform: () => gTf }, 'ground');
    const front = litStatic(st, sh, { canvas: g.canvas, getTransform: () => gTf }, 'front');
    const dy = parts.dy || 0;
    const off = [tf.e - bt.e, tf.f - bt.f + dy * bt.d];
    const put = (c) => { if (!c) return; g.save(); g.setTransform(1, 0, 0, 1, off[0], off[1]); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.drawImage(c, 0, 0); g.restore(); };
    put(ground);
    parts.under(g);                                   // ランタンのゆらぎ・影（地面の上、光の後）
    const at = lightSampler(st, sh, map);           // 人と敵は体の中ほどの光の色を掛けたコマで描く（actors.js の litFrame）
    st.lightAt = at && dy ? (px, py) => at(px, py - dy) : at;
    try { for (const a of parts.order) _.actors.draw(g, st, a); } finally { st.lightAt = null; }
    put(front ? maskedFront(st, sh, g, front, gTf, dy) : null);
    return true;
  }

  /**
   * 画面の大きさが変わった（戦闘の途中で窓を変えた）: 新しい大きさの背景が焼けるまで、前の背景（光を掛けた地面ごと 1 枚に写した物）を
   * 新しい戦場に合わせて拡げて描く（コードの仮の夜の野原を数秒見せない）。焼き直しは 0.25 秒置いて同期で（窓を引きずる間は焼かない）
   */
  function keepBg(st) {
    try {
      const bk = bgKey(st), sh = st.lastSh, bt = st.baseTf;
      if (!bk || !sh || !sh.frames || !bt || !(R.Hd.RZ && R.Hd.RZ.canvas)) return;
      const S = bt.a || R.SCALE || 2, cw = Math.max(1, Math.round((sh.w || R.W) * S)), ch = Math.max(1, Math.round((sh.h || R.H) * S));
      const c = R.Hd.RZ.canvas(cw, ch), x = c.getContext('2d');
      x.setTransform(S, 0, 0, S, 0, 0); x.imageSmoothingEnabled = false;
      layer(x, sh, 'back');
      const lg = st.litCache && st.litCache.ground && st.litCache.ground.c;
      if (lg) { x.setTransform(1, 0, 0, 1, -(bt.e || 0), -(bt.f || 0)); x.drawImage(lg, 0, 0); x.setTransform(S, 0, 0, S, 0, 0); } else layer(x, sh, 'ground');
      layer(x, sh, 'post', (sh.meta && sh.meta.postMode) || 'lighter');
      st.prevBg = { c, w: sh.w || R.W, h: sh.h || R.H, mood: sh.meta && sh.meta.mood };
    } catch (e) { st.prevBg = null; }
  }
  function rebakeBg(st) {
    if (!st.bgRebake || R.Engine.time < st.bgRebake) return;
    st.bgRebake = 0;
    try { const bk = bgKey(st); if (bk && R.Hd.has(bk) && !R.Hd.ready(bk, bgOpts(st))) R.Hd.now(bk, bgOpts(st)); } catch (e) { console.error('[battle bg rebake]', e); }
  }
  function drawPrevBg(g, st) {
    const P = st.prevBg, L = st.L;
    const H = L.tall ? L.stageH : R.H, k = Math.max(R.W / P.w, H / P.h), dw = P.w * k, dh = P.h * k;
    g.save(); g.imageSmoothingEnabled = true;
    g.drawImage(P.c, (R.W - dw) / 2, L.tall ? 0 : (R.H - dh) / 2, dw, dh);
    g.restore();
  }

  function draw(g, st) {
    const L = st.L, t = R.Engine.time;
    g.save();
    if (g.getTransform) st.baseTf = g.getTransform();
    // 画面の揺れ（設定 shake）
    if (st.shake) {
      const e = (t - st.shake.t0) / st.shake.ms;
      if (e >= 1) st.shake = null;
      else { const amp = st.shake.amp * (1 - e) * (R.Settings.get('shake') === 'weak' ? 0.4 : 1); g.translate(Math.round(Math.sin(t / 22) * amp), Math.round(Math.cos(t / 31) * amp * 0.5)); }
    }
    // 背景（BEAST の R.Beast.stage と同じ順: back → [層: ground → 影と人と敵 → front → 層にだけ光を multiply] → post（lighter）→ R.Post.frame）
    const bk = bgKey(st);
    const sh = bk && R.Hd && R.Hd.has && R.Hd.has(bk) ? R.Hd.get(bk, bgOpts(st)) : null;
    let lantern = L.lantern;
    const baked = !!(sh && sh.frames && sh.poses);
    if (baked) { st.lastSh = sh; st.prevBg = null; }
    const dy = baked ? L.bgDy || 0 : 0;   // 背景を真ん中へ下げて置く（16:9 より縦の長い横持ち。layout.js の bgDy）
    if (baked && sh.meta && sh.meta.lantern) lantern = [sh.meta.lantern.x, sh.meta.lantern.y + dy];
    const order = st.actors.slice().sort((a, b) => a.y - b.y);
    const under = (c) => {
      _.actors.lanternPool(c, { lantern, tall: L.tall, baked }, t);
      for (const a of order) _.actors.shadow(c, st, a);
    };
    const shifted = (c, fn) => { if (!dy) { fn(); return; } c.save(); c.translate(0, dy); fn(); c.restore(); };
    const mid = (c) => {
      if (baked) shifted(c, () => layer(c, sh, 'ground'));
      under(c);
      for (const a of order) _.actors.draw(c, st, a);
      if (baked) {
        // 手前の層は体の所を薄くして置く（maskedFront）。変換の無い所（テストの 2D の口など）はそのまま
        if (c.getTransform && c.canvas && R.Hd.RZ && R.Hd.RZ.canvas) {
          const tf = c.getTransform();
          const m = maskedFront(st, sh, c, null, tf, dy);
          c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.drawImage(m, 0, 0); c.restore();
        } else shifted(c, () => layer(c, sh, 'front'));
      }
    };
    if (baked) {
      if (dy) {
        // 上下のあまり: 上は空の一番上の行を伸ばし、下は暗く（縦持ちの戦場の下と同じ色）
        const b0 = sh.frames[(sh.poses.back || [0])[0]];
        if (b0 && b0.c) { const S = b0.c.width / (sh.w || R.W); g.drawImage(b0.c, 0, 0, b0.c.width, Math.max(1, Math.round(S)), 0, 0, R.W, dy + 1); }
        g.fillStyle = '#0c0c14'; g.fillRect(0, dy + (sh.h || 540) - 1, R.W, R.H);
      }
      shifted(g, () => layer(g, sh, 'back'));
      const lit = litStage(g, st, sh, { under, order, dy });
      if (!lit) mid(g);
      shifted(g, () => layer(g, sh, 'post', (sh.meta && sh.meta.postMode) || 'lighter'));
      if (dy) {
        const y1 = dy + (sh.h || 540), gr = g.createLinearGradient(0, y1 - 60, 0, y1);
        gr.addColorStop(0, 'rgba(12,12,20,0)'); gr.addColorStop(1, 'rgba(12,12,20,1)');
        g.fillStyle = gr; g.fillRect(0, y1 - 60, R.W, 60);
      }
    } else if (st.prevBg) {
      drawPrevBg(g, st);   // 窓を変えた直後: 焼き直すまで前の背景を拡げて
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
    if (_.play.drawStreaks) _.play.drawStreaks(g, st);
    g.restore();
    // 仕上げ（世界の最後・HUD の前。RENDER の依頼: mood は背景の meta.mood）
    if (R.Post && R.Post.frame) { try { R.Post.frame(g, { mood: (sh && sh.meta && sh.meta.mood) || 'night' }); } catch (e) { /* 仕上げは無くてもよい */ } }
    if (st.dim > 0) { g.fillStyle = `rgba(6,6,14,${st.dim})`; g.fillRect(0, 0, R.W, R.H); }
    if (st.rage) _.play.drawRage(g, st);   // 暴走の赤い光
    _.glimmer.drawWorld(g, st);
    // HUD
    _.hud.enemyTags(g, st);
    _.play.drawPops(g, st);
    if (!st.result && st.phase !== 'gameover') {
      const hk = st.hudIn == null ? 1 : st.hudIn;
      if (hk > 0.01) {
        g.save();
        if (hk < 1) { g.globalAlpha = hk; g.translate(0, Math.round((1 - hk) * 48 * (R.uiScale || 1))); }
        _.hud.party(g, st);
        g.restore();
      }
      _.hud.head(g, st);
      if (hk > 0.5) _.hud.chips(g, st);
      _.play.drawTele(g, st);
    }
    drawBossCard(g, st);
    _.glimmer.drawBanner(g, st);
    if (st.go) _.gameover.draw(g, st);
    if (st.ui && st.ui.draw) st.ui.draw(g);
    _.play.drawCard(g, st);
    const pp = Bt.prompts(st);
    if (pp.list.length && !(L.tall && st.ui && st.ui.tallPrompts === false)) {
      const rect = _.K.prompts(g, pp.list);
      if (pp.repeatOn && rect) drawRepeatTag(g, rect);
    }
    // 入る移りの続きの暗さ（intro で明ける）
    if (st.cover > 0.001) { g.save(); g.globalAlpha = Math.min(1, st.cover); g.fillStyle = R.Gfx.BG || '#070812'; g.fillRect(0, 0, R.W, R.H); g.restore(); }
  }

  // ---------------------------------------------------------------- R.Battle.start
  Bt.start = function (setup) {
    setup = setup || {};
    return new Promise((resolve) => {
      const troop = setup.troop && R.DB.troops ? R.DB.troops[setup.troop] : null;
      const boss = !!(setup.boss || (troop && troop.boss));
      // 入る移り・始まりの演出だけの「ボスらしさ」（編成に boss が無くても、ボスの曲の編成は重い移りにする）
      const heavy = boss || !!(troop && troop.bgm && /boss/.test(troop.bgm)) || /boss/.test(setup.bgm || '');
      if (boss) R.Save.autosave('boss');   // ボスの直前（§3.13）。戦闘の場面を積む前に
      R.Save.checkpoint('battle', { setup, seed: R.Game ? R.Game.seed : 0 });
      R.emit('battle:start', { setup });
      const bgm = setup.bgm || (troop && troop.bgm) || (boss ? 'boss' : 'battle');
      try { if (R.Audio.setTempo) R.Audio.setTempo(1); } catch (e) { /* ignore */ }   // 前の戦闘の暴走の速さを持ち越さない
      R.Audio.pushBgm(bgm);
      const prevLayout = R.Input.layoutName;
      const st = newState(setup, { boss, heavy, bgm, troop });
      let fin = false;
      st.finish = async (res) => {
        if (fin) return; fin = true;
        const reduce = _.trans.reduce();
        // 声を場面の切り替えで切らない: 勝利の声は手放して最後まで鳴らす（押して進んだ後も）。ほかの声は鳴り終わりを待つ（上限あり）
        if (res.result === 'win') _.voice.release();
        else await _.voice.settle(1600);
        // 暗くなる → 場面を外す → フィールドが明ける（すぐ切らない）
        st.phase = st.phase === 'gameover' ? st.phase : 'closing';
        const end = Bt.lastEnd && !Bt.lastEnd.closed ? Bt.lastEnd : (Bt.lastEnd = { result: res.result });
        end.closed = true;
        end.fadeOutAt = R.Engine.time;
        try { if (st.scene && R.Engine.stack.includes(st.scene)) await R.Engine.fadeTo(1, reduce ? Bt.FADE.reduce : Bt.FADE.out); } catch (e) { /* ignore */ }
        st.dead = true;
        _.voice.stop();
        R.Engine.remove(st.scene, res);
        _.trans.drop();
        try { if (R.Audio.setTempo) R.Audio.setTempo(1); } catch (e) { /* ignore */ }   // 暴走で速めた BGM を戻す
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
        if (R.Engine.fade.a > 0.001) await R.Engine.fadeTo(0, reduce ? Bt.FADE.reduce : Bt.FADE.in);
        end.fieldAt = R.Engine.time; end.fieldRt = _.result.rt();
        resolve(res);
      };
      st.scene = makeScene(st);
      current = st;
      // 入る移り（2026-09-27）: 今の画面が砕ける（ボスは闇に閉じる）→ 真っ暗で場面を積む → intro で明ける
      const go = () => {
        if (fin) return;
        R.Engine.push(st.scene);
        _.trans.drop();
        run(st).catch((e) => {
          console.error('[battle]', e);
          if (R.Engine.reportError) R.Engine.reportError(e);
          st.finish({ result: st.B && st.B.over === 'win' ? 'win' : 'escape', rewards: null });
        });
      };
      // 地の文（キャプション）が出ている間は待ってから砕く（テスター 2026-10-01 P20: 「門へ走った」の字が入る移りと重なって読めなかった）。
      //   上限 4 秒。写しは trans.cover が描き直してから取る（閉じかけの字が写らない）
      const capOn = () => R.Engine.stack.some((sc) => sc && sc.id === 'caption');
      const capT0 = R.Engine.time;
      const capWait = capOn() ? R.until(() => !capOn() || R.Engine.time - capT0 > 4000) : null;
      const startCover = () => {
        if (fin) return null;
        try { return _.trans.cover({ boss: heavy }); } catch (e) { console.error('[battle trans]', e); return null; }
      };
      let covered = capWait ? capWait.then(startCover) : startCover();
      // 描いた戦闘背景は使う時に読む（TERRAIN Env）: 移りの間に読み終えるのを待ち（上限 2.5 秒）、読めたら描いた絵で焼き直す
      let bgWait = null;
      try {
        const E = R.Terrain && R.Terrain.Env, bk = bgKey(st);
        if (bk && E && E.awaitBbg && E.bbg && !E.bbg(bk.slice(7))) {
          bgWait = E.awaitBbg(bk.slice(7), 2500).then(() => { try { if (R.Hd.has(bk) && !R.Hd.ready(bk, bgOpts(st))) R.Hd.now(bk, bgOpts(st)); } catch (e) { console.error('[battle bg]', e); } });
        }
      } catch (e) { bgWait = null; }
      if (covered || bgWait) Promise.all([covered, bgWait]).then(go, go); else go();
    });
  };
})(window.RPG);
