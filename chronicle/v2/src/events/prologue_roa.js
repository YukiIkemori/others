// CONTENT-P: 序章 P1・P2 とロアの里の人々（V2_PLAN §3.3、STORY_BIBLE §9.1 P1・P2、§3.4・§3.5・§10.2 の 1〜3）
//   roa_house_intro  P1（DB.config.start.event）: 暗転のキャプション 3 枚（1 枚目の後に守り歌。v_fine_opening_01〜03・v_fine_song_01）→ 幕のまま「おはよう」（v_berna_prologue_01〜03）
//                    → ev.createHero() → 幕が上がり、消灯の刻の窓明かりの部屋に主人公（v_berna_intro_01・v_berna_prologue_04）
//   roa_berna        P2: 白紙・灯台の火（細りはじめて三晩、きのう消えた）・潮風亭で仲間を → 傷薬 3 と 50 G。序章の後は近況とただの宿
//   roa_lectern      書見台: 語り部の名簿（lo_roa_register）と「手がかり帳の使い方」の短い本
//   roa_seat         朝の席（lo_roa_seat）   roa_shelf  本棚   roa_stone  語り石（lo_roa_stone）   roa_hall  語り石の間
//   roa_gate / roa_gatewoman / roa_children / roa_elder / roa_farmer / roa_weaver / roa_youth   里の人
//   roa_enter        ロアの onEnter（今は何もしない。T3・T6 のロアの寄り道と終盤のロアの口）
// 主人公は物語の中ではしゃべらない（STORY_BIBLE 冒頭）。仲間は物語に出ない（A36）。
(function (R) {
  'use strict';
  const D = R.DB.events;
  const X = () => R.ContentP.ev;

  // ------------------------------------------------------------ P1 目覚め（消灯の刻の窓明かり）
  // 冒頭のボイス（幕の上のフィーネ 4 本 → ベルナ 5 本）。幕の前に先読みする
  const INTRO_VOICES = ['v_fine_opening_01', 'v_fine_song_01', 'v_fine_opening_02', 'v_fine_opening_03',
    'v_berna_prologue_01', 'v_berna_prologue_02', 'v_berna_prologue_03', 'v_berna_intro_01', 'v_berna_prologue_04'];
  const BREATH = 1000;   // 冒頭の場面の切れ目の間（ms）
  D.roa_house_intro = {
    meta: { needs: [], gives: ['flag:prologue_start', 'hero'] },
    run: async (ev) => {
      const E = X();
      if (ev.flag('prologue_start')) return;
      // 暗い幕（キャプションは幕の上。R.Engine.fade はキャプションより上に描かれるので使わない。TODO(UIK): caption の {dark:true}）
      const curtain = { id: 'cp_curtain', opaque: false, a: 1, enter() {}, exit() {}, update() {}, draw(g) { g.globalAlpha = this.a; g.fillStyle = '#070812'; g.fillRect(0, 0, R.W, R.H); g.globalAlpha = 1; } };
      R.Engine.push(curtain);
      try {
        // 冒頭のボイスを先読み（まとめた版は初めの声で束を読む。読み終わりか 2.5 秒の早い方まで、幕のまま待つ）
        try { if (R.Audio && R.Audio.preloadVoice) await Promise.race([R.Audio.preloadVoice(INTRO_VOICES), R.wait(2500)]); } catch (e) { /* 声が無くても進む */ }
        await ev.caption(R.T('ev.prologue_roa.roa_house_intro.run.caption'), { ms: 2600, voice: 'v_fine_opening_01' });
        await ev.wait(BREATH);   // 場面が変わるたびにひと呼吸（持ち主 2026-09-27）
        // 灯台の守り歌（オーナー 2026-09-27「メインだから声を」）: 幕の上でフィーネが子守歌のように。声の終わりまで待つ
        await ev.caption(R.T('ev.prologue_roa.roa_house_intro.run.caption_2'), { ms: 4200, voice: 'v_fine_song_01' });
        await ev.wait(BREATH);   // 場面が変わるたびにひと呼吸（持ち主 2026-09-27）
        await ev.caption(R.T('ev.prologue_roa.roa_house_intro.run.caption_3'), { ms: 2600, voice: 'v_fine_opening_02' });
        await ev.wait(BREATH);   // 場面が変わるたびにひと呼吸（持ち主 2026-09-27）
        await ev.caption(R.T('ev.prologue_roa.roa_house_intro.run.caption_4'), { ms: 3400, voice: 'v_fine_opening_03' });
        await ev.wait(BREATH);
        // 主人公ができるまでは幕のまま（持ち主 2026-09-28「主人公のいないマップを見せない」）: 目を覚ます前の声として、
        // 地の文とベルナの「おはよう」を幕の上で聞き、主人公を作ってから幕を上げる（寝台に主人公がいる部屋が明ける）
        await E.narr(ev, R.T('ev.prologue_roa.roa_house_intro.run.narr'));
        await ev.say('berna', R.T('ev.prologue_roa.roa_house_intro.run.say'), { voice: 'v_berna_prologue_01', face: 'berna:smile' });
        await ev.say('berna', R.T('ev.prologue_roa.roa_house_intro.run.say_2'), { voice: 'v_berna_prologue_02', face: 'berna:neutral' });
        await ev.say('berna', R.T('ev.prologue_roa.roa_house_intro.run.say_3'), { voice: 'v_berna_prologue_03', face: 'berna:smile' });
        let h = null;
        for (let i = 0; i < 5 && !h; i++) h = await ev.createHero();
        if (!h && !(R.Game.chars && R.Game.chars.hero)) R.State.setHero({ type: 'warrior', sex: 'm', name: R.T('ev.prologue_roa.roa_house_intro.run.name'), fav: 'sword' });
        // 幕の中で主人公の絵を焼いておく（焼く列に任せると、幕が上がってから主人公が遅れて出る）
        try {
          const F = R.Field;
          if (F && F._awaitPeopleArt) await F._awaitPeopleArt(1500);
          if (F && F._warmPeople) F._warmPeople(400);
        } catch (e) { /* 焼けなければ焼く列のまま */ }
        await ev.wait(BREATH / 2);
        const t0 = R.Engine.time;
        if (R.Engine.running) await R.until(() => { curtain.a = Math.max(0, 1 - (R.Engine.time - t0) / 1200); return curtain.a <= 0; });
      } finally { R.Engine.remove(curtain); }
      await ev.wait(BREATH / 2);
      await E.say(ev, 'berna', R.T('ev.prologue_roa.roa_house_intro.run.say_4'), { voice: 'v_berna_intro_01', face: 'berna:smile' });   // 声は名前を読まない（「……うん、いい名前だ。」）
      await ev.say('berna', R.T('ev.prologue_roa.roa_house_intro.run.say_5'), { voice: 'v_berna_prologue_04', face: 'berna:neutral' });
      await ev.npc('berna').move([[12, 5]]);
      await ev.npc('berna').face('s');
      ev.setFlag('prologue_start');
    },
  };

  // ------------------------------------------------------------ P2 師匠ベルナ
  const P2 = R.T('ev.prologue_roa.P2');
  // P2 のボイス（design/voice_story_map.json。{hero} の入る P2[7] は名前を読まない v_berna_p2_10）
  const P2_VOICE = ['v_berna_p2_01', 'v_berna_p2_02', 'v_berna_p2_03', 'v_berna_p2_04', 'v_berna_p2_05', 'v_berna_p2_06', 'v_berna_p2_07', 'v_berna_p2_10', 'v_berna_p2_08', 'v_berna_p2_09'];   // p2_10 は名前を読まない（「行っておくれ。……」）
  D.roa_berna = {
    meta: { needs: ['flag:prologue_start'], gives: ['flag:prologue_berna', 'item:i_salve', 'gold'] },
    run: async (ev, ctx) => {
      const E = X();
      const who = (ctx && ctx.npc) || 'berna';
      if (!ev.flag('prologue_start')) { await E.say(ev, 'berna', R.T('ev.prologue_roa.roa_berna.run.say'), { face: 'berna:smile' }); return; }
      if (!ev.flag('prologue_berna')) {
        for (let i = 0; i < P2.length; i++) {
          const t = P2[i];
          await E.say(ev, who, t, { voice: P2_VOICE[i] || undefined, face: /大事|白紙|消えた/.test(t) ? 'berna:sad' : 'berna:neutral' });
        }
        await E.give(ev, 'i_salve', 3, { quiet: true });
        E.gold(ev, 50, { quiet: true });
        await E.narr(ev, R.T('ev.prologue_roa.roa_berna.run.narr'));
        await E.say(ev, who, R.T('ev.prologue_roa.roa_berna.run.say_2'), { face: 'berna:smile' });
        ev.setFlag('prologue_berna');
        return;
      }
      // 序章の後: 近況と、ただの宿（STORY_BIBLE §6.3。T3 以降の物忘れは TODO: T3・T6 のロアの寄り道で）
      if (ev.flag('prologue_done')) {
        const pk = E.pickEntry([
          { cond: 'cleared_r_forest', text: R.T('ev.prologue_roa.roa_berna.run.pk.0.text') },
          { text: R.T('ev.prologue_roa.roa_berna.run.pk.1.text') },
        ]);
        await E.say(ev, who, pk.text, { voice: pk.voice, face: 'berna:smile' });
        await E.stay(ev, { who, ask: R.T('ev.prologue_roa.roa_berna.run.ask'), bye: R.T('ev.prologue_roa.roa_berna.run.bye'), morning: R.T('ev.prologue_roa.roa_berna.run.morning') });
        return;
      }
      // 序章の途中
      const line = E.pick([
        { cond: 'prologue_key', text: R.T('ev.prologue_roa.roa_berna.run.pick.0.text') },
        { cond: 'prologue_party', text: R.T('ev.prologue_roa.roa_berna.run.pick.1.text') },
        { text: R.T('ev.prologue_roa.roa_berna.run.pick.2.text') },
      ]);
      await E.say(ev, who, line, { face: 'berna:smile' });
    },
  };

  // ------------------------------------------------------------ 書見台（名簿と、手がかり帳の短い本）
  D.roa_lectern = {
    meta: { needs: [], gives: ['lore:lo_roa_register'] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, R.T('ev.prologue_roa.roa_lectern.run.narr'));
      await E.narr(ev, R.T('ev.prologue_roa.roa_lectern.run.narr_2'));
      await E.narr(ev, R.T('ev.prologue_roa.roa_lectern.run.narr_3'));
      if (R.Game.chars && R.Game.chars.hero) await E.narr(ev, R.T('ev.prologue_roa.roa_lectern.run.narr_4'));
      E.lore(ev, 'lo_roa_register');
      const i = await ev.choose(R.T('ev.prologue_roa.roa_lectern.run.i.choose'), { cancel: 1, text: R.T('ev.prologue_roa.roa_lectern.run.i.choose.text') });
      if (i !== 0) return;
      await E.narr(ev, R.T('ev.prologue_roa.roa_lectern.run.narr_5'));
      await E.narr(ev, R.T('ev.prologue_roa.roa_lectern.run.narr_6'));
      await E.narr(ev, R.T('ev.prologue_roa.roa_lectern.run.narr_7'));
    },
  };

  // ------------------------------------------------------------ 朝の席（夜明け待ち、STORY_BIBLE §3.4）
  D.roa_seat = {
    meta: { needs: [], gives: ['lore:lo_roa_seat'] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, R.T('ev.prologue_roa.roa_seat.run.narr'));
      const berna = (R.DB.maps.roa_house.npcs || []).find((n) => n.id === 'berna_desk');
      if (berna && R.State.check(berna.cond)) await E.say(ev, 'berna_desk', R.T('ev.prologue_roa.roa_seat.run.say'), { voice: 'v_berna_seat_01', face: 'berna:neutral' });
      E.lore(ev, 'lo_roa_seat');
    },
  };
  D.roa_shelf = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, E.pick([
        { cond: 'cleared_r_forest', text: R.T('ev.prologue_roa.roa_shelf.run.pick.0.text') },
        { text: R.T('ev.prologue_roa.roa_shelf.run.pick.1.text') },
      ]));
    },
  };

  // ------------------------------------------------------------ 語り石（STORY_BIBLE §2.3。前半が白い）
  D.roa_stone = {
    meta: { needs: [], gives: ['lore:lo_roa_stone'] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, R.T('ev.prologue_roa.roa_stone.run.narr'));
      await E.narr(ev, R.T('ev.prologue_roa.roa_stone.run.narr_2'));
      await E.narr(ev, R.T('ev.prologue_roa.roa_stone.run.narr_3'));
      E.lore(ev, 'lo_roa_stone');
    },
  };
  D.roa_hall = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, R.T('ev.prologue_roa.roa_hall.run.narr'));
      await E.narr(ev, E.pick([
        { cond: 'cleared_r_forest', text: R.T('ev.prologue_roa.roa_hall.run.pick.0.text') },
        { text: R.T('ev.prologue_roa.roa_hall.run.pick.1.text') },
      ]));
      // TODO(リード・MENUS): 語り直しの場面の再生（WORLD_REDESIGN §5.2 の語り石の間）。縦切りでは語り板の文だけ。
    },
  };

  // ------------------------------------------------------------ 里の人
  D.roa_gate = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      if (ev.flag('prologue_berna')) return;
      await E.say(ev, 'gatewoman', R.T('ev.prologue_roa.roa_gate.run.say'));
    },
  };
  D.roa_gatewoman = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.say(ev, 'gatewoman2', E.pick([
        { cond: 'cleared_r_forest', text: R.T('ev.prologue_roa.roa_gatewoman.run.pick.0.text') },
        { cond: 'prologue_done', text: R.T('ev.prologue_roa.roa_gatewoman.run.pick.1.text') },
        { text: R.T('ev.prologue_roa.roa_gatewoman.run.pick.2.text') },
      ]));
    },
  };
  D.roa_children = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      if (ev.flag('prologue_done')) {
        await E.say(ev, 'child_a', R.T('ev.prologue_roa.roa_children.run.say'));
        await E.say(ev, 'child_b', R.T('ev.prologue_roa.roa_children.run.say_2'));
        return;
      }
      await E.say(ev, 'child_a', R.T('ev.prologue_roa.roa_children.run.say_3'));
      await E.say(ev, 'elder', R.T('ev.prologue_roa.roa_children.run.say_4'));
      await E.say(ev, 'child_b', R.T('ev.prologue_roa.roa_children.run.say_5'));
    },
  };
  D.roa_elder = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.say(ev, 'elder', E.pick([
        { cond: 'prologue_done', text: E.AGE.old },
        { text: R.T('ev.prologue_roa.roa_elder.run.pick.1.text') },
      ]));
    },
  };
  D.roa_farmer = {
    meta: { needs: [], gives: ['item:i_salve'] },
    run: async (ev) => {
      const E = X();
      if (!ev.flag('prologue_farmer')) {
        await E.say(ev, 'farmer', R.T('ev.prologue_roa.roa_farmer.run.say'));
        await E.give(ev, 'i_salve', 1);
        ev.setFlag('prologue_farmer');
        return;
      }
      await E.say(ev, 'farmer', E.pick([
        { cond: 'cleared_r_forest', text: R.T('ev.prologue_roa.roa_farmer.run.pick.0.text') },
        { text: R.T('ev.prologue_roa.roa_farmer.run.pick.1.text') },
      ]));
    },
  };
  D.roa_weaver = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.say(ev, 'weaver', E.pick([
        { cond: 'prologue_done', text: R.T('ev.prologue_roa.roa_weaver.run.pick.0.text') },
        { text: R.T('ev.prologue_roa.roa_weaver.run.pick.1.text') },
      ]));
    },
  };
  D.roa_youth = {
    meta: { needs: [], gives: ['lead:l_opt_well'] },
    run: async (ev) => {
      const E = X();
      await E.say(ev, 'youth', R.T('ev.prologue_roa.roa_youth.run.say'));
      if (ev.flag('prologue_done')) ev.lead('l_opt_well');
    },
  };

  // ------------------------------------------------------------ ロアの onEnter
  D.roa_enter = {
    meta: { needs: [], gives: [], calls: ['story_final_roa'] },
    run: async (ev) => {
      // TODO(CONTENT-P・STORY_BIBLE §6.3・§12.2): T3 以降のロアの寄り道（ベルナが旅の話をせがむ）、T6 のロア（封書・客として迎える）。縦切り（ティア 0〜1）では何もしない。
      // 終盤のロア（T8 の後、1 回。events/final_story.js）
      if (ev.flag('story_t8') && !ev.flag('final_roa') && R.DB.events.story_final_roa) await ev.call('story_final_roa');
    },
  };
})(window.RPG);
