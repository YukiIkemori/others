// CONTENT-F: フェルンの小さな依頼（V2_PLAN §3.4、WORLD_REDESIGN §4.1・§5.1）。どれも本筋に要らない・失っても何も失わない。
//   q_fern_letters   手紙番ニナ → 樹上の家 5 軒（lv 1 の足場の人）→ ニナにお金と木登りの靴
//   q_fern_herbs     薬草園のばあさま → 迷いの森の広場ごとに 1 種（1 階 3・2 階 2）→ 薬の詰め合わせ
//   q_fern_song      リタの弟子と歌あわせ（R.Mini.sequence、3 段）→ 段ごとに品（1 回だけ）
//   q_forest_fireflies 灯籠番 → 光るこけの火種 → 森の街道の消えた道しるべの灯籠 3 つ（ワールド、CONTENT-P が置く。event 'forest_waylamp'）
//   q_forest_acorn   木の実拾いの子 → 迷いの森 1 階 南東の広場の切り株でどんぐり王子（レア魔物）
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const C = (R.ContentF = R.ContentF || {});
  const F = (C.forest = C.forest || {});
  const give = (ev, id, n) => ev.item(id, n == null ? 1 : n);

  // ---------------------------------------------------------------- 手紙配り
  const DECK = {
    deck_1: { name: R.T('ev.forest_quests.DECK.deck_1.name'), thanks: R.T('ev.forest_quests.DECK.deck_1.thanks'), gift: ['i_salve', 2], idle: R.T('ev.forest_quests.DECK.deck_1.idle'), after: R.T('ev.forest_quests.DECK.deck_1.after') },
    deck_2: { name: R.T('ev.forest_quests.DECK.deck_2.name'), thanks: R.T('ev.forest_quests.DECK.deck_2.thanks'), gift: ['gold', 40], idle: R.T('ev.forest_quests.DECK.deck_2.idle'), after: R.T('ev.forest_quests.DECK.deck_2.after') },
    deck_3: { name: R.T('ev.forest_quests.DECK.deck_3.name'), thanks: R.T('ev.forest_quests.DECK.deck_3.thanks'), gift: ['i_waker', 2], idle: R.T('ev.forest_quests.DECK.deck_3.idle'), after: R.T('ev.forest_quests.DECK.deck_3.after') },
    deck_4: { name: R.T('ev.forest_quests.DECK.deck_4.name'), thanks: R.T('ev.forest_quests.DECK.deck_4.thanks'), gift: ['i_antidote', 2], idle: R.T('ev.forest_quests.DECK.deck_4.idle'), after: R.T('ev.forest_quests.DECK.deck_4.after') },
    deck_5: { name: R.T('ev.forest_quests.DECK.deck_5.name'), thanks: R.T('ev.forest_quests.DECK.deck_5.thanks'), gift: ['i_ether', 1], idle: R.T('ev.forest_quests.DECK.deck_5.idle'), after: R.T('ev.forest_quests.DECK.deck_5.after') },
  };
  E('fern_postmaster', async (ev) => {
    const n = ev.var('forest_letters');
    if (ev.flag('forest_letters_done')) { await ev.say('postmaster', R.T('events.fern_postmaster.say')); return; }
    if (ev.flag('forest_letters_got')) {
      if (n >= 5) {
        await ev.say('postmaster', R.T('events.fern_postmaster.say_2'));
        ev.gold(120);
        give(ev, 'ac_climb_shoes', 1);
        ev.setFlag('forest_letters_done');
        ev.leadDone('q_fern_letters');
        return;
      }
      await ev.say('postmaster', R.T('events.fern_postmaster.say_3', { p0: 5 - n }));
      return;
    }
    await ev.say('postmaster', R.T('events.fern_postmaster.say_4'));
    const i = await ev.choose(R.T('events.fern_postmaster.i.choose'), { cancel: 1 });
    if (i !== 0) { await ev.say('postmaster', R.T('events.fern_postmaster.say_5')); return; }
    ev.setFlag('forest_letters_got');
    ev.lead('q_fern_letters');
    await ev.say('postmaster', R.T('events.fern_postmaster.say_6'));
  }, { meta: { needs: [], gives: ['lead:q_fern_letters', 'flag:forest_letters_got', 'flag:forest_letters_done', 'item:ac_climb_shoes'] } });

  E('fern_deck', async (ev, ctx) => {
    const id = ctx && ctx.npc;
    const d = DECK[id];
    if (!d) return;
    const done = 'forest_letter_' + id;
    if (ev.flag('forest_letters_got') && !ev.flag(done) && !ev.flag('forest_letters_done')) {
      await ev.say(null, R.T('events.fern_deck.say'));
      await ev.say(id, d.thanks);
      if (d.gift[0] === 'gold') ev.gold(d.gift[1]); else give(ev, d.gift[0], d.gift[1]);
      ev.setFlag(done);
      const n = ev.addVar('forest_letters', 1);
      if (n >= 5) await ev.caption(R.T('events.fern_deck.caption'), { ms: 1800 });
      return;
    }
    await ev.say(id, ev.flag('cleared_r_forest') ? d.after : d.idle);
  }, { meta: { needs: ['flag:forest_letters_got'], gives: ['var:forest_letters+1'] } });

  // ---------------------------------------------------------------- 薬草五種
  const HERBS = { 1: R.T('ev.forest_quests.HERBS.1'), 2: R.T('ev.forest_quests.HERBS.2'), 3: R.T('ev.forest_quests.HERBS.3'), 4: R.T('ev.forest_quests.HERBS.4'), 5: R.T('ev.forest_quests.HERBS.5') };
  E('fern_herbalist', async (ev) => {
    const n = ev.var('forest_herbs');
    if (ev.flag('forest_herbs_done')) { await ev.say('herbalist', R.T('events.fern_herbalist.say')); return; }
    if (ev.flag('forest_herbs_got')) {
      if (n >= 5) {
        await ev.say('herbalist', R.T('events.fern_herbalist.say_2'));
        give(ev, 'i_potion', 3); give(ev, 'i_antidote', 2); give(ev, 'i_waker', 2); give(ev, 'i_ether', 1);
        ev.setFlag('forest_herbs_done');
        ev.leadDone('q_fern_herbs');
        return;
      }
      await ev.say('herbalist', R.T('events.fern_herbalist.say_3', { p0: 5 - n }));
      return;
    }
    await ev.say('herbalist', R.T('events.fern_herbalist.say_4'));
    ev.setFlag('forest_herbs_got');
    ev.lead('q_fern_herbs');
  }, { meta: { needs: [], gives: ['lead:q_fern_herbs', 'flag:forest_herbs_got', 'flag:forest_herbs_done'] } });

  /** 迷いの森の薬草（examine の物の herb 番号） */
  F.herb = async function (ev, ctx) {
    const map = R.DB.maps[ctx && ctx.map];
    const o = map && (map.objects || []).find((q) => q.type === 'examine' && q.event === 'verda_herb' && q.x === ctx.x && q.y === ctx.y);
    const k = o && o.herb;
    if (!k) return;
    const key = 'forest_herb_' + k;
    if (ev.flag(key)) { await ev.say(null, R.T('ev.forest_quests.herb.say')); return; }
    if (!ev.flag('forest_herbs_got')) { await ev.say(null, R.T('ev.forest_quests.herb.say_2')); return; }
    ev.setFlag(key);
    const n = ev.addVar('forest_herbs', 1);
    ev.sfx('item');
    await ev.caption(R.T('ev.forest_quests.herb.caption', { p0: HERBS[k], n }), { ms: 1800 });
  };

  // ---------------------------------------------------------------- 歌あわせ（リタの弟子。R.Mini.sequence、3 段）
  const STAGES = [
    { rounds: 3, tempo: 0.8, reward: ['i_potion', 2], label: R.T('ev.forest_quests.STAGES.0.label') },
    { rounds: 5, tempo: 1.0, reward: ['ac_ward_sleep', 1], label: R.T('ev.forest_quests.STAGES.1.label') },
    { rounds: 7, tempo: 1.25, reward: ['hd_mushroom_cap', 1], label: R.T('ev.forest_quests.STAGES.2.label') },
  ];
  const RANK_OK = { S: true, A: true, B: true };
  E('fern_song_game', async (ev) => {
    if (!ev.flag('forest_song_met')) {
      await ev.say('rita_pupil', R.T('events.fern_song_game.say'));
      ev.setFlag('forest_song_met');
      ev.lead('q_fern_song');
    }
    const next = STAGES.findIndex((s, i) => !ev.flag('forest_song_' + (i + 1)));
    const labels = STAGES.map((s, i) => s.label + (ev.flag('forest_song_' + (i + 1)) ? R.T('events.fern_song_game.labels') : ''));
    const i = await ev.choose(labels.concat([R.T('events.fern_song_game.i.choose.0')]), { cancel: STAGES.length, text: next < 0 ? R.T('events.fern_song_game.i.choose.text') : R.T('events.fern_song_game.i.choose.text_2') });
    if (i >= STAGES.length) return;
    if (i > 0 && !ev.flag('forest_song_' + i)) { await ev.say('rita_pupil', R.T('events.fern_song_game.say_2')); return; }
    const st = STAGES[i];
    const r = (await ev.mini.sequence({ title: R.T('events.fern_song_game.r.title', { label: st.label }), symbols: R.T('events.fern_song_game.r.symbols'), rounds: st.rounds, tempo: st.tempo, theme: 'forest' })) || {};
    const ok = RANK_OK[r.rank];
    if (!ok) { await ev.say('rita_pupil', R.T('events.fern_song_game.say_3')); return; }
    const key = 'forest_song_' + (i + 1);
    if (!ev.flag(key)) {
      ev.setFlag(key);
      await ev.say('rita_pupil', R.T('events.fern_song_game.say_4', { label: st.label }));
      give(ev, st.reward[0], st.reward[1]);
      if (i === 2) { ev.leadDone('q_fern_song'); await ev.say('rita_pupil', R.T('events.fern_song_game.say_5')); }
    } else await ev.say('rita_pupil', R.T('events.fern_song_game.say_6'));
  }, { meta: { needs: [], gives: ['lead:q_fern_song', 'flag:forest_song_1', 'flag:forest_song_2', 'flag:forest_song_3'] } });

  // ---------------------------------------------------------------- 蛍の灯籠（E21）
  E('fern_lampkeeper', async (ev) => {
    const n = ev.var('forest_fireflies');
    if (ev.flag('forest_fireflies_done')) { await ev.say('lampkeeper', R.T('events.fern_lampkeeper.say')); return; }
    if (ev.flag('forest_embers')) {
      if (n >= 3) {
        await ev.say('lampkeeper', R.T('events.fern_lampkeeper.say_2'));
        ev.gold(200);
        ev.setFlag('forest_fireflies_done');
        ev.leadDone('q_forest_fireflies');
        return;
      }
      await ev.say('lampkeeper', R.T('events.fern_lampkeeper.say_3', { p0: 3 - n }));
      return;
    }
    await ev.say('lampkeeper', R.T('events.fern_lampkeeper.say_4'));
    const i = await ev.choose(R.T('events.fern_lampkeeper.i.choose'), { cancel: 1 });
    if (i !== 0) return;
    ev.setFlag('forest_embers');
    ev.lead('q_forest_fireflies');
    await ev.say('lampkeeper', R.T('events.fern_lampkeeper.say_5'));
  }, { meta: { needs: [], gives: ['lead:q_forest_fireflies', 'flag:forest_embers', 'flag:forest_fireflies_done'] } });

  /**
   * ワールドの森の街道の灯籠（CONTENT-P が {type:'waylamp', id:'wl_forest_<n>', lit:'q_forest_fireflies_<n>', event:'forest_waylamp'} で置く）。
   * 調べると火種を入れて旗 q_forest_fireflies_<n> を立てる → FIELD が lit を見て灯す（R.Game.lamps）。
   */
  E('forest_waylamp', async (ev, ctx) => {
    const map = R.DB.maps[ctx && ctx.map];
    const o = map && (map.objects || []).find((q) => q.type === 'waylamp' && q.x === ctx.x && q.y === ctx.y);
    const m = o && /^wl_forest_(\d)$/.exec(o.id || '');
    if (!m) { await ev.say(null, R.T('events.forest_waylamp.say')); return; }
    const key = 'q_forest_fireflies_' + m[1];
    if (ev.flag(key)) { await ev.say(null, R.T('events.forest_waylamp.say_2')); return; }
    if (!ev.flag('forest_embers')) { await ev.say(null, R.T('events.forest_waylamp.say_3')); return; }
    await ev.say(null, R.T('events.forest_waylamp.say_4'));
    ev.setFlag(key);
    const n = ev.addVar('forest_fireflies', 1);
    await ev.caption(R.T('events.forest_waylamp.caption', { n }), { ms: 1600 });
  }, { meta: { needs: ['flag:forest_embers'], gives: ['var:forest_fireflies+1'] } });

  // ---------------------------------------------------------------- どんぐり王子
  E('fern_acorn_boy', async (ev) => {
    if (ev.flag('forest_acorn_won')) { await ev.say('acorn_boy', R.T('events.fern_acorn_boy.say')); return; }
    await ev.say('acorn_boy', R.T('events.fern_acorn_boy.say_2'));
    ev.lead('q_forest_acorn');
  }, { meta: { needs: [], gives: ['lead:q_forest_acorn'] } });

  F.acorn = async function (ev) {
    if (ev.flag('forest_acorn_won')) { await ev.say(null, R.T('ev.forest_quests.acorn.say')); return; }
    if (!(ev.flag('cleared_r_forest') || (R.Game && R.Game.leads && R.Game.leads.q_forest_acorn))) { await ev.say(null, R.T('ev.forest_quests.acorn.say_2')); return; }
    await ev.say(null, R.T('ev.forest_quests.acorn.say_3'));
    const r = await ev.battle({ mons: [['rm_acorn_prince', 1]], zone: 'z_verda', bg: 'forest', noGolden: true });
    if (r !== 'win') { if (r === 'escape') await ev.say(null, R.T('ev.forest_quests.acorn.say_4')); return; }
    ev.setFlag('forest_acorn_won');
    ev.leadDone('q_forest_acorn');
  };
})(window.RPG);
