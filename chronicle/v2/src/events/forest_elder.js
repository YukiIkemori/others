// CONTENT-F: 千年樹のイベントと森の締め（V2_PLAN §3.3 F10・F11・F12、STORY_BIBLE §7.1・§11.8）
//   elder_fine（F10、v_fine_forest_01）・elder_boss（F11: 根食らい tr_b_rooteater → エルム v_elm_forest_01〜05）→
//   forest_finale（野営地へ画面を移して ev.clearRegion('r_forest') → v_elm_forest_06 → 4 人が光る道を帰る →
//   フェルンの広場で歌 → 年代記に書く選択 ch_forest_write → 最後に見つけた人の一品物）。
//   ボイスの付いた文は 1 字も変えない（改行の位置だけ窓に合わせる。今の木の region1_forest.js と同じ）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const F = () => R.ContentF.forest;
  const ELM = { name: '森の主エルム', face: false };

  // ---------------------------------------------------------------- F10 入口のフィーネ（一言だけで去る）
  E('elder_fine', async (ev) => {
    if (ev.flag('forest_fine') || ev.flag('cleared_r_forest')) return;
    try { await ev.npc('fine').face('s'); } catch (e) { /* */ }
    await ev.say('fine', 'この根の奥に、伝承の核があるわ。\n……根を食べているものがいる。', { voice: 'v_fine_forest_01', name: 'フィーネ' });
    await ev.say('fine', '……気をつけて。', { name: 'フィーネ' });
    ev.sfx('magic');
    await ev.fade('out', 240);
    ev.setFlag('forest_fine');
    try { await ev.npc('fine').hide(); } catch (e) { /* */ }
    await ev.fade('in', 240);
    await ev.caption('灰色のマントの少女は、\n根の奥の闇に溶けるように\n消えた。', { ms: 2200 });
  }, { meta: { needs: [], gives: ['flag:forest_fine'] } });

  E('elder_carving', async (ev) => {
    await ev.say(null, ['幹の内側に、古い刻みがある。\n燃える木々と、その火を抱く\n大きな人の姿……。', '刻みの縁が、焦げたように黒い。']);
  });

  // ---------------------------------------------------------------- 根の間: 伸びない年輪（時の証 lo_time_forest）
  E('elder_rings', async (ev) => {
    await ev.say(null, ['太い根の、古い切り口だ。\n年輪が、びっしりと並んでいる。', '……外側の二十本だけが、\n糸のように細い。', '日の当たらなかった年は、\n輪が太らないという。']);
    await F().lore(ev, 'lo_time_forest');
  }, { meta: { needs: [], gives: ['flag:lo_time_forest'] } });

  // ピムを連れてきたとき: 根食らいの手前（控えの間）で野営地へ帰る
  E('elder_pim_home', async (ev) => {
    if (!ev.flag('forest_pim_guest')) return;
    await ev.say('npc_pim', ['……この先、なんだか\nこわい音がする。', 'ぼく、野営地で待ってる。\n父ちゃんの仲間に、\n抜け穴の話をしてくるね！'], { name: 'ピム' });
    ev.guest(null);
    ev.setFlag('forest_pim_guest', false);
    await ev.caption('ピムは、来た道を\n駆け戻っていった。', { ms: 1800 });
  }, { meta: { needs: ['flag:forest_pim_guest'], gives: [] } });

  // ---------------------------------------------------------------- F11 根食らい → エルム → 締め
  E('elder_boss', async (ev) => {
    if (ev.flag('cleared_r_forest')) return;
    if (ev.flag('forest_pim_guest')) await ev.call('elder_pim_home');
    if (!ev.flag('forest_boss')) {
      await ev.say(null, 'ガリッ……ガリッ……。\n何かが、根をかじる音がする。');
      await ev.say(null, '白くぶよぶよした巨大な虫が、\n千年樹の根に食らいついている！');
      ev.sfx('roar');
      const r = await ev.battle('tr_b_rooteater', { boss: true });
      if (r !== 'win') return;
      ev.setFlag('forest_boss');
      await ev.say(null, '根食らいは、白い紙くずの\nように崩れて、消えていった。');
    }
    await ev.say(null, '千年樹の根が、かすかに\nふるえている……。');
    if (ev.var('forest_verses') >= 3) {
      await ev.say(null, '{hero}は、三つの石の歌を\nつないで語った。');
      ev.sfx('quill');
      await ev.caption(F().SONG, { ms: 5000 });
    }
    ev.sfx('light');
    await ev.say(null, '根が、やわらかな緑色に\n光りはじめた。');
    await ev.say('elm', '……思い出した。わたしは、\nこの森を守ると誓ったのだった。', Object.assign({ voice: 'v_elm_forest_01' }, ELM));
    await ev.say('elm', '千年前の火の夜……。\n燃える森を前に、わたしは\nこの木に宿り、火を封じた。', Object.assign({ voice: 'v_elm_forest_02' }, ELM));
    await ev.say('elm', '村の者たちは、歌で\nわたしの眠りを守ると\n約束してくれた。', Object.assign({ voice: 'v_elm_forest_03' }, ELM));
    await ev.say('elm', '歌が絶えて、わたしは約束を\n忘れた。森を閉ざし、\n人を迷わせてしまった……。', Object.assign({ voice: 'v_elm_forest_04' }, ELM));
    await ev.say('elm', '語り部よ、礼を言う。', Object.assign({ voice: 'v_elm_forest_05' }, ELM));
    await ev.call('forest_finale');
  }, {
    meta: {
      needs: ['flag:forest_found_hans', 'flag:forest_found_ben', 'flag:forest_found_roy', 'flag:forest_found_pim'],
      gives: ['flag:forest_boss', 'region:r_forest', 'flag:forest_finale_done', 'choice:ch_forest_write'],
      calls: ['forest_finale', 'elder_pim_home'],
    },
  });

  // 灯り直す場面（STORY_BIBLE §7.1 の 6・7）
  E('forest_finale', async (ev) => {
    const f = F();
    if (ev.flag('forest_finale_done')) return;
    // 1. 画面は野営地へ
    await ev.fade('out', 600);
    await ev.warp('verda_1', 'camp');
    // 2. 大灯火（こずえに歌の灯）: ページ・ティア・光の柱・章の札（EVENTS の共通の筋）
    await ev.clearRegion('r_forest');
    ev.sfx('light');
    await ev.caption('千年樹のこずえに、歌の灯がともった。\n森じゅうのこけと蛍が、\nいっせいに光りだす。', { ms: 3000 });
    // 3. エルムの声が森じゅうに響く（v_elm_forest_06 は野営地で）
    await ev.say(null, '森の道は、もう閉ざさぬ。\n木こりたちも、じきに\n村へ帰れるだろう。', Object.assign({ voice: 'v_elm_forest_06' }, ELM));
    // 4. 野営地の人が立ち上がり、光る道を村へ帰っていく
    const walkers = ['camp_hans', 'camp_ben', 'camp_roy', 'camp_pim'];
    const moves = [];
    walkers.forEach((id, i) => {
      try { moves.push(ev.npc(id).move([[29 + (i % 2), 36], [29 + (i % 2), 44], [29 + (i % 2), 50]], { speed: 1 })); } catch (e) { /* */ }
    });
    await Promise.race([Promise.all(moves), ev.wait(4200)]);
    for (const id of walkers) { try { await ev.npc(id).hide(); } catch (e) { /* */ } }
    await ev.caption('四人は、光る道を\n村へ帰っていった。', { ms: 2200 });
    ev.setFlag('forest_finale_done');
    // 5. フェルンの広場で歌
    await ev.fade('out', 600);
    await ev.warp('fern', 'plaza');
    ev.bgm('village');
    await ev.caption('その夜、フェルンの広場に\n村じゅうの人が集まった。', { ms: 2400 });
    await ev.say('npc_rita', 'みんな、聞いて。\n千年樹の歌よ。', { name: 'リタ' });
    await ev.caption(f.SONG, { ms: 5200 });
    await ev.say(null, ['ピムが一番を歌いまちがえて、\n広場に笑い声が起きた。', 'ピムは真っ赤になって、\nもう一度、大きな声で歌った。']);
    if (ev.choiceOf('ch_forest_pim') === 'take') await ev.say('npc_pim', 'ぼくも行ったんだ！\n千年樹の抜け穴、\nぼくが開けたんだから！', { name: 'ピム' });
    await ev.say('hanna', 'やっぱり、朝は千年樹のこずえから\n生まれるんだねえ。\n……昔のきこり歌のとおりさ。', { name: 'ハンナ' });
    // 6. 年代記に書く選択（ch_forest_write。痛みの側は R.Game の数を足す）
    await ev.say(null, '{hero}は、年代記を開いた。\nこの森のことを、どう書こう。');
    const i = await ev.choose(['語り部の火が森を焼いたことも書く', 'エルムの誓いだけを書く'], { text: '年代記に何を書く？' });
    if (i === 0) {
      ev.choice('ch_forest_write', 'pain');
      ev.addVar('pain_count', 1);
      await ev.say(null, '「千年前、語り部のともした火が\n森を焼いた。森の主はその火を\n抱いて眠り……」');
    } else {
      ev.choice('ch_forest_write', 'oath');
      await ev.say(null, '「森の主は火を封じ、\n村は歌でその眠りを守った……」');
    }
    ev.sfx('quill');
    // 7. 最後に見つけた人が一品物を渡す（F12。どれも同じ強さ）
    await ev.call('fern_after');
  }, { meta: { needs: ['flag:forest_boss'], gives: ['region:r_forest', 'flag:forest_finale_done', 'choice:ch_forest_write'], calls: ['fern_after'], warp: { to: 'fern', spawn: 'plaza' } } });

  E('fern_after', async (ev) => {
    const f = F();
    if (ev.flag('forest_unique_given')) return;
    const who = f.last(ev) || 'hans';
    const p = f.PEOPLE[who];
    const talk = {
      hans: ['最後に見つけてもらったのは\nおれだったな。', 'これは、おれの大斧だ。\n森の木も、化け物も、\nこいつで道を開いてきた。'],
      ben: ['最後まで待たせたのは、\nおれだったか。', 'この呼び笛、あんたにやるよ。\n吹けば、森の仲間が\n力を貸してくれる。'],
      roy: ['うろの中で、もうだめかと\n思ってたんだ。', 'おふくろのお守りだ。\nおれを守ってくれた。\n今度は、あんたを守る番だ。'],
      pim: ['ぼくを最後に見つけて\nくれたんだよね。', 'ぼくの帽子の、もう片方！\n母ちゃんのより、\nこっちのほうが強いんだよ！'],
    }[who];
    await ev.say(p.look, talk, { name: p.name });
    f.give(ev, p.unique, 1);
    ev.setFlag('forest_unique_given');
  }, { meta: { needs: ['flag:forest_finale_done'], gives: ['flag:forest_unique_given', 'item:u_hans_axe|u_ben_whistle|u_roy_charm|u_pim_cap'] } });

  // ---------------------------------------------------------------- 解決の後の千年樹
  E('elder_elm', async (ev) => {
    if ((R.Tier && R.Tier.get ? R.Tier.get() : 0) >= 6) {
      await ev.say('elm', '世界のあちこちで、白い闇が\n広がっているのを感じる。\n……語り部よ、急ぐがよい。', ELM);
      return;
    }
    await ev.say('elm', ['森の道は、もう閉ざさぬ。\n夏至の歌も、村の者たちが\nまた歌ってくれるだろう。', 'ただ、迷いの森の魔物は、\nわたしにも鎮められぬ。\n腕を磨くには、よいだろう。'], ELM);
  });
  E('elder_altar', async (ev) => {
    if (ev.flag('forest_boss')) await ev.say(null, '根に囲まれた、古い祭壇だ。\n光るきのこが、ぼんやりと\nあたりを照らしている。');
    else await ev.say(null, '根に囲まれた、古い祭壇だ。\nかじられた根から、\n白い粉がこぼれている。');
  });
})(window.RPG);
