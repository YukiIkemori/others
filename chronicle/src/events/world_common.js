// Shared town / dungeon service events (DESIGN §10.6.1, §10.5.5, §10.6.2-5). Owner: world (A18a).
// Map owners place the NPCs; these scripts read their parameters from the NPC (ev.ctx.npc):
//   {id:'inn',  event:'common_inn',    fixed:true [, price:n] [, greet:'…']}        宿屋 (price: R.Tier.innPrice())
//   {id:'tavern', event:'common_tavern', fixed:true [, recruit:false] [, greet]}    酒場のマスター → ev.tavern()
//   {id:'shop_item'|'shop_weapon'|'shop_armor'|'shop_magic', event:'common_shop', shop:'<shop id>', fixed:true [, greet]}
//   {id:'ferry', event:'common_ferry', ferryFrom:'<town id>', fixed:true}           定期船の船乗り (§10.5.5)
//   {id:'rest',  event:'common_rest', sprite:'obj:lantern', fixed:true}            休息の灯
// `greet` is an optional line said first (a town's own flavour); the service's standard lines come
// from the service itself (R.Shop / R.Tavern, STYLE_JA §9).
(function (R) {
  'use strict';
  const E = R.DB.events;
  const NONE = { needs: [], gives: [] };
  const npcOf = (ev) => (ev.ctx && ev.ctx.npc) || (R.Field && ev.self && R.Field.npc && R.Field.npc(ev.self)) || {};
  async function greet(ev, n) { if (n.greet) await ev.say(n.greet); }

  // ------------------------------------------------------------ 宿屋
  E.common_inn = {
    meta: NONE,
    run: async (ev) => {
      const n = npcOf(ev);
      await greet(ev, n);
      await ev.inn(n.price != null ? n.price : undefined);
    },
  };

  // ------------------------------------------------------------ 酒場のマスター
  E.common_tavern = {
    meta: NONE,
    run: async (ev) => {
      const n = npcOf(ev);
      await greet(ev, n);
      const recruit = n.recruit !== false;
      if (ev.tavern) { await ev.tavern({ recruit }); return; }
      if (R.Tavern && R.Tavern.open) { ev.closeMessage(); await R.Tavern.open({ recruit }); return; }
      await ev.say('いらっしゃい。\n今日は名簿を片付けているところでね。');
    },
  };

  // ------------------------------------------------------------ 店
  E.common_shop = {
    meta: NONE,
    run: async (ev) => {
      const n = npcOf(ev);
      await greet(ev, n);
      if (!n.shop || !(R.DB.shops && R.DB.shops[n.shop])) {
        R.warn('common_shop: unknown shop', n.shop, 'on', ev.map);
        await ev.say('いらっしゃいませ！\n……おや、今日は品切れのようです。');
        return;
      }
      await ev.shop(n.shop);
    },
  };

  // ------------------------------------------------------------ 定期船 (§10.5.5)
  // One route table for the game and for tools/progress.js (meta.warp). Every ferry lands on the
  // destination town's spawn `dock`. The fare is free.
  const FERRIES = [
    { from: 'lute', to: 'coral', needs: ['flag:prologue_done'] },
    { from: 'lute', to: 'loch', needs: ['flag:prologue_done'] },
    { from: 'lute', to: 'biblia', needs: ['flag:final_open'] },
    { from: 'loch', to: 'lute', needs: [] },
    { from: 'loch', to: 'coral', needs: [] },
    { from: 'coral', to: 'lute', needs: [] },
    { from: 'coral', to: 'loch', needs: [] },
    { from: 'biblia', to: 'lute', needs: [] },
  ].map((r) => Object.assign({ spawn: 'dock' }, r));
  const flagsOf = (needs) => needs.filter((t) => t.startsWith('flag:')).map((t) => t.slice(5));
  /** the routes that sail from `town` now (cond from each route's needs) */
  function routesFrom(town) {
    return FERRIES.filter((r) => r.from === town && flagsOf(r.needs).every((f) => R.State.flag(f)));
  }
  const placeName = (id) => (R.DB.locations[id] && R.DB.locations[id].name) || (R.DB.maps[id] && R.DB.maps[id].name) || id;

  E.common_ferry = {
    meta: { needs: [], gives: [], warp: FERRIES.map((r) => ({ from: r.from, to: r.to, spawn: r.spawn, needs: r.needs.slice() })) },
    routes: FERRIES,
    routesFrom,
    run: async (ev) => {
      const n = npcOf(ev);
      const from = n.ferryFrom || ev.map;
      if (!FERRIES.some((r) => r.from === from)) R.warn('common_ferry: no routes from', from);
      const list = routesFrom(from);
      if (!list.length) {
        await ev.say(ev.flag('prologue_done') ? '今日は、船は出せないんです。' : '灯台の火が消えているうちは、\n船は出せないんです。');
        return;
      }
      const names = list.map((r) => placeName(r.to));
      const i = await ev.ask('定期船は、いつでも出せますよ。\nどちらへ？', names.concat(['やめる']));
      if (i < 0 || i >= list.length) { await ev.say('またいつでもどうぞ。'); return; }
      const r = list[i];
      await ev.say('では、出航！');
      ev.closeMessage();
      await ev.warp(r.to, r.spawn, { sfx: 'ship', frames: 30 });
    },
  };

  // ------------------------------------------------------------ 休息の灯 (§11.6.4)
  E.common_rest = {
    meta: NONE,
    run: async (ev) => {
      if (ev.rest) { await ev.rest(); return; }
      ev.sfx('heal');
      await ev.flash('#ffffff', 8);
      ev.heal();
      await ev.say('灯の光に包まれて、\n疲れが消えていく……。');
    },
  };
})(window.RPG);
