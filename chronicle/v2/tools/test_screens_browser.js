// MENUS のブラウザのテスト（V2_PLAN §4.4 の MENUS の行）と、§3.11 の全画面 × 2 つの大きさの撮影。
//   node v2/tools/build.js && node v2/tools/test_screens_browser.js [--no-shots] [--only menu,shop]
//   開く・閉じる・戻る（B）・L/R で人の切り替え・タッチの当たり・結果の形（R.Contract.SCREEN_RESULTS）・コンソールのエラー 0。
//   撮った PNG は v2/design/shots/menus/<画面>_1920.png・<画面>_phone.png（必ず Read で見る）。
'use strict';
const path = require('path');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

const OUT = path.join(B.V2, 'design', 'shots', 'menus');
const args = process.argv.slice(2);
const noShots = args.includes('--no-shots');
const onlyArg = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const TOP = B.TOP;

// 見本の状態（リード・CONTENT のデータがまだ無い所は、ページの中だけで足す。ファイルには書かない）
const DECOR = `(() => {
  const G = RPG.Game, D = RPG.DB;
  G.chars.viola.hp = 58; G.chars.selma.hp = Math.max(1, G.chars.selma.hp - 30); G.chars.sylvain.mp = 3;
  G.playMs = (12 * 60 + 34) * 60000;
  const addC = (id, list) => { const c = G.chars[id]; for (const t of list) { if (D.techs[t] && !c.techs.includes(t)) c.techs.push(t); if (D.spells[t] && !c.spells.includes(t)) c.spells.push(t); } };
  addC('hero', ['t_sword_stepcut', 's_light_1']); addC('viola', ['s_light_1', 's_water_1', 's_fire_1']); addC('selma', ['t_sword_stepcut']);
  G.seenSkill = { hero: { t_sword_stepcut: true } };
  const L = { l_rumor_forest: { title: '森で人が消える', text: '西の森で、樵が三人と子どもが一人、帰ってこないそうだ。\\nフェルンの村が捜索隊を募っている。', region: 'r_forest', from: 'pharos_tavern', place: 'fern', dir: '西', kind: 'rumor' },
    l_main_rumors: { title: '噂は酒場に集まる', text: '噂は酒場に集まるものさ。まずは港の酒場で聞いてごらん。', region: 'prologue', from: 'pharos', kind: 'main' },
    l_rumor_snow: { title: '北の雪原の鐘', text: '北の雪原で、鳴らないはずの鐘が鳴るという。', region: 'r_snow', from: 'pharos_tavern', kind: 'rumor', slice: 'locked' },
    q_fern_herbs: { title: '薬草を 5 種', text: '迷いの森の広場ごとに生える薬草を、1 種ずつ集めてほしい。', region: 'r_forest', from: 'fern', place: 'verda', dir: '北', kind: 'side' } };
  for (const k in L) if (!D.leads[k]) D.leads[k] = L[k];
  for (const k in L) RPG.Leads.add(k);
  RPG.Leads.pin('l_rumor_forest');
  if (!D.locations.pharos) D.locations.pharos = { name: '港町ファロス', region: 'prologue', kind: 'town', map: 'stub_road' };
  if (!D.locations.fern) D.locations.fern = { name: '森の村フェルン', region: 'r_forest', kind: 'town', map: 'fern' };
  if (!D.locations.pharos_tavern) D.locations.pharos_tavern = { name: 'ファロスの潮風亭', region: 'prologue', kind: 'place', map: 'pharos_tavern' };
  if (!D.locations.verda) D.locations.verda = { name: '迷いの森', region: 'r_forest', kind: 'dungeon', map: 'verda_1' };
  G.chronicle.chapters = [{ id: 'prologue', summaryKey: 'prologue' }];
  D.chronicle = D.chronicle || {};
  if (!D.chronicle.prologue) D.chronicle.prologue = { title: '序章　灯台の守り歌', text: 'ファロスの灯台の火が消えて三晩。ロアの里の語り部見習いは、港町で三人の仲間と出会い、灯台の三階でページ食らいを退けた。\\n守り歌が戻り、夜の海に最初の灯りがともった。' };
  const book = G.book.mon;
  for (const [id, k] of [['jelly_1', 12], ['rat_1', 7], ['seabird_1', 4], ['crab_1', 2], ['wolf_1', 3]]) book[id] = { seen: true, kills: k, normal: true };
  if (!D.letters.menus_sample) D.letters.menus_sample = { from: 'ベルナ', title: '宿の主人から', text: 'よく眠れたかい。\\n今朝は港の鐘がよく鳴っている。\\nあんたたちの旅に、灯りがありますように。' };
  return true;
})()`;

