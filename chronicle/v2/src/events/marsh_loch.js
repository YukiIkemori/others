// CONTENT（湿原）: 水辺の町ロッホの人と物・推理・集会（WORLD_REDESIGN §5.7・§4.4、STORY_BIBLE §7.4・§8.5）。
//   流れ: 着く（松明の人だかり）→ 宿でエマ → 証拠集め（足あと〈夜〉・鐘楼の記録帳・ベッポの人形・リナの絵・館のメルダ・沼の縁の石碑）
//         → 証拠 4 つで集会所の集会 → 名指し（霧そのもの = 正しい。証拠 1・2・4・6 のうち 3 つを示す）→ 町の人と沼へ（marsh_assembly_done）。
//         間違えて名指しすると、その人が捕まり、その夜もう一人子どもが消える。翌朝、新しい証拠が 1 つ出て、集会をやり直せる（3 回まで。3 回目の後は正しい証拠がそろう）。
//   消灯の刻（marsh_night）: 宿で「消灯の刻まで休む」。灯が落ち、夜市が開き、運河の岸に光る足あとが見える。フィーネは夜の橋（証拠 2 つ以上）。
//   話す見返り（E19）: 手がかり・依頼・値引き・ほのめかし・品・ボスの癖・近況。仲間の名前は出さない（A36）。ボイスは使わない。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Marsh.ev;
  const cleared = (ev) => ev.flag('cleared_r_marsh');
  const night = (ev) => ev.flag('marsh_night');
  const FINE = { name: '灰色のマントの少女' };

  // ---------------------------------------------------------------- 町に入る
  E('loch_arrival', async (ev) => {
    if (cleared(ev)) {
      if (!ev.flag('marsh_arrived_after')) { ev.setFlag('marsh_arrived_after'); await ev.caption('ロッホ。霧の晴れた湖に、\n七つの鐘楼の灯が映っている。', { ms: 2400 }); }
      return;
    }
    if (!ev.flag('marsh_arrived')) {
      ev.setFlag('marsh_arrived');
      await ev.caption('水辺の町ロッホ。\n浅い湖の上に、板の道と\n高床の家が続く町。', { ms: 2600 });
      await ev.caption('大鐘の前の広場に、\n松明を持った人だかりができていた。', { ms: 2200 });
      await ev.say(null, ['「今夜こそ、霧の館に火をかけろ！」', '「魔女がいなくなりゃ、\n子どもは消えなくなるんだ！」'], { name: '広場の声' });
      ev.lead('l_marsh_mist');
      ev.lead('l_marsh_emma');
      return;
    }
    if (night(ev) && !ev.flag('marsh_night_seen')) {
      ev.setFlag('marsh_night_seen');
      await ev.caption('消灯の刻。湖の灯が落ち、\n南の筏に、夜市の灯りがともった。', { ms: 2200 });
    }
  }, { meta: { needs: [], gives: ['flag:marsh_arrived', 'lead:l_marsh_mist', 'lead:l_marsh_emma'] } });

  // 松明の人だかり（集会が済むまで）
  E('loch_mob', async (ev, ctx) => {
    const id = (ctx && ctx.npc) || 'mob_leader';
    if (ev.flag('marsh_held_beppo') || ev.flag('marsh_held_tobias') || ev.flag('marsh_held_melda')) {
      await ev.say(id, ['……捕まえたのに、また\n子どもが消えたんだ。', '俺たちは、何を\n燃やそうとしてたんだろうな。']);
      return;
    }
    if (!ev.flag('marsh_emma_met')) { await ev.say(id, 'よそ者は口を出すな！\nこれは、この町のことだ。'); return; }
    if (ev.flag('marsh_can_assemble')) { await ev.say(id, ['集会だって？\n……いいだろう。', '町長のところで\n言い分を聞いてやる。']); return; }
    await ev.say(id, ['エマに頼まれたのか。\n……勝手にしろ。', 'だが霧の晩が来たら、\n俺たちは館へ行くぞ。']);
  });

  // ---------------------------------------------------------------- エマ（宿 → 家）
  E('loch_emma', async (ev, ctx) => {
    const id = (ctx && ctx.npc) || 'emma_inn';
    if (cleared(ev)) {
      const said = ev.flag('marsh_yena_torn');
      await ev.say(id, said ? ['ヨハンが帰ってきたの。\n泥だらけで、ぐっすり眠ってた。', 'あの紙を破ってよかった。\n……忘れていたら、今夜の\nこの嬉しさもなかったもの。'] : ['ヨハンが帰ってきたの。\n泥だらけで、ぐっすり眠ってた。', '……あの人たちの紙、\nまだ引き出しにあるの。\n今夜、燃やすわ。']);
      return;
    }
    if (!ev.flag('marsh_emma_met')) {
      ev.setFlag('marsh_emma_met');
      await ev.say(id, ['……旅の方？　ごめんなさい、\n泣いてばかりで。わたしはエマ。', '三日前の霧の晩に、\n息子のヨハンが消えたの。\n窓を閉めておいたのに。', '町の人は、霧の館の魔女だって。\n今夜にも館に火をかけるって。', 'でも……本当に魔女なら、\nどうしてヨハンの寝床に、\n沼の泥がついていたの？', 'お願い。誰が、何が、子どもを\nさらったのか、確かめて。\n証拠があれば、町長も集会を開く。']);
      ev.lead('l_marsh_evidence');
      ev.leadDone('l_marsh_emma');
      await ev.caption('エマは、自分の家へ戻っていった。\n家は、町の南の網を干した小屋だ。', { ms: 2200 });
      try { await ev.leave(id); } catch (e) { /* */ }
      return;
    }
    const n = X().count(ev);
    await ev.say(id, n >= 4 ? ['証拠が、そろったのね。', '集会所の町長に頼めば、\n集会を開いてくれるわ。'] : ['何か、わかった？', 'リナが……妹が、あの晩の\nことを絵に描いていたの。\n見てやってくれる？']);
  }, { meta: { needs: ['flag:marsh_arrived'], gives: ['flag:marsh_emma_met', 'lead:l_marsh_evidence'] } });

  // エマの家: 妹リナの絵（証拠 4）
  E('loch_emma_drawing', async (ev) => {
    await ev.say(null, ['食卓に、子どもの絵がある。\n霧の中の女の人と、\n手をつないだ男の子。', '女の人の顔は、灰色の\nぐるぐるで塗りつぶされている。']);
    if (!ev.flag('marsh_emma_met')) return;
    await X().give(ev, 'drawing');
  }, { meta: { needs: ['flag:marsh_emma_met'], gives: ['flag:marsh_ev_drawing', 'var:marsh_evidence'] } });
  E('loch_lina', async (ev) => {
    if (cleared(ev)) { await ev.say('lina', ['おにいちゃん、かえってきたよ！', 'ねえ、朝の鐘って、\nどうして朝じゃないのに\n鳴るの？']); return; }
    await ev.say('lina', ['あのね、おばあさんが\n歌ってくれたの。窓の外で。', 'でもね、口が\nうごいてなかったの。', 'おにいちゃんは、おばあさんと\n手をつないで、いっちゃった。']);
    if (ev.flag('marsh_emma_met')) await X().give(ev, 'drawing');
  }, { meta: { needs: ['flag:marsh_emma_met'], gives: ['flag:marsh_ev_drawing', 'var:marsh_evidence'] } });

  // 静夜会のイェナ（任意。エマの家の前。同席するとエマが奉納の紙を破る）
  E('loch_yena', async (ev) => {
    if (ev.flag('marsh_yena_done')) return;
    await ev.say('yena', ['静夜会のイェナと申します。\nエマさんに、お話を。', '忘れてしまえば、この悲しみも\n初めから無かったことに\nなるのですよ。', 'この紙に、ヨハンさんの名を\n書いて奉納なさい。記録院が\n写して、預かってくれます。']);
    const i = await ev.choose(['エマのそばにいる', '立ち去る'], { text: 'イェナは、紙を差し出している。' });
    ev.setFlag('marsh_yena_done');
    if (i === 0) {
      await ev.say(null, 'エマは、紙を受け取ったまま、\n長いあいだ黙っていた。');
      await ev.say(null, ['「……忘れたら、あの子が\n帰ってきても、わたし、\n抱きしめられないじゃない」', 'エマは、奉納の紙を\nふたつに破った。'], { name: 'エマ' });
      ev.setFlag('marsh_yena_torn');
      await ev.say('yena', 'そうですか。……夜は、\nいつでもお待ちしています。');
    }
    try { await ev.leave('yena'); } catch (e) { /* */ }
  }, { meta: { needs: ['flag:marsh_emma_met'], gives: ['flag:marsh_yena_done'] } });

  // ---------------------------------------------------------------- 宿「霧笛亭」: 灯りの刻と消灯の刻（E9）
  E('loch_inn_keeper', async (ev) => {
    await ev.say('inn_keeper', cleared(ev) ? 'いらっしゃい。霧が晴れてから、\n泊まりのお客が増えたのよ。' : 'いらっしゃい、霧笛亭へ。\n霧の晩は、窓を閉めて寝てね。');
    const i = await ev.choose(['消灯の刻まで休む', '朝の鐘まで休む', 'やめる'], { text: 'いつまで休む？' });
    if (i === 2) return;
    const ok = await ev.inn();
    if (!ok) return;
    ev.setFlag('marsh_night', i === 0);
    await ev.caption(i === 0 ? '消灯の刻。町の灯が、\nひとつ、またひとつと落ちていく。' : '朝の鐘が鳴った。\n空は暗いまま。けれど、\n町の灯が朝の色にともる。', { ms: 2200 });
  }, { meta: { needs: [], gives: ['flag:marsh_night'] } });
  E('loch_inn_guest', async (ev) => {
    await ev.say('inn_guest', ['湿原の西の池に、消灯の刻だけ\n青く光る蓮が咲くんだと。', '蓮の精ってのが出るらしい。\n売れば高いぞ、あれは。']);
    ev.lead('l_opt_lotus');
  }, { meta: { needs: [], gives: ['lead:l_opt_lotus'] } });

  // ---------------------------------------------------------------- 夜: 運河の岸の光る足あと（証拠 1）
  E('loch_footprints', async (ev) => {
    await ev.say(null, ['運河の岸の泥に、小さな足あとが\n青白く光っている。光る苔を\n踏んだ跡だ。', '足あとは、東の館の方ではなく、\n南の……沼の方へ続いている。']);
    if (ev.flag('marsh_emma_met')) await X().give(ev, 'foot');
  }, { meta: { needs: ['flag:marsh_emma_met', 'flag:marsh_night'], gives: ['flag:marsh_ev_foot', 'var:marsh_evidence'] } });

  // 夜の運河の橋: 灰色のマントの少女（v_fine_marsh_01 の文のまま。声はあとで）
  E('loch_bridge_fine', async (ev) => {
    if (ev.flag('marsh_fine_seen')) return;
    ev.setFlag('marsh_fine_seen');
    R.Audio && R.Audio.pushBgm && R.Audio.pushBgm('fine_theme');
    try {
      await ev.say(null, '夜の橋の上で、灰色のマントの\n少女とすれ違った。');
      await ev.say('fine', '霧は形を持たないから、\n誰の姿にでもなれるの。', FINE);
      ev.sfx('magic');
      try { await ev.leave('fine', { path: [[27, 27], [27, 29]], ms: 900 }); } catch (e) { /* */ }
      await ev.caption('振り返ると、少女の姿は\n運河の霧に溶けていた。', { ms: 2000 });
    } finally { R.Audio && R.Audio.popBgm && R.Audio.popBgm(); }
  }, { meta: { needs: ['flag:marsh_night'], gives: ['flag:marsh_fine_seen'] } });

  // ---------------------------------------------------------------- 鐘楼（トビアス。記録帳 = 証拠 2、貸し出し簿、第七の鐘）
  E('loch_tobias', async (ev) => {
    if (cleared(ev)) { await ev.call('loch_tobias_reward'); return; }
    if (ev.flag('marsh_held_tobias')) return;
    if (!ev.flag('marsh_tobias_met')) {
      ev.setFlag('marsh_tobias_met');
      await ev.say('tobias', ['……鐘つきのトビアスだ。\n鐘は、もう鳴らん。', '鐘の歌の楽譜を、去年、\n記録院の人に貸した。返ってきたら、\nこのとおり、真っ白だった。']);
      ev.item('k_blank_score', 1);
      await ev.say('tobias', ['歌を知らんと、鐘は鳴らせん。\n親父から習ったはずなのに……\n一節も、思い出せんのだ。', '貸し出し簿は、その机の上だ。\n好きに読め。']);
      await X().lore(ev, 'lo_ev_marsh');
      ev.lead('l_main_recorder_marsh');
      return;
    }
    await ev.say('tobias', ev.flag('marsh_ev_book') ? ['記録帳を見たか。', '鐘が鳴らなくなった晩から、\n子どもが消えはじめた。\n……わしには、偶然とは思えん。'] : ['机の上の記録帳も見てくれ。\n鐘をついた晩が、全部書いてある。']);
    if (!ev.flag('lo_war_marsh')) {
      await ev.say('tobias', ['七つの鐘のうち、南東の\n一本だけが新しいだろう。', '古い第七の鐘は、二十年前に\n矢じりにするとかで溶かされた。\n止めようとしたのが、親父だ。']);
      await X().lore(ev, 'lo_war_marsh');
    }
  }, { meta: { needs: [], gives: ['flag:marsh_tobias_met', 'item:k_blank_score', 'lore:lo_ev_marsh', 'lore:lo_war_marsh', 'lead:l_main_recorder_marsh'], calls: ['loch_tobias_reward'] } });
  E('loch_tower_book', async (ev) => {
    await ev.say(null, ['鐘楼の記録帳だ。鐘をついた晩が、\n几帳面な字で並んでいる。', '「光暦二九二年 冬　朝の鐘を\n『日の出』より『灯りの刻の始め』へ改む。\n理由の欄――」', '理由の欄だけが、白い。']);
    await X().lore(ev, 'lo_time_marsh');
    await ev.say(null, ['最後の頁。去年の秋から、\n鐘をついた印が途絶えている。', 'その次の頁から、\n「霧の晩、子ども消ゆ」の書き込みが\n三つ、続いていた。']);
    if (ev.flag('marsh_emma_met')) await X().give(ev, 'book');
  }, { meta: { needs: ['flag:marsh_emma_met'], gives: ['lore:lo_time_marsh', 'flag:marsh_ev_book', 'var:marsh_evidence'] } });
  E('loch_tower_ladder', async (ev) => { await ev.say(null, '鐘の吊られた上の段へ続く、\n古いはしご。段が何枚か抜けている。'); });
  E('loch_tower_bell', async (ev) => {
    await ev.say(null, cleared(ev) ? '鐘の縁に、新しい灯がともっている。\n朝の鐘の、低く澄んだ音の名残。' : ['試しに、鐘の綱を引いてみた。', '……鐘は、動くのに鳴らない。\n音が、霧に吸われていくようだ。']);
  });
  E('loch_tobias_reward', async (ev) => {
    if (ev.flag('marsh_tobias_reward')) { await ev.say('tobias', ['朝の鐘が、また鳴る。', '……「朝」が何なのかは、\nわしにもわからん。だが、\n鳴らすのが鐘つきの仕事だ。']); return; }
    ev.setFlag('marsh_tobias_reward');
    await ev.say('tobias', ['鐘が鳴った。……親父の\n歌を、思い出したよ。', 'これは、鐘楼に代々伝わる\nお守りだ。持っていけ。']);
    ev.item('ac_tale_marsh', 1);
  }, { meta: { needs: ['flag:cleared_r_marsh'], gives: ['flag:marsh_tobias_reward', 'item:ac_tale_marsh'] } });

  // ---------------------------------------------------------------- 人形師ベッポ（消えた子に似た人形 = 証拠 3）
  E('loch_beppo', async (ev) => {
    if (cleared(ev)) { await ev.say('beppo', ev.flag('marsh_held_beppo_was') ? ['ひどい目にあったよ。\n……でも、町長がわびに来た。', '霧の女の人形は、燃やした。\n今は、町の子の人形を作ってる。\n本人たちに頼まれてね。'] : ['霧の女の人形？　燃やしたよ。\n気味が悪くてね。', '今は、町の子の人形を作ってる。\n本人たちに頼まれてね。']); return; }
    await ev.say('beppo', ['やあ、いらっしゃい！\n人形師のベッポだ。', '笑える人形から、泣ける人形まで。\n……いや、今は泣ける方ばかりか。']);
    if (ev.flag('marsh_emma_met')) await ev.say('beppo', ['消えた子の人形？\nああ、棚のあれか。', '頼まれて作ったんだ。\n霧色のマントの女の人にね。\n顔は、よく見えなかった。']);
  });
  E('loch_beppo_dolls', async (ev) => {
    await ev.say(null, ['棚に、子どもの人形が並んでいる。\nそのうちの三体が、\nどれも、消えた子の顔によく似ている。', '人形の足の裏に、\n沼の泥がこびりついていた。']);
    if (ev.flag('marsh_emma_met')) await X().give(ev, 'doll');
  }, { meta: { needs: ['flag:marsh_emma_met'], gives: ['flag:marsh_ev_doll', 'var:marsh_evidence'] } });
  E('loch_beppo_order', async (ev) => {
    await ev.say(null, ['注文の帳面だ。\n「子の人形 三体。代金は前払い。\n霧色のマントの婦人より」', '代金の欄には、\n湿った銀貨の絵が描いてある。\n……銀貨が、泥に変わっていたらしい。']);
  });

  // ---------------------------------------------------------------- 記録院ロッホ出張所（クラウス。写したことを覚えていない）
  E('loch_klaus', async (ev, ctx) => {
    const id = (ctx && ctx.npc) || 'klaus';
    if (cleared(ev)) {
      await ev.say(id, ['書き直した楽譜は、鐘楼に\n渡しました。写しは、手元にも。', '……書くのは、得意なんです。\n今度は、忘れないように。']);
      return;
    }
    await ev.say(id, ['記録院ロッホ出張所の、\n記録官クラウスです。', '鐘の歌の楽譜？　帳面には、\nたしかに僕の字で「写し済み」と\nあります。', 'でも……何を写したのか、\n一節も、覚えていないんです。\n写した晩のことも。']);
    if (!ev.flag('marsh_klaus_met')) { ev.setFlag('marsh_klaus_met'); ev.lead('l_main_recorder_marsh'); }
  }, { meta: { needs: [], gives: ['flag:marsh_klaus_met', 'lead:l_main_recorder_marsh'] } });
  E('loch_klaus_desk', async (ev) => {
    if (ev.flag('marsh_lz_got')) { await ev.say(null, '机の引き出しは、空になっている。'); return; }
    ev.setFlag('marsh_lz_got');
    await ev.say(null, ['机の引き出しの奥に、\n封をしたままの手紙がある。', '宛名は「ミラへ」。\nクラウスは、なぜそこに\nあるのか知らないという。']);
    await X().lz(ev);
  }, { meta: { needs: [], gives: ['flag:marsh_lz_got'] } });
  E('loch_klaus_shelf', async (ev) => { await ev.say(null, ['写しの控えが並ぶ棚。\n背には「保管のため写し取り済み」の\n札ばかりが貼られている。']); });

  // ---------------------------------------------------------------- 町の人（近況・ほのめかし）
  E('loch_bard', async (ev) => {
    if (cleared(ev)) { await ev.say('bard', ['鐘の歌が、町に戻った。', X().SONG]); return; }
    await ev.say('bard', ['鐘の歌を知ってるかい？\nこの町の、古い歌さ。', '……ところが、誰も\n最後まで歌えないんだ。\n石碑の最後の節も、削れてる。', '沼の縁の石碑さ。\n南の、霧の濃い方だよ。']);
    ev.lead('l_opt_lotus');
  }, { meta: { needs: [], gives: ['lead:l_opt_lotus'] } });
  E('loch_child', async (ev) => { await ev.say('child_plaza', X().skyLine() || ['霧がなくなったら、\n湖って、こんなに広かったんだ！']); });
  E('loch_gate_w', async (ev) => {
    await ev.say('guard_w', cleared(ev) ? ['霧が晴れて、湿原の道が\n遠くまで見えるようになった。'] : ['西の板の道の先は、湿原の道だ。\n北の山あいの街道を抜ければ、\n北の野に出る。', '霧の晩は、道を外れるなよ。']);
  });
  E('loch_gate_e', async (ev) => {
    if (cleared(ev)) { await ev.say('guard_e', '館の楽の音が、やんだよ。\n……少し、さびしい気もする。'); return; }
    await ev.say('guard_e', ['東の橋の先が、霧の館だ。\n夜ごと、人形の楽団が\n勝手に演奏してるって話だ。', '指揮者の人形が棒を振ると、\n倒れた楽士が起き上がるらしい。\n先に指揮者を倒すことだな。']);
    ev.lead('l_marsh_manor');
  }, { meta: { needs: [], gives: ['lead:l_marsh_manor'] } });
  E('loch_fisher', async (ev) => {
    await ev.say('fisher', cleared(ev) ? ['沼の霧が晴れたら、\n魚が戻ってきた。', '鐘が鳴ると、魚も起きるのかね。'] : ['霧は、いつも南の沼の方から\n来るんだ。東の館の方からじゃない。', '……魚は、嘘をつかんよ。\n霧の来る晩は、みんな\n南を向いて固まっとる。']);
  });
  E('loch_laundress', async (ev) => {
    await ev.say('laundress', cleared(ev) ? '洗濯物が、よく乾くわ。\n霧って、こんなに\n重たかったのね。' : ['朝の鐘が鳴らなくなって、\n町の時が狂っちゃったわ。', '「灯りの刻の始め」に鳴る鐘を、\nどうして朝の鐘って呼ぶのか、\n誰も知らないのにね。']);
  });
  E('loch_boy', async (ev) => {
    await ev.say('boy_south', cleared(ev) ? 'おじいちゃんが、館に\n花を持っていくんだって。' : ['おじいちゃんは町長なんだ。\n集会を開くのは、おじいちゃん。', '証拠がないと、\n誰も話を聞かないって。']);
  });
  E('loch_ferryman', async (ev) => {
    await ev.say('ferryman', ['渡し守のグンターだ。\n運河の向こうへ渡すよ。\n舟着きで、竿の舟に声をかけな。']);
  });
  E('loch_ferry', async (ev, ctx) => {
    const o = ctx && R.DB.maps.loch && (R.DB.maps.loch.objects || []).find((q) => q.type === 'examine' && q.event === 'loch_ferry' && q.x === ctx.x && q.y === ctx.y);
    const side = (o && o.side) || 'n';
    const i = await ev.choose(['渡る', 'やめる'], { text: '竿の舟で、運河を渡る？' });
    if (i !== 0) return;
    await ev.fade('out', 400);
    await ev.warp('loch', side === 'n' ? 'ferry_s' : 'ferry_n');
  }, { meta: { needs: [], gives: [] } });
  E('loch_board', async (ev) => {
    const lines = [];
    lines.push(cleared(ev) ? '「祝・鐘の音、戻る。\n今宵、七つの鐘楼に灯をともす。\n――町長オスヴァルト」' : '「霧の晩の外出、控えられたし。\n子を持つ家は、窓に鈴を下げよ。\n――町長」');
    lines.push(ev.flag('marsh_cat_done') ? '「猫のミーナ、戻る。礼」' : '「夜市の猫、ミーナ。\n見かけた方は夜市の筏まで」');
    if (X().tier() >= 2) lines.push('「北の山あいの街道、\n落石に注意」');
    await ev.say(null, lines);
  });
  E('loch_bell_tongue', async (ev) => {
    await ev.say(null, ['大鐘の舌だ。人の背より大きい\n青銅の棒が、広場に横たわっている。', '大鐘が塔から落ちたとき、\n舌だけが先に折れて\nここに落ちたのだという。']);
  });

  // ---------------------------------------------------------------- 店・酒場
  E('loch_item_keeper', async (ev) => { await ev.say('item_keeper', '大鐘の道具屋へようこそ。\n霧の晩の備えは、ここで。'); await ev.shop('shop_loch_items'); });
  E('loch_smith', async (ev) => { await ev.say('smith', '鐘の青銅を打ち直した刃もあるぞ。\n……冗談だ。'); await ev.shop('shop_loch_arms'); });
  E('loch_barkeep', async (ev) => {
    await ev.say('barkeep', cleared(ev) ? ['鐘の腹の酒場へ、ようこそ。', '鐘が鳴るたびに、\n店じゅうがびりびり響くんだ。\n……懐かしい揺れさ。'] : ['鐘の腹の酒場へ、ようこそ。', '町長は集会所だ。証拠を\n持っていけば、話は聞くだろう。\n証拠がなけりゃ、門前払いさ。']);
    ev.lead('l_marsh_evidence');
  }, { meta: { needs: [], gives: ['lead:l_marsh_evidence'] } });
  E('loch_tav_bard', async (ev) => {
    await ev.say('tav_bard', ['湿原の西の池の話を知ってる？\n消灯の刻だけ、青く光る蓮が咲く。', '見た者は、みんな\n胸がすうっとするんだって。']);
    ev.lead('l_opt_lotus');
  }, { meta: { needs: [], gives: ['lead:l_opt_lotus'] } });
  E('loch_tav_sailor', async (ev) => {
    await ev.say('tav_sailor', ['沼の霧食らいを知ってるか。\n霧の手で眠らせ、魔女のまねで\n呪いを吐くって話だ。', '霧を吸いこむ前に、\nしっかり叩くことだな。\n吸われたら、傷がふさがっちまう。']);
  });
  E('loch_tav_match', async (ev) => {
    await ev.say('tav_match', cleared(ev) ? '霧が晴れたら、北の山あいの\n街道から、旅の人が\n増えたのよ。' : ['霧の晩は、店を早じまいよ。', 'ベッポの店、夜中に\n灯りがついてたって。\n……まさか、ね。']);
  });

  // ---------------------------------------------------------------- 町長・集会所（集会は loch_assembly）
  E('loch_mayor', async (ev) => { await ev.call('loch_assembly'); }, { meta: { needs: [], gives: [] } });
  E('loch_hall_clerk', async (ev) => {
    const n = X().count(ev);
    await ev.say('hall_clerk', ev.flag('marsh_assembly_done') ? '集会の書き付けは、わたしが\n残しておきますよ。……町の顔も、\n全部ね。' : n >= 4 ? '証拠が四つ。集会を開くには、\n十分ですよ。演台の町長に。' : `集会には、証拠が四つ要ります。\n今は、${n} つ。`);
  });
  E('loch_hall_board', async (ev) => { await ev.say(null, ['集会の決まりが貼ってある。', '「名指しは、証拠を示して行うべし。\n証拠なき名指しは、名指しにあらず」']); });
  E('loch_mayor_shelf', async (ev) => { await ev.say(null, ['町の古い記録が並んでいる。\n「日輪同盟へ、鐘をひとつ差し出す」\nとだけ書かれた頁がある。']); });
  E('loch_mayor_wife', async (ev) => {
    if (!ev.flag('marsh_mayor_wife_gift')) {
      ev.setFlag('marsh_mayor_wife_gift');
      await ev.say('mayor_wife', ['うちの人は頑固でね。\n証拠がないと、集会は\n開かないって。', 'これ、持っていって。\n霧の晩の、気付け薬よ。']);
      X().small(ev, [['i_waker', 3], ['i_waker', 4], ['i_clear', 3], ['i_clear', 4], ['i_panacea', 2]]);
      return;
    }
    await ev.say('mayor_wife', cleared(ev) ? '館に花を持っていくって、\nうちの人が言いだしたの。\n……遅いのよ、いつも。' : '町長は集会所よ。');
  });

  // ================================================================ 集会（推理の山場）
  E('loch_assembly', async (ev) => {
    const x = X();
    if (cleared(ev)) { await ev.say('mayor', ['集会の記録は、残しておくよ。\n町が何をしようとしたかも。', '……館に、花を持っていくつもりだ。']); return; }
    if (ev.flag('marsh_assembly_done')) {
      await ev.say('mayor', ev.has('k_bell_key') ? ['町の者が、沼の入口の霧を\n松明で押し広げた。', '鐘の鍵があるなら、\n沼の鐘を鳴らしてくれ。'] : ['沼の入口の霧は、押し広げた。', 'だが、沼の鐘は鍵がなけりゃ\n鳴らせん。……館のメルダなら、\n何か知っているかもしれん。']);
      if (!ev.has('k_bell_key')) ev.lead('l_marsh_manor');
      return;
    }
    const n = x.count(ev);
    if (n < 4) {
      await ev.say('mayor', ['町長のオスヴァルトだ。\n集会を開けというのか。', `証拠を四つ持ってきなさい。\n今は、${n} つだろう。`, '証拠なき名指しは、\n松明を持った連中と変わらん。']);
      ev.lead('l_marsh_evidence');
      return;
    }
    // 集会
    await ev.fade('out', 500);
    await ev.caption('集会所に、町の人が集まった。\n松明の匂いが、まだ残っている。', { ms: 2400 });
    await ev.fade('in', 400);
    await ev.say('mayor', ['では、名指しを聞こう。\n子どもたちを、誰がさらった？']);
    for (;;) {
      const i = await ev.choose(x.SUSPECTS.map((s) => s.name), { text: '誰を名指しする？' });
      const who = x.SUSPECTS[i].id;
      if (who === 'melda' && ev.flag('marsh_ev_melda') && !ev.flag('marsh_melda_warned')) {
        ev.setFlag('marsh_melda_warned');
        await ev.say(null, ['館で聞いたメルダの声が、\n胸によみがえる。', '――それは違う、と\n言えるはずだ。']);
        continue;
      }
      if (who !== 'mist') { await ev.call('loch_accuse_wrong', { who }); return; }
      break;
    }
    // 霧そのもの: 証拠を 3 つ示す
    await ev.say('mayor', ['霧……だと？\n霧が、子どもをさらうというのか。', '証拠を示しなさい。']);
    let good = 0;
    const shown = new Set();
    while (good < 3) {
      const list = x.EVIDENCE.filter((e) => x.has(ev, e.id) && !shown.has(e.id));
      if (!list.length) break;
      const i = await ev.choose(list.map((e) => e.name).concat(['やめる']), { text: `示す証拠（あと ${3 - good}）` });
      if (i >= list.length) break;
      const e = list[i];
      shown.add(e.id);
      await ev.say(null, e.say);
      if (e.right) {
        good++;
        await ev.say(null, good >= 3 ? '集会所が、しんと静まった。\n誰も、もう魔女の名を\n口にしなかった。' : '集会所が、ざわめいた。\n……何人かが、うなずいている。');
      } else {
        await ev.say(null, e.id === 'doll' ? '「人形を作ったのは、ベッポだろう！」\n……声が上がった。霧の話には\nならない。' : '「魔女の言うことを信じるのか！」\n……声が上がった。', { name: '町の人' });
      }
    }
    if (good < 3) {
      await ev.say('mayor', ['……それだけでは、\n町の者は納得せん。', 'もう少し、調べてきなさい。\n集会は、また開こう。']);
      return;
    }
    await ev.call('loch_assembly_right');
  }, {
    meta: {
      needs: ['flag:marsh_ev_foot', 'flag:marsh_ev_book', 'flag:marsh_ev_drawing', 'flag:marsh_ev_stone'],
      gives: ['flag:marsh_assembly_done', 'choice:ch_marsh_accuse', 'lead:l_marsh_bog'],
      calls: ['loch_accuse_wrong', 'loch_assembly_right'],
    },
  });

  // 正しい名指し: 町の人と沼へ（沼の入口の霧の壁を松明で押し広げる）
  E('loch_assembly_right', async (ev) => {
    if (ev.flag('marsh_assembly_done')) return;
    const wrong = ev.var('marsh_wrong');
    await ev.say('mayor', ['霧が、魔女の姿をまねて\n子どもを連れていった……。', '……わしらは、あやうく\n無実の館に火をかけるところだった。']);
    if (wrong) await ev.say('mayor', '捕まえた者は、今すぐ放そう。\nわしが、頭を下げに行く。');
    for (const w of ['beppo', 'tobias', 'melda']) if (ev.flag('marsh_held_' + w)) { ev.setFlag('marsh_held_' + w, false); ev.setFlag('marsh_held_' + w + '_was'); }
    ev.choice('ch_marsh_accuse', wrong ? 'wrong' : 'first');
    ev.setFlag('marsh_assembly_done');
    ev.leadDone('l_marsh_assembly');
    ev.leadDone('l_marsh_evidence');
    ev.lead('l_marsh_bog');
    await ev.fade('out', 600);
    await ev.caption('その夜、町の人は松明を持って\n沼の入口へ向かった。\n館ではなく、沼へ。', { ms: 2600 });
    await ev.caption('松明の火が、沼の入口の\n厚い霧の壁を押し広げた。\n霧の奥に、板の道が見える。', { ms: 2600 });
    await ev.fade('in', 400);
    await ev.say('mayor', ev.has('k_bell_key') ? '沼の入口は、町の南だ。\n鐘の鍵で、沈んだ鐘を鳴らしてくれ。' : ['沼の鐘を鳴らすには、\n鐘の鍵が要ると聞く。', '……館のメルダなら、\n何か知っているかもしれん。']);
  }, { meta: { needs: [], gives: ['flag:marsh_assembly_done', 'choice:ch_marsh_accuse', 'lead:l_marsh_bog'] } });

  // 間違えた名指し: その人が捕まり、その夜もう一人消える。翌朝、新しい証拠が 1 つ出る（3 回目の後は正しい証拠がそろう）
  E('loch_accuse_wrong', async (ev, ctx) => {
    const x = X();
    const who = (ctx && ctx.who) || 'beppo';
    const name = { melda: 'メルダ', beppo: 'ベッポ', tobias: 'トビアス' }[who];
    await ev.say('mayor', who === 'melda' ? ['霧の館の魔女、か。\n……町の者の多くが、そう言っておる。', '館に見張りを立て、\n魔女を封じる札を貼ろう。'] : [`${name}、か。`, '……よかろう。\n今夜は、見張りをつけて\n閉じこめておく。']);
    ev.setFlag('marsh_held_' + who);
    ev.addVar('marsh_wrong', 1);
    ev.addVar('marsh_lost', 1);
    await ev.fade('out', 800);
    await ev.caption('その夜。霧の濃い晩だった。', { ms: 2000 });
    await ev.caption('……朝になって、また一人、\n子どもが消えていた。', { ms: 2600 });
    ev.setFlag('marsh_night', false);
    await ev.warp('loch_hall', 'door');
    // 新しい証拠（正しい証拠のうち、まだ無い物を 1 つ。3 回目なら全部）
    const missing = x.EVIDENCE.filter((e) => e.right && !x.has(ev, e.id));
    const give = ev.var('marsh_wrong') >= 3 ? missing : missing.slice(0, 1);
    await ev.say('mayor', [`${name}は、見張りの前から\n一歩も出ておらん。……無理だ。`, 'わしらは、間違えたのか。']);
    for (const e of give) {
      await ev.say(null, { foot: '朝、運河の岸に、光る苔の\n小さな足あとが残っていた。\n沼の方へ。', book: 'トビアスの記録帳が、集会所に\n届けられた。鐘の止まった晩から、\n子どもが消えている。', drawing: 'リナが、描いた絵を\n集会所に持ってきた。', stone: '沼の縁の石碑の写しが、\n集会所に届いた。\n歌の最後の節が、削れている。' }[e.id]);
      await x.give(ev, e.id);
    }
    await ev.say('mayor', 'もう一度、集会を開こう。\n今度こそ、証拠を示してくれ。');
  }, { meta: { needs: [], gives: ['var:marsh_wrong'] } });

  // ================================================================ 依頼
  // 迷い猫ミーナ（夜の高床の下）
  E('loch_night_owl', async (ev) => {
    if (ev.flag('marsh_cat_done')) { await ev.say('night_owl', 'ミーナ、ほら、お礼を\n言いなさい。……ニャア、だって。'); return; }
    if (ev.flag('marsh_cat_found')) {
      ev.take('k_lost_cat', 1);
      ev.setFlag('marsh_cat_done');
      ev.leadDone('q_marsh_cat');
      await ev.say('night_owl', ['ミーナ！　どこへ行ってたの。', 'ありがとうねえ。\nこれ、夜市の売れ残りだけど。']);
      X().small(ev, [['i_ether', 2], ['i_ether', 2], ['i_ether', 3], ['i_ether2', 1], ['i_ether2', 2]]);
      return;
    }
    await ev.say('night_owl', ['うちの猫のミーナがね、\n消灯の刻に高床の下へ\nもぐったきり、戻らないの。', 'ベッポの店の方で、\n鳴き声がした気がするんだけど。']);
    ev.setFlag('q_marsh_cat_on');
    ev.lead('q_marsh_cat');
  }, { meta: { needs: ['flag:marsh_night'], gives: ['flag:q_marsh_cat_on', 'lead:q_marsh_cat', 'flag:marsh_cat_done'] } });
  E('loch_cat', async (ev) => {
    await ev.say('lost_cat', 'ニャア。');
    ev.setFlag('marsh_cat_found');
    ev.item('k_lost_cat', 1);
    try { await ev.leave('lost_cat', { ms: 500 }); } catch (e) { /* */ }
    await ev.caption('首輪に「ミーナ」とある。\n夜市のばあさまのところへ\n連れていこう。', { ms: 2000 });
  }, { meta: { needs: ['flag:q_marsh_cat_on'], gives: ['flag:marsh_cat_found', 'item:k_lost_cat'] } });

  // 【灯りを守る】運河の灯籠（消灯の刻に、油で 3 つ）
  E('loch_lampkeeper', async (ev) => {
    if (ev.flag('marsh_lanterns_done')) { await ev.say('lamp_keeper', '運河の灯籠のまわりは、\n霧の魔物も寄りつかん。\n灯りってのは、ありがたいもんだ。'); return; }
    const lit = [1, 2, 3].filter((n) => ev.flag('marsh_canal_lamp_' + n)).length;
    if (lit >= 3) {
      ev.setFlag('marsh_lanterns_done');
      ev.leadDone('q_marsh_lanterns');
      ev.take('k_canal_oil', 1);
      await ev.say('lamp_keeper', ['三つとも、ともしてくれたか。\n運河が、ずいぶん明るくなった。', 'これは灯籠守の給金の分け前だ。']);
      X().small(ev, [['gold', 200], ['gold', 300], ['gold', 450], ['gold', 600], ['gold', 800]]);
      return;
    }
    if (ev.has('k_canal_oil')) { await ev.say('lamp_keeper', `運河の灯籠は、あと ${3 - lit} つだ。\n消灯の刻に、杭の灯籠へ\n油をさしてくれ。`); return; }
    await ev.say('lamp_keeper', ['灯籠守のヨストだ。\n霧のせいで、運河の灯籠が\n三つも消えちまった。', '消灯の刻に、この油で\nともして回ってくれんか。\n運河ぞいの杭の灯籠だ。']);
    ev.item('k_canal_oil', 1);
    ev.setFlag('q_marsh_lanterns_on');
    ev.lead('q_marsh_lanterns');
  }, { meta: { needs: [], gives: ['item:k_canal_oil', 'flag:q_marsh_lanterns_on', 'lead:q_marsh_lanterns', 'flag:marsh_lanterns_done'] } });
  E('loch_canal_lamp', async (ev, ctx) => {
    const o = ctx && R.DB.maps.loch && (R.DB.maps.loch.objects || []).find((q) => q.type === 'examine' && q.event === 'loch_canal_lamp' && q.x === ctx.x && q.y === ctx.y);
    const n = (o && o.lamp) || 1;
    if (ev.flag('marsh_canal_lamp_' + n)) { await ev.say(null, '灯籠が、運河の水に\n揺れる光を落としている。'); return; }
    if (!night(ev)) { await ev.say(null, '杭の上の、消えた灯籠。\n火をともすのは、消灯の刻だ。'); return; }
    if (!ev.has('k_canal_oil')) { await ev.say(null, '杭の上の、消えた灯籠。\n油が、すっかり乾いている。'); return; }
    ev.setFlag('marsh_canal_lamp_' + n);
    ev.sfx('fire');
    await ev.say(null, '灯籠に油をさして、火をともした。');
  }, { meta: { needs: ['flag:q_marsh_lanterns_on', 'flag:marsh_night'], gives: ['flag:marsh_canal_lamp_1', 'flag:marsh_canal_lamp_2', 'flag:marsh_canal_lamp_3'] } });

  // 夜市（消灯の刻だけ）
  E('loch_night_market', async (ev) => {
    await ev.say('night_vendor', ['夜市へようこそ。\n消灯の刻だけの、秘密の市さ。', X().tier() >= 2 ? '今夜は、ちょっと珍しいお守りも\n仕入れてあるよ。' : '蓮の露なんて、どうだい。']);
    await ev.shop('shop_loch_night');
  });
})(window.RPG);
