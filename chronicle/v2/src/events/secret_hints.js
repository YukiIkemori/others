// 隠し通路のそばの、さりげないほのめかし（ひび・すきま風・色のちがう石）。
//   マップの物 { type:'examine', event:'secret_hint', text } を調べると、その text を地の文で出す。
(function (R) {
  'use strict';
  const D = R.DB.events;
  D.secret_hint = {
    meta: { needs: [], gives: [] },
    run: async (ev, ctx) => {
      const m = R.DB.maps[ctx && ctx.map];
      if (!m) return;
      const o = (m.objects || []).find((q) => q.type === 'examine' && q.event === 'secret_hint' && q.x === ctx.x && q.y === ctx.y);
      if (!o || !o.text) return;
      await ev.say(null, o.text, { face: false });
    },
  };
})(window.RPG);
