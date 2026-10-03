// CONTENT-P: ロアの寄り道（STORY_BIBLE §6.1 の T3・T6・§6.3・§10.4）。ベルナの家の書見台のベルナ（roa_berna）が呼ぶ。
//   story_roa_tales  T3〜T5（旗 story_t3、まだ story_t6 でない）: ベルナが旅の話をせがむ。年代記の章の数だけ短い話（章の題の字幕）→
//                    朝の席の布を二度かけ直す（物忘れ）→ 泊まっていくか（story_roa_t3、手がかり l_main_roa_t3 の済み）
//   story_roa_t6     T6 以降（終盤のロアの前）: ベルナは主人公を忘れている（「旅の方？」）。客として旅の話をする →
//                    「いいお話だね。……その語り部さん、きっといい子だね」→ 名簿の名を指でなぞる →
//                    ベルナの封書（k_berna_sealed）をここで開ける（lo_berna_confession。§10.4 の 4 枚）→ 客として泊める（story_roa_t6）
//   roaArrive        ロアに着いたとき（roa_enter）: 封書を持っていれば、T6 の後は思い出す（ベルナの家へ）、T5〜T6 の間は門で開ける
//   T7 の後、ロウェルはロアに身を寄せている（maps/story_links.js の roa の人 story_rowell_roa）。
(function (R) {
  'use strict';
  const S = () => R.Story;
  const P = () => R.ContentP.ev;
  const F = () => R.Final && R.Final.ev;

  /** 年代記の章の題を順に字幕で（主人公はしゃべらない。地の文で語る） */
  async function tales(ev) {
    const list = (F() && F().chapters) ? F().chapters() : [];
    for (const c of list) {
      ev.sfx('page');
      await ev.caption('『' + c.title + '』', { ms: 1500 });
    }
    return list.length;
  }
  R.Story && (R.Story.tales = tales);

  R.def('events', 'story_roa_tales', {
    meta: { needs: ['flag:story_t3'], gives: ['flag:story_roa_t3'] },
    run: async (ev, ctx) => {
      const St = S(), E = P();
      const who = (ctx && ctx.npc) || 'berna';
      if (!ev.flag('story_roa_t3')) {
        await ev.say(who, R.T('events.story_roa_tales.run.say'), { face: 'berna:smile' });
        await St.narr(ev, R.T('events.story_roa_tales.run.narr'));
        await tales(ev);
        await ev.say(who, R.T('events.story_roa_tales.run.say_2'), { face: 'berna:neutral' });
        await St.narr(ev, R.T('events.story_roa_tales.run.narr_2'));
        await St.narr(ev, R.T('events.story_roa_tales.run.narr_3'));
        await ev.say(who, R.T('events.story_roa_tales.run.say_3'), { face: 'berna:sad' });
        ev.setFlag('story_roa_t3');
        ev.leadDone('l_main_roa_t3');
      } else {
        await ev.say(who, R.T('events.story_roa_tales.run.say_4'), { face: 'berna:smile' });
      }
      await E.stay(ev, { who, ask: R.T('events.story_roa_tales.run.ask'), bye: R.T('events.story_roa_tales.run.bye'), morning: R.T('events.story_roa_tales.run.morning') });
    },
  });

  /** ベルナの封書を開ける（T5 の二通目の中の封書。ここか、終盤のロアで） */
  async function openSealed(ev) {
    const St = S(), x = F();
    if (ev.flag('lo_berna_confession') || !ev.has('k_berna_sealed')) return false;
    await St.narr(ev, R.T('ev.story_roa.openSealed.narr'));
    ev.sfx('page');
    for (const id of (x && x.CONFESSION) || []) await ev.letter(id);
    ev.take('k_berna_sealed', 1);
    if (x && x.lore) x.lore(ev, 'lo_berna_confession'); else ev.lore('lo_berna_confession');
    return true;
  }
  R.Story && (R.Story.openSealed = openSealed);

  /**
   * ロアに着いたとき（roa_enter が呼ぶ。オーナー 2026-10-03: 「ロアに帰ったら開けて」の封書を持って帰っても何も起きなかった）。
   *   封書を持っていて、まだ読んでいない・終盤のロア（T8 の後。final_story.js が開ける）の前なら:
   *   T6 の後 → 着いた所で封書を思い出す（開けるのはベルナの家の T6 の場面。story_roa_t6）
   *   T5〜T6 の間 → 門をくぐった所で開ける（ベルナはまだ主人公を覚えている）
   *   屋内（ベルナの家など）から出てきたときは何もしない。旗を見るだけなので、封書を持ったままの古い記録でも同じ
   */
  let lastFrom = null;
  R.onData && R.onData(function () { R.on('map:enter', (e) => { lastFrom = (e && e.from) || null; }); });
  async function roaArrive(ev, ctx) {
    if (ev.flag('story_t8') || ev.flag('final_roa') || ev.flag('lo_berna_confession') || !ev.has('k_berna_sealed')) return false;
    const from = (ctx && ctx.from !== undefined) ? ctx.from : lastFrom;
    const fm = from && R.DB.maps[from];
    if (fm && fm.kind === 'interior') return false;
    const St = S();
    ev.sfx('page');
    if (ev.flag('story_t6')) {
      await St.narr(ev, R.T('ev.story_roa.roaArrive.narr'));
      return false;
    }
    await St.narr(ev, R.T('ev.story_roa.roaArrive.narr_2'));
    return openSealed(ev);
  }
  R.Story && (R.Story.roaArrive = roaArrive);

  R.def('events', 'story_roa_t6', {
    meta: { needs: ['flag:story_t6'], gives: ['flag:story_roa_t6', 'lore:lo_berna_confession'] },
    run: async (ev, ctx) => {
      const St = S(), E = P();
      const who = (ctx && ctx.npc) || 'berna';
      if (!ev.flag('story_roa_t6')) {
        ev.bgm('sorrow');
        await ev.say(who, R.T('events.story_roa_t6.run.say'), { face: 'berna:smile' });
        await St.narr(ev, R.T('events.story_roa_t6.run.narr'));
        await St.narr(ev, R.T('events.story_roa_t6.run.narr_2'));
        await tales(ev);
        await ev.say(who, R.T('events.story_roa_t6.run.say_2'), { face: 'berna:smile' });
        await St.narr(ev, R.T('events.story_roa_t6.run.narr_3'));
        await ev.say(who, R.T('events.story_roa_t6.run.say_3'), { face: 'berna:sad' });
        await St.narr(ev, R.T('events.story_roa_t6.run.narr_4'));
        // 門で先に開けていたら（T5〜T6 の間にロアへ寄った）、ここでは読まない
        if (await openSealed(ev)) await St.narr(ev, R.T('events.story_roa_t6.run.narr_5'));
        ev.setFlag('story_roa_t6');
        ev.leadDone('l_main_roa_t6');
        ev.mapBgm();
        await E.stay(ev, { who, ask: R.T('events.story_roa_t6.run.ask'), bye: R.T('events.story_roa_t6.run.bye'), morning: R.T('events.story_roa_t6.run.morning') });
        return;
      }
      await ev.say(who, R.T('events.story_roa_t6.run.say_4'), { face: 'berna:smile' });
      await E.stay(ev, { who, ask: R.T('events.story_roa_t6.run.ask_2'), bye: R.T('events.story_roa_t6.run.bye'), morning: R.T('events.story_roa_t6.run.morning') });
    },
  });
})(window.RPG);
