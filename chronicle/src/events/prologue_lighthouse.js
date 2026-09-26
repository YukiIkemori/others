// Prologue (A18b) — ファロス灯台 (DESIGN §10.7 P8–P9, §4.9.6, §9.11.7).
//   lighthouse_1_door      the closed tower door (examine, until 灯台の鍵)
//   lighthouse_1_tutorial  P8 three steps inside: the keeper, two rats, the hero alone —
//                          the guaranteed first 閃き; lost fights are retried until won
//   lighthouse_1_otto      talking to the keeper at the door starts the same lesson
//   lighthouse_3_fine      P9 the girl in grey (first appearance, no name)
//   lighthouse_3_boss      P9 ページ食らい → the song comes back → the lamp burns → the inn in Faros,
//                          next morning (lute_departure)
(function (R) {
  'use strict';
  const E = R.DB.events;

  // ------------------------------------------------------------ 閉じた扉
  E.lighthouse_1_door = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      await ev.say('灯台の扉には、がっしりと\n鍵がかかっている。');
      if (ev.flag('pro_lute')) await ev.say('灯台守なら、\n鍵を持っているかもしれない。');
    },
  };

  // ------------------------------------------------------------ P8 チュートリアルの戦闘
  const TUTORIAL = { troop: 'tr_tutorial', members: ['hero'], glimmerForce: 'hero', canLose: true, noEscape: true, noRare: true, noGolden: true };
  E.lighthouse_1_tutorial = {
    meta: { needs: ['item:k_lighthouse_key'], gives: ['flag:pro_tutorial'] },
    run: async (ev) => {
      if (ev.flag('pro_tutorial')) return;
      const otto = ev.npc('otto_door');
      otto.face('player');
      await ev.say('中から、ネズミの鳴き声が……\n気をつけるんじゃ！');
      ev.closeMessage();
      ev.sfx('roar');
      await ev.shake(16, 2);
      await ev.say('ネズミ2匹なら、{hero}ひとりで\n十分じゃろう。仲間は後ろで見ておれ。');
      const h = ev.hero;
      const t0 = ((h && h.techs) || []).length, s0 = ((h && h.spells) || []).length;
      for (;;) {
        const r = await ev.battle(TUTORIAL);
        if (r === 'win') break;
        otto.face('player');
        await ev.say('……危なかったのう。\nひと息ついて、もう一度じゃ。');
        ev.heal();
      }
      const h2 = ev.hero || h;
      const newTech = ((h2 && h2.techs) || []).length > t0;
      const spell = !newTech && ((h2 && h2.spells) || []).length > s0;
      otto.face('player');
      if (spell) {
        await ev.say('今のは……『閃き』じゃな。戦いの中で、\nふいに新しい術を思いつくことがある。');
        await ev.say('閃いた術は、年代記の術の書に\n書き残される。メニューの『術の書』で\n見られるぞ。');
      } else {
        await ev.say('今のは……『閃き』じゃな。戦いの中で、\nふいに新しい技を思いつくことがある。');
        await ev.say('閃いた技は、年代記の技の書に\n書き残される。メニューの『技の書』で\n見られるぞ。');
      }
      await ev.say('わしは港へ戻っておる。\n上の灯室を、頼んだぞ。');
      ev.closeMessage();
      if (otto.visible) {
        await otto.walk('RRD');
        otto.hide();
      }
      ev.setFlag('lighthouse_1_tutorial');
      ev.setFlag('pro_tutorial');
    },
  };
  E.lighthouse_1_otto = {
    meta: { needs: ['item:k_lighthouse_key'], gives: ['flag:pro_tutorial'] },
    run: async (ev) => {
      if (ev.flag('pro_tutorial')) return;
      await ev.call('lighthouse_1_tutorial');
    },
  };

  // ------------------------------------------------------------ P9 灰色のマントの少女
  E.lighthouse_3_fine = {
    meta: { needs: [], gives: ['flag:lighthouse_3_fine'] },
    run: async (ev) => {
      if (ev.flag('lighthouse_3_fine')) return;
      const f = ev.npc('fine');
      await ev.wait(16);
      f.face('player');
      await ev.wait(20);
      await ev.say('言葉を失った灯は、\n言葉で取り戻すの。', { voice: 'v_fine_lighthouse_01' });
      await ev.say('……あなたなら、できるわ。', { voice: 'v_fine_lighthouse_02' });
      ev.closeMessage();
      ev.sfx('magic');
      await ev.flash('#e8ecff', 10);
      f.hide();
      await ev.wait(30);
      await ev.say('灰色のマントの少女は、\nかき消すようにいなくなった……。');
      ev.setFlag('lighthouse_3_fine');
    },
  };

  // ------------------------------------------------------------ P9 ページ食らい
  const SCRAPS = ['scrap_a', 'scrap_b', 'scrap_c'];
  E.lighthouse_3_boss = {
    meta: {
      needs: ['item:k_lighthouse_key'],
      gives: ['flag:pro_boss', 'flag:prologue_done', 'item:k_chronicle', 'item:k_quill', 'item:k_bell'],
      warp: { to: 'lute', spawn: 'inn' },
      calls: ['lute_departure'],
    },
    run: async (ev) => {
      if (ev.flag('pro_boss')) return;
      await ev.say('……シャリ、シャリ……。\n紙をかみ切るような音がする。');
      await ev.say('灯台の灯のそばで、白い紙の\n化け物が、何かを食べている……！');
      ev.closeMessage();
      ev.sfx('roar');
      await ev.shake(20, 3);
      const r = await ev.battle('tr_b_pageeater');
      if (r !== 'win') return false;
      // the song comes back out of the page eater
      ev.npc('boss').hide();
      await ev.wait(20);
      await ev.say('ページ食らいの体から、\n白い紙切れが舞い上がった。');
      ev.closeMessage();
      for (const id of SCRAPS) {
        const s = ev.npc(id);
        if (!s.visible) continue;
        ev.sfx('page');
        await ev.flash('#ffffff', 4);
        s.hide();
        await ev.wait(12);
      }
      await ev.say('紙切れに、少しずつ\n文字が浮かんでくる……。');
      ev.closeMessage();
      await ev.caption('♪　海の果てまで、灯よ届け\n帰る舟に、道を照らせ', { frames: 210 });
      ev.sfx('quill');
      await ev.caption('{hero}は、\n守り歌を年代記に書き記した。');
      // the lamp burns again (lamp → lamp_lit)
      ev.setFlag('pro_boss');
      ev.refresh();
      ev.sfx('light');
      await ev.flash('#ffffff', 18);
      await ev.shake(12, 2);
      await ev.flash('#fffbe0', 12);
      await ev.say('灯台に、火がともった！');
      await ev.say('白い光が、夜の海を\nまっすぐに照らしていく。');
      ev.closeMessage();
      await ev.wait(30);
      await ev.fadeOut(48);
      await ev.caption('その夜、{hero}たちは\nファロスの宿で眠った。');
      await ev.caption('翌朝――');
      ev.heal();
      await ev.warp('lute', 'inn', { fade: false });
      await ev.call('lute_departure');
    },
  };
})(window.RPG);
