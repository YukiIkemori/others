// 計測（GA4 の漏斗。持ち主 2026-09-28「体験版の出口」）。R.Analytics
//   GA4 のタグ（gtag.js、測定 ID G-GKKGJ8PJR8）は deploy/deploy.sh が公開の写しの index.html にだけ入れる。
//   window.gtag が無い（手元のビルド・node・製品版でタグを入れないとき）は何もしない（送らない・止まらない）。
//   個人の情報は送らない: 主人公の名前・入力した文字・記録の中身・合言葉は一切入れない。送るのはゲームの id と数だけ。
//
//   R.Analytics.event(name, params)   1 つ送る（共通の項目 game_ver・build・play_min を足す）。→ 送ったら true
//   R.Analytics.once(key, name, params)  同じ旅（R.Game.seed）で 1 回だけ（このブラウザの localStorage に覚える）
//   R.Analytics.sent                   送った（送ろうとした）物の控え（新しい 50 件。テストが読む）
//
// 送る物の一覧（名前 … いつ … 項目）:
//   game_new            タイトルの「はじめから」                                   —
//   game_continue       つづきから・記録を選ぶ・冒険の合言葉で旅を再開              —
//   name_entry_done     主人公を作り終えた（名前の入力のあと。名前は送らない）      hero_type
//   story_milestone     物語の節目のフラグが立った（下の MILESTONES の順）          milestone（フラグの id）, step（漏斗の番号）
//   objective_add       主な手がかり・依頼（kind main / side）を受けた              lead_id, lead_kind
//   objective_done      主な手がかり・依頼を解決した                                lead_id, lead_kind
//   region_clear        地方を解決した（大灯火がともった）                          region
//   first_battle        その旅で初めての戦闘が終わった                              troop, result
//   first_party_join    その旅で初めて仲間が加わった                                companion
//   dungeon_enter       ダンジョンに外から入った                                    dungeon（場所の id）
//   dungeon_clear       ダンジョンの中でボスに勝った                                dungeon, troop
//   boss_win            ボスに勝った                                                troop, map
//   game_over           全滅の画面が出た                                            troop, map
//   demo_end_reached    体験版の終わりに着いた（R.Demo.end）                        —（play_min は共通の項目）
//   demo_boundary       体験版の境で止められた（R.DemoGate の通せんぼ）            map, to
//   session_length      窓を閉じる・隠れる（visibilitychange hidden / pagehide）  engagement_sec（前に送ってから見ていた秒）
// 共通の項目: game_ver（R.VERSION）、build（'demo' | 'full'）、play_min（その旅の遊んだ分。旅の外は無し）
(function (R) {
  'use strict';
  const A = (R.Analytics = R.Analytics || {});
  const MAX_LOG = 50;
  A.sent = A.sent || [];

  // 物語の節目（漏斗の順）。序章 → ヴェルダの森 → T1 → 体験版の終わり
  const MILESTONES = [
    'prologue_start', 'prologue_berna', 'prologue_pharos', 'prologue_party', 'prologue_key', 'prologue_tutorial',
    'prologue_lh_door', 'prologue_fine', 'prologue_boss', 'prologue_done',
    'forest_start', 'forest_board', 'forest_fine', 'forest_boss', 'forest_finale_done',
    'story_t1', 'world_demo_end',
  ];
  A.MILESTONES = MILESTONES;

  const gtag = () => { try { return typeof window !== 'undefined' && typeof window.gtag === 'function' ? window.gtag : null; } catch (e) { return null; } };
  const build = () => (R.DB && R.DB.config && R.DB.config.slice ? 'demo' : 'full');

  A.event = function (name, params) {
    const p = Object.assign({ game_ver: String(R.VERSION || ''), build: build() }, params || {});
    const G = R.Game;
    if (G && p.play_min == null) p.play_min = Math.floor((G.playMs || 0) / 60000);
    A.sent.push({ name, params: p });
    if (A.sent.length > MAX_LOG) A.sent.splice(0, A.sent.length - MAX_LOG);
    const f = gtag();
    if (!f) return false;
    try { f('event', name, p); return true; } catch (e) { return false; }
  };

  // ---------------------------------------------------------------- 旅ごとに 1 回（このブラウザに覚える）
  const ONCE_KEY = 'an_once';
  const onceMem = {};
  function onceStore() {
    let o = null;
    try { const s = window.localStorage && window.localStorage.getItem((R.SAVE_PREFIX || '') + ONCE_KEY); o = s ? JSON.parse(s) : null; } catch (e) { o = null; }
    return o && typeof o === 'object' ? o : onceMem;
  }
  function onceSave(o) {
    const ks = Object.keys(o);
    while (ks.length > 20) delete o[ks.shift()];   // 古い旅から捨てる
    try { if (window.localStorage) window.localStorage.setItem((R.SAVE_PREFIX || '') + ONCE_KEY, JSON.stringify(o)); } catch (e) { /* 覚えられなくても送るのは止めない */ }
  }
  const onceFast = {};   // 今の窓で済んだ物（毎フレーム呼ばれても localStorage を読まない）
  A.once = function (key, name, params) {
    const G = R.Game;
    const trip = G ? String(G.seed) : '-';
    if (onceFast[trip + '/' + key]) return false;
    onceFast[trip + '/' + key] = true;
    const o = onceStore();
    const done = (o[trip] = o[trip] || {});
    if (done[key]) return false;
    done[key] = 1;
    onceSave(o);
    return A.event(name, params);
  };

  // ---------------------------------------------------------------- 節目に付ける（起動の後。ほかのファイルには書かない）
  let wired = false;
  A._wire = function () {
    if (wired) return;
    wired = true;
    const DB = R.DB;
    // 物語の節目のフラグ（ev.setFlag が 'flag' を出す。立ったときだけ）
    R.on('flag', (e) => {
      if (!e || !e.v) return;
      const i = MILESTONES.indexOf(e.id);
      if (i >= 0) A.event('story_milestone', { milestone: e.id, step: i + 1 });
    });
    const leadKind = (id) => { const d = DB.leads && DB.leads[id]; return d ? d.kind : null; };
    R.on('lead:add', (e) => { const k = e && leadKind(e.id); if (k === 'main' || k === 'side') A.event('objective_add', { lead_id: e.id, lead_kind: k }); });
    R.on('lead:done', (e) => { const k = e && leadKind(e.id); if (k === 'main' || k === 'side') A.event('objective_done', { lead_id: e.id, lead_kind: k }); });
    R.on('region:clear', (e) => { if (e && e.rid) A.event('region_clear', { region: e.rid }); });
    // 戦闘: 始まりの編成を覚え、終わりで初めての戦闘・ボスの勝ち・ダンジョンの解決
    let setup = null;
    R.on('battle:start', (e) => { setup = (e && e.setup) || {}; });
    R.on('battle:end', (res) => {
      const s = setup || {};
      setup = null;
      const troop = s.troop || '';
      const result = (res && res.result) || '';
      if (result === 'abort') return;   // 全滅の後の片付け（game_over は画面が出たときに送った）
      A.once('first_battle', 'first_battle', { troop, result });
      const T = troop && DB.troops ? DB.troops[troop] : null;
      if (result === 'win' && (s.boss || (T && T.boss))) {
        const pos = R.Game && R.Game.pos, map = pos && DB.maps[pos.map];
        A.event('boss_win', { troop, map: (map && map.id) || '' });
        if (map && map.kind === 'dungeon' && map.location) A.event('dungeon_clear', { dungeon: map.location, troop });
      }
    });
    // 全滅の画面（BSCENE の _.gameover.run を包む。無ければ何もしない）
    try {
      const Go = R.Battle && R.Battle._ && R.Battle._.gameover;
      if (Go && Go.run && !Go.run._an) {
        const run = Go.run;
        Go.run = function (st) {
          try { const pos = R.Game && R.Game.pos; A.event('game_over', { troop: (st && st.setup && st.setup.troop) || '', map: (pos && pos.map) || '' }); } catch (e) { /* */ }
          return run.apply(this, arguments);
        };
        Go.run._an = true;
      }
    } catch (e) { /* */ }
    // ダンジョンに外から入った（同じ場所の中の階の移りは数えない）
    R.on('map:enter', (e) => {
      const M = DB.maps, m = e && M[e.map];
      if (!m || m.kind !== 'dungeon' || !m.location) return;
      const f = e.from && M[e.from];
      if (f && f.kind === 'dungeon' && f.location === m.location) return;
      A.event('dungeon_enter', { dungeon: m.location });
    });
    // 体験版の境で止められた（通せんぼのマスに入った。同じ行き先は窓ごとに 1 回）
    const bumped = {};
    R.on('step', (e) => {
      const DG = R.DemoGate;
      if (!e || !DG || !DG.at || !DG.slice()) return;
      const to = DG.at(e.map, e.x, e.y);
      if (to && !bumped[e.map + '>' + to]) { bumped[e.map + '>' + to] = true; A.event('demo_boundary', { map: e.map, to }); }
    });
    // はじめから・つづきから（R.Flow を包む）
    const F = R.Flow;
    if (F && !F._an) {
      F._an = true;
      const ng = F.newGame, rs = F.resume;
      F.newGame = function () { A.event('game_new'); return ng.apply(this, arguments); };
      F.resume = function () { A.event('game_continue'); return rs.apply(this, arguments); };
    }
    // 主人公ができた・初めての仲間（毎フレーム R.Game を軽く見る）
    let lastG = null, hadHero = false;
    if (R.Engine && R.Engine.addTick) {
      R.Engine.addTick(() => {
        const G = R.Game;
        if (!G) { lastG = null; return; }
        if (G !== lastG) { lastG = G; hadHero = !!(G.chars && G.chars.hero); }
        else if (!hadHero && G.chars && G.chars.hero) {
          hadHero = true;
          A.once('name_entry_done', 'name_entry_done', { hero_type: G.chars.hero.type || '' });
        }
        const n = (G.party || []).length + (G.reserve || []).length;
        if (n > 1) {
          const first = (G.joined || []).find((id) => id !== 'hero') || (G.party || []).find((id) => id !== 'hero') || '';
          A.once('first_party_join', 'first_party_join', { companion: first });
        }
      });
    }
    // 見ていた時間（隠れる・閉じるときに、前に送ってから見ていた秒）
    if (typeof document !== 'undefined' && document.addEventListener) {
      let since = Date.now();
      const flush = () => {
        const sec = Math.round((Date.now() - since) / 1000);
        since = Date.now();
        if (sec >= 1) A.event('session_length', { engagement_sec: sec, transport_type: 'beacon' });
      };
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); else since = Date.now(); });
      window.addEventListener('pagehide', () => { if (document.visibilityState !== 'hidden') flush(); });
    }
  };
  if (R.onBoot) R.onBoot(() => A._wire());
})(window.RPG);
