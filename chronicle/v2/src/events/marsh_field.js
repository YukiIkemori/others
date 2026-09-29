// 湿原のエリア（maps/marsh_field_*.js）の名所の一言。ボイスなし、短い地の文だけ（world_poi.js と同じ形）。
//   marsh_field_tower   霧の入口の、崩れた見張りの塔
//   marsh_field_chapel  沈んだ礼拝堂の原の、水に沈んだ礼拝堂（のちの寄り道 #23 の予告。水の底の歌）
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const lines = (list) => async (ev) => { for (const t of list) await ev.say(null, t); };
  E('marsh_field_tower', lines(R.T('ev.marsh_field.marsh_field_tower')));
  E('marsh_field_chapel', async (ev) => {
    await lines(R.T('ev.marsh_field.marsh_field_chapel'))(ev);
    if (ev.flag('cleared_r_marsh')) await ev.say(null, R.T('ev.marsh_field.marsh_field_chapel.after'));
  });
})(window.RPG);
