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
      name: R.T('ev.snow_00_common.TALES.dragon.name'), teller: R.T('ev.snow_00_common.TALES.dragon.teller'),
      lines: R.T('ev.snow_00_common.TALES.dragon.lines'),
    },
    hunter: {
      name: R.T('ev.snow_00_common.TALES.hunter.name'), teller: R.T('ev.snow_00_common.TALES.hunter.teller'),
      lines: R.T('ev.snow_00_common.TALES.hunter.lines'),
    },
    fire_child: {
      name: R.T('ev.snow_00_common.TALES.fire_child.name'), teller: R.T('ev.snow_00_common.TALES.fire_child.teller'),
      lines: R.T('ev.snow_00_common.TALES.fire_child.lines'),
    },
  };
  X.GATES = { n: R.T('ev.snow_00_common.GATES.n'), e: R.T('ev.snow_00_common.GATES.e'), w: R.T('ev.snow_00_common.GATES.w') };
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
    if (t >= 6) return R.T('ev.snow_00_common.skyLine.ret');
    if (t >= 4) return R.T('ev.snow_00_common.skyLine.ret_2');
    if (t >= 2) return R.T('ev.snow_00_common.skyLine.ret_3');
    return null;
  };

  // ---------------------------------------------------------------- 手がかり（K.lead）
  const lead = (id, o) => R.def('leads', id, Object.assign({ region: 'r_snow' }, o));
  lead('l_snow_prep', { kind: 'region', title: R.T('leads.l_snow_prep.title'), text: R.T('leads.l_snow_prep.text'), from: R.T('leads.l_snow_prep.from'), place: 'yule', done: 'snow_festival_lit' });
  lead('l_snow_book', { kind: 'region', title: R.T('leads.l_snow_book.title'), text: R.T('leads.l_snow_book.text'), from: R.T('leads.l_snow_book.from'), place: 'yule', done: 'lo_ev_snow' });
  lead('l_snow_howl', { kind: 'region', title: R.T('leads.l_snow_howl.title'), text: R.T('leads.l_snow_howl.text'), from: R.T('leads.l_snow_howl.from'), place: 'yule', done: 'snow_siege_done' });
  lead('l_snow_peak', { kind: 'region', title: R.T('leads.l_snow_peak.title'), text: R.T('leads.l_snow_peak.text'), from: R.T('leads.l_snow_peak.from'), place: 'peak', done: 'cleared_r_snow' });
  lead('l_main_recorder_snow', { kind: 'main', region: 'world', title: R.T('leads.l_main_recorder_snow.title'), text: R.T('leads.l_main_recorder_snow.text'), from: R.T('leads.l_main_recorder_snow.from'), place: 'yule', dir: R.T('leads.l_main_recorder_snow.dir') });
  // 依頼（side。id は依頼と同じ q_*）
  lead('q_snow_fishing', { kind: 'side', title: R.T('leads.q_snow_fishing.title'), text: R.T('leads.q_snow_fishing.text'), from: R.T('leads.q_snow_fishing.from'), place: 'yule', done: 'snow_fish_3' });
  lead('q_snow_dog', { kind: 'side', title: R.T('leads.q_snow_dog.title'), text: R.T('leads.q_snow_dog.text'), from: R.T('leads.q_snow_dog.from'), place: 'snow_woods', done: 'snow_dog_home' });
  lead('q_snow_statue', { kind: 'side', title: R.T('leads.q_snow_statue.title'), text: R.T('leads.q_snow_statue.text'), from: R.T('leads.q_snow_statue.from'), place: 'yule', done: 'snow_statue_done' });
  lead('q_snow_base', { kind: 'side', title: R.T('leads.q_snow_base.title'), text: R.T('leads.q_snow_base.text'), from: R.T('leads.q_snow_base.from'), place: 'yule', done: 'snow_base_open' });
  lead('q_snow_lamps', { kind: 'side', title: R.T('leads.q_snow_lamps.title'), text: R.T('leads.q_snow_lamps.text'), from: R.T('leads.q_snow_lamps.from'), place: 'pass_inn', dir: R.T('leads.q_snow_lamps.dir'), done: 'snow_lamps_done' });
  lead('q_pass_bath', { kind: 'side', title: R.T('leads.q_pass_bath.title'), text: R.T('leads.q_pass_bath.text'), from: R.T('leads.q_pass_bath.from'), place: 'pass_inn', done: 'pass_inn_bath_done' });
  lead('q_snow_ingrid', { kind: 'side', title: R.T('leads.q_snow_ingrid.title'), text: R.T('leads.q_snow_ingrid.text'), from: R.T('leads.q_snow_ingrid.from'), place: 'yule', done: 'snow_tales_done', offer: ['!snow_festival_lit', '!snow_siege_done', '!snow_finale_done'] });   // offer: ヨルンが頼むのは祭の支度の間だけ（R.Leads.offerOf）
  // 寄り道のうわさ（rumor）
  lead('l_opt_icicle', { kind: 'rumor', title: R.T('leads.l_opt_icicle.title'), text: R.T('leads.l_opt_icicle.text'), from: R.T('leads.l_opt_icicle.from'), place: 'icicle', dir: R.T('leads.l_opt_icicle.dir'), done: { visited: 'icicle_2' } });
  lead('l_opt_pass_inn', { kind: 'rumor', title: R.T('leads.l_opt_pass_inn.title'), text: R.T('leads.l_opt_pass_inn.text'), from: R.T('leads.l_opt_pass_inn.from'), place: 'pass_inn', dir: R.T('leads.l_opt_pass_inn.dir'), done: { visited: 'pass_inn' } });
  lead('l_opt_aurora', { kind: 'rumor', title: R.T('leads.l_opt_aurora.title'), text: R.T('leads.l_opt_aurora.text'), from: R.T('leads.l_opt_aurora.from'), place: 'aurora', dir: R.T('leads.l_opt_aurora.dir'), done: { visited: 'aurora' } });
  lead('l_opt_frost_ship', { kind: 'rumor', title: R.T('leads.l_opt_frost_ship.title'), text: R.T('leads.l_opt_frost_ship.text'), from: R.T('leads.l_opt_frost_ship.from'), place: 'frost_ship', dir: R.T('leads.l_opt_frost_ship.dir'), done: 'snow_admiral' });
  lead('l_snow_fox', { kind: 'rumor', title: R.T('leads.l_snow_fox.title'), text: R.T('leads.l_snow_fox.text'), from: R.T('leads.l_snow_fox.from'), place: 'aurora', dir: R.T('leads.l_snow_fox.dir'), done: { any: ['snow_aurora_seen', { var: 'snow_fox_kills', gte: 1 }] } });

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
    2: R.T('ev.snow_00_common.LZ.2'),
    3: R.T('ev.snow_00_common.LZ.3'),
    4: R.T('ev.snow_00_common.LZ.4'),
    5: R.T('ev.snow_00_common.LZ.5'),
    6: R.T('ev.snow_00_common.LZ.6'),
    7: R.T('ev.snow_00_common.LZ.7'),
    8: R.T('ev.snow_00_common.LZ.8'),
  };
  /**
   * くべられなかった手紙（STORY_BIBLE §10.3）: 拾った順に n 通目（lo_lz_n）。森の 1 通目は lo_lz_1 で固定。
   * 砂漠の組と同じ番号の組（lo_lz_2〜8・letter_lz_2〜8）を共有し、無ければここで足す。
   * n 通目は灯の数が n−1 以上で読める。→ n
   */
  for (let n = 2; n <= 8; n++) {
    if (!R.DB.letters['letter_lz_' + n]) R.def('letters', 'letter_lz_' + n, { from: R.T('ev.snow_00_common.letters.from'), title: R.T('ev.snow_00_common.letters.title'), text: LZ[n] });
    if (!R.DB.lore['lo_lz_' + n]) R.def('lore', 'lo_lz_' + n, { title: R.T('ev.snow_00_common.lore.title'), region: 'world', kind: 'main', must: false, order: n, letter: 'letter_lz_' + n, text: R.T('ev.snow_00_common.lore.text') });
  }
  X.lz = async function (ev) {
    let n = ev.var('snow_lz');
    if (!n) { n = 2; while (n < 8 && ev.flag('lo_lz_' + n)) n++; ev.setVar('snow_lz', n); }
    await X.lore(ev, 'lo_lz_' + n);
    if (X.tier() >= n - 1) await ev.letter('letter_lz_' + n);
    else await ev.say(null, R.T('ev.snow_00_common.lz.say'));
    return n;
  };

  // ---------------------------------------------------------------- 読み物（STORY_BIBLE §10.2 の 16〜19・手紙）
  const lore = (id, o) => R.def('lore', id, Object.assign({ region: 'r_snow' }, o));
  lore('lo_ev_snow', { title: R.T('lore.lo_ev_snow.title'), kind: 'main', must: true, text: R.T('lore.lo_ev_snow.text') });
  lore('lo_time_snow', { title: R.T('lore.lo_time_snow.title'), kind: 'main', must: true, text: R.T('lore.lo_time_snow.text') });
  lore('lo_war_snow', { title: R.T('lore.lo_war_snow.title'), kind: 'region', must: false, text: R.T('lore.lo_war_snow.text') });
  lore('lo_snow_epitaph', { title: R.T('lore.lo_snow_epitaph.title'), kind: 'region', must: false, text: R.T('lore.lo_snow_epitaph.text') });
  lore('lo_aurora_legend', { title: R.T('lore.lo_aurora_legend.title'), kind: 'region', must: false, text: R.T('lore.lo_aurora_legend.text') });

  // ---------------------------------------------------------------- 年代記の章（E14。選択で文が変わる）
  R.def('chronicle', 'r_snow', {
    title: R.T('chronicle.r_snow.title'),
    get text() {
      const ok = (c) => c == null || (R.Game && R.State && R.State.check ? R.State.check(c) : false);
      return this.parts.filter((p) => ok(p.cond)).map((p) => p.text).join('\n');
    },
    parts: [
      { text: R.T('chronicle.r_snow.parts.0.text') },
      { cond: { choice: 'ch_snow_tale', is: 'dragon' }, text: R.T('chronicle.r_snow.parts.1.text') },
      { cond: { choice: 'ch_snow_tale', is: 'hunter' }, text: R.T('chronicle.r_snow.parts.2.text') },
      { cond: { choice: 'ch_snow_tale', is: 'fire_child' }, text: R.T('chronicle.r_snow.parts.3.text') },
      { cond: { choice: 'ch_snow_write', is: 'glory' }, text: R.T('chronicle.r_snow.parts.4.text') },
      { cond: { choice: 'ch_snow_write', is: 'pain' }, text: R.T('chronicle.r_snow.parts.5.text') },
      { cond: { choice: 'ch_snow_neve', is: 'talk' }, text: R.T('chronicle.r_snow.parts.6.text') },
      { cond: { choice: 'ch_snow_neve', is: 'fight' }, text: R.T('chronicle.r_snow.parts.7.text') },
      { cond: 'cleared_r_snow', text: R.T('chronicle.r_snow.parts.8.text') },
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
