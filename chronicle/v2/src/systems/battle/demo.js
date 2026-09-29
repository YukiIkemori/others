// BSCENE: 見本の戦闘（台本の「戦闘の 1 回」。本物の R.BattleCore の代わり）。スクショ（§4.4 の BSCENE の行）とテスト用。
//   R.Battle.start({demo: '<名前>', ...}) で使う（場面のフィクスチャ tools/fixtures/scenes/bscene_*.json）。
//   形は契約の battle（OBJ_API.battle）と出来事の列（BATTLE_EVENTS）どおり。R.Game は書き換えない（finish は何もしない）。
// 名前: normal glimmer spell tele steal victory wipe all hurt backrow prof prof_many boss_pageeater boss_moth boss_rooteater boss_wolflord
(function (R) {
  'use strict';
  const Bt = (R.Battle = R.Battle || {});
  const _ = (Bt._ = Bt._ || {});
  const D = (_.demo = {});

  // 見本の表示名（R.DB.items などに無い id のときだけ使う）
  _.names = Object.assign(_.names || {}, {
    dg_frost_fang: R.T('battle.demo.names.dg_frost_fang'), mt_wolf_pelt: R.T('battle.demo.names.mt_wolf_pelt'), i_potion: R.T('battle.demo.names.i_potion'), ac_st_rooteater: R.T('battle.demo.names.ac_st_rooteater'), ft_st_jewel_hare: R.T('battle.demo.names.ft_st_jewel_hare'),
  });

  const WT = ['sword', 'dagger', 'bow', 'staff'];
  const ROWS = ['front', 'front', 'back', 'back'];
  const HPS = [[417, 452, 47, 60], [512, 540, 22, 34], [301, 330, 38, 52], [58, 268, 86, 120]];
  const FOES = {
    normal: [['goblin_axe', R.T('battle.demo.FOES.normal.0.1'), 'm'], ['ice_wolf', R.T('battle.demo.FOES.normal.1'), 'l'], ['jelly_1', R.T('battle.demo.FOES.normal.2.1'), 's']],
    many: [['jelly_1', R.T('battle.demo.FOES.many.0.1'), 's'], ['jelly_2', R.T('battle.demo.FOES.many.1'), 's'], ['bat_1', R.T('battle.demo.FOES.many.2.1'), 's'], ['rat_1', R.T('battle.demo.FOES.many.3.1'), 's'], ['wolf_1', R.T('battle.demo.FOES.many.4.1'), 'm'], ['bee_1', R.T('battle.demo.FOES.many.5.1'), 's']],
  };
  const BOSSES = {
    boss_pageeater: [R.T('battle.demo.BOSSES.boss_pageeater.0'), []], boss_moth: [R.T('battle.demo.BOSSES.boss_moth.0'), []], boss_rooteater: [R.T('battle.demo.BOSSES.boss_rooteater.0'), [['b_root', R.T('battle.demo.BOSSES.boss_rooteater.1.0.1'), 's'], ['b_root', R.T('battle.demo.BOSSES.boss_rooteater.1'), 's']]], boss_wolflord: [R.T('battle.demo.BOSSES.boss_wolflord.0'), [['wolf_1', R.T('battle.demo.BOSSES.boss_wolflord.1.0.1'), 'm']]],
  };
  const SKILLS = {
    sword: [[R.T('battle.demo.SKILLS.sword.0'), 4, R.T('battle.demo.SKILLS.sword.0.2')], [R.T('battle.demo.SKILLS.sword.1.0'), 6, R.T('battle.demo.SKILLS.sword.1.2'), 0, 'thunder'], [R.T('battle.demo.SKILLS.sword.2.0'), 0, R.T('battle.demo.SKILLS.sword.2'), 1], [R.T('battle.demo.SKILLS.sword.3.0'), 12, R.T('battle.demo.SKILLS.sword.3.2'), 0, null, 'mp']],
    dagger: [[R.T('battle.demo.SKILLS.dagger.0'), 3, R.T('battle.demo.SKILLS.dagger.0.2')], [R.T('battle.demo.SKILLS.dagger.1.0'), 0, R.T('battle.demo.SKILLS.dagger.1.2')]],
    bow: [[R.T('battle.demo.SKILLS.bow.0'), 4, R.T('battle.demo.SKILLS.bow.0.2')], [R.T('battle.demo.SKILLS.bow.1.0'), 5, R.T('battle.demo.SKILLS.bow.1.2')]],
    staff: [[R.T('battle.demo.SKILLS.staff.0'), 2, R.T('battle.demo.SKILLS.staff.0.2')]],
  };
  const SPELLS = [[R.T('battle.demo.SPELLS.0'), 4, R.T('battle.demo.SPELLS.0.2'), 'fire', 'enemy'], [R.T('battle.demo.SPELLS.1.0'), 3, R.T('battle.demo.SPELLS.1.2'), null, 'ally'], [R.T('battle.demo.SPELLS.2.0'), 5, R.T('battle.demo.SPELLS.2'), 'ice', 'enemies'], [R.T('battle.demo.SPELLS.3.0'), 0, R.T('battle.demo.SPELLS.3.2'), 'light', 'enemy']];

  D.create = function (setup) {
    const name = String(setup.demo || 'normal');
    const retry = setup.retry || 0;
    const units = [];
    const members = (R.Party && R.Party.members ? R.Party.members() : []).slice(0, 4);
    const pn = R.T('battle.demo.create.pn');
    for (let i = 0; i < 4; i++) {
      const c = members[i] || { id: 'demo_p' + i, name: pn[i], look: 'demo_p' + i };
      const h = HPS[i];
      let hp = h[0];
      if (name === 'victory' || name === 'normal' || name === 'boss_pageeater') hp = Math.max(hp, Math.round(h[1] * 0.7));
      const alive = !(name === 'hurt' && i === 2);
      units.push({ uid: 'p' + i, side: 'party', id: c.id, name: c.name || pn[i], hp: alive ? hp : 0, mp: h[2], maxHp: h[1], maxMp: h[3], row: name === 'backrow' ? (i === 0 ? 'front' : 'back') : ROWS[i], status: name === 'hurt' && i === 1 ? ['poison'] : [], sprite: c.look, look: c.look, size: 'm', alive, wtype: WT[i] });
    }
    let foes = FOES.normal;
    let boss = null;
    if (BOSSES[name]) { boss = name; foes = BOSSES[name][1]; }
    else if (name === 'tele') { boss = 'boss_rooteater'; foes = BOSSES.boss_rooteater[1]; }
    else if (name === 'many') foes = FOES.many;
    if (boss) units.push({ uid: 'e_boss', side: 'enemy', id: boss, name: BOSSES[boss][0], hp: 3000, mp: 0, maxHp: 3000, maxMp: 0, row: 'front', status: [], sprite: boss, size: 'l', alive: true, wtype: null, boss: true, golden: false });
    foes.forEach((f, i) => units.push({ uid: 'e' + i, side: 'enemy', id: f[0], name: f[1], hp: 200, mp: 0, maxHp: 200, maxMp: 0, row: 'front', status: [], sprite: f[0], size: f[2], alive: true, wtype: null, golden: name === 'golden' && i === 0, boss: false }));

    let over = null, repeatOn = false, finished = null, round = 0, seeded = false;
    const subs = {};
    const P = (i) => units[i];
    const E = () => units.filter((u) => u.side === 'enemy' && u.alive);
    const kill = (u) => { u.hp = 0; u.alive = false; };
    const B = {
      setup, units, demo: name,
      get over() { return over; },
      get repeatOn() { return repeatOn; },
      setRepeat(v) { repeatOn = !!v; },
      options(uid) {
        const u = units.find((x) => x.uid === uid);
        if (!u || !u.alive) return [];
        const list = (SKILLS[u.wtype] || []).map(([n, mp, desc, isNew, el, reason], j) => ({ id: `demo_${u.wtype}_${j}`, name: n, mp, usable: !reason && u.mp >= mp, reason: reason || (u.mp < mp ? 'mp' : null), isNew: !!isNew, desc, element: el }));
        const sp = SPELLS.map(([n, mp, desc, el, target], j) => ({ id: 'demo_sp_' + j, name: n, mp, usable: u.mp >= mp, reason: u.mp >= mp ? null : 'mp', isNew: false, desc, target }));
        const items = [{ id: 'i_potion', name: R.T('battle.demo.create.i_potion.name'), usable: true, target: 'ally', desc: R.T('battle.demo.create.i_potion.desc') }];
        const o = [{ cmd: 'attack', target: 'enemy' }, { cmd: 'skill', list, target: 'enemy' }];
        if (u.wtype === 'staff' || u.wtype === 'bow' || u.uid === 'p0') o.push({ cmd: 'spell', list: sp, target: 'enemy' });
        o.push({ cmd: 'defend', target: 'self' }, { cmd: 'item', list: items, target: 'ally' });
        return o;
      },
      seedRepeat(prev) { seeded = !!prev; return seeded; },
      lastCommands() { return round > 0 || seeded ? Object.fromEntries(units.filter((u) => u.side === 'party').map((u) => [u.id, { type: 'attack', id: null }])) : null; },
      partyOptions() { const o = ['fight']; if (round > 0 || seeded) o.push('repeat'); if (!setup.noEscape && !boss) o.push('escape'); return o; },
      submit(uid, c) { subs[uid] = c; },
      repeat() {},
      escape() { subs._escape = true; },
      round() {
        round++;
        const ev = [];
        if (subs._escape) { delete subs._escape; over = 'escape'; ev.push({ t: 'msg', text: R.T('battle.demo.create.B.round.text') }, { t: 'end', result: 'escape' }); return ev; }
        const act = (u, cmd, id, nm, targets) => {
          // 見本: 技・術は MP を払う（本物と同じく act に mp。札はこの時に減る）
          const mp = u.side === 'party' && (cmd === 'skill' || cmd === 'spell') ? Math.min(u.mp, cmd === 'spell' ? 6 : 4) : 0;
          if (mp) u.mp -= mp;
          ev.push({ t: 'turn', uid: u.uid }, Object.assign({ t: 'act', uid: u.uid, cmd, id, name: nm, targets: targets.map((t) => t.uid) }, mp ? { mp } : {}));
        };
        const dmg = (t, n, o) => { t.hp = Math.max(0, t.hp - n); ev.push(Object.assign({ t: 'dmg', uid: t.uid, n, crit: false, weak: false, kind: 'phys' }, o)); if (t.hp <= 0 && t.alive) { t.alive = false; ev.push({ t: 'ko', uid: t.uid }); } };
        const heal = (t, n, mp) => { if (mp) t.mp = Math.min(t.maxMp, t.mp + n); else t.hp = Math.min(t.maxHp, t.hp + n); ev.push({ t: 'heal', uid: t.uid, n, mp: !!mp }); };
        const e0 = () => E()[0], e1 = () => E()[1] || E()[0];
        const S = D.scripts[name] || D.scripts.normal;
        S({ ev, act, dmg, heal, P, E, e0, e1, kill, units, round, retry, boss, setOver: (v) => { over = v; } });
        if (!over && !E().length) over = 'win';
        if (!over && !units.some((u) => u.side === 'party' && u.alive)) over = 'lose';
        if (over && !ev.some((e) => e.t === 'end')) ev.push({ t: 'end', result: over });
        return ev;
      },
      rewards() {
        const r = { gold: 380, drops: [{ item: 'mt_wolf_pelt', grade: 'normal', n: 2 }, { item: 'i_potion', grade: 'normal' }, { item: 'dg_frost_fang', grade: 'rare' }], grow: [{ c: P(0).id, hp: 12, mp: 3 }, { c: P(2).id, hp: 9, mp: 4 }], prof: [{ c: P(0).id, key: 'sword' }, { c: P(2).id, key: 'bow' }, { c: P(3).id, key: 'fire' }], glimmers: name === 'glimmer' || name === 'all' ? [{ id: 'demo_sword_1', name: R.T('battle.demo.create.demo_sword_1.name') }] : [] };
        // 熟練度の札の見本（result_prof.js）: 段階の前後つき（本物の B.rewards と同じ形 {c, key, kind, rank, from}）と、誰が閃いたか
        if (name === 'prof' || name === 'prof_many') { r.prof = D.PROF_UPS(P, name); r.glimmers = D.PROF_GLIM(P, name); }
        return r;
      },
      finish() { if (finished) return finished.r; finished = { r: over === 'win' ? B.rewards() : null }; return finished.r; },
    };
    return B;
  };

  // ---------------------------------------------------------------- 台本（1 ラウンドずつ）
  D.scripts = {
    normal(s) {
      const a = s.P(0);
      s.act(a, 'attack', 'attack', R.T('battle.demo.scripts.normal.act'), [s.e1()]); s.dmg(s.e1(), 64);
      s.act(s.P(1), 'attack', 'attack', R.T('battle.demo.scripts.normal.act'), [s.e0()]); s.dmg(s.e0(), 58);
      s.act(s.P(2), 'skill', 'demo_bow_0', R.T('battle.demo.scripts.normal.act_2'), [s.e0()]); s.dmg(s.e0(), 88, { crit: true });
      s.ev.push({ t: 'turn', uid: 'e1' }, { t: 'act', uid: s.E()[0] ? s.E()[0].uid : 'e1', cmd: 'attack', id: 'bite', name: R.T('battle.demo.scripts.bite.name'), targets: ['p1'] }); s.dmg(s.P(1), 31);
      s.act(s.P(3), 'spell', 'demo_sp_0', R.T('battle.demo.scripts.normal.act_3'), [s.e0()]); s.dmg(s.e0(), 72, { kind: 'fire', weak: true });
      if (s.round >= 2) { for (const e of s.E()) s.dmg(e, 999); }
    },
    glimmer(s) {
      s.ev.push({ t: 'turn', uid: 'p0' }, { t: 'glimmer', uid: 'p0', kind: 'tech', id: 'demo_sword_1', name: R.T('battle.demo.scripts.demo_sword_1.name') });
      s.ev.push({ t: 'act', uid: 'p0', cmd: 'skill', id: 'demo_sword_1', name: R.T('battle.demo.scripts.demo_sword_1.name'), targets: ['e1'] });
      s.dmg(s.units.find((u) => u.uid === 'e1'), 1284, { crit: true, kind: 'thunder' });
      s.act(s.P(3), 'spell', 'demo_sp_1', R.T('battle.demo.scripts.glimmer.act'), [s.P(1)]); s.heal(s.P(1), 86);
      for (const e of s.E()) s.dmg(e, 999);
    },
    spell(s) {
      s.act(s.P(3), 'spell', 'demo_sp_2', R.T('battle.demo.scripts.spell.act'), s.E());
      for (const e of s.E()) s.dmg(e, 140, { kind: 'ice' });
      s.act(s.P(2), 'spell', 'demo_sp_0', R.T('battle.demo.scripts.spell.act_2'), [s.e0()]); s.dmg(s.e0(), 999, { kind: 'fire' });
      for (const e of s.E()) s.dmg(e, 999);
    },
    tele(s) {
      const b = s.units.find((u) => u.boss);
      s.act(s.P(0), 'attack', 'attack', R.T('battle.demo.scripts.tele.act'), [b]); s.dmg(b, 120);
      s.ev.push({ t: 'turn', uid: b.uid }, { t: 'telegraph', uid: b.uid, text: R.T('battle.demo.scripts.tele.text'), pose: 'tele', tint: '#8fd6d8', next: 'root_burst' });
      if (s.round >= 2) { s.ev.push({ t: 'act', uid: b.uid, cmd: 'skill', id: 'root_burst', name: R.T('battle.demo.scripts.root_burst.name'), targets: ['p0', 'p1', 'p2', 'p3'] }); for (let i = 0; i < 4; i++) if (s.P(i).alive) s.dmg(s.P(i), 40 + i * 7); }
      if (s.round >= 3) for (const e of s.E()) s.dmg(e, 9999);
    },
    steal(s) {
      s.act(s.P(1), 'skill', 'demo_dagger_1', R.T('battle.demo.scripts.steal.act'), [s.e1()]);
      s.ev.push({ t: 'steal', uid: 'p1', target: s.e1().uid, item: 'dg_frost_fang', grade: 'rare', stealOnly: false });
      s.ev.push({ t: 'gain', item: 'dg_frost_fang', grade: 'rare', stolen: true });
      s.act(s.P(1), 'skill', 'demo_dagger_1', R.T('battle.demo.scripts.steal.act'), [s.e0()]);
      s.ev.push({ t: 'steal', uid: 'p1', target: s.e0().uid, item: 'ac_st_rooteater', grade: 'super', stealOnly: true });
      s.ev.push({ t: 'gain', item: 'ac_st_rooteater', grade: 'super', stolen: true, stealOnly: true });
      if (s.round >= 2) for (const e of s.E()) s.dmg(e, 999);
    },
    victory(s) {
      s.act(s.P(0), 'attack', 'attack', R.T('battle.demo.scripts.victory.act'), [s.e0()]);
      for (const e of s.E()) s.dmg(e, 999);
      s.ev.push({ t: 'grow', c: s.P(0).id, hp: 12, mp: 3 }, { t: 'prof', c: s.P(0).id, key: 'sword' });
    },
    wipe(s) {
      if (s.retry > 0) { for (const e of s.E()) s.dmg(e, 999); return; }
      const w = s.units.find((u) => u.uid === 'e1');
      s.ev.push({ t: 'turn', uid: 'e1' }, { t: 'act', uid: 'e1', cmd: 'skill', id: 'blizzard_howl', name: R.T('battle.demo.scripts.blizzard_howl.name'), targets: ['p0', 'p1', 'p2', 'p3'] });
      for (let i = 0; i < 4; i++) s.dmg(s.P(i), 999);
      void w;
    },
    all(s) {
      const b = s.e0(), w = s.e1();
      if (s.round === 1) {
        s.ev.push({ t: 'msg', text: R.T('battle.demo.scripts.all.text') });
        s.ev.push({ t: 'turn', uid: 'p0' }, { t: 'glimmer', uid: 'p0', kind: 'tech', id: 'demo_sword_1', name: R.T('battle.demo.scripts.demo_sword_1.name') });
        s.ev.push({ t: 'act', uid: 'p0', cmd: 'skill', id: 'demo_sword_1', name: R.T('battle.demo.scripts.demo_sword_1.name'), targets: [w.uid] }); s.dmg(w, 150, { crit: true });
        s.act(s.P(1), 'attack', 'attack', R.T('battle.demo.scripts.all.act'), [b]); s.ev.push({ t: 'miss', uid: b.uid });
        s.act(s.P(1), 'skill', 'demo_dagger_1', R.T('battle.demo.scripts.all.act_2'), [w]); s.ev.push({ t: 'steal', uid: 'p1', target: w.uid, item: 'dg_frost_fang', grade: 'rare' }, { t: 'gain', item: 'dg_frost_fang', grade: 'rare', stolen: true });
        s.ev.push({ t: 'turn', uid: b.uid }, { t: 'act', uid: b.uid, cmd: 'skill', id: 'venom', name: R.T('battle.demo.scripts.venom.name'), targets: ['p2'] }); s.dmg(s.P(2), 30); s.ev.push({ t: 'status', uid: 'p2', id: 'poison', on: true });
        s.ev.push({ t: 'telegraph', uid: w.uid, text: R.T('battle.demo.scripts.all.text_2'), pose: 'tele', tint: '#8fd6d8', next: 'breath' });
        s.ev.push({ t: 'summon', uid: b.uid, mon: { uid: 'e_sum', side: 'enemy', id: 'jelly_2', name: R.T('battle.demo.scripts.jelly_2.name'), hp: 30, mp: 0, maxHp: 30, maxMp: 0, row: 'front', status: [], sprite: 'jelly_2', size: 's', alive: true } });
        s.ev.push({ t: 'turn', uid: w.uid }, { t: 'act', uid: w.uid, cmd: 'skill', id: 'breath', name: R.T('battle.demo.scripts.breath.name'), targets: ['p0', 'p1', 'p2', 'p3'] });
        for (let i = 0; i < 4; i++) s.dmg(s.P(i), i === 3 ? 999 : 25 + i * 3);
        s.act(s.P(0), 'item', 'i_revive', R.T('battle.demo.scripts.all.act_3'), [s.P(3)]); s.ev.push({ t: 'revive', uid: 'p3' }); s.P(3).alive = true; s.P(3).hp = 60; s.heal(s.P(3), 60);
        s.act(s.P(2), 'spell', 'demo_sp_1', R.T('battle.demo.scripts.all.act_4'), [s.P(2)]); s.heal(s.P(2), 40); s.heal(s.P(2), 5, true); s.ev.push({ t: 'status', uid: 'p2', id: 'poison', on: false });
        s.ev.push({ t: 'flee', uid: 'e2' }); const sl = s.units.find((u) => u.uid === 'e2'); if (sl) sl.alive = false;
      } else {
        for (const e of s.E()) s.dmg(e, 9999);
        s.ev.push({ t: 'gain', item: 'mt_wolf_pelt', grade: 'normal' }, { t: 'grow', c: s.P(0).id, hp: 12, mp: 3 }, { t: 'prof', c: s.P(0).id, key: 'sword' });
      }
    },
    // 熟練度の見本: 攻撃・術のたびに頭の上に「剣+1」、勝った後に「熟練度」の札（prof_many は頁が分かれる数）
    prof(s) {
      const ups = D.PROF_UPS(s.P, 'prof');
      const pop = (i) => { for (const u of ups) if (u.c === s.P(i).id) s.ev.push({ t: 'prof', c: u.c, key: u.key, uid: s.P(i).uid, kind: u.kind, rank: u.rank, from: u.from }); };
      s.act(s.P(0), 'attack', 'attack', R.T('battle.demo.scripts.prof.act'), [s.e0()]); s.dmg(s.e0(), 64); pop(0);
      s.act(s.P(2), 'skill', 'demo_bow_0', R.T('battle.demo.scripts.prof.act_2'), [s.e0()]); s.dmg(s.e0(), 88); pop(2);
      s.act(s.P(3), 'spell', 'demo_sp_0', R.T('battle.demo.scripts.prof.act_3'), [s.e0()]); s.dmg(s.e0(), 72, { kind: 'fire' }); pop(3);
      if (s.round >= 2) { for (const e of s.E()) s.dmg(e, 999); }
    },
    prof_many(s) { for (const e of s.E()) s.dmg(e, 999); },
    hurt(s) { D.scripts.normal(s); },
    backrow(s) { D.scripts.normal(s); },
    many(s) { D.scripts.normal(s); },
  };
  for (const b of Object.keys(BOSSES)) D.scripts[b] = function (s) { const bo = s.units.find((u) => u.boss); s.act(s.P(0), 'attack', 'attack', R.T('battle.demo.act'), [bo]); s.dmg(bo, 150); if (s.round >= 2) for (const e of s.E()) s.dmg(e, 9999); };
  D.PROF_UPS = function (P, name) {
    const u = (i, key, kind, from, rank) => ({ c: P(i).id, key, kind, from, rank });
    const out = [u(0, 'sword', 'w', 12, 13), u(2, 'bow', 'w', 8, 9), u(3, 'fire', 'e', 15, 16), u(3, 'wind', 'e', 9, 11), u(3, 'staff', 'w', 20, 21)];
    if (name === 'prof_many') out.push(u(0, 'light', 'e', 4, 5), u(0, 'greatsword', 'w', 2, 3), u(1, 'dagger', 'w', 17, 18), u(1, 'dark', 'e', 6, 7), u(1, 'wind', 'e', 3, 4), u(2, 'earth', 'e', 11, 12), u(2, 'water', 'e', 5, 6), u(3, 'light', 'e', 22, 23), u(3, 'dark', 'e', 7, 8));
    return out;
  };
  D.PROF_GLIM = function (P, name) {
    const out = [{ c: P(0).id, kind: 'tech', id: 'demo_sword_1', name: R.T('battle.demo.PROF_GLIM.demo_sword_1.name') }];
    if (name === 'prof_many') out.push({ c: P(3).id, kind: 'spell', id: 'demo_sp_x', name: R.T('battle.demo.PROF_GLIM.demo_sp_x.name') }, { c: P(1).id, kind: 'tech', id: 'demo_dagger_x', name: R.T('battle.demo.PROF_GLIM.demo_dagger_x.name') });
    return out;
  };
  D.NAMES = Object.keys(D.scripts);
})(window.RPG);
