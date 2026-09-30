// CONTENT（終盤）: 終盤とエンディングの共通のデータと小道具。STORY_BIBLE §4.2〜§4.4・§5・§6・§9.3〜§9.6・§10.2〜§10.4・§11
//   R.DB.leads      本筋の手がかり（T8 の余白・ロアへ・ファロスの港から・大書庫の頂・書斎の余白・クリア後の忘却の底）
//   R.DB.lore       終盤の読み物（肖像画の裏・白紙の暁の詞・代理試合の立会記録・東の大陸の封書・三つの影の書・ベルナの封書）
//   R.DB.letters    ベルナの封書（§10.4）
//   R.DB.chronicle  終章「語り部の旅」（エンディングの E9 で章に入る）
//   R.Final.ev      イベントが使う小道具（narr・lore・pain・chapters・speakers…）
// 旗（§2.4 の決まり）: story_t8・st_fine_reveal（T8）／ final_roa_scene・final_roa・final_open（終盤のロア）／ final_sailed・final_arrived（ビブリア）／
//   final_golem（2 階）・final_rowell（3 階の封印）・final_shades（4 階）・final_lazaro（5 階）・final_nemrea1（6 階の第 1 形態）・game_clear（クリア）／
//   選択 ch_lazaro_write（sin | father）。痛みの数は var pain_count（地方の年代記の選択で「痛みも書く」を選んだ数）。
// 仲間 20 人は物語に出ない（A36）。主人公はしゃべらない。ボイスは design/voice/script.csv の文のまま（§11）。
(function (R) {
  'use strict';
  const I = (R.Final = R.Final || {});
  const X = (I.ev = I.ev || {});

  // ---------------------------------------------------------------- 話し手（マップに人がいない場面の名前と顔）
  X.WHO = {
    fine: { name: R.T('ev.final_00_common.WHO.fine.name'), face: 'fine:neutral' },
    berna: { name: R.T('ev.final_00_common.WHO.berna.name'), face: 'berna:neutral' },
    rowell: { name: R.T('ev.final_00_common.WHO.rowell.name'), face: 'rowell:neutral' },
    lazaro: { name: R.T('ev.final_00_common.WHO.lazaro.name'), face: 'lazaro:neutral' },
    noa: { name: R.T('ev.final_00_common.WHO.noa.name'), face: 'noa:neutral' },
    king: { name: R.T('ev.final_00_common.WHO.king.name'), face: false },
    nemrea: { name: R.T('ev.final_00_common.WHO.nemrea.name'), face: false },
    child: { name: R.T('ev.final_00_common.WHO.child.name'), face: false },
  };
  /** 話し手の {name, face}（o で上書き。face に表情だけ 'smile' を書いたら話し手の顔に付ける） */
  X.who = function (id, o) {
    const w = Object.assign({}, X.WHO[id] || {}, o || {});
    if (typeof w.face === 'string' && !/:/.test(w.face) && X.WHO[id] && X.WHO[id].face) w.face = id + ':' + w.face;
    return w;
  };
  X.tier = () => (R.Tier && R.Tier.get ? R.Tier.get() : 0);
  X.narr = (ev, text) => ev.say(null, text, { face: false });
  /** 地方の年代記の選択で「痛みも書く」を選んだ数（var pain_count。無ければ選択の記録から数える） */
  X.pain = function () {
    const G = R.Game || {};
    const v = (G.vars && G.vars.pain_count) || 0;
    const byChoice = Object.keys(G.choices || {}).filter((k) => /^ch_[a-z]+_write$/.test(k) && G.choices[k] === 'pain').length;
    return Math.max(v, byChoice);
  };
  /** 読み物を書庫へ（旗 = id） */
  X.lore = function (ev, id) {
    if (ev.flag(id)) return false;
    if (typeof ev.lore === 'function') { ev.lore(id); return true; }
    ev.setFlag(id);
    return true;
  };
  /** 解決した地方の年代記の章（解決した順）→ [{id, title, first, write}] */
  X.chapters = function () {
    const G = R.Game || {};
    const list = (G.chronicle && Array.isArray(G.chronicle.chapters) ? G.chronicle.chapters.map((c) => c && c.id) : []).filter((id) => /^r_/.test(id || ''));
    for (const rid of Object.keys(R.DB.regions || {})) if (/^r_/.test(rid) && G.cleared && G.cleared[rid] && !list.includes(rid)) list.push(rid);
    const out = [];
    for (const rid of list) {
      const ch = R.DB.chronicle && R.DB.chronicle[rid];
      const reg = R.DB.regions[rid] || {};
      if (!ch) continue;
      const ok = (c) => c == null || (R.State && R.State.check ? R.State.check(c) : false);
      const parts = (ch.parts || []).filter((p) => ok(p.cond));
      const first = X.sentence(parts.length ? parts[0].text : '');
      const wp = parts.find((p) => p.cond && typeof p.cond === 'object' && /_write$/.test(p.cond.choice || ''));
      out.push({ id: rid, title: ch.title || (reg.chapter && reg.chapter.title) || reg.name, first, write: wp ? X.sentence(wp.text) : '', pain: !!(wp && wp.cond.is === 'pain') });
    }
    return out;
  };
  /** 文の最初の一文（「。」まで。改行はそのまま） */
  X.sentence = function (t) {
    const s = String(t || '');
    const i = s.indexOf('。');
    return i >= 0 ? s.slice(0, i + 1) : s;
  };
  /** ボイスの先読み（まとめた版は束を読む。無くても進む） */
  X.preload = async function (ids) {
    try { if (R.Audio && R.Audio.preloadVoice) await Promise.race([R.Audio.preloadVoice(ids), R.wait(2500)]); } catch (e) { /* 声が無くても進む */ }
  };
  /** 画面をひと呼吸（場面の切れ目） */
  X.breath = (ev, ms) => ev.wait(ms == null ? 600 : ms);
  /** 光の演出（フィールドがあるときだけ） */
  X.flash = function (color, ms) { try { if (R.Field && R.Field.flash) R.Field.flash(color || '#ffffff', ms || 400); } catch (e) { /* */ } };
  X.shake = function (p, ms) { try { if (R.Field && R.Field.shake) R.Field.shake(p || 3, ms || 600); } catch (e) { /* */ } };

  // ---------------------------------------------------------------- 手がかり帳（本筋）
  R.defs('leads', {
    l_main_margin_8: {
      title: R.T('leads.l_main_margin_8.title'), kind: 'main', region: 'world', from: R.T('leads.l_main_margin_8.from'),
      text: R.T('leads.l_main_margin_8.text'),
    },
    l_main_final_roa: {
      title: R.T('leads.l_main_final_roa.title'), kind: 'main', region: 'world', from: R.T('leads.l_main_final_roa.from'), place: 'roa', dir: R.T('leads.l_main_final_roa.dir'),
      text: R.T('leads.l_main_final_roa.text'),
      done: 'final_roa',
    },
    l_main_final_ferry: {
      title: R.T('leads.l_main_final_ferry.title'), kind: 'main', region: 'world', from: R.T('leads.l_main_final_ferry.from'), place: 'pharos', dir: R.T('leads.l_main_final_ferry.dir'),
      text: R.T('leads.l_main_final_ferry.text'),
      done: 'final_arrived',
    },
    l_main_final_archive: {
      title: R.T('leads.l_main_final_archive.title'), kind: 'main', region: 'world', from: R.T('leads.l_main_final_archive.from'), place: 'biblia', dir: R.T('leads.l_main_final_archive.dir'),
      text: R.T('leads.l_main_final_archive.text'),
      done: 'game_clear',
    },
    l_main_margin_noa: {
      title: R.T('leads.l_main_margin_noa.title'), kind: 'main', region: 'world', from: R.T('leads.l_main_margin_noa.from'),
      text: R.T('leads.l_main_margin_noa.text'),
    },
    l_main_margin_study: {
      title: R.T('leads.l_main_margin_study.title'), kind: 'main', region: 'world', from: R.T('leads.l_main_margin_study.from'),
      text: R.T('leads.l_main_margin_study.text'),
    },
    l_post_oblivion: {
      title: R.T('leads.l_post_oblivion.title'), kind: 'main', region: 'world', from: R.T('leads.l_post_oblivion.from'), place: 'biblia', dir: R.T('leads.l_post_oblivion.dir'),
      text: R.T('leads.l_post_oblivion.text'),
    },
  });

  // ---------------------------------------------------------------- 読み物（STORY_BIBLE §10.2 の「終盤・クリア後の読み物」と 43 番）
  const lore = (id, o) => { if (!R.DB.lore[id]) R.def('lore', id, Object.assign({ region: 'finale', kind: 'main', must: false }, o)); };
  lore('lo_mira_portrait', { title: R.T('lore.lo_mira_portrait.title'), text: R.T('lore.lo_mira_portrait.text') });
  lore('lo_mira_dawnword', { title: R.T('lore.lo_mira_dawnword.title'), text: R.T('lore.lo_mira_dawnword.text') });
  lore('lo_arena_record', { title: R.T('lore.lo_arena_record.title'), text: R.T('lore.lo_arena_record.text') });
  lore('lo_east_letter', { title: R.T('lore.lo_east_letter.title'), text: R.T('lore.lo_east_letter.text') });
  lore('lo_three_shades', { title: R.T('lore.lo_three_shades.title'), text: R.T('lore.lo_three_shades.text') });
  lore('lo_berna_confession', { title: R.T('lore.lo_berna_confession.title'), must: true, letter: 'berna_confession', text: R.T('lore.lo_berna_confession.text') });

  // ---------------------------------------------------------------- ベルナの封書（§10.4。ボイスなし）
  // 3 枚の札に分ける（1 枚の札に収まる長さ）。{hero} は開くときに主人公の名前に
  const heroFill = (t) => (R.Events && R.Events.fill ? R.Events.fill(t) : t);
  const CONF = [
    R.T('ev.final_00_common.CONF.0'),
    R.T('ev.final_00_common.CONF.1'),
    R.T('ev.final_00_common.CONF.2'),
    R.T('ev.final_00_common.CONF.3'),
  ];
  const CONF_TITLE = R.T('ev.final_00_common.CONF_TITLE');
  CONF.forEach((pages, i) => {
    R.def('letters', 'berna_confession' + (i ? '_' + (i + 1) : ''), {
      from: R.T('ev.final_00_common.letters.from'), title: CONF_TITLE[i], face: 'berna:sad',
      get text() { return pages.map(heroFill); },
    });
  });
  X.CONFESSION = CONF.map((p, i) => 'berna_confession' + (i ? '_' + (i + 1) : ''));

  // ---------------------------------------------------------------- 終章（エンディングの E9 で年代記に入る。§9.5）
  R.def('chronicle', 'finale', {
    title: R.T('chronicle.finale.title'),
    get text() {
      const ok = (c) => c == null || (R.Game && R.State && R.State.check ? R.State.check(c) : false);
      return this.parts.filter((p) => ok(p.cond)).map((p) => p.text).join('\n');
    },
    parts: [
      { text: R.T('chronicle.finale.parts.0.text') },
      { text: R.T('chronicle.finale.parts.1.text') },
      { cond: { choice: 'ch_lazaro_write', is: 'sin' }, text: R.T('chronicle.finale.parts.2.text') },
      { cond: { choice: 'ch_lazaro_write', is: 'father' }, text: R.T('chronicle.finale.parts.3.text') },
      { text: R.T('chronicle.finale.parts.4.text') },
    ],
  });
  /** 年代記の題（始まりの年代記の題の欄に書いた一行。E3） */
  X.TITLE_LINE = R.T('ev.final_00_common.TITLE_LINE');
})(window.RPG);
