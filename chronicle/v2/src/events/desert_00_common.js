// CONTENT（砂漠）: ザハラ砂漠の共通のデータと小道具（WORLD_REDESIGN §4.2・§3、STORY_BIBLE §7.2・§8.3・§10）。
//   R.DB.leads   砂漠の手がかり（地方 7・依頼 6・寄り道のうわさ 5・宝の地図 3）と本筋の 2 行（記録院の物証・名を呼んだ夜の余白）
//   R.DB.lore    読み物（lo_ev_desert lo_time_desert lo_war_desert lo_desert_spring_letters lo_desert_king_song と、ラザロの手紙 2〜8 の器）
//   R.DB.letters ラザロの手紙 2〜8（拾った順、STORY_BIBLE §10.3。無ければここで置く。森の 1 通目は CONTENT-F）
//   R.DB.chronicle.r_desert  年代記の章「名を売った王」（選択で変わる。E14）
//   R.Desert.ev: lore()・small()・lz()（くべられなかった手紙の n 通目）・glyphs()・hawk() …（イベントのファイルが使う）
//   砂漠の BGM: ワールドの砂漠の範囲に入ると desert、出ると overworld（ワールドは 1 枚なので 'step' と 'map:enter' で切り替える）
// 旗・変数（§2.4 の決まり）: desert_* ／ 選択 ch_desert_hawk（fight|water|pay）・ch_desert_route（short|long）・ch_desert_write（pain|legend）
// 仲間 20 人には物語の焦点を当てない（A36）: 砂漠のイベントは仲間の名前を 1 つも出さない。ボイスは使わない（オーナーの指示: 声はあとで）。
(function (R) {
  'use strict';
  const D = (R.Desert = R.Desert || {});
  const X = (D.ev = D.ev || {});

  // ---------------------------------------------------------------- 王をたたえる歌（ナディア。名の所だけ歌えない → 解決で最後まで）
  X.SONG_BLANK = '♪　砂の海に　水を招いた王よ\n♪　その名は――　……\n♪　夕べの祈りに　とこしえに';
  X.SONG_FULL = '♪　砂の海に　水を招いた王よ\n♪　その名はハザル　日輪の友\n♪　夕べの祈りに　とこしえに';
  // ザイードの星の歌（野営地ごとに 1 つ）
  X.STARS = [
    '♪　北のくぎ星　動かぬ星よ\n♪　迷う隊商の　くいとなれ',
    '♪　七つの泉星　ひしゃくを傾け\n♪　夜のしずくを　砂にまけ',
    '♪　地の果ての　白む星よ\n♪　……祖母は　「夜明けの星」と呼んだ',
  ];

  X.tier = () => ((R.Tier && R.Tier.get) ? R.Tier.get() : 0);
  /** 読み物を書庫へ（旗 = id） */
  X.lore = async function (ev, id) {
    if (ev.flag(id)) return false;
    if (typeof ev.lore === 'function') return ev.lore(id);
    ev.setFlag(id);
    return true;
  };
  /** ティアで量が変わる小さな品（WORLD §3.3 ⑤）。table = [[id, n] × ティア] */
  X.small = function (ev, table) { const row = table[Math.min(X.tier(), table.length - 1)]; return ev.item(row[0], row[1]); };
  X.gold = (base) => Math.round(base * (1 + X.tier() * 0.6));
  /** 名の刻み石の数 */
  X.glyphs = (ev) => ['k_desert_glyph_ha', 'k_desert_glyph_za', 'k_desert_glyph_ru'].filter((k) => ev.has(k)).length;
  X.hawk = (ev) => ev.choiceOf('ch_desert_hawk') || null;
  /**
   * くべられなかった手紙（STORY_BIBLE §10.3）: 拾った順に n 通目。森の 1 通目は CONTENT-F が lo_lz_1 に固定しているので、
   * ここでは 2 以上の空いている番号を使う。n 通目は灯の数が n−1 以上で読める（それまでは字が白く抜けている）。→ n
   */
  X.lz = async function (ev) {
    let n = ev.var('desert_lz');
    if (!n) { n = 2; while (n < 8 && ev.flag('lo_lz_' + n)) n++; ev.setVar('desert_lz', n); }
    const id = 'lo_lz_' + n;
    await X.lore(ev, id);
    if (X.tier() >= n - 1) await ev.letter('letter_lz_' + n);
    else await ev.say(null, ['封を切ると、字が白く抜けていた。\n「ミラへ」――宛名のほかは、\n読めない。', '（灯がもう少し戻れば、\n読めるようになるかもしれない）']);
    return n;
  };

  // ---------------------------------------------------------------- 手がかり（K.lead）
  const lead = (id, o) => R.def('leads', id, Object.assign({ region: 'r_desert' }, o));
  lead('l_desert_caravan', { kind: 'region', title: '隊商の護衛', text: '隊商の長ザイードが、王墓のオアシス\nへ供え物を運ぶ隊の護衛を探している。\n隊商ギルドで。', from: 'カシムの隊商ギルド', place: 'kasim', done: 'desert_camp3_done' });
  lead('l_desert_spring', { kind: 'region', title: '枯れる泉', text: 'カシムの泉が枯れかけている。\n泉の底に、読めない古い文字が\nあるという。', from: '泉の番人の娘ファラ', place: 'kasim', done: 'cleared_r_desert' });
  lead('l_desert_song', { kind: 'region', title: '名の歌えない歌', text: '踊り子ナディアの王の歌は、\n王の名の所だけが歌えない。\n名は、王墓の石に刻まれていたか。', from: '踊り子ナディア', place: 'kasim', done: 'cleared_r_desert' });
  lead('l_desert_glyphs', { kind: 'region', title: '墓守の像の文字', text: '王墓の墓守の像の台座に、\n王の名が一文字ずつ刻まれている、\nとアブルは言う。', from: '王墓の番アブル', place: 'tomb', done: { all: [{ item: 'k_desert_glyph_ha' }, { item: 'k_desert_glyph_za' }, { item: 'k_desert_glyph_ru' }] }, hideWhen: 'cleared_r_desert' });
  lead('l_desert_tomb', { kind: 'region', title: '王墓の奥', text: '王墓のオアシスの古い泉のそばに、\n名なき王の墓がある。\n泉の火は、その奥で消えかけている。', from: '王墓のオアシス', place: 'tomb', done: 'cleared_r_desert' });
  lead('l_desert_hawks', { kind: 'region', title: '砂の鷹', text: '隊商路に、水を奪う盗賊\n「砂の鷹」が出るという。\n夜、鷹の笛が聞こえたら用心。', from: 'カシムの西の門番', place: 'kasim', dir: '西', done: 'desert_hawk_met' });
  lead('l_desert_sundial', { kind: 'region', title: '砂に埋もれた日時計', text: '広場のすみの古い日時計。\n影の刻みの溝に、長い年月の砂が\nたまっているという。', from: '日時計のじいさま', place: 'kasim', done: 'lo_time_desert' });
  // 依頼（side）
  lead('q_kasim_anklet', { kind: 'side', title: '踊り子の足鈴', text: 'ナディアが銀の足鈴を失くした。\n市場の子どもが拾ったらしいが、\nただでは返してくれないようだ。', from: '踊り子ナディア', place: 'kasim', done: 'desert_anklet_done' });
  lead('q_kasim_dig', { kind: 'side', title: '井戸掘りの手伝い', text: '井戸掘りの親方オマルが、町の外の\n砂地を三か所掘ってほしいという。\n水脈の当たりを探す。', from: '井戸掘りの親方', place: 'kasim', done: 'desert_dig_done' });
  lead('q_kasim_camel', { kind: 'side', title: '迷子のラクダ', text: 'ギルドのラクダが一頭、\n砂丘へ迷い出た。南東の砂丘で\n見たという話がある。', from: '隊商ギルドの帳場', place: 'kasim', dir: '南東', done: 'desert_camel_done' });
  lead('q_kasim_beacons', { kind: 'side', title: '隊商路ののろし', text: '隊商路ののろし台が三つ消えている。\n黒い泉の油を運べば、\nまた火がともるという。', from: '灯守組合のタデオ', place: 'kasim', dir: '西', done: 'desert_beacons_done' });
  lead('q_kasim_salt', { kind: 'side', title: '塩の包みを宿場へ', text: '塩売りのカリムから、宿場「砂の縁」\nの行商人ロッタへ塩の包みを\n届けてほしいと頼まれた。', from: '塩売りのカリム', place: 'sandedge', dir: '北', done: 'desert_salt_done' });
  lead('q_kasim_maps', { kind: 'side', title: '地図屋の宝の地図', text: '地図屋のヤズが、古い宝の地図を\n売っている。灯が戻るたびに、\n読める地図が増えるらしい。', from: '地図屋のヤズ', place: 'kasim', hideWhen: false });
  // 寄り道のうわさ（rumor）
  lead('l_opt_sandedge', { kind: 'rumor', title: '街道のまん中の宿', text: '森と砂漠と灰の街道のまん中に、\n宿場「砂の縁」がある。\n泉の水が甘いという。', from: 'カシムの宿の泊まり客', place: 'sandedge', dir: '北', done: { visited: 'sandedge' } });
  lead('l_opt_mirage', { kind: 'rumor', title: 'しんきろうの市', text: '消灯の刻にだけ、砂の真ん中に\n灯りの列と市のにぎわいが\n揺れるという。', from: 'カシムの宿のおかみ', place: 'kasim', dir: '南西', done: { visited: 'desert_mirage' } });
  lead('l_opt_temple', { kind: 'rumor', title: '沈んだ柱の浜', text: '南の浜の砂から、見たことのない\n柱の先が出ている。満月の晩、\n柱が増えるという。', from: '日焼けした男', place: 'kasim', dir: '南', done: { visited: 'desert_temple_1' } });
  lead('l_opt_rocks', { kind: 'rumor', title: '動く岩', text: '北の岩場で、岩が動いた、と\n隊商が言う。うろこが虹色に\n光っていたとか。', from: 'カシムの酒場', place: 'rocks', dir: '北', done: { visited: 'desert_rocks' } });
  lead('l_opt_hawknest', { kind: 'rumor', title: '岩の台地の鷹の笛', text: '町の西の岩の台地から、夜ごと\n鷹の笛が聞こえる。\n砂の鷹のねぐらかもしれない。', from: 'カシムの門番', place: 'hawks', dir: '西', done: { visited: 'desert_hawks_1' } });
  // 宝の地図（地方をまたぐ。行き先はまだ語られていない土地の中＝slice:'locked'。WORLD §2.8）
  lead('l_tmap_3', { kind: 'map', title: '宝の地図・その3', text: '灰の荒野の、折れた剣の碑。\n下の段の封じの扉の奥に、\n羽ペンの紋の宝があるという。', from: '宝の地図・その3', region: 'r_ash', dir: '南東', slice: 'locked' });
  lead('l_tmap_5', { kind: 'map', title: '宝の地図・その5', text: '西の外洋の霧、百の帆柱の立つ\n船の墓場。三本目の帆柱の船の\n船倉に、封じの扉。', from: '宝の地図・その5', region: 'world', dir: '西の海', slice: 'locked' });
  lead('l_tmap_6', { kind: 'map', title: '宝の地図・その6', text: 'にじんで読めない地図。\n星のかけらがあれば\n読めるという。', from: '宝の地図・その6', region: 'world', dir: '？', slice: 'locked' });
  // 本筋（main）: 記録院の物証（拓本の跡）と、名を呼んだ夜の余白（STORY_BIBLE §7.2 の 3）
  R.def('leads', 'l_main_recorder_desert', { kind: 'main', region: 'world', title: '拓本の跡', from: '王墓の王の間', place: 'tomb',
    text: '王の間の壁に、紙の繊維と墨の跡。\n「記録院の写し・第八十二号」。\n王の名が石から消えたのは、写された後。' });
  R.def('leads', 'l_main_margin_named', { kind: 'main', region: 'world', title: '名を呼んだ夜', from: '手がかり帳の余白',
    text: '名を呼ばれて、王は眠れた。\n……名は、眠りのためにも\nあるのかもしれない。' });

  // ---------------------------------------------------------------- 読み物（STORY_BIBLE §10.2 の 13〜15 ほか）
  const lore = (id, o) => R.def('lore', id, Object.assign({ region: 'r_desert' }, o));
  lore('lo_ev_desert', { title: '拓本の跡', kind: 'main', must: true, text: '王の間の石板に、紙の繊維と墨の跡。\n札が一枚、砂に落ちていた。\n「記録院の写し・第八十二号」' });
  lore('lo_time_desert', { title: '砂に埋もれた日時計', kind: 'main', must: true, text: '影の刻みの溝に、二十年分の砂。\nギルドの帳面の「日の出の祈り」の欄は、\n光暦二九二年の冬で終わっている。' });
  lore('lo_war_desert', { title: '名の削れた碑', kind: 'region', must: false, text: '岩の井戸の、日輪同盟の戦没者の碑。\n名は風に削られて、一つも読めない。\n碑の裏に「日輪は王の火なり」。' });
  lore('lo_desert_spring_letters', { title: '泉の底の古い文字', kind: 'region', must: false, text: '枯れた泉の底の石に、古い字。\n「……の火を、泉に預く。\n名を呼ぶかぎり、火は消えず」' });
  lore('lo_desert_camp_notes', { title: '前の隊商の書き付け', kind: 'region', must: false, text: '古い野営跡の板きれ。\n「嵐の晩、王墓の方角に灯りの列。\n近づくと消えた。市の声がした」' });
  // くべられなかった手紙 2〜8（森の 1 通目は forest_00_common.js。拾った順に年が進む）
  const LZ = {
    2: ['ミラへ。おまえの家で預かっていた\n子が、歩きました。', 'あの子の母親のことは、\nあの子には話さずにおきます。', '語り部の歌が、あの子まで\n連れていかないように。'],
    3: ['ミラへ。おまえの顔を写しました。\n朝のたびに（いや、朝はもうない\nのでした）、思い出して苦しいからです。', '肖像画は掛けておきます。\nこれが何の絵なのか、\nわたしはもう分かりません。'],
    4: ['ミラへ。本の中の声が、\n近ごろ大きくなりました。\n「忘れたいのだろう」と。', '忘れたいのです。けれど、\nおまえを失いたくはない。\nどちらも本当です。'],
    5: ['ミラへ。名を捨てたいという人たちが、\n院に来るようになりました。', 'わたしは断りませんでした。\n名が重いことを、わたしは\n知っているから。'],
    6: ['ミラへ。ビブリアが白くなっていきます。\n写し手が、写したものを\n忘れていくからです。', 'わたしも、いずれそうなるでしょう。\nそれが救いなのです。'],
    7: ['ミラへ。あの子のいない朝を、\n誰にも迎えさせたくなかった。', 'わたしがしたのは、\nそれだけです。'],
    8: ['ミラへ。本が言います。\n八つの伝承も写せ、と。', 'そうすれば、もう誰も、\n何も失わずに済む。', '……ミラ。おまえは、何と言うだろう。\nわたしには、もうおまえの声が\n思い出せない。'],
  };
  for (let n = 2; n <= 8; n++) {
    if (!R.DB.letters['letter_lz_' + n]) R.def('letters', 'letter_lz_' + n, { from: '（差出人の名はない）', title: 'くべられなかった手紙', text: LZ[n] });
    if (!R.DB.lore['lo_lz_' + n]) R.def('lore', 'lo_lz_' + n, { title: 'くべられなかった手紙', region: 'world', kind: 'main', must: false, order: n, letter: 'letter_lz_' + n, text: '記録官が置き忘れた手紙。\n宛名は「ミラへ」。差出人の名はない。' });
  }
  R.def('letters', 'letter_desert_nadia', { from: 'ナディア', title: '王の歌（写し）', text: ['砂の海に　水を招いた王よ\nその名はハザル　日輪の友\n夕べの祈りに　とこしえに', '（すみに小さく）\nこんどは、名前を忘れないように。\n書いて、歌って、また書くね。'] });

  // ---------------------------------------------------------------- 年代記の章（E14）
  R.def('chronicle', 'r_desert', {
    title: '名を売った王',
    get text() {
      const ok = (c) => c == null || (R.Game && R.State && R.State.check ? R.State.check(c) : false);
      return this.parts.filter((p) => ok(p.cond)).map((p) => p.text).join('\n');
    },
    parts: [
      { text: 'オアシスの泉が枯れかけた年のこと。\n語り部の見習いは、隊商を守って\n三つの夜を砂漠で越えた。' },
      { cond: { choice: 'ch_desert_hawk', is: 'fight' }, text: '岩の井戸では、砂の鷹と剣を交えた。' },
      { cond: { choice: 'ch_desert_hawk', is: 'water' }, text: '岩の井戸では、砂の鷹と水を分け合った。' },
      { cond: { choice: 'ch_desert_hawk', is: 'pay' }, text: '岩の井戸では、砂の鷹に通行料を払った。' },
      { cond: { choice: 'ch_desert_route', is: 'short' }, text: '砂嵐のくぼ地を、星を頼りに抜けた。' },
      { cond: { choice: 'ch_desert_route', is: 'long' }, text: '嵐を避け、西の浜を遠回りした。' },
      { cond: 'desert_named', text: '王の間で、見習いは戦いの中で王の名を呼んだ。' },
      { cond: { choice: 'ch_desert_write', is: 'legend' }, text: '砂の鷹と呼ばれる盗賊が隊を襲い、\n王はその名を取り戻した。' },
      { cond: { choice: 'ch_desert_write', is: 'pain' }, text: '砂の鷹は、かつて王の火のために\n戦った兵たちだった。\n誰も、何のための戦かを覚えていない。' },
      { cond: 'cleared_r_desert', text: '古い泉の底に、日輪の火がともった。' },
    ],
  });

  // ---------------------------------------------------------------- 砂漠の BGM（ワールドの範囲。地名の札と同じ矩形）
  const inDesert = (x, y) => x >= 8 && x <= 95 && y >= 121 && y <= 166;
  let cur = null;
  function desertBgm(e) {
    try {
      const pos = R.Field && R.Field.pos;
      if (!pos || pos.map !== 'world' || !R.Audio || !R.Audio.bgm) { cur = null; return; }
      const want = inDesert(pos.x, pos.y) ? 'desert' : 'overworld';
      if (!want || want === cur) return;
      if (R.Engine && R.Engine.top && R.Engine.top() && R.Engine.top().id === 'battle') return;
      cur = want;
      R.Audio.bgm(want, { fade: e === 'enter' ? 0 : 900 });
    } catch (err) { /* 音が無くても止めない */ }
  }
  // 録音の曲が無いとき（node・--slice でない版）の代わりの曲
  R.onData(function () {
    const F = R.Audio && R.Audio.FALLBACK && R.Audio.FALLBACK.bgm;
    if (F) for (const [k, v] of [['kasim', 'town'], ['desert', 'overworld'], ['caravan', 'sorrow'], ['pyramid', 'dungeon']]) if (!F[k]) F[k] = v;
  });
  if (R.on) {
    R.on('step', () => desertBgm('step'));
    R.on('map:enter', () => { cur = null; desertBgm('enter'); });
    R.on('battle:end', () => { cur = null; });
  }
})(window.RPG);
