// CONTENT-F: 迷いの森のイベント（V2_PLAN §3.3 F5〜F9、WORLD_REDESIGN §4.1、STORY_BIBLE §7.1）
//   救出の 4 人（順番は自由）: ハンス（倒木の先。斧で開く）・ベン（狼の群れ tr_a21_forest_wolves）・ロイ（木のうろ。ベンの笛で出てくる）・
//   ピム（苔の語り石の前で小鹿をかばう）→ 見つけた人は 1 階の蛍だまりの野営地で待つ。
//   選択: ピム（送る＝野営地へ／連れる＝ついてくる人 E8）・小鹿（手当て＝獣道が開く／そっとしておく）。
//   歌の石 a・b・c（forest_verses）: 3 つで出口の入れ替えが止まり、つるの壁がほどける。c はダストウィングが守る。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const F = () => R.ContentF.forest;
  const cleared = (ev) => ev.flag('cleared_r_forest');

  // ---------------------------------------------------------------- 入るとき・森が道を変える
  E('verda_arrive', async (ev) => {
    await ev.caption('木々のあいだに、蛍が漂っている。\n……けれど、森の奥は\n墨を流したように暗い。', { ms: 2600 });
    if (ev.has('k_pim_hat')) await ev.caption('ピムの帽子の苔の粉が、\nかすかに光った。', { ms: 1800 });
  });
  E('verda_2_arrive', async (ev) => {
    await ev.caption('森が、いっそう深くなった。\nどこかで、歌の切れ端のような\n風の音がする。', { ms: 2400 });
  });
  E('verda_mist', async (ev) => {
    if (ev.var('forest_verses') >= 3) return;
    ev.sfx('wind');
    await ev.caption('足元から、白い霧が\nわき上がった……。\n森が、道を変えようとしている。', { ms: 2200 });
  });

  // ---------------------------------------------------------------- F8 歌の石
  async function songStone(ev, key, verse, extra) {
    const f = F();
    if (ev.flag(key)) {
      await ev.say(null, '歌の刻まれた、\n道しるべの石だ。');
      await ev.caption(extra ? verse + '\n' + extra : verse, { ms: 2400 });
      return;
    }
    await ev.say(null, 'コケむした道しるべの石だ。\n表に、歌が刻まれている……。');
    ev.sfx('bell');
    await ev.caption(verse, { ms: 3000 });
    if (extra) {
      await ev.say(null, 'その下に、ほかの石には無い\n一節が続いている。');
      await ev.caption(extra, { ms: 3200 });
    }
    ev.setFlag(key);
    const n = ev.addVar('forest_verses', 1);
    ev.sfx('quill');
    await ev.say(null, '{hero}は、歌の一節を\n年代記に書き留めた。');
    if (n >= 3) {
      ev.sfx('unlock');
      await ev.caption('三つの石の歌がつながった。\n森の奥で、つるがほどけていく\n音がする……。', { ms: 2800 });
      await ev.caption('森はもう、道を変えない。', { ms: 1800 });
      ev.leadDone('l_forest_song');
    } else {
      await ev.say(null, n === 1 ? '歌の石は、あとふたつ……。' : '歌の石は、あとひとつ……。');
    }
    void f;
  }
  E('verda_stone_a', (ev) => songStone(ev, 'forest_stone_a', F().VERSES[0]), { meta: { needs: [], gives: ['var:forest_verses+1', 'flag:forest_stone_a'] } });
  E('verda_stone_b', (ev) => songStone(ev, 'forest_stone_b', F().VERSES[1]), { meta: { needs: [], gives: ['var:forest_verses+1', 'flag:forest_stone_b'] } });
  E('verda_stone_c', async (ev) => {
    if (!ev.flag('forest_moth')) { await ev.say(null, '石のまわりに、白い粉が\n厚く積もっている……。'); return; }
    await songStone(ev, 'forest_stone_c', F().VERSES[2], F().EXTRA);
  }, { meta: { needs: ['flag:forest_moth'], gives: ['var:forest_verses+1', 'flag:forest_stone_c'] } });

  E('verda_vines', async (ev) => {
    if (ev.var('forest_verses') >= 3) return;
    await ev.say(null, ['太いつるが、網のように\n道をふさいでいる。', ev.var('forest_verses') > 0
      ? '千年樹の歌がそろえば、\nほどけるかもしれない……。'
      : 'つるの向こうに、とてつもなく\n大きな木の幹が見える。']);
  });

  // ---------------------------------------------------------------- F9 ダストウィング（歌の石 c を守る）
  E('verda_moth', async (ev) => {
    if (ev.flag('forest_moth')) return;
    await ev.say(null, 'バサッ……バサッ……。\n重い羽音が、森の空気を\nふるわせている。');
    ev.sfx('roar');
    await ev.say(null, '白い粉をまき散らしながら、\n巨大な羽虫が舞い降りた！');
    const r = await ev.battle('tr_b_moth', { boss: true });
    if (r !== 'win') return;
    ev.setFlag('forest_moth');
    await ev.say(null, ['ダストウィングは、白い粉に\nなって、消えていった。', '粉の積もった石が、\n月の光に浮かび上がった。']);
  }, { meta: { needs: [], gives: ['flag:forest_moth'] } });

  // ---------------------------------------------------------------- 持ち物（斧・笛）
  E('verda_axe', async (ev) => {
    if (ev.flag('forest_got_axe')) { await ev.say(null, '古い切り株だ。\n斧の跡が、いくつも残っている。'); return; }
    await ev.say(null, ['切り株に、斧が一本\n突き立ててある。', '柄に焼き印。「ハンス」……\n樵の目印の置き方だ。']);
    ev.setFlag('forest_got_axe');
    await ev.caption('ハンスの斧を 預かった', { ms: 1600 });
    await ev.say(null, '持ち主は、この先の\nどこかにいるはずだ。');
  }, { meta: { needs: [], gives: ['flag:forest_got_axe'] } });

  E('verda_flute', async (ev) => {
    if (ev.flag('forest_got_flute')) { await ev.say(null, '苔むした石だ。'); return; }
    await ev.say(null, ['石のかげに、木の呼び笛が\n落ちている。', '樵どうしが呼び合う笛だ。\n吹き口に「ベン」と彫ってある。']);
    ev.setFlag('forest_got_flute');
    await ev.caption('ベンの呼び笛を 預かった', { ms: 1600 });
  }, { meta: { needs: [], gives: ['flag:forest_got_flute'] } });

  // ---------------------------------------------------------------- F5 ハンス（倒木の先）
  E('verda_log', async (ev) => {
    if (ev.flag('forest_log_cut')) return;
    if (!ev.flag('forest_got_axe')) {
      await ev.say(null, ['大きな倒木が、道をふさいでいる。', '向こうから、かすかに\nうめき声が聞こえる……。']);
      return;
    }
    await ev.say(null, '大きな倒木が、道をふさいでいる。\nハンスの斧なら、払えそうだ。');
    const i = await ev.choose(['斧で払う', 'やめておく'], { cancel: 1 });
    if (i !== 0) return;
    ev.sfx('hit');
    await ev.fade('out', 300);
    ev.setFlag('forest_log_cut');
    await ev.fade('in', 300);
    await ev.say(null, '倒木を払うと、その先に\n小さな窪地が見えた。');
  }, { meta: { needs: ['flag:forest_got_axe'], gives: ['flag:forest_log_cut'] } });

  E('verda_hans', async (ev) => {
    if (ev.flag('forest_found_hans')) return;
    await ev.say('hans', ['……おお、人か！\n倒れた木に道をふさがれて、\n出られなくなってたんだ。', 'おれはハンス。\nフェルンの樵だ。\nその斧、おれのだな。']);
    await ev.say('hans', ['森の奥で、歌が聞こえた気がして\n追いかけたら、このざまさ。', '……入口の近くの蛍だまりで、\n火をたいて待ってるよ。\n森が、帰り道をくれないんでな。']);
    await F().rescue(ev, 'hans');
  }, { meta: { needs: ['flag:forest_log_cut'], gives: ['flag:forest_found_hans'] } });

  // ---------------------------------------------------------------- F5 ベン（狼の群れ）
  E('verda_ben', async (ev) => {
    if (ev.flag('forest_found_ben')) return;
    await ev.say(null, '低いうなり声。\n狼の群れが、誰かを\n取り囲んでいる！');
    await ev.say('ben', '助けてくれ！\n群れの頭が、仲間を\n呼んでやがる！');
    const r = await ev.battle('tr_a21_forest_wolves');
    if (r !== 'win') return;
    await ev.say(null, '群れの頭が倒れると、\n狼たちは森の奥へ散っていった。');
    await ev.say('ben', ['助かった……。おれはベン。\nハンスとロイと、三人で\n森に入ったんだ。', '逃げるときに、呼び笛を\n落としちまった。ロイは笛の音で\n仲間を呼ぶ約束なんだが……。']);
    await ev.say('ben', '蛍だまりの野営地で待ってる。\nあそこなら、狼も来ない。');
    await F().rescue(ev, 'ben');
  }, { meta: { needs: [], gives: ['flag:forest_found_ben'] } });

  // ---------------------------------------------------------------- F5 ロイ（木のうろ。笛の音で出てくる）
  E('verda_hollow', async (ev) => {
    if (ev.flag('forest_found_roy')) { await ev.say(null, '大木の、大きなうろだ。\n中に、弁当箱のふたが\n転がっている。'); return; }
    if (!ev.flag('forest_got_flute')) {
      await ev.say(null, ['大木の根元に、大きなうろがある。', '奥で、何かがふるえている……。\n呼びかけても、返事がない。', 'うろの前に、弁当のくずが\n点々と落ちている。']);
      return;
    }
    await ev.say(null, '大木の根元に、大きなうろがある。\n奥で、何かがふるえている……。');
    const i = await ev.choose(['ベンの呼び笛を吹く', 'やめておく'], { cancel: 1 });
    if (i !== 0) return;
    ev.sfx('whistle');
    await ev.caption('ピィ――……', { ms: 1400 });
    ev.setFlag('forest_roy_out');
    await ev.wait(300);
    await ev.say('roy', ['……その笛、ベンのか！？\nよかった、仲間が来たのかと……。', 'おれはロイ。\n狼から逃げて、ここに\n隠れてたんだ。']);
    await ev.say('roy', ['弁当も、とうとう空っぽさ。\n……蛍だまりへ行けばいいんだな。', 'ありがとう。\nこの恩は、忘れねえ。']);
    await F().rescue(ev, 'roy');
  }, { meta: { needs: ['flag:forest_got_flute'], gives: ['flag:forest_found_roy', 'flag:forest_roy_out'] } });

  // ---------------------------------------------------------------- F5・F6・F7 ピム（苔の語り石の前）と小鹿
  E('verda_pim', async (ev) => {
    if (ev.flag('forest_found_pim')) return;
    await ev.say('pim', ['あっ……！\nしーっ、静かにして。\nこの子、けがしてるんだ。', 'ぼくはピム。父ちゃんを\n探しに来たんだけど……\nこの子が倒れてて。']);
    await ev.say('pim', ['この石、ぼくの名前を\n知ってるみたいな顔してる。', '……へんなこと言って、ごめん。']);
    await F().rescue(ev, 'pim', { hide: false, quiet: true });
    // F6 ピムの選択（ch_forest_pim）
    const i = await ev.choose(['野営地へ送り届ける', '連れて進む'], { text: 'ピムを どうする？' });
    if (i === 0) {
      ev.choice('ch_forest_pim', 'send');
      await ev.say('pim', ['……わかった。野営地で\n待ってる。父ちゃんの仲間も\nいるんでしょ？', 'あのね、南西の広場の大きな木。\nうろの奥の壁、抜けられるんだ。\nぼくの秘密のうろ！']);
    } else {
      ev.choice('ch_forest_pim', 'take');
      await ev.say('pim', ['ほんと！？　ぼく、役に立つよ！\n小さい穴なら、ぼくが\nくぐってあげる。', '千年樹には、ぼくしか通れない\n抜け穴があるんだ。']);
    }
    // F7 小鹿の選択（ch_forest_fawn）
    await ev.call('verda_fawn_choice');
    if (ev.choiceOf('ch_forest_pim') === 'take') {
      ev.setFlag('forest_pim_guest');
      ev.guest('npc_pim');
      await ev.caption('ピムが、うしろからついてくる。', { ms: 1600 });
    } else {
      await ev.fade('out', 300);
      try { await ev.npc('pim').hide(); } catch (e) { /* */ }
      await ev.fade('in', 300);
      await ev.caption('ピムは、蛍だまりの野営地へ向かった。', { ms: 2000 });
    }
  }, { meta: { needs: [], gives: ['flag:forest_found_pim', 'choice:ch_forest_pim', 'choice:ch_forest_fawn'], calls: ['verda_fawn_choice'] } });

  E('verda_fawn_choice', async (ev) => {
    if (ev.flag('forest_fawn_done')) return;
    await ev.say(null, '花のような角の小鹿が、\n足を引きずっている。');
    const heal = ['i_salve', 'i_potion', 'i_elixir'].find((id) => ev.has(id));
    const i = await ev.choose([heal ? '手当てする（' + (R.DB.items[heal] ? R.DB.items[heal].name : heal) + 'を使う）' : '手当てする', 'そっとしておく'], { cancel: 1 });
    if (i === 0) {
      if (!heal) { await ev.say(null, '手当てに使える品を\n持っていない……。'); return; }
      ev.take(heal, 1);
      ev.choice('ch_forest_fawn', 'heal');
      ev.setFlag('forest_fawn_done');
      await ev.say(null, ['傷に薬をぬると、小鹿は\nゆっくり立ち上がった。', '小鹿は一度ふり返り、\n辻の北の藪へ消えた。\n……獣道が、できている。']);
    } else {
      ev.choice('ch_forest_fawn', 'leave');
      ev.setFlag('forest_fawn_done');
      await ev.say(null, '小鹿は、しばらくこちらを見て、\n森の奥へ歩いていった。');
    }
    try { await ev.npc('fawn').hide(); } catch (e) { /* */ }
  }, { meta: { needs: ['flag:forest_found_pim'], gives: ['choice:ch_forest_fawn', 'flag:forest_fawn_done'] } });

  E('verda_fawn_after', async (ev) => {
    await ev.say(null, ['あの花角の小鹿だ。\n傷は、すっかり治っている。', '小鹿のうしろの茂みに、\n小さな足あとがたくさん……。\nここは、花角の鹿の巣らしい。']);
  });

  // ---------------------------------------------------------------- 野営地（蛍だまり）
  E('verda_camp_talk', async (ev, ctx) => {
    const who = String((ctx && ctx.npc) || '').replace(/^camp_/, '');
    const f = F();
    const n = f.count(ev);
    const lines = {
      hans: ['焚き火のそばは、あったかいな。\n森が帰り道をくれるまで、\nここで待つさ。', 'ゴードの親父さんはな、二十年前、\n戦の烽火の木を運ぶ途中で\n死んだんだ。'],
      ben: ['狼の群れ頭は、もう\n出てこねえだろう。\nあんたのおかげだ。', '伐り跡の原を見るたびに、\nゴードは黙っちまう。\n……親父さんのことを思い出すんだ。'],
      roy: ['腹が減ったなあ。\n弁当箱、どこに置いてきたっけ。', '森の奥の空き小屋に、\n知らない男が入っていくのを\n見たんだ。記録院の服だった。'],
      pim: ['父ちゃんの仲間と、焚き火で\nお話ししてるんだ。', 'あの苔の石、ロアの里にも\n同じのがあるんだって。\nハンスさんが言ってた。'],
    };
    const L = lines[who] || ['……。'];
    await ev.say(ctx && ctx.npc, n >= 4 && who !== 'pim' ? [L[0], L[1], '四人そろったな。\nあとは、森が歌を思い出せば……。'] : L);
  });

  // ---------------------------------------------------------------- 読み物と調べる物
  E('verda_moss_stone', async (ev) => {
    await ev.say(null, ['苔に埋もれた、古い語り石だ。\nロアの里の語り石と、\nそっくりの形をしている。', '苔の下に文字が見えるが、\nどうしても読めない。']);
    await F().lore(ev, 'lo_forest_moss_stone');
  }, { meta: { needs: [], gives: ['flag:lore_lo_forest_moss_stone'] } });

  E('verda_empty_hut', async (ev) => {
    if (ev.flag('lore_lo_lz_1')) { await ev.say(null, '戸の壊れた空き小屋だ。\nもう、何も残っていない。'); return; }
    await ev.say(null, ['戸の壊れた、空き小屋だ。\n中に、革の鞄が一つ\n置き忘れられている。', '記録院の印の入った鞄だ。\n底に、封をしたままの\n手紙が一通……。']);
    await ev.letter('letter_lz_1');
    await F().lore(ev, 'lo_lz_1');
    ev.leadDone('l_forest_hut');
  }, { meta: { needs: [], gives: ['flag:lore_lo_lz_1'] } });

  E('verda_herb', async (ev, ctx) => R.ContentF.forest.herb(ev, ctx));
  E('verda_acorn', async (ev) => R.ContentF.forest.acorn(ev));
})(window.RPG);
