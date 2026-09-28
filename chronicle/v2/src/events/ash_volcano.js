// 灰の火山と灰の荒野の締め（WORLD_REDESIGN §4.7 の 3〜5・§6.4・§4.10、STORY_BIBLE §7.7・§11.8）
//   1 階: volcano_arrive・溶岩の堰のレバー（流れが A と B の間で入れ替わる）・壁画 3 つ（好きな順。3 つで火口への岩戸が開く）・
//         炎の番犬（tr_b_hellhound、東の部屋の前）・記録院の写し手（西の部屋の前。八百長を受けた = 刻限を知っていれば止められる。
//         断った = 着いたときには壁画 3 の後半が白く塗りこめられている）
//   火口: crater_arrive・溶岩の巨獣（tr_b_lavabeast、土手道）→ 火口の縁にフィーネ（v_fine_ash_01、録音の文のまま）→
//         卵に壁画の物語を語る（白くされた壁画は一行短い）→ 火の鳥がかえる → ash_finale（clearRegion('r_ash') → 町の上を火の鳥がめぐる →
//         闘技場の銘板の前でドルガ → 年代記に書く選択 ch_ash_write → 帯か残り火）
//   ワールド: 火山の岩戸（優勝の前）・峠の旅人・湯の郷・火山ガメの浜・折れた剣の碑・灰見の宿の人。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Ash.ev;
  const objAt = (ctx, map, event) => { const m = R.DB.maps[map]; return m && ctx && (m.objects || []).find((o) => o.type === 'examine' && o.event === event && o.x === ctx.x && o.y === ctx.y); };
  const FINE = { name: '灰色のマントの少女' }, DORGA = { name: 'ドルガ' };

  // ================================================================ 1 階
  E('volcano_arrive', async (ev) => {
    if (X().cleared(ev)) return;
    if (!ev.flag('ash_volcano_seen')) {
      ev.setFlag('ash_volcano_seen');
      await ev.caption('灰の火山。\n岩の割れ目を、溶岩が\n赤くゆっくりと流れていく。', { ms: 2400 });
      await ev.caption('川の渡り場のそばに、\n石のレバーがある。\n溶岩の堰を動かすものらしい。', { ms: 2200 });
    }
  });
  // 溶岩の堰（引くたびに、流れが A（西）と B（北）の間で入れ替わる）
  E('volcano_sluice', async (ev) => {
    const i = await ev.choose(['レバーを引く', 'やめる'], { text: '溶岩の堰の、石のレバーだ。' });
    if (i !== 0) return;
    const on = !ev.flag('ash_sluice');
    ev.setFlag('ash_sluice', on);
    ev.sfx('stone');
    try { R.Field.shake(3, 600); } catch (e) { /* */ }
    await ev.caption(on ? 'ゴゴゴ……。堰の石が動き、\n溶岩が西の川へ流れこんだ。\n北の渡り場の溶岩が、黒く冷えていく。' : 'ゴゴゴ……。堰の石が戻り、\n溶岩が北の川へ流れこんだ。\n西の渡り場の溶岩が、黒く冷えていく。', { ms: 2400 });
  }, { meta: { needs: [], gives: ['flag:ash_sluice'] } });
  // 壁画（好きな順）。3 つ目で火口への岩戸が開く
  E('volcano_mural', async (ev, ctx) => {
    const x = X();
    const o = objAt(ctx, 'ash_volcano_1', 'volcano_mural');
    const n = (o && o.mural) || 1;
    const f = 'ash_mural_' + n;
    const blank = n === 3 && ev.flag('ash_mural_blank');
    const text = blank ? x.MURALS[3.5] : x.MURALS[n];
    if (ev.flag(f)) { await ev.say(null, ['火の鳥の壁画だ。', text]); return; }
    await ev.say(null, '壁一面に、古い絵が\n描かれている……。');
    ev.sfx('page');
    await ev.say(null, text);
    ev.setFlag(f);
    const k = x.murals(ev);
    ev.setVar('ash_murals', k);
    await ev.say(null, '{hero}は、壁画の場面を\n年代記に書き留めた。');
    if (k < 3) { await ev.say(null, k === 1 ? '火の鳥の物語の、ひとつの場面だ。\n続きの壁画も、どこかにあるはずだ。' : '物語の続きが見えてきた。\n壁画は、あとひとつ……。'); return; }
    await ev.say(null, '灰から生まれ、山を温め、\n灰に還って、また生まれる。\n……これが、火の鳥の物語だ。');
    await x.lore(ev, 'lo_ash_firebird');
    ev.leadDone('l_ash_murals');
    ev.sfx('unlock');
    try { R.Field.shake(4, 900); } catch (e) { /* */ }
    await ev.caption('北の方で、重い岩の\n動く音が響いた。\n火口への岩戸が、開いたのだ。', { ms: 2400 });
  }, { meta: { needs: [], gives: ['flag:ash_mural_1', 'flag:ash_mural_2', 'flag:ash_mural_3', 'var:ash_murals+3', 'lore:lo_ash_firebird'] } });
  E('volcano_rockdoor', async (ev) => {
    const k = X().murals(ev);
    await ev.say(null, ['大きな岩戸が、火口への道を\nふさいでいる。', '表面に、鳥の形のくぼみが\n三つ刻まれている。', k === 1 ? 'くぼみのひとつが、\nほのかに赤く光っている。' : k === 2 ? 'くぼみのふたつが、\nほのかに赤く光っている。' : '壁画の物語を知る者にだけ\n開く、と言われているらしい。']);
  });
  // 炎の番犬（中ボス。東の部屋 = 壁画 2 の前）
  E('volcano_hound', async (ev) => {
    if (ev.flag('ash_hound')) return;
    ev.bgm('omen');
    await ev.say(null, ['グルルル……。', '二つの頭を持つ炎の犬が、\n奥の壁画の前をふさいでいる！']);
    ev.sfx('roar');
    const r = await ev.battle('tr_b_hellhound', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('ash_hound');
    await ev.say(null, ['炎の番犬は、ひと声ほえて\n溶岩の中へ崩れ落ちた。', '奥の壁に、古い絵が見える。']);
  }, { meta: { needs: [], gives: ['flag:ash_hound'] } });
  // 記録院の写し手（西の部屋の前。八百長を受けた = 刻限を知っている → 止める／断った → もう白くされている）
  E('volcano_copyists', async (ev) => {
    if (ev.flag('ash_copy_done') || !ev.flag('ash_champion')) return;
    if (ev.choiceOf('ch_ash_bribe') === 'accept') {
      await ev.caption('――夜明け前。使いの言っていた、\n刻限だ。西の部屋に、\n灯りがちらついている。', { ms: 2400 });
      ev.setFlag('ash_copyists');
      try { await ev.appear(['copyist_a', 'copyist_b'], { ms: 600 }); } catch (e) { /* */ }
      await ev.say('copyist_a', ['……誰だ！　ここは、\n記録院の保管のための写しを……', '見られたからには、\n通すわけにはいかない！']);
      const r = await ev.battle('tr_ash_copyists');
      if (r !== 'win') return;
      await ev.say(null, '写し手たちは、白紙の束を\n抱えて逃げていった。');
      try { await ev.leave(['copyist_a', 'copyist_b'], { ms: 600 }); } catch (e) { /* */ }
      ev.setFlag('ash_copyists', false);
      ev.setFlag('ash_copy_stopped');
      await ev.caption('壁画は、無事だった。\n写し手の刷毛は、まだ\n一筆も入っていない。', { ms: 2200 });
    } else {
      await ev.caption('西の部屋の床に、白い粉と、\n折れた羽ペンが一本。\n……誰かが、先に来ていた。', { ms: 2400 });
      ev.setFlag('ash_mural_blank');
    }
    ev.setFlag('ash_copy_done');
  }, { meta: { needs: ['flag:ash_champion'], gives: ['flag:ash_copy_done'] } });

  // ================================================================ 火口
  E('crater_arrive', async (ev) => {
    if (ev.flag('ash_lavabeast')) return;
    await ev.caption('火口。溶岩の湖のまん中の島に、\n灰をかぶった大きな卵が見える。', { ms: 2600 });
  });
  E('crater_beast', async (ev) => {
    if (ev.flag('ash_lavabeast')) return;
    ev.bgm('omen');
    await ev.say(null, '卵へ続く土手道の前で、\n煮えたぎる溶岩が盛り上がった！');
    try { R.Field.shake(5, 900); } catch (e) { /* */ }
    await ev.say(null, '守り手を失った山の火が、\n獣の姿になって立ちはだかる！');
    ev.sfx('roar');
    const r = await ev.battle('tr_b_lavabeast', { boss: true });
    if (r !== 'win') { ev.mapBgm(); return; }
    ev.setFlag('ash_lavabeast');
    await ev.say(null, '溶岩の巨獣は、黒い岩になって\n崩れ落ちた。');
    ev.leadDone('l_ash_volcano');
    await ev.call('crater_fine');
    ev.mapBgm();
  }, { meta: { needs: [], gives: ['flag:ash_lavabeast', 'flag:ash_fine_seen'], calls: ['crater_fine'] } });
  // 火口の縁のフィーネ（録音の文のまま。卵がかえる前）
  E('crater_fine', async (ev) => {
    if (ev.flag('ash_fine_seen')) return;
    ev.setFlag('ash_fine_seen', false);
    R.Audio && R.Audio.pushBgm && R.Audio.pushBgm('fine_theme');
    try {
      await ev.say(null, 'ふり返ると、火口の縁に\n灰色のマントの少女が立っていた。');
      try { await ev.appear('fine', { ms: 900 }); } catch (e) { /* */ }
      await ev.say('fine', '燃え尽きることと、\n忘れられることは、違うわ。', Object.assign({ voice: 'v_fine_ash_01' }, FINE));
      const t = Math.min(7, X().tier());
      if (t >= 3) await ev.caption('少女の足もとが、\n透けて見えた。', { ms: 1800 });
      ev.sfx('magic');
      ev.setFlag('ash_fine_seen');
      try { await ev.leave('fine', { ms: 900 }); } catch (e) { /* */ }
      await ev.caption('少女の姿は、火の粉の中に\n溶けていった。', { ms: 2000 });
    } finally { R.Audio && R.Audio.popBgm && R.Audio.popBgm(); }
  }, { meta: { needs: ['flag:ash_lavabeast'], gives: ['flag:ash_fine_seen'] } });
  // 卵に壁画の物語を語る → 火の鳥がかえる → 締め
  E('crater_egg', async (ev) => {
    const x = X();
    if (x.cleared(ev)) { await ev.say(null, ['からっぽの殻が、まだ\nほんのり温かい。']); return; }
    if (!ev.flag('ash_lavabeast')) { await ev.say(null, ['灰をかぶった、大きな卵。\n手を当てると、冷たい。']); return; }
    await ev.say(null, ['灰をかぶった、大きな卵。\n手を当てると、ほんのかすかに\n鼓動が伝わってくる。', '{hero}は卵の前で、\n壁画の物語を語った。']);
    ev.bgm('legend');
    for (let i = 0; i < 3; i++) {
      const t = i === 2 && ev.flag('ash_mural_blank') ? x.TELL_BLANK : x.TELL[i];
      await ev.caption(t, { ms: 2600 });
    }
    if (ev.flag('ash_mural_blank')) await ev.caption('……最後の場面は、うまく\n語りきれなかった。\nそれでも、卵が小さく揺れた。', { ms: 2600 });
    ev.sfx('light');
    try { R.Field.flash && R.Field.flash('#ffd080', 400); } catch (e) { /* */ }
    try { R.Field.shake(4, 800); } catch (e) { /* */ }
    await ev.caption('卵が、小さな太陽のように\n光りはじめた。\n殻に、赤金のひびが走る。', { ms: 2600 });
    try { R.Field.flash && R.Field.flash('#ffffff', 500); } catch (e) { /* */ }
    ev.setFlag('ash_egg');
    await ev.caption('火の鳥が、よみがえった！', { ms: 2000 });
    await ev.caption('火の鳥は、火口の空へ\n高く舞い上がっていった。', { ms: 2400 });
    await ev.call('ash_finale');
  }, {
    meta: {
      needs: ['flag:ash_lavabeast'],
      gives: ['flag:ash_egg', 'region:r_ash', 'flag:ash_finale_done', 'choice:ch_ash_write', 'flag:ash_reward_given'],
      calls: ['ash_finale'],
    },
  });

  // ---------------------------------------------------------------- 灯り直す場面と締め
  E('ash_finale', async (ev) => {
    if (ev.flag('ash_finale_done')) return;
    // 大灯火（火の鳥）: ページ・ティア・光の柱・章の札（EVENTS の共通の筋）
    await ev.clearRegion('r_ash');
    ev.bgm('dawn');
    await ev.fade('out', 800);
    await ev.warp('caldera', 'warp');
    await ev.caption('カルデラ。闇の空に、\n火の粉の尾を引いて、\n火の鳥が町の上をひとめぐりした。', { ms: 3000 });
    await ev.caption('闘技場の観客が、いっせいに\n空を見上げた。溶岩の堀が、\n前より明るく燃え上がる。', { ms: 3000 });
    await ev.fade('out', 600);
    await ev.warp('caldera_arena', 'plaque');
    ev.setFlag('ash_plaque_scene');
    await ev.say(null, '族長のドルガが、西の観客席の\n銘板の前に立っていた。', { face: false });
    await ev.say('dorga_plaque', ['火の鳥が、飛んだ。\n……二十年ぶりに、この砂の上で\n胸が熱くなった。'], DORGA);
    await ev.say(null, '{hero}は、年代記を開いた。\nこの町のことを、どう書こう。');
    const i = await ev.choose(['火の鳥の再生を書く', '最後の代理試合の夜のことも書く'], { text: '年代記に何を書く？' });
    if (i === 1) {
      ev.choice('ch_ash_write', 'pain');
      ev.addVar('pain_count', 1);
      await ev.say(null, '「……この砂の上で、名も知れぬ\n二人の歌い手が死んだ。\nその夜のことも、ここに記す」');
      await ev.say('dorga_plaque', '……歌い手の席を、空けておこう。\nいつか、二人の名を\n彫れる日が来るまで。', Object.assign({ voice: 'v_dorga_ash_03' }, DORGA));
      ev.setFlag('ash_singer_board');
      await ev.caption('ドルガは、銘板の下に\n新しい板を一枚、打ち付けた。', { ms: 2400 });
    } else {
      ev.choice('ch_ash_write', 'rebirth');
      await ev.say(null, '「火の鳥は、語りを聞いて\n卵からかえり……」');
    }
    ev.sfx('quill');
    ev.setFlag('ash_finale_done');
    ev.leadDone('l_ash_egg');
    await ev.call('ash_reward');
    ev.mapBgm();
  }, { meta: { needs: ['flag:ash_egg'], gives: ['region:r_ash', 'flag:ash_finale_done', 'choice:ch_ash_write', 'flag:ash_singer_board'], calls: ['ash_reward'], warp: { to: 'caldera_arena', spawn: 'plaque' } } });
  // 族長の品（断った: 闘士の帯）／カヤの品（受けた: 壁画の残り火）。同じ強さ
  E('ash_reward', async (ev) => {
    if (ev.flag('ash_reward_given')) return;
    ev.setFlag('ash_reward_given');
    if (ev.choiceOf('ch_ash_bribe') === 'accept') {
      await ev.say(null, ['巫女のカヤが、闘技場に\n下りてきていた。', '「写し手を止めてくれたのね。\n……壁画の赤い顔料のかけら。\n火の鳥の残り火が宿ってる」'], { face: false });
      ev.item('u_mural_ember', 1);
    } else {
      await ev.say('dorga_plaque', ['前の晩の使いを、断ったそうだな。', 'これは、炎の試練の勝者の帯だ。\n……一族の者として、締めていけ。'], DORGA);
      ev.item('u_champion_belt', 1);
    }
  }, { meta: { needs: ['flag:ash_finale_done'], gives: ['flag:ash_reward_given', 'item:u_champion_belt|u_mural_ember'] } });

  // ================================================================ ワールド
  E('ash_rockdoor_world', async (ev) => {
    await ev.say(null, ['火山のふもとの、大きな岩戸。\n鳥の紋が刻まれている。', '「炎の試練の勝者のほか、\n開くべからず」']);
    if (ev.flag('ash_entered')) await ev.say(null, '……優勝すれば、族長が\n開けてくれるはずだ。');
  });
  E('ash_world_traveler', async (ev) => {
    await ev.say('ash_traveler', X().cleared(ev) ? ['火の鳥が飛んだってな。\n荒野の赤が、戻ってきた。'] : ['この先が灰の荒野だ。\n灰をかぶった道を外れると、\n溶岩の原に出ちまうぞ。', '炎の町カルデラじゃ、\n今年も闘技大会をやってるよ。']);
    ev.lead('l_ash_trial');
  }, { meta: { needs: [], gives: ['lead:l_ash_trial'] } });
  E('ash_spa_pool', async (ev) => {
    ev.setFlag('ash_spa_bathed');
    const i = await ev.choose(['湯につかる', 'やめる'], { text: '岩の割れ目から湧く、\n湯の郷の温泉だ。' });
    if (i === 0) {
      await ev.fade('out', 500);
      ev.rest();
      await ev.fade('in', 500);
      await ev.caption('体の芯まで温まった。\n（HP・MP が回復した）', { ms: 1800 });
    }
    if (ev.flag('q_ash_spa_on') && !ev.flag('ash_spa_done') && !ev.has('k_spa_salt')) {
      await ev.say(null, '岩の割れ目に、白い湯の花が\nこびりついている。\n少し削って持っていこう。');
      ev.item('k_spa_salt', 1);
    }
  }, { meta: { needs: [], gives: ['flag:ash_spa_bathed', 'item:k_spa_salt'] } });
  E('ash_beach_rock', async (ev) => {
    ev.addVar('ash_turtle_seen', 1);
    await ev.say(null, ['黒い砂浜に、丸い岩が\nいくつも転がっている。', '……今、ひとつ動かなかったか？']);
  }, { meta: { needs: [], gives: ['var:ash_turtle_seen'] } });
  E('ash_battlefield_stone', async (ev) => {
    ev.setFlag('ash_battlefield_seen');
    await ev.say(null, ['折れた剣の碑。\n根もとに、錆びた剣が\n何本も突き立てられている。', '「日継ぎの戦の、名もなき兵たちへ」', '……碑の奥の古戦場へは、\n崩れた岩で入れない。']);
  }, { meta: { needs: [], gives: ['flag:ash_battlefield_seen'] } });
  E('ash_bridge_sign', async (ev) => {
    await ev.say(null, ['潮見橋。北のグレイモア湿原と、\n灰の荒野をつなぐ石の橋。', '「大きな船の来る晩は、\n橋が上がる」と、古い札。']);
  });
})(window.RPG);
// 宿場「灰見の宿」（#27）: 宿と売り台・橋番・湿原の行商（ワールドの人の続き。別の IIFE にしない: 上の E と同じ形で足す）
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  E('haimi_keeper', async (ev) => {
    await ev.say('haimi_keeper', '灰見の宿へ、ようこそ。\n橋を渡る人も、渡ってきた人も、\nここでひと休みさ。');
    const i = await ev.choose(['泊まる', '売り台を見る', 'やめる'], { text: '宿のばあさまが、帳場に座っている。' });
    if (i === 0) await ev.inn();
    else if (i === 1) await ev.shop('shop_haimi');
  });
  E('haimi_bridgeman', async (ev) => {
    await ev.say('haimi_bridgeman', ev.flag('cleared_r_ash') ? ['火の鳥が、橋の上を\n飛んでいったよ。', '潮見橋が、あんなに赤く\n照らされたのは初めてだ。'] : ['橋番のゴウだ。北の潮見橋を\n渡れば、グレイモア湿原だよ。', '大きな船が来る晩は、橋が\n上がって水門になる。……と、\n古い札には書いてあるがね。', 'わしが番をして四十年、\nそんな船は一度も来とらん。']);
  });
  E('haimi_guest', async (ev) => {
    await ev.say('haimi_guest', ['湿原の町ロッホから来たんだ。\n霧の晩は、子どもを外に\n出しちゃいけないって話さ。', 'こっちの町じゃ、闘技大会の\n真っ最中だろう？']);
    ev.lead('l_rumor_marsh');
    ev.lead('l_ash_trial');
  }, { meta: { needs: [], gives: ['lead:l_rumor_marsh', 'lead:l_ash_trial'] } });
  E('haimi_bridge_log', async (ev) => {
    await ev.say(null, ['橋番の日誌。風の強さと、\n渡った人の数が書いてある。', '二十年前の冬の欄に、\n「代理試合の客、南へ多し。\n帰りの客、少なし」とある。']);
  });
})(window.RPG);
