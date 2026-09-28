// 雪原（ユール・白竜の峰・寄り道）の共通のデータと小道具。WORLD_REDESIGN §4.3・§3.2〜§3.5・§4.9、STORY_BIBLE §7.3・§8.4・§10
//   R.DB.leads      雪原の手がかり（地方 5・依頼 7・寄り道のうわさ 5・本筋 1）と、地方をまたぐつながり（HOOKS）
//   R.DB.lore       読み物（lo_ev_snow・lo_time_snow・lo_war_snow・lo_snow_epitaph・くべられなかった手紙）
//   R.DB.letters    くべられなかった手紙（拾った順で文が変わる。STORY_BIBLE §10.3）
//   R.DB.chronicle.r_snow  年代記の章「白竜と冬至の火」（語った話・守った門・竜と戦う/語る・痛みの選択で文が変わる。E14）
//   R.Snow.ev       イベントが使う小道具（tales・gates・say・narr・lore・small・tier…）
// 旗・変数: snow_*（§2.4）／ 選択 ch_snow_tale（dragon|hunter|fire_child）・ch_snow_gate_1〜3（n|e|w）・ch_snow_neve（talk|fight）・
//   ch_snow_write（pain|glory）・ch_snow_statue（dragon|wolf|hearth）
// 仲間 20 人には物語の焦点を当てない（A36）。ボイスは付けない（オーナー: 声はあとで）。録音済みの文は 1 字も変えずに地の文として置く。
(function (R) {
  'use strict';
  const S = (R.Snow = R.Snow || {});
  const X = (S.ev = S.ev || {});

  // ---------------------------------------------------------------- 祭で語る三つの昔話（村の年寄り 3 人から聞く）
  X.TALES = {
    dragon: {
      name: '竜と娘の約束', teller: 'イングリッド',
      lines: ['むかし、吹雪の峰に、\nひとりの娘が火を運んだ。', '竜は火のそばで、はじめて\n人の物語を聞いた。\n夜が明けるまで、娘は語った。', '――火と物語を、毎年届けます。\nだから、吹雪を鎮めて。', '竜はうなずき、白い翼を\n村の上に広げたという。'],
    },
    hunter: {
      name: '狼と猟師', teller: 'オラフ',
      lines: ['むかし、ひとりの猟師が、\nわなにかかった子狼を見つけた。', '猟師はわなを外し、\n子狼を群れへ帰した。', '冬の大吹雪の夜、狼の群れは\n村を囲まず、門を守った。', '恩を返したのだと、\n猟師の孫は言ったそうな。'],
    },
    fire_child: {
      name: '火を盗んだ子ども', teller: 'ブレンダ',
      lines: ['むかし、凍えた村の子どもが、\n火の鳥の巣から火をひと粒盗んだ。', '子どもは火を胸に抱いて、\n雪の上を走って帰った。', '氷の壁は、その子の通った所だけ\nとけて道になった。', '火の鳥は怒らずに、\n「分けてやれ」と鳴いたという。'],
    },
  };
  X.GATES = { n: '北の門', e: '東の門', w: '西の門' };
  X.tier = () => (R.Tier && R.Tier.get ? R.Tier.get() : 0);
  X.cleared = (ev) => ev.flag('cleared_r_snow');
  X.narr = (ev, text) => ev.say(null, text, { face: false });
  /** 読み物を書庫へ（旗 = id）。EVENTS の ev.lore があればそれ */
  X.lore = async function (ev, id) {
    if (ev.flag(id)) return false;
    if (typeof ev.lore === 'function') { ev.lore(id); return true; }
    ev.setFlag(id);
    return true;
  };
  /** ティアで量が変わる小さな品（WORLD §3.3 ⑤） */
  X.small = function (ev, table) {
    const row = table[Math.min(X.tier(), table.length - 1)];
    return row[0] === 'gold' ? ev.gold(row[1]) : ev.item(row[0], row[1]);
  };
  /** 支度の 3 つ（薪・氷の灯籠・昔話）の数 */
  X.prep = (ev) => ['snow_logs_done', 'snow_ice_done', 'snow_tales_done'].filter((f) => ev.flag(f)).length;
  /** 守らなかった門（1〜2 波で一度も守っていない門） */
  X.undefended = function (ev) {
    const d = new Set([ev.choiceOf('ch_snow_gate_1'), ev.choiceOf('ch_snow_gate_2')].filter(Boolean));
    return ['w', 'e', 'n'].filter((g) => !d.has(g));
  };
  /** STORY_BIBLE §3.5 の世代と、ティアの近況（WORLD §1.3 の表） */
  X.skyLine = function () {
    const t = X.tier();
    if (t >= 6) return 'ねえ、「あかつき」ってなに？\nばあちゃんが寝言で\n言ってたの。';
    if (t >= 4) return '近ごろ、夜の空が\nうす紫に見えるんだ。\n……気のせいじゃないよね。';
    if (t >= 2) return '近ごろ、空がちょっと\n青くないかい？';
    return null;
  };

  // ---------------------------------------------------------------- 手がかり（K.lead）
  const lead = (id, o) => R.def('leads', id, Object.assign({ region: 'r_snow' }, o));
  lead('l_snow_prep', { kind: 'region', title: '大火祭の支度', text: '村長ヨルンが、祭の支度の\n手を探している。薪・氷の灯籠・\n祭で語る昔話の三つ。', from: 'ユールの村長ヨルン', place: 'yule', done: 'snow_festival_lit' });
  lead('l_snow_book', { kind: 'region', title: '白紙の物語の本', text: '祭で読む物語の本が、\n真っ白になっていた。\n最後のページに、薄い字がある。', from: '火守りの娘ソーニャ', place: 'yule', done: 'lo_ev_snow' });
  lead('l_snow_howl', { kind: 'region', title: '吹雪の中の遠吠え', text: '夜ごと、狼の遠吠えが\n村へ近づいている。\n見張りのハルドが案じている。', from: '見張りの老人ハルド', place: 'yule', done: 'snow_siege_done' });
  lead('l_snow_peak', { kind: 'region', title: '冬至の火を峰へ', text: '籠城は明けた。冬至の火を\n火種にして、白竜の峰の\n頂へ運ぶ。', from: '火守りの娘ソーニャ', place: 'peak', done: 'cleared_r_snow' });
  lead('l_main_recorder_snow', { kind: 'main', region: 'world', title: '写されて抜けた本', text: '白紙の祭の本の最後に\n「写本・記録院ノルデン分室」。\n写されたとき、中身が抜けた？', from: '白紙の祭の本', place: 'yule', dir: '北' });
  // 依頼（side。id は依頼と同じ q_*）
  lead('q_snow_fishing', { kind: 'side', title: '氷上の釣り大会', text: '祭のあいだ、凍った池で\n釣り大会が開かれる。\n釣り小屋のトーレに声を。', from: 'ユールの掲示板', place: 'yule', done: 'snow_fish_3' });
  lead('q_snow_dog', { kind: 'side', title: '迷子のそり犬', text: 'そり犬が一匹、雪の林の\n方へ走っていったきり。\n連れ帰れば、そりが出せる。', from: 'そり犬の世話係ニルス', place: 'snow_woods', done: 'snow_dog_home' });
  lead('q_snow_statue', { kind: 'side', title: '雪像づくり', text: '雪像づくりの娘リーサが、\n像の飾りの材料を三つ\n探している。', from: '雪像づくりの娘リーサ', place: 'yule', done: 'snow_statue_done' });
  lead('q_snow_base', { kind: 'side', title: '子どもの秘密基地', text: '雪の土手の奥に、子どもの\n秘密基地がある。合言葉が\n要るらしい。', from: '村の子', place: 'yule', done: 'snow_base_open' });
  lead('q_snow_lamps', { kind: 'side', title: '峠の道しるべ', text: 'ユールから峠の宿への道の\n灯籠が三つ消えている。\n冬至の火を分けて回る。', from: 'ソーニャ', place: 'pass_inn', dir: '東', done: 'snow_lamps_done' });
  lead('q_pass_bath', { kind: 'side', title: '凍った湯のくみ口', text: '峠の宿の湯殿のくみ口が\n凍りついた。火のつぼが\nひとつあればとけるという。', from: '峠の宿の湯の番', place: 'pass_inn', done: 'pass_inn_bath_done' });
  lead('q_snow_ingrid', { kind: 'side', title: '語りの年寄りたち', text: '祭で語る昔話は、村の\n年寄り三人が知っている。\nイングリッド・オラフ・ブレンダ。', from: 'ヨルン', place: 'yule', done: 'snow_tales_done', offer: ['!snow_festival_lit', '!snow_siege_done', '!snow_finale_done'] });   // offer: ヨルンが頼むのは祭の支度の間だけ（R.Leads.offerOf）
  // 寄り道のうわさ（rumor）
  lead('l_opt_icicle', { kind: 'rumor', title: '氷の中の宝箱', text: '西の崖の洞で、氷の中に\n宝箱が閉じこめられている\nのを見た者がいる。', from: 'ユールの泊まり客', place: 'icicle', dir: '西', done: { visited: 'icicle_2' } });
  lead('l_opt_pass_inn', { kind: 'rumor', title: '峠の湯気', text: '東の峠の上に、湯気の立つ\n宿がある。旅人の休み処だ。', from: 'ユールの旅の商人', place: 'pass_inn', dir: '東', done: { visited: 'pass_inn' } });
  lead('l_opt_aurora', { kind: 'rumor', title: '七色に揺れる崖', text: '凍った湖の向こう、北の流氷原に、\n空が七色に揺れる崖がある。\n湖は、今年は氷が薄い。', from: '旅の吟遊詩人', place: 'aurora', dir: '北', done: { visited: 'aurora' } });
  lead('l_opt_frost_ship', { kind: 'rumor', title: '氷の中の帆柱', text: '流氷原の氷の中に、帆柱が\n立っている。百年帰らぬ船団の\n長が眠るという。――危険。', from: '峠の宿の吟遊詩人', place: 'frost_ship', dir: '北', done: 'snow_admiral' });
  lead('l_snow_fox', { kind: 'rumor', title: '青白く光る足あと', text: '峠の道に、青白く光る\n獣の足あと。氷尾ギツネは\n峰の上か、流氷原にいるらしい。', from: '峠の道', place: 'aurora', dir: '北', done: { any: ['snow_aurora_seen', { var: 'snow_fox_kills', gte: 1 }] } });

  // ---------------------------------------------------------------- 地方をまたぐつながり（WORLD §4.9、STORY_BIBLE §8.10）。データで印を付ける
  //   ほかの地方ができたとき、その地方の担当がここの旗と選択を読む（雪原の側は旗を立てるだけ）
  S.HOOKS = {
    // 「火を盗んだ子ども」を語った → 灰の闘技場の壁画の一枚と同じ話（両方を見ると灰の最後の語りに 1 行足す）
    ash_mural: { region: 'r_ash', cond: { choice: 'ch_snow_tale', is: 'fire_child' }, flag: 'hook_snow_fire_child' },
    // ピムの語り部修行: 雪原を解決したあと、ユールの宿の机で手紙を書く（var forest_pim_letters +1、旗 forest_pim_letter_snow）
    pim_poet: { region: 'r_forest', cond: ['cleared_r_snow', 'forest_pim_poet'], flag: 'forest_pim_letter_snow', var: 'forest_pim_letters' },
    // 名前を忘れた人々: 雪原の解決でユラの村人がひとり名を思い出し、ユールへ帰る（旗 yura_snow_home を ユラの担当が立てる）
    yura_names: { region: 'r_forest', cond: 'cleared_r_snow', flag: 'yura_snow_home', npc: 'yule:yura_returnee' },
    // 行商人ロッタの旅: 雪原の名物（毛皮）を運ぶ配達の 1 つ（旗 lotta_fur を ロッタの担当が読む）
    lotta: { region: 'world', item: 'hd_yeti_fur', flag: 'lotta_snow_fur' },
    // 鉱山の「誓い」の道: ドヴァン ⇔ 雪原の近道（WORLD §2.5）。峠の宿の東の崖崩れの番人の所に出る
    mine_shortcut: { region: 'r_mine', at: { map: 'world', lx: 90, ly: 31 } },   // 論理の座標 L（WORLD v3: 使うときに R.WorldXform.fill(R.DB.maps.world, at) で W の x, y）
  };

  // ---------------------------------------------------------------- 手紙（K.letter）: くべられなかった手紙（拾った順で n 通目。灯の数 n−1 以上で読める）
  const LZ = {
    2: ['ミラへ。おまえの家で預かっていた\n子が、歩きました。', 'あの子の母親のことは、\nあの子には話さずにおきます。', '語り部の歌が、あの子まで\n連れていかないように。'],
    3: ['ミラへ。おまえの顔を写しました。\n朝のたびに（いや、朝はもうない\nのでした）、思い出して苦しいからです。', '肖像画は掛けておきます。\nこれが何の絵なのか、\nわたしはもう分かりません。'],
    4: ['ミラへ。本の中の声が、\n近ごろ大きくなりました。\n「忘れたいのだろう」と。', '忘れたいのです。けれど、\nおまえを失いたくはない。\nどちらも本当です。'],
    5: ['ミラへ。名を捨てたいという人たちが、\n院に来るようになりました。', 'わたしは断りませんでした。\n名が重いことを、わたしは\n知っているから。'],
    6: ['ミラへ。ビブリアが白くなっていきます。\n写し手が、写したものを\n忘れていくからです。', 'わたしも、いずれそうなるでしょう。\nそれが救いなのです。'],
    7: ['ミラへ。あの子のいない朝を、\n誰にも迎えさせたくなかった。', 'わたしがしたのは、\nそれだけです。'],
    8: ['ミラへ。本が言います。\n八つの伝承も写せ、と。', 'そうすれば、もう誰も、\n何も失わずに済む。', '……ミラ。おまえは、何と言うだろう。\nわたしには、もうおまえの声が\n思い出せない。'],
  };
  /**
   * くべられなかった手紙（STORY_BIBLE §10.3）: 拾った順に n 通目（lo_lz_n）。森の 1 通目は lo_lz_1 で固定。
   * 砂漠の組と同じ番号の組（lo_lz_2〜8・letter_lz_2〜8）を共有し、無ければここで足す。
   * n 通目は灯の数が n−1 以上で読める。→ n
   */
  for (let n = 2; n <= 8; n++) {
    if (!R.DB.letters['letter_lz_' + n]) R.def('letters', 'letter_lz_' + n, { from: '（差出人の名はない）', title: 'くべられなかった手紙', text: LZ[n] });
    if (!R.DB.lore['lo_lz_' + n]) R.def('lore', 'lo_lz_' + n, { title: 'くべられなかった手紙', region: 'world', kind: 'main', must: false, order: n, letter: 'letter_lz_' + n, text: '記録官が置き忘れた手紙。\n宛名は「ミラへ」。差出人の名はない。' });
  }
  X.lz = async function (ev) {
    let n = ev.var('snow_lz');
    if (!n) { n = 2; while (n < 8 && ev.flag('lo_lz_' + n)) n++; ev.setVar('snow_lz', n); }
    await X.lore(ev, 'lo_lz_' + n);
    if (X.tier() >= n - 1) await ev.letter('letter_lz_' + n);
    else await ev.say(null, ['封を切ると、字が白く抜けていた。\n「ミラへ」――宛名のほかは、\n読めない。', '（灯がもう少し戻れば、\n読めるようになるかもしれない）']);
    return n;
  };

  // ---------------------------------------------------------------- 読み物（STORY_BIBLE §10.2 の 16〜19・手紙）
  const lore = (id, o) => R.def('lore', id, Object.assign({ region: 'r_snow' }, o));
  lore('lo_ev_snow', { title: '白紙の祭の本', kind: 'main', must: true, text: '大火祭で読む物語の本。\n中身はすべて白い。最後のページに、\n薄い字で「写本・記録院ノルデン分室」。' });
  lore('lo_time_snow', { title: '夜数えの板', kind: 'main', must: true, text: '火守りの家が、ひと晩ごとに\n刻みを入れてきた板。\n刻みは七千三百あまり。二十年ぶんだ。' });
  lore('lo_war_snow', { title: '焼けた北門', kind: 'region', must: false, text: '北門の柱は新しい。\n二十年前に焼かれたという。\nハルドは、何と戦ったかを言えない。' });
  lore('lo_snow_epitaph', { title: '竜の峰の碑文', kind: 'region', must: false, text: '「いつか朝が来なくなっても、\n朝は壊れたのではない。\nめくられなくなっただけ」' });
  lore('lo_aurora_legend', { title: '崖の書き付け', kind: 'region', must: false, text: '「光の紋章を掲げた三人が、\n北の果ての空の下を越えていった」\n――ずっと昔の、別の大陸の話。' });

  // ---------------------------------------------------------------- 年代記の章（E14。選択で文が変わる）
  R.def('chronicle', 'r_snow', {
    title: '白竜と冬至の火',
    get text() {
      const ok = (c) => c == null || (R.Game && R.State && R.State.check ? R.State.check(c) : false);
      return this.parts.filter((p) => ok(p.cond)).map((p) => p.text).join('\n');
    },
    parts: [
      { text: '吹雪のやまない冬至に、\nユールの人々は大火祭を開いた。' },
      { cond: { choice: 'ch_snow_tale', is: 'dragon' }, text: '語り部の見習いは、火の前で\n「竜と娘の約束」を語った。' },
      { cond: { choice: 'ch_snow_tale', is: 'hunter' }, text: '語り部の見習いは、火の前で\n「狼と猟師」を語った。' },
      { cond: { choice: 'ch_snow_tale', is: 'fire_child' }, text: '語り部の見習いは、火の前で\n「火を盗んだ子ども」を語った。' },
      { cond: { choice: 'ch_snow_write', is: 'glory' }, text: 'ユールの人々は大火祭の夜、\n氷の狼を退け……。' },
      { cond: { choice: 'ch_snow_write', is: 'pain' }, text: '大火祭の夜、氷の狼が村を囲んだ。\n守れなかった門があった。そこで\n壊れたもののことも、ここに記す。' },
      { cond: { choice: 'ch_snow_neve', is: 'talk' }, text: '白竜は、戦わずに物語を聞き、\n凍った心をとかした。' },
      { cond: { choice: 'ch_snow_neve', is: 'fight' }, text: '白竜と刃を交え、\nその心の氷を砕いた。' },
      { cond: 'cleared_r_snow', text: '頂に冬至の火がともり、\n空いっぱいにオーロラが揺れた。' },
    ],
  });

  // ---------------------------------------------------------------- 雪原の BGM（ワールドの雪原の範囲 = tools/gen_world_snow.js の箱）
  //   入ると ice、出ると overworld（砂漠と同じく 'step' と 'map:enter' で切り替える。砂漠の範囲とは重ならない）
  const inSnow = (x, y) => x >= 8 && x <= 93 && y >= 1 && y <= 48;
  let cur = null;
  function snowBgm(e) {
    try {
      const pos = R.Field && R.Field.pos;
      if (!pos || pos.map !== 'world' || !R.Audio || !R.Audio.bgm) { cur = null; return; }
      const [lx, ly] = R.WorldXform ? R.WorldXform.lcell(R.DB.maps.world, pos.x, pos.y) : [pos.x, pos.y];   // 箱は論理の座標 L（WORLD v3）
      const want = inSnow(lx, ly) ? 'ice' : cur === 'ice' ? 'overworld' : null;
      if (!want || want === cur) return;
      if (R.Engine && R.Engine.top && R.Engine.top() && R.Engine.top().id === 'battle') return;
      cur = want === 'overworld' ? null : want;
      R.Audio.bgm(want, { fade: e === 'enter' ? 0 : 900 });
    } catch (err) { /* 音が無くても止めない */ }
  }
  // 録音の曲が無いとき（node・--slice でない版）の代わりの曲
  R.onData(function () {
    const F = R.Audio && R.Audio.FALLBACK && R.Audio.FALLBACK.bgm;
    if (F) for (const [k, v] of [['yule', 'village'], ['bonfire', 'legend'], ['siege', 'tension'], ['ice', 'overworld'], ['ghost', 'cave']]) if (!F[k]) F[k] = v;
  });
  if (R.on) {
    R.on('step', () => snowBgm('step'));
    R.on('map:enter', () => { cur = null; snowBgm('enter'); });
    R.on('battle:end', () => { cur = null; });
  }
})(window.RPG);