// 画面ごとの開き方・確かめ
const SCREENS = [
  { id: 'menu' }, { id: 'items' }, { id: 'skills' }, { id: 'equip' }, { id: 'status', params: { id: 'hero' } }, { id: 'order' },
  { id: 'bestiary' }, { id: 'chronicle' }, { id: 'map' }, { id: 'save' }, { id: 'load' }, { id: 'settings' },
  { id: 'shop', params: { id: 'shop_pharos_arms', line: '港の鍛冶場から今朝あがった品だよ' } }, { id: 'inn', params: { price: 30 } },
  { id: 'tavern', params: { swap: true } }, { id: 'partySelect', params: { count: 3 } }, { id: 'charcreate' }, { id: 'nameentry', params: { value: 'アルン', max: 5, title: '主人公の名前' } },
  { id: 'passphrase', params: { mode: 'show' } }, { id: 'detail', params: { kind: 'item', id: 'w_sword_coral' } }, { id: 'tip', params: { id: 'glimmer' } },
  { id: 'warp' }, { id: 'letter', params: { id: 'menus_sample' } }, { id: 'title' },
];

async function openAt(S, phone) {
  const P = await B.open(S, 'dev.html?fixture=menus_party', phone ? { phone: true } : {});
  await B.waitFor(P.page, `${TOP}==='field'`, 8000);
  await P.page.waitForTimeout(400);
  await B.ev(P.page, DECOR);
  await B.ev(P.page, `(() => { RPG.Save.save('s1'); RPG.Save.save('auto'); return true; })()`);
  return P;
}
async function openScreen(p, id, params) {
  await B.ev(p, `(() => { window.__r = 'pending'; RPG.Screens.open(${JSON.stringify(id)}, ${JSON.stringify(params || {})}).then((r) => { window.__r = r === undefined ? '__undef' : r; }); return true; })()`);
  return B.waitFor(p, `${TOP}==='screen:${id}'`, 3000);
}
const result = (p) => B.ev(p, 'window.__r');

