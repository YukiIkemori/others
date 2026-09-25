// Post-game events (クリア後のやりこみ): the entrance of 「深淵の迷宮」 on the northern islet,
// the dungeon's sealed shortcut, the sanctuary of its last floor, the superboss アビスロード and
// the exit circle behind it. Maps: src/maps/abyss.js (abyss_1..4) and the world map (tilePatch +
// step event on the islet, cond game_clear). Data: src/data/postgame.js (troop boss_abyss, items
// pg_*, objectives obj_postgame / obj_abyss_clear). Bonus scene: R.Postgame.bonusScene().
//
// Flags set here:  abyss_found (islet entered once)  abyss_entered (first look inside)
//                  abyss_sanctuary (sanctuary reached: opens the circle on floor 1)
//                  abyss_spirit_met  abyss_lord_met  abyss_clear (アビスロード defeated)
// Items given:     pg_genesis_sword  pg_abyss_crest (the lord's rewards)
// Also sets R.Game.title = '深淵を越えし者' (the 称号 the menus show).
// meta.warp {to, spawn}: where a step event takes the party (for tools that follow warps).
(function (R) {
  'use strict';
  const E = R.DB.events;
  const TITLE = '深淵を越えし者';
  const REWARDS = ['pg_genesis_sword', 'pg_abyss_crest'];

  // ------------------------------------------------------------ helpers
  /** turn the leader toward an NPC (the lord is drawn huge; the party may stand beside it) */
  function faceNpc(ev, id) {
    const f = R.Field;
    const n = f && f.npc ? f.npc(id) : null;
    const p = n && f.pos ? f.pos() : null;
    if (!n || !p) return;
    const dx = n.x - p.x, dy = n.y - p.y;
    if (!dx && !dy) return;
    ev.player.face(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }
  /** respawn point here (after a wipe the party wakes in the sanctuary) */
  function respawnHere() {
    if (R.Field && R.Field.setRespawnHere) R.Field.setRespawnHere();
  }
  /** holy ground: the encounter counter starts over (no fight inside the sanctuary) */
  function calmEncounters() {
    const L = R.Field && R.Field.layer;
    if (L && L.resetEnc) L.resetEnc();
  }

  // ============================================================ the islet
  E.abyss_entrance = {
    meta: { needs: ['flag:game_clear'], gives: ['flag:abyss_found'], warp: { to: 'abyss_1', spawn: 'entrance' } },
    async run(ev) {
      if (!ev.flag('abyss_found')) {
        ev.setFlag('abyss_found');
        ev.sfx('wind');
        await ev.say('岩山の裂け目に、底の見えない\n大穴が口を開けている……。');
        await ev.say('冷たい風とともに、闇の底から\n何かの鼓動が響いてくる。');
        if (!ev.flag('abyss_clear')) ev.setObjective('obj_postgame');
      }
      ev.sfx('stairs');
      await ev.warp('abyss_1', 'entrance', { dir: 'up' });
    },
  };

  // ============================================================ floor 1
  E.abyss_enter = {
    meta: { needs: [], gives: ['flag:abyss_entered'] },
    async run(ev) {
      if (ev.flag('abyss_entered')) return;
      ev.setFlag('abyss_entered');
      await ev.wait(30);
      ev.sfx('shake');
      await ev.shake(40, 2);
      await ev.say('ドクン……ドクン……。\n足元の闇の底から、\n巨大な鼓動が響いてくる。');
      await ev.say('{metem}「なによ、この魔力……。\n魔王なんて比べものに\nならないじゃない……！」');
      await ev.say('{non}「世界の底で、何かが\n目を覚まそうとしています。」');
      await ev.say('{yuki}「行こう。\n放っておいたら、\nせっかく戻った平和が\nまた壊されてしまう。」');
    },
  };
  /** the sealed circle of the entrance hall, examined while still sealed */
  E.abyss_gate_seal = {
    meta: { needs: [], gives: [] },
    async run(ev) {
      await ev.say('床の魔法陣が、固く\n封じられている……。');
      await ev.say('深淵の底から光が届けば、\n開くのかもしれない。');
    },
  };
  /** the open circle: straight down to the sanctuary of the last floor */
  E.abyss_gate_pad = {
    meta: { needs: ['flag:abyss_sanctuary'], gives: [], warp: { to: 'abyss_4', spawn: 'sanctuary' } },
    async run(ev) {
      ev.sfx('teleport');
      await ev.flash('#c8a0ff', 8);
      await ev.warp('abyss_4', 'sanctuary', { dir: 'right' });
    },
  };

  // ============================================================ the sanctuary (floor 4)
  /** the sanctuary's doorways: holy ground; the first visit opens the circle on floor 1 */
  E.abyss_sanctum = {
    meta: { needs: [], gives: ['flag:abyss_sanctuary'] },
    async run(ev) {
      calmEncounters();
      if (ev.flag('abyss_sanctuary')) return;
      ev.setFlag('abyss_sanctuary');
      ev.refresh();
      ev.sfx('holy');
      await ev.flash('#fff8d0', 10);
      await ev.say('そこだけが清らかな光に\n満たされている。\n魔物の気配がまったくない。');
      await ev.say('床の魔法陣が淡く光った。\nはるか上の階の封印も、\n解けたような気がする。');
    },
  };

  const HINTS = [
    '深淵の主アビスロードは、\n天地が生まれる前から\nこの底に眠る混沌の竜神。',
    'その無数の瞳は心を惑わせ、\n歌は眠りを誘い、\n鎖は体を縛ります。\n心と体を守る備えを。',
    '滅びの宣告を受けた者は、\nたちまち命を落とします。\f死を退ける護り、\n倒れても立ち上がる力が\nあなたたちを救うはず。',
    'あれは時おり、すべての加護を\n打ち消す波動を放ち、\n続けて終焉の咆哮を上げます。\n波動の後は傷を癒やして。',
    '鱗が黄金に輝いたら、\n打ち消しの力ではがすのです。\f業火と凍気の吐息は、\n属性の護りで和らぎます。',
    '深く傷つくほど、あれは激しく\n暴れ、やがて混沌の力で\n傷をふさぐでしょう。\f力だけでは届かぬ相手。\n多くの技を身につけ、\n備えを整えてから挑みなさい。',
  ];
  E.abyss_spirit = {
    meta: { needs: [], gives: ['flag:abyss_sanctuary', 'flag:abyss_spirit_met'] },
    async run(ev) {
      if (!ev.flag('abyss_sanctuary')) { ev.setFlag('abyss_sanctuary'); ev.refresh(); }
      if (ev.flag('abyss_clear')) {
        await ev.say('光の精霊「深淵の主は、\n光の中へ還りました。\f世界の底にも、ようやく\n静けさが戻ったのです。\nありがとう、光の子らよ。」');
      } else if (!ev.flag('abyss_spirit_met')) {
        ev.setFlag('abyss_spirit_met');
        await ev.say('光の精霊「よくぞここまで……。\nわたしは、深淵に沈んだ\n最後の光のかけら。」');
        await ev.say('「この先で、深淵の主が\nあなたたちを待っています。\fここで傷を癒やし、\n備えを整えていきなさい。」');
      }
      for (;;) {
        const i = await ev.ask('光の精霊「何を望みますか？」', ['傷を癒やす', '記録をつける', '深淵の主のこと', 'やめる']);
        if (i === 0) {
          ev.sfx('heal');
          await ev.flash('#fff8d0', 12);
          ev.heal();
          respawnHere();
          await ev.say('やわらかな光が3人を包み、\n傷がすっかり癒えた！');
        } else if (i === 1) {
          await ev.saveMenu();
        } else if (i === 2) {
          if (ev.flag('abyss_clear')) await ev.say('光の精霊「深淵の主は、\nもうどこにもいません。\nあなたたちが討ったのです。」');
          else for (const h of HINTS) await ev.say(h);
        } else {
          await ev.say('光の精霊「光の加護が、\nあなたたちとともに\nありますように。」');
          return;
        }
      }
    },
  };

  // ============================================================ アビスロード
  async function victory(ev) {
    faceNpc(ev, 'abyss_lord');
    await ev.say('アビスロード「グ……オオオ……！\nこの我が……\n光に砕かれるだと……！」');
    await ev.say('「……見事だ、光の子らよ。\f混沌は決して消えぬ。\nだが、貴様らが在る限り、\n再び目覚めることも\nあるまい……。」');
    ev.closeMessage();
    ev.sfx('boss_die');
    await ev.flash('#ffffff', 24);
    await ev.shake(60, 4);
    ev.setFlag('abyss_clear');
    ev.refresh();
    await ev.wait(40);
    await ev.say('アビスロードの巨体は、\n七色の光の粒となって\n闇の中へ溶けていった……。');
    // the 称号 and the lord's treasures
    if (R.Game) R.Game.title = TITLE;
    await ev.gotItem('3人は称号\n『' + TITLE + '』を\n手に入れた！', 'keyitem');
    await ev.say('光の粒が消えたあとには、\nまばゆく輝く剣と\n紋章が残されている。');
    for (const id of REWARDS) await ev.give(id);
    ev.setObjective('obj_abyss_clear');
    ev.closeMessage();
    if (R.Postgame && R.Postgame.bonusScene) await R.Postgame.bonusScene();
    else await ev.say('世界の底に眠っていた混沌は\n静かに消えていった。\f深淵を越えた3人の名は、\n光の伝説の最後の頁に\n刻まれることになる――');
    await ev.say('……ふと見ると、深淵の主が\nいた場所の奥で、\n魔法陣が静かに光っている。');
  }
  E.abyss_lord = {
    meta: { needs: [], gives: ['flag:abyss_lord_met', 'flag:abyss_clear', 'item:pg_genesis_sword', 'item:pg_abyss_crest'] },
    async run(ev) {
      if (ev.flag('abyss_clear')) return;
      faceNpc(ev, 'abyss_lord');
      if (!ev.flag('abyss_lord_met')) {
        if (R.Audio && R.Audio.stopBGM) { try { R.Audio.stopBGM(60); } catch (e) { /* ignore */ } }
        await ev.wait(40);
        ev.sfx('shake');
        await ev.shake(50, 3);
        await ev.say('深淵の底で、何かが\nゆっくりと目を開いた……。');
        ev.sfx('roar');
        await ev.flash('#4020a0', 12);
        await ev.say('アビスロード「……光の残り火か。\n魔王を滅ぼしたのは\n貴様らだな。」');
        await ev.say('「あれは、我が見た夢の\nひとかけらにすぎぬ。\f我は始原の混沌。\n天地が分かたれる前より\nこの底に在り、\nやがてすべてを呑む者。」');
        await ev.say('{metem}「魔王が夢のかけら……？\n冗談でしょ……！」\n{non}「でも、この気配は\n本物です……。」');
        await ev.say('{yuki}「それでも、\n負けるわけにはいかない！」');
        await ev.say('アビスロード「よかろう。\nその光が本物かどうか、\n混沌の中で確かめてやろう。」');
        ev.setFlag('abyss_lord_met');
      } else {
        await ev.say('アビスロード「……また来たか、\n光の子らよ。\f何度でも、混沌の底へ\n沈めてくれよう。」');
      }
      if (!(await ev.yesno('アビスロードに挑みますか？'))) {
        await ev.say('{yuki}「……まだだ。\nもっと備えを整えてこよう。」');
        ev.bgm('abyss'); // the first meeting silenced the dungeon
        ev.player.face('down');
        return false;
      }
      ev.sfx('roar');
      await ev.flash('#ffffff', 10);
      await ev.shake(30, 4);
      if ((await ev.battle('boss_abyss')) !== 'win') return false;
      await victory(ev);
    },
  };

  /** the exit circle that opens behind the lord once it has fallen */
  E.abyss_exit = {
    meta: { needs: ['flag:abyss_clear'], gives: [], warp: { to: 'world', spawn: 'abyss_1' } },
    async run(ev) {
      ev.sfx('warp');
      if (!(await ev.yesno('魔法陣が静かに光っている。\n外へ出ますか？'))) return false;
      ev.sfx('teleport');
      await ev.warp('world', 'abyss_1', { dir: 'down' });
      return true;
    },
  };
})(window.RPG);
