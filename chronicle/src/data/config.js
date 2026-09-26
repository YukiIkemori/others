// Game configuration read by the engine (DESIGN §10.13.11, §3.3.15). Owner: world (A18a).
//   start          where 「はじめから」 begins: the master's house in ロアの里 (§10.7 P1)
//   startGold      0 — ベルナ hands over 50 gold and 3 salves in P2 (§8.9)
//   startItems     {} (same reason)
//   startObjective the first "次の目的" (the prologue's obj_p_roa; obj_w_roa is only its alias)
//   defaultHero    the hero before the creation screen / R.debug.quickStart (§5.0 の 0.13)
//   innPrice       inn price by effective tier 0..9 (R.Tier.innPrice(); §4.12.3)
//   postgameStart  position and respawn after the ending (§10.10 E10)
//   warpGroups     group names of the warp list for the non-region groups (§10.6.3, §11.7.12);
//                  the r_* groups use DB.regions[id].name
//   chronicle      the prologue / finale / side chapters of the 年代記 screen (§10.4.1)
(function (R) {
  'use strict';
  Object.assign(R.DB.config, {
    start: { map: 'roa_house', spawn: 'bed', dir: 'down' },
    startGold: 0,
    startItems: {},
    startObjective: 'obj_p_roa',
    defaultHero: { name: 'アルン', gender: 'm', type: 'warrior', favor: { kind: 'weapon', id: 'sword' } },
    innPrice: [10, 16, 24, 32, 42, 54, 66, 80, 96, 112],
    postgameStart: { map: 'roa', spawn: 'entrance' },
    warpGroups: { prologue: 'ファロス半島', finale: 'ビブリア島' },
    chronicle: {
      prologue: {
        title: '灯台守の歌', flag: 'prologue_done',
        summary: '港町ファロスの灯台は、\n守り歌が忘れられて\n火を失っていた。\n語り部の見習いが歌を\n取り戻し、灯はふたたび\n海を照らした。',
      },
      finale: {
        title: '語り部の旅', flag: 'final_open', doneFlag: 'game_clear',
        pending: '（まだ書き終えていない）',
        summary: '八つの伝承を語り直した\n語り部は、忘却の王に\n名を与えて眠らせた。\nその旅は、九つ目の\n伝承になった。',
      },
      side: {
        title: '円環の竜', flag: 'pg_clear',
        summary: '忘れられた物語が沈む\n深い底で、終わらない\n物語を食べる竜が\nついに眠った。',
      },
    },
  });
})(window.RPG);
