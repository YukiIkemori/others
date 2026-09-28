// 灰の荒野（カルデラ・闘技場・灰の火山）の共通のデータと小道具。WORLD_REDESIGN §4.7・§3.2〜§3.5、STORY_BIBLE §7.7・§8.8・§10
//   R.DB.leads      灰の手がかり（地方・依頼・寄り道のうわさ・本筋 1）
//   R.DB.lore       読み物（lo_ev_ash・lo_time_ash・lo_war_ash・lo_ash_firebird・くべられなかった手紙）
//   R.DB.chronicle.r_ash  年代記の章「火の鳥の眠る山」（八百長の誘い・無敗・痛みの選択で文が変わる。E14）
//   R.Ash.ev        イベントが使う小道具（BOUTS・MURALS・narr・lore・lz・small・tier…）
// 旗・変数（§2.4 の決まり）: ash_* ／ 大会: 出場 ash_entered、勝った回 var ash_round（0〜5）、負けた数 var ash_losses、
//   今の回の相手を砂の場に出す var ash_bout（1〜5。0 = いない）、決勝の前夜 ash_eve_done、優勝 ash_champion、
//   八百長の誘い 選択 ch_ash_bribe（refuse|accept）、壁画 ash_mural_<1|2|3>・var ash_murals、写し手を止めた ash_copy_stopped・
//   白くされた壁画 ash_mural_blank、溶岩の堰 ash_sluice、番犬 ash_hound、巨獣 ash_lavabeast、卵 ash_egg、締め ash_finale_done
//   選択 ch_ash_bribe（refuse|accept）・ch_ash_write（rebirth|pain）
// 仲間 20 人には物語の焦点を当てない（A36）。ボイスは本筋の要の台詞だけ（ドルガ・カヤ・ザクロ。design/voice/story_v2_lines.csv）。
(function (R) {
  'use strict';
  const A = (R.Ash = R.Ash || {});
  const X = (A.ev = A.ev || {});

  // ---------------------------------------------------------------- 大会の 5 回戦（WORLD §4.7 の流れ 1）
  X.BOUTS = [
    null,
    { n: 1, troop: 'tr_ash_r1', name: '一回戦', foe: '一族の若者たち', intro: '一族の若者が四人、\n砂の上にずらりと並んだ。', npcs: ['opp_1a', 'opp_1b'] },
    { n: 2, troop: 'tr_ash_r2', name: '二回戦', foe: '獣使いのガロ', intro: '獣使いのガロが口笛を吹くと、\n岩の獣と火トカゲの子が\n砂を蹴って飛び出してきた。', npcs: ['opp_2'] },
    { n: 3, troop: 'tr_ash_r3', name: '三回戦', foe: '術師の姉妹', intro: '術師の姉妹が、杖を交差させて\n一礼した。「姉のヒノエ」「妹のスミ」', npcs: ['opp_3a', 'opp_3b'] },
    { n: 4, troop: 'tr_ash_r4', name: '四回戦', foe: '鉄鎧のバルガ', intro: '鉄鎧のバルガが、大斧を\n砂に突き立てた。\n鎧の中から、低い笑い声がする。', npcs: ['opp_4'] },
    { n: 5, troop: 'tr_b_zakuro', name: '決勝', foe: 'ザクロ', intro: '「記録院付き」の名札を下げた闘士が、\n刀の柄に手を置いて立っている。', npcs: ['opp_5'] },
  ];
  // 壁画の物語（v1 の文のまま）。3 つ目は、写し手に白くされると後半が消える
  X.MURALS = {
    1: '壁画には、灰の中から\n小さな炎が生まれる姿が\n描かれている。',
    2: '炎は鳥の姿になり、\n山の火を静めながら\n大地を温めている。',
    3: '年老いた鳥は灰に還り、\n巫女の語る物語で、\nふたたび卵から生まれる。',
    3.5: '年老いた鳥は灰に還り……\nその先は、白く塗りこめられている。',
  };
  X.TELL = [
    '灰の中から、\n小さな炎が生まれた。',
    '炎は鳥の姿になり、\n山の火を静めながら\n大地を温めた。',
    '年老いた鳥は灰に還り、\n巫女の語る物語で、\nふたたび卵から生まれる。',
  ];
  X.TELL_BLANK = '年老いた鳥は灰に還り……';
  X.tier = () => (R.Tier && R.Tier.get ? R.Tier.get() : 0);
  X.cleared = (ev) => ev.flag('cleared_r_ash');
  X.round = (ev) => ev.var('ash_round');
  X.murals = (ev) => [1, 2, 3].filter((n) => ev.flag('ash_mural_' + n)).length;
  X.narr = (ev, text) => ev.say(null, text, { face: false });
  /** 読み物を書庫へ（旗 = id） */
  X.lore = async function (ev, id) {
    if (ev.flag(id)) return false;
    if (typeof ev.lore === 'function') { ev.lore(id); return true; }
    ev.setFlag(id);
    return true;
  };
  X.small = function (ev, table) { const row = table[Math.min(X.tier(), table.length - 1)]; return row[0] === 'gold' ? ev.gold(row[1]) : ev.item(row[0], row[1]); };
  /** STORY_BIBLE §3.5 の世代と、ティアの近況（WORLD §1.3 の表） */
  X.skyLine = function () {
    const t = X.tier();
    if (t >= 6) return '朝の鐘って、ほんとうは\n何の合図だったんだろうね。';
    if (t >= 4) return '近ごろ、噴煙の上の空が\nうす紫に見えるんだ。';
    if (t >= 2) return '近ごろ、夜の色が\nちょっと薄くないかい？';
    return null;
  };

  // ---------------------------------------------------------------- くべられなかった手紙（STORY_BIBLE §10.3）: 拾った順に n 通目（ほかの地方と同じ番号の組）
  X.lz = async function (ev) {
    let n = ev.var('ash_lz');
    if (!n) { n = 2; while (n < 8 && ev.flag('lo_lz_' + n)) n++; ev.setVar('ash_lz', n); }
    await X.lore(ev, 'lo_lz_' + n);
    if (R.DB.letters['letter_lz_' + n] && X.tier() >= n - 1) await ev.letter('letter_lz_' + n);
    else await ev.say(null, ['封を切ると、字が白く抜けていた。\n「ミラへ」――宛名のほかは、\n読めない。', '（灯がもう少し戻れば、\n読めるようになるかもしれない）']);
    return n;
  };

  // ---------------------------------------------------------------- 手がかり（K.lead）
  const lead = (id, o) => R.def('leads', id, Object.assign({ region: 'r_ash' }, o));
  lead('l_ash_trial', { kind: 'region', title: '炎の試練', text: '火口に入れるのは、年に一度の\n闘技大会「炎の試練」の勝者だけ。\n闘技場の受付で、よそ者も出られる。', from: 'カルデラの門番', place: 'caldera', done: 'ash_champion' });
  lead('l_ash_egg', { kind: 'region', title: '冷えていく卵', text: '火口に眠る火の鳥の卵が、\n冷えていく。巫女カヤは、卵に\n語る物語を思い出せないという。', from: '火の神殿のカヤ', place: 'caldera', done: 'cleared_r_ash' });
  lead('l_ash_stranger', { kind: 'region', title: '見かけない闘士', text: '今年の大会に、「記録院付き」の\n名札を下げた闘士がいる。\n酒場で水ばかり飲んでいるという。', from: '酒場「殻の中」', place: 'caldera', done: 'ash_champion' });
  lead('l_ash_volcano', { kind: 'region', title: '灰の火山', text: '優勝した。族長ドルガが、\n町の東の火山の岩戸を開けた。\n火口に、火の鳥の卵が眠る。', from: '族長ドルガ', place: 'volcano', dir: '東', done: 'ash_lavabeast' });
  lead('l_ash_murals', { kind: 'region', title: '壁画の物語', text: '火山の壁に、昔の巫女たちが\n火の鳥の物語を描き残した。\n三つ読めば、火口への岩戸が開く。', from: 'カヤ', place: 'volcano', done: { var: 'ash_murals', gte: 3 } });
  lead('l_main_recorder_ash', { kind: 'main', region: 'world', title: '記録院付きの闘士', text: '大会の名簿に「記録院付き」の\n闘士ザクロ。去年は記録官が\n火口の壁画を写しに来ていた。', from: '闘技場の名簿', place: 'caldera' });
  // 依頼（side。id は依頼と同じ q_*）
  lead('q_ash_bet', { kind: 'side', title: '闘技場の賭け', text: '賭け屋のボッツが、ほかの試合の\n勝ち負けに賭けないかという。\n当てるたびに、段が上がる。', from: '賭け屋のボッツ', place: 'caldera', done: 'ash_bet_done' });
  lead('q_ash_lanterns', { kind: 'side', title: '【灯りを守る】火守りの見習い', text: '神殿の種火を、火口の段々の\n灯籠へ分けて回る。灯籠は三つ。\n崖の上の、消えた灯籠だ。', from: '火守りの見習いのトト', place: 'caldera', done: 'ash_lanterns_done' });
  lead('q_ash_spa', { kind: 'side', title: '温泉の番', text: '町の湯が灰でにごった。\n湯の郷の岩の割れ目で採れる\n湯の花があれば、澄むという。', from: '湯守りのばあさま', place: 'caldera', done: 'ash_spa_done' });
  lead('q_ash_challenge', { kind: 'side', title: '挑戦者の間', text: '大会のあと、闘技場で腕試しの\n勝ち抜きができる。相手は五組。\n勝ち抜くたびに、品が出る。', from: '受付のミラン', place: 'caldera', done: 'ash_challenge_done' });
  // 寄り道のうわさ（rumor）
  lead('l_opt_spa', { kind: 'rumor', title: '溶岩洞の湯の郷', text: '荒野の北の岩の間から、湯気が\n噴き出している。奥の湯につかると、\n疲れがすっかり取れるという。', from: '湯治の行商', dir: '北西', done: 'ash_spa_bathed' });
  lead('l_opt_turtle', { kind: 'rumor', title: '動く岩の浜', text: '南の黒い砂浜で、岩が動いた。\n火山ガメという、甲羅の硬い\n珍しい魔物らしい。', from: '古参の闘士', dir: '南', done: { var: 'ash_turtle_seen', gte: 1 } });
  lead('l_opt_battlefield', { kind: 'rumor', title: '折れた剣の碑', text: '荒野の西に、折れた剣の碑が\n立っている。夜ごと、鬨の声が\n聞こえるという。', from: '湯治の行商', dir: '西', done: 'ash_battlefield_seen' });

  // ---------------------------------------------------------------- 読み物（STORY_BIBLE §10.2 の 29〜31 ほか）
  const lore = (id, o) => R.def('lore', id, Object.assign({ region: 'r_ash' }, o));
  lore('lo_ev_ash', { title: '大会の名簿', kind: 'main', must: true, text: '炎の試練、出場者名簿。\n若者組・獣使い・術師の姉妹・鉄鎧……\n「十六番　ザクロ（記録院付き）」' });
  lore('lo_time_ash', { title: '最後の代理試合の銘板', kind: 'main', must: true, text: '西の観客席の柱の銘板。\n「光暦二九二年　冬至の前夜\n最後の代理試合」\nその下の二つの名は、削れて読めない。\n神殿の「火の鳥の巡り」の記録も、\nその夜の欄で止まっている。' });
  lore('lo_war_ash', { title: 'ドルガの記憶', kind: 'region', must: false, text: '二十年前、族長ドルガは\n火の鳥同盟の代理の闘士だった。\n試合の最中、娘が二人、砂の上に\n下りてきて歌った。敵も味方も、\n剣を止めた。' });
  lore('lo_ash_firebird', { title: '火の鳥の物語', kind: 'region', must: false, text: '灰の中から、小さな炎が生まれた。\n炎は鳥の姿になり、山の火を静め、\n大地を温めた。年老いた鳥は灰に還り、\n巫女の語る物語で、ふたたび\n卵から生まれる。' });

  // ---------------------------------------------------------------- 年代記の章（E14。選択で文が変わる）
  R.def('chronicle', 'r_ash', {
    title: '火の鳥の眠る山',
    get text() {
      const ok = (c) => c == null || (R.Game && R.State && R.State.check ? R.State.check(c) : false);
      return this.parts.filter((p) => ok(p.cond)).map((p) => p.text).join('\n');
    },
    parts: [
      { text: '火口の卵が冷え、\n灰の荒野の赤が鈍っていった。' },
      { cond: { choice: 'ch_ash_bribe', is: 'refuse' }, text: '語り部の見習いは、決勝の前夜の\n誘いを断り、炎の試練を勝ち抜いた。' },
      { cond: { choice: 'ch_ash_bribe', is: 'accept' }, text: '語り部の見習いは、決勝の前夜の\n金を一度は受け取った。\n偽らずに、そのことも記す。' },
      { cond: 'ash_unbeaten', text: '一度も砂に膝をつかなかった。' },
      { cond: { choice: 'ch_ash_write', is: 'rebirth' }, text: '火の鳥は、語りを聞いて\n卵からかえり……' },
      { cond: { choice: 'ch_ash_write', is: 'pain' }, text: '……この砂の上で、名も知れぬ\n二人の歌い手が死んだ。\nその夜のことも、ここに記す。' },
      { cond: 'cleared_r_ash', text: '火の鳥は火の粉の尾を引いて、\n町の上をひとめぐりした。' },
    ],
  });
})(window.RPG);
