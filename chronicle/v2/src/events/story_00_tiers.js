// CONTENT-P: ティアの場面 T2〜T7 の共通の小道具とデータ（STORY_BIBLE §3.1・§4.1〜§4.3・§5.1・§6.2〜§6.4・§10.2〜§10.5・§11）
//   R.Story（イベントが使う小道具）
//     who(id, o)                 話し手の {name, face}（フィーネは T3 で名乗るまで「灰色のマントの少女」）
//     actor(ev, id, look, o)     場面の人を一行の近くに出す（町に置いた人ではない一時の人。イベントが終わると消える）→ 現れる
//     atExit(ev, ctx)            町の出口で起きた場面（ctx.reason 'leave'）: 呼び止められ、出てきた町の門へ戻る
//     chased(ctx)                解いたばかりの地方の町でないとき true（「追ってきた」の一行を足す）
//     margin(ev, n)              手がかり帳の余白の n 段目（羽ペンの音と地の文）
//     tales(ev)                  年代記の章の題を順に字幕で（ロアでベルナに旅の話をする場面）
//     oil(t) / oilWord(t)        灯油の値の倍率（§3.1: T0 1.0 → T2 0.9 → T4 0.8 → T6 0.7 → T8 0.6）と「九割」などの言い方
//   R.Tier.sceneFor(p)           E17 で走らせる場面: まだ見ていない T1〜Tp を順に走らせる束 story_tiers（飛ばしたティアも必ず 1 回）
//   R.Tier.wakeOnLeave(p)        町から外へ出たときに起こすか: ロウェルの 2 戦（T2・T5）が残っているとき（§6.4「町を出るとき」）
//   R.Tier.oil(t)                灯油の倍率（ファロスの油の相場の札・うわさ）
//   R.DB.letters  berna_t3（字が乱れる）・berna_t5・berna_t5_2（同じ文面、同じ日付）
//   R.DB.leads    l_main_margin_2〜7（余白。§4.3 の推理＋古層の n 行目。任意の手がかりで 1 行ふくらむ）・l_main_roa_t3・l_main_roa_t6・l_rumor_mira
//   R.DB.lore     lo_rowell_cover（§10.2 の 44）・lo_decree・lo_decree_memo（§5.1 の公の顔: 布告と記録官への私信の写し）・lo_hifuda（§10.2 の 8）
// 旗: story_t2〜story_t7（場面を見た）・story_rowell_duel1/2・story_rowell_won1/2（ロウェルの 2 戦）・story_rowell_defect（T7）・
//   story_roa_t3（T3 以降のロアで旅の話をした）・story_roa_t6（T6 のロア）・story_mira_heard（T5 のうわさ）。
// 体験版（DB.config.slice）では T2 から先は起こさない（T1 の後は「体験版の終わり」）。
(function (R) {
  'use strict';
  const S = (R.Story = R.Story || {});
  const G = () => R.Game || { flags: {}, vars: {}, items: {} };
  const flag = (id) => !!(G().flags && G().flags[id]);

  // ================================================================ 灯油の値（§3.1）
  S.OIL = { 0: 1.0, 2: 0.9, 4: 0.8, 6: 0.7, 8: 0.6 };
  S.oil = function (t) {
    t = t == null ? ((R.Game && R.Game.tier) || 0) : t;
    let best = 1;
    for (const k of Object.keys(S.OIL)) if (+k <= t) best = S.OIL[k];
    return best;
  };
  const WARI = ['', R.T('ev.story_00_tiers.WARI.1'), R.T('ev.story_00_tiers.WARI.2'), R.T('ev.story_00_tiers.WARI.3'), R.T('ev.story_00_tiers.WARI.4'), R.T('ev.story_00_tiers.WARI.5'), R.T('ev.story_00_tiers.WARI.6'), R.T('ev.story_00_tiers.WARI.7'), R.T('ev.story_00_tiers.WARI.8'), R.T('ev.story_00_tiers.WARI.9'), R.T('ev.story_00_tiers.WARI.10')];
  S.oilWord = (t) => WARI[Math.round(S.oil(t) * 10)] || R.T('ev.story_00_tiers.oilWord');

  // ================================================================ 話し手
  S.who = function (id, o) {
    const W = {
      fine: { name: flag('story_t3') ? R.T('ev.story_00_tiers.who.W.fine.name') : R.T('ev.story_00_tiers.who.W.fine.name_2'), face: 'fine:neutral' },
      rowell: { name: R.T('ev.story_00_tiers.who.W.rowell.name'), face: 'rowell:neutral' },
      berna: { name: R.T('ev.story_00_tiers.who.W.berna.name'), face: 'berna:neutral' },
      scribe: { name: R.T('ev.story_00_tiers.who.W.scribe.name'), face: false },
    };
    return Object.assign({}, W[id] || {}, o || {});
  };
  S.narr = (ev, text) => ev.say(null, text, { face: false });

  // ================================================================ 場面の人（町に置いていない一時の人）
  const DIRS = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] };
  function freeCell(F, s, x, y) {
    if (x === s.x && y === s.y) return false;
    try {
      if (!F._walkable(s.map, x, y, null, s.lv || 0)) return false;
      if (F._npcAt && F._npcAt(x, y, s.lv || 0)) return false;
      if (F._warpAt && F._warpAt(s.map, x, y, s.lv || 0)) return false;
    } catch (e) { return false; }
    return true;
  }
  /** 一行の上（会話の窓にかからない北）→ 向いている方 → 東西の dist マス → 無ければ近くの空いたマス */
  function spotNear(F, s, dist) {
    const order = ['n', s.dir, 'e', 'w'].filter((q, i, a) => DIRS[q] && a.indexOf(q) === i);
    for (const q of order) {
      const d = DIRS[q];
      for (let k = dist; k >= 1; k--) { const x = s.x + d[0] * k, y = s.y + d[1] * k; if (freeCell(F, s, x, y)) return { x, y }; }
    }
    for (let r = 1; r <= 4; r++) {
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        if (freeCell(F, s, s.x + i, s.y + j)) return { x: s.x + i, y: s.y + j };
      }
    }
    return null;
  }
  S.spotNear = spotNear;
  /**
   * 場面の人を出す（ev.appear で現れる）。o = {dist（一行からのマス。既定 2）, walk（遠くから歩いてくるマス数。既定 3）, alpha（透ける人）}
   * → 出せたら true（ノードではフィールドが無いので false。話は ev.say の name・face だけで進む）
   */
  S.actor = async function (ev, id, look, o) {
    o = o || {};
    const F = R.Field, s = F && F._s;
    if (!s || !s.map || !s.npcs || !F._walkable) return false;
    const at = spotNear(F, s, o.dist == null ? 2 : o.dist);
    if (!at) return false;
    const toHero = R.U && R.U.dirOf ? R.U.dirOf(s.x - at.x, s.y - at.y, 's') : 's';
    // 歩いてくる元: 一行から離れる向きに、歩けるマスが続くだけ
    const away = [Math.sign(at.x - s.x), Math.sign(at.y - s.y)];
    let from = null;
    for (let k = 1; k <= (o.walk == null ? 3 : o.walk); k++) {
      const x = at.x + away[0] * k, y = at.y + away[1] * k;
      if (!(away[0] || away[1]) || !freeCell(F, s, x, y)) break;
      from = [x, y];
    }
    const lv = s.lv || 0;
    const def = { id, look, x: at.x, y: at.y, lv, dir: toHero, move: 'still', pushable: false, party: true };
    const n = {
      def, id, look: F._artLook ? F._artLook(look, s.map) : look, x: at.x, y: at.y, lv, dir: toHero, home: { x: at.x, y: at.y, dir: toHero },
      party: true, stay: false, leaving: false, mv: null, vis: false, hidden: true, script: 0, talking: false, nextAt: R.Engine.time + 1e9, returnAt: 0,
      route: 0, stuck: 0, pose: null, rng: R.rng(s.map.id + ':story:' + id), isNew: false, waiters: [],
    };
    try { if (F._warmLook) F._warmLook(n.look); } catch (e) { /* 絵が無くても進む */ }
    // 前の場面の同じ人が残っていれば入れ替える
    const old = s.npcById && s.npcById[id];
    if (old && old.party) { const i = s.npcs.indexOf(old); if (i >= 0) s.npcs.splice(i, 1); }
    s.npcs.push(n);
    s.npcById[id] = n;
    s.partyShown = (s.partyShown || []).filter((q) => q !== id).concat([id]);
    // 一行は来た人の方を向く
    s.dir = R.U && R.U.dirOf ? R.U.dirOf(at.x - s.x, at.y - s.y, s.dir) : s.dir;
    await ev.appear(id, from ? { from, dir: toHero, speed: o.speed || 1 } : { ms: o.ms || 500, dir: toHero });
    if (o.alpha != null) n.fade = { t0: R.Engine.time, ms: 1e12, from: o.alpha, to: o.alpha };   // 透けて見える（フィーネ）
    return true;
  };
  /** 場面の人が立ち去る（出していなければ何もしない） */
  S.leave = async function (ev, id, o) {
    const s = R.Field && R.Field._s;
    if (!s || !s.npcById || !s.npcById[id]) return;
    try { await ev.leave(id, o || { steps: 3 }); } catch (e) { /* */ }
  };

  // ================================================================ 町の出口（ロウェルの 2 戦。§6.4）
  let lastLeave = null;   // 町を出たマス {map, x, y}（'map:leave' のとき）
  R.onData(function () {
    R.on('map:leave', (e) => {
      const m = e && R.DB.maps[e.map];
      if (m && m.kind === 'town' && R.Field && R.Field.pos) lastLeave = { map: e.map, x: R.Field.pos.x, y: R.Field.pos.y };
    });
  });
  S._lastLeave = () => lastLeave;
  /** その町の spawn のうち (x, y) にいちばん近い物（出た門の内側） */
  S.nearestSpawn = function (mapId, x, y) {
    const m = R.DB.maps[mapId];
    if (!m || !m.spawns) return null;
    let best = null, bd = 1e9;
    for (const k of Object.keys(m.spawns)) {
      const sp = m.spawns[k];
      if (sp.lv) continue;
      const d = Math.abs(sp.x - x) + Math.abs(sp.y - y);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  };
  /** ctx.reason 'leave'（町を出た）: 呼び止める声 → 出た門の内側へ戻る。戻った町の id を返す */
  S.atExit = async function (ev, ctx) {
    if (!ctx || ctx.reason !== 'leave' || !ctx.from || !R.DB.maps[ctx.from]) return (ctx && ctx.map) || null;
    await S.narr(ev, R.T('ev.story_00_tiers.atExit.narr'));
    const lv = lastLeave && lastLeave.map === ctx.from ? lastLeave : null;
    const m = R.DB.maps[ctx.from];
    const sp = lv ? S.nearestSpawn(ctx.from, lv.x, lv.y) : Object.keys(m.spawns || {})[0];
    await ev.fade('out', 400);
    await ev.warp(ctx.from, sp);
    await ev.fade('in', 400);
    return ctx.from;
  };
  /**
   * 場面の場所: 町を出た（'leave'）なら出た門へ戻る。宿（屋内）で起きたなら宿の前へ出る（屋内の出口の行き先）。
   * → 場面の町の id（ノードでは ctx の map）
   */
  S.stage = async function (ev, ctx) {
    if (ctx && ctx.staged) return ctx.map || S.mapId(ctx);
    if (ctx && ctx.reason === 'leave') return S.atExit(ev, ctx);
    const here = S.mapId(ctx);
    const m = here && R.DB.maps[here];
    if (m && m.kind === 'interior' && R.Field && R.Field._s && R.Field._s.map) {
      const ex = (m.exits || []).find((e) => e.to && R.DB.maps[e.to.map] && R.DB.maps[e.to.map].kind === 'town' && (!e.cond || R.State.check(e.cond)));
      if (ex) {
        await ev.fade('out', 400);
        await ev.warp(ex.to.map, ex.to.spawn);
        await ev.fade('in', 400);
        return ex.to.map;
      }
    }
    return here;
  };
  /** いちばん最近に解いた地方（年代記の章の並び） */
  S.lastCleared = function () {
    const ch = (G().chronicle && Array.isArray(G().chronicle.chapters)) ? G().chronicle.chapters.map((c) => c && c.id).filter((id) => /^r_/.test(id || '')) : [];
    return ch.length ? ch[ch.length - 1] : null;
  };
  /** 場面の町が、解いたばかりの地方の町でない（寄らずに離れた → 次の町の入口で追ってきた形。§6.4） */
  S.chased = function (mapId) {
    const rid = S.lastCleared();
    const m = mapId && R.DB.maps[mapId];
    return !!(rid && m && m.region && m.region !== rid);
  };
  S.mapId = (ctx) => (R.Field && R.Field.pos && R.Field.pos.map) || (ctx && ctx.map) || null;

  // ================================================================ 余白（§4.1-3・§4.3）
  S.margin = async function (ev, n) {
    ev.sfx('quill');
    ev.lead('l_main_margin_' + n);
    await S.narr(ev, R.T('ev.story_00_tiers.margin.narr'));
    // ページの裏の古層（§4.2。手に入れた順の n 行目）を字幕で
    if (KOSOU[n]) { ev.sfx('page'); await ev.caption(KOSOU[n], { ms: 3600 }); }
  };
  const has = (id) => flag(id);
  const count = (re) => Object.keys(R.DB.lore || {}).filter((id) => re.test(id) && has(id)).length;
  const KOSOU = {
    2: R.T('ev.story_00_tiers.KOSOU.2'),
    3: R.T('ev.story_00_tiers.KOSOU.3'),
    4: R.T('ev.story_00_tiers.KOSOU.4'),
    5: R.T('ev.story_00_tiers.KOSOU.5'),
    6: R.T('ev.story_00_tiers.KOSOU.6'),
    7: R.T('ev.story_00_tiers.KOSOU.7'),
  };
  S.KOSOU = KOSOU;
  /** 時の証（lo_time_*）の名前を拾った順に 3 つまで */
  S.timeNames = function () {
    const out = [];
    for (const id of Object.keys(R.DB.lore || {})) if (/^lo_time_/.test(id) && has(id) && R.DB.lore[id].title) out.push(R.DB.lore[id].title);
    return out.slice(0, 3);
  };
  const MARGIN = {
    2: () => R.T('ev.story_00_tiers.MARGIN.2'),
    3: () => R.T('ev.story_00_tiers.MARGIN.3'),
    4: () => R.T('ev.story_00_tiers.MARGIN.4', { p0: count(/^lo_war_/) >= 2 ? R.T('ev.story_00_tiers.MARGIN.4_2') : '' }),
    5: () => R.T('ev.story_00_tiers.MARGIN.5', { p0: count(/^lo_lz_/) >= 1 ? R.T('ev.story_00_tiers.MARGIN.5_2') : '' }),
    6: () => {
      // 時の証の名（3 つまで。1 行 20 字に収まるだけ）
      const all = S.timeNames();
      let names = [];
      for (const nm of all) { const t = names.concat([nm]); if ([...R.T('ev.story_00_tiers.MARGIN.6.ret_2', { join: t.join(R.T('ev.story_00_tiers.MARGIN.6.join')) })].length - 1 <= 20) names = t; }
      return R.T('ev.story_00_tiers.MARGIN.6.ret', { p0: names.length ? R.T('ev.story_00_tiers.MARGIN.6.ret_2', { join: names.join(R.T('ev.story_00_tiers.MARGIN.6.join')) }) : '' });
    },
    7: () => R.T('ev.story_00_tiers.MARGIN.7', { p0: has('lo_berna_confession') ? R.T('ev.story_00_tiers.MARGIN.7_2') : '' }),
  };
  S.MARGIN = MARGIN;
  const NUM = ['', R.T('ev.story_00_tiers.NUM.1'), R.T('ev.story_00_tiers.NUM.2'), R.T('ev.story_00_tiers.NUM.3'), R.T('ev.story_00_tiers.NUM.4'), R.T('ev.story_00_tiers.NUM.5'), R.T('ev.story_00_tiers.NUM.6'), R.T('ev.story_00_tiers.NUM.7'), R.T('ev.story_00_tiers.NUM.8')];
  const leads = {};
  for (let n = 2; n <= 7; n++) {
    leads['l_main_margin_' + n] = {
      title: R.T('ev.story_00_tiers.title', { p0: NUM[n] }), kind: 'main', region: 'world', from: R.T('ev.story_00_tiers.from'),
      get text() { return MARGIN[n](); },
    };
  }
  leads.l_main_roa_t3 = {
    title: R.T('ev.story_00_tiers.l_main_roa_t3.title'), kind: 'main', region: 'world', from: R.T('ev.story_00_tiers.l_main_roa_t3.from'), place: 'roa', dir: R.T('ev.story_00_tiers.l_main_roa_t3.dir'),
    text: R.T('ev.story_00_tiers.l_main_roa_t3.text'),
    done: 'story_roa_t3', hideWhen: 'story_t6',
  };
  leads.l_main_roa_t6 = {
    title: R.T('ev.story_00_tiers.l_main_roa_t6.title'), kind: 'main', region: 'world', from: R.T('ev.story_00_tiers.l_main_roa_t6.from'), place: 'roa', dir: R.T('ev.story_00_tiers.l_main_roa_t6.dir'),
    text: R.T('ev.story_00_tiers.l_main_roa_t6.text'),
    done: 'story_roa_t6',
  };
  leads.l_rumor_mira = {
    title: R.T('ev.story_00_tiers.l_rumor_mira.title'), kind: 'rumor', region: 'world', from: R.T('ev.story_00_tiers.l_rumor_mira.from'),
    text: R.T('ev.story_00_tiers.l_rumor_mira.text'),
  };
  R.defs('leads', leads);

  // ================================================================ 読み物
  const lore = (id, o) => { if (!R.DB.lore[id]) R.def('lore', id, Object.assign({ region: 'world', kind: 'main', must: false }, o)); };
  lore('lo_rowell_cover', { title: R.T('lore.lo_rowell_cover.title'), must: true,
    text: R.T('lore.lo_rowell_cover.text') });
  lore('lo_decree', { title: R.T('lore.lo_decree.title'),
    text: R.T('lore.lo_decree.text') });
  lore('lo_decree_memo', { title: R.T('lore.lo_decree_memo.title'),
    text: R.T('lore.lo_decree_memo.text') });
  lore('lo_hifuda', { title: R.T('lore.lo_hifuda.title'), kind: 'region',
    text: R.T('lore.lo_hifuda.text') });

  // ================================================================ ベルナの手紙（ボイスなし。§6.3）
  R.def('letters', 'berna_t3', {
    from: R.T('letters.berna_t3.from'), title: R.T('letters.berna_t3.title'), face: 'berna:sad',
    text: R.T('letters.berna_t3.text'),
  });
  R.def('letters', 'berna_t5', { from: R.T('letters.berna_t5.from'), title: R.T('letters.berna_t5.title'), face: 'berna:smile', text: [R.T('letters.berna_t5.text.0')] });
  R.def('letters', 'berna_t5_2', { from: R.T('letters.berna_t5_2.from'), title: R.T('letters.berna_t5_2.title'), face: 'berna:smile', text: [R.T('letters.berna_t5_2.text.0')] });

  // ================================================================ E17 の束（飛ばしたティアも順に）
  const sceneId = (k) => 'story_t' + k;
  /**
   * 場面の始まりと終わり（T2〜T7 が呼ぶ）: 走っている間は pendingTier を残す（町の移りの自動の記録で途中から再開しても、
   * 次の宿・町でまた起きる）。終わったら、まだ見ていない場面が無ければ消す
   */
  S.begin = function (k) { if (R.Game && (R.Game.pendingTier == null || R.Game.pendingTier < k)) R.Game.pendingTier = Math.max(k, R.Game.tier || 0); };
  S.end = function () { if (R.Game && !S.todo(R.Game.tier || 0).length) R.Game.pendingTier = null; };
  /** まだ見ていないティアの場面の番号の列（1〜p） */
  S.todo = function (p) {
    const out = [];
    for (let k = 1; k <= Math.min(8, p | 0); k++) if (!flag(sceneId(k))) out.push(k);
    return out;
  };
  R.onData(function () {
    const Tier = R.Tier;
    if (!Tier) return;
    Tier.oil = S.oil;
    Tier.sceneFor = function (p) {
      const todo = S.todo(p);
      if (!todo.length) return null;
      if (R.DB.config && R.DB.config.slice && todo[0] > 1) return sceneId(todo[0]);   // 体験版は T1 まで（T2 から先の場面は何もせずに終わる）
      const first = sceneId(todo[0]);
      if (!R.DB.events[first]) return first;   // 書かれていない場面（tier.js が pending のまま R.warn）
      return todo.length > 1 ? 'story_tiers' : first;   // 1 つだけならその場面（ctx.tier も同じ）
    };
    Tier.wakeOnLeave = function (p) {
      if (R.DB.config && R.DB.config.slice) return false;
      return S.todo(p).some((k) => k === 2 || k === 5);
    };
  });

  R.def('events', 'story_tiers', {
    meta: { needs: [], gives: [], calls: ['story_t1', 'story_t2', 'story_t3', 'story_t4', 'story_t5', 'story_t6', 'story_t7', 'story_t8'] },
    run: async (ev, ctx) => {
      const p = (ctx && ctx.tier) || (R.Game && R.Game.tier) || 0;
      // 途中で記録（マップの移りの自動の記録）されても、残りを次の宿・町で続けられるように、走っている間は pending を戻しておく
      if (R.Game) R.Game.pendingTier = p;
      const todo = S.todo(p);
      let first = true;
      // 場所は束の最初に 1 回だけ（町を出たなら門へ戻る・宿なら宿の前へ）。続く場面は同じ所で（ctx.staged）
      const map = todo.some((k) => k >= 2) && !(R.DB.config && R.DB.config.slice) ? await S.stage(ev, ctx) : S.mapId(ctx);
      const base = Object.assign({}, ctx, { map, staged: true, reason: ctx && ctx.reason === 'leave' ? 'exit' : ctx && ctx.reason });
      for (const k of todo) {
        const id = sceneId(k);
        if (R.DB.config && R.DB.config.slice && k > 1) break;
        if (!R.DB.events[id]) { R.warn('story_tiers: ' + id + ' is not written yet (pendingTier stays)'); return; }
        if (!first) await ev.wait(400);
        await ev.call(id, Object.assign({}, base, { tier: k, chain: todo.length > 1 }));
        first = false;
        // T1（体験版の終わり）でタイトルへ戻ったら、そこで止まる
        if (R.Game && R.DB.config && R.DB.config.slice && flag('world_demo_end')) break;
      }
      if (R.Game) R.Game.pendingTier = null;
    },
  });
})(window.RPG);
