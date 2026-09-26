// 白の大書庫 (DESIGN §10.10.3–§10.10.4). Owner: story (A19).
//   archive_1_enter     the first step inside: the white stacks, フィーネ's voice (once)
//   archive_2_boss      本の巨人 on the stairs up → final_golem
//   archive_3_door      the sealed door (examine, before the seal is opened)
//   archive_3_rowell    ロウェル opens the seal with his notebook's words and holds back the scribes → final_rowell
//   archive_4_boss      the king's voice, 伝説の三つの影 → final_shades; then フィーネ's voice
//   archive_4_painting  the four paintings of the eastern legend (examine; the Crest tie-in §10.1.3)
//   archive_5_lazaro    大書記ラザロ in his study → tr_b_lazaro → the king takes him up → final_lazaro
//   archive_5_portrait  ミラ's portrait · archive_5_seal  the white paper over the stairs
//   archive_6_boss      虚ろの王 → the name is written → ネムレア → R.Ending (§10.10.4). A wipe in the second form
//                       leaves final_nemrea1 set: the next try starts from the naming scene (short).
(function (R) {
  'use strict';
  const E = R.DB.events;
  const S = R.Story;
  const say = S.said;
  const NONE = { needs: [], gives: [] };

  // ------------------------------------------------------------ 1F
  E.archive_1_enter = {
    meta: { needs: [], gives: ['flag:archive_1_enter'] },
    run: async (ev) => {
      S.autoPos(ev);
      if (ev.flag('archive_1_enter')) return;
      await ev.wait(10);
      await ev.say('白い書架が、どこまでも\n続いている……。');
      await ev.say('どの本の背にも、題が\n書かれていない。');
      ev.closeMessage();
      await ev.wait(20);
      ev.sfx('magic');
      await ev.say('どこからか、フィーネの声が\n聞こえた。');
      await ev.say('……{hero}。頂で、\n待っているわ。');
      ev.setFlag('archive_1_enter');
    },
  };

  // ------------------------------------------------------------ 2F 本の巨人
  E.archive_2_boss = {
    meta: { needs: [], gives: ['flag:final_golem'] },
    run: async (ev) => {
      S.autoPos(ev);
      if (ev.flag('final_golem')) return;
      await ev.say('書架の本が、ひとりでに\n舞い上がった……！');
      ev.closeMessage();
      ev.sfx('roar');
      await ev.shake(20, 3);
      await ev.say('本が集まって、巨人の姿に\nなった！　上り階段を\nふさいでいる！');
      const r = await ev.battle('tr_b_bookgolem');
      if (r !== 'win') return false;
      ev.npc('boss').hide();
      ev.sfx('page');
      await ev.flash('#ffffff', 8);
      await ev.say('本の巨人は、ばらばらの\nページになって崩れ落ちた。');
      ev.setFlag('final_golem');
    },
  };

  // ------------------------------------------------------------ 3F 封印の扉とロウェル
  E.archive_3_door = {
    meta: NONE,
    run: async (ev) => {
      S.autoPos(ev);
      if (ev.has('k_rowell_note') || ev.flag('final_rowell')) return;
      await ev.say('分厚い扉に、白い封印が\nほどこされている。');
      await ev.say('封印を解く言葉が\nいるようだ……。');
    },
  };
  E.archive_3_rowell = {
    meta: { needs: [], gives: ['flag:final_rowell'] },
    run: async (ev) => {
      S.autoPos(ev);
      if (ev.flag('final_rowell')) return;
      const staged = ev.map === 'archive_3' && R.Field && R.Field.map;
      let rowell = null;
      const p = staged ? R.Field.pos() : { x: 19, y: 5 };
      const rx = p.x >= 20 ? 19 : 20; // he comes up the gallery beside the hero, who stands before the door
      await ev.say('後ろから、足音が近づいてくる。');
      ev.closeMessage();
      if (staged) {
        rowell = S.actor(ev, 'st_rowell', 'npc:rowell', rx, 17, 'up');
        await rowell.walk('U11');
        rowell.face('up');
        ev.player.face(rx > p.x ? 'right' : 'left');
      }
      await ev.say('待たせたな。……ここが、\n封印の扉だ。');
      ev.closeMessage();
      ev.player.face('up');
      await ev.say('ロウェルは手帳を開き、\n封印の言葉を読み上げた。');
      await ev.say('「白き書の扉よ、\n名を持つ者のために開け」');
      ev.closeMessage();
      ev.sfx('unlock');
      ev.setFlag('final_rowell');
      ev.refresh();
      await ev.flash('#ffffff', 8);
      await ev.wait(20);
      // the scribes come up the gallery
      const scribes = [];
      if (staged) {
        for (const [i, x] of [[0, 18], [1, 21], [2, 20]]) scribes.push(S.actor(ev, 'st_scribe' + i, 'npc:scribe', x, 19 + i, 'up'));
        await Promise.all(scribes.map((s) => s.walk('U10')));
        rowell.face('down');
      }
      await ev.say('院長の書記たちか……。');
      await ev.say('ここは、おれが引き受ける。\n行け、語り部！');
      ev.closeMessage();
      if (staged) {
        await ev.wait(10);
        await ev.fadeOut(24);
        S.dropActors();
        ev.refresh();
        await ev.fadeIn(24);
      }
      await ev.say('ロウェルが、書記たちを\n回廊の奥へ押し返していく……。');
    },
  };

  // ------------------------------------------------------------ 4F 伝説の三つの影
  E.archive_4_boss = {
    meta: { needs: [], gives: ['flag:final_shades'] },
    run: async (ev) => {
      S.autoPos(ev);
      if (ev.flag('final_shades')) return;
      await ev.say('どこからか、低い声が響いた。');
      await ev.say('海の向こうの、名を忘れられた\n勇者たちよ……。');
      ev.closeMessage();
      ev.sfx('dark');
      await ev.flash('#c8d0ff', 12);
      await ev.say('三つの白い影が、\nゆらりと立ち上がった！');
      const r = await ev.battle('tr_b_heroshades');
      if (r !== 'win') return false;
      for (const id of ['boss', 'boss2', 'boss3']) ev.npc(id).hide();
      ev.sfx('holy');
      await ev.flash('#ffffff', 10);
      await ev.say('影は、光の粒になって\n消えていった。');
      await ev.say('フィーネの声が聞こえた。');
      await ev.say('三百年前、東の大陸で魔王を\n討った勇者たちの影……。');
      await ev.say('名は忘れられても、物語は\n残っていたのね。');
      ev.setFlag('final_shades');
    },
  };
  const PAINTINGS = {
    8: ['絵には、剣を掲げた若者が\n描かれている。', '剣の家に生まれた\n勇者だという。'],
    14: ['絵には、祈りをささげる\n神殿の娘が描かれている。', '娘の手から、やわらかな光が\nあふれている。'],
    20: ['絵には、杖を振るう\n魔法の天才が描かれている。', '空に、星のような光が\n舞っている。'],
    26: ['絵には、光の紋章が\n黒い魔王を封じる姿が\n描かれている。', 'どの絵にも、勇者たちの\n名は書かれていない。'],
  };
  E.archive_4_painting = {
    meta: NONE,
    PAINTINGS,
    run: async (ev) => {
      S.autoPos(ev);
      const fr = R.Field && R.Field.front ? R.Field.front() : null;
      const x = ev.ctx && ev.ctx.x != null ? ev.ctx.x : fr ? fr.x : 8;
      const t = PAINTINGS[x] || PAINTINGS[8];
      for (const p of t) await ev.say(p);
    },
  };

  // ------------------------------------------------------------ 5F 大書記ラザロ
  E.archive_5_lazaro = {
    meta: { needs: [], gives: ['flag:final_lazaro'] },
    run: async (ev) => {
      S.autoPos(ev);
      if (ev.flag('final_lazaro')) return;
      const lz = ev.npc('lazaro');
      ev.bgm('tension');
      await ev.wait(20);
      await lz.walk('D4', 20);
      lz.face('down');
      await ev.say(say('lazaro', 'よく来ましたね、語り部。'));
      await ev.say(say('lazaro', '二十年前、伝承戦争で\n娘のミラを失いました。'));
      await ev.say(say('lazaro', 'どちらの伝承が正しいか……\nそんなことのために。'));
      await ev.say(say('lazaro', '忘れてしまえば、争いも\n悲しみも、初めから\n無かったことになる。'));
      await ev.say(say('lazaro', 'それが救いなのですよ。\n……それでも、あなたは\n書くのですね。'));
      await ev.say(say('lazaro', 'ならば、その筆を\n折らせていただきましょう。'));
      const r = await ev.battle('tr_b_lazaro');
      if (r !== 'win') return false;
      ev.bgm('sorrow');
      await ev.say(say('lazaro', '……なぜだ。忘れたはずの\nあの子の笑顔が……\n今になって……。'));
      ev.closeMessage();
      ev.sfx('dark');
      await ev.shake(16, 2);
      await ev.say(say('king', 'よくやった、ラザロ。\nおまえの悲しみは、じつに\n美味であった。'));
      ev.closeMessage();
      ev.sfx('warp');
      await ev.flash('#ffffff', 16);
      lz.hide();
      await ev.flash('#ffffff', 10);
      await ev.say('白い光に包まれて、\nラザロの姿が消えた。');
      ev.closeMessage();
      ev.setFlag('final_lazaro');
      ev.refresh();
      ev.sfx('unlock');
      await ev.say('階段をふさいでいた\n白い紙が、ほどけていく……。');
      ev.bgm();
    },
  };
  E.archive_5_portrait = {
    meta: NONE,
    run: async (ev) => {
      S.autoPos(ev);
      await ev.say('女の子の肖像画だ。\n本を抱えて、笑っている。');
      await ev.say('額の下に「ミラ」と\n名前が刻まれている。');
      if (ev.flag('final_lazaro')) await ev.say('絵の裏に、小さな字で\n書き込みがある。\f「わたしの名前を、\nいつまでも呼んでね」');
    },
  };
  E.archive_5_seal = {
    meta: NONE,
    run: async (ev) => {
      S.autoPos(ev);
      if (ev.flag('final_lazaro')) return;
      await ev.say('上り階段が、白い紙で\n幾重にもふさがれている。');
    },
  };

  // ------------------------------------------------------------ 6F 虚ろの王 → ネムレア
  /** the naming scene (§10.10.4-2); short = a retry after a wipe in the second form */
  async function naming(ev, short) {
    const staged = ev.map === 'archive_6' && R.Field && R.Field.map;
    let fine = null;
    if (staged) {
      const p = R.Field.pos();
      const fx = p.x < 26 ? p.x + 1 : p.x - 1;
      fine = S.actor(ev, 'st_fine', 'npc:fine_fade', fx, p.y + 2, 'up');
      fine.hide();
      ev.sfx('magic');
      await ev.flash('#e8ecff', 10);
      fine.show();
      await fine.walk('U', 16);
      fine.face('up');
    }
    if (short) await ev.say(say('fine', 'もう一度よ、{hero}。\nその名を、記して！'));
    else await ev.say(say('fine', '{hero}、今よ！\n年代記に、その名を記して！'));
    ev.closeMessage();
    ev.sfx('quill');
    await ev.wait(40);
    await ev.say('{hero}は、八枚のページの\n破れ目に浮かぶ名を、\n年代記に書き記した。');
    ev.closeMessage();
    await ev.caption('――ネムレア。', { size: 16, frames: 150 });
    await ev.say(say('king', '名を……呼んだな……！'));
    ev.closeMessage();
    ev.sfx('roar');
    await ev.shake(24, 4);
    await ev.flash('#ffffff', 14);
    const m = R.Field && R.Field.map;
    const b = m && m.npc('boss');
    if (b) b.sprite = R.Gfx.has('mon:boss_nemrea2') ? 'mon:boss_nemrea2' : b.sprite;
    await ev.flash('#ffffff', 10);
    await ev.say('紙片の影が、ひとつの形を\n結んでいく……！');
    await ev.say(say('fine', 'わたしの最後の光を、\nあなたたちに。'));
    ev.closeMessage();
    ev.sfx('heal');
    await ev.flash('#fffbe0', 16);
    ev.heal();
    await ev.say('{hero}たちの傷が、\nすっかり癒えた。');
    ev.closeMessage();
    return fine;
  }
  E.archive_6_boss = {
    meta: { needs: ['flag:final_lazaro'], gives: ['flag:final_nemrea1', 'flag:game_clear'] },
    run: async (ev) => {
      S.autoPos(ev);
      if (ev.flag('game_clear')) return;
      const retry = ev.flag('final_nemrea1');
      if (!retry) {
        await ev.say('祭壇の前で、白い紙片が\n渦を巻いている……。');
        ev.closeMessage();
        ev.sfx('dark');
        await ev.shake(20, 2);
        await ev.say(say('king', '名もなく、形もなく、\nわれはすべてを白紙に還す。'));
        const r1 = await ev.battle('tr_b_nemrea1', { noEscape: true });
        if (r1 !== 'win') return false;
        ev.setFlag('final_nemrea1');
        ev.refresh();
        ev.sfx('page');
        await ev.flash('#ffffff', 10);
        await ev.say('紙片の渦から、ラザロの体が\n投げ出された。');
        await ev.say(say('king', '無駄だ。名なきものは、\n消えぬ。'));
        ev.closeMessage();
      } else {
        await ev.say(say('king', 'また来たか……。\n名なきものは、消えぬ。'));
        ev.closeMessage();
      }
      await naming(ev, retry);
      const r2 = await ev.battle('tr_b_nemrea2', { noEscape: true });
      if (r2 !== 'win') return false;
      await ev.ending();
    },
  };
})(window.RPG);
