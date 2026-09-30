// CONTENT（マレア諸島）: 潮鳴りの洞窟・幽霊船・灯り直す場面（WORLD_REDESIGN §4.5 の流れ 1・6〜8・§6.4、STORY_BIBLE §7.5・§11.8）。
//   潮鳴りの洞窟 1 階: 潮の石（叩くたびに満ち引きが替わる。引き潮 = 南の渡り場 A が歩ける・北の渡り場 B が水の下／満ち潮 = その逆。
//     2 通りの tilePatches。下絵は両方が乾いた形で、水の下の方は閉じた絵）。2 階: 深みの大ダコ（中ボス）→ 奥の岩棚の光る貝がら。
//   幽霊船 3 階: 甲板（自分の船から渡り板）→ 船室（船員の名札 6 枚、任意・水樽の休息の灯）→ 船倉（暗がり。ランタンに火）と船長室。
//   船長室: グレン（v_glen_ship_01・02）→ 亡霊船長グレン tr_b_captain → 舟歌を語る → v_glen_ship_03・04 → 途中から白い航海日誌 →
//   地平が白むころのネレイの桟橋: v_marina_dawn_01・v_glen_dawn_01・v_marina_dawn_02 → 灯が青から橙に戻り、沖の灯台島へ渡ってともる
//   → clearRegion('r_isles') → マリナが墨の写しを託す（写し手 アルノ）→ lo_ev_isles → 年代記に書く選択 ch_isles_write
//   （船長とマリナの話 story ／（痛）沈んだ船員たちの名も pain。名札 1 枚以上のときだけ）→ 日継ぎの主張。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Isles.ev;
  const cleared = (ev) => ev.flag('cleared_r_isles');
  const objAt = (ctx, event) => { const m = ctx && R.DB.maps[ctx.map]; return m && (m.objects || []).find((o) => o.type === 'examine' && o.event === event && o.x === ctx.x && o.y === ctx.y); };
  const GLEN = { name: 'グレン船長' }, MARINA = { name: 'マリナ' };

  // ================================================================ 潮鳴りの洞窟
  E('isles_cave_arrive', async (ev) => {
    if (ev.flag('isles_cave_seen')) return;
    ev.setFlag('isles_cave_seen');
    await ev.caption('潮鳴りの洞窟。波の音が、\n岩の奥で低くうなっている。', { ms: 2400 });
    await ev.caption('奥へ続く道を、潮の水路が横切っている。', { ms: 2200 });
  }, { meta: { needs: [], gives: ['flag:isles_cave_seen'] } });
  E('isles_tide_stone', async (ev) => {
    const high = ev.flag('isles_tide_high');
    await ev.say(null, '波と月の模様が彫られた、腰の高さの石。\nフジツボが一面についている。');
    const i = await ev.choose(['石を叩く', 'やめる'], { text: high ? '今は満ち潮だ。' : '今は引き潮だ。' });
    if (i !== 0) return;
    ev.setFlag('isles_tide_high', !high);
    ev.sfx('water');
    try { R.Field.shake(3, 700); } catch (e) { /* */ }
    await ev.caption(high ? '潮が引いていく。南の渡り場が顔を出し、\n北の水路は水の下になった。' : '潮が満ちてくる。北の渡り場が顔を出し、\n南の水路は水の下になった。', { ms: 2600 });
  }, { meta: { needs: [], gives: ['flag:isles_tide_high'] } });
  E('isles_cave_carving', async (ev) => {
    await ev.say(null, '岩に、古い字が彫ってある。\n「潮の石を叩けば、潮は替わる。\n帰り道の潮を、忘れるな」');
  });
  E('isles_cave2_arrive', async (ev) => {
    if (ev.flag('isles_cave2_seen')) return;
    ev.setFlag('isles_cave2_seen');
    await ev.caption('大きな洞。まん中の深い水が、\n夜光虫で青く光っている。', { ms: 2400 });
  });
  // 深みの大ダコ（中ボス。北の洞の入口）
  E('isles_octopus', async (ev) => {
    if (ev.flag('isles_octopus')) return;
    ev.bgm('omen');
    await ev.say(null, '奥の岩棚へ続く洞の入口で、\n水面が大きく盛り上がった。');
    ev.sfx('roar');
    try { R.Field.shake(5, 900); } catch (e) { /* */ }
    await ev.say(null, '深みの大ダコだ……！');
    const r = await ev.battle('tr_b_octopus', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('isles_octopus');
    ev.sfx('water');
    await ev.say(null, '大ダコは、深みへ沈んでいった。\n奥の岩棚で、何かが白く光った。');
  }, { meta: { needs: [], gives: ['flag:isles_octopus'] } });
  E('isles_glow_shell', async (ev) => {
    if (ev.flag('isles_shell')) { await ev.say(null, '貝がらのあった岩棚。\n夜光虫が、まだかすかに光っている。'); return; }
    if (!ev.flag('isles_octopus')) return;
    await ev.say(null, '岩棚の上で、白い貝がらが\n青く光っている。');
    ev.item('k_glow_shell', 1);
    ev.setFlag('isles_shell');
    ev.leadDone('l_isles_shell');
    await ev.say(null, '手に取ると、ほんのり温かい。\n夜光虫の光をためこんでいるようだ。\nドレイクに届けよう。');
  }, { meta: { needs: ['flag:isles_octopus'], gives: ['item:k_glow_shell', 'flag:isles_shell'] } });

  // ================================================================ 幽霊船
  E('isles_ghost_arrive', async (ev) => {
    if (cleared(ev)) {
      if (ev.flag('isles_ghost_after')) return;
      ev.setFlag('isles_ghost_after');
      await ev.caption('船は静まり返っている。\n青白い灯は、もうどこにもない。', { ms: 2400 });
      return;
    }
    if (ev.flag('isles_ghost_seen')) return;
    ev.setFlag('isles_ghost_seen');
    await ev.caption('渡り板を越えると、ぎしり、と甲板がきしんだ。\n破れた帆が、風もないのに揺れている。', { ms: 2800 });
    await ev.caption('船のどこかから、途切れ途切れの\n舟歌が聞こえてくる。', { ms: 2400 });
  }, { meta: { needs: [], gives: ['flag:isles_ghost_seen'] } });
  E('isles_ghost_mast', async (ev) => {
    await ev.say(null, '折れた帆柱。腐った綱が巻きつき、\n灰色の帆がからまっている。');
  });
  E('isles_ghost_skylight', async (ev) => {
    await ev.say(null, '割れた天窓。下の船長室は暗い。\n……誰かが、机の前に座っている。');
  });
  // 船員の名札（6 枚、任意）
  E('isles_nametag', async (ev, ctx) => {
    const o = objAt(ctx, 'isles_nametag');
    const n = (o && o.tag) || 1;
    const f = 'isles_tag_' + n;
    const name = X().CREW[n];
    if (ev.flag(f)) { await ev.say(null, '名札のあった寝台。「' + name + '」'); return; }
    ev.setFlag(f);
    const k = X().tags(ev);
    ev.setVar('isles_tags', k);
    ev.sfx('item');
    await ev.say(null, '寝台の柱に、真鍮の名札が\n打ちつけてある。\n「' + name + '」（' + k + '/6）');
    if (k === 1) await ev.say(null, '六十年、誰にも呼ばれなかった名だ。\n{hero}は、名札を外して持った。');
  }, { meta: { needs: [], gives: ['flag:isles_tag_1', 'flag:isles_tag_2', 'flag:isles_tag_3', 'flag:isles_tag_4', 'flag:isles_tag_5', 'flag:isles_tag_6', 'var:isles_tags+6'] } });
  E('isles_ghost_doll', async (ev) => {
    await ev.say(null, '見習いの寝台に、布の人形が\n置いてある。「ベッポへ　母より」と\n縫いとりがある。');
  });
  E('isles_hold_arrive', async (ev) => {
    if (ev.flag('isles_hold_seen')) return;
    ev.setFlag('isles_hold_seen');
    await ev.caption('船倉は暗い。壁のランタンに火をともせば、\nまわりが見えるはずだ。', { ms: 2600 });
  });
  E('isles_cabin_door', async (ev) => {
    await ev.say(null, '船長室の扉の向こうから、\nかすかに舟歌が聞こえる……。');
  });

  // ---------------------------------------------------------------- 船長室: グレン → 亡霊船長 → 舟歌 → 白い日誌 → 夜明け
  E('isles_captain', async (ev) => {
    if (ev.flag('isles_captain') || cleared(ev)) return;
    const x = X();
    ev.bgm('omen');
    await ev.say(null, '海図の机の前に、青白い影が座っている。\n船長の帽子をかぶった、骨の男だ。');
    await ev.say('glen', '♪　霧の海でも……迷い……\n……続きが、出てこない……。', Object.assign({ voice: 'v_glen_ship_01' }, GLEN));
    await ev.say('glen', 'おれは……どこへ帰るんだった？\n誰が、待っていた……？\n思い出せない……思い出せない！', Object.assign({ voice: 'v_glen_ship_02' }, GLEN));
    ev.sfx('roar');
    try { R.Field.shake(5, 900); } catch (e) { /* */ }
    const r = await ev.battle('tr_b_captain', { boss: true });
    if (r !== 'win') { ev.mapBgm(); return; }
    ev.setFlag('isles_captain');
    ev.leadDone('l_isles_fog');
    ev.sfx('magic');
    try { R.Field.flash && R.Field.flash('#d8ecff', 500); } catch (e) { /* */ }
    await ev.say(null, '{hero}は、マリナの舟歌を\n船長に語り聞かせた。');
    ev.bgm('sorrow');
    await ev.caption(x.SHANTY_A, { ms: 3000 });
    await ev.caption(x.SHANTY_B, { ms: 3000 });
    ev.sfx('quill');
    await ev.say('glen', '……マリナ。そうだ、\nおれは帰ると約束したんだ。', Object.assign({ voice: 'v_glen_ship_03' }, GLEN));
    await ev.say('glen', '岬の灯は、あいつだったのか。\n六十年も、待たせちまったな。\n……帰ろう。', Object.assign({ voice: 'v_glen_ship_04' }, GLEN));
    await ev.call('isles_captain_log');
    await ev.call('isles_dawn');
  }, { meta: { needs: ['flag:isles_fog_open'], gives: ['flag:isles_captain'], calls: ['isles_captain_log', 'isles_dawn'] } });
  // 途中から白い航海日誌（比べ読みの片方）
  E('isles_captain_log', async (ev) => {
    if (!ev.flag('isles_log_white')) {
      ev.setFlag('isles_log_white');
      await ev.say(null, '机の上に、船長の航海日誌が開いている。\n舟歌が書きこまれた、本物の日誌だ。');
      await ev.say(null, '……けれど、ページは途中から白い。\n字が消えたのではない。はじめから\n何も書かれなかったように、白い。');
      await ev.say(null, '表紙の裏に、小さな印がある。\n「写　記録院マレア分室」');
      return;
    }
    await ev.say(null, ev.flag('lo_ev_isles') ? '途中から白い航海日誌。\n墨の写しには、この白い所の字が\nすべて残っていた。' : '途中から白い航海日誌。');
  }, { meta: { needs: ['flag:isles_captain'], gives: ['flag:isles_log_white'] } });

  // ---------------------------------------------------------------- 灯り直す場面（地平が白むころのネレイの桟橋）
  E('isles_dawn', async (ev) => {
    if (ev.flag('isles_dawn_done')) return;
    const x = X();
    await ev.fade('out', 900);
    ev.setFlag('isles_dawn_scene');
    await ev.warp('nerei', 'pier_end');
    ev.bgm('dawn');
    await ev.caption('地平が、白みはじめていた。', { ms: 2600 });
    await ev.say(null, 'ネレイの桟橋に、船長の影が\n静かに降り立った。');
    await ev.say('marina_dawn', 'おかえりなさい、グレン。', Object.assign({ voice: 'v_marina_dawn_01' }, MARINA));
    await ev.say('glen_dawn', 'ただいま、マリナ。', Object.assign({ voice: 'v_glen_dawn_01' }, GLEN));
    ev.sfx('light');
    try { R.Field.flash && R.Field.flash('#ffd8a0', 700); } catch (e) { /* */ }
    await ev.caption('沖の船の灯が、青い鬼火から\n暖かな橙に戻っていく。', { ms: 3000 });
    try { await ev.leave('glen_dawn', { ms: 1200 }); } catch (e) { /* */ }
    await ev.caption('橙の灯は、白む海を渡って\n沖の灯台島の灯室にともった。', { ms: 3000 });
    await ev.say('marina_dawn', '……ありがとう。\nあの人は、やっと帰ってきた。', Object.assign({ voice: 'v_marina_dawn_02' }, MARINA));
    ev.setFlag('isles_dawn_done');
    // 大灯火（グレンの船の灯 → 灯台島）: ページ・ティア・光の柱・章の札（EVENTS の共通の筋）
    await ev.clearRegion('r_isles');
    await ev.call('isles_finale');
  }, { meta: { needs: ['flag:isles_captain'], gives: ['flag:isles_dawn_done', 'region:r_isles'], calls: ['isles_finale'], warp: { to: 'nerei', spawn: 'pier_end' } } });
  E('isles_finale', async (ev) => {
    if (ev.flag('isles_finale_done')) return;
    const x = X();
    // 墨の写し（比べ読み → lo_ev_isles）
    await ev.say('marina_dawn', 'これを、あんたに預けたい。\nあの人が最後の船出の前に、\n記録院の分室へ預けた日誌の控えさ。', MARINA);
    ev.item('k_ink_copy', 1);
    ev.setFlag('isles_ink_given');
    await ev.say(null, '表紙の裏に、墨の字。\n「写　記録院マレア分室\n写し手 アルノ（ロアの語り部）」');
    await ev.say(null, '白い日誌と並べて読むと、\n白い所の字が、墨の写しには\n最後の一行まで残っていた。');
    await x.lore(ev, 'lo_ev_isles');
    await ev.say('marina_dawn', 'あの人の話、あんたの本にも\n書いておくれ。', MARINA);
    // 年代記に書く選択（（痛）は名札が 1 枚以上のときだけ）
    const tags = x.tags(ev);
    const labels = ['船長とマリナの話として書く'].concat(tags > 0 ? ['沈んだ船員たちの名も書く'] : []);
    const i = await ev.choose(labels, { text: '年代記に、どう書き記す？' });
    if (i === 1 && tags > 0) {
      ev.choice('ch_isles_write', 'pain');
      ev.addVar('pain_count', 1);
      await ev.say(null, '{hero}は、拾った名札の名を\nひとりずつ、声に出して読み上げた。');
      const names = [1, 2, 3, 4, 5, 6].filter((n) => ev.flag('isles_tag_' + n)).map((n) => x.CREW[n]);
      await ev.caption(names.join('\n'), { ms: 1200 + 700 * names.length });
      await ev.say(null, '沖の霧の中に、うっすらと人影が並んだ。\n名を呼ばれるたびに、ひとり、\nまたひとりと、朝の光に溶けていった。');
      ev.setFlag('isles_wall_names');
      await ev.say('marina_dawn', 'コーラルの後家の壁に、\nこの人たちの名も刻んでもらおう。\n……六十年、待たせたからね。', MARINA);
    } else {
      ev.choice('ch_isles_write', 'story');
      await ev.say(null, '{hero}は、帰らずの船長と\n待っていた人の話を書き記した。');
    }
    ev.sfx('quill');
    // 日継ぎの主張（灯り直す場面の最後に、町の誰かが）
    await ev.say('dawn_fisher', 'やっぱり、太陽は東の海から来る船だ。\n灯台が、それを導いたのさ。');
    ev.setFlag('isles_dawn_scene', false);
    ev.setFlag('isles_finale_done');
    ev.leadDone('l_isles_harbor');
    ev.mapBgm();
  }, { meta: { needs: ['flag:isles_dawn_done'], gives: ['flag:isles_finale_done', 'item:k_ink_copy', 'lore:lo_ev_isles', 'choice:ch_isles_write', 'flag:isles_wall_names'] } });
})(window.RPG);
