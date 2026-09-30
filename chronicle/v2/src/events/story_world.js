// CONTENT-P: ティアで変わる世界（STORY_BIBLE §3.1・§3.5・§4.3 の「世界の反応」・§5.1・§8.10・§10.5）。どの町も同じ表から拾う（maps/story_links.js が置く）
//   story_rumor         町のうわさ好き（ティア 2 から）: §10.5 のうわさを灯の数で。灯油の値（R.Story.oil）。
//                       ティア 5 から院長の娘「ミラ」の名（初めて。l_rumor_mira・旗 story_mira_heard。聞きそびれていれば後のティアでも先に言う）。
//                       ティア 6 から灯札が紙くずになりかける（lo_hifuda）
//   story_scribe        白衣の書記（T4 の布告の後。どの町にも）: お触れ → 布告の写し（lo_decree）と記録官への私信の写し（lo_decree_memo）
//   story_decree_board  記録院の出張所の布告（ファロス・ロッホ・ユール・オルビス。T4 の後）
//   story_rowell_roa    T7 の後、ロアに身を寄せたロウェル（ベルナは客として泊めている）
//   pharos_yena         静夜会の説き手イェナの弧（§8.10。T3〜5 揺れる・T6〜7 本当の名を聞く）。ファロスの桟橋の人の話を包む
//   子ども（ティア 6 から）が「暁」を口にする台詞は maps/story_links.js の行（talk の lines）
(function (R) {
  'use strict';
  const S = () => R.Story;
  const tier = () => (R.Game && R.Game.tier) || 0;

  // ---------------------------------------------------------------- うわさ（§10.5）
  const RUMOR = {
    2: () => R.T('ev.story_world.RUMOR.2'),
    3: () => R.T('ev.story_world.RUMOR.3', { oilWord: S().oilWord() }),
    4: () => R.T('ev.story_world.RUMOR.4'),
    5: () => R.T('ev.story_world.RUMOR.5'),
    6: () => R.T('ev.story_world.RUMOR.6', { oilWord: S().oilWord() }),
    7: () => R.T('ev.story_world.RUMOR.7'),
    8: () => R.T('ev.story_world.RUMOR.8'),
  };
  const MIRA = 5;
  R.def('events', 'story_rumor', {
    meta: { needs: [], gives: ['flag:story_mira_heard', 'lead:l_rumor_mira', 'lore:lo_hifuda'] },
    run: async (ev, ctx) => {
      const who = (ctx && ctx.npc) || null;
      const t = Math.min(8, tier());
      if (t < 2) { await ev.say(who, R.T('events.story_rumor.run.say')); return; }
      // ミラの名（ティア 5。聞きそびれていれば、先に）
      if (t >= MIRA && !ev.flag('story_mira_heard')) {
        await ev.say(who, RUMOR[MIRA]());
        ev.setFlag('story_mira_heard');
        ev.lead('l_rumor_mira');
        if (t === MIRA) return;
      }
      await ev.say(who, RUMOR[t]());
      if (t >= 6 && !ev.flag('lo_hifuda')) {
        await S().narr(ev, R.T('events.story_rumor.run.narr'));
        ev.lore('lo_hifuda');
      }
    },
  });
  R.Story && (R.Story.RUMOR = RUMOR);

  // ---------------------------------------------------------------- 白衣の書記（T4 から。§6.7・§5.1）
  async function decree(ev) {
    if (!ev.flag('lo_decree')) { await S().narr(ev, R.T('ev.story_world.decree.narr')); ev.lore('lo_decree'); }
    if (!ev.flag('lo_decree_memo')) { await S().narr(ev, R.T('ev.story_world.decree.narr_2')); ev.lore('lo_decree_memo'); }
  }
  R.def('events', 'story_scribe', {
    meta: { needs: ['flag:story_t4'], gives: ['lore:lo_decree', 'lore:lo_decree_memo'] },
    run: async (ev, ctx) => {
      const who = (ctx && ctx.npc) || null;
      if (ev.flag('story_t7')) await ev.say(who, R.T('events.story_scribe.run.say'));
      else await ev.say(who, R.T('events.story_scribe.run.say_2'));
      await decree(ev);
    },
  });
  R.def('events', 'story_decree_board', {
    meta: { needs: ['flag:story_t4'], gives: ['lore:lo_decree', 'lore:lo_decree_memo'] },
    run: async (ev) => {
      await S().narr(ev, R.T('events.story_decree_board.run.narr'));
      await S().narr(ev, R.T('events.story_decree_board.run.narr_2'));
      await S().narr(ev, R.T('events.story_decree_board.run.narr_3'));
      await S().narr(ev, R.T('events.story_decree_board.run.narr_4'));
      await decree(ev);
    },
  });

  // ---------------------------------------------------------------- 静夜会の説き手イェナ（§8.10 の弧。ファロスの桟橋の先）
  //   T0〜2 は今のまま（穏やかで確信に満ちている）。T3〜5 揺れる、T6〜7 本当の名を聞く、T8 名のない自分に気づきかける
  R.onData(function () {
    const orig = R.DB.events.pharos_yena;
    if (!orig || orig.run._tiers) return;
    const run0 = orig.run;
    orig.run = async (ev, ctx) => {
      const t = tier(), who = (ctx && ctx.npc) || 'yena';
      if (t < 3) return run0(ev, ctx);
      if (t < 6) { await ev.say(who, R.T('ev.story_world.pharos_yena.run.say')); return; }
      if (t < 8) { await ev.say(who, R.T('ev.story_world.pharos_yena.run.say_2')); return; }
      await ev.say(who, R.T('ev.story_world.pharos_yena.run.say_3'));
    };
    orig.run._tiers = true;
  });

  // ---------------------------------------------------------------- ロアのロウェル（T7 の後。§6.3）
  R.def('events', 'story_rowell_roa', {
    meta: { needs: ['flag:story_t7'], gives: [] },
    run: async (ev, ctx) => {
      const who = (ctx && ctx.npc) || 'story_rowell_roa';
      const o = { face: 'rowell:neutral' };
      if (ev.flag('lo_berna_confession')) {
        await ev.say(who, R.T('events.story_rowell_roa.run.say'), o);
        await ev.say(who, R.T('events.story_rowell_roa.run.say_2'), o);
      } else {
        await ev.say(who, R.T('events.story_rowell_roa.run.say'), o);
      }
    },
  });
})(window.RPG);
