// 湿原（ロッホ・霧の館・鐘沈みの沼）の共通のデータと小道具。WORLD_REDESIGN §4.4・§3.2〜§3.5、STORY_BIBLE §7.4・§8.5・§10
//   R.DB.leads      湿原の手がかり（地方・依頼・寄り道のうわさ・本筋 1）
//   R.DB.lore       読み物（lo_ev_marsh・lo_time_marsh・lo_war_marsh・lo_marsh_song・くべられなかった手紙）
//   R.DB.chronicle.r_marsh  年代記の章「霧の魔女と七つの鐘」（名指しの回数・館に先に行ったか・痛みの選択で文が変わる。E14）
//   R.Marsh.ev      イベントが使う小道具（EVIDENCE・count・give・narr・lore・lz・small・tier…）
// 旗・変数（§2.4 の決まり）: marsh_* ／ 証拠の旗 marsh_ev_<foot|book|doll|drawing|melda|stone>、証拠の数 var marsh_evidence、
//   消灯の刻 marsh_night（宿で「消灯の刻まで休む」で立ち、「朝の鐘まで休む」で下りる。ロッホの外へ出ると下りる）、
//   間違えて名指しした数 var marsh_wrong、捕まった人 marsh_held_<beppo|tobias|melda>、消えた子の数 var marsh_lost
//   選択 ch_marsh_accuse（first|wrong）・ch_marsh_write（pain|legend）
// 仲間 20 人には物語の焦点を当てない（A36）。ボイスは付けない（オーナー: 声はあとで）。録音済みの文は 1 字も変えずに地の文として置く。
(function (R) {
  'use strict';
  const M = (R.Marsh = R.Marsh || {});
  const X = (M.ev = M.ev || {});

  // ---------------------------------------------------------------- 証拠（WORLD §4.4 の 6 つ）。right = 「霧そのもの」を示す証拠
  X.EVIDENCE = [
    { id: 'foot', n: 1, name: '運河の岸の小さな足あと', right: true, say: '夜の運河の岸に、光る苔を踏んだ\n小さな足あとがありました。\n館とは逆の、沼の方へ向かっていた。' },
    { id: 'book', n: 2, name: '鐘楼の記録帳', right: true, say: '鐘楼の記録帳です。鐘が鳴らなく\nなってから、子どもが消えはじめた。\n日付が、ぴったり重なります。' },
    { id: 'doll', n: 3, name: 'ベッポの人形', right: false, say: 'ベッポの店に、消えた子に\nそっくりな人形がありました。\n頼んだのは「霧色のマントの女」だと。' },
    { id: 'drawing', n: 4, name: 'リナの絵', right: true, say: '消えた子の妹リナの絵です。\n「おばあさんが歌ってくれた。\nでも、口が動いてなかった」と。' },
    { id: 'melda', n: 5, name: '館のメルダの話', right: false, say: '霧の館で、メルダに会いました。\n「霧が、わたしの姿をまねている」\n――彼女は、そう言いました。' },
    { id: 'stone', n: 6, name: '沼の縁の石碑', right: true, say: '沼の縁の、鐘の歌の石碑です。\n歌の最後の節だけが、\n削られていました。' },
  ];
  X.has = (ev, id) => ev.flag('marsh_ev_' + id);
  X.count = (ev) => X.EVIDENCE.filter((e) => X.has(ev, e.id)).length;
  X.tier = () => (R.Tier && R.Tier.get ? R.Tier.get() : 0);
  X.cleared = (ev) => ev.flag('cleared_r_marsh');
  X.narr = (ev, text) => ev.say(null, text, { face: false });
  /** 証拠を手に入れる（旗・数・手がかり帳の証拠の行）。初めてなら true */
  X.give = async function (ev, id) {
    if (X.has(ev, id)) return false;
    const e = X.EVIDENCE.find((q) => q.id === id);
    ev.setFlag('marsh_ev_' + id);
    ev.setVar('marsh_evidence', X.count(ev));
    ev.lead('l_marsh_ev_' + id);
    ev.leadDone('l_marsh_ev_' + id);
    try { ev.sfx('quill'); } catch (err) { /* */ }
    await ev.caption('証拠を手がかり帳に書き留めた：\n' + e.name, { ms: 1800 });
    const n = X.count(ev);
    if (n >= 4 && !ev.flag('marsh_assembly_done') && !ev.flag('marsh_can_assemble')) {
      ev.setFlag('marsh_can_assemble');
      ev.lead('l_marsh_assembly');
      await ev.caption('証拠が四つそろった。\n集会所で、町の集会を\n開いてもらえそうだ。', { ms: 2200 });
    }
    return true;
  };
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
    if (t >= 4) return '近ごろ、霧の上の空が\nうす紫に見えるの。';
    if (t >= 2) return '近ごろ、夜の色が\nちょっと薄くないかい？';
    return null;
  };
  // 鐘の歌（メルダが教える。石碑は最後の節が削れている）
  X.SONG = '♪　鳴れよ、七つの鐘\n♪　霧は沼の底へ、\n♪　朝は町の窓へ';
  X.SONG_CUT = '♪　鳴れよ、七つの鐘\n♪　霧は沼の底へ、\n♪　――――――';
  // 名指しの相手
  X.SUSPECTS = [
    { id: 'melda', name: '霧の館の魔女メルダ' },
    { id: 'beppo', name: '人形師ベッポ' },
    { id: 'tobias', name: '鐘つきトビアス' },
    { id: 'mist', name: '霧そのもの' },
  ];

  // ---------------------------------------------------------------- くべられなかった手紙（STORY_BIBLE §10.3）: 拾った順に n 通目（森・砂漠・雪原と同じ番号の組）
  X.lz = async function (ev) {
    let n = ev.var('marsh_lz');
    if (!n) { n = 2; while (n < 8 && ev.flag('lo_lz_' + n)) n++; ev.setVar('marsh_lz', n); }
    await X.lore(ev, 'lo_lz_' + n);
    if (R.DB.letters['letter_lz_' + n] && X.tier() >= n - 1) await ev.letter('letter_lz_' + n);
    else await ev.say(null, ['封を切ると、字が白く抜けていた。\n「ミラへ」――宛名のほかは、\n読めない。', '（灯がもう少し戻れば、\n読めるようになるかもしれない）']);
    return n;
  };

  // ---------------------------------------------------------------- 手がかり（K.lead）
  const lead = (id, o) => R.def('leads', id, Object.assign({ region: 'r_marsh' }, o));
  lead('l_marsh_mist', { kind: 'region', title: '霧に消える子ども', text: '霧の濃い晩ごとに、ロッホの\n子どもが消える。町の人は、\n霧の館の魔女のしわざだと言う。', from: 'ロッホの広場', place: 'loch', done: 'cleared_r_marsh' });
  lead('l_marsh_emma', { kind: 'region', title: '母親のエマ', text: '子が消えた母親エマが、\n宿「霧笛亭」にいるという。\n話を聞いてみよう。', from: 'ロッホの広場', place: 'loch', done: 'marsh_emma_met' });
  lead('l_marsh_evidence', { kind: 'region', title: '誰が子どもをさらうのか', text: '魔女・人形師・鐘つき……町の\nうわさはばらばら。証拠を四つ\nそろえれば、集会を開ける。', from: 'エマ', place: 'loch', done: 'marsh_assembly_done' });
  lead('l_marsh_assembly', { kind: 'region', title: '町の集会', text: '証拠がそろった。集会所の\n町長に頼めば、集会を開いて\nもらえる。誰を名指しする？', from: '手がかり帳', place: 'loch', done: 'marsh_assembly_done' });
  lead('l_marsh_manor', { kind: 'region', title: '霧の館', text: 'ロッホの東の霧の館に、\n魔女メルダが住むという。\n夜ごと、楽の音が聞こえる。', from: 'ロッホの東の門番', place: 'manor', dir: '東', done: 'marsh_melda_met' });
  lead('l_marsh_bog', { kind: 'region', title: '鐘沈みの沼', text: '霧は沼の方から来る。\n沈んだ鐘を鳴らせば、霧は\n沼の底へ沈むという。', from: 'メルダ', place: 'bog', dir: '南', done: 'cleared_r_marsh' });
  for (const e of X.EVIDENCE) lead('l_marsh_ev_' + e.id, { kind: 'region', title: '証拠：' + e.name, text: e.say, from: '手がかり帳', place: 'loch', done: 'marsh_ev_' + e.id });
  lead('l_main_recorder_marsh', { kind: 'main', region: 'world', title: '写し手も忘れる', text: '鐘の歌の楽譜は記録院へ貸し出され、\n白紙で返った。写した記録官は、\n何を写したか覚えていない。', from: '鐘楼の貸し出し簿', place: 'loch' });
  // 依頼（side。id は依頼と同じ q_*）
  lead('q_marsh_cat', { kind: 'side', title: '迷い猫ミーナ', text: '夜更かしのばあさまの猫が、\n消灯の刻に高床の下へ\nもぐったきり戻らない。', from: '夜市の夜更かしのばあさま', place: 'loch', done: 'marsh_cat_done' });
  lead('q_marsh_lanterns', { kind: 'side', title: '【灯りを守る】運河の灯籠', text: '霧で消えた運河の灯籠が三つ。\n消灯の刻に、油をさして\nともして回る。', from: '灯籠守のヨスト', place: 'loch', done: 'marsh_lanterns_done' });
  // 寄り道のうわさ（rumor）
  lead('l_opt_lotus', { kind: 'rumor', title: '青く光る蓮', text: '湿原の西の池に、消灯の刻だけ\n青く光って咲く蓮がある。\n蓮の精が出るという。', from: 'ロッホの吟遊詩人', place: 'loch', dir: '西', done: { var: 'marsh_lotus_seen', gte: 1 } });

  // ---------------------------------------------------------------- 読み物（STORY_BIBLE §10.2 の 20〜22 ほか）
  const lore = (id, o) => R.def('lore', id, Object.assign({ region: 'r_marsh' }, o));
  lore('lo_ev_marsh', { title: '貸し出し簿', kind: 'main', must: true, text: '鐘楼の貸し出し簿。\n「鐘の歌の楽譜 一冊 記録院へ貸し出し」\n受け取りの欄に、記録官クラウスの署名。' });
  lore('lo_time_marsh', { title: '鐘楼の記録帳', kind: 'main', must: true, text: '「光暦二九二年 冬　朝の鐘を\n『日の出』より『灯りの刻の始め』へ改む。\n理由の欄――」理由の欄だけが白い。' });
  lore('lo_war_marsh', { title: '新しい第七の鐘', kind: 'region', must: false, text: '七つの鐘のうち、ひとつだけが新しい。\n古い第七の鐘は、日輪同盟が\n矢じりにするために溶かしたという。' });
  lore('lo_marsh_song', { title: '鐘の歌', kind: 'region', must: false, text: '♪　鳴れよ、七つの鐘\n♪　霧は沼の底へ、\n♪　朝は町の窓へ' });

  // ---------------------------------------------------------------- 年代記の章（E14。選択で文が変わる）
  R.def('chronicle', 'r_marsh', {
    title: '霧の魔女と七つの鐘',
    get text() {
      const ok = (c) => c == null || (R.Game && R.State && R.State.check ? R.State.check(c) : false);
      return this.parts.filter((p) => ok(p.cond)).map((p) => p.text).join('\n');
    },
    parts: [
      { text: '霧の晩ごとに、ロッホから\n子どもが消えた。' },
      { cond: { choice: 'ch_marsh_accuse', is: 'first' }, text: '語り部の見習いは、町の集会で\nまっすぐ「霧そのもの」を指さした。' },
      { cond: { choice: 'ch_marsh_accuse', is: 'wrong' }, text: '町は一度、罪なき人を責めた。\nそのあいだに、もう一人の子が消えた。' },
      { cond: { choice: 'ch_marsh_write', is: 'legend' }, text: '霧は魔女の姿をまね、子どもをさらった……。' },
      { cond: { choice: 'ch_marsh_write', is: 'pain' }, text: '町は松明を持って館を囲んだ。\nその夜の町の顔も、ここに記す。' },
      { cond: 'cleared_r_marsh', text: '沼の鐘が鳴り、霧は沈んだ。\n七つの鐘楼に灯がともった。' },
    ],
  });

  // ---------------------------------------------------------------- 消灯の刻: ロッホとロッホの屋内の外へ出たら下ろす
  const inLoch = (id) => id === 'loch' || /^loch_/.test(id || '');
  if (R.on) {
    R.on('map:enter', (e) => {
      try {
        const id = (e && (e.map || e.id)) || (R.Field && R.Field.pos && R.Field.pos.map);
        if (R.Game && R.Game.flags && R.Game.flags.marsh_night && id && !inLoch(id)) { R.Game.flags.marsh_night = false; if (R.MapUtil && R.MapUtil.invalidate) R.MapUtil.invalidate(); }
      } catch (err) { /* */ }
    });
  }
})(window.RPG);
