// CONTENT-F: 森（ヴェルダの森・フェルン）の共通のデータと小道具。V2_PLAN §3.3〜§3.5・STORY_BIBLE §7.1・§10
//   R.DB.leads   森の手がかり（地方 5・依頼 7・寄り道の噂 2）。本筋の l_main_recorder_forest は CONTENT-P（leads_main.js）
//   R.DB.letters ピムの最初の詩・くべられなかった手紙（1 通目）
//   R.DB.lore    読み物（STORY_BIBLE §10.2 の森の 5 点。{title, text, region, must}。調べると旗 = id。CONTENT-P の序章と同じ形）
//   R.DB.chronicle.r_forest  年代記の章「千年樹の歌」の文（選択で変わる。E14）
//   R.ContentF.forest: VERSES・PEOPLE・rescue()・lore()・give()・found()・last() …（イベントのファイルが使う）
// 旗・変数（§2.4 の決まり）: forest_* ／ 選択 ch_forest_pim（send|take）・ch_forest_fawn（heal|leave）・ch_forest_write（pain|oath）
// 仲間 20 人には物語の焦点を当てない（A36）: 森のイベントは仲間の名前を 1 つも出さない。
(function (R) {
  'use strict';
  const C = (R.ContentF = R.ContentF || {});
  const F = (C.forest = C.forest || {});

  // 千年樹の歌（歌の石 3 つ。3 つ目の石だけにある一節は STORY_BIBLE §7.1 の 3）
  F.VERSES = ['♪　眠れ森の主、千の年輪に', '♪　約束の歌を、葉ずれに乗せて', '♪　火の夜を忘れず、緑を守れ'];
  F.EXTRA = '♪　語り部の火が 森をこえ\n♪　木の主が それを抱いて眠る';
  F.SONG = F.VERSES.join('\n');

  // 探す 4 人（順番は自由）。最後に見つけた人が一品物を渡す（どれも同じ強さ、V2_PLAN §3.3 F12）
  F.PEOPLE = {
    hans: { name: 'ハンス', look: 'npc_hans', unique: 'u_hans_axe' },
    ben: { name: 'ベン', look: 'npc_ben', unique: 'u_ben_whistle' },
    roy: { name: 'ロイ', look: 'npc_roy', unique: 'u_roy_charm' },
    pim: { name: 'ピム', look: 'npc_pim', unique: 'u_pim_cap' },
  };
  F.found = (ev, who) => ev.flag('forest_found_' + who);
  F.count = (ev) => ['hans', 'ben', 'roy', 'pim'].filter((w) => ev.flag('forest_found_' + w)).length;
  /** 最後に見つけた人（まだ 4 人そろっていなければ null） */
  F.last = function (ev) {
    let best = null, n = 0;
    for (const w of Object.keys(F.PEOPLE)) { const k = ev.var('forest_order_' + w); if (k > n) { n = k; best = w; } }
    return n >= 4 ? best : null;
  };
  /** 見つけた: 旗・順番・数。村ではなく迷いの森 1 階の野営地で待つ（STORY_BIBLE §7.1 の 1） */
  F.rescue = async function (ev, who, o) {
    o = o || {};
    if (ev.flag('forest_found_' + who)) return;
    const n = F.count(ev) + 1;
    ev.addVar('forest_order_' + who, n);
    ev.addVar('forest_found', 1);
    ev.setFlag('forest_found_' + who);
    try { ev.jingle('rescue'); } catch (e) { /* */ }
    if (o.hide !== false) {
      await ev.fade('out', 300);
      try { await ev.npc(o.npc || who).hide(); } catch (e) { /* */ }
      await ev.fade('in', 300);
    }
    if (!o.quiet) await ev.caption(`${F.PEOPLE[who].name}は、\n蛍だまりの野営地へ向かった。`, { ms: 2200 });
    if (n >= 4) await ev.caption('探していた四人が、そろった。\nあとは、森の歌を取り戻すだけだ。', { ms: 2600 });
    if (['hans', 'ben', 'roy'].every((w) => ev.flag('forest_found_' + w))) ev.leadDone('l_forest_woodcutters');
    if (who === 'pim') ev.leadDone('l_forest_pim');
  };

  /** 読み物（R.DB.lore）を書庫へ（CONTENT-P の序章と同じ形: 旗 = id）。EVENTS に ev.lore が来たらそちらを使う */
  F.lore = async function (ev, id) {
    if (ev.flag(id)) return false;
    ev.setFlag(id);
    if (typeof ev.lore === 'function') { await ev.lore(id); return true; }
    const d = R.DB.lore && R.DB.lore[id];
    try { ev.sfx('quill'); } catch (e) { /* */ }
    await ev.caption(`書庫に書き写した。\n「${d ? d.title : id}」`, { ms: 1800 });
    return true;
  };

  /** 品を渡す（知らない id は R.State.gain が警告する。数は Tier で変えてよい） */
  F.give = function (ev, id, n) { return ev.item(id, n == null ? 1 : n); };
  /** ティアで量が変わる小さな品（WORLD §3.3 ⑤） */
  F.small = function (ev, table) {
    const t = (R.Tier && R.Tier.get) ? R.Tier.get() : 0;
    const row = table[Math.min(t, table.length - 1)];
    return ev.item(row[0], row[1]);
  };

  // ---------------------------------------------------------------- 手がかり（K.lead）
  const lead = (id, o) => R.def('leads', id, Object.assign({ region: 'r_forest' }, o));
  lead('l_forest_board', { kind: 'region', title: '捜索隊、求む', text: '樵が三人、森から戻らない。\n樵頭ゴードが、捜索の手を\n求めているらしい。', from: 'フェルンの掲示板', place: 'fern', done: 'cleared_r_forest' });
  lead('l_forest_pim', { kind: 'region', title: 'ピムを探して', text: 'ゴードの息子ピムが、父を探して\nひとりで迷いの森へ入った。\n帽子の片方を持つと、足あとが光る。', from: 'カトリ（ピムの母）', place: 'verda', done: 'forest_found_pim' });
  lead('l_forest_woodcutters', { kind: 'region', title: '樵の三人', text: 'ハンス・ベン・ロイ。斧、笛、\n弁当箱。落ちた持ち物が、\n行き先を教えてくれるかもしれない。', from: 'ゴード', place: 'verda', done: ['forest_found_hans', 'forest_found_ben', 'forest_found_roy'] });
  lead('l_forest_song', { kind: 'region', title: '森の歌の石', text: '迷いの森に、千年樹の歌を\n分けて刻んだ石が三つあるという。\n歌がそろえば、森は迷わせない。', from: 'リタ', place: 'verda', done: { var: 'forest_verses', gte: 3 } });
  lead('l_forest_hut', { kind: 'region', title: '途切れた樵の日誌', text: '休み小屋の日誌に、記録院の男が\n「森の奥の空き小屋」へ入った、\nと書いてあった。', from: '樵の休み小屋', place: 'verda', done: 'lo_lz_1', hideWhen: 'cleared_r_forest' });
  // 依頼（side。id は依頼と同じ q_*）
  lead('q_fern_letters', { kind: 'side', title: '樹上の手紙配り', text: '手紙番のニナから、樹上の家\n五軒への手紙を預かった。\nつり橋を渡って届けよう。', from: 'フェルンの手紙番', place: 'fern', done: 'forest_letters_done' });
  lead('q_fern_herbs', { kind: 'side', title: '薬草五種', text: '薬草園のばあさまが、迷いの森の\n広場ごとに生える薬草を\n一種ずつ欲しがっている。', from: '薬草園のばあさま', place: 'verda', done: 'forest_herbs_done' });
  lead('q_fern_song', { kind: 'side', title: '歌あわせ', text: 'リタの弟子が、歌の節あての\n相手を探している。\n三段まであるらしい。', from: 'リタの弟子', place: 'fern', done: 'forest_song_3' });
  lead('q_forest_fireflies', { kind: 'side', title: '蛍の灯籠', text: '森の街道の道しるべの灯籠が\n三つ消えている。光る苔の火種を\n運べば、また灯るという。', from: '灯籠番のじいさま', place: 'fern', dir: '南', done: 'forest_fireflies_done' });
  lead('q_forest_acorn', { kind: 'side', title: 'どんぐり王子', text: '迷いの森の南東の広場で、\n冠をかぶったどんぐりを見た、\nと子どもが言っている。', from: '木の実拾いの子', place: 'verda', done: 'forest_acorn_won' });
  lead('q_yura_names', { kind: 'side', title: '名を忘れた人々', text: '隠れ里ユラの人々は、自分の名を\n思い出せない。灯りが戻るたび、\n誰かが思い出すという。', from: 'ユラの長老', place: 'yura', done: 'yura_miller_thanked' });
  lead('q_pim_poet', { kind: 'side', title: 'ピムの語り部修行', text: 'ピムが語り部になると言い出した。\n旅の話を手紙で送ってほしい\nらしい。', from: 'ピム', place: 'fern', hideWhen: false });
  // 寄り道の噂（rumor）。古井戸（l_opt_well）は CONTENT-P
  lead('l_opt_hut', { kind: 'rumor', title: '街道脇の休み小屋', text: '森の街道の脇に、樵たちの\n休み小屋がある。寝床は\n誰が使ってもいいらしい。', from: 'フェルンの旅の商人', place: 'hut', done: { visited: 'hut' } });
  lead('l_opt_yura', { kind: 'rumor', title: '森の奥の隠れ里', text: '森の北の窪地に、名を持たない\n人たちの里があるという。\n珍しい飾りを売っているとか。', from: 'フェルンの旅の商人', place: 'yura', done: { visited: 'yura' } });

  // ---------------------------------------------------------------- 手紙（K.letter）
  R.def('letters', 'letter_forest_pim_poem', {
    from: 'ピム', title: 'ぼくの はじめての詩',
    text: ['森の主は ねぼすけで\n千年ねても まだ ねむい\n', 'でも 歌をきくと おきるんだ\nぼくの 歌でも おきるんだ\n', '（すみに小さく）\nこんど 旅の話を きかせてね。\nぼくが 詩に するから。'],
  });
  R.def('letters', 'letter_lz_1', {
    from: '（差出人の名はない）', title: 'くべられなかった手紙',
    text: 'ミラへ。朝が来なくなって、町は静かです。誰も、戦の理由を口にしない。……おまえの歌を止めた矢が、どちらの陣のものだったのか、もう誰にも分からない。それでいいのだと思います。',
  });

  // ---------------------------------------------------------------- 読み物（STORY_BIBLE §10.2 の 9〜12・35）
  const lore = (id, o) => R.def('lore', id, Object.assign({ region: 'r_forest' }, o));
  lore('lo_ev_forest', { title: '記録官の帳面', kind: 'main', must: true, text: '「歌の石の歌を写した。\n写したあと、村の子が歌えなくなった。\n報告すべきか」' });
  lore('lo_time_forest', { title: '伸びない年輪', kind: 'main', must: true, text: '千年樹の根の切り口。\n外側の二十本の年輪だけが、\n糸のように細い。日が当たらなかった年の輪だ。' });
  lore('lo_war_forest', { title: '伐り跡の原', kind: 'region', must: false, text: '村はずれの切り株の原。\n二十年前、戦の烽火のために、\n森の東半分が伐られたという。' });
  lore('lo_forest_moss_stone', { title: '苔の語り石', kind: 'region', must: false, text: 'ロアの語り石と同じ形の石。\n苔の下の文字は、\nどうしても読めない。' });
  lore('lo_lz_1', { title: 'くべられなかった手紙', kind: 'main', must: false, order: 1, letter: 'letter_lz_1', text: '記録官の鞄の底にあった手紙。\n差出人の名はない。' });

  // ---------------------------------------------------------------- 年代記の章（E14。選択で文が変わる）
  //   MENUS は R.DB.chronicle[summaryKey].text を読む（requests.jsonl の MENUS → lead）。text は parts の cond の合う文をつないだもの
  R.def('chronicle', 'r_forest', {
    title: '千年樹の歌',
    get text() {
      const ok = (c) => c == null || (R.Game && R.State && R.State.check ? R.State.check(c) : false);
      return this.parts.filter((p) => ok(p.cond)).map((p) => p.text).join('\n');
    },
    parts: [
      { text: '森が歌を忘れ、道を変えた年のこと。\n語り部の見習いは、迷いの森で\n四人を探した。' },
      { cond: { choice: 'ch_forest_pim', is: 'send' }, text: '幼い子を家へ帰し、ひとり森の奥へ進んだ。' },
      { cond: { choice: 'ch_forest_pim', is: 'take' }, text: '幼い子とともに森を進み、千年樹の抜け穴をくぐった。' },
      { cond: { choice: 'ch_forest_fawn', is: 'heal' }, text: '傷ついた小鹿を手当てし、獣道を教わった。' },
      { cond: { choice: 'ch_forest_write', is: 'pain' }, text: '千年前、語り部のともした火が森を焼いた。\n森の主はその火を抱いて眠り、\n村は歌でその眠りを守ってきた。' },
      { cond: { choice: 'ch_forest_write', is: 'oath' }, text: '森の主は火を封じ、\n村は歌でその眠りを守った。' },
      { cond: 'cleared_r_forest', text: '千年樹の梢に、歌の灯がともった。' },
    ],
  });
})(window.RPG);
