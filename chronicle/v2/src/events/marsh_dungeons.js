// 霧の館・鐘沈みの沼と湿原の締め（WORLD_REDESIGN §4.4 の 2・4・5・§4.10、STORY_BIBLE §7.4・§11.8）
//   館: manor_arrive・書庫の楽譜の書き付け（オルゴールの順）・2 階のオルゴール 3 つ（任意の隠し箱）・音楽室の人形の楽団（tr_b_dolls）→
//       メルダ（v_melda_manor_01〜05 の文のまま。証拠 5、鐘の鍵、鐘の歌）
//   沼: bog_arrive・鐘 3 つ（鐘の鍵で鳴らすと水が引く）・霧食らい（v_mistwitch_marsh_01 → tr_b_mistbeast → v_melda_marsh_01）→
//       marsh_finale（子どもたちが見つかる → ev.clearRegion('r_marsh') → ロッホで朝の鐘・七つの鐘楼の灯・クラウスの墨の楽譜・日継ぎの主張 →
//       年代記に書く選択 ch_marsh_write → 帽子かおわびの品）
//   ワールド: 沼の縁の鐘の歌の石碑（証拠 6）・沼の入口の霧の壁・山あいの街道の旅人。
//   録音済みの文は 1 字も変えずに地の文として置く（声はあとで）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Marsh.ev;
  const objAt = (ctx, map, event) => { const m = R.DB.maps[map]; return m && ctx && (m.objects || []).find((o) => o.type === 'examine' && o.event === event && o.x === ctx.x && o.y === ctx.y); };
  const MELDA = { name: 'メルダ' };
  const WITCH = { name: '霧食らい', face: false };

  // ================================================================ 霧の館
  E('manor_arrive', async (ev) => {
    if (X().cleared(ev)) { await ev.caption('霧の館。楽の音は、もう聞こえない。', { ms: 2000 }); return; }
    await ev.caption('霧の館。\n誰もいないはずの館の奥から、\nかすかに楽の音が聞こえる。', { ms: 2600 });
  });
  E('manor_2_arrive', async (ev) => {
    if (ev.flag('marsh_dolls')) return;
    await ev.caption('楽の音が、はっきり聞こえる。\n北の、音楽室からだ。', { ms: 2000 });
  });
  E('manor_sheet', async (ev) => {
    ev.setFlag('marsh_sheet_read');
    await ev.say(null, ['書庫の棚に、楽譜の書き付けが\nはさまっている。', '「夜の演奏会の始め方。\nまず弦、次に笛、最後に太鼓。\n三つの箱を、この順に」']);
  }, { meta: { needs: [], gives: ['flag:marsh_sheet_read'] } });
  E('manor_portrait', async (ev) => {
    await ev.say(null, ['大広間の肖像画。灰色の髪の\n婦人が、青銅の鐘を抱いている。', '額の銘板に「館の主・メルダ」。\n……魔女には、見えない。']);
  });
  E('manor_fountain', async (ev) => {
    await ev.say(null, ev.flag('marsh_melda_met') ? ['枯れた噴水の像が、鐘を掲げている。', '像の足もとに、小さく\n「鳴れよ、七つの鐘」と彫られていた。'] : ['枯れた噴水。まん中の像は、\n鐘を掲げた婦人の姿だ。', '水盤の底に、落ち葉と\n泥がたまっている。']);
  });
  E('manor_dining', async (ev) => { await ev.say(null, ['長い食卓に、七人ぶんの\n食器が並べられたまま、\n厚いほこりをかぶっている。']); });
  E('manor_stand', async (ev) => {
    await ev.say(null, ev.flag('marsh_dolls') ? '譜面台の楽譜は、途中で\n止まったままだ。' : ['音楽室の譜面台。楽譜の題は\n「夜の演奏会」。', '終わりの小節が、どこにもない。\n……ずっと、くり返すための曲だ。']);
  });
  E('manor_mirror', async (ev) => {
    await ev.say(null, ['鏡台の鏡は、曇っている。', X().cleared(ev) ? '曇りの中に、小さく\n「ありがとう」と指で\n書いた跡がある。' : '鏡の曇りに、指で書いたような跡。\n「霧を、鐘で」']);
  });
  // オルゴール 3 つ（弦・笛・太鼓の順。任意。そろうと回廊の飾り棚に箱が現れる）
  E('manor_musicbox', async (ev, ctx) => {
    const o = objAt(ctx, 'marsh_manor_2', 'manor_musicbox');
    const box = (o && o.box) || 'strings';
    const ORDER = ['strings', 'flute', 'drum'];
    const NAME = { strings: '弦', flute: '笛', drum: '太鼓' };
    if (ev.flag('marsh_boxes_done')) { await ev.say(null, 'オルゴールは、静かに止まっている。'); return; }
    const i = await ev.choose(['ねじを巻く', 'やめる'], { text: `${NAME[box]}の音のオルゴールだ。` });
    if (i !== 0) return;
    const step = ev.var('marsh_box_step');
    if (ORDER[step] === box) {
      ev.setVar('marsh_box_step', step + 1);
      ev.sfx('chime');
      await ev.say(null, `${NAME[box]}の音が、館に響いた。`);
      if (step + 1 >= 3) {
        ev.setFlag('marsh_boxes_done');
        await ev.caption('三つの音が重なった。\n回廊の飾り棚で、\nかちり、と錠の外れる音がした。', { ms: 2400 });
      }
    } else {
      ev.setVar('marsh_box_step', 0);
      await ev.say(null, ['音が、ちぐはぐに鳴って\nすぐに止まった。', '……順番が、違うらしい。']);
    }
  }, { meta: { needs: ['flag:marsh_sheet_read'], gives: ['flag:marsh_boxes_done'] } });

  // 人形の楽団（中ボス）
  E('manor_band', async (ev) => {
    if (ev.flag('marsh_dolls')) return;
    ev.bgm('omen');
    await ev.say(null, ['音楽室の舞台で、等身大の人形が\n四体、楽器を奏でていた。', '指揮者の人形が、棒を上げた。\n……演奏が、ぴたりと止まる。', '人形たちの首が、いっせいに\nこちらを向いた。']);
    const r = await ev.battle('tr_b_dolls', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('marsh_dolls');
    await ev.say(null, ['人形たちは糸が切れたように\n崩れ落ちた。楽の音が、やんだ。', '……奥の部屋から、誰かの\nため息のような声がした。']);
    try { await ev.appear('melda', { ms: 900 }); } catch (e) { /* */ }
  }, { meta: { needs: [], gives: ['flag:marsh_dolls'] } });

  // メルダ（録音の文のまま。声はあとで）→ 証拠 5・鐘の鍵・鐘の歌
  E('manor_melda', async (ev) => {
    if (!ev.flag('marsh_dolls')) return;
    if (ev.flag('marsh_melda_met')) {
      await ev.say('melda', ev.flag('marsh_assembly_done') ? ['町の人たちが、沼の霧を\n押し広げたのね。', '沼の鐘を、お願い。'] : ['町の人たちは、わたしを\n燃やしたいのでしょう。', 'かまわないわ。……でも、\n子どもたちは、沼にいる。'], MELDA);
      return;
    }
    ev.setFlag('marsh_melda_met');
    ev.bgm('sorrow');
    await ev.say(null, '奥の部屋に、青白い婦人の姿が\n浮かび上がった。');
    await ev.say('melda', '……驚かせてしまったわね。\nわたしはメルダ。\nこの館の、昔の主よ。', Object.assign({ voice: 'v_melda_manor_01' }, MELDA));
    await ev.say('melda', 'わたしは子どもたちを\nさらってなどいない。\n霧が、わたしの姿をまねているの。', Object.assign({ voice: 'v_melda_manor_02' }, MELDA));
    await ev.say('melda', '昔、沼の霧から魔物があふれたとき、\nわたしは七つの鐘を沈めて、\n鐘の音で霧を封じたの。', Object.assign({ voice: 'v_melda_manor_03' }, MELDA));
    await ev.say('melda', 'でも、町の人たちが鐘の歌を忘れて、\n鐘は鳴らなくなった……。', Object.assign({ voice: 'v_melda_manor_04' }, MELDA));
    await ev.say('melda', '沼の鐘を鳴らして。\nこれは鐘の鍵。\nそして、これが鐘の歌よ。', Object.assign({ voice: 'v_melda_manor_05' }, MELDA));
    ev.item('k_bell_key', 1);
    await ev.caption(X().SONG, { ms: 3200, voice: X().SONG_VOICE });
    await X().lore(ev, 'lo_marsh_song');
    ev.leadDone('l_marsh_manor');
    ev.lead('l_marsh_bog');
    await X().evidence(ev, 'melda');
    if (!ev.flag('marsh_assembly_done')) await ev.say(null, ['……けれど、町の人は\n魔女の言葉を信じないだろう。', '沼へ入るには、町の集会で\n町の人を説き伏せなければ。']);
    ev.mapBgm();
  }, { meta: { needs: ['flag:marsh_dolls'], gives: ['flag:marsh_melda_met', 'item:k_bell_key', 'lore:lo_marsh_song', 'flag:marsh_ev_melda', 'lead:l_marsh_ev_melda', 'var:marsh_evidence', 'lead:l_marsh_bog'] } });

  // ================================================================ 鐘沈みの沼
  E('bog_arrive', async (ev) => {
    if (X().cleared(ev)) return;
    await ev.caption('鐘沈みの沼。\n霧が、足もとで渦を巻いている。', { ms: 2200 });
    if (!ev.has('k_bell_key')) await ev.caption('沈んだ鐘を鳴らすには、\n鐘の鍵が要るという。', { ms: 2000 });
  });
  E('bog_bell', async (ev, ctx) => {
    const o = objAt(ctx, 'marsh_bog', 'bog_bell');
    const n = (o && o.bell) || 1;
    const f = 'marsh_bell_' + n;
    if (ev.flag(f)) { await ev.say(null, '鐘が、まだ低く震えている。'); return; }
    await ev.say(null, '沈んだ鐘楼の頭。青銅の鐘が、\n泥の上に口を開けている。');
    if (!ev.has('k_bell_key')) { await ev.say(null, '鐘の舌が、さびた錠で\n留められている。……鍵が要る。'); return; }
    await ev.say(null, ['鐘の鍵で錠を外し、\n鐘の歌を口ずさみながら、\n綱を引いた。', X().SONG]);
    ev.sfx('bell');
    try { R.Field.shake(3, 600); } catch (e) { /* */ }
    ev.setFlag(f);
    const rung = [1, 2, 3].filter((k) => ev.flag('marsh_bell_' + k)).length;
    await ev.caption(n === 3 ? 'ゴォォン……。\n沼のまん中の霧が、\nひとところに集まっていく。' : 'ゴォォン……。\n鐘の音が沼を渡り、\nあたりの水が、すうっと引いた。', { ms: 2400 });
    if (n !== 3 && ev.flag('marsh_bell_1') && ev.flag('marsh_bell_2')) await ev.caption('西の小島から北へ、\n泥の道が現れた。', { ms: 2000 });
    if (n === 3) await ev.caption('北の鐘の小島から、\n沼のまん中へ、泥の道が現れた。', { ms: 2000 });
    if (rung === 1) ev.lead('l_marsh_bog');
  }, { meta: { needs: ['item:k_bell_key'], gives: ['flag:marsh_bell_1', 'flag:marsh_bell_2', 'flag:marsh_bell_3'] } });
  E('bog_stone', async (ev) => {
    await ev.say(null, ['こけむした石碑。沼の縁の石碑と\n同じ歌が彫られている。', 'こちらは、最後の節まで\n残っていた。', X().SONG]);
    await X().lore(ev, 'lo_marsh_song');
  }, { meta: { needs: [], gives: ['lore:lo_marsh_song'] } });

  // 霧食らい（録音の文のまま）→ メルダ → 子どもたち → 締め
  E('bog_mistbeast', async (ev) => {
    if (ev.flag('marsh_mistbeast') || !ev.flag('marsh_bell_3')) return;
    ev.bgm('omen');
    try { R.Field.shake(5, 900); } catch (e) { /* */ }
    await ev.caption('霧が集まり、灰色の婦人の\n形になった。……メルダの姿だ。\n顔だけが、ない。', { ms: 2600 });
    await ev.say('mistwitch', '……オイデ……コドモタチ……\nワスレラレタ……カネノ……ウタ……。', Object.assign({ voice: 'v_mistwitch_marsh_01' }, WITCH));
    ev.sfx('roar');
    const r = await ev.battle('tr_b_mistbeast', { boss: true });
    if (r !== 'win') { ev.mapBgm(); return; }
    ev.setFlag('marsh_mistbeast');
    await ev.say(null, '霧食らいはほどけて、\n沼の底へ沈んでいった。');
    ev.bgm('dawn');
    await ev.say(null, 'どこからか、メルダの声がした。');
    await ev.say('melda', 'ありがとう、語り部さん。\nこれでまた、町の朝に\n鐘が鳴るわ。', Object.assign({ voice: 'v_melda_marsh_01' }, MELDA));
    await ev.caption('南東の小島で、子どもたちが\n身を寄せ合って眠っていた。', { ms: 2400 });
    try { await ev.appear(['bog_kid_a', 'bog_kid_b'], { ms: 900 }); } catch (e) { /* */ }
    await ev.call('marsh_finale');
  }, {
    meta: {
      needs: ['flag:marsh_bell_3'],
      gives: ['flag:marsh_mistbeast', 'region:r_marsh', 'flag:marsh_finale_done', 'choice:ch_marsh_write', 'flag:marsh_reward_given'],
      calls: ['marsh_finale'],
    },
  });
  E('bog_kids', async (ev, ctx) => {
    await ev.say((ctx && ctx.npc) || 'bog_kid_a', ['……おかあさんのところに、\nかえりたい。', 'おばあさんの歌が、\nきこえなくなったの。']);
  });

  // ---------------------------------------------------------------- 灯り直す場面と締め
  E('marsh_finale', async (ev) => {
    if (ev.flag('marsh_finale_done')) return;
    // 大灯火（七つの鐘楼の灯）: ページ・ティア・光の柱・章の札（EVENTS の共通の筋）
    await ev.clearRegion('r_marsh');
    ev.bgm('dawn');
    ev.sfx('bell');
    await ev.fade('out', 800);
    await ev.warp('loch', 'plaza');
    await ev.caption('ロッホ。朝の鐘が鳴った。\nひとつ、ふたつ……七つ。', { ms: 2600 });
    await ev.caption('七つの鐘楼に灯がともり、\n霧が、湖から\nゆっくりと退いていく。', { ms: 3000 });
    await ev.caption('子どもたちは、母親の腕の中で\nまだ眠っていた。', { ms: 2200 });
    // クラウスが、メルダの歌を聞き取って楽譜を墨で書き直す
    await ev.say(null, ['記録官のクラウスが、\n鐘楼の下で筆を走らせていた。', '沼から聞こえた歌を、\n五線の上に書き取っている。'], { face: false });
    await ev.say(null, '「書くのは、得意なんです。\n……今度は、忘れないように」', { name: 'クラウス' });
    ev.item('k_ink_score', 1);
    await ev.say(null, ['「朝の鐘が太陽を呼ぶ。\n鐘が鳴らねば、日は昇らぬ」', '……鐘の下で、年寄りが\nそう言って手を合わせていた。'], { face: false });
    // 年代記に書く選択（ch_marsh_write。痛みの側は pain_count を足す）
    await ev.say(null, '{hero}は、年代記を開いた。\nこの町のことを、どう書こう。');
    const i = await ev.choose(['霧と鐘の話として書く', '町が魔女の館を焼こうとしたことも書く'], { text: '年代記に何を書く？' });
    if (i === 1) {
      ev.choice('ch_marsh_write', 'pain');
      ev.addVar('pain_count', 1);
      await ev.say(null, '「……町は松明を持って館を囲んだ。\nその夜の町の顔も、ここに記す」');
    } else {
      ev.choice('ch_marsh_write', 'legend');
      await ev.say(null, '「霧は魔女の姿をまね、\n子どもをさらった……」');
    }
    ev.sfx('quill');
    ev.setFlag('marsh_finale_done');
    ev.setFlag('marsh_melda_gone');
    ev.leadDone('l_marsh_bog');
    ev.leadDone('l_marsh_mist');
    await ev.call('marsh_reward');
    ev.mapBgm();
  }, { meta: { needs: ['flag:marsh_mistbeast'], gives: ['region:r_marsh', 'flag:marsh_finale_done', 'choice:ch_marsh_write', 'item:k_ink_score', 'flag:marsh_melda_gone'], calls: ['marsh_reward'], warp: { to: 'loch', spawn: 'plaza' } } });
  // 町長の礼（一度で正しく名指し: 探偵の帽子／間違えた: わびの鈴。同じ強さ）
  E('marsh_reward', async (ev) => {
    if (ev.flag('marsh_reward_given')) return;
    ev.setFlag('marsh_reward_given');
    const wrong = ev.var('marsh_wrong');
    if (!wrong) {
      await ev.say(null, ['町長のオスヴァルトが、\n古い帽子を差し出した。', '「集会で、まっすぐ霧を\n指さした者に。……この町の、\n昔の探偵の帽子だ」'], { face: false });
      ev.item('u_sleuth_hat', 1);
    } else {
      await ev.say(null, ['町長のオスヴァルトは、\n捕まえた者の家を一軒ずつ回り、\n頭を下げた。', '「町が罪なき人を責めた。\nそのおわびの鈴を、\nあなたにも」'], { face: false });
      ev.item('u_apology_bell', 1);
    }
    if (ev.choiceOf('ch_marsh_write') === 'pain') await ev.caption('館の前に、町の人が\n花を置きに行く列ができていた。', { ms: 2400 });
  }, { meta: { needs: ['flag:marsh_finale_done'], gives: ['flag:marsh_reward_given', 'item:u_sleuth_hat|u_apology_bell'] } });

  // ================================================================ ワールド
  // 沼の縁の鐘の歌の石碑（証拠 6）
  E('marsh_songstone', async (ev) => {
    await ev.say(null, ['沼の縁の、古い石碑。\n鐘の歌が彫られている。', X().SONG_CUT, '最後の節だけが、\n何かで削り取られていた。']);
    if (ev.flag('marsh_emma_met')) await X().evidence(ev, 'stone');
  }, { meta: { needs: ['flag:marsh_emma_met'], gives: ['flag:marsh_ev_stone', 'lead:l_marsh_ev_stone', 'var:marsh_evidence'] } });
  // 沼の入口の霧の壁（集会の前）
  E('marsh_mistwall', async (ev) => {
    await ev.say(null, ['沼の入口を、厚い霧の壁が\nふさいでいる。', '一歩踏み込むと、方角が\nわからなくなる。……ひとりでは\n入れそうにない。']);
    if (ev.flag('marsh_can_assemble')) await ev.say(null, '町の人の手を借りられれば……。\n集会所の町長に頼んでみよう。');
  });
  E('marsh_world_traveler', async (ev) => {
    await ev.say('marsh_traveler', X().cleared(ev) ? ['ロッホの鐘が鳴ったってな。\n朝の鐘ってのは、いい音だ。'] : ['この先がグレイモア湿原だ。\n霧の晩は、道を外れるなよ。', '湿原の町ロッホじゃ、\n子どもが消えるって騒ぎだ。']);
    ev.lead('l_marsh_mist');
  }, { meta: { needs: [], gives: ['lead:l_marsh_mist'] } });
  E('marsh_lotus', async (ev) => {
    ev.addVar('marsh_lotus_seen', 1);
    await ev.say(null, ['池の蓮が、青く光っている。\n夜の霧の中で、そこだけが明るい。', '胸の奥が、すうっと\n冷えて澄んでいく。']);
  }, { meta: { needs: [], gives: ['var:marsh_lotus_seen'] } });
})(window.RPG);
