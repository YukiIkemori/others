// 開発用: 技・術の演出の見本（dev.html だけ）。見本の戦闘（R.Battle の demo）の中で、どの技・術の演出でも流せる。
//   RPG.FxGallery.open({demo:'normal'})   見本の戦闘を開き、命令の窓の代わりに見本の操作にする（←→ で選ぶ・A で流す・↑↓ で 10 飛ばし・Y で閃きつき）
//   RPG.FxGallery.list()                  流せる id（'t_sword_first' など。技・術の id）
//   RPG.FxGallery.play(id, {glimmer})     その技・術の出来事の列を作って流す（Promise）
//   RPG.FxGallery.begin(id) / step(ms)    書き出し用: 流し始め → 戦闘の時計を手で進めて 1 コマ描く（tools/fx_gallery.js）
(function (R) {
  'use strict';
  const G = (R.FxGallery = R.FxGallery || {});
  let st = null, idx = 0, busy = false, running = null;
  G.list = () => [...Object.keys(R.DB.techs), ...Object.keys(R.DB.spells)].filter((id) => R.BFX.seq.table[id])
    .sort((a, b) => { const sa = R.BFX.seq.get('sq:' + a), sb = R.BFX.seq.get('sq:' + b); return a[0] === b[0] ? (sa.tier - sb.tier) || (a < b ? -1 : 1) : a < b ? 1 : -1; });

  G.open = async function (o) {
    o = o || {};
    R.Battle.start({ demo: o.demo || 'normal', mons: o.mons || [['x', 1]], bg: o.bg || 'forest' });
    await R.until(() => { const d = R.Battle.debug(); return d && d.phase === 'input' && d.ui; });
    st = R.Battle.debug();
    st.ui = null; st.phase = 'gallery'; st.head = null;
    R.Engine.overlay('fxgal', drawHud, 1500);
    // 毎フレームの操作（戦闘が閉じたら終わる）
    R.until(() => { tick(); return !st || st.dead; });
    return true;
  };
  function tick() {
    if (!st || busy || st.phase !== 'gallery' || !G.interactive) return;
    const I = R.Input, L = G.list();
    if (I.pressed('right')) idx = (idx + 1) % L.length;
    if (I.pressed('left')) idx = (idx + L.length - 1) % L.length;
    if (I.pressed('down')) idx = (idx + 10) % L.length;
    if (I.pressed('up')) idx = (idx + L.length - 10) % L.length;
    if (I.pressed('a')) G.play(L[idx]);
    if (I.pressed('y')) G.play(L[idx], { glimmer: true });
  }
  G.interactive = true;
  function drawHud(g) {
    if (!st || st.dead) return;
    const L = G.list(), id = L[idx] || '', d = R.DB.techs[id] || R.DB.spells[id] || {};
    const spec = R.BFX.seq.get('sq:' + id) || {};
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(8, R.H - 46, 520, 38);
    g.fillStyle = '#fff'; g.font = R.Gfx.font(12, 700); g.textBaseline = 'top';
    g.fillText(`${idx + 1}/${L.length}  ${id}  ${d.name || ''}  tier ${spec.tier}  ${spec.dur | 0}ms`, 16, R.H - 42);
    g.fillStyle = '#cde'; g.font = R.Gfx.font(10, 500);
    g.fillText(String(spec.c || '').slice(0, 60), 16, R.H - 24);
    g.restore();
  }

  /** その技・術の出来事の列（見本） */
  G.events = function (id, o) {
    o = o || {};
    const tech = !!R.DB.techs[id], d = R.DB.techs[id] || R.DB.spells[id];
    const party = st.partyUnits().map((u) => u.uid), foes = st.aliveEnemies().map((a) => a.uid);
    const user = tech ? party[0] : party[Math.min(3, party.length - 1)];
    const u = st.unit(user);
    if (tech && u) { u.wtype = d.wtype; const a = st.actor(user); if (a) a.wtype = d.wtype; }
    const tg = d.target || 'enemy';
    let targets;
    if (tg === 'enemy') targets = [foes[1] || foes[0]];
    else if (/^(enemies|group|random)$/.test(tg)) targets = foes.slice();
    else if (tg === 'self') targets = [user];
    else if (tg === 'ally' || tg === 'ally_other' || tg === 'ally_dead') targets = [party.find((x) => x !== user) || user];
    else targets = party.slice();
    const evs = [];
    if (o.glimmer) evs.push({ t: 'glimmer', uid: user, id, name: d.name, kind: tech ? 'tech' : 'spell' });
    evs.push({ t: 'act', uid: user, cmd: tech ? 'skill' : 'spell', id, name: d.name, targets: tg === 'random' ? [targets[0]] : targets, mp: 0 });
    let n = 0;
    for (const ef of d.effects || []) {
      const hits = ef.hits || 1;
      if (ef.type === 'damage') {
        for (let h = 0; h < hits; h++) {
          const list = tg === 'random' ? [targets[(h + n) % targets.length]] : targets;
          for (const t of list) evs.push({ t: 'dmg', uid: t, n: 120 + ((h * 37 + t.length * 11) % 90) * 3, crit: false, kind: (d.elements && d.elements[0]) || 'phys' });
        }
        n++;
      } else if (ef.type === 'heal' || ef.type === 'healMp') for (const t of targets) evs.push({ t: 'heal', uid: t, n: 150, mp: ef.type === 'healMp' || undefined });
      else if (ef.type === 'revive') for (const t of targets) evs.push({ t: 'heal', uid: t, n: 200 });
      else if (ef.type === 'buff') for (const t of targets) evs.push({ t: 'status', uid: t, id: 'buff_' + (ef.stat || 'atk'), on: true, stage: ef.stages || 1 });
      else if (ef.type === 'status' && ef.status) for (const t of targets) evs.push({ t: 'status', uid: t, id: ef.status, on: true });
    }
    if (evs.length === 1 + (o.glimmer ? 1 : 0)) for (const t of targets) evs.push({ t: 'status', uid: t, id: 'buff_def', on: true, stage: 1 });
    return evs;
  };
  G.play = async function (id, o) {
    if (!st || busy) return false;
    busy = true;
    try {
      const evs = G.events(id, o);
      st.phase = 'play';
      running = R.Battle._.play.run(st, evs);
      await running;
    } finally { if (st) { st.phase = 'gallery'; st.ui = null; } busy = false; running = null; }
    return true;
  };
  /** 書き出し用: 流し始める（止めたエンジンを step で進める） */
  G.begin = function (id, o) {
    idx = Math.max(0, G.list().indexOf(id));
    G.done = false;
    G.play(id, o).then(() => { G.done = true; });
    return true;
  };
  /** 戦闘の時計を ms 進めて描く（R.Engine.pause 中に使う。途中で待ちの続きが走るように 1 歩ずつ間をあける） */
  G.step = async function (ms) {
    let left = ms;
    while (left > 0) { const d = Math.min(1000 / 60, left); R.Engine.advance(d); left -= d; await new Promise((r) => setTimeout(r, 0)); }
    // 演出の進み（書き出しの見せ場の時間を決める）: main = 画面の演出が始まってから、hit = 最初の当たりから（戦闘の時計）
    let seqT = -1, hitT = -1;
    if (st) for (const f of st.fxs) { if (!f.seq) continue; const t = st.clock - f.t0; if (f.part === 'hit') hitT = Math.max(hitT, t); else seqT = Math.max(seqT, t); }
    return { done: !!G.done, clock: st ? st.clock : 0, seqT, hitT };
  };
  G.state = () => st;
})(window.RPG);
