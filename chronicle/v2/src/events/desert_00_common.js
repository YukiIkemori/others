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
  X.SONG_BLANK = R.T('ev.desert_00_common.SONG_BLANK');
  X.SONG_FULL = R.T('ev.desert_00_common.SONG_FULL');
  X.SONG_VOICE = { blank: 'v_nadia_song_01', full: 'v_nadia_song_02' };   // ナディアの声（caption の voice）
  // ザイードの星の歌（野営地ごとに 1 つ）
  X.STARS = R.T('ev.desert_00_common.STARS');
  X.STARS_VOICE = ['v_zaid_song_01', 'v_zaid_song_02', 'v_zaid_song_03'];   // ザイードの声（caption の voice）

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
    else await ev.say(null, R.T('ev.desert_00_common.lz.say'));
    return n;
  };

  // ---------------------------------------------------------------- 手がかり（K.lead）
  const lead = (id, o) => R.def('leads', id, Object.assign({ region: 'r_desert' }, o));
  lead('l_desert_caravan', { kind: 'region', title: R.T('leads.l_desert_caravan.title'), text: R.T('leads.l_desert_caravan.text'), from: R.T('leads.l_desert_caravan.from'), place: 'kasim', done: 'desert_camp3_done' });
  lead('l_desert_spring', { kind: 'region', title: R.T('leads.l_desert_spring.title'), text: R.T('leads.l_desert_spring.text'), from: R.T('leads.l_desert_spring.from'), place: 'kasim', done: 'cleared_r_desert' });
  lead('l_desert_song', { kind: 'region', title: R.T('leads.l_desert_song.title'), text: R.T('leads.l_desert_song.text'), from: R.T('leads.l_desert_song.from'), place: 'kasim', done: 'cleared_r_desert' });
  lead('l_desert_glyphs', { kind: 'region', title: R.T('leads.l_desert_glyphs.title'), text: R.T('leads.l_desert_glyphs.text'), from: R.T('leads.l_desert_glyphs.from'), place: 'tomb', done: { all: [{ item: 'k_desert_glyph_ha' }, { item: 'k_desert_glyph_za' }, { item: 'k_desert_glyph_ru' }] }, hideWhen: 'cleared_r_desert' });
  lead('l_desert_tomb', { kind: 'region', title: R.T('leads.l_desert_tomb.title'), text: R.T('leads.l_desert_tomb.text'), from: R.T('leads.l_desert_tomb.from'), place: 'tomb', done: 'cleared_r_desert' });
  lead('l_desert_hawks', { kind: 'region', title: R.T('leads.l_desert_hawks.title'), text: R.T('leads.l_desert_hawks.text'), from: R.T('leads.l_desert_hawks.from'), place: 'kasim', dir: R.T('leads.l_desert_hawks.dir'), done: 'desert_hawk_met' });
  lead('l_desert_sundial', { kind: 'region', title: R.T('leads.l_desert_sundial.title'), text: R.T('leads.l_desert_sundial.text'), from: R.T('leads.l_desert_sundial.from'), place: 'kasim', done: 'lo_time_desert' });
  // 依頼（side）
  lead('q_kasim_anklet', { kind: 'side', title: R.T('leads.q_kasim_anklet.title'), text: R.T('leads.q_kasim_anklet.text'), from: R.T('leads.q_kasim_anklet.from'), place: 'kasim', done: 'desert_anklet_done' });
  lead('q_kasim_dig', { kind: 'side', title: R.T('leads.q_kasim_dig.title'), text: R.T('leads.q_kasim_dig.text'), from: R.T('leads.q_kasim_dig.from'), place: 'kasim', done: 'desert_dig_done' });
  lead('q_kasim_camel', { kind: 'side', title: R.T('leads.q_kasim_camel.title'), text: R.T('leads.q_kasim_camel.text'), from: R.T('leads.q_kasim_camel.from'), place: 'kasim', dir: R.T('leads.q_kasim_camel.dir'), done: 'desert_camel_done' });
  lead('q_kasim_beacons', { kind: 'side', title: R.T('leads.q_kasim_beacons.title'), text: R.T('leads.q_kasim_beacons.text'), from: R.T('leads.q_kasim_beacons.from'), place: 'kasim', dir: R.T('leads.q_kasim_beacons.dir'), done: 'desert_beacons_done' });
  lead('q_kasim_salt', { kind: 'side', title: R.T('leads.q_kasim_salt.title'), text: R.T('leads.q_kasim_salt.text'), from: R.T('leads.q_kasim_salt.from'), place: 'sandedge', dir: R.T('leads.q_kasim_salt.dir'), done: 'desert_salt_done' });
  lead('q_kasim_maps', { kind: 'side', title: R.T('leads.q_kasim_maps.title'), text: R.T('leads.q_kasim_maps.text'), from: R.T('leads.q_kasim_maps.from'), place: 'kasim', hideWhen: false });
  // 寄り道のうわさ（rumor）
  lead('l_opt_sandedge', { kind: 'rumor', title: R.T('leads.l_opt_sandedge.title'), text: R.T('leads.l_opt_sandedge.text'), from: R.T('leads.l_opt_sandedge.from'), place: 'sandedge', dir: R.T('leads.l_opt_sandedge.dir'), done: { visited: 'sandedge' } });
  lead('l_opt_mirage', { kind: 'rumor', title: R.T('leads.l_opt_mirage.title'), text: R.T('leads.l_opt_mirage.text'), from: R.T('leads.l_opt_mirage.from'), place: 'kasim', dir: R.T('leads.l_opt_mirage.dir'), done: { visited: 'desert_mirage' } });
  lead('l_opt_temple', { kind: 'rumor', title: R.T('leads.l_opt_temple.title'), text: R.T('leads.l_opt_temple.text'), from: R.T('leads.l_opt_temple.from'), place: 'kasim', dir: R.T('leads.l_opt_temple.dir'), done: { visited: 'desert_temple_1' } });
  lead('l_opt_rocks', { kind: 'rumor', title: R.T('leads.l_opt_rocks.title'), text: R.T('leads.l_opt_rocks.text'), from: R.T('leads.l_opt_rocks.from'), place: 'rocks', dir: R.T('leads.l_opt_rocks.dir'), done: { visited: 'desert_rocks' } });
  lead('l_opt_hawknest', { kind: 'rumor', title: R.T('leads.l_opt_hawknest.title'), text: R.T('leads.l_opt_hawknest.text'), from: R.T('leads.l_opt_hawknest.from'), place: 'hawks', dir: R.T('leads.l_opt_hawknest.dir'), done: { visited: 'desert_hawks_1' } });
  // 宝の地図（地方をまたぐ。行き先はまだ語られていない土地の中＝slice:'locked'。WORLD §2.8）
  lead('l_tmap_3', { kind: 'map', title: R.T('leads.l_tmap_3.title'), text: R.T('leads.l_tmap_3.text'), from: R.T('leads.l_tmap_3.from'), region: 'r_ash', dir: R.T('leads.l_tmap_3.dir'), slice: 'locked' });
  lead('l_tmap_5', { kind: 'map', title: R.T('leads.l_tmap_5.title'), text: R.T('leads.l_tmap_5.text'), from: R.T('leads.l_tmap_5.from'), region: 'world', dir: R.T('leads.l_tmap_5.dir'), slice: 'locked' });
  lead('l_tmap_6', { kind: 'map', title: R.T('leads.l_tmap_6.title'), text: R.T('leads.l_tmap_6.text'), from: R.T('leads.l_tmap_6.from'), region: 'world', dir: R.T('leads.l_tmap_6.dir'), slice: 'locked' });
  // 本筋（main）: 記録院の物証（拓本の跡）と、名を呼んだ夜の余白（STORY_BIBLE §7.2 の 3）
  R.def('leads', 'l_main_recorder_desert', { kind: 'main', region: 'world', title: R.T('leads.l_main_recorder_desert.title'), from: R.T('leads.l_main_recorder_desert.from'), place: 'tomb',
    text: R.T('leads.l_main_recorder_desert.text') });
  R.def('leads', 'l_main_margin_named', { kind: 'main', region: 'world', title: R.T('leads.l_main_margin_named.title'), from: R.T('leads.l_main_margin_named.from'),
    text: R.T('leads.l_main_margin_named.text') });

  // ---------------------------------------------------------------- 読み物（STORY_BIBLE §10.2 の 13〜15 ほか）
  const lore = (id, o) => R.def('lore', id, Object.assign({ region: 'r_desert' }, o));
  lore('lo_ev_desert', { title: R.T('lore.lo_ev_desert.title'), kind: 'main', must: true, text: R.T('lore.lo_ev_desert.text') });
  lore('lo_time_desert', { title: R.T('lore.lo_time_desert.title'), kind: 'main', must: true, text: R.T('lore.lo_time_desert.text') });
  lore('lo_war_desert', { title: R.T('lore.lo_war_desert.title'), kind: 'region', must: false, text: R.T('lore.lo_war_desert.text') });
  lore('lo_desert_spring_letters', { title: R.T('lore.lo_desert_spring_letters.title'), kind: 'region', must: false, text: R.T('lore.lo_desert_spring_letters.text') });
  lore('lo_desert_camp_notes', { title: R.T('lore.lo_desert_camp_notes.title'), kind: 'region', must: false, text: R.T('lore.lo_desert_camp_notes.text') });
  // くべられなかった手紙 2〜8（森の 1 通目は forest_00_common.js。拾った順に年が進む）
  const LZ = {
    2: R.T('ev.desert_00_common.LZ.2'),
    3: R.T('ev.desert_00_common.LZ.3'),
    4: R.T('ev.desert_00_common.LZ.4'),
    5: R.T('ev.desert_00_common.LZ.5'),
    6: R.T('ev.desert_00_common.LZ.6'),
    7: R.T('ev.desert_00_common.LZ.7'),
    8: R.T('ev.desert_00_common.LZ.8'),
  };
  for (let n = 2; n <= 8; n++) {
    if (!R.DB.letters['letter_lz_' + n]) R.def('letters', 'letter_lz_' + n, { from: R.T('ev.desert_00_common.letters.from'), title: R.T('ev.desert_00_common.letters.title'), text: LZ[n] });
    if (!R.DB.lore['lo_lz_' + n]) R.def('lore', 'lo_lz_' + n, { title: R.T('ev.desert_00_common.lore.title'), region: 'world', kind: 'main', must: false, order: n, letter: 'letter_lz_' + n, text: R.T('ev.desert_00_common.lore.text') });
  }
  R.def('letters', 'letter_desert_nadia', { from: R.T('letters.letter_desert_nadia.from'), title: R.T('letters.letter_desert_nadia.title'), text: R.T('letters.letter_desert_nadia.text') });

  // ---------------------------------------------------------------- 年代記の章（E14）
  R.def('chronicle', 'r_desert', {
    title: R.T('chronicle.r_desert.title'),
    get text() {
      const ok = (c) => c == null || (R.Game && R.State && R.State.check ? R.State.check(c) : false);
      return this.parts.filter((p) => ok(p.cond)).map((p) => p.text).join('\n');
    },
    parts: [
      { text: R.T('chronicle.r_desert.parts.0.text') },
      { cond: { choice: 'ch_desert_hawk', is: 'fight' }, text: R.T('chronicle.r_desert.parts.1.text') },
      { cond: { choice: 'ch_desert_hawk', is: 'water' }, text: R.T('chronicle.r_desert.parts.2.text') },
      { cond: { choice: 'ch_desert_hawk', is: 'pay' }, text: R.T('chronicle.r_desert.parts.3.text') },
      { cond: { choice: 'ch_desert_route', is: 'short' }, text: R.T('chronicle.r_desert.parts.4.text') },
      { cond: { choice: 'ch_desert_route', is: 'long' }, text: R.T('chronicle.r_desert.parts.5.text') },
      { cond: 'desert_named', text: R.T('chronicle.r_desert.parts.6.text') },
      { cond: { choice: 'ch_desert_write', is: 'legend' }, text: R.T('chronicle.r_desert.parts.7.text') },
      { cond: { choice: 'ch_desert_write', is: 'pain' }, text: R.T('chronicle.r_desert.parts.8.text') },
      { cond: 'cleared_r_desert', text: R.T('chronicle.r_desert.parts.9.text') },
    ],
  });

  // ---------------------------------------------------------------- 砂漠の BGM（ワールドの範囲。地名の札と同じ矩形）
  const inDesert = (x, y) => x >= 8 && x <= 95 && y >= 121 && y <= 166;
  let cur = null;
  function desertBgm(e) {
    try {
      const pos = R.Field && R.Field.pos;
      if (!pos || pos.map !== 'world' || !R.Audio || !R.Audio.bgm) { cur = null; return; }
      const [lx, ly] = R.WorldXform ? R.WorldXform.lcell(R.DB.maps.world, pos.x, pos.y) : [pos.x, pos.y];   // 箱は論理の座標 L（WORLD v3）
      const want = inDesert(lx, ly) ? 'desert' : 'overworld';
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
