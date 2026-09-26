// Prologue (A18b) — 港町ファロス (DESIGN §10.7 P4–P7 · P10, §10.1.3).
//   lute_arrival       lute's onEnter: P4 the gate guard's news (once, pro_lute). Also resumes
//                      lute_departure when the morning scene was cut short.
//   lute_rowell        P5 the young recorder at the 記録院 office (pro_met_rowell)
//   lute_tavern_start  P6 the tavern master before the party exists: ev.chooseCompanions({count:3})
//   lute_otto          P7 the lighthouse keeper: before / after the party, 灯台の鍵 and the three
//                      lessons; after pro_boss → lute_otto_reward
//   lute_otto_reward   the keeper's gift 灯台守のランタン (once)
//   lute_departure     P10 the morning after the lighthouse: the master, 年代記・羽ペン・鈴,
//                      序章『灯台守の歌』, the eight rumours → prologue_done, obj_regions
//   lute_bard          the tavern's bard: the legend of the three heroes (§10.1.3)
//   lute_patron        a traveller in the tavern (a candidate who has not joined yet)
(function (R) {
  'use strict';
  const E = R.DB.events;
  const K = R.Prologue;
  const NONE = { needs: [], gives: [] };

  // ------------------------------------------------------------ P4 着いたとき
  E.lute_arrival = {
    meta: { needs: [], gives: ['flag:pro_lute'], calls: ['lute_departure'] },
    run: async (ev) => {
      if (ev.map !== 'lute') return;
      if (!ev.flag('pro_lute')) {
        const g = ev.npc('watchman');
        await ev.wait(12);
        g.face('player');
        await ev.say('おや、旅の人かい。\nこんなときに、よく来たね。');
        await ev.say('灯台の火が消えて三晩になる。\n港のみんなも、すっかり\n参っちまってるよ。');
        await ev.say('夜になると、暗い海から\n魔物が上がってくる。\n領主さまが跳ね橋を\n上げさせたんだよ。');
        await ev.say('定期船も止まったままさ。\n……まったく、どうなるやら。');
        g.face('down');
        ev.setFlag('pro_lute');
        return;
      }
      if (ev.check(['pro_boss', '!prologue_done'])) await ev.call('lute_departure');
    },
  };

  // ------------------------------------------------------------ P5 記録院の出張所
  E.lute_rowell = {
    meta: { needs: [], gives: ['flag:pro_met_rowell'] },
    run: async (ev) => {
      if (!ev.flag('pro_met_rowell')) {
        await ev.say('……語り部の見習いか。灯台の伝承なら、\nきのう記録院が写し取った。', { voice: 'v_rowell_prologue_01' });
        await ev.say('伝承は記録院が責任をもって保管する。\n語り部の出る幕じゃない。', { voice: 'v_rowell_prologue_02' });
        ev.setFlag('pro_met_rowell');
        return;
      }
      if (ev.flag('pro_key')) {
        await ev.say('灯台守から鍵を借りたそうだな。\n……火をともせるものなら、\nともしてみるがいい。');
        return;
      }
      await ev.say('まだいたのか。\n写し取った伝承は、ビブリアの\n本院で大切に保管される。\nおまえの出る幕はない。');
    },
  };

  // ------------------------------------------------------------ P6 酒場「語らいの灯亭」
  E.lute_tavern_start = {
    meta: { needs: ['flag:pro_berna_sent'], gives: ['flag:pro_party_chosen'] },
    run: async (ev) => {
      if (ev.flag('pro_party_chosen')) { await ev.call('common_tavern'); return; }
      await ev.say('いらっしゃい。……おや、\n語り部さんかい。灯台へ行くなら、\n守り手がいるね。');
      await ev.say('今夜ここにいるのは、\n腕の立つ連中ばかりだよ。');
      await ev.say('気に入った連中を3人、\n選んでごらん。話は、\nわたしがつけてあげるよ。');
      const ids = await ev.chooseCompanions({ count: 3 });
      if (!ids || !ids.length) {
        await ev.say('……おや、決まらなかったかい。\nまたいつでも声をかけとくれ。');
        return false;
      }
      await ev.say('いい顔ぶれだね。\n……ああ、そうだ。');
      await ev.say('灯台守のオットーじいさんが、\n港で途方に暮れてたよ。');
      ev.setFlag('pro_party_chosen');
      ev.setObjective('obj_p_keeper');
    },
  };

  // ------------------------------------------------------------ P7 灯台守オットー
  async function tips(ev) { for (const t of K.OTTO_TIPS) await ev.say(t); }
  E.lute_otto = {
    meta: { needs: ['flag:pro_party_chosen'], gives: ['flag:pro_key', 'item:k_lighthouse_key'], calls: ['lute_otto_reward'] },
    run: async (ev) => {
      if (ev.flag('pro_boss')) { await ev.call('lute_otto_reward'); return; }
      if (!ev.flag('pro_party_chosen')) {
        await ev.say('わしは灯台守のオットー。\n灯台の火が消えてしまって、\nこの三晩、眠れんのじゃ。');
        await ev.say('……なに、灯台へ行くと？\nひとりで灯台へ？　とんでもない。\n酒場で仲間を見つけておいで。');
        return;
      }
      if (!ev.flag('pro_key')) {
        await ev.say('おお、仲間を連れてきたか。\nそれなら話は別じゃ。');
        await ev.say('灯台の守り歌が、\nどうしても思い出せんのじゃ。');
        await ev.say('あの歌がなけりゃ、火はつかん。……頼む。');
        await ev.give('k_lighthouse_key');
        await ev.say('灯台は、町を出て南東の\n岬の先じゃ。行く前に、\n戦いの心得を教えておこう。');
        await tips(ev);
        ev.setFlag('pro_key');
        ev.setObjective('obj_p_lighthouse');
        return;
      }
      if (ev.flag('pro_tutorial')) await ev.say('ネズミどもを追い払って\nくれたか。上の灯室を頼む。\n……気をつけてな。');
      else await ev.say('灯台は、町を出て南東の\n岬の先じゃ。鍵を持っておれば、\n扉は開くはずじゃ。');
      if (await ev.yesno('戦いの心得を、もう一度\n聞いていくかね？')) await tips(ev);
      else await ev.say('そうか。頼んだぞ。');
    },
  };
  E.lute_otto_reward = {
    meta: { needs: ['flag:pro_boss'], gives: ['item:ac_otto_lantern'] },
    run: async (ev) => {
      if (!ev.flag('lute_otto_reward')) {
        await ev.say('おお、{hero}！\n灯台に火が戻ったぞ！\n守り歌も、思い出せた。');
        await ev.say('♪　海の果てまで、灯よ届け\n帰る舟に、道を照らせ……。');
        await ev.say('これは、わしが若いころから\n使ってきたランタンじゃ。\n持っていっておくれ。');
        if (!(await ev.give('ac_otto_lantern'))) {
          await ev.say('……持ちきれんようじゃな。\n荷物を減らしたら、\nまた来ておくれ。');
          return false;
        }
        ev.setFlag('lute_otto_reward');
        await ev.say('そのランタンの光を見ておると、\n新しい技や術を\n思いつくそうじゃよ。');
        return;
      }
      await ev.say(K.pick(ev, [
        { cond: { postgame: true }, text: '灯台守の仕事は、孫に\n教えておるところじゃ。\n守り歌と一緒にな。' },
        { cond: 'final_open', text: '内海の霧が晴れたか。\n灯台の光も、島まで\n届くようになったのう。' },
        { cond: { tier: 4 }, text: '記録院の書記が、守り歌を\n写させろと言ってきた。\n……断ってやったわい。' },
        { text: '灯台の光は、今夜も\n海を照らしておる。\n{hero}のおかげじゃ。' },
      ]));
    },
  };

  // ------------------------------------------------------------ P10 旅立ちの朝
  const TOWNS = ['cheer_a', 'cheer_b', 'cheer_c'];
  E.lute_departure = {
    meta: { needs: ['flag:pro_boss'], gives: ['flag:prologue_done', 'item:k_chronicle', 'item:k_quill', 'item:k_bell'] },
    run: async (ev) => {
      if (ev.flag('prologue_done') || !ev.flag('pro_boss') || ev.map !== 'lute') return;
      const berna = ev.npc('berna');
      ev.player.face('down');
      if (R.Engine.fadeAlpha > 0) await ev.fadeIn(40);
      await ev.wait(20);
      ev.npc('cheer_a').face('player');
      await ev.say('灯台に火が戻ったぞ！\nゆうべ、岬が真っ白に\n光ったんだ！');
      ev.npc('cheer_b').face('player');
      await ev.say('領主さまが、跳ね橋を\n下ろしてくださったそうよ。\nこれで北の大陸へ行けるわ！');
      ev.closeMessage();
      await berna.walk('U');
      berna.face('up');
      await ev.say('夜通し歩いてきたよ。……よくやったね、\n{hero}。');
      await ev.say('これは、あなたの年代記だよ。\n語り部はみんな、自分の\n年代記を持って旅に出るんだ。', { voice: 'v_berna_lute_01' });
      await ev.give('k_chronicle');
      await ev.say('それから、これもお持ち。\n語り部の羽ペンと、\n帰り道の鈴だよ。', { voice: 'v_berna_lute_02' });
      await ev.give('k_quill', 1, { silent: true });
      await ev.give('k_bell', 1, { silent: true });
      await ev.gotItem(R.Events.lines('{hero}は', '語り部の羽ペンと', '帰り道の鈴を', '手に入れた！'), 'keyitem');
      await ev.say('羽ペンで年代記の地図をなぞれば、\n行ったことのある町へ飛べる。\n鈴を鳴らせば、ダンジョンの\n奥からでも外へ帰れるよ。');
      await ev.say('メニューの『ワープ』と『脱出』が、\nその力のことだよ。\nいつでも使いなさい。');
      ev.closeMessage();
      ev.sfx('quill');
      await ev.wait(20);
      await Promise.all([
        ev.caption('年代記に序章\n『灯台守の歌』が記された。', { highlight: '『灯台守の歌』', frames: 180 }),
        ev.jingle('chapter'),
      ]);
      await ev.say('この大陸には八つの大きな伝承がある。\nその全部が、いま白紙になりかけている。', { voice: 'v_berna_lute_03' });
      await ev.say('全部を語り直して、\n年代記を書き上げなさい。それが、\nあなたの修業の仕上げだよ。', { voice: 'v_berna_lute_04' });
      const hints = Object.keys(R.DB.regions || {}).map((id) => R.DB.regions[id].hint).filter(Boolean);
      if (hints.length) {
        await ev.say('旅の人から、こんなうわさを\n聞いたよ。');
        for (let i = 0; i < hints.length; i += 2) await ev.say(hints.slice(i, i + 2).join('\n'));
      }
      await ev.say('どこから回ってもいい。\nあなたの足で、あなたの順番で\n語り直していけばいいのさ。', { voice: 'v_berna_lute_05' });
      ev.closeMessage();
      const m = ev.npc('master');
      await m.walk('L2');
      m.face('player');
      await ev.say('ここに残った連中も、\nいつでも仲間にできるよ。\nどこの町の酒場でもね。');
      berna.face('up');
      await ev.say('わたしは里へ帰るよ。\n……いってらっしゃい、{hero}。');
      ev.closeMessage();
      await berna.walk('DLLLLLL');
      berna.hide();
      for (const id of TOWNS) ev.npc(id).hide();
      m.hide();
      ev.setFlag('prologue_done');
      ev.setObjective('obj_regions');
      ev.setRespawn('lute', 'inn');
      ev.bgm();
    },
  };

  // ------------------------------------------------------------ 吟遊詩人 (§10.1.3)
  const LEGEND = [
    '♪　むかしむかし、海の向こう\n東の大陸に、魔王ありき。\nその名は、ヴァルザード。',
    '♪　剣の家の若者と、\n神殿の娘と、魔法の天才。\n三人の勇者が、魔王を討った。',
    '……勇者たちの名前かい？\nそれが、とうに忘れられて\nしまったのさ。三百年も昔の話だ。',
    '歌は残っても、名は残らない。\n……語り部さんなら、\nこの寂しさが分かるだろう？',
  ];
  E.lute_bard = {
    meta: NONE,
    run: async (ev) => {
      ev.bgm('legend', { fade: 20 });
      if (ev.check({ postgame: true })) {
        await ev.say('♪　八つの伝承を語り直し、\n忘れられた王に名を与えた、\nひとりの語り部の歌……。');
        await ev.say('新しい歌さ。\n……あんたのことだよ、{hero}。');
      } else {
        for (const t of LEGEND) await ev.say(t);
        if (ev.tier() >= 1) await ev.say('近ごろ、新しい歌を\n作っているんだ。忘れられた\n伝承を語り直す、語り部の歌さ。');
      }
      ev.closeMessage();
      ev.bgm();
    },
  };

  // ------------------------------------------------------------ 酒場の旅人（まだ仲間でない候補）
  E.lute_patron = {
    meta: NONE,
    run: async (ev) => {
      const n = ev.ctx.npc || {};
      const d = R.DB.companions && R.DB.companions[n.who];
      if (!d) { await ev.say('……。'); return; }
      await ev.say(d.name + '（' + d.title + '）\n' + d.profile);
      await ev.say(ev.flag('pro_party_chosen') ? '酒場のマスターに話せば、\n仲間にできそうだ。' : '腕の立ちそうな旅人だ。\n酒場のマスターに\n話してみよう。');
    },
  };
})(window.RPG);
