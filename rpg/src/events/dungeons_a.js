// Events of the first-half dungeons (DESIGN §7.3, §7.4): the boss fights of the Wind Cave,
// Bandit Fort, Water Cave and Pyramid, the crest altars, and the exit circles that open after
// each boss. Maps: src/maps/dungeons_a.js.
//
// Flags set here:  boss_wind_done got_crest_wind  boss_fort_done bandits_defeated
//                  boss_water_done got_crest_water  boss_pyramid_done got_crest_earth
// Items given:     crest_wind  silver_key  crest_water  crest_earth
(function (R) {
  'use strict';
  const E = R.DB.events;
  const CRESTS = ['crest_wind', 'crest_water', 'crest_earth', 'crest_fire', 'crest_star'];
  const KAZU = ['ゼロ', '一つ', '二つ', '三つ', '四つ', '五つ'];

  // ------------------------------------------------------------ helpers
  /** turn the leader toward an NPC (bosses are drawn big; talking from the side still works) */
  function faceNpc(ev, id) {
    const f = R.Field;
    const n = f && f.npc ? f.npc(id) : null;
    if (!n || !f.pos) return;
    const p = f.pos();
    const dx = n.x - p.x, dy = n.y - p.y;
    if (!dx && !dy) return;
    ev.player.face(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }
  /** after a crest / the key: point the menu's objective at the next story stage */
  function nextObjective(ev, fallback) {
    let id = R.Story && R.Story.objective ? R.Story.objective() : fallback;
    if (!R.DB.objectives || !R.DB.objectives[id]) id = fallback;
    if (id && R.DB.objectives && R.DB.objectives[id]) ev.setObjective(id);
  }
  /** a monster (or its whole group) leaves the map: flag, redraw, short pause */
  async function vanish(ev, flag, fx) {
    if (fx === 'flash') await ev.flash('#ffffff', 10);
    else if (fx === 'fade') await ev.fadeOut(24);
    ev.setFlag(flag);
    ev.refresh();
    if (fx === 'fade') await ev.fadeIn(24);
    else await ev.wait(16);
  }
  /** the crest altar: take the crest (NPC over a pedestal) */
  async function takeCrest(ev, o) {
    if (ev.flag(o.got) || !ev.flag(o.boss)) return false;
    await ev.say(o.look);
    ev.sfx('holy');
    await ev.wait(20);
    ev.setFlag(o.got);
    ev.refresh();
    await ev.give(o.item);
    await ev.say(o.after);
    const n = CRESTS.filter((id) => ev.has(id)).length;
    await ev.say(n >= CRESTS.length ? 'ついに五つの紋章が\nすべてそろった！' : 'これで紋章は' + KAZU[n] + '。\n残る紋章はあと' + KAZU[CRESTS.length - n] + 'だ。');
    nextObjective(ev, o.fallback);
    await ev.say('……ふと見ると、床の魔法陣が\n淡く光っている。\nあれに乗れば外へ出られそうだ。');
    return true;
  }

  // ------------------------------------------------------------ exit circle (after each boss)
  E.da_exit_circle = {
    meta: { needs: [], gives: [] },
    async run(ev) {
      const def = R.DB.maps[ev.map];
      const esc = def && def.escape;
      if (!esc) return false;
      ev.sfx('warp');
      if (!(await ev.yesno('魔法陣が静かに光っている。\n外へ出ますか？'))) return false;
      ev.sfx('teleport');
      await ev.warp(esc.to, esc.spawn, { dir: 'down' });
      return true;
    },
  };

  // ============================================================ Wind Cave
  E.wind_boss = {
    meta: { needs: [], gives: ['flag:boss_wind_done'] },
    async run(ev) {
      if (ev.flag('boss_wind_done')) return;
      faceNpc(ev, 'wind_chief');
      ev.sfx('roar');
      await ev.say('ゴブリン親分「グヘヘヘ……\nこんな奥までのこのこ来るとは、\n生意気な人間どもめ！」');
      await ev.say('「奥の光る石は、\nおれ様のお宝だ！\f欲しけりゃ力ずくで奪ってみな！\n野郎ども、かかれーっ！」');
      if ((await ev.battle('boss_wind')) !== 'win') return false;
      await ev.say('ゴブリン親分「ひ、ひいいっ！\n覚えてろよー！」');
      await vanish(ev, 'boss_wind_done', 'fade');
      await ev.say('ゴブリンたちは洞窟の奥へ\n逃げていった……。');
      await ev.say('奥の部屋から、\n不思議な風が吹いてくる……。');
    },
  };
  E.wind_crest = {
    meta: { needs: ['flag:boss_wind_done'], gives: ['item:crest_wind', 'flag:got_crest_wind'] },
    run: (ev) => takeCrest(ev, {
      boss: 'boss_wind_done', got: 'got_crest_wind', item: 'crest_wind', fallback: 'obj_gate',
      look: '台座の上で、緑色の紋章が\n静かに光っている……。',
      after: '風の紋章からあふれた風が、\n3人を優しく包み込んだ……。',
    }),
  };

  // ============================================================ Bandit Fort
  E.fort_boss = {
    meta: { needs: [], gives: ['flag:boss_fort_done', 'flag:bandits_defeated', 'item:silver_key'] },
    async run(ev) {
      if (ev.flag('boss_fort_done')) return;
      faceNpc(ev, 'fort_chief');
      await ev.say('盗賊頭「なんだなんだ、お前ら！\nここをどこだと思ってやがる！」');
      await ev.say('「……ほう、ポルタの連中に\n頼まれて来たってわけか。\fふん！　港も船も、\nみーんなおれ様のもんだ！\f生きて帰れると思うなよ。\nまとめて片づけてやる！」');
      if ((await ev.battle('boss_fort')) !== 'win') return false;
      faceNpc(ev, 'fort_chief');
      await ev.say('盗賊頭「ま、参った！\nおれたちの負けだ！\f港からは手を引く！\nこいつをやるから勘弁してくれ！」');
      await ev.give('silver_key');
      await ev.say('盗賊頭「その鍵があれば、\nおれ様の宝物庫も開くぜ……。\fちくしょう！　ずらかるぞ、\n野郎ども！」');
      ev.setFlag('bandits_defeated');
      await vanish(ev, 'boss_fort_done', 'fade');
      await ev.say('盗賊たちは砦から\n一目散に逃げ出していった。');
      nextObjective(ev, 'obj_ship');
      await ev.say('これでポルタの港にも\n船が戻るはずだ。\n船長に知らせよう。');
    },
  };

  // ============================================================ Water Cave
  E.water_boss = {
    meta: { needs: [], gives: ['flag:boss_water_done'] },
    async run(ev) {
      if (ev.flag('boss_water_done')) return;
      faceNpc(ev, 'water_serpent');
      await ev.shake(24, 2);
      await ev.say('湖の水面が\n大きくうねった……！');
      ev.sfx('roar');
      await ev.say('大海蛇「……シュルルル……\nニンゲンか……。\fこの湖の主は我なり。\n青く光る紋章も、我がもの。\f冷たい水底へ\n沈めてくれよう！」');
      if ((await ev.battle('boss_water')) !== 'win') return false;
      await ev.say('大海蛇「グ……グオオオ……！」');
      ev.sfx('water');
      await ev.shake(30, 3);
      await vanish(ev, 'boss_water_done', 'flash');
      await ev.say('大海蛇は湖の底へ\n沈んでいった……。\f水面は静けさを取り戻した。');
    },
  };
  E.water_crest = {
    meta: { needs: ['flag:boss_water_done'], gives: ['item:crest_water', 'flag:got_crest_water'] },
    run: (ev) => takeCrest(ev, {
      boss: 'boss_water_done', got: 'got_crest_water', item: 'crest_water',
      fallback: ev.has('crest_earth') ? 'obj_frost' : 'obj_earth',
      look: '台座の上で、青い紋章が\n水のように揺らめいている……。',
      after: '水の紋章から澄んだ光が\nあふれ出し、3人を包み込んだ……。',
    }),
  };

  // ============================================================ Pyramid
  E.pyramid_boss = {
    meta: { needs: [], gives: ['flag:boss_pyramid_done'] },
    async run(ev) {
      if (ev.flag('boss_pyramid_done')) return;
      faceNpc(ev, 'pyramid_sphinx');
      await ev.say('スフィンクス「止まれ、人の子よ。\n我が名はスフィンクス。\nいにしえの王の眠りを\n守る者なり。」');
      await ev.say('「大地の紋章を求める者よ。\n汝らに、その資格ありや？\f力なき者に\n紋章を持つ資格なし。\f汝らの力、\n我に示してみせよ！」');
      if ((await ev.battle('boss_pyramid')) !== 'win') return false;
      await ev.say('スフィンクス「……見事だ。\n汝らこそ、紋章に\n選ばれし者たち……。\f王の眠る部屋へ\n進むがよい……。」');
      ev.sfx('earth');
      await ev.shake(20, 2);
      await vanish(ev, 'boss_pyramid_done', 'flash');
      await ev.say('スフィンクスの姿は\nさらさらと砂に変わり、\n消えていった……。');
    },
  };
  E.pyramid_crest = {
    meta: { needs: ['flag:boss_pyramid_done'], gives: ['item:crest_earth', 'flag:got_crest_earth'] },
    run: (ev) => takeCrest(ev, {
      boss: 'boss_pyramid_done', got: 'got_crest_earth', item: 'crest_earth',
      fallback: ev.has('crest_water') ? 'obj_frost' : 'obj_water',
      look: '王の棺のかたわらで、\n琥珀色の紋章が\n重々しく光っている……。',
      after: '大地の紋章を手にすると、\n足元から力強いぬくもりが\n伝わってきた……。',
    }),
  };
})(window.RPG);
