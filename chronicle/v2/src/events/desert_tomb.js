// CONTENT（砂漠）: 砂の王墓と灯り直す場面（WORLD_REDESIGN §4.2 の流れ 3〜5、STORY_BIBLE §7.2 の主な場面 3・4）。
//   墓守の像の名の文字（ハ・ザ・ル → 三つで「王の名の記し」i_desert_kingname。戦いの中で使うと名を呼べる）
//   1 階: 封じの扉（二つの踏み板。旗は FIELD の switch が立てる）・金剛トカゲの隠し部屋
//   2 階: 砂もぐり tr_b_sandworm（倒すと流砂が止まる = tilePatches の desert_worm）
//   3 階: 名なき砂の王 tr_b_sandking（倒す／名を呼ぶ）→ ハザルの 4 つの言葉（文字だけ。ボイスは後で）→ desert_finale
//   desert_finale: 古い泉の底に日輪の火（ev.clearRegion）→ カシムの泉が湧く → ナディアの歌 → 年代記の選択 ch_desert_write →
//                  アブルの砂王の印章 ac_tale_desert・隊商ギルドの割引（shops_desert の priceMul）・隊商路の荷車（砂の縁 ⇔ カシム）
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Desert.ev;
  const HAZAL = { name: '名なき砂の王', face: false };
  const HAZAL2 = { name: 'ハザル', face: false };
  const objAt = (ctx, event) => { const m = R.DB.maps[ctx && ctx.map]; return m && (m.objects || []).find((o) => o.type === 'examine' && o.event === event && o.x === ctx.x && o.y === ctx.y); };
  const GLYPH = { ha: ['k_desert_glyph_ha', 'ハ'], za: ['k_desert_glyph_za', 'ザ'], ru: ['k_desert_glyph_ru', 'ル'] };

  // ---------------------------------------------------------------- 入口・階
  E('desert_tomb_sealed', async (ev) => {
    await ev.say(null, ['墓の入口は、吹きだまった砂で\nふさがれている。', '手で掘るには、多すぎる。\n……隊商の道具があれば。']);
  });
  E('desert_tomb_arrive', async (ev) => {
    await ev.caption('ひんやりとした空気。\n壁の松明は、誰がともしたのか\nまだ燃えている。', { ms: 2400 });
  });
  E('desert_tomb2_arrive', async (ev) => {
    await ev.caption('足もとの砂が、ときどき\n流れるように動く。\n……どこかで、何かが砂を掘っている。', { ms: 2400 });
  });
  E('desert_tomb3_arrive', async (ev) => {
    await ev.caption('王の間の手前。\n空気が、ずしりと重い。\n誰かの名を、呼ぶ声がする……。', { ms: 2400 });
  });

  // 封じの扉（1 階）
  E('desert_tomb_door', async (ev) => {
    const w = ev.flag('desert_t1_sw_w'), e = ev.flag('desert_t1_sw_e');
    await ev.say(null, ['金の印の刻まれた、重い石の扉だ。\n両脇に、同じ金の印の溝がある。', w || e ? `片方の溝に、光がともっている。\n（あと ${w && e ? 0 : 1} つ）` : '西と東の小部屋の床に、\n同じ金の印の踏み板があった……。']);
  });
  // 踏み板（FIELD の switch が旗を立てる。同じマスの step のトリガーが知らせを出す＝閉包の meta もここ）
  const plate = (id, flag, pair, msgs) => E(id, async (ev) => {
    ev.setFlag(flag);
    const n = pair.filter((f) => ev.flag(f)).length;
    ev.sfx('unlock');
    await ev.caption(n >= pair.length ? msgs[1] : msgs[0].replace('#', n + '/' + pair.length), { ms: 1600 });
  }, { meta: { needs: [], gives: ['flag:' + flag] } });
  const T1 = ['desert_t1_sw_w', 'desert_t1_sw_e'];
  plate('desert_tomb_plate_w', T1[0], T1, ['踏み板が沈み、金の印に\n光がともった。（#）', '遠くで、重い石の扉が\n開く音がした。']);
  plate('desert_tomb_plate_e', T1[1], T1, ['踏み板が沈み、金の印に\n光がともった。（#）', '遠くで、重い石の扉が\n開く音がした。']);
  const TP = ['desert_tp_disc_1', 'desert_tp_disc_2', 'desert_tp_disc_3'];
  TP.forEach((f, i) => plate('desert_temple_plate_' + (i + 1), f, TP, ['日輪の盤が光った。（#）', '三つの盤に日がそろった。\n奥の扉が開く。']));

  // 墓守の像（名の文字）
  E('desert_tomb_glyph', async (ev, ctx) => {
    const o = objAt(ctx, 'desert_tomb_glyph');
    const gl = GLYPH[(o && o.glyph) || 'ha'];
    if (ev.has(gl[0])) { await ev.say(null, `墓守の像だ。台座の「${gl[1]}」の字の所が、\n小さく欠けている。`); return; }
    await ev.say(null, ['いかめしい墓守の像だ。\n台座に、古い字が刻まれている。', `……「${gl[1]}」。\n字の所だけ、石がゆるんでいる。`]);
    ev.sfx('item');
    ev.item(gl[0], 1);
    const n = X().glyphs(ev);
    if (n >= 3 && !ev.has('i_desert_kingname')) {
      await ev.say(null, ['三つの石片を並べると、\n一つの名になった。', '「ハ・ザ・ル」――\n……ハザル。']);
      ev.item('i_desert_kingname', 1);
      ev.sfx('quill');
      await ev.caption('王の名を、年代記の端に書き留めた。\n（戦いの中で「使う」と、名を呼べる）', { ms: 2600 });
      ev.leadDone('l_desert_glyphs');
    } else {
      await ev.say(null, `名の刻み石は、これで ${n} つ。`);
    }
  }, { meta: { needs: [], gives: ['item:k_desert_glyph_ha|k_desert_glyph_za|k_desert_glyph_ru', 'item:i_desert_kingname'] } });

  // 墓の番の影（1 階）
  E('desert_tomb_ghost', async (ev) => {
    if (ev.flag('desert_king')) { await ev.say('tomb_ghost', '……王が、名を取り戻された。\nわしも、ようやく眠れる。'); return; }
    await ev.say('tomb_ghost', ['……おまえも、王の名を探しに来たか。', '墓守の像は三つ。\n一つはこの階の西の奥。\n一つは下の階の西の果て。', '最後の一つは、王の間の東じゃ。\n……名を持たずに王に会えば、\n王は、おまえの名まで欲しがるぞ。']);
  });

  // 金剛トカゲの隠し部屋（ティアごとに 1 度。盗みの品のため）
  E('desert_tomb_lizard', async (ev) => {
    const key = 'desert_lizard_t' + X().tier();
    if (ev.flag(key)) { await ev.say(null, '岩のすきまに、トカゲの\nぬけ殻が落ちている。'); return; }
    await ev.say(null, ['岩のすきまで、虹色のうろこが\nきらりと光った。', '……金剛トカゲだ！']);
    ev.setFlag(key);
    await ev.battle('tr_desert_lizard_hole');
  }, { meta: { needs: [], gives: [] } });

  // ---------------------------------------------------------------- 2 階: 流砂と砂もぐり
  E('desert_tomb_quicksand', async (ev) => {
    if (ev.flag('desert_worm')) { await ev.say(null, '流砂は止まり、\nただの砂になっている。'); return; }
    await ev.say(null, ['砂が、渦を巻いて流れている。\n踏みこめば、のみこまれそうだ。', '砂の下の深い所で、\n何かが動くたびに、渦が強くなる……。']);
  });
  E('desert_tomb_robber', async (ev) => {
    await ev.say('worm_track', ['う……水を……。', '流砂は、砂もぐりのしわざだ……。\nあいつが砂の下を掘り続けるかぎり、\n流砂は止まらん。', 'やつが砂にもぐったら……\n打っても斬っても、きかねえ。\n土の力をぶつけて、引きずり出せ……。']);
    if (!ev.flag('desert_robber_help')) {
      ev.setFlag('desert_robber_help');
      await ev.say(null, '{hero}は、水を少し分けてやった。');
      await ev.say('worm_track', 'すまねえ……。\nこれ、持っていけ。土の石だ。');
      ev.item('i_stone_earth', 2);
    }
  }, { meta: { needs: [], gives: ['item:i_stone_earth'] } });
  E('desert_tomb_worm', async (ev) => {
    if (ev.flag('desert_worm')) return;
    ev.sfx('shake');
    await ev.say(null, ['足もとの砂が、盛り上がった！', '巨大な口が、砂の中から\n突き出してくる――！']);
    const r = await ev.battle('tr_b_sandworm', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('desert_worm');
    ev.sfx('unlock');
    await ev.caption('砂もぐりが崩れ落ちると、\n流砂の渦が、しずかに止まった。', { ms: 2400 });
  }, { meta: { needs: [], gives: ['flag:desert_worm'] } });

  // ---------------------------------------------------------------- 3 階: 拓本の跡・玉座
  E('desert_tomb_rubbing', async (ev) => {
    await ev.say(null, ['王の業績を刻んだ石板だ。\n……石の表に、紙の繊維がこびりつき、\n墨の跡がうっすら残っている。', '誰かが、石板を写したのだ。\n石の字は、写された所から\nすっかり消えている。', '砂の中に、札が一枚落ちていた。\n「記録院の写し・第八十二号」']);
    await X().lore(ev, 'lo_ev_desert');
    ev.lead('l_main_recorder_desert');
  }, { meta: { needs: [], gives: ['flag:lo_ev_desert', 'lead:l_main_recorder_desert'] } });
  E('desert_tomb_throne', async (ev) => {
    if (ev.flag('desert_king')) { await ev.say(null, '玉座の水晶に、やわらかな\n金色の光が宿っている。'); return; }
    await ev.say(null, '玉座の脇の水晶だ。\n光はなく、砂色ににごっている。');
  });

  // ---------------------------------------------------------------- 名なき砂の王
  E('desert_tomb_king', async (ev) => {
    if (ev.flag('desert_king')) return;
    ev.bgm('omen');
    await ev.say(null, '玉座の前に、包帯を巻いた\n大きな影が立っている。');
    await ev.say('npc_hazal', '……わが名を……\nわが名を、返せ……！', HAZAL);
    if (X().glyphs(ev) >= 3 && !ev.has('i_desert_kingname')) ev.item('i_desert_kingname', 1);
    if (ev.has('i_desert_kingname')) await ev.caption('（年代記の端に書いた王の名が、\nかすかに光っている。\n戦いの中で「使う」と、名を呼べる）', { ms: 2600 });
    ev.setFlag('desert_named', false);
    const r = await ev.battle('tr_b_sandking', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('desert_king');
    const named = ev.flag('desert_named');
    if (named) {
      await ev.say(null, ['名を呼ばれた王は、\n振り上げた腕を、ゆっくりと下ろした。', '包帯がほどけ、砂が\nさらさらと落ちていく……。']);
    } else {
      await ev.say(null, '砂の王は膝をつき、\n包帯の下から砂がこぼれ落ちた。');
    }
    await ev.say('npc_hazal', '……わが名を……だれか……。', HAZAL);
    ev.sfx('quill');
    if (X().glyphs(ev) >= 3 || named) await ev.say(null, '{hero}は、年代記を開いて\n王の名を書いた。\n「ハザル」と。');
    else await ev.say(null, ['{hero}は、拾った石片と、\n石板に残った墨の跡から、\n王の名を読み取った。', '年代記を開き、\n王の名を書いた。「ハザル」と。']);
    ev.sfx('light');
    await ev.say('npc_hazal', 'ハザル……そうだ、\nそれがわたしの名だ。', HAZAL2);
    await ev.say('npc_hazal', '民は、約束を覚えていて\nくれたのだな……。', HAZAL2);
    await ev.say('npc_hazal', ['水と引き換えに、わたしは名を\n砂の精霊に差し出した。', '名を呼ぶかぎり、日輪の火は消えぬ。\n……その約束も、石から写されて\n消えてしまったのだ。', '語り部よ。\nわたしの名を、もう一度\n泉の民に返してくれ。'], HAZAL2);
    if (named) {
      ev.lead('l_main_margin_named');
      await ev.caption('手がかり帳の余白に、\n一行が増えていた。', { ms: 2000 });
    }
    ev.leadDone('l_desert_tomb');
    await ev.call('desert_finale');
  }, {
    meta: {
      needs: ['flag:desert_worm'],
      gives: ['flag:desert_king', 'flag:desert_named', 'lead:l_main_margin_named', 'region:r_desert', 'flag:desert_finale_done', 'choice:ch_desert_write'],
      calls: ['desert_finale'],
    },
  });

  // ---------------------------------------------------------------- 灯り直す場面
  E('desert_finale', async (ev) => {
    if (ev.flag('desert_finale_done')) return;
    // 1. 古い泉の底に日輪の火（大灯火）
    await ev.fade('out', 600);
    await ev.warp('desert_camp3', 'spring');
    await ev.clearRegion('r_desert');
    ev.sfx('light');
    ev.bgm('dawn');
    await ev.caption('古い泉の底で、金色の火がともった。\n日輪の火――\n水が、底から湧きあがってくる。', { ms: 3200 });
    await ev.say('npc_zaid', ['泉が……泉が満ちていく！', '……この光、祖母の歌の\n「夜明けの星」の色だ。'], { name: 'ザイード' });
    ev.setFlag('desert_finale_done');
    // 2. カシムへ（帰り道は暗転で省く）
    await ev.fade('out', 600);
    await ev.warp('kasim', 'plaza');
    ev.bgm('kasim');
    await ev.caption('隊がカシムに帰りついた夜。\n枯れかけていた町の泉から、\n水がこんこんと湧きだした。', { ms: 3000 });
    await ev.say('fara_after', ['泉が……！　父さん、見て！\n底の古い字が、光ってる！'], { name: 'ファラ' });
    await ev.say('nadia', ['王さまの名前、わかったんでしょう？\n……教えて。', 'ハザル……。うん、ぴったり。\n歌ってみるね。'], { name: 'ナディア' });
    ev.sfx('bell');
    await ev.caption(X().SONG_FULL, { ms: 5200 });
    await ev.say(null, ['広場じゅうが、ナディアといっしょに\n王の名を歌った。', '夕べの祈りに、\nひとつの名が戻った。']);
    // 日継ぎの主張（STORY_BIBLE §7.2）
    await ev.say('sundial_old', ['日輪の火は、太陽のかけらじゃ。\nハザル王が、空から取ってきた。', '……わしの祖父は、そう言うとった。\n日輪同盟は、その火を守るために\n戦ったんじゃ。'], { name: '日時計のじいさま' });
    // 3. 年代記に書く選択
    await ev.say(null, '{hero}は、年代記を開いた。\nこの砂漠のことを、どう書こう。');
    const i = await ev.choose(['砂の鷹を「砂の盗賊」と書く', '砂の鷹を「日継ぎの戦の生き残り」と書く'], { text: '年代記に何を書く？' });
    if (i === 1) {
      ev.choice('ch_desert_write', 'pain');
      ev.addVar('pain_count', 1);
      await ev.say(null, '「砂の鷹は、かつて王の火のために\n戦った兵たちだった。誰も、\n何のための戦かを覚えていない……」');
    } else {
      ev.choice('ch_desert_write', 'legend');
      await ev.say(null, '「砂の鷹と呼ばれる盗賊が隊を襲い、\n王はその名を取り戻した……」');
    }
    ev.sfx('quill');
    ev.leadDone('l_desert_spring');
    ev.leadDone('l_desert_song');
    await ev.call('desert_after');
  }, {
    meta: {
      needs: ['flag:desert_king'],
      gives: ['region:r_desert', 'flag:desert_finale_done', 'choice:ch_desert_write', 'var:pain_count+1'],
      calls: ['desert_after'],
      warp: { to: 'kasim', spawn: 'plaza' },
    },
  });

  // 報酬（アブルの砂王の印章・ギルドの割引・隊商路）
  E('desert_after', async (ev) => {
    if (ev.flag('desert_reward_given')) return;
    await ev.say('npc_abul', ['語り部どの。王墓の番として、\n礼を言わせてくれ。', 'これは、代々の墓の番が守ってきた\n砂王の印章じゃ。王の名を呼んだ者が\n持つのが、ふさわしかろう。'], { name: 'アブル' });
    ev.item('ac_tale_desert', 1);
    await ev.say('zaid_after', ['隊商ギルドからも礼だ。\nこれから、カシムの店では\nあんたたちの勘定は一割引きだ。', 'それと、隊商路の荷車に\nいつでも乗っていい。\n宿場「砂の縁」まで、ひと晩で着く。'], { name: 'ザイード' });
    ev.setFlag('desert_reward_given');
    ev.setFlag('desert_cart');
    await ev.caption('カシムの店が 1 割安くなった。\n隊商路の荷車に乗れるようになった。', { ms: 2600 });
    const c = X().hawk(ev);
    if (ev.choiceOf('ch_desert_write') === 'pain') await ev.caption(c === 'fight' ? '……後日、町の戦没者の碑の前に、\n覆面の男が一人、立っていたという。' : '……後日、砂の鷹団が町の戦没者の碑に、\n仲間の名を刻み直しに来たという。', { ms: 2800 });
    if (ev.flag('yura_dyer_asked') && !ev.flag('yura_dyer_home')) await ev.caption('藍染め職人のライラが、\n「泉が戻ったら、母さんに知らせたい」\nと話していた。', { ms: 2400 });
  }, { meta: { needs: ['flag:desert_finale_done'], gives: ['flag:desert_reward_given', 'flag:desert_cart', 'item:ac_tale_desert'] } });

  // ---------------------------------------------------------------- 解決の後のハザル（王の間と古い泉）
  E('desert_hazal_after', async (ev, ctx) => {
    const id = (ctx && ctx.npc) || 'npc_hazal';
    if (X().tier() >= 6) { await ev.say(id, '白い闇が、砂の向こうまで\n来ている。……語り部よ、\n名を、手放すでないぞ。', HAZAL2); return; }
    if (ctx && ctx.map === 'desert_camp3') {
      await ev.say(id, ['泉の底の火は、民の祈りで燃える。\n夕べの祈りに、名が戻った。', 'もう、火は消えぬ。\n……ありがとう、語り部よ。'], HAZAL2);
      return;
    }
    await ev.say(id, ['名を呼ばれるのは、あたたかいものだな。', '王の間の魔物は、わたしにも\n鎮められぬ。腕を磨くには、\nよかろう。'], HAZAL2);
  });

  // 王墓のオアシスのアブル（名の文字の手がかり）
  E('desert_abul_oasis', async (ev) => {
    const n = X().glyphs(ev);
    ev.lead('l_desert_glyphs');
    if (ev.flag('desert_king')) { await ev.say('abul_oasis', '王の間から、あたたかい風が\n吹いてくる……。'); return; }
    await ev.say('abul_oasis', n >= 3 ? ['三つの文字がそろったか。\n……ハザル。そうじゃ、それが王の名じゃ。', '王の前で、その名を呼んでやってくれ。\n名を呼ばれれば、王は\n砂の怒りをしずめるじゃろう。'] : ['王墓の墓守の像の台座には、\n王の名が一文字ずつ刻まれておる。', `今、おまえが持っておる文字は ${n} つ。\n三つそろえば、王の名になる。`, '一つは入口の階の西の奥。\n一つは下の階の西の果て。\n一つは王の間の東じゃ。']);
    if (!ev.flag('desert_abul_gift')) {
      ev.setFlag('desert_abul_gift');
      await ev.say('abul_oasis', 'これを持っていけ。\n墓の番の、魔よけの香じゃ。');
      ev.item('i_repel', 2);
    }
  }, { meta: { needs: ['flag:desert_abul_came'], gives: ['lead:l_desert_glyphs'] } });

  E('desert_camp3_oldspring', async (ev) => {
    if (ev.flag('cleared_r_desert')) { await ev.say(null, ['泉の底で、金色の火が\nゆらゆらと燃えている。', '水は澄んで、温かい。']); return; }
    await ev.say(null, ['古い泉だ。水は、くるぶしほどしかない。', '底の石の真ん中が、\nうっすらと温かい……。\n火の燃えかすのように。']);
  });
})(window.RPG);
