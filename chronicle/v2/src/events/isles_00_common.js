// マレア諸島（港町コーラル・岬の村ネレイ・潮鳴りの洞窟・幽霊船）の共通のデータと小道具。WORLD_REDESIGN §4.5・§5.8・§5.9、STORY_BIBLE §7.5・§8.6・§10.2・§11.8
//   R.DB.leads      諸島の手がかり（地方・依頼・寄り道のうわさ・本筋 1）
//   R.DB.lore       読み物（lo_ev_isles・lo_time_isles・lo_war_isles・lo_isles_shanty）。ラザロの手紙は灯台島の灯室（X.lz）
//   R.DB.chronicle.r_isles  年代記の章「帰らずの船長」（商船の選択・岩の節・痛みの選択で文が変わる。E14）
//   R.Isles.ev      イベントが使う小道具（SHANTY・chart・narr・lore・lz・tier…）
// 旗・変数（§2.4 の決まり）: isles_* ／ 着く isles_arrived・親方ドレイク isles_drake_met・港の親方の海図 isles_chart_got（k_sea_chart）・
//   洞窟 isles_cave_seen・潮 isles_tide_high（潮の石で満ち引き）・大ダコ isles_octopus・光る貝がら isles_shell（k_glow_shell）・外洋船 isles_ship・
//   海図の空白 isles_chart_<light|siren|crab|wreck>・var isles_chart・3 つで isles_fog_found・座礁した商船 isles_wreck_done（選択 ch_isles_wreck = help|cargo）・
//   マリナ isles_marina_met（lo_time_isles）・岩の節 isles_siren_heard・待った一晩 isles_marina_night・歌える isles_song_ready・岬の先のフィーネ isles_fine_seen・
//   夜の桟橋 isles_song_done → 霧の海 isles_fog_open・幽霊船 isles_ghost_seen・名札 isles_tag_<1..6>・var isles_tags・船長 isles_captain・白い日誌 isles_log_white・
//   夜明け isles_dawn_done・年代記 ch_isles_write（story|pain）・締め isles_finale_done・礼 isles_reward_given・灯台の灯 isles_light_lit
// 仲間 20 人には物語の焦点を当てない（A36）。ボイスは本筋の要の台詞だけ（マリナ 4・グレン 5・フィーネ 1。design/voice/script.csv の文のまま）。
(function (R) {
  'use strict';
  const I = (R.Isles = R.Isles || {});
  const X = (I.ev = I.ev || {});

  // ---------------------------------------------------------------- グレンの舟歌（前半はマリナが覚えている。後半は人魚の歌う岩の節）
  X.SHANTY_A = '♪　霧の海でも、迷いはしない\n岬の灯が、おれを呼ぶから';
  X.SHANTY_B = '♪　帆をたたむのは、朝日の港\n待つ人の歌が、おれを呼ぶから';
  // 海図の空白 4 つ（WORLD §4.5 の流れ 3）。3 つ埋まると幽霊船の海域が絞れる
  // 幽霊船の船室の名札 6 枚（任意。STORY_BIBLE §7.5 の 3）。年代記の（痛）で名を記すと、コーラルの後家の壁に名が足される
  X.CREW = [null, '甲板長トビアス', '帆手のルカ', '見張りのサム', '舵取りのオーウェン', '船大工のヨナス', '見習いのベッポ'];
  X.CHART = ['light', 'siren', 'crab', 'wreck'];
  X.CHART_NAME = { light: '灯台島', siren: '人魚の歌う岩', crab: '財宝ヤドカリの島', wreck: '座礁した商船' };
  X.tier = () => (R.Tier && R.Tier.get ? R.Tier.get() : 0);
  X.cleared = (ev) => ev.flag('cleared_r_isles');
  X.charted = (ev) => X.CHART.filter((k) => ev.flag('isles_chart_' + k)).length;
  X.tags = (ev) => [1, 2, 3, 4, 5, 6].filter((n) => ev.flag('isles_tag_' + n)).length;
  X.narr = (ev, text) => ev.say(null, text, { face: false });
  /** 読み物を書庫へ（旗 = id） */
  X.lore = async function (ev, id) {
    if (ev.flag(id)) return false;
    if (typeof ev.lore === 'function') { ev.lore(id); return true; }
    ev.setFlag(id);
    return true;
  };
  /** 海図の空白を 1 つ埋める（船で着いたとき）。3 つ目で霧の海域が絞れる */
  X.chart = async function (ev, key) {
    if (ev.flag('isles_chart_' + key)) return false;
    ev.setFlag('isles_chart_' + key);
    const n = X.charted(ev);
    ev.setVar('isles_chart', n);
    if (!ev.has('k_sea_chart')) return true;
    ev.sfx('quill');
    await ev.caption('海図の空白に「' + X.CHART_NAME[key] + '」を書きこんだ。（' + n + '/4）', { ms: 2000 });
    if (n >= 3 && !ev.flag('isles_fog_found')) {
      ev.setFlag('isles_fog_found');
      await ev.say(null, '三つの空白が埋まると、\n海図のまん中に、どこにも\n属さない海が残った。');
      await ev.say(null, '島と島のあいだの、潮の目。\n幽霊船が出るのは、きっとここだ。');
      ev.leadDone('l_isles_chart');
      ev.lead('l_isles_fog');
    }
    return true;
  };
  /** STORY_BIBLE §3.5 の世代と、ティアの近況（WORLD §1.3 の表） */
  X.skyLine = function () {
    const t = X.tier();
    if (t >= 6) return '近ごろ、空の色が\n夜のうちから少し変わるんだ。\n……気のせいかね。';
    if (t >= 4) return '沖の霧が、前ほど重くないんだ。\n遠くの島の灯が、よく見える。';
    if (t >= 2) return '近ごろ、空がちょっと\n青くないかい？';
    return null;
  };

  // ---------------------------------------------------------------- くべられなかった手紙（STORY_BIBLE §10.3）: 拾った順に n 通目（ほかの地方と同じ番号の組）
  X.lz = async function (ev) {
    let n = ev.var('isles_lz');
    if (!n) { n = 2; while (n < 8 && ev.flag('lo_lz_' + n)) n++; ev.setVar('isles_lz', n); }
    await X.lore(ev, 'lo_lz_' + n);
    if (R.DB.letters['letter_lz_' + n] && X.tier() >= n - 1) await ev.letter('letter_lz_' + n);
    else await ev.say(null, '封のされた手紙だ。宛名は「ミラへ」。\n……今は、まだ読めない。');
    return n;
  };

  // ---------------------------------------------------------------- 手がかり（K.lead）
  const lead = (id, o) => R.def('leads', id, Object.assign({ region: 'r_isles' }, o));
  lead('l_isles_harbor', { kind: 'region', title: '港が閉じた', text: '霧の晩に幽霊船が出て、青い鬼火で\n船を岩礁へ誘う。コーラルの港は\n定期船のほかは船を出さない。', from: 'コーラルの港の親方', place: 'coral', done: 'isles_fog_found' });
  lead('l_isles_ship', { kind: 'region', title: '乗り手のいない船', text: '造船所の親方ドレイクの外洋船は\n仕上がっている。帆を張るには、\n潮鳴りの洞窟の奥の「光る貝がら」を\n船首に付ける習わしだという。', from: '造船所の親方ドレイク', place: 'coral', done: 'isles_ship' });
  lead('l_isles_shell', { kind: 'region', title: '光る貝がら', text: '潮鳴りの洞窟は、コーラルとネレイの\nあいだの入り江の奥。潮の満ち引きで\n道が変わる。奥の岩棚に光る貝がら。', from: '造船所の親方ドレイク', place: 'tidecave', dir: '北東', done: 'isles_shell' });
  lead('l_isles_song', { kind: 'region', title: '岬の村の歌', text: '岬の村ネレイのマリナという人が、\n昔の舟歌を知っているという。\n帰らずの灯の、もとの持ち主の歌だ。', from: 'コーラルの酒場の老水夫', place: 'nerei', dir: '東', done: 'isles_song_done' });
  lead('l_isles_chart', { kind: 'region', title: '海図の空白', text: '港の親方の海図には、幽霊船の出る\n海のまわりに空白が 4 つある。\n船で近くへ行けば埋まる。\n3 つ埋まれば、海域が絞れる。', from: 'コーラルの港の親方', place: 'coral', done: 'isles_fog_found' });
  lead('l_isles_fog', { kind: 'region', title: '霧の中の船', text: '夜の桟橋でマリナが歌えば、\n霧の中から幽霊船が来る。\n自分の船で追って、乗りこむ。', from: '海図', place: 'nerei', done: 'isles_captain' });
  lead('l_main_recorder_isles', { kind: 'main', region: 'world', title: '記録官の小舟', text: '去年、灯台島から小舟を出して、\n幽霊船に近づいた記録官がいた。\n船から帰ってきたとき、\n脇に分厚い白い本を抱えていた。', from: 'ネレイの灯り守り', place: 'nerei' });
  // 依頼（side。id は依頼と同じ q_*）
  lead('q_isles_light', { kind: 'side', title: '【灯りを守る】灯台島', text: '沖の灯台島の灯台には、灯台守が\nいない。ネレイの灯り守りの油を\n灯室のランプにさして、灯をともす。', from: 'ネレイの灯り守り', place: 'nerei', done: 'isles_light_lit' });
  lead('q_isles_flags', { kind: 'side', title: '旗信号の見習い試験', text: '港に入る船の旗の並びを覚えて、\n同じ順に揚げる。船乗り組合の\n見習いの試験。段ごとに礼がある。', from: '船乗り組合の旗手', place: 'coral', done: 'isles_flags_done' });
  lead('q_isles_shells', { kind: 'side', title: '光る貝がら集め', text: '夜光虫で光る貝がらが 12 種ある。\n町の浜、入り江の小さな洞、\n潮鳴りの洞窟の中で拾える。', from: 'コーラルの貝がら好きの子', place: 'coral', done: 'isles_shells_done' });
  lead('q_isles_delivery', { kind: 'side', title: '組合の配達', text: '船乗り組合の荷を、ネレイの雑貨屋へ\n届ける。外洋船を使う練習にもなる。', from: '船乗り組合の組合長', place: 'coral', done: 'isles_delivery_done' });
  // 寄り道のうわさ（rumor）
  lead('l_opt_siren', { kind: 'rumor', title: '人魚の歌う岩', text: '諸島の北に、風が吹くと歌う岩が\nあるという。漁師は、あれは\n古い舟歌の節だと言う。', from: 'ネレイの漁師', dir: '北', done: 'isles_siren_heard' });
  lead('l_opt_crab', { kind: 'rumor', title: '歩く宝箱', text: '東の小島で、宝箱が歩いていたと\n子どもが言う。貝がらの山が\n光っていたとも。', from: 'コーラルの子ども', dir: '東', done: 'isles_crab_seen' });

  // ---------------------------------------------------------------- 読み物（STORY_BIBLE §10.2 の 23〜25 ほか）
  const lore = (id, o) => R.def('lore', id, Object.assign({ region: 'r_isles' }, o));
  lore('lo_ev_isles', { title: '墨の写しと白い日誌', kind: 'main', must: true,
    text: 'グレン船長の航海日誌は、途中から白い。\n字が消えたのではない。はじめから\n何も書かれなかったように白い。\n\nマリナの家の墨の写しは、同じ日誌を\n六十年前に写した物だ。こちらは\n最後の一行まで、字が残っている。\n\n表紙の裏に「写　記録院マレア分室\n写し手 アルノ（ロアの語り部）」。\n\n記録院は、もとは守る側だった。\n語り部も、記録院で書いていた。\n同じ写しという仕事が、六十年前は\n残すために、去年は消すために\n使われた。' });
  lore('lo_time_isles', { title: 'マリナの朝日', kind: 'main', must: true,
    text: 'マリナは、六十年前にグレンが\n「朝日の中を」出ていったことを\nはっきり覚えている。\n\n海の向こうが白んで、\n次に金色の線が走って、\nそれから水が一面、桃色に染まる。\n――マリナの話した朝日の色。\n\nけれど、いつ朝が消えたのかは\n言えない。「ついこのあいだまで、\nあったような気がするんだけどね」' });
  lore('lo_war_isles', { title: '後家の壁', kind: 'region', must: false,
    text: 'コーラルの港の下の段の擁壁には、\n帰らなかった水夫の名が刻まれている。\n名の横には、色のあせたリボン。\n\n港の底には、沈んだ軍船の帆柱が\n二本見える。二十年前、火の鳥の\n同盟の船団を出したときの物だと\n年寄りは言う。\n\nけれど、どの戦で、何のために\n死んだのかは、誰も言えない。\n「太陽は東の海から来る船。\n灯台がそれを導く」――それを\n証すための戦だった、とだけ。' });
  lore('lo_isles_shanty', { title: 'グレンの舟歌', kind: 'region', must: false,
    text: '♪　霧の海でも、迷いはしない\n岬の灯が、おれを呼ぶから\n♪　帆をたたむのは、朝日の港\n待つ人の歌が、おれを呼ぶから\n\n六十年前から、諸島の船乗りが\n霧の晩に歌ってきた舟歌。\n互いの船の場所を、歌で知らせた。\n去年から、誰も続きを歌えなかった。' });

  // ---------------------------------------------------------------- 年代記の章（E14。選択で文が変わる）
  R.def('chronicle', 'r_isles', {
    title: '帰らずの船長',
    get text() {
      const ok = (c) => c == null || (R.Game && R.State && R.State.check ? R.State.check(c) : false);
      return this.parts.filter((p) => ok(p.cond)).map((p) => p.text).join('\n');
    },
    parts: [
      { text: 'マレア諸島の霧の晩、青い鬼火をともした幽霊船が\n船を岩礁へ誘っていた。{hero}は自分の船で霧を追った。' },
      { cond: { choice: 'ch_isles_wreck', is: 'help' }, text: '座礁した商船では、小舟を三度出して、船員たちを\n残らず浜へ運んだ。' },
      { cond: { choice: 'ch_isles_wreck', is: 'cargo' }, text: '座礁した商船では、流れ出た積荷を拾い集めた。\n船員たちは、自分たちで浜へ上がった。' },
      { cond: 'isles_siren_heard', text: '人魚の歌う岩で、舟歌の後半の節を聞いた。' },
      { text: 'ネレイのマリナが夜の桟橋で歌い、霧の中から船が来た。\n船長室で、{hero}は舟歌の続きを語った。' },
      { cond: { choice: 'ch_isles_write', is: 'story' }, text: '帰らずの船長は、六十年ののちに帰った。\n地平が白むころ、桟橋で、待っていた人のもとへ。' },
      { cond: { choice: 'ch_isles_write', is: 'pain' }, text: '帰らずの船長は、六十年ののちに帰った。\n……ともに沈んだ者たちの名を、ここに記す。' },
      { cond: [{ choice: 'ch_isles_write', is: 'pain' }, 'isles_tag_1'], text: '甲板長トビアス' },
      { cond: [{ choice: 'ch_isles_write', is: 'pain' }, 'isles_tag_2'], text: '帆手のルカ' },
      { cond: [{ choice: 'ch_isles_write', is: 'pain' }, 'isles_tag_3'], text: '見張りのサム' },
      { cond: [{ choice: 'ch_isles_write', is: 'pain' }, 'isles_tag_4'], text: '舵取りのオーウェン' },
      { cond: [{ choice: 'ch_isles_write', is: 'pain' }, 'isles_tag_5'], text: '船大工のヨナス' },
      { cond: [{ choice: 'ch_isles_write', is: 'pain' }, 'isles_tag_6'], text: '見習いのベッポ' },
      { cond: 'cleared_r_isles', text: 'グレンの船の灯は橙に戻り、沖の灯台島へ渡ってともった。' },
    ],
  });
})(window.RPG);
