// Region 2 r_desert ザハラ砂漠 (R2 reg2) — the events of 砂の王墓 (sand_tomb_1..3).
// DESIGN §10.8.0 (common rules 3–6), §10.8.3 (#4–#9), §10.9.4 (フィーネ), §10.9.2 (after the clear).
//   sand_tomb_1_statue / _2_statue / _3_statue   墓守の像 1–3: the letters ハ・ザ・ル (var desert_letters
//                          +1 each, once per statue = its event id flag). The first sets obj_desert_2;
//                          the third makes the name ハザル, opens the king's door (tilePatch) → obj_desert_3
//   sand_tomb_2_boss       中ボス 砂もぐり tr_b_sandworm → desert_mid (the quicksand stops, tilePatch)
//   sand_tomb_2_quicksand  examine on the quicksand (why it is closed)
//   sand_tomb_3_door       examine on the closed 岩戸 (why it is closed)
//   sand_tomb_3_fine       the step in front of the king's door (once desert_fine): story_fine_desert
//   sand_tomb_3_boss       ボス 名なき砂の王 tr_b_sandking → desert_boss → the name is given back →
//                          ev.clearRegion('r_desert') → the night at the inn of kasim → story_after_clear
(function (R) {
  'use strict';
  const E = R.DB.events;
  const REGION = 'r_desert';
  const LETTERS = 'desert_letters';
  const NAMES = ['ひとつ', 'ふたつ', '三つ'];

  // ------------------------------------------------------------ 墓守の像 (the three letters)
  async function statue(ev, id, letter) {
    const n0 = ev.var(LETTERS) || 0;
    if (ev.flag(id)) {
      await ev.say('墓守の像だ。台座に\n『' + letter + '』の文字が刻まれている。');
      if (n0 >= 3) await ev.say('三つの文字は、ひとつの名。\n――ハザル。');
      return;
    }
    await ev.say('墓守の像だ。\n長い杖を持ち、王の間の方を\nじっと見つめている。');
    ev.sfx('page');
    await ev.say('像の台座に、文字がひとつ刻まれている。\n『' + letter + '』……。');
    const n = n0 + 1;
    ev.setVar(LETTERS, n);
    ev.setFlag(id);
    if (n < 3) {
      await ev.say('{hero}は、年代記の余白に\n『' + letter + '』の文字を書きとめた。\n（見つけた文字：' + NAMES[n - 1] + '）');
      ev.setObjective('obj_desert_2', { region: REGION });
      return;
    }
    ev.closeMessage();
    ev.sfx('quill');
    await ev.flash('#fff4d0', 10);
    await ev.caption('三つの文字が、\nひとつの名になった。\n――ハザル。', { frames: 210 });
    ev.setObjective('obj_desert_3', { region: REGION });
    ev.refresh();
    if (ev.map === 'sand_tomb_3') {
      ev.sfx('unlock');
      await ev.shake(24, 2);
      await ev.say('どこかで、重い岩戸の\n動く音がした……。');
    } else {
      await ev.say('王墓の奥深くで、何かが\n目を覚ましたような気がする。');
    }
  }
  const statueMeta = (id) => ({ needs: [], gives: ['var:' + LETTERS + '+1', 'flag:' + id] });
  E.sand_tomb_1_statue = { meta: statueMeta('sand_tomb_1_statue'), run: (ev) => statue(ev, 'sand_tomb_1_statue', 'ハ') };
  E.sand_tomb_2_statue = { meta: statueMeta('sand_tomb_2_statue'), run: (ev) => statue(ev, 'sand_tomb_2_statue', 'ザ') };
  E.sand_tomb_3_statue = { meta: statueMeta('sand_tomb_3_statue'), run: (ev) => statue(ev, 'sand_tomb_3_statue', 'ル') };

  // ------------------------------------------------------------ 中ボス 砂もぐり (§10.8.3 #5)
  E.sand_tomb_2_boss = {
    meta: { needs: [], gives: ['flag:desert_mid'] },
    run: async (ev) => {
      if (ev.flag('desert_mid')) return;
      await ev.say('足もとの砂が、\nぐらりと揺れた……！');
      ev.closeMessage();
      ev.sfx('shake');
      await ev.shake(20, 2);
      ev.sfx('roar');
      await ev.say('砂の中から、巨大な\nミミズが姿を現した！');
      const r = await ev.battle('tr_b_sandworm');
      if (r !== 'win') return false;
      ev.npc('boss').hide();
      ev.setFlag('desert_mid');
      await ev.wait(16);
      ev.sfx('shake');
      await ev.shake(24, 2);
      ev.refresh();
      await ev.say('砂もぐりが砂の底へ沈むと、\n流れていた砂が、\nぴたりと止まった。');
      await ev.say('南の通路を、歩いて\n渡れそうだ。');
    },
  };
  E.sand_tomb_2_quicksand = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      if (ev.flag('desert_mid')) return;
      await ev.say('砂が渦を巻いて、\n底なしの穴へ流れ落ちている。');
      await ev.say('踏みこめば、のみこまれそうだ。\n……砂の奥で、何かが動いた。');
    },
  };

  // ------------------------------------------------------------ 王の間の岩戸 (closed until 3 letters)
  E.sand_tomb_3_door = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const n = ev.var(LETTERS) || 0;
      if (n >= 3) return;
      await ev.say('大きな岩戸が、\n固く閉ざされている。');
      await ev.say('岩戸の表に、名前を書く枠が\n三つ刻まれている。\n……どれも空白のままだ。');
      if (n > 0) await ev.say('台座で見つけた文字は、\nまだ' + NAMES[n - 1] + 'だけだ。');
      else await ev.say('墓守の像の台座に、\n文字が刻まれているという。');
    },
  };

  // ------------------------------------------------------------ フィーネ (§10.8.0-5, §10.9.4)
  // The script is the story's (story_fine_desert). Until it exists, the region's own line is said here.
  const FINE_LINE = '名を失ったものは、名を持つ\nものをうらやむの。\n……あの王も、きっと。';
  E.sand_tomb_3_fine = {
    meta: { needs: [], gives: ['flag:desert_fine'], calls: ['story_fine_desert'] },
    run: async (ev) => {
      if (ev.flag('desert_boss')) return;
      const f = ev.npc('fine');
      const again = ev.flag('desert_fine');
      if (R.DB.events.story_fine_desert) {
        await ev.call('story_fine_desert');
      } else {
        f.face('player');
        await ev.wait(12);
        if (!again) await ev.say(FINE_LINE);
        const t = ev.tier();
        if (t >= 6) await ev.say('……もう、あまり時間がないの。');
        else if (t >= 3) await ev.say('わたしのことは気にしないで。\n先へ進みなさい。');
        else await ev.say('……気をつけて。');
        ev.closeMessage();
        if (t >= 3 && !again) await ev.caption('フィーネの足元が、\n透けて見えた。');
        ev.sfx('magic');
        await ev.flash('#e8ecff', 10);
      }
      if (f.visible) f.hide();
      ev.setFlag('desert_fine');
    },
  };

  // ------------------------------------------------------------ ボス 名なき砂の王 (§10.8.3 #8–#9)
  E.sand_tomb_3_boss = {
    meta: {
      needs: ['var:' + LETTERS + '>=3'],
      gives: ['flag:desert_boss', 'region:' + REGION, 'item:k_page_desert'],
      warp: { to: 'kasim', spawn: 'inn' },
      calls: ['story_after_clear'],
    },
    run: async (ev) => {
      if (ev.flag('desert_boss')) return;
      const king = ev.npc('boss');
      await ev.say('祭壇の前に、砂でできた\n王の姿が立っている……。');
      await ev.say('……わが名を……\nわが名を、返せ……！', { voice: 'v_hazal_tomb_01' });
      ev.closeMessage();
      ev.sfx('roar');
      await ev.shake(20, 3);
      const r = await ev.battle('tr_b_sandking');
      if (r !== 'win') return false;
      ev.setFlag('desert_boss');
      // the name is given back (伝承の語り直し)
      await ev.wait(20);
      await ev.say('砂の王の体が、\nさらさらと崩れはじめた。');
      await ev.say('……わが名を……だれか……。', { voice: 'v_hazal_tomb_02' });
      ev.closeMessage();
      ev.sfx('quill');
      await ev.wait(20);
      await ev.say('{hero}は、年代記に\n王の名を書き記した。\n――ハザル。');
      ev.closeMessage();
      ev.sfx('light');
      await ev.flash('#fff8e0', 16);
      await ev.say('ハザル……そうだ、\nそれがわたしの名だ。', { voice: 'v_hazal_tomb_03' });
      await ev.say('民は、約束を覚えていて\nくれたのだな……。', { voice: 'v_hazal_tomb_04' });
      ev.closeMessage();
      ev.sfx('earth');
      await ev.flash('#e8d8b0', 12);
      king.hide();
      await ev.wait(30);
      await ev.say('王の姿は、砂になって\n静かに崩れていった。');
      await ev.say('王墓を吹き荒れていた風が、\nいつの間にか、やんでいた。');
      ev.closeMessage();
      await ev.clearRegion(REGION);
      // §10.8.0-3: one night at the inn of the town, then the story's scene
      await ev.wait(20);
      await ev.fadeOut(48);
      await ev.caption('その夜は、町の宿で眠った。');
      ev.heal();
      await ev.warp('kasim', 'inn', { fade: false });
      if (R.Engine.fadeAlpha > 0) await ev.fadeIn(40);
      if (R.DB.events.story_after_clear) await ev.call('story_after_clear');
      if (R.Engine.fadeAlpha > 0) await ev.fadeIn(20);
    },
  };
})(window.RPG);
