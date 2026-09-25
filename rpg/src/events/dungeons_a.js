// ダンジョン 前半のイベント (DESIGN §7.3, §7.4): かぜのどうくつ・とうぞくのとりで・
// みずのどうくつ・ピラミッド のボス戦、もんしょうの だいざ、ボスのあとに ひらく
// でぐちの まほうじん。マップは src/maps/dungeons_a.js。
//
// Flags set here:  boss_wind_done got_crest_wind  boss_fort_done bandits_defeated
//                  boss_water_done got_crest_water  boss_pyramid_done got_crest_earth
// Items given:     crest_wind  silver_key  crest_water  crest_earth
(function (R) {
  'use strict';
  const E = R.DB.events;
  const CRESTS = ['crest_wind', 'crest_water', 'crest_earth', 'crest_fire', 'crest_star'];
  const KAZU = ['ゼロ', 'ひとつ', 'ふたつ', 'みっつ', 'よっつ', 'いつつ'];

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
    await ev.say(n >= CRESTS.length ? 'ついに いつつの もんしょうが\nすべて そろった！' : 'これで もんしょうは ' + KAZU[n] + '。\nのこる もんしょうは あと ' + KAZU[CRESTS.length - n] + 'だ。');
    nextObjective(ev, o.fallback);
    await ev.say('……ふと みると ゆかの まほうじんが\nあわく ひかっている。\nあれに のれば そとへ でられそうだ。');
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
      if (!(await ev.yesno('まほうじんが しずかに ひかっている。\nそとへ でますか？'))) return false;
      ev.sfx('teleport');
      await ev.warp(esc.to, esc.spawn, { dir: 'down' });
      return true;
    },
  };

  // ============================================================ かぜのどうくつ
  E.wind_boss = {
    meta: { needs: [], gives: ['flag:boss_wind_done'] },
    async run(ev) {
      if (ev.flag('boss_wind_done')) return;
      faceNpc(ev, 'wind_chief');
      ev.sfx('roar');
      await ev.say('ゴブリンおやぶん「グヘヘヘ……\nこんな おくまで のこのこ くるとは\nなまいきな にんげんどもめ！」');
      await ev.say('「おくの ひかる いしは\nおれさまの たからものだ！\fほしけりゃ ちからずくで うばってみな！\nやろうども かかれーっ！」');
      if ((await ev.battle('boss_wind')) !== 'win') return false;
      await ev.say('ゴブリンおやぶん「ひ ひいいっ！\nおぼえてろー！」');
      await vanish(ev, 'boss_wind_done', 'fade');
      await ev.say('ゴブリンたちは どうくつの おくへ\nにげていった……。');
      await ev.say('おくの へやから\nふしぎな かぜが ふいてくる……。');
    },
  };
  E.wind_crest = {
    meta: { needs: ['flag:boss_wind_done'], gives: ['item:crest_wind', 'flag:got_crest_wind'] },
    run: (ev) => takeCrest(ev, {
      boss: 'boss_wind_done', got: 'got_crest_wind', item: 'crest_wind', fallback: 'obj_gate',
      look: 'だいざの うえで\nみどりいろの もんしょうが\nしずかに ひかっている……。',
      after: 'かぜの もんしょうから あふれた かぜが\n3にんを やさしく つつみこんだ……。',
    }),
  };

  // ============================================================ とうぞくのとりで
  E.fort_boss = {
    meta: { needs: [], gives: ['flag:boss_fort_done', 'flag:bandits_defeated', 'item:silver_key'] },
    async run(ev) {
      if (ev.flag('boss_fort_done')) return;
      faceNpc(ev, 'fort_chief');
      await ev.say('とうぞくがしら「なんだ なんだ おまえら！\nここを どこだと おもってやがる！」');
      await ev.say('「……ほう ポルタの れんちゅうに\nたのまれて きたってわけか。\fふん！ みなとも ふねも\nみーんな おれさまの もんだ！\fかえりたきゃ ここで\nくたばって いきな！」');
      if ((await ev.battle('boss_fort')) !== 'win') return false;
      faceNpc(ev, 'fort_chief');
      await ev.say('とうぞくがしら「ま まいった！\nおれたちの まけだ！\fみなとからは てを ひく！\nこいつを やるから かんべんしてくれ！」');
      await ev.give('silver_key');
      await ev.say('とうぞくがしら「その かぎで\nおれさまの たからぐらも あくぜ……。\fちくしょう！ ずらかるぞ\nやろうども！」');
      ev.setFlag('bandits_defeated');
      await vanish(ev, 'boss_fort_done', 'fade');
      await ev.say('とうぞくたちは とりでから\nいちもくさんに にげだしていった。');
      nextObjective(ev, 'obj_ship');
      await ev.say('これで ポルタの みなとにも\nふねが もどるはずだ。\nせんちょうに しらせよう。');
    },
  };

  // ============================================================ みずのどうくつ
  E.water_boss = {
    meta: { needs: [], gives: ['flag:boss_water_done'] },
    async run(ev) {
      if (ev.flag('boss_water_done')) return;
      faceNpc(ev, 'water_serpent');
      await ev.shake(24, 2);
      await ev.say('みずうみの みなもが\nおおきく うねった……！');
      ev.sfx('roar');
      await ev.say('だいかいじゃ「……シュルルル……\nニンゲン か……。\fこの みずうみの あるじは わたし。\nあおく ひかる しるしも わたしの もの。\fみなそこへ しずめて くれよう！」');
      if ((await ev.battle('boss_water')) !== 'win') return false;
      await ev.say('だいかいじゃ「グ……グオオオ……！」');
      ev.sfx('water');
      await ev.shake(30, 3);
      await vanish(ev, 'boss_water_done', 'flash');
      await ev.say('だいかいじゃは みずうみの そこへ\nしずんでいった……。\fみなもは しずけさを とりもどした。');
    },
  };
  E.water_crest = {
    meta: { needs: ['flag:boss_water_done'], gives: ['item:crest_water', 'flag:got_crest_water'] },
    run: (ev) => takeCrest(ev, {
      boss: 'boss_water_done', got: 'got_crest_water', item: 'crest_water',
      fallback: ev.has('crest_earth') ? 'obj_frost' : 'obj_earth',
      look: 'だいざの うえで\nあおい もんしょうが\nみずの ように ゆらめいている……。',
      after: 'みずの もんしょうから すんだ ひかりが\nあふれだし 3にんを つつみこんだ……。',
    }),
  };

  // ============================================================ ピラミッド
  E.pyramid_boss = {
    meta: { needs: [], gives: ['flag:boss_pyramid_done'] },
    async run(ev) {
      if (ev.flag('boss_pyramid_done')) return;
      faceNpc(ev, 'pyramid_sphinx');
      await ev.say('スフィンクス「とまれ ひとの こよ。\nわが なは スフィンクス。\nいにしえの おうの ねむりを\nまもる もの。」');
      await ev.say('「だいちの しるしを もとめる ものよ……\nなんじらに とおう。\fちから なき ものに\nしるしを もつ しかく なし。\fその ちからを\nわれに しめしてみよ！」');
      if ((await ev.battle('boss_pyramid')) !== 'win') return false;
      await ev.say('スフィンクス「……みごとだ。\nなんじらこそ もんしょうに\nえらばれし ものたち……。\fおうの ねむる へやへ\nすすむが よい……。」');
      ev.sfx('earth');
      await ev.shake(20, 2);
      await vanish(ev, 'boss_pyramid_done', 'flash');
      await ev.say('スフィンクスの すがたは\nさらさらと すなに かわり\nきえていった……。');
    },
  };
  E.pyramid_crest = {
    meta: { needs: ['flag:boss_pyramid_done'], gives: ['item:crest_earth', 'flag:got_crest_earth'] },
    run: (ev) => takeCrest(ev, {
      boss: 'boss_pyramid_done', got: 'got_crest_earth', item: 'crest_earth',
      fallback: ev.has('crest_water') ? 'obj_frost' : 'obj_water',
      look: 'おうの ひつぎの かたわらで\nこはくいろの もんしょうが\nおもおもしく ひかっている……。',
      after: 'だいちの もんしょうを てにすると\nあしもとから ちからづよい\nぬくもりが つたわってきた……。',
    }),
  };
})(window.RPG);
