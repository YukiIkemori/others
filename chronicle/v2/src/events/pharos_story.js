// CONTENT-P: 港町ファロスの本筋（V2_PLAN §3.3 P4〜P7・P10、STORY_BIBLE §9.1・§6.4・§6.7・§11）
//   pharos_arrival        P4 onEnter（入るたび）: 初めてのときだけ町の空気の地の文（話しかけてくる人は置かない）。
//                         灯台がともった後で旅立ちの場面が途中で切れていたら、pharos_departure をもう一度
//   pharos_rowell         P5 記録院の出張所の若い記録官（v_rowell_prologue_01・02）。机の上の白紙の束
//   pharos_record_notice  出張所の掲示「ファロス灯台の守り歌、保管のため写し取り済み」（lo_ev_prologue、序章の物証）
//   pharos_record_papers  白紙の束
//   pharos_tavern_master  P6 潮風亭のマスター: ev.chooseCompanions({count: 3})（表示は MENUS の仲間選び。物語なし、A36）。以後は入れ替え ev.tavern
//   pharos_otto           P7 灯台守オットー: 鍵と心得（書き直した 3 行）。灯がともった後は pharos_otto_reward
//   pharos_otto_reward    灯台守のランタン ac_keeper_lantern（1 回）と「朝番」の昔話
//   pharos_departure      P10 朝の鐘のファロス: v_berna_lute_01〜05、年代記・羽ペン・鈴、序章の章、手がかり帳（l_main_rumors）、
//                         ベルナの一瞬の詰まり（最初の物忘れの影）、オットーの礼、跳ね橋が下りる → prologue_done
(function (R) {
  'use strict';
  const D = R.DB.events;
  const X = () => R.ContentP.ev;

  // ------------------------------------------------------------ P4 着いたとき
  D.pharos_arrival = {
    meta: { needs: [], gives: ['flag:prologue_pharos'], calls: ['pharos_departure'] },
    run: async (ev) => {
      const E = X();
      if (ev.flag('prologue_boss') && !ev.flag('prologue_done')) { await ev.call('pharos_departure'); return; }
      if (ev.flag('prologue_pharos')) return;
      ev.setFlag('prologue_pharos');
      await E.narr(ev, '港町ファロス。\n桟橋の灯りの向こうで、\n岬の灯台は暗いままだった。');
    },
  };

  // ------------------------------------------------------------ P5 記録院の出張所
  D.pharos_rowell = {
    meta: { needs: [], gives: ['flag:prologue_rowell'] },
    run: async (ev) => {
      const E = X();
      if (!ev.flag('prologue_rowell')) {
        await E.narr(ev, '机の上に、白紙の束が\n積んである。若い記録官の\n手が、かすかに震えている。');
        await ev.say('rowell', '……語り部の見習いか。灯台の伝承なら、\nきのう記録院が写し取った。', { voice: 'v_rowell_prologue_01', face: 'rowell:neutral' });
        await ev.say('rowell', '伝承は記録院が責任をもって保管する。\n語り部の出る幕じゃない。', { voice: 'v_rowell_prologue_02', face: 'rowell:angry' });
        ev.setFlag('prologue_rowell');
        return;
      }
      const pk = E.pickEntry([
        { cond: 'prologue_done', text: '灯台に火が戻っただと？\n……写し取ったはずの歌が、\nどうして。', voice: 'v_rowell_pharos_01' },
        { cond: 'prologue_key', text: '灯台守から鍵を借りたそうだな。\n……火をともせるものなら、\nともしてみるがいい。', voice: 'v_rowell_pharos_02' },
        { text: 'まだいたのか。\n写し取った伝承は、本院で\n大切に保管される。', voice: 'v_rowell_pharos_03' },
      ]);
      await E.say(ev, 'rowell', pk.text, { voice: pk.voice, face: 'rowell:neutral' });
    },
  };
  D.pharos_record_notice = {
    meta: { needs: [], gives: ['lore:lo_ev_prologue'] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, '掲示が貼ってある。');
      await E.narr(ev, '「ファロス灯台の守り歌、\n保管のため写し取り済み。\n――記録院ファロス出張所」');
      E.lore(ev, 'lo_ev_prologue');
    },
  };
  D.pharos_record_papers = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, '白紙の束だ。\n写し取ったはずの紙なのに、\n一文字も書かれていない。');
    },
  };

  // ------------------------------------------------------------ P6 潮風亭のマスター（仲間選び・入れ替え）
  D.pharos_tavern_master = {
    meta: { needs: ['flag:prologue_berna'], gives: ['flag:prologue_party'] },
    run: async (ev, ctx) => {
      const E = X();
      const who = (ctx && ctx.npc) || 'master';
      if (!ev.flag('prologue_party')) {
        if (!ev.flag('prologue_berna')) { await E.say(ev, who, 'いらっしゃい。……おや、\nまだ子どもじゃないか。\n夜道は危ないよ。'); return; }
        await E.say(ev, who, 'いらっしゃい。……おや、\n語り部さんかい。灯台へ行くなら、\n守り手がいるね。');
        await E.say(ev, who, '今夜ここにいるのは、\n腕の立つ連中ばかりだよ。\n気に入った 3 人を選んでごらん。');
        const ids = await ev.chooseCompanions({ count: 3 });
        if (!ids || !ids.length) { await E.say(ev, who, '……おや、決まらなかったかい。\nまたいつでも声をかけとくれ。'); return; }
        await E.say(ev, who, 'いい顔ぶれだね。\n……ああ、そうだ。');
        await E.say(ev, who, '灯台守のオットーじいさんが、\n港で途方に暮れてたよ。');
        ev.setFlag('prologue_party');
        return;
      }
      const i = await ev.choose(['仲間を入れ替える', '話を聞く', 'やめておく'], { cancel: 2, text: E.t('いらっしゃい、{hero}。\n仲間の入れ替えなら、\nいつでも言っとくれ。') });
      if (i === 0) { await ev.tavern({ swap: true }); return; }
      if (i === 1) {
        await E.say(ev, who, E.pick([
          { cond: 'prologue_done', text: 'うわさなら、うちの客に\n聞いてごらん。\n酒場にはうわさが集まるものさ。' },
          { text: '灯台の火が消えてから、\n船乗りたちは陸で\n飲んでばかりさ。' },
        ]));
      }
    },
  };

  // ------------------------------------------------------------ P7 灯台守オットー
  const OTTO_TIPS = [
    '仲間は前列と後列に並ぶんじゃ。\n後列は狙われにくいが、弓と杖の\nほかは、前まで届かんぞ。',
    '迷ったら『リピート』じゃ。\nさっきと同じ手を、みなで\nくり返してくれる。',
    '急ぐときは倍速にすればよい。\nただし、敵の構えには\n目を離すでないぞ。',
  ];
  async function tips(ev) { for (const t of OTTO_TIPS) await ev.say('otto', t, { face: 'otto:neutral' }); }
  D.pharos_otto = {
    meta: { needs: ['flag:prologue_party'], gives: ['flag:prologue_key', 'item:k_lighthouse_key'], calls: ['pharos_otto_reward'] },
    run: async (ev) => {
      const E = X();
      if (ev.flag('prologue_boss')) { await ev.call('pharos_otto_reward'); return; }
      if (!ev.flag('prologue_party')) {
        await ev.say('otto', 'わしは灯台守のオットー。\n灯台の火が消えてしまって、\nゆうべは眠れんかった。', { voice: 'v_otto_pharos_01', face: 'otto:sad' });
        await ev.say('otto', '……なに、灯台へ行くと？\nひとりで？ とんでもない。\n酒場「潮風亭」で仲間を見つけておいで。', { voice: 'v_otto_pharos_02', face: 'otto:surprise' });
        return;
      }
      if (!ev.flag('prologue_key')) {
        await ev.say('otto', 'おお、仲間を連れてきたか。\nそれなら話は別じゃ。', { voice: 'v_otto_pharos_03', face: 'otto:smile' });
        await ev.say('otto', '灯台の守り歌が、\nどうしても思い出せんのじゃ。\nあの歌がなけりゃ、火はつかん。', { voice: 'v_otto_pharos_04', face: 'otto:sad' });
        await ev.say('otto', '……頼む。\nこれが灯台の鍵じゃ。', { voice: 'v_otto_pharos_05', face: 'otto:neutral' });
        await E.give(ev, 'k_lighthouse_key', 1, { say: true });
        ev.setFlag('prologue_key');
        await ev.say('otto', '灯台は、町を出て南の\n岬の先じゃ。行く前に、\n戦いの心得を教えておこう。', { voice: 'v_otto_pharos_06', face: 'otto:neutral' });
        await tips(ev);
        return;
      }
      await ev.say('otto', ev.flag('prologue_tutorial') ? 'ネズミどもを追い払って\nくれたか。上の灯室を頼む。\n……気をつけてな。' : '灯台は、町を出て南の\n岬の先じゃ。鍵があれば、\n扉は開くはずじゃ。', { face: 'otto:neutral' });
      const i = await ev.choose(['もう一度聞く', 'だいじょうぶ'], { cancel: 1, text: '戦いの心得を、もう一度\n聞いていくかね？' });
      if (i === 0) await tips(ev);
      else await ev.say('otto', 'そうか。頼んだぞ。', { face: 'otto:smile' });
    },
  };
  D.pharos_otto_reward = {
    meta: { needs: ['flag:prologue_boss'], gives: ['item:ac_keeper_lantern', 'flag:prologue_otto_reward'] },
    run: async (ev) => {
      const E = X();
      if (!ev.flag('prologue_otto_reward')) {
        await E.say(ev, 'otto', 'おお、{hero}！\n灯台に火が戻ったぞ！\n守り歌も、思い出せた。', { face: 'otto:smile' });
        await ev.say('otto', '♪　海の果てまで、灯よ届け\n帰る舟に、道を照らせ……。', { voice: 'v_otto_reward_01', face: 'otto:smile' });
        await ev.say('otto', 'これは、わしが若いころから\n使ってきたランタンじゃ。\n持っていっておくれ。', { voice: 'v_otto_reward_02', face: 'otto:neutral' });
        await E.give(ev, 'ac_keeper_lantern', 1, { say: true });
        ev.setFlag('prologue_otto_reward');
        await ev.say('otto', '若いころ、灯台には\n『朝番』というのがあってな。\n火が戻ったら、また立てるつもりじゃ。', { voice: 'v_otto_reward_03', face: 'otto:smile' });
        await ev.say('otto', '……はて。何を見張る番\nじゃったかのう。\nどうしても思い出せん。', { voice: 'v_otto_reward_04', face: 'otto:sad' });
        return;
      }
      await E.say(ev, 'otto', E.pick([
        { cond: 'cleared_r_forest', text: '西の森にも灯が戻ったか。\n灯台から見ると、森の上に\n細い光の柱が立っておるよ。' },
        { text: '灯台の光は、今夜も\n海を照らしておる。\n{hero}のおかげじゃ。' },
      ]), { face: 'otto:smile' });
    },
  };

  // ------------------------------------------------------------ P10 朝の鐘のファロス
  D.pharos_departure = {
    meta: {
      needs: ['flag:prologue_boss'],
      gives: ['flag:prologue_done', 'item:k_chronicle', 'item:k_quill', 'item:k_bell', 'lead:l_main_rumors', 'item:ac_keeper_lantern'],
      calls: ['pharos_otto_reward'],
    },
    run: async (ev) => {
      const E = X();
      if (ev.flag('prologue_done') || !ev.flag('prologue_boss')) return;
      ev.bgm('dawn');   // 朝の鐘（最後の R.Audio.bgm('town') で町の曲へ）
      try { R.Audio.sfx('bell'); } catch (e) { /* */ }
      await ev.caption('――朝の鐘が、港に鳴りわたった。', { ms: 2800 });
      await E.say(ev, 'cheer_a', '灯台に火が戻ったぞ！\nゆうべ、岬が真っ白に\n光ったんだ！');
      await ev.npc('berna').move([[7, 11], [6, 11]]);
      await E.say(ev, 'berna', '夜通し歩いてきたよ。\n……よくやったね、{hero}。', { face: 'berna:smile' });
      await ev.say('berna', 'これは、あなたの年代記だよ。\n語り部はみんな、自分の\n年代記を持って旅に出るんだ。', { voice: 'v_berna_lute_01', face: 'berna:smile' });
      await E.give(ev, 'k_chronicle', 1, { say: true });
      await ev.say('berna', 'それから、これもお持ち。\n語り部の羽ペンと、\n帰り道の鈴だよ。', { voice: 'v_berna_lute_02', face: 'berna:neutral' });
      await E.give(ev, 'k_quill', 1);
      await E.give(ev, 'k_bell', 1);
      await E.narr(ev, '{hero}は、語り部の羽ペンと\n帰り道の鈴を手に入れた！');
      await ev.say('berna', ['羽ペンで年代記の地図をなぞれば、\n行ったことのある町へ飛べる。', '鈴を鳴らせば、ダンジョンの\n奥からでも外へ帰れるよ。', 'メニューの『ワープ』と『脱出』が、\nその力のことだよ。'], { face: 'berna:neutral' });
      try { R.Audio.sfx('quill'); } catch (e) { /* */ }
      E.chapter('prologue');
      await Promise.all([ev.caption('年代記に序章\n『灯台守の歌』が記された。', { ms: 3000 }), ev.jingle('chapter')]);
      await ev.say('berna', 'この大陸には八つの大きな伝承がある。\nその全部が、いま白紙になりかけている。', { voice: 'v_berna_lute_03', face: 'berna:sad' });
      await ev.say('berna', '全部を語り直して、\n年代記を書き上げなさい。それが、\nあなたの修業の仕上げだよ。', { voice: 'v_berna_lute_04', face: 'berna:neutral' });
      await ev.say('berna', 'うわさは酒場に集まるものさ。\nまずは港の酒場で\n聞いてごらん。', { voice: 'v_berna_depart_01', face: 'berna:smile' });
      ev.lead('l_main_rumors');
      await E.narr(ev, '{hero}は、手がかり帳を\n受け取った。');
      try { if (R.DB.tips && R.DB.tips.leads) await R.Screens.tip('leads'); } catch (e) { /* 札が無くても止めない */ }
      await ev.say('berna', 'どこから回ってもいい。\nあなたの足で、あなたの順番で\n語り直していけばいいのさ。', { voice: 'v_berna_lute_05', face: 'berna:smile' });
      // 最初の物忘れの影（STORY_BIBLE §9.1 P10）
      await ev.say('berna', 'わたしは里へ帰るよ。\n……いってらっしゃい、', { voice: 'v_berna_depart_02', face: 'berna:smile' });
      await E.narr(ev, 'ベルナは、何か言いかけて、\n笑ってごまかした。');
      await E.say(ev, 'berna', '……{hero}。\n気をつけてお行き。', { face: 'berna:smile' });
      await E.narr(ev, '港のほうから、オットーが\n駆けてきた。');
      await ev.call('pharos_otto_reward');
      await E.say(ev, 'cheer_b', '領主さまが、北の跳ね橋を\n下ろしてくださったそうよ！\nこれで北の野へ出られるわ！');
      ev.setFlag('prologue_done');
      try { R.Audio.bgm('town'); } catch (e) { /* */ }
    },
  };
})(window.RPG);
