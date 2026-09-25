// Events of the second-half dungeons (DESIGN §7.3, §7.4): the boss fights of the Ice Cave,
// Fire Volcano, Star Tower and Demon Castle, the crest altars, the exit circles that open after
// each boss, the demon castle's sealed shortcuts, and the final battle.
// Maps: src/maps/dungeons_b.js.
//
// Flags set here:  boss_ice_done  boss_volcano_done got_crest_fire  boss_star_done got_crest_star
//                  demon_voice_heard  boss_general1_done  boss_general2_done
//                  boss_king1_done  boss_king2_done  game_clear
// Items given:     gold_key  crest_fire  crest_star
(function (R) {
  'use strict';
  const E = R.DB.events;
  const CRESTS = ['crest_wind', 'crest_water', 'crest_earth', 'crest_fire', 'crest_star'];
  const KAZU = ['ゼロ', '一つ', '二つ', '三つ', '四つ', '五つ'];

  // ------------------------------------------------------------ helpers
  /** turn the leader toward an NPC (bosses are drawn big; they may be talked to from the side) */
  function faceNpc(ev, id) {
    const f = R.Field;
    const n = f && f.npc ? f.npc(id) : null;
    if (!n || !f.pos) return;
    const p = f.pos();
    const dx = n.x - p.x, dy = n.y - p.y;
    if (!dx && !dy) return;
    ev.player.face(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }
  /** point the menu's objective at the current story stage */
  function nextObjective(ev, fallback) {
    let id = R.Story && R.Story.objective ? R.Story.objective() : fallback;
    if (!R.DB.objectives || !R.DB.objectives[id]) id = fallback;
    if (id && R.DB.objectives && R.DB.objectives[id]) ev.setObjective(id);
  }
  /** a boss (and its escorts) leaves the map: flag, redraw, short pause */
  async function vanish(ev, flag, fx) {
    ev.closeMessage();
    if (fx === 'flash') await ev.flash('#ffffff', 12);
    else if (fx === 'fade') await ev.fadeOut(24);
    ev.setFlag(flag);
    ev.refresh();
    if (fx === 'fade') await ev.fadeIn(24);
    else await ev.wait(16);
  }
  /** the crest altar: take the crest (an NPC floating over a pedestal) */
  async function takeCrest(ev, o) {
    if (ev.flag(o.got) || !ev.flag(o.boss)) return false;
    await ev.say(o.look);
    ev.sfx('holy');
    await ev.flash('#fff8d0', 10);
    ev.setFlag(o.got);
    ev.refresh();
    await ev.give(o.item);
    await ev.say(o.after);
    ev.heal();
    ev.sfx('heal');
    await ev.say('紋章の力で、3人の傷が\nすっかり癒えた。');
    const n = CRESTS.filter((id) => ev.has(id)).length;
    await ev.say(n >= CRESTS.length
      ? 'ついに五つの紋章が\nすべてそろった！\f海の真ん中にある光の神殿へ\n持っていこう。'
      : 'これで紋章は' + KAZU[n] + '。\n残る紋章はあと' + KAZU[CRESTS.length - n] + 'だ。');
    nextObjective(ev, o.fallback);
    await ev.say('……ふと見ると、床の魔法陣が\n淡く光っている。\nあれに乗れば外へ出られそうだ。');
    return true;
  }

  // ------------------------------------------------------------ exit circle (after each boss)
  E.db_exit_circle = {
    meta: { needs: [], gives: [] },
    async run(ev) {
      const def = R.DB.maps[ev.map];
      const esc = def && def.escape;
      if (!esc) return false;
      ev.sfx('warp');
      if (!(await ev.yesno('魔法陣が静かに光っている。\n外へ出ますか？'))) return false;
      ev.sfx('teleport');
      await ev.warp(esc.to, esc.spawn, { dir: 'down' });
      return true;
    },
  };

  // ============================================================ Ice Cave
  E.ice_boss = {
    meta: { needs: [], gives: ['flag:boss_ice_done', 'item:gold_key'] },
    async run(ev) {
      if (ev.flag('boss_ice_done')) return;
      faceNpc(ev, 'ice_giant');
      await ev.shake(30, 2);
      await ev.say('ゴゴゴゴ……\n氷の壁が震えている……！');
      ev.sfx('roar');
      await ev.say('氷河の巨人「……誰だ。\n長き眠りを覚ますのは。」');
      await ev.say('「……光の匂いがする。\n貴様らが、魔王様の言う\n紋章の子らか。\f金の鍵は渡さぬ。\n氷の棺で、永遠に眠るがよい！」');
      if ((await ev.battle('boss_ice')) !== 'win') return false;
      faceNpc(ev, 'ice_giant');
      await ev.say('氷河の巨人「グ……ヌウ……。\n体が……溶けてゆく……。」');
      ev.sfx('ice');
      await ev.shake(24, 3);
      await vanish(ev, 'boss_ice_done', 'flash');
      await ev.say('巨人の体は砕け散り、\n氷の粒となって消えた……。');
      await ev.say('あとには、金色に輝く\n鍵が落ちている。');
      await ev.give('gold_key');
      await ev.say('これで、世界のどこかにある\n金の扉を開けられるはずだ。');
      nextObjective(ev, 'obj_fire');
      await ev.say('奥の魔法陣が\n淡く光り始めた……。');
    },
  };

  // ============================================================ Fire Volcano
  E.volcano_boss = {
    meta: { needs: [], gives: ['flag:boss_volcano_done'] },
    async run(ev) {
      if (ev.flag('boss_volcano_done')) return;
      faceNpc(ev, 'volcano_lord');
      ev.sfx('fire');
      await ev.flash('#ff6010', 10);
      await ev.say('溶岩がごうっと噴き上がった！');
      await ev.say('炎魔神「フハハハハ！\nよくぞここまで来たな、\n光の子らよ！」');
      await ev.say('「ここは魔王様に捧げられた\n炎の聖域。\f炎の紋章が欲しいか？\nならば、この炎で\n骨まで焼き尽くしてくれるわ！」');
      if ((await ev.battle('boss_volcano')) !== 'win') return false;
      faceNpc(ev, 'volcano_lord');
      await ev.say('炎魔神「ば、馬鹿な……！\nこのわしの炎が……\n消えるだと……！」');
      ev.sfx('fire');
      await ev.shake(30, 3);
      await vanish(ev, 'boss_volcano_done', 'flash');
      await ev.say('炎魔神は炎とともに\n溶岩の中へ消えていった……。');
      await ev.say('奥の台座で、何かが\n赤く輝いている……。');
    },
  };
  E.volcano_crest = {
    meta: { needs: ['flag:boss_volcano_done'], gives: ['item:crest_fire', 'flag:got_crest_fire'] },
    run: (ev) => takeCrest(ev, {
      boss: 'boss_volcano_done', got: 'got_crest_fire', item: 'crest_fire', fallback: 'obj_star',
      look: '台座の上で、赤い紋章が\n炎のように揺らめいている……。',
      after: '炎の紋章を手にすると、\n体の奥から熱い力が\n湧き上がってきた……。',
    }),
  };

  // ============================================================ Star Tower
  E.star_boss = {
    meta: { needs: [], gives: ['flag:boss_star_done'] },
    async run(ev) {
      if (ev.flag('boss_star_done')) return;
      faceNpc(ev, 'star_guardian');
      ev.sfx('holy');
      await ev.flash('#e8f0ff', 10);
      await ev.say('夜空の星が一斉に\nまたたいた……！');
      await ev.say('星の守護神「……待っていた。\n光の紋章に\n選ばれし者たちよ。」');
      await ev.say('{metem}「星見の塔の守護神……！\n学院の本で読んだとおりだわ。」');
      await ev.say('星の守護神「星の紋章は、\n真の勇者にのみ託される。\fそなたらの力と心、\nこの我が試させてもらう！」');
      if ((await ev.battle('boss_star')) !== 'win') return false;
      faceNpc(ev, 'star_guardian');
      await ev.say('星の守護神「……見事だ。\nそなたらこそ、光を継ぐ者。」');
      await ev.say('「星の紋章を持ってゆけ。\nそして魔王の闇から、\nこの世界を救うのだ……。」');
      ev.sfx('holy');
      await vanish(ev, 'boss_star_done', 'flash');
      await ev.say('守護神の姿は星くずとなり、\n夜空へ昇っていった……。');
    },
  };
  E.star_crest = {
    meta: { needs: ['flag:boss_star_done'], gives: ['item:crest_star', 'flag:got_crest_star'] },
    run: (ev) => takeCrest(ev, {
      boss: 'boss_star_done', got: 'got_crest_star', item: 'crest_star', fallback: 'obj_temple',
      look: '台座の上で、銀色の紋章が\n星空のようにきらめいている……。',
      after: '星の紋章からあふれた光が、\n3人の行く道を\n照らし出すように輝いた……。',
    }),
  };
  /** the star-reading circle: a talking inscription that hints at the right pad */
  E.star_hint = {
    meta: { needs: [], gives: [] },
    async run(ev) {
      await ev.say('床に星空の図が\n刻まれている……。');
      await ev.say('「迷える旅人よ、\n動かぬ星を目指せ。\f北の空にひとつ、\n決して動かぬ星あり」');
    },
  };

  // ============================================================ Demon Castle
  E.demon_castle_voice = {
    meta: { needs: [], gives: ['flag:demon_voice_heard'] },
    async run(ev) {
      if (ev.flag('demon_voice_heard')) return;
      ev.setFlag('demon_voice_heard');
      await ev.wait(30);
      ev.sfx('dark');
      await ev.flash('#300018', 16);
      await ev.say('どこからともなく、\n低い声が響いてきた……。');
      await ev.say('「……来たか、光の子らよ。\f百年の眠りのあいだ、\nこの時を待ちわびていたぞ。\f我が城にて、滅びるがよい……。」');
      await ev.say('{non}「今の声……！」\n{yuki}「魔王だ。行こう、みんな！」');
    },
  };
  /** the sealed circles near the entrance: examined while still sealed */
  E.demon_seal = {
    meta: { needs: [], gives: [] },
    async run(ev) {
      await ev.say('魔法陣が禍々しい封印で\n閉ざされている……。');
      await ev.say('この城のどこかに、\n封印の主がいるのだろう。');
    },
  };
  /** open shortcut circles (sealed until the general that holds them falls) */
  const SHORTCUT = {
    demon_gate_west: ['demon_castle_3', 'gate_w'],
    demon_gate_east: ['demon_castle_4', 'gate_e'],
    demon_gate_back3: ['demon_castle_1', 'gate_w'],
    demon_gate_back4: ['demon_castle_1', 'gate_e'],
  };
  for (const id in SHORTCUT) {
    const [map, spawn] = SHORTCUT[id];
    E[id] = {
      meta: { needs: [], gives: [] },
      async run(ev) {
        ev.sfx('teleport');
        await ev.flash('#c8a0ff', 8);
        await ev.warp(map, spawn);
      },
    };
  }

  E.demon_general1 = {
    meta: { needs: [], gives: ['flag:boss_general1_done'] },
    async run(ev) {
      if (ev.flag('boss_general1_done')) return;
      faceNpc(ev, 'dark_general');
      ev.sfx('dark');
      await ev.say('黒い鎧の騎士が、\nゆっくりと剣を抜いた……。');
      await ev.say('暗黒将軍「待っていたぞ、\n光の紋章の子らよ。\f我こそは魔王軍最強の剣、\n暗黒将軍！\f魔王様のもとへは、\n一歩たりとも行かせぬ！」');
      await ev.say('{yuki}「そこをどいてもらう！」');
      if ((await ev.battle('boss_general1')) !== 'win') return false;
      faceNpc(ev, 'dark_general');
      await ev.say('暗黒将軍「み、見事……。\nだが、魔王様の力は\nこんなものではない……。」');
      ev.sfx('dark');
      await vanish(ev, 'boss_general1_done', 'fade');
      await ev.say('暗黒将軍は黒い煙となって\n消えた……。');
      ev.sfx('warp');
      await ev.say('どこかで、封印の解ける\n音がした……。');
    },
  };

  E.demon_general2 = {
    meta: { needs: [], gives: ['flag:boss_general2_done'] },
    async run(ev) {
      if (ev.flag('boss_general2_done')) return;
      faceNpc(ev, 'lich_general');
      ev.sfx('dark');
      await ev.flash('#40c060', 8);
      await ev.say('闇の大魔導士「クックック……\n暗黒将軍を破るとはな。」');
      await ev.say('「だが、わしの闇の魔法の前では\n光など無力！\f貴様らの魂、\n魔王様への捧げ物と\nしてくれようぞ！」');
      await ev.say('{metem}「魔法でわたしに\n勝てると思わないでよね！」');
      if ((await ev.battle('boss_general2')) !== 'win') return false;
      faceNpc(ev, 'lich_general');
      await ev.say('闇の大魔導士「ば、馬鹿な……\n死を超えたこのわしが……！\f魔王様……お許しを……。」');
      ev.sfx('dark');
      await vanish(ev, 'boss_general2_done', 'flash');
      await ev.say('大魔導士の姿は\n塵となって崩れ落ちた……。');
      ev.sfx('warp');
      await ev.say('どこかで、また封印の解ける\n音がした……。\fそして上の階から、\n恐ろしい気配が漂ってくる……。');
    },
  };

  // ------------------------------------------------------------ the demon king
  async function kingTrueForm(ev) {
    ev.sfx('roar');
    await ev.shake(50, 4);
    await ev.say('魔神ヴァルザード「ほう……\nまだ光にすがるか。\fよかろう！　何度来ようと、\n闇に還してくれるわ！」');
    const res = await ev.battle('boss_king2');
    return res === 'win';
  }
  async function finale(ev) {
    faceNpc(ev, 'demon_king2');
    await ev.say('魔神ヴァルザード「グオオオ……！\nば、馬鹿な……！\fこのわしが……\n光に……敗れるなど……！」');
    await ev.say('「……だが、覚えておけ……\n人の心に闇がある限り、\nわしはいつか、また……\nよみがえる……ぞ……。」');
    ev.closeMessage();
    ev.sfx('boss_die');
    await ev.flash('#ffffff', 20);
    ev.setFlag('boss_king2_done');
    ev.refresh();
    await ev.wait(40);
    await ev.say('魔王ヴァルザードは\n光の中へ消えていった……。');
    await ev.wait(20);
    ev.closeMessage();
    ev.sfx('shake');
    await ev.shake(90, 3);
    await ev.say('ゴゴゴゴゴ……！\n魔王城が大きく揺れ始めた！');
    ev.sfx('earth');
    await ev.shake(70, 5);
    await ev.say('{non}「城が崩れます！」\n{metem}「早く逃げないと……！」');
    ev.closeMessage();
    ev.sfx('holy');
    await ev.flash('#fff8d0', 30);
    await ev.say('そのとき、光の紋章が\nまばゆく輝き、\n3人を優しく包み込んだ……。');
    ev.setFlag('game_clear');
    nextObjective(ev, 'obj_clear');
    await ev.flash('#ffffff', 40);
    if (R.Ending && R.Ending.start) {
      await ev.ending();
      return;
    }
    // no ending system: bring the party out safely
    await ev.warp('world', 'demon_castle_1');
    await ev.say('世界に平和が戻った。\nおめでとう！');
  }

  E.demon_king = {
    meta: { needs: [], gives: ['flag:boss_king1_done', 'flag:boss_king2_done', 'flag:game_clear'] },
    async run(ev) {
      if (ev.flag('boss_king2_done')) return;
      if (ev.flag('boss_king1_done')) {
        // the true form waits on the throne after a lost fight
        faceNpc(ev, 'demon_king2');
        if (!(await kingTrueForm(ev))) return false;
        await finale(ev);
        return;
      }
      faceNpc(ev, 'demon_king');
      if (R.Audio && R.Audio.stopBGM) { try { R.Audio.stopBGM(60); } catch (e) { /* ignore */ } }
      await ev.wait(40);
      await ev.say('玉座の魔王が、\nゆっくりと立ち上がった……。');
      await ev.say('魔王「……よくぞ参った、\n光の紋章に\n選ばれし者たちよ。」');
      await ev.say('「百年前、わしを封じた\nあの憎き光……\n貴様らの中にも見えるぞ。\fだが、光はいつか必ず\n闇にのまれる。\nそれがこの世界の定め。」');
      await ev.say('「さあ、来るがよい！\n百年の恨み、\nその身で思い知れ！」');
      await ev.say('{yuki}「……行くぞ、みんな！」\n{non}「はい！」\n{metem}「当然！」');
      if ((await ev.battle('boss_king1')) !== 'win') return false;
      faceNpc(ev, 'demon_king');
      await ev.say('魔王「ぐ……ぐおお……。\nまさか、これほどとは……。」');
      await ev.say('「……だが、これで終わりと思うな！\n見るがよい……\nこれが我が真の姿！」');
      ev.closeMessage();
      ev.sfx('roar');
      await ev.flash('#600020', 16);
      await ev.shake(60, 5);
      ev.setFlag('boss_king1_done');
      ev.refresh();
      await ev.flash('#600020', 16);
      await ev.wait(30);
      faceNpc(ev, 'demon_king2');
      await ev.say('魔神ヴァルザード「グオオオオ！\nこの姿を見て、\n生きて帰った者はおらぬ！」');
      ev.sfx('holy');
      await ev.flash('#fff8d0', 16);
      ev.heal();
      await ev.say('そのとき、光の紋章が\nまばゆく輝いた！\f3人の傷が\nみるみる癒えていく……！');
      await ev.say('魔神「おのれ、忌々しい光め！\nまとめて闇に還してくれる！」');
      if ((await ev.battle('boss_king2')) !== 'win') return false;
      await finale(ev);
    },
  };
})(window.RPG);
