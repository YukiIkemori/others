// PV の下見: ページを開き、式を順に評価しながら時計を進めて、ところどころを JPEG に撮る（カメラの位置や段取りを決める用）。
//   node v2/tools/pv/probe.js --site <dir> --url 'dev.html?fixture=content_p_roa' --out <dir>/p \
//        --step 'js:RPG.Field.hud.draw=()=>{}' --step 'idle:60' --step 'shot:a' --step 'hold:right:90' --step 'shot:b'
//   step: js:<式> / idle:<フレーム> / hold:<ボタン>:<フレーム>（押したまま進めて離す）/ press:<ボタン> / until:<式> / shot:<名前> / info
'use strict';
const C = require('./cap');
const a = process.argv.slice(2);
const opt = { steps: [] };
for (let i = 0; i < a.length; i++) {
  if (a[i] === '--site') opt.site = a[++i];
  else if (a[i] === '--url') opt.url = a[++i];
  else if (a[i] === '--out') opt.out = a[++i];
  else if (a[i] === '--step') opt.steps.push(a[++i]);
}
(async () => {
  const S = await C.start({ site: opt.site });
  try {
    const P = await C.open(S, opt.url || 'dev.html');
    for (const st of opt.steps) {
      const k = st.indexOf(':'), op = k < 0 ? st : st.slice(0, k), v = k < 0 ? '' : st.slice(k + 1);
      if (op === 'js') console.log('js →', await C.run(P, v));
      else if (op === 'idle') await C.idle(P, +v);
      else if (op === 'hold') { const [b, n] = v.split(':'); await C.idle(P, +n, (i) => (i === 0 ? `RPG.Input._set('${b}', true)` : null)); await C.run(P, `RPG.Input._set('${b}', false)`); await C.idle(P, 2); }
      else if (op === 'press') { await C.run(P, `RPG.Input._set('${v}', true)`); await C.idle(P, 3); await C.run(P, `RPG.Input._set('${v}', false)`); await C.idle(P, 6); }
      else if (op === 'until') console.log('until', v, '→', await C.until(P, v, 1800));
      else if (op === 'shot') { await C.still(P, `${opt.out}_${v}.jpg`); console.log('shot', `${opt.out}_${v}.jpg`); }
      else if (op === 'info') console.log(await C.run(P, 'JSON.stringify(Object.assign(RPG.Dev.info(), {fpos: RPG.Field.pos, msg: RPG.UIK.Message.busy(), ev: RPG.Events.busy()}))'));
    }
    if (P.errors.length) console.log('errors:', P.errors.slice(0, 5));
  } finally { await C.stop(S); }
})();