(async () => {
  const S = await B.start();
  try {
    // ------------------------------------------------ 開く・閉じる・撮る（2 つの大きさ）
    for (const phone of [false, true]) {
      section(phone ? 'スマホ縦（390×844）' : '16:9（1920×1080）');
      const P = await openAt(S, phone);
      const p = P.page;
      for (const sc of SCREENS) {
        if (onlyArg && !onlyArg.includes(sc.id)) continue;
        const opened = await openScreen(p, sc.id, sc.params);
        ok(`${sc.id} opens as screen:${sc.id}`, opened, await B.ev(p, TOP));
        await p.waitForTimeout(sc.id === 'bestiary' || sc.id === 'title' ? 700 : 350);
        if (!noShots) await B.shot(p, path.join(OUT, `${sc.id}_${phone ? 'phone' : '1920'}.png`));
        if (sc.id === 'title') { await B.ev(p, 'RPG.Engine.remove(RPG.Engine.top(), {cmd:"new"})'); await p.waitForTimeout(200); continue; }
        // B で閉じる（名前の入力は 1 字ずつ消すので数回）
        const closed = await B.pressUntil(p, 'b', `${TOP}==='field'`, sc.id === 'nameentry' ? 10 : sc.id === 'partySelect' ? 1 : 4);
        if (sc.id === 'partySelect') { ok('partySelect: B does not cancel (ids are required)', !closed); await B.ev(p, 'RPG.Engine.remove(RPG.Engine.top(), [])'); await p.waitForTimeout(250); continue; }
        ok(`${sc.id} closes with B → field`, closed, await B.ev(p, TOP));
      }
      ok('0 console errors', P.errors.length === 0, P.errors.slice(0, 5));
      await P.close();
    }

    if (onlyArg) return;
    // ------------------------------------------------ 結果の形と操作
    section('結果の形と操作（キーボード）');
    let P = await openAt(S, false);
    let p = P.page;
    // ハブ → セーブ → 記録 2
    await openScreen(p, 'menu');
    ok('hub: list rows expose value (save)', await B.pressUntil(p, 'down', `RPG.Engine.top().list && RPG.Engine.top().list.rows[RPG.Engine.top().list.index].value==='save'`, 12));
    await B.press(p, 'a');
    ok('hub → save screen', await B.waitFor(p, `${TOP}==='screen:save'`, 2000));
    await B.press(p, 'down'); await B.press(p, 'a');
    ok('save to 記録 2 (empty → saved at once)', await B.waitFor(p, `!!(RPG.Save.cards().find(e=>e.slot==='s2')||{}).card`, 2000));
    const card = await B.ev(p, `RPG.Save.cards().find(e=>e.slot==='s2').card`);
    ok('save card: place/chapter/faces, no Lv', card && typeof card.chapter === 'number' && card.faces.length === 4 && !('lv' in card), card);
    await B.press(p, 'up'); await B.press(p, 'a');
    ok('overwrite asks first (modal)', await B.waitFor(p, `!!RPG.Engine.top().view.modal`, 1500));
    await B.press(p, 'b'); await p.waitForTimeout(250);
    await B.pressUntil(p, 'b', `${TOP}==='screen:menu'`, 4);
    // ハブ: → で人の札 → A で強さ → R で次の人 → B
    await B.pressUntil(p, 'up', `RPG.Engine.top().list.index===0`, 12);
    await B.press(p, 'right'); await B.press(p, 'a');
    ok('hub: → card, A → status', await B.waitFor(p, `${TOP}==='screen:status'`, 2000));
    const ci0 = await B.ev(p, 'RPG.Engine.top().view.ci');
    await B.press(p, 'r');
    ok('status: R → next member', (await B.ev(p, 'RPG.Engine.top().view.ci')) === (ci0 + 1) % 4);
    await B.press(p, 'l');
    ok('status: L → back', (await B.ev(p, 'RPG.Engine.top().view.ci')) === ci0);
    await B.pressUntil(p, 'b', `${TOP}==='screen:menu'`, 3);
    // 満タン（X）
    const hp0 = await B.ev(p, 'RPG.Game.chars.viola.hp');
    await B.press(p, 'x');
    ok('hub: X → 満タン card', await B.waitFor(p, `!!RPG.Engine.top().view.modal`, 1500));
    const needAsk = await B.ev(p, `RPG.Engine.top().view.modal.kind==='ask'`);
    if (needAsk) { await B.press(p, 'a'); await p.waitForTimeout(300); await B.waitFor(p, `!!RPG.Engine.top().view.modal`, 1500); }
    await p.waitForTimeout(300);
    ok('満タン healed viola', (await B.ev(p, 'RPG.Game.chars.viola.hp')) > hp0, { hp0, hp1: await B.ev(p, 'RPG.Game.chars.viola.hp') });
    if (!noShots) await B.shot(p, path.join(OUT, 'menu_fullheal_1920.png'));
    await B.press(p, 'a'); await p.waitForTimeout(250);
    await B.pressUntil(p, 'b', `${TOP}==='field'`, 3);
    ok('hub: B → undefined', (await result(p)) === '__undef');

    // 宿
    await openScreen(p, 'inn', { price: 30 });
    await B.press(p, 'a'); await p.waitForTimeout(300);
    ok('inn: A → {stay:true}', JSON.stringify(await result(p)) === '{"stay":true}', await result(p));
    await B.ev(p, `(() => { RPG.Game.gold = 5; return true; })()`);
    await openScreen(p, 'inn', { price: 30 });
    await B.press(p, 'a'); await p.waitForTimeout(300);
    ok('inn: too poor → cursor on やめておく → {stay:false}', JSON.stringify(await result(p)) === '{"stay":false}', await result(p));
    await B.ev(p, `(() => { RPG.Game.gold = 12345; return true; })()`);

    // 主人公の作成（A を押していくと名前 → 旅立つ）
    await openScreen(p, 'charcreate');
    await B.press(p, 'right'); // 性別 → 女
    await B.pressUntil(p, 'a', `${TOP}==='screen:nameentry'`, 5);
    ok('charcreate: name row opens nameentry', await B.ev(p, `${TOP}==='screen:nameentry'`));
    await B.press(p, 'a');   // 決定の上にカーソル
    await B.waitFor(p, `${TOP}==='screen:charcreate'`, 1500);
    await B.pressUntil(p, 'a', `window.__r !== 'pending'`, 3);
    const hero = await result(p);
    ok('charcreate → K.hero', !!hero && (await B.ev(p, `RPG.Contract.check('hero', window.__r).ok`)) && hero.sex === 'f', hero);

    // 名前の入力
    await openScreen(p, 'nameentry', { value: '', max: 5 });
    await B.press(p, 'a'); await B.press(p, 'right'); await B.press(p, 'a');   // ア カ
    await B.press(p, 'b');   // 1 字消す
    await B.press(p, 'down'); await B.press(p, 'a');   // キ
    const typed = await B.ev(p, 'RPG.Engine.top().view.value.join("")');
    ok('nameentry: type / delete', typed === 'アキ', typed);
    await B.press(p, 'x');
    ok('nameentry: X → ひらがな', (await B.ev(p, 'RPG.Engine.top().view.kata')) === false);
    await B.ev(p, `(() => { const v = RPG.Engine.top().view; v.cur = v.cells.findIndex(c => c.act === 'ok'); return true; })()`);
    await B.press(p, 'a'); await p.waitForTimeout(300);
    ok('nameentry → string', (await result(p)) === 'アキ', await result(p));

    // 仲間選び
    await openScreen(p, 'partySelect', { count: 3 });
    await B.press(p, 'a'); await B.press(p, 'right'); await B.press(p, 'a'); await B.press(p, 'down'); await B.press(p, 'a');
    ok('partySelect: 3 picks → confirm', await B.waitFor(p, `!!RPG.Engine.top().view.modal`, 1500));
    await B.press(p, 'a'); await p.waitForTimeout(300);
    const picks = await result(p);
    ok('partySelect → 3 companion ids', Array.isArray(picks) && picks.length === 3 && picks.every((x) => typeof x === 'string'), picks);

    // 店: タブ（武器・防具・道具は並ぶ種類だけ＋売る）・数を選ぶ札・売る（2026-09 の作り直し: 道具は ←→ の数ではなく A で数を選ぶ札を開く）
    const V = 'RPG.Engine.top().view';
    const g0 = await B.ev(p, 'RPG.Game.gold');
    await openScreen(p, 'shop', { id: 'shop_pharos_items' });
    ok('shop: item shop tabs = stocked kinds + 売る, opens on 道具', JSON.stringify(await B.ev(p, `${V}.tabs.map((t) => t.key)`)) === JSON.stringify(['armor', 'item', 'sell']) && (await B.ev(p, `${V}.tabKey()`)) === 'item');
    const first = await B.ev(p, 'RPG.Engine.top().list.rows[0].value');
    const n0 = await B.ev(p, `RPG.Game.items[${JSON.stringify(first)}]||0`);
    await B.press(p, 'a');
    ok('shop: A on a consumable → quantity picker', await B.waitFor(p, `!!${V}.qtyPick && ${V}.qtyPick.n === 1`, 1500));
    const qmax = await B.ev(p, `${V}.qtyPick.max`);
    await B.press(p, 'right');
    const q1 = await B.ev(p, `${V}.qtyPick.n`);
    await B.press(p, 'up');
    const q2 = await B.ev(p, `${V}.qtyPick.n`);
    await B.press(p, 'down');
    const q3 = await B.ev(p, `${V}.qtyPick.n`);
    ok('shop: picker → +1, ↑ +10, ↓ −10 (kept in 1..max)', q1 === Math.min(2, qmax) && q2 === Math.min(q1 + 10, qmax) && q3 === Math.max(1, q2 - 10), { qmax, q1, q2, q3 });
    await B.press(p, 'a'); await p.waitForTimeout(250);
    ok('shop: buy ×n from the picker', (await B.ev(p, `RPG.Game.items[${JSON.stringify(first)}]||0`)) === n0 + q3 && (await B.ev(p, 'RPG.Game.gold')) < g0 && !(await B.ev(p, `${V}.qtyPick`)), { n0, g0, q3 });
    await B.press(p, 'x');
    ok('shop: X → sort 値段順', (await B.ev(p, `${V}.sortMode`)) === 1 && (await B.ev(p, `(() => { const v = ${V}; const pr = v.list.rows.map((r) => v.price(r.value)); return pr.every((x, i) => !i || pr[i - 1] <= x); })()`)));
    await B.press(p, 'x'); await B.press(p, 'x');
    ok('shop: X cycles back to 種類順', (await B.ev(p, `${V}.sortMode`)) === 0);
    await B.press(p, 'r');
    ok('shop: R (E key) → 売る tab', (await B.ev(p, `${V}.tabKey()`)) === 'sell');
    const g1 = await B.ev(p, 'RPG.Game.gold');
    await B.press(p, 'a'); await p.waitForTimeout(250);
    if (await B.ev(p, `!!${V}.qtyPick`)) { await B.press(p, 'a'); await p.waitForTimeout(250); }
    if (await B.ev(p, `!!${V}.modal`)) { await B.press(p, 'a'); await p.waitForTimeout(250); }
    ok('shop: sell → gold up', (await B.ev(p, 'RPG.Game.gold')) > g1);
    await B.press(p, 'l'); await B.press(p, 'l');
    ok('shop: L (Q key) → 防具 tab', (await B.ev(p, `${V}.tabKey()`)) === 'armor');
    await B.pressUntil(p, 'b', `${TOP}==='field'`, 3);
    ok('shop → undefined', (await result(p)) === '__undef');
    // 武具屋: 武器・防具・売る。しぼり込み（START）。装備を買う → 今すぐ装備する？
    await openScreen(p, 'shop', { id: 'shop_pharos_arms' });
    ok('shop: arms shop tabs = 武器・防具・売る', JSON.stringify(await B.ev(p, `${V}.tabs.map((t) => t.key)`)) === JSON.stringify(['weapon', 'armor', 'sell']));
    const nAll = await B.ev(p, 'RPG.Engine.top().list.rows.length');
    await B.press(p, 'start');
    ok('shop: START → only gear someone in the party can equip', (await B.ev(p, `${V}.filter`)) && (await B.ev(p, `RPG.Engine.top().list.rows.every((r) => RPG.Party.members().some((c) => RPG.Rules.canEquip(c, r.value, RPG.Rules.defaultSlot(c, r.value))))`)) && (await B.ev(p, 'RPG.Engine.top().list.rows.length')) <= nAll);
    await B.press(p, 'start');
    await B.press(p, 'a');
    ok('shop: buying gear asks 今すぐ装備する？', await B.waitFor(p, `!!${V}.modal && ${V}.modal.o.title === '今すぐ装備する？'`, 1500));
    ok('shop: the prompt lists every member (+ 装備しない), can\'t-equip rows disabled', await B.ev(p, `(() => { const m = ${V}.modal; const rows = m.list.rows; return rows.length === RPG.Party.members().length + 1 && RPG.Party.members().every((c, i) => !!rows[i].disabled === !RPG.Rules.canEquip(c, ${V}.list.current().value, RPG.Rules.defaultSlot(c, ${V}.list.current().value))); })()`));
    await B.press(p, 'a'); await p.waitForTimeout(250);
    await B.pressUntil(p, 'b', `${TOP}==='field'`, 3);

    // 装備: 枠 → 候補 → 付ける、L/R
    await openScreen(p, 'equip');
    const w0 = await B.ev(p, 'RPG.Game.chars.hero.equip.weapon1');
    await B.press(p, 'a');
    ok('equip: A → candidates', (await B.ev(p, 'RPG.Engine.top().view.mode')) === 'cand');
    await B.pressUntil(p, 'down', `RPG.Engine.top().view.clist.current() && RPG.Engine.top().view.clist.current().value && !RPG.Engine.top().view.clist.current().cur`, 3);
    await B.press(p, 'a');
    const w1 = await B.ev(p, 'RPG.Game.chars.hero.equip.weapon1');
    ok('equip: weapon changed, old one back in the bag', w1 !== w0 && (await B.ev(p, `RPG.Game.items[${JSON.stringify(w0)}]>0`)), { w0, w1 });
    await B.press(p, 'r');
    ok('equip: R → next member', (await B.ev(p, 'RPG.Engine.top().view.ci')) === 1);
    await B.press(p, 'x');
    ok('equip: X → いちばん強く card', await B.waitFor(p, `!!RPG.Engine.top().view.modal`, 1500));
    await B.press(p, 'a'); await p.waitForTimeout(250);
    if (await B.ev(p, '!!RPG.Engine.top().view.modal')) { await B.press(p, 'b'); await p.waitForTimeout(250); }
    await B.pressUntil(p, 'b', `${TOP}==='field'`, 4);

    // 道具: 使う → 相手は開いたまま
    await B.ev(p, `(() => { RPG.Game.chars.viola.hp = 20; RPG.Game.items.i_salve = 6; return true; })()`);
    await openScreen(p, 'items');
    await B.pressUntil(p, 'down', `RPG.Engine.top().list.current().value==='i_salve'`, 8);
    await B.press(p, 'a');
    ok('items: A → target mode', await B.ev(p, '!!RPG.Engine.top().view.tgt'));
    await B.pressUntil(p, 'down', `RPG.Engine.top().view.tgt.i===3`, 4);
    const vh = await B.ev(p, 'RPG.Game.chars.viola.hp');
    await B.press(p, 'a'); await p.waitForTimeout(150);
    ok('items: salve heals viola, count −1', (await B.ev(p, 'RPG.Game.chars.viola.hp')) > vh && (await B.ev(p, 'RPG.Game.items.i_salve')) === 5);
    ok('items: target stays open after use (A2)', await B.ev(p, '!!RPG.Engine.top().view.tgt'));
    await B.press(p, 'b');
    ok('items: B → back to the list', await B.ev(p, '!RPG.Engine.top().view.tgt'));
    await B.press(p, 'r');
    ok('items: R → next tab', (await B.ev(p, 'RPG.Engine.top().view.tab')) === 1);
    await B.pressUntil(p, 'b', `${TOP}==='field'`, 3);

    // 並び: A で持ち上げ → → で動かす → A で置く、↓ で後列
    const ord0 = await B.ev(p, 'RPG.Game.party.join(",")');
    await openScreen(p, 'order');
    await B.press(p, 'a'); await B.press(p, 'right'); await B.press(p, 'a');
    const ord1 = await B.ev(p, 'RPG.Game.party.join(",")');
    ok('order: A-→-A swaps', ord1 !== ord0 && ord1.split(',').sort().join() === ord0.split(',').sort().join(), { ord0, ord1 });
    await B.press(p, 'down');
    ok('order: ↓ → 後列', (await B.ev(p, `RPG.Game.chars[RPG.Game.party[1]].row`)) === 'back');
    await B.press(p, 'up');
    await B.pressUntil(p, 'b', `${TOP}==='field'`, 3);

    // 設定: ←→ ですぐ変わる
    await openScreen(p, 'settings');
    const ts0 = await B.ev(p, 'RPG.Settings.get("textSpeed")');
    await B.press(p, 'right');
    ok('settings: → changes textSpeed', (await B.ev(p, 'RPG.Settings.get("textSpeed")')) !== ts0);
    await B.press(p, 'left');
    await B.press(p, 'r');
    ok('settings: R → next tab', (await B.ev(p, 'RPG.Engine.top().view.tab')) === 1);
    await B.press(p, 'right');   // 字の大きさ → 大
    ok('settings: uiSize applied at once (R.uiScale)', (await B.ev(p, 'RPG.uiScale')) > 1, await B.ev(p, 'RPG.uiScale'));
    await B.press(p, 'left');
    await B.pressUntil(p, 'b', `${TOP}==='field'`, 3);

    // 手がかり: A で目印を替える
    await openScreen(p, 'chronicle');
    await B.pressUntil(p, 'down', `RPG.Engine.top().list.current().value==='q_fern_herbs'`, 6);
    await B.press(p, 'a');
    ok('chronicle: A pins the lead', (await B.ev(p, 'RPG.Leads.pinned()')) === 'q_fern_herbs');
    await B.press(p, 'l');
    ok('chronicle: L → 年代記', (await B.ev(p, 'RPG.Engine.top().view.tab')) === 0);
    await B.pressUntil(p, 'b', `${TOP}==='field'`, 3);

    // 説明の札は 1 回だけ
    await B.ev(p, `(() => { delete RPG.Game.flags.tip_row; window.__t = 0; RPG.Screens.tip('row').then(() => { window.__t = 1; }); return true; })()`);
    ok('tip opens once', await B.waitFor(p, `${TOP}==='screen:tip'`, 1500));
    await B.press(p, 'a'); await p.waitForTimeout(250);
    ok('tip flag set', await B.ev(p, 'RPG.Game.flags.tip_row===true'));
    await B.ev(p, `(() => { window.__t2 = 0; RPG.Screens.tip('row').then(() => { window.__t2 = 1; }); return true; })()`);
    await p.waitForTimeout(100);
    ok('tip: second time resolves without a screen', (await B.ev(p, 'window.__t2')) === 1 && (await B.ev(p, TOP)) === 'field');

    // 詳しく（Y）
    await openScreen(p, 'items');
    await B.press(p, 'y');
    ok('items: Y → detail', await B.waitFor(p, `${TOP}==='screen:detail'`, 1500));
    await B.press(p, 'b'); await p.waitForTimeout(200);
    await B.pressUntil(p, 'b', `${TOP}==='field'`, 3);

    // 中断してタイトルへ（ハブが {title:true} で閉じる）
    await openScreen(p, 'menu');
    await B.pressUntil(p, 'down', `RPG.Engine.top().list.current().value==='save'`, 12);
    await B.press(p, 'a');
    await B.waitFor(p, `${TOP}==='screen:save'`, 1500);
    await B.pressUntil(p, 'down', `RPG.Engine.top().list.current().value==='suspend'`, 5);
    await B.press(p, 'a'); await B.waitFor(p, `!!RPG.Engine.top().view.modal`, 1500);
    await B.press(p, 'a');
    ok('suspend → hub closes with {title:true}', await B.waitFor(p, `window.__r && window.__r.title===true`, 2500), await result(p));
    ok('suspend slot written', await B.ev(p, `!!(RPG.Save.cards().find(e=>e.slot==='suspend')||{}).card`));
    ok('0 console errors (keyboard run)', P.errors.length === 0, P.errors.slice(0, 5));
    await P.close();

    // ------------------------------------------------ タッチ（スマホ縦）
    section('タッチ（スマホ縦）');
    P = await openAt(S, true);
    p = P.page;
    const cdp = await P.ctx.newCDPSession(p);
    const tap = async (x, y) => {
      const q = await B.ev(p, `(() => { const c = document.getElementById('screen').getBoundingClientRect(); return {x: c.left + ${x} / RPG.W * c.width, y: c.top + ${y} / RPG.H * c.height}; })()`);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [q] }); await p.waitForTimeout(60);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(250);
    };
    await openScreen(p, 'menu');
    await p.waitForTimeout(300);
    const tile = await B.ev(p, `(() => { const L = RPG.Engine.top().list; const r = L.rowRect(2); return {x: r.x + r.w/2, y: r.y + r.h/2}; })()`);
    await tap(tile.x, tile.y);
    ok('touch: tap the 装備 tile → equip', await B.waitFor(p, `${TOP}==='screen:equip'`, 2000), await B.ev(p, TOP));
    const bs = await B.ev(p, "RPG.Input.touchSpot('b')");
    ok('touch: menu layout shows the B spot', !!bs);
    if (bs) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bs.x, y: bs.y }] }); await p.waitForTimeout(70);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(300);
      ok('touch: B spot closes equip → hub', await B.waitFor(p, `${TOP}==='screen:menu'`, 2000), await B.ev(p, TOP));
    }
    const card0 = await B.ev(p, `(() => { const r = RPG.Engine.top().view.cards[1]; return {x: r.x + r.w/2, y: r.y + r.h/2}; })()`);
    await tap(card0.x, card0.y);
    ok('touch: tap a member card → status', await B.waitFor(p, `${TOP}==='screen:status'`, 2000), await B.ev(p, TOP));
    await B.pressUntil(p, 'b', `${TOP}==='field'`, 4);
    await openScreen(p, 'settings');
    const ts1 = await B.ev(p, 'RPG.Settings.get("textSpeed")');
    const ar = await B.ev(p, `(() => { const a = RPG.Engine.top().view.arrows.find(a => a.i === 0 && a.d === 1); return {x: a.r.x + a.r.w/2, y: a.r.y + a.r.h/2}; })()`);
    await tap(ar.x, ar.y);
    ok('touch: tap the ▶ arrow changes a setting', (await B.ev(p, 'RPG.Settings.get("textSpeed")')) !== ts1);
    const tab = await B.ev(p, `(() => { const r = RPG.Engine.top().view.tabRects[2]; return {x: r.x + r.w/2, y: r.y + r.h/2}; })()`);
    await tap(tab.x, tab.y);
    ok('touch: tap a tab', (await B.ev(p, 'RPG.Engine.top().view.tab')) === 2);
    await B.pressUntil(p, 'b', `${TOP}==='field'`, 3);
    ok('0 console errors (touch run)', P.errors.length === 0, P.errors.slice(0, 5));
    await P.close();
  } finally {
    await B.stop(S);
    done('test_screens_browser');
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
