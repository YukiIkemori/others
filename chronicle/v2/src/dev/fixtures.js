// フィクスチャ（CORE。dev.html だけに入る）: V2_PLAN §2.6.7・§2.9
// 状態のフィクスチャ tools/fixtures/states/<担当>_<名前>.json と場面のフィクスチャ scenes/<担当>_<名前>.json は、
// ビルドが window.RPG_FIXTURES = {states: {name: obj}, scenes: {name: obj}} として dev.html に入れる。
//   状態: {desc, hero:{type,sex,name}, party:[ids], reserve, tier, gl:{id:n}|'auto', prof:'auto', flags, vars, items, gold, leads, map:{id, spawn}}
//   場面: {scene:'battle'|'screen'|'map'|'event', state?:<状態の名前>, setup?, id?, params?, map?, spawn?, event?}
// 'auto' は R.Growth.glAt / R.Rules.profAt（ゲームの中の関数。tools の関数は使わない）
(function (R) {
  'use strict';
  const Dev = (R.Dev = R.Dev || {});

  function table() { return (typeof window !== 'undefined' && window.RPG_FIXTURES) || { states: {}, scenes: {} }; }
  Dev.fixtures = function () { const t = table(); return { states: Object.keys(t.states || {}), scenes: Object.keys(t.scenes || {}) }; };

  /** 状態のフィクスチャから R.Game を組み立てる（マップには入らない）。→ 使ったフィクスチャ */
  Dev.applyState = function (name) {
    const fx = typeof name === 'string' ? (table().states || {})[name] : name;
    if (!fx) throw new Error('no state fixture ' + name);
    const chk = R.Contract.check('fixtureState', fx);
    if (!chk.ok) console.warn('[fixture] ' + name + ': ' + chk.errors.join('; '));
    R.State.newGame({ hero: fx.hero, seed: fx.seed != null ? fx.seed : 12345 });
    const G = R.Game;
    G.tier = fx.tier || 0;
    for (const id of fx.party || []) if (id !== 'hero') R.Party.join(id);
    for (const id of fx.reserve || []) { R.Party.join(id); }
    const all = (fx.party || []).concat(fx.reserve || []);
    for (const id of all) {
      const c = G.chars[id];
      if (!c) continue;
      c.gl = fx.gl === 'auto' || fx.gl == null ? R.Growth.glAt(G.tier, 'party') : (fx.gl[id] != null ? fx.gl[id] : c.gl);
      if (fx.prof === 'auto') { const p = R.Rules.profAt(G.tier, 'party'); c.wprof = c.wprof || {}; for (const w of (R.Rules.K.WTYPES || [])) c.wprof[w] = p; }
    }
    R.Party.restoreAll();
    Object.assign(G.flags, fx.flags || {});
    Object.assign(G.vars, fx.vars || {});
    Object.assign(G.items, fx.items || {});
    if (fx.gold != null) G.gold = fx.gold;
    for (const l of fx.leads || []) R.Leads.add(l);
    return fx;
  };

  /** 状態のフィクスチャを当ててマップに入る */
  Dev.fixture = async function (name) {
    const fx = Dev.applyState(name);
    R.Engine.clear();
    await R.Field.enter(fx.map.id, fx.map.spawn, { fade: 0, noAutosave: true });
    return true;
  };

  /** 場面のフィクスチャを開く */
  Dev.scene = async function (name) {
    const sc = typeof name === 'string' ? (table().scenes || {})[name] : name;
    if (!sc) throw new Error('no scene fixture ' + name);
    const chk = R.Contract.check('fixtureScene', sc);
    if (!chk.ok) console.warn('[fixture] ' + name + ': ' + chk.errors.join('; '));
    const stName = sc.state || 'core_stub_road';
    const fx = Dev.applyState(stName);
    R.Engine.clear();
    const mapId = sc.map || fx.map.id;
    await R.Field.enter(mapId, sc.spawn || fx.map.spawn, { fade: 0, noAutosave: true });
    if (sc.scene === 'battle') { R.Battle.start(sc.setup || { troop: 'tr_stub' }); return true; }
    if (sc.scene === 'screen') {
      // すりガラス（UIK.snapshot）が描けたマップを写すよう、フィールドが何フレームか描いて焼く列が空くのを待つ（最大 24 フレーム）
      const f0 = R.Engine.frame;
      if (R.Engine.running) await R.until(() => R.Engine.frame >= f0 + 3 && (R.Engine.frame > f0 + 24 || !R.Hd.stats || !R.Hd.stats().queue));
      R.Screens.open(sc.id, sc.params);
      return true;
    }
    if (sc.scene === 'event') { R.Events.run(sc.event, { map: mapId }); return true; }
    return true;
  };

  /** dev.html の起動: ?fixture=<状態> か ?scene=<場面>。どちらも無ければ false（ふつうにタイトルへ） */
  Dev.boot = async function () {
    const q = new URLSearchParams((typeof location !== 'undefined' && location.search) || '');
    try {
      if (q.get('fixture')) return await Dev.fixture(q.get('fixture'));
      if (q.get('scene')) return await Dev.scene(q.get('scene'));
    } catch (e) { console.error('[dev] ' + (e && e.message || e)); return false; }
    return false;
  };
})(window.RPG);
(function (R) { 'use strict'; R.devBoot = function () { return R.Dev.boot(); }; })(window.RPG);
