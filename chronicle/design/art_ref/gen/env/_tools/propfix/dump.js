const R = require('/home/user/others/chronicle/v2/tools/lib/load')({ quiet: true });
const ids = ['roa','pharos','fern','yura','well','lighthouse_1','lighthouse_2','lighthouse_3','elder_1','elder_2','verda_1','verda_2'];
const out = {};
for (const id of ids) {
  const m = R.DB.maps[id];
  out[id] = { w: m.w, h: m.h, kind: m.kind, theme: m.theme, art: m.art, objects: (m.objects||[]).map((o,i)=>Object.assign({i}, JSON.parse(JSON.stringify(o, (k,v)=> typeof v==='function'?'<fn>':v)))),
    npcs: (m.npcs||[]).map(n=>({x:n.x,y:n.y,id:n.id})), grid: R.MapUtil.grid(m) };
}
require('fs').writeFileSync(require('path').join(__dirname, 'maps.json'), JSON.stringify(out));
