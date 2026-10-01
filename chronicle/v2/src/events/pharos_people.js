// CONTENT-P: ファロスの町の人・店・宿・依頼・酒場のうわさ（V2_PLAN §3.3「話す見返りのある人」・§3.4・§3.5、WORLD_REDESIGN §3.3、STORY_BIBLE §3.5・§8.10・§10.2）
//   話す見返り（町・屋内で 10 人以上、種類は ①手がかり ②依頼 ⑤一度だけの品 ④隠し場所のほのめかし ⑥ボスの癖 ⑦近況）:
//     潮風亭のうわさの 3 人（手がかり）・井戸の子（依頼 q_pharos_well）・タデオ（依頼 q_pharos_lamp）・造船所の見習い（依頼 q_pharos_delivery）・
//     漁師のおかみ（一度だけの品）・老水夫（灯台 2 階の隠し通路）・旅の剣士（ページ食らいの癖）・門番／船乗り／広場の人（近況）
//   世代で分けた台詞（STORY_BIBLE §3.5）: 桟橋の子（二十歳より下）・行商人（二十〜四十）・ベンチの年寄り（年寄り）
//   読み物: pharos_oilboard（lo_pharos_oilboard）・pharos_tract（lo_silent_tract）
(function (R) {
  'use strict';
  const D = R.DB.events;
  const X = () => R.ContentP.ev;
  const say = (who, lines) => ({ meta: { needs: [], gives: [] }, run: async (ev) => { const E = X(); await E.say(ev, who, E.pick(lines)); } });

  // ------------------------------------------------------------ 近況の人（ティアと序章の進みで変わる）
  D.pharos_gateguard = say('gateguard', [
    { cond: 'cleared_r_forest', text: R.T('ev.pharos_people.say.0.text') },
    { cond: 'prologue_done', text: R.T('ev.pharos_people.say.1.text') },
    { text: R.T('ev.pharos_people.say.2.text') },
  ]);
  D.pharos_ship_sailor = say('ship_sailor', [
    { cond: 'prologue_done', text: R.T('ev.pharos_people.say.0.text_2') },
    { text: R.T('ev.pharos_people.say.1.text_2') },
  ]);
  D.pharos_plaza_woman = say('plaza_woman', [
    { cond: 'prologue_boss', text: R.T('ev.pharos_people.say.0.text_3') },
    { text: R.T('ev.pharos_people.say.1.text_3') },
  ]);
  D.pharos_bench_old = say('bench_old', [
    { cond: 'prologue_done', text: R.T('ev.pharos_people.say.0.text_4') },
    { text: R.T('ev.pharos_people.say.1.text_4') },
  ]);
  D.pharos_merchant = say('merchant', [
    { cond: 'prologue_done', text: R.T('ev.pharos_people.say.0.text_5') },
    { text: R.T('ev.pharos_people.say.1.text_5') },
  ]);
  D.pharos_kid_pier = say('kid_pier', [
    { text: R.T('ev.pharos_people.say.0.text_6') },
  ]);
  D.pharos_clerk = say('clerk', [
    { cond: 'prologue_done', text: R.T('ev.pharos_people.say.0.text_7') },
    { text: R.T('ev.pharos_people.say.1.text_6') },
  ]);
  D.pharos_shipwright = say('shipwright', [
    { cond: 'prologue_done', text: R.T('ev.pharos_people.say.0.text_8') },
    { text: R.T('ev.pharos_people.say.1.text_7') },
  ]);

  // ------------------------------------------------------------ 静夜会（遠くで説いている姿だけ。STORY_BIBLE §8.10）
  D.pharos_yena = say('yena', [{ text: R.T('ev.pharos_people.say.0.text_9') }]);
  D.pharos_tract = {
    meta: { needs: [], gives: ['lore:lo_silent_tract'] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, R.T('ev.pharos_people.pharos_tract.run.narr'));
      await E.narr(ev, R.T('ev.pharos_people.pharos_tract.run.narr_2'));
      E.lore(ev, 'lo_silent_tract');
    },
  };

  // ------------------------------------------------------------ 読み物・掲示板
  D.pharos_oilboard = {
    meta: { needs: [], gives: ['lore:lo_pharos_oilboard'] },
    run: async (ev) => {
      const E = X();
      // 灯油の倍率（STORY_BIBLE §3.1。表は events/story_00_tiers.js の R.Tier.oil）
      const k = R.Tier && R.Tier.oil ? R.Tier.oil() : [1.0, 1.0, 0.9, 0.9, 0.8, 0.8, 0.7, 0.7, 0.6][Math.min(8, (R.Game && R.Game.tier) || 0)];
      const p = (n) => Math.round(n * k);
      await E.narr(ev, R.T('ev.pharos_people.pharos_oilboard.run.narr'));
      await E.narr(ev, R.T('ev.pharos_people.pharos_oilboard.run.narr_2', { p: p(12), p2: p(15), p3: p(30), p4: p(40) }));
      await E.narr(ev, R.T('ev.pharos_people.pharos_oilboard.run.narr_3'));
      E.lore(ev, 'lo_pharos_oilboard');
    },
  };
  D.pharos_board = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, R.T('ev.pharos_people.pharos_board.run.narr'));
      await E.narr(ev, E.pick([
        { cond: 'prologue_done', text: R.T('ev.pharos_people.pharos_board.run.pick.0.text') },
        { text: R.T('ev.pharos_people.pharos_board.run.pick.1.text') },
      ]));
      if (ev.flag('prologue_done')) await E.narr(ev, R.T('ev.pharos_people.pharos_board.run.narr_2'));
    },
  };

  // ------------------------------------------------------------ 一度だけの品・ほのめかし・ボスの癖
  D.pharos_fishwife = {
    meta: { needs: [], gives: ['item:i_salve'] },
    run: async (ev) => {
      const E = X();
      if (!ev.flag('prologue_fishwife')) {
        await E.say(ev, 'fishwife', R.T('ev.pharos_people.pharos_fishwife.run.say'));
        await E.give(ev, 'i_salve', 2);
        ev.setFlag('prologue_fishwife');
        return;
      }
      await E.say(ev, 'fishwife', E.pick([
        { cond: 'prologue_done', text: R.T('ev.pharos_people.pharos_fishwife.run.pick.0.text') },
        { cond: ['prologue_party', '!prologue_boss'], text: R.T('ev.pharos_people.pharos_fishwife.run.advice') },   // 灯台の前の備え（宿で休む・暴れたら守る）
        { text: R.T('ev.pharos_people.pharos_fishwife.run.pick.1.text') },
      ]));
    },
  };
  D.pharos_old_sailor = say('old_sailor', [
    { text: R.T('ev.pharos_people.say.0.text_10') },
  ]);
  D.pharos_swordsman = say('swordsman', [
    { cond: 'prologue_boss', text: R.T('ev.pharos_people.say.0.text_11') },
    { text: R.T('ev.pharos_people.say.1.text_8') },
  ]);

  // ------------------------------------------------------------ 依頼
  // q_pharos_well（井戸の子 → 旅人の古井戸。巣を見つけると解決。optional_well.js の well_nest）
  D.pharos_well_child = {
    meta: { needs: [], gives: ['lead:q_pharos_well'] },
    run: async (ev) => {
      const E = X();
      if (ev.flag('prologue_well_nest')) { await E.say(ev, 'well_child', R.T('ev.pharos_people.pharos_well_child.run.say')); return; }
      await E.say(ev, 'well_child', R.T('ev.pharos_people.pharos_well_child.run.say_2'));
      ev.lead('q_pharos_well');
    },
  };
  // q_pharos_lamp（タデオ → 半島の消えた灯籠 2 つに組合の火種。見晴らし台と、ロアからの夜道。world_pen_lamp）
  D.pharos_tadeo = {
    meta: { needs: [], gives: ['lead:q_pharos_lamp', 'flag:prologue_lamp_quest', 'gold'] },
    run: async (ev) => {
      const E = X();
      if (!ev.flag('prologue_tadeo')) {
        await E.say(ev, 'tadeo', R.T('ev.pharos_people.pharos_tadeo.run.say'));
        ev.setFlag('prologue_tadeo');
        if (!ev.flag('prologue_done')) return;
      }
      if (!ev.flag('prologue_done')) { await E.say(ev, 'tadeo', R.T('ev.pharos_people.pharos_tadeo.run.say_2')); return; }
      if (!ev.flag('prologue_lamp_quest')) {
        await E.say(ev, 'tadeo', R.T('ev.pharos_people.pharos_tadeo.run.say_3'));
        ev.setFlag('prologue_lamp_quest');
        ev.lead('q_pharos_lamp');
        await E.narr(ev, R.T('ev.pharos_people.pharos_tadeo.run.narr'));
        return;
      }
      const both = ev.flag('prologue_lamp_road') && ev.flag('prologue_lamp_lookout');
      if (both && !ev.flag('prologue_lamp_paid')) {
        await E.say(ev, 'tadeo', R.T('ev.pharos_people.pharos_tadeo.run.say_4'));
        E.gold(ev, 100);
        ev.setFlag('prologue_lamp_paid');
        ev.leadDone('q_pharos_lamp');
        return;
      }
      await E.say(ev, 'tadeo', both ? R.T('ev.pharos_people.pharos_tadeo.run.say_5') : R.T('ev.pharos_people.pharos_tadeo.run.say_6'));
    },
  };
  // q_pharos_delivery（造船所の見習い → 包みをフェルンのきこり頭ゴードへ。受け取りは CONTENT-F の fern_gord）
  D.pharos_apprentice = {
    meta: { needs: ['flag:prologue_done'], gives: ['lead:q_pharos_delivery', 'item:k_ship_parcel'] },
    run: async (ev) => {
      const E = X();
      if (!ev.flag('prologue_done')) { await E.say(ev, 'apprentice', R.T('ev.pharos_people.pharos_apprentice.run.say')); return; }
      if (ev.flag('q_pharos_delivery_done')) { await E.say(ev, 'apprentice', R.T('ev.pharos_people.pharos_apprentice.run.say_2')); return; }
      if (!ev.flag('prologue_parcel')) {
        await E.say(ev, 'apprentice', R.T('ev.pharos_people.pharos_apprentice.run.say_3'));
        await E.give(ev, 'k_ship_parcel', 1, { say: true });
        ev.setFlag('prologue_parcel');
        ev.lead('q_pharos_delivery');
        return;
      }
      await E.say(ev, 'apprentice', R.T('ev.pharos_people.pharos_apprentice.run.say_4'));
    },
  };

  // ------------------------------------------------------------ 店・宿
  D.pharos_innkeeper = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      const price = R.Tier && R.Tier.innPrice ? R.Tier.innPrice() : 10;
      await E.say(ev, 'innkeeper', R.T('ev.pharos_people.pharos_innkeeper.run.say', { price }));
      const ok = await ev.inn(price);
      await E.say(ev, 'innkeeper', ok ? R.T('ev.pharos_people.pharos_innkeeper.run.say_2') : R.T('ev.pharos_people.pharos_innkeeper.run.say_3'));
    },
  };
  D.pharos_shopkeeper = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.say(ev, 'shopkeeper', R.T('ev.pharos_people.pharos_shopkeeper.run.say'));
      // 灯台へ行く前の備え（持ち主 2026-10-01「序章のボスは少し強いので、準備していけと助言する人を置く」。町の中で: 道具屋と港の魚売り）
      if (ev.flag('prologue_party') && !ev.flag('prologue_boss')) await E.say(ev, 'shopkeeper', R.T('ev.pharos_people.pharos_shopkeeper.run.advice'));
      await ev.shop('shop_pharos_items');
    },
  };
  D.pharos_smithy = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.say(ev, 'smith', R.T('ev.pharos_people.pharos_smithy.run.say'));
      await ev.shop('shop_pharos_arms');
    },
  };

  // ------------------------------------------------------------ 潮風亭のうわさの 3 人（WORLD_REDESIGN §3.3。1 回話すごとに次のうわさ。序章の後）
  const RUMORS = {
    gossip: ['l_rumor_forest', 'l_opt_hut', 'l_rumor_marsh', 'l_rumor_isles'],
    bard: ['l_rumor_snow', 'l_rumor_star', 'l_rumor_ash', 'l_opt_windhill'],
    trader: ['l_rumor_desert', 'l_opt_yura', 'l_rumor_mine'],
  };
  const TALK = {
    l_rumor_forest: R.T('ev.pharos_people.TALK.l_rumor_forest'),
    l_opt_hut: R.T('ev.pharos_people.TALK.l_opt_hut'),
    l_rumor_marsh: R.T('ev.pharos_people.TALK.l_rumor_marsh'),
    l_rumor_isles: R.T('ev.pharos_people.TALK.l_rumor_isles'),
    l_rumor_snow: R.T('ev.pharos_people.TALK.l_rumor_snow'),
    l_rumor_star: R.T('ev.pharos_people.TALK.l_rumor_star'),
    l_rumor_ash: R.T('ev.pharos_people.TALK.l_rumor_ash'),
    l_opt_windhill: R.T('ev.pharos_people.TALK.l_opt_windhill'),
    l_rumor_desert: R.T('ev.pharos_people.TALK.l_rumor_desert'),
    l_opt_yura: R.T('ev.pharos_people.TALK.l_opt_yura'),
    l_rumor_mine: R.T('ev.pharos_people.TALK.l_rumor_mine'),
  };
  const BEFORE = {
    gossip: R.T('ev.pharos_people.BEFORE.gossip'),
    bard: R.T('ev.pharos_people.BEFORE.bard'),
    trader: R.T('ev.pharos_people.BEFORE.trader'),
  };
  function rumorEvent(key) {
    return {
      meta: { needs: [], gives: RUMORS[key].map((l) => 'lead:' + l) },
      run: async (ev, ctx) => {
        const E = X();
        const who = (ctx && ctx.npc) || key;
        if (!ev.flag('prologue_done')) { await E.say(ev, who, BEFORE[key]); return; }
        const next = RUMORS[key].find((l) => !(R.Game.leads && R.Game.leads[l]));
        if (!next) { await E.say(ev, who, R.T('ev.pharos_people.rumorEvent.run.say')); return; }
        await E.say(ev, who, TALK[next]);
        ev.lead(next);
      },
    };
  }
  D.pharos_rumor_gossip = rumorEvent('gossip');
  D.pharos_rumor_bard = rumorEvent('bard');
  D.pharos_rumor_trader = rumorEvent('trader');
})(window.RPG);
