// 戦闘の状態の印（右上の一覧・スマホの札の名前の右）のテスト（持ち主 2026-10-04: 攻撃アップが「b」と出て分からない）。
//   node v2/tools/build.js && node v2/tools/test_status_marks_browser.js
//   ・5 言語すべてで、状態（DB.statuses の即死以外）と強化・弱体（buff_atk…buff_agi）に短い印がある（id の頭の字にならない・短い・状態どうしで重複しない）
//   ・強化と弱体は同じ字で、札の幅に ▲/▼ の分がある（上下が見分けられる）
//   ・1920×1080 とスマホ縦で、印をたくさん付けても人の札（一覧の行）の右端からはみ出さない
'use strict';
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

const LABELS = `(() => {
  const R = RPG, M = R.BFX.MARK || {}, out = { missing: [], bad: [], dup: [], arrow: [] };
  const ids = Object.keys(R.DB.statuses).filter((k) => !R.DB.statuses[k].instant).concat(['buff_atk', 'buff_def', 'buff_mag', 'buff_mdef', 'buff_agi']);
  const seen = {};
  const latin = R.I18n.lang() === 'en';
  for (const id of ids) {
    const m = M[id];
    if (!m || !m[1]) { out.missing.push(id); continue; }
    const s = String(m[1]), n = [...s].length;
    if (s === [...id][0] || n > (latin ? 3 : 2) || /^[a-z]$/.test(s)) out.bad.push(id + '=' + s);
    if (seen[s]) out.dup.push(seen[s] + '/' + id + '=' + s); else seen[s] = id;
  }
  const g = document.createElement('canvas').getContext('2d');
  for (const k of ['atk', 'def', 'mag', 'mdef', 'agi']) {
    // 強化・弱体の札は ▲/▼ の分だけ同じ字の状態の札より広い
    const up = R.BFX.statusMarkW(g, { id: 'buff_' + k, stage: 1 }, 6), dn = R.BFX.statusMarkW(g, { id: 'buff_' + k, stage: -1 }, 6);
    const save = M['buff_' + k], plain = (M._t = [save[0], save[1]], R.BFX.statusMarkW(g, '_t', 6)); delete M._t;
    if (!(up > plain && dn > plain)) out.arrow.push(k + ':' + up + '/' + plain);
  }
  return out;
})()`;

// HUD の札の右端を超えて印を描いていないか（statusMark を包んで描いた場所を集める）
const HUD = `(() => {
  const R = RPG, st = R.Battle.debug(), b = (id, s) => ({ id: 'buff_' + id, stage: s });
  const many = [b('atk', 2), b('def', -1), b('mag', 1), b('mdef', -2), b('agi', 1), 'poison', 'regen', 'silence', 'blind', 'veil'];
  const party = st.B.units.filter((u) => u.side === 'party');
  for (const u of party) st.vis[u.uid].status = many.slice();
  const rec = [], f0 = R.BFX.statusMark;
  R.BFX.statusMark = function (g, id, x, y, r) { const w = f0.apply(this, arguments); rec.push({ x, w }); return w; };
  return new Promise((res) => setTimeout(() => {
    R.BFX.statusMark = f0;
    // 印のそれぞれが、どれかの人の札（横 r.x〜r.x+r.w）の中に収まる
    const rects = R.Battle._.hud.partyRects(st);
    const out = rec.filter((q) => !rects.some((r) => q.x >= r.x - 1 && q.x + q.w <= r.x + r.w + 1));
    res({ n: rec.length, out: out.length, right: Math.max(...rec.map((q) => q.x + q.w)), W: R.W });
  }, 250));
})()`;

(async () => {
  const S = await B.start();
  try {
    for (const lang of ['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko']) {
      section('labels ' + lang);
      const P = await B.open(S, 'dev.html?scene=bscene_normal&lang=' + lang, {});
      await B.waitFor(P.page, "RPG.Battle.debug() && RPG.Battle.debug().ui && RPG.Battle.debug().phase==='input'", 20000);
      const r = await P.page.evaluate(LABELS);
      ok(`${lang}: every status and buff has a mark`, r.missing.length === 0, r.missing);
      ok(`${lang}: marks are short and not the id's first letter`, r.bad.length === 0, r.bad);
      ok(`${lang}: marks are unique among statuses/buffs`, r.dup.length === 0, r.dup);
      ok(`${lang}: buff/debuff marks carry an up/down arrow`, r.arrow.length === 0, r.arrow);
      ok(`${lang}: no console errors`, P.errors.length === 0, P.errors.slice(0, 3));
      await P.close();
    }
    for (const [name, o] of [['1920', {}], ['phone', { phone: true }]]) {
      for (const lang of ['ja', 'en', 'ko']) {
        section(`HUD ${name} ${lang}`);
        const P = await B.open(S, 'dev.html?scene=bscene_normal&lang=' + lang, o);
        await B.waitFor(P.page, "RPG.Battle.debug() && RPG.Battle.debug().ui && RPG.Battle.debug().phase==='input'", 20000);
        await P.page.waitForTimeout(300);
        const h = await P.page.evaluate(HUD);
        ok(`${name} ${lang}: marks drawn (${h.n})`, h.n >= 8, h);
        ok(`${name} ${lang}: marks stay inside the party cards`, h.out === 0 && h.right <= h.W, h);
        ok(`${name} ${lang}: no console errors`, P.errors.length === 0, P.errors.slice(0, 3));
        await P.close();
      }
    }
  } finally { await B.stop(S); }
  done('test_status_marks_browser');
})();
