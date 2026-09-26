// A19 story fixture: in-game scenes for screenshots (browser only; built into debug_story.html by
//   node tools/build.js --with tools/fixtures/story).
//   RPG.storyScene(name[, arg]) → starts a playable game in the state the scene needs, puts the party there and
//   starts the event; returns at once — drive the rest with shot.js --wait / --keys / --shot.
//     after <t>     story_after_clear of tier t (1–8) in a town (default 'lute': the slots are stand-ins there)
//     fine <rs>     story_fine_<rs> in front of a stand-in of the girl (lute)
//     home_t6 · final_roa (roa) · arrival (biblia, the pier) · biblia (walk the town) · archive <n> (walk a floor)
//     rowell (archive_3, before the seal) · shades (archive_4) · lazaro (archive_5) · king (archive_6)
//     ending <part> voidHall | archiveGate | bibliaMorning | roaTale | someDaysLater (R.Ending.scenes)
//     cards · credits · logo · fin (EndingLayer) · bonus (R.Postgame.bonusScene)
(function (R) {
  'use strict';
  const PRO = ['hero_created', 'pro_start', 'pro_berna_sent', 'pro_lute', 'pro_met_rowell', 'pro_party_chosen', 'pro_key', 'pro_tutorial', 'pro_boss', 'prologue_done'];
  const ST = (n) => { const o = []; for (let k = 1; k <= n; k++) o.push('st_t' + k); return o; };
  const FINAL = ['st_fine_reveal', 'st_berna_forgot', 'final_roa', 'final_open', 'final_arrived'];
  async function setup(o) {
    await R.debug.quickStart({ companions: ['ilse', 'hagen', 'titta'], tier: o.tier || 0, level: o.level || 30, map: 'lute', spawn: 'inn', noEncounter: true });
    for (const f of PRO.concat(o.flags || [])) R.State.setFlag(f, true);
    for (const it of o.items || []) if (!R.State.hasItem(it)) R.State.addItem(it, 1);
    R.Game.objective = o.objective || 'obj_regions';
    R.Field.noEncounter = true;
    if (o.map) await R.debug.warp(o.map, o.at);
    R.Field.noEncounter = true;
    R.Field.refresh();
  }
  const run = (id, ctx) => R.Events.run(id, Object.assign({ trigger: 'step', self: id }, ctx || {}));
  const SC = {
    async after(t) {
      t = +t || 1;
      await setup({ tier: t, flags: ST(t - 1).concat(t === 8 ? ['st_t7'] : []), map: 'lute', at: 'inn' });
      R.Game.regionsCleared.length = t; R.Game.tier = t;
      run('story_after_clear');
    },
    async fine(rs) {
      await setup({ tier: 3, flags: ST(3), map: 'lute', at: { x: 30, y: 26, dir: 'up' } });
      R.Story.actor({ npc: (id) => ({ id }) }, 'fine', 'npc:fine', 30, 24, 'down');
      run('story_fine_' + (rs || 'forest'));
    },
    async home_t6() { await setup({ tier: 6, flags: ST(6), map: 'roa', at: 'entrance' }); },
    async final_roa() { await setup({ tier: 8, flags: ST(8).concat(['st_fine_reveal']), map: 'roa', at: 'entrance' }); },
    async arrival() { await setup({ tier: 8, flags: ST(8).concat(['st_fine_reveal', 'st_berna_forgot', 'final_roa', 'final_open']), map: 'biblia', at: 'dock' }); },
    async biblia(x, y) { await setup({ tier: 8, flags: ST(8).concat(FINAL), map: 'biblia', at: { x: +x || 24, y: +y || 24, dir: 'up' } }); },
    async archive(n, x, y) {
      await setup({ tier: 8, flags: ST(8).concat(FINAL, ['archive_1_enter']), items: ['k_rowell_note'], map: 'archive_' + (n || 1),
        at: x != null ? { x: +x, y: +y, dir: 'up' } : (+n === 1 ? 'entrance' : 'from_prev') });
    },
    async rowell() { await setup({ tier: 8, flags: ST(8).concat(FINAL, ['archive_1_enter', 'final_golem']), items: ['k_rowell_note'], map: 'archive_3', at: { x: 19, y: 6, dir: 'up' } }); run('archive_3_rowell', { once: 'final_rowell' }); },
    async shades() { await setup({ tier: 8, flags: ST(8).concat(FINAL, ['archive_1_enter', 'final_golem', 'final_rowell']), map: 'archive_4', at: { x: 23, y: 8, dir: 'up' } }); },
    async lazaro() { await setup({ tier: 8, flags: ST(8).concat(FINAL, ['archive_1_enter', 'final_golem', 'final_rowell', 'final_shades']), map: 'archive_5', at: { x: 18, y: 17, dir: 'up' } }); run('archive_5_lazaro', { once: 'final_lazaro' }); },
    async king() { await setup({ tier: 8, flags: ST(8).concat(FINAL, ['archive_1_enter', 'final_golem', 'final_rowell', 'final_shades', 'final_lazaro']), map: 'archive_6', at: { x: 15, y: 13, dir: 'up' } }); },
    async ending(part) {
      await setup({ tier: 8, flags: ST(8).concat(FINAL, ['final_golem', 'final_rowell', 'final_shades', 'final_lazaro', 'final_nemrea1']), map: 'archive_6', at: { x: 15, y: 12, dir: 'up' } });
      R.Events.run((ev) => R.Ending.scenes[part || 'voidHall'](ev));
    },
    async cards() {
      await setup({ tier: 8, flags: ST(8).concat(FINAL) });
      const L = new R.Ending.EndingLayer();
      R.Engine.push(L);
      const c = R.Game.party[1];
      L.scene = R.Ending.card({ sprite: R.Party.spriteKey(c), name: c.name, lines: (R.DB.companions[c.id].epilogue || '').split('\n') });
    },
    async card_marta() {
      await setup({ tier: 8, flags: ST(8).concat(FINAL) });
      R.debug.recruit('marta');
      const L = new R.Ending.EndingLayer();
      R.Engine.push(L);
      const c = R.State.char('marta');
      L.scene = R.Ending.card({ sprite: R.Party.spriteKey(c), name: c.name, lines: (R.DB.companions.marta.epilogue || '').split('\n') });
    },
    async credits(adv) {
      await setup({ tier: 8, flags: ST(8).concat(FINAL) });
      const L = new R.Ending.EndingLayer();
      R.Engine.push(L);
      L.scene = R.Ending.credits(() => {}, R.Game.party.map((c) => R.Party.spriteKey(c)));
      L.scene.pos += +adv || 0;
    },
    async logo() { await setup({}); const L = new R.Ending.EndingLayer(); R.Engine.push(L); L.scene = R.Ending.logoCard(); },
    async fin() { await setup({}); const L = new R.Ending.EndingLayer(); R.Engine.push(L); L.scene = R.Ending.fin(); },
    async bonus() { await setup({ tier: 8 }); R.Game.title = '大語り部'; R.Postgame.bonusScene(); },
    async full() {
      await setup({ tier: 8, flags: ST(8).concat(FINAL, ['archive_1_enter', 'final_golem', 'final_rowell', 'final_shades', 'final_lazaro', 'final_nemrea1']), map: 'archive_6', at: { x: 15, y: 12, dir: 'up' } });
      R.Events.run((ev) => ev.ending());
    },
  };
  R.storyScene = async function (name, a, b, c) {
    const f = SC[name];
    if (!f) return 'scenes: ' + Object.keys(SC).join(' ');
    await f(a, b, c);
    return R.debug.pos ? R.debug.pos() : null;
  };
})(window.RPG);
