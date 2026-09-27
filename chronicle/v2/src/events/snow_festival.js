// 大火祭の支度・大火祭の夜・籠城（3 波）・朝の鐘。WORLD_REDESIGN §4.3 の 1〜4・§4.10（吹雪の大狼）、STORY_BIBLE §7.3、E15（連戦）
//   支度の 3 つ（順番自由）: 薪（雪の林の倒木 3 本、snow_woods.js のイベント）・氷の灯籠（釣り小屋のトーレにのこぎりを借りて凍った池で切り出す、
//     R.Mini.timing）・昔話（イングリッド／オラフ／ブレンダの 3 人から聞く）。薪と昔話がそろえば祭を始められる（氷の灯籠は無くてもよい。
//     ただし白竜と「語る」道は、3 つともそろえて「竜と娘の約束」を語ったときだけ）。
//   大火祭の夜（snow_festival）: 語る話を選ぶ（ch_snow_tale）→ 字幕で語る → 吹雪と狼の群れ → 籠城。
//   籠城（snow_siege_wave。yule_night で村長に話すと次の波）: 波ごとに守る門を選ぶ（ch_snow_gate_<n>）。見張りのハルドが遠吠えの方角を教える。
//     守った門で 2 戦（猟師が加勢すると 1 戦目が 1 匹少ない）、そのあと大かまどで全快。いちばん強く押された門を守らなければ、そこが破られる
//     （snow_gate_<g>_broken: 見た目と台詞と店。失敗は無い）。3 波目は群れの頭「吹雪の大狼」: 一度も守らなかった門を狙う（読み合い）。
//     読み当てれば門の前で迎え撃つ（援軍が少ない）。外せば門が破られ、大かまどの前で戦う（守らなかった門の数だけ援軍）。
//   朝の鐘（snow_dawn）: 見張り台に灰色のマントの少女（録音の文のまま、声なし）→ ソーニャが冬至の火の火種 → 峰へ。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Snow.ev;

  // ================================================================ 支度: 昔話（3 人の年寄り）
  async function tellTale(ev, key, who, intro, after) {
    const T = X().TALES[key];
    if (ev.flag('snow_tale_' + key)) {
      await ev.say(who, after);
      return;
    }
    await ev.say(who, intro);
    ev.sfx('quill');
    for (const l of T.lines) await ev.caption(l, { ms: 2600 });
    ev.setFlag('snow_tale_' + key);
    await ev.caption(`昔話「${T.name}」を覚えた。`, { ms: 1800 });
    const n = ['dragon', 'hunter', 'fire_child'].filter((k) => ev.flag('snow_tale_' + k)).length;
    if (n >= 3 && !ev.flag('snow_tales_done')) {
      ev.setFlag('snow_tales_done');
      ev.leadDone('q_snow_ingrid');
      await ev.caption('三つの昔話を聞いた。\nどれを祭で語るかは、火の前で決めよう。', { ms: 2600 });
    }
  }
  E('yule_ingrid', async (ev) => {
    if (X().cleared(ev)) { await ev.say('ingrid', ['竜は、物語を覚えていてくれた。\n……語り継ぐって、そういうこと。', 'あなたの話も、いつか\n誰かが語るわ。']); return; }
    await tellTale(ev, 'dragon', 'ingrid',
      ['祭の話が要るのかい。\nそれなら、この村でいちばん\n古い話をしてあげよう。', '火の前で語るための話さ。\n……よく聞いておくれ。'],
      ['竜が好きなのは、火じゃない。\n物語のほうさ。', '火は、物語を運ぶ\n灯りにすぎないのよ。']);
  }, { meta: { needs: [], gives: ['flag:snow_tale_dragon', 'flag:snow_tales_done'] } });
  E('yule_olaf', async (ev) => {
    if (X().cleared(ev)) { await ev.say('olaf', '狼どもも、吹雪がやんで\n山へ帰った。……また会おう、\nと言っておったよ。'); return; }
    await tellTale(ev, 'hunter', 'olaf',
      ['祭の話か。わしが知っとるのは、\n猟師の話だけだ。', '……わしのじいさまの\nそのまたじいさまの話さ。'],
      ['狼は恩を忘れん。\n人のほうが、よほど忘れっぽい。', '籠城になったら、\nわしも弓を持って出るぞ。']);
  }, { meta: { needs: [], gives: ['flag:snow_tale_hunter', 'flag:snow_tales_done'] } });
  E('yule_brenda', async (ev) => {
    if (X().cleared(ev)) { await ev.say('brenda', ['南の灰の荒野にもね、\n火を盗んだ子の話が\nあるんだって。', '旅の人に聞いたの。\n……同じ子かしら。']); return; }
    await tellTale(ev, 'fire_child', 'brenda',
      ['あら、語り部さん？\n祭の話ね。子どもの好きな\n話をしてあげる。', '火を盗んだ子どもの話よ。'],
      ['峰の氷の壁も、あの子の火なら\nとけるかもしれないねえ。', '……むかしの人は、\nそう言ってたよ。']);
  }, { meta: { needs: [], gives: ['flag:snow_tale_fire_child', 'flag:snow_tales_done'] } });

  // ================================================================ 支度: 氷の灯籠（釣り小屋のトーレ → 凍った池で切り出す）
  E('yule_fisher', async (ev) => {
    if (!ev.flag('snow_saw') && !ev.flag('snow_festival_lit')) {
      await ev.say('fisher', ['祭の氷の灯籠か。\nわしのとこの、のこぎりを\n貸してやろう。', '池の真ん中の氷がいちばん\n澄んどる。息を合わせて\n引けば、きれいに切れる。']);
      ev.item('k_ice_saw', 1);
      ev.setFlag('snow_saw');
    }
    await ev.call('snow_fishing_talk');
  }, { meta: { needs: [], gives: ['item:k_ice_saw', 'flag:snow_saw'], calls: ['snow_fishing_talk'] } });

  E('yule_pond_ice', async (ev) => {
    if (ev.flag('snow_ice_done')) { await ev.say(null, '灯籠の氷は、もう十分だ。'); return; }
    if (!ev.flag('snow_saw')) { await ev.say(null, ['凍った池。氷がとても厚い。', '釣り小屋ののこぎりがあれば、\n切り出せそうだ。']); return; }
    await ev.say(null, '氷にのこぎりを当てた。\n……息を合わせて、引く。');
    const r = (await ev.mini.timing({ title: '氷の切り出し', speed: 1500, zones: [[0.38, 0.62]], tries: 3, theme: 'night' })) || { hits: 3 };
    if (r.hits >= 2) {
      ev.sfx('item');
      ev.addVar('snow_ice_blocks', r.hits);
      await ev.caption(`澄んだ氷を、きれいに切り出した。\n（${Math.min(3, ev.var('snow_ice_blocks'))}/3）`, { ms: 1800 });
    } else {
      await ev.caption('氷が割れてしまった。\nもう一度。', { ms: 1600 });
    }
    if (ev.var('snow_ice_blocks') >= 3) {
      ev.take('k_ice_saw', 1);
      ev.item('k_ice_blocks', 1);
      ev.setFlag('snow_ice_done');
      await ev.caption('氷の灯籠の氷がそろった。\nのこぎりは、トーレに返しておこう。', { ms: 2400 });
    }
  }, { meta: { needs: ['flag:snow_saw'], gives: ['flag:snow_ice_done', 'item:k_ice_blocks'] } });

  // ================================================================ 大火祭の夜
  E('snow_festival', async (ev) => {
    const x = X();
    if (ev.flag('snow_festival_lit')) return;
    await ev.fade('out', 700);
    ev.setFlag('snow_festival_lit');
    await ev.warp('yule_night', 'hearth');
    ev.bgm('bonfire');
    await ev.caption('冬至の夜。\nユールの広場に、村じゅうの人が\n集まった。', { ms: 2600 });
    await ev.caption('大かまどに、一年ぶんの薪が\n積み上げられる。', { ms: 2200 });
    ev.sfx('fire');
    try { R.Field.flash('#ffb060', 500); } catch (e) { /* */ }
    await ev.caption('火が入った。\n――冬至の火が、夜空へ\n燃え上がる！', { ms: 2600 });
    if (ev.flag('snow_ice_done')) await ev.caption('氷の灯籠が、トンネルの入口ごとに\nいっせいにともった。\n村じゅうが、青く光っている。', { ms: 2800 });
    await ev.say('jorn', ['語り部よ。\n今年の物語を、火の前で\n語ってくれ。', '峰の竜に届くように。']);
    const keys = ['dragon', 'hunter', 'fire_child'].filter((k) => ev.flag('snow_tale_' + k));
    const i = await ev.choose(keys.map((k) => x.TALES[k].name), { text: '火の前で、どの話を語る？' });
    const key = keys[i] || keys[0];
    ev.choice('ch_snow_tale', key);
    await ev.say(null, '{hero}は、燃え上がる火の前に\n立った。');
    ev.bgm('legend');
    for (const l of x.TALES[key].lines) await ev.caption(l, { ms: 3000 });
    await ev.caption('語り終えると、広場は\nしんと静まり、それから\n大きな拍手がわいた。', { ms: 2600 });
    if (key === 'fire_child') await ev.say('sonja', 'ねえ、見て。火の粉が、\n峰のほうへ流れていく……。\nあの話の子の火みたい。');
    if (key === 'hunter') await ev.say('olaf_n', 'いい語りだった。\n……狼が来たら、この老いぼれも\n弓を取るぞ。', { name: 'オラフ' });
    // 吹雪と狼
    ev.bgm('omen');
    ev.sfx('roar');
    try { R.Field.shake(4, 600); } catch (e) { /* */ }
    await ev.caption('そのとき、吹雪が急に強まった。\n火の粉が、横なぐりに\n吹き散らされる。', { ms: 2600 });
    await ev.caption('吹雪の奥から、遠吠え。\nひとつ、ふたつ……\n数えきれない。', { ms: 2400 });
    await ev.say('hald', ['狼の群れだ！\n村を囲んでおる！', '門を閉めろ！\n男たちは門へ！']);
    await ev.say('jorn', ['門は三つ。北、東、西。\nわしらの手では、\n二つしか守りきれん。', '{hero}、力を貸してくれ。\n守る門を、選んでくれ。']);
    ev.leadDone('l_snow_prep');
    await ev.call('snow_siege_wave');
  }, {
    meta: {
      needs: ['flag:snow_logs_done', 'flag:snow_tales_done'],
      gives: ['flag:snow_festival_lit', 'choice:ch_snow_tale'],
      calls: ['snow_siege_wave'],
      warp: { to: 'yule_night', spawn: 'hearth' },
    },
  });

  // ================================================================ 籠城（1 波ずつ。村長に話すと次の波）
  const MAIN = { 1: 'n', 2: 'e' };
  const HINT = {
    1: ['遠吠えは……北だ！\n北の林から、いちばん\n大きな声がする。', 'ほかの門にも来るぞ。\n……だが、北が本命だ。'],
    2: ['今度は東だ。東の峠の道から、\n群れが押してくる。', '北と西は、小さな群れだけだ。'],
    3: ['……群れの頭の声がする。\n大狼だ。', '頭は賢い。これまで一度も\n守りを見せていない門を\n狙ってくるぞ。'],
  };
  const PICKS = ['北の門を守る', '東の門を守る', '西の門を守る', '大かまどで支度する'];
  const G_OF = ['n', 'e', 'w'];
  E('snow_siege_wave', async (ev) => {
    const x = X();
    if (ev.flag('snow_siege_done')) return;
    const w = ev.var('snow_wave') + 1;
    if (w > 3) return;
    await ev.say('hald', HINT[w], { name: 'ハルド' });
    const i = await ev.choose(PICKS, { cancel: 3, text: `第${w}の波。どの門を守る？` });
    if (i === 3 || i == null || i < 0) {
      await ev.say('jorn', '支度ができたら、わしに\n声をかけてくれ。\n大かまどのそばにおる。', { name: 'ヨルン' });
      return;
    }
    const g = G_OF[i];
    ev.choice('ch_snow_gate_' + w, g);
    const hunter = ev.choiceOf('ch_snow_tale') === 'hunter';
    await ev.fade('out', 400);
    await ev.warp('yule_night', 'def_' + g);
    await ev.caption(`${x.GATES[g]}へ走った。\n吹雪の向こうに、光る目が並んでいる。`, { ms: 2200 });
    const wins = async (list) => {
      for (let k = 0; k < list.length; k++) {
        if (k > 0) await ev.caption('次の群れが来る！', { ms: 1200 });
        const r = await ev.battle(list[k]);
        if (r !== 'win') return false;
      }
      return true;
    };
    if (w < 3) {
      if (hunter) await ev.say(null, 'オラフと村の猟師たちが、\n先に矢を放った！\n狼が一匹、逃げていく。');
      const ok = await wins(w === 1 ? [hunter ? 'tr_siege_1a_e' : 'tr_siege_1a', 'tr_siege_1b'] : [hunter ? 'tr_siege_2a_e' : 'tr_siege_2a', 'tr_siege_2b']);
      if (!ok) return;
      ev.mapBgm();
      const main = MAIN[w];
      if (g === main) {
        await ev.caption(`${x.GATES[g]}を守りきった！\nほかの門も、村の人たちが\nなんとか持ちこたえた。`, { ms: 2600 });
      } else {
        ev.setFlag('snow_gate_' + main + '_broken');
        ev.sfx('shake');
        await ev.caption(`${x.GATES[g]}は守りきった。\n……だが、${x.GATES[main]}が破られた！`, { ms: 2400 });
        await ev.caption({ n: '北の門の前の屋台が倒され、\n狼が広場まで入りこんだ。', e: '東の倉が荒らされた。\n鍛冶場の品が散らばっている。', w: '西のそり犬の小屋の柵が\n壊された。' }[main], { ms: 2400 });
      }
      ev.addVar('snow_wave', 1);
      await ev.fade('out', 400);
      await ev.warp('yule_night', 'hearth');
      ev.rest();
      await ev.caption('大かまどの火で体を温めた。\n（HP・MP が回復した）', { ms: 1800 });
      await ev.say('jorn', w === 1 ? 'まだ来るぞ。\n支度ができたら、声をかけてくれ。' : '次は、群れの頭が来る。\n……大狼だ。\n支度ができたら、声をかけてくれ。', { name: 'ヨルン' });
      return;
    }
    // 3 波目: 吹雪の大狼（一度も守らなかった門を狙う）
    const und = x.undefended(ev);
    const bossGate = und[0];
    let k;
    if (g === bossGate) {
      await ev.caption('読み当てた！\n吹雪の中から、大狼が\n姿を現した！', { ms: 2200 });
      k = Math.max(0, und.length - 1);
    } else {
      const ok = await wins([hunter ? 'tr_siege_3a_e' : 'tr_siege_3a']);
      if (!ok) return;
      ev.setFlag('snow_gate_' + bossGate + '_broken');
      ev.sfx('shake');
      await ev.caption(`遠吠え！　大狼が、${x.GATES[bossGate]}を破った！\n広場の大かまどへ向かっている！`, { ms: 2600 });
      await ev.fade('out', 300);
      await ev.warp('yule_night', 'hearth');
      k = Math.min(2, und.length);
    }
    ev.bgm('omen');
    await ev.say(null, '白い毛並みの、巨大な狼。\n吹雪が、その体にまとわりついている。');
    if (k > 0) await ev.say(null, k > 1 ? '守りの手薄な門から、\n狼の群れが次々に\n駆けこんでくる……！' : '守りの手薄な門から、\n狼が駆けこんでくる……！');
    const r = await ev.battle(['tr_b_blizzardwolf_0', 'tr_b_blizzardwolf_1', 'tr_b_blizzardwolf_2'][k], { boss: true });
    if (r !== 'win') return;
    ev.setFlag('snow_bwolf');
    ev.addVar('snow_wave', 1);
    ev.setFlag('snow_siege_done');
    ev.leadDone('l_snow_howl');
    ev.mapBgm();
    await ev.caption('大狼が倒れると、狼の群れは\n吹雪の中へ散っていった。', { ms: 2400 });
    await ev.call('snow_dawn');
  }, {
    meta: {
      needs: ['flag:snow_festival_lit'],
      gives: ['flag:snow_siege_done', 'flag:snow_bwolf', 'choice:ch_snow_gate_1', 'choice:ch_snow_gate_2', 'choice:ch_snow_gate_3'],
      calls: ['snow_dawn'],
    },
  });

  // 籠城の夜の人
  E('yule_siege_jorn', async (ev) => { if (!ev.flag('snow_siege_done')) await ev.call('snow_siege_wave'); }, { meta: { needs: ['flag:snow_festival_lit'], gives: [], calls: ['snow_siege_wave'] } });
  E('yule_siege_sonja', async (ev) => {
    await ev.say('sonja', ['火は、わたしが守る。\nだから……門を、お願い。', '大かまどの火のそばなら、\nいつでも温まれるわ。']);
    ev.rest();
  });
  E('yule_siege_hald', async (ev) => {
    const w = ev.var('snow_wave') + 1;
    await ev.say('hald', HINT[Math.min(3, w)] || '……静かになった。');
  });
  E('yule_siege_guard', async (ev, ctx) => {
    const id = ctx && ctx.npc;
    await ev.say(id, id === 'olaf_n' ? '祭の話のとおりにはいかんが、\n恩返しくらいはさせてもらう。' : '門は、おれたちが\nなんとか持たせる。\n……急いでくれ。');
  });

  // ================================================================ 朝の鐘（籠城が明ける）
  E('snow_dawn', async (ev) => {
    if (ev.flag('snow_dawn')) return;
    ev.setFlag('snow_dawn');
    await ev.fade('out', 900);
    await ev.warp('yule', 'watch');
    ev.bgm('dawn');
    ev.sfx('bell');
    await ev.caption('朝の鐘が鳴った。\n空は暗いまま。けれど、\n村の灯りが朝の色に変わる。', { ms: 3000 });
    // 見張り台の灰色のマントの少女（録音の文のまま。声はあとで）
    R.Audio.pushBgm('fine_theme');
    try {
      try { await ev.npc('fine').face('n'); } catch (e) { /* */ }
      await ev.say(null, '見張り台に、灰色のマントの少女が\n立っていた。峰を見上げている。');
      await ev.say('fine', '凍っているのは、竜の体じゃない。\n心のほうよ。', { name: '灰色のマントの少女' });
      ev.sfx('magic');
      // 見張りの台の東の端へ歩き、吹雪の中へ薄れて消える（パッと消さない）
      try { await ev.leave('fine', { path: [[32, 1], [33, 1]], ms: 900 }); } catch (e) { /* */ }
      ev.setFlag('snow_fine_seen');
      await ev.caption('少女の姿は、吹雪の中に\n溶けるように消えた。', { ms: 2000 });
    } finally { R.Audio.popBgm(); }
    // ソーニャと冬至の火の火種
    await ev.say('sonja', ['{hero}！　大かまどの火が、\nゆうべより強くなってるの。', '冬至の火を、火種に分けたわ。\n峰へ持っていって。\n氷の壁も、この火ならとける。']);
    ev.item('k_winter_flame', 1);
    ev.lead('l_snow_peak');
    if (ev.choiceOf('ch_snow_tale') === 'fire_child' && !ev.flag('snow_ice_1')) {
      ev.setFlag('snow_ice_1');
      await ev.say('sonja', ['それとね、見張りの人が言ってた。\n峰の入口の氷の壁が、\nゆうべのうちにとけたって。', '……あの話の子の火が、\n先に届いたのかもね。']);
    }
    const broken = ['n', 'e', 'w'].filter((g) => ev.flag('snow_gate_' + g + '_broken'));
    if (broken.length) await ev.say('jorn', [`${broken.map((g) => X().GATES[g]).join('と')}は、ひどくやられた。\n……だが、誰も死ななかった。`, '峰の竜のことは、頼む。'], { name: 'ヨルン' });
    else await ev.say('jorn', ['門は、ひとつも破られなかった。\n信じられん……。', '守りきった門の家の者が、\n礼をしたいと言っておったぞ。'], { name: 'ヨルン' });
    ev.mapBgm();
  }, { meta: { needs: ['flag:snow_siege_done'], gives: ['flag:snow_dawn', 'item:k_winter_flame', 'lead:l_snow_peak', 'flag:snow_fine_seen'], warp: { to: 'yule', spawn: 'watch' } } });

  // 籠城の途中で町を出た（全滅して宿へ・ワープ）: 昼のユールに入ったら夜へ戻す
  E('yule_siege_resume', async (ev) => {
    if (!ev.flag('snow_festival_lit') || ev.flag('snow_siege_done')) return;
    await ev.caption('村はまだ、狼に囲まれている。\n大かまどへ急いだ。', { ms: 2000 });
    await ev.warp('yule_night', 'hearth');
  }, { meta: { needs: [], gives: [] } });
})(window.RPG);
