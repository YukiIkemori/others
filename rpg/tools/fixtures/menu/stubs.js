// Menu test fixtures: stand-in jobs, abilities, monsters, objectives and art for
// anything the real data/art owners have not registered yet. Never overrides an
// existing entry. Loaded only by the menu harness / node tests — never shipped.
(function (R) {
  'use strict';
  const DB = R.DB;
  const put = (reg, id, v) => { if (!reg[id]) reg[id] = v; };

  // ---------------------------------------------------------------- jobs
  const W = (o) => Object.assign({ mult: { hp: 1, mp: 1, str: 1, vit: 1, agi: 1, int: 1, mnd: 1, luk: 1 }, heads: ['hat'], bodies: ['light', 'robe'], shield: false }, o);
  const JOBS = {
    warrior: W({ name: '戦士', tier: 1, command: '技', desc: '武器と盾で戦う、基本の戦士。', weapons: ['sword', 'axe', 'spear'], shield: true, heads: ['helm', 'hat'], bodies: ['heavy', 'light'], outfit: { main: '#3a64c8', sub: '#c8ccd8', trim: '#e0b040' }, mult: { hp: 1.2, mp: 0.6, str: 1.2, vit: 1.15, agi: 1, int: 0.7, mnd: 0.8, luk: 1 } }),
    priest: W({ name: '僧侶', tier: 1, command: '祈り', desc: '回復の祈りをささげる僧侶。', weapons: ['staff'], outfit: { main: '#e8e8f0', sub: '#4a8ad0', trim: '#e0b040' } }),
    mage: W({ name: '魔法使い', tier: 1, command: '魔法', desc: '攻撃魔法を操る。', weapons: ['rod', 'knife'], outfit: { main: '#7a3ca8', sub: '#3a2a60', trim: '#f0d060' } }),
    thief: W({ name: '盗賊', tier: 1, command: '盗む', desc: '素早く敵の道具を盗む。', weapons: ['knife'], outfit: { main: '#4a8a3a', sub: '#6a4a2a', trim: '#c0c0c0' } }),
    knight: W({ name: 'ナイト', tier: 2, command: '騎士道', req: [['warrior', 3]], weapons: ['sword', 'spear'], shield: true, heads: ['helm'], bodies: ['heavy'], outfit: { main: '#b8c0d0', sub: '#2a4a9a', trim: '#e0c050' } }),
    monk: W({ name: '武闘家', tier: 2, command: '拳法', req: [['warrior', 2], ['priest', 2]], weapons: ['claw'], outfit: { main: '#e07a2a', sub: '#302820', trim: '#f0e0a0' } }),
    whitemage: W({ name: '白魔術師', tier: 2, command: '白魔法', req: [['priest', 3]], weapons: ['staff'], outfit: { main: '#f4f4f4', sub: '#c83a3a', trim: '#e0b040' } }),
    blackmage: W({ name: '黒魔術師', tier: 2, command: '黒魔法', req: [['mage', 3]], weapons: ['rod'], outfit: { main: '#2a2a50', sub: '#6a4ab0', trim: '#e0c040' } }),
    hunter: W({ name: '狩人', tier: 2, command: '狩猟', req: [['thief', 3]], weapons: ['bow', 'knife'], outfit: { main: '#5a7a2a', sub: '#8a5a2a', trim: '#d0c090' } }),
    bard: W({ name: '吟遊詩人', tier: 2, command: '歌', req: [['priest', 2], ['thief', 2]], weapons: ['harp', 'knife'], outfit: { main: '#3aa0a0', sub: '#e0e0a0', trim: '#c04a8a' } }),
    alchemist: W({ name: '薬師', tier: 2, command: '調合', req: [['mage', 2], ['thief', 2]], weapons: ['knife', 'staff'], outfit: { main: '#8a6a3a', sub: '#e0d0b0', trim: '#4a9a4a' } }),
    spellblade: W({ name: '魔法剣士', tier: 3, command: '魔法剣', req: [['knight', 3], ['blackmage', 3]], weapons: ['sword'], shield: true, heads: ['helm', 'hat'], bodies: ['heavy', 'light'], outfit: { main: '#3a3ab0', sub: '#b03a3a', trim: '#e0e0e0' } }),
    paladin: W({ name: 'パラディン', tier: 3, command: '聖剣', req: [['knight', 5], ['whitemage', 4]], weapons: ['sword', 'spear'], shield: true, heads: ['helm'], bodies: ['heavy'], outfit: { main: '#f0f0f0', sub: '#3a6ad0', trim: '#f0c040' } }),
    ninja: W({ name: '忍者', tier: 3, command: '忍法', req: [['hunter', 4], ['monk', 3]], weapons: ['katana', 'knife'], outfit: { main: '#303040', sub: '#8a2a2a', trim: '#a0a0b0' }, innate: { twoSwords: true } }),
    sage: W({ name: '賢者', tier: 3, command: '秘術', req: [['whitemage', 5], ['blackmage', 5]], weapons: ['staff', 'rod'], outfit: { main: '#2a8a5a', sub: '#f0e0b0', trim: '#e0b040' } }),
    dragoon: W({ name: '竜騎士', tier: 3, command: '槍術', req: [['knight', 4], ['hunter', 4]], weapons: ['spear'], shield: true, heads: ['helm'], bodies: ['heavy'], outfit: { main: '#4a3a8a', sub: '#2a8a8a', trim: '#e0c050' } }),
    timemage: W({ name: '時空術師', tier: 3, command: '時空魔法', req: [['blackmage', 4], ['bard', 3]], weapons: ['rod', 'staff'], outfit: { main: '#c0a030', sub: '#402a60', trim: '#f0f0f0' } }),
    darkknight: W({ name: '暗黒騎士', tier: 3, command: '暗黒剣', req: [['warrior', 6], ['blackmage', 4]], weapons: ['sword', 'axe'], shield: true, heads: ['helm'], bodies: ['heavy'], outfit: { main: '#2a2030', sub: '#6a1a2a', trim: '#8a8a9a' } }),
    hero: W({ name: '勇者', tier: 4, command: '奇跡', req: [['paladin', 5], ['spellblade', 5]], weapons: ['sword', 'spear', 'axe'], shield: true, heads: ['helm', 'hat'], bodies: ['heavy', 'light'], outfit: { main: '#2a60d0', sub: '#e03a3a', trim: '#f0d040' } }),
  };
  for (const id in JOBS) {
    JOBS[id].abilities = [];
    JOBS[id].desc = JOBS[id].desc || JOBS[id].name + 'の道を極める者のジョブ。';
    put(DB.jobs, id, JOBS[id]);
  }

  // ------------------------------------------------------------- abilities
  const AB = {
    warrior_power_slash: { name: 'ちからため', kind: 'action', jp: 50, mp: 0, target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.5 }], desc: '力を込めて敵を斬りつける。' },
    warrior_counter: { name: 'カウンター', kind: 'reaction', jp: 200, trigger: 'hitPhys', chance: 0.35, react: { type: 'counter' }, desc: '攻撃を受けると、ときどき反撃する。' },
    warrior_hp_up: { name: 'HPアップ', kind: 'support', jp: 250, mods: { hpPct: 20 }, desc: '最大HPが20%上がる。' },
    warrior_equip_axe: { name: '斧装備', kind: 'support', jp: 150, mods: { equip: ['axe'] }, desc: 'どのジョブでも斧を装備できる。' },
    warrior_first_aid: { name: '応急手当', kind: 'action', jp: 80, mp: 0, target: 'self', effects: [{ type: 'heal', power: 20, scale: 0.3 }], fieldUse: true, desc: '自分の傷を手当てする。' },
    priest_heal: { name: 'ヒール', kind: 'action', jp: 50, mp: 3, magic: true, target: 'ally', effects: [{ type: 'heal', power: 28, scale: 0.6 }], fieldUse: true, desc: '仲間ひとりのHPを回復する。' },
    priest_cure: { name: 'キュア', kind: 'action', jp: 80, mp: 2, magic: true, target: 'ally', effects: [{ type: 'cure', statuses: ['poison'] }], fieldUse: true, desc: '仲間ひとりの毒を治す。' },
    priest_heal_all: { name: 'ヒールオール', kind: 'action', jp: 300, mp: 10, magic: true, target: 'allies', effects: [{ type: 'heal', power: 40, scale: 0.5 }], fieldUse: true, desc: '味方全員のHPを回復する。' },
    priest_revive: { name: 'リバイブ', kind: 'action', jp: 400, mp: 12, magic: true, target: 'ally_dead', effects: [{ type: 'revive', pct: 0.5 }], fieldUse: true, desc: '倒れた仲間を生き返らせる。' },
    priest_mp_regain: { name: 'MP回収', kind: 'reaction', jp: 300, trigger: 'hitMagic', chance: 0.5, react: { type: 'mp', power: 5 }, desc: '魔法を受けるとMPを回復する。' },
    priest_walk_heal: { name: '癒しの歩み', kind: 'field', jp: 200, mods: { walkHeal: 1 }, desc: '歩くたびにHPが少し回復する。' },
    mage_fire: { name: 'ファイア', kind: 'action', jp: 50, mp: 3, magic: true, target: 'enemy', effects: [{ type: 'damage', formula: 'magic', power: 20, element: 'fire' }], desc: '敵ひとりを炎で焼く。' },
    mage_teleport: { name: 'テレポート', kind: 'action', jp: 150, mp: 8, magic: true, target: 'self', effects: [{ type: 'teleport' }], fieldUse: true, desc: '訪れた町へ一瞬で飛ぶ。' },
    mage_exit: { name: 'エスケープ', kind: 'action', jp: 120, mp: 6, magic: true, target: 'self', effects: [{ type: 'exit' }], fieldUse: true, desc: '洞窟や塔から脱出する。' },
    mage_mp_up: { name: 'MPアップ', kind: 'support', jp: 250, mods: { mpPct: 20 }, desc: '最大MPが20%上がる。' },
    thief_steal: { name: '盗む', kind: 'action', jp: 50, target: 'enemy', effects: [{ type: 'steal' }], desc: '敵から道具を盗む。' },
    thief_repel: { name: '忍び足', kind: 'action', jp: 100, mp: 4, target: 'self', effects: [{ type: 'repel', steps: 120 }], fieldUse: true, desc: 'しばらく魔物に出会いにくくなる。' },
    thief_treasure: { name: '宝探し', kind: 'field', jp: 150, mods: { treasureSense: true }, desc: '隠された道具が光って見える。' },
    thief_encounter_down: { name: '気配消し', kind: 'field', jp: 300, mods: { encounterPct: -50 }, desc: '魔物に出会う確率が半分になる。' },
    thief_evade: { name: '見切り', kind: 'reaction', jp: 200, trigger: 'hitPhys', chance: 0.3, react: { type: 'buff', stat: 'agi', stages: 1 }, desc: '攻撃を受けると素早さが上がる。' },
    ninja_dual: { name: '二刀流', kind: 'support', jp: 500, mods: { twoSwords: true }, desc: '武器をふたつ持てる。' },
    knight_cover: { name: 'かばう', kind: 'reaction', jp: 300, trigger: 'allyLowHp', chance: 0.6, react: { type: 'cover' }, desc: '弱った仲間をかばう。' },
    knight_equip_shield: { name: '盾装備', kind: 'support', jp: 200, mods: { equip: ['shield', 'heavy', 'helm'] }, desc: '盾と重い鎧を装備できる。' },
    whitemage_holy: { name: 'ホーリー', kind: 'action', jp: 600, mp: 30, magic: true, target: 'enemy', effects: [{ type: 'damage', formula: 'magic', power: 120, element: 'holy' }], desc: '聖なる光で敵を撃つ。' },
  };
  for (const id in AB) {
    AB[id].job = AB[id].job || id.split('_')[0];
    if (!DB.abilities[id] && DB.jobs[AB[id].job] === JOBS[AB[id].job]) {
      DB.abilities[id] = AB[id];
      JOBS[AB[id].job].abilities.push(id);
    }
  }
  // give every stub job a couple of generic abilities so the learn screen is populated
  for (const jid in JOBS) {
    if (DB.jobs[jid] !== JOBS[jid]) continue;
    const j = JOBS[jid];
    const extra = [
      ['act1', { name: j.command.slice(0, 6) + 'I', kind: 'action', jp: 100, mp: 4, target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.3 }], desc: j.name + 'の基本の技。' }],
      ['act2', { name: j.command.slice(0, 6) + 'II', kind: 'action', jp: 350, mp: 9, target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 40 }], desc: '敵全体に' + j.name + 'の秘伝を放つ。' }],
      ['sup', { name: j.name.slice(0, 5) + 'のこころ', kind: 'support', jp: 400, mods: { atkPct: 5 }, desc: j.name + 'の心得で攻撃力が少し上がる。' }],
    ];
    for (const [k, a] of extra) {
      const id = jid + '_' + k;
      if (DB.abilities[id]) continue;
      a.job = jid; DB.abilities[id] = a; j.abilities.push(id);
    }
  }

  // -------------------------------------------------------------- monsters
  const MON = {
    blue_jelly: { name: 'ブルージェリー', sprite: 'jelly', lv: 1, hp: 8, mp: 0, atk: 9, def: 4, agi: 4, mag: 0, mdef: 2, exp: 2, gold: 3, jp: 2, drop: { item: 'herb', rate: 8 }, rare: { item: 'seed_hp', rate: 128 }, desc: 'ぷるぷる震える青いゼリー。弱いが群れで襲ってくる。' },
    red_jelly: { name: 'レッドジェリー', sprite: 'jelly', hue: 150, lv: 3, hp: 16, mp: 4, atk: 14, def: 8, agi: 6, mag: 8, mdef: 4, exp: 6, gold: 6, jp: 3, elem: { fire: 0.5, ice: 2 }, drop: { item: 'antidote', rate: 8 }, rare: { item: 'clover', rate: 128 }, desc: '炎を吸ったゼリー。体がほんのり温かい。' },
    cave_bat: { name: 'ほら穴コウモリ', sprite: 'bat', lv: 2, hp: 12, mp: 0, atk: 12, def: 5, agi: 12, mag: 0, mdef: 3, exp: 4, gold: 4, jp: 2, flags: ['flying'], drop: { item: 'eye_drop', rate: 8 }, rare: { item: 'seed_agi', rate: 128 }, desc: '暗闇をすみかにするコウモリ。' },
    goblin: { name: 'ゴブリン', sprite: 'goblin', lv: 4, hp: 30, mp: 0, atk: 18, def: 10, agi: 8, mag: 0, mdef: 5, exp: 10, gold: 12, jp: 4, drop: { item: 'herb', rate: 6 }, rare: { item: 'copper_knife', rate: 64 }, desc: 'いたずら好きな小鬼。武器を振り回して襲ってくる。' },
    metal_jelly: { name: 'メタルジェリー', sprite: 'jelly', sat: 0, bri: 1.2, lv: 12, hp: 4, mp: 10, atk: 30, def: 999, agi: 120, mag: 10, mdef: 999, exp: 1200, gold: 20, jp: 60, flags: ['metal', 'flee'], drop: { item: 'mana_drop', rate: 4 }, rare: { item: 'seed_luk', rate: 32 }, desc: '鋼のように硬いゼリー。すぐに逃げ出す。' },
    golem: { name: 'ストーンゴーレム', sprite: 'golem', lv: 16, hp: 220, mp: 0, atk: 70, def: 60, agi: 10, mag: 0, mdef: 20, exp: 180, gold: 90, jp: 20, elem: { thunder: 2, earth: 0 }, drop: { item: 'healing_grass', rate: 8 }, rare: { item: 'iron_ring', rate: 64 }, desc: 'いにしえの魔法で動く石の巨人。' },
    goblin_chief: { name: 'ゴブリンキング', sprite: 'boss_goblin_chief', lv: 6, hp: 260, mp: 20, atk: 26, def: 14, agi: 10, mag: 6, mdef: 8, exp: 120, gold: 150, jp: 30, flags: ['boss'], desc: '風の洞窟をすみかにしたゴブリンの親玉。' },
  };
  for (const id in MON) put(DB.monsters, id, MON[id]);

  // ------------------------------------------------------ objectives, locations
  put(DB, 'objectives', {});
  put(DB.objectives, 'obj_start', { text: 'レグナス城の王様に会いに行こう。' });
  put(DB.objectives, 'obj_wind', { text: 'ミルトの村の北にある風の洞窟で、風の紋章を手に入れよう。' });
  put(DB.locations, 'regnas', { name: '城下町レグナス', map: 'fx_world', spawn: 'fx_town' });
  put(DB.locations, 'milt', { name: 'ミルトの村', map: 'fx_world', spawn: 'fx_village' });

  // ------------------------------------------------------------------- art
  const G = R.Gfx;
  const def = (k, f) => { if (!G.has(k)) G.def(k, f); };
  const HAIR = { yuki: '#5a3418', non: '#e8a848', metem: '#c83a5a' };
  function person(cid, o) {
    const hair = HAIR[cid] || '#503020', skin = '#f4c8a0';
    const main = o.main, sub = o.sub, trim = o.trim;
    const mk = (dir, f) => {
      const p = G.pix(16, 24);
      // legs
      p.rect(5, 19, 2, 4, sub); p.rect(9, 19, 2, 4, sub);
      if (f) { p.rect(5, 22, 2, 1, '#302018'); p.rect(9, 21, 2, 2, '#302018'); } else { p.rect(5, 21, 2, 2, '#302018'); p.rect(9, 22, 2, 1, '#302018'); }
      // body
      p.rect(4, 11, 8, 9, main);
      p.hline(4, 11, 15, trim);
      p.rect(3, 12, 1, 5, main); p.rect(12, 12, 1, 5, main);
      p.set(3, 17, skin); p.set(12, 17, skin);
      p.vline(4, 11, 19, G.shade(main, -0.3));
      // head
      p.circle(8, 7, 5, skin);
      if (dir === 'up') p.circle(8, 6, 5, hair);
      else {
        p.rect(3, 1, 10, 4, hair); p.set(3, 5, hair); p.set(12, 5, hair);
        if (dir !== 'right') p.set(6, 7, '#201010');
        if (dir !== 'left') p.set(10, 7, '#201010');
      }
      if (dir === 'left') p.rect(10, 2, 3, 7, hair);
      if (dir === 'right') p.rect(3, 2, 3, 7, hair);
      if (cid === 'non' || cid === 'metem') { p.rect(2, 5, 2, 6, hair); p.rect(12, 5, 2, 6, hair); }
      p.outline('#181020');
      return p.toCanvas();
    };
    const out = {};
    for (const d of ['down', 'up', 'left', 'right']) out[d] = [mk(d, 0), mk(d, 1)];
    return out;
  }
  for (const cid of ['yuki', 'non', 'metem']) {
    for (const jid in JOBS) def('party:' + cid + ':' + jid, () => person(cid, (DB.jobs[jid] && DB.jobs[jid].outfit) || JOBS[jid].outfit));
  }
  // 8x8 menu icons
  const ICON = {
    sword: ['.......w', '......wl', '.....wl.', '....wl..', '.y.wl...', '..yl....', '.bby....', 'bb..y...'],
    knife: ['........', '......w.', '.....wl.', '....wl..', '...wl...', '..y.....', '.bb.....', 'b.......'],
    axe: ['...ww...', '..wwlw..', '..wlbw..', '...wb...', '....b...', '....b...', '....b...', '....b...'],
    spear: ['.......w', '......wl', '.....bw.', '....b...', '...b....', '..b.....', '.b......', 'b.......'],
    staff: ['...yy...', '..y..y..', '...yy...', '....b...', '....b...', '....b...', '....b...', '....b...'],
    rod: ['....rr..', '...rrrr.', '....rr..', '...b....', '...b....', '..b.....', '..b.....', '.b......'],
    bow: ['..bw....', '.b..w...', 'b....w..', 'b....w..', 'b....w..', 'b....w..', '.b..w...', '..bw....'],
    claw: ['.w.w.w..', '.w.w.w..', '.wwwww..', '.bbbbb..', '.bbbbb..', '..bbb...', '........', '........'],
    katana: ['.......l', '......l.', '.....l..', '....l...', '...l....', '..y.....', '.b......', 'b.......'],
    harp: ['.yyyy...', 'y.w.wy..', 'y.w.w.y.', 'y.w.w.y.', 'y.w.w.y.', '.yyyyy..', '........', '........'],
    shield: ['.wwwwww.', '.wllllw.', '.wlyylw.', '.wlyylw.', '.wllllw.', '..wllw..', '...ww...', '........'],
    helm: ['..llll..', '.llwwll.', '.lwwwwl.', '.llllll.', '.l.bb.l.', '.l....l.', '........', '........'],
    hat: ['...rr...', '..rrrr..', '..rrrr..', '.rrrrrr.', 'rrrrrrrr', '........', '........', '........'],
    heavy: ['.ll..ll.', 'llllllll', 'llwwwwll', '.lwwwwl.', '.llllll.', '.llllll.', '.ll..ll.', '........'],
    light: ['.bb..bb.', 'bbbbbbbb', 'bbyyyybb', '.bbbbbb.', '.bbbbbb.', '.bbbbbb.', '.bb..bb.', '........'],
    robe: ['..rrrr..', '.rrrrrr.', 'rrryyrrr', '.rrrrrr.', '.rrrrrr.', 'rrrrrrrr', 'rrrrrrrr', '........'],
    acc: ['..yyyy..', '.y....y.', 'y......y', 'y......y', 'y......y', '.y....y.', '..yrry..', '...rr...'],
    herb: ['....g...', '...ggg..', '..gg.gg.', '.g..g..g', '....g...', '...gg...', '..g.....', '........'],
    potion: ['...bb...', '...ww...', '..wccw..', '.wccccw.', '.wccccw.', '.wccccw.', '..wwww..', '........'],
    key: ['.yyy....', 'y...y...', 'y...y...', '.yyy....', '..y.....', '..yy....', '..y.....', '..yy....'],
  };
  const IPAL = { w: '#f0f0f8', l: '#a8b0c0', y: '#f0c840', b: '#8a5a2a', r: '#d04040', g: '#50c050', c: '#50a0f0' };
  for (const k in ICON) def('icon:' + k, () => G.fromGrid(ICON[k], IPAL));

  // monster sprites (simple shaded blobs)
  const SIZES = { jelly: 32, bat: 32, goblin: 48, golem: 64, boss_goblin_chief: 64 };
  const MCOL = { jelly: '#3a8cff', bat: '#8a5ab0', goblin: '#5aa048', golem: '#8a7a6a', boss_goblin_chief: '#4a8a30' };
  for (const k in SIZES) def('mon:' + k, () => {
    const s = SIZES[k], p = G.pix(s, s);
    if (k === 'bat') {
      p.poly([[2, 10], [16, 16], [30, 10], [24, 22], [16, 20], [8, 22]], G.shade(MCOL[k], -0.2));
      p.shadeEllipse(16, 17, 6, 6, G.ramp(MCOL[k], 5));
    } else p.shadeEllipse(s / 2, s * 0.58, s * 0.42, s * 0.38, G.ramp(MCOL[k], 5));
    p.ellipse(s * 0.38, s * 0.52, 2, 3, '#ffffff'); p.ellipse(s * 0.62, s * 0.52, 2, 3, '#ffffff');
    p.set(s * 0.38, s * 0.53, '#101010'); p.set(s * 0.62, s * 0.53, '#101010');
    p.outline('#101018');
    return p.toCanvas();
  });
})(window.RPG);
