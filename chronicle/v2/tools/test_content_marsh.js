#!/usr/bin/env node
// 湿原（marsh_*.js）のテスト（node）。オーナーの決まりと、筋・置き場所・戦闘の考えどころを確かめる。
//   node v2/tools/test_content_marsh.js
//   1 形: マップ・イベント・手がかり・編成・店・場所が契約どおり、参照がそろう。町と館と沼は 1 枚の下絵（map.art、絵のファイルがある）
//   2 置き場所: 泉は置かない（館 2 階・沼 1 階。WORLD §6.2）、宝箱は床の上で見える、隠し通路なし（A27）、ワールドに宝箱なし、
//              戸口は 1 マス、街灯（lamp_post・snow_lamp）を置かない（灯りは湖の杭の鬼火と置き灯籠）、町の小物は道をふさがない
//   3 文: ボイスを使わない（声はあとで）・仲間 20 人の名前を出さない（A36）・録音済みの文（メルダ・霧食らい・フィーネ）を 1 字も変えずに置く
//   4 筋: 閉包で clearRegion('r_marsh') に着く（年代記 2 通り、寄り道・依頼なし）。縦切りのあいだは湿原へ行けない（guard_east・guard_marsh）。
//        解決でティア +1・ページ・光の柱の場所。集会: 証拠 4 つで開ける、霧そのもの（証拠 1・2・4・6 のうち 3 つ）が正しい、
//        間違えると捕まって子が消え、新しい証拠が出る（3 回目で全部そろう）
//   5 戦闘: ボスの予告（人形の楽団・霧食らい）、出現表の数（縦切りの後のダンジョンは 1 組 5 匹まで）、レアの落とし物は道具が主（中盤の手前）
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');

const R = require('./lib/load')({ quiet: true });
const D = R.DB;
const V2 = path.resolve(__dirname, '..');
const MY_MAPS = Object.keys(D.maps).filter((id) => /^(marsh_|loch)/.test(id));
const EV_FILES = fs.readdirSync(path.join(V2, 'src', 'events')).filter((f) => /^marsh_/.test(f));
const SRC = EV_FILES.map((f) => fs.readFileSync(path.join(V2, 'src', 'events', f), 'utf8')).join('\n');
const MAP_SRC = fs.readdirSync(path.join(V2, 'src', 'maps')).filter((f) => /^marsh_/.test(f)).map((f) => fs.readFileSync(path.join(V2, 'src', 'maps', f), 'utf8')).join('\n');

// ================================================================ 1
section('1. 形と参照');
ok('R.loadErrors 0', R.loadErrors.length === 0, R.loadErrors);
ok(`湿原のマップ ${MY_MAPS.length} 枚（町・屋内 10・館 2・沼）`, MY_MAPS.length >= 14, MY_MAPS);
for (const id of MY_MAPS) {
  const r = R.Contract.check('map', D.maps[id]);
  if (!r.ok) ok(`map ${id} が K.map`, false, r.errors);
}
const myEvents = [...SRC.matchAll(/\bE\('([a-z0-9_]+)'/g)].map((m) => m[1]);
ok(`湿原のイベント ${myEvents.length} 本が R.DB.events にある`, myEvents.length >= 60 && myEvents.every((id) => D.events[id]), myEvents.filter((id) => !D.events[id]));
{
  const bad = myEvents.filter((id) => !R.Contract.check('event', D.events[id]).ok);
  ok('湿原のイベントが K.event', bad.length === 0, bad);
  const miss = [];
  for (const id of MY_MAPS.concat(['world'])) {
    const m = D.maps[id];
    for (const o of m.objects || []) if (o.event && /^(marsh|loch|manor|bog)/.test(o.event) && !D.events[o.event]) miss.push(`${id} obj ${o.event}`);
    for (const n of m.npcs || []) if (typeof n.talk === 'string' && /^(marsh|loch|manor|bog)/.test(n.talk) && !D.events[n.talk]) miss.push(`${id} npc ${n.id} → ${n.talk}`);
    for (const t of m.triggers || []) if (!D.events[t.event]) miss.push(`${id} trigger ${t.event}`);
  }
  ok('マップの人・物・範囲のイベントがすべてある', miss.length === 0, miss);
}
const leads = Object.entries(D.leads).filter(([, l]) => l.region === 'r_marsh');
ok(`湿原の手がかり ${leads.length} 件（地方・証拠 6・依頼・うわさ）`, leads.length >= 14, leads.length);
ok('手がかりが K.lead', leads.every(([, l]) => R.Contract.check('lead', l).ok));
ok('ボスの編成（人形の楽団・霧食らい）', ['tr_b_dolls', 'tr_b_mistbeast'].every((t) => D.troops[t]));
ok('場所 loch・manor・bog', ['loch', 'manor', 'bog'].every((id) => D.locations[id] && D.locations[id].region === 'r_marsh'));
ok('店 3 つ（大鐘の道具屋・武具屋・夜市）と品がそろう', ['shop_loch_items', 'shop_loch_arms', 'shop_loch_night'].every((id) => D.shops[id] && R.Contract.check('shop', D.shops[id]).ok &&
  [...D.shops[id].items, ...Object.values(D.shops[id].tier || {}).flat()].every((it) => D.items[it])));
ok('地方 r_marsh の錠が外れ、光の柱の場所・ボス・章の要約がある', !D.regions.r_marsh.slice && !!D.regions.r_marsh.beaconAt && D.regions.r_marsh.bossTroop === 'tr_b_mistbeast' && !!D.regions.r_marsh.chapter.summary);
ok('まだ作っていない地方（諸島・鉱山・灰・星）は錠のまま', ['r_isles', 'r_mine', 'r_ash', 'r_star'].every((id) => D.regions[id].slice));
ok('年代記の章 r_marsh（E14）', !!(D.chronicle && D.chronicle.r_marsh && R.Contract.check('chronicleEntry', D.chronicle.r_marsh).ok));
ok('読み物 lo_ev_marsh・lo_time_marsh（必）・lo_war_marsh', ['lo_ev_marsh', 'lo_time_marsh', 'lo_war_marsh'].every((id) => D.lore[id]) && D.lore.lo_ev_marsh.must && D.lore.lo_time_marsh.must);
{
  // 一枚絵（町・館 2 階・沼）: map.art と、v2/assets/env の絵とメタ
  const painted = ['loch', 'marsh_manor_1', 'marsh_manor_2', 'marsh_bog'];
  const miss = [];
  for (const id of painted) {
    const a = D.maps[id].art;
    if (!a || !a.image) { miss.push(id + ' no art'); continue; }
    const [theme, , name] = a.image.split('/');
    for (const f of [`${name}@32.png`, `${name}@24.png`, `${name}.json`]) if (!fs.existsSync(path.join(V2, 'assets', 'env', theme, 'under', f))) miss.push(`${id} ${f}`);
    if (a.closed && !fs.existsSync(path.join(V2, 'assets', 'env', theme, 'under', a.closed.split('/')[2] + '@32.png'))) miss.push(`${id} closed`);
    const j = JSON.parse(fs.readFileSync(path.join(V2, 'assets', 'env', theme, 'under', name + '.json'), 'utf8'));
    if (j.size32[0] !== D.maps[id].w * 32 || j.size32[1] !== D.maps[id].h * 32) miss.push(`${id} size ${j.size32}`);
  }
  ok('町・館 2 階・沼は 1 枚の下絵（絵とメタがあり、大きさがマップと同じ）', miss.length === 0, miss);
  const bog = JSON.parse(fs.readFileSync(path.join(V2, 'assets', 'env', 'forest_dungeon', 'under', 'bog.json'), 'utf8'));
  ok('沼の下絵は水の引いた形、閉じている間は bog_closed（live が tilePatches と同じ）', JSON.stringify(bog.live) === JSON.stringify(D.maps.marsh_bog.meta.live) && bog.live.every((L, i) => D.maps.marsh_bog.tilePatches[L.patch] && L.patch === i));
}

// ================================================================ 2
section('2. 置き場所（泉・宝箱・戸口・灯り）');
{
  const dungeons = MY_MAPS.filter((id) => D.maps[id].kind === 'dungeon');
  const withSpring = dungeons.filter((id) => (D.maps[id].objects || []).some((o) => o.type === 'spring'));
  ok(`ダンジョン ${dungeons.length} 階に泉は置かない（館 2 階・沼 1 階は短い。WORLD §6.2）`, withSpring.length === 0, withSpring);
  const secret = MY_MAPS.filter((id) => Object.values(D.maps[id].legend).some((l) => l.secret) && R.MapUtil.grid(D.maps[id]).some((r) => [...r].some((c) => D.maps[id].legend[c] && D.maps[id].legend[c].secret)));
  ok('隠し通路なし', secret.length === 0, secret);
  const w = D.maps.world;
  const inMarsh = (o) => o.x >= 112 && o.x <= 212 && o.y >= 44 && o.y <= 114;
  ok('ワールドの湿原に宝箱なし', !(w.objects || []).some((o) => o.type === 'chest' && inMarsh(o)));
  const townChests = MY_MAPS.filter((id) => D.maps[id].kind === 'town').flatMap((id) => (D.maps[id].objects || []).filter((o) => o.type === 'chest').map((o) => id + ':' + o.id));
  ok(`町の宝箱は見える物だけ（${townChests.length} 個）`, townChests.length <= 3, townChests);
  const bad = [];
  for (const id of MY_MAPS) {
    const m = D.maps[id];
    for (const o of (m.objects || []).filter((q) => q.type === 'chest')) {
      const c = R.MapUtil.cell(m, o.x, o.y);
      if (!c || c.solid || c.walk === false) bad.push(`${id} ${o.id} not on floor`);
      if ((m.objects || []).some((q) => q !== o && q.type !== 'chest' && q.x === o.x && q.y === o.y)) bad.push(`${id} ${o.id} under another object`);
    }
  }
  ok('宝箱は床の上で、ほかの物と重ならない', bad.length === 0, bad);
  // 戸口は 1 マス（建物の戸は 1 マス、屋内の出口も 1 マス）
  const wide = [];
  for (const id of MY_MAPS) for (const o of D.maps[id].objects || []) if (o.type === 'building' && o.door && (o.door.w || 1) !== 1) wide.push(id + ':' + o.id);
  for (const id of MY_MAPS.filter((q) => D.maps[q].kind === 'interior')) for (const e of D.maps[id].exits || []) if (e.w !== 1 || e.h !== 1) wide.push(id);
  ok('戸口は 1 マス（町の家と屋内の出口）', wide.length === 0, wide);
  // 街灯（当たりのある灯り）を置かない。町の灯りは湖の杭の鬼火（歩けないマス）と置き灯籠
  const street = MY_MAPS.flatMap((id) => (D.maps[id].objects || []).filter((o) => o.type === 'prop' && /^(lamp_post|snow_lamp)$/.test(o.id)).map((o) => id + ':' + o.x + ',' + o.y));
  ok('街灯（lamp_post・snow_lamp）を置かない', street.length === 0, street);
  const loch = D.maps.loch;
  const onWalk = (loch.objects || []).filter((o) => o.type === 'prop' && o.id === 'wisp_lamp').filter((o) => { const c = R.MapUtil.cell(loch, o.x, o.y); return c && c.walk !== false && !c.solid; });
  ok('ロッホの鬼火の灯は湖の杭の上（歩けるマス・道の上に無い）', onWalk.length === 0, onWalk.map((o) => o.x + ',' + o.y));
  // 町の小物は通り道をふさがない: 当たりのある小物（建物・宝箱・灯りでない物）が歩けるマスに 3 つまで（掲示板など）
  const clutter = (loch.objects || []).filter((o) => o.type === 'prop' && R.DB.props[o.id] && R.DB.props[o.id].solid && !/wisp_lamp|stilt_posts|mud_boat/.test(o.id)).filter((o) => { const c = R.MapUtil.cell(loch, o.x, o.y); return c && c.walk !== false && !c.solid; });
  ok(`ロッホの歩けるマスの当たりのある小物は ${clutter.length} 個（掲示板だけ）`, clutter.length <= 2, clutter.map((o) => o.id + ' ' + o.x + ',' + o.y));
}

// ================================================================ 3
section('3. 文（声はあとで・A36・録音の文）');
{
  // ボイス: 持ち主の決まりは「声はあとで」。声の担当が録音の id を足した所（design/voice_story_map.json・design/voice/script.csv にある id）だけ許す
  const ids = [...SRC.matchAll(/'(v_[a-z0-9_]+)'/g)].map((m) => m[1]);
  const known = fs.readFileSync(path.join(V2, 'design', 'voice_story_map.json'), 'utf8') + fs.readFileSync(path.join(V2, '..', 'design', 'voice', 'script.csv'), 'utf8');
  const unknown = ids.filter((id) => !known.includes(id));
  ok(`湿原のイベントのボイス ${ids.length} 本は、声の担当の一覧にある id だけ`, unknown.length === 0, unknown);
}
{
  const names = Object.values(D.companions || {}).map((c) => c.name).filter((n) => n && n.length >= 2);
  const hits = names.filter((n) => SRC.includes(n) || MAP_SRC.includes(n));
  ok(`仲間 ${names.length} 人の名前を湿原の文に出さない（A36）`, hits.length === 0, hits);
  // 録音済みの文（design/voice/script.csv の v_melda_manor_01〜05・v_melda_marsh_01・v_mistwitch_marsh_01・v_fine_marsh_01）を 1 字も変えずに置く（改行だけ入れてよい）
  const REC = ['……驚かせてしまったわね。わたしはメルダ。この館の、昔の主よ。', 'わたしは子どもたちをさらってなどいない。霧が、わたしの姿をまねているの。',
    '昔、沼の霧から魔物があふれたとき、わたしは七つの鐘を沈めて、鐘の音で霧を封じたの。', 'でも、町の人たちが鐘の歌を忘れて、鐘は鳴らなくなった……。',
    '沼の鐘を鳴らして。これは鐘の鍵。そして、これが鐘の歌よ。', 'ありがとう、語り部さん。これでまた、町の朝に鐘が鳴るわ。',
    '……オイデ……コドモタチ……ワスレラレタ……カネノ……ウタ……。', '霧は形を持たないから、誰の姿にでもなれるの。'];
  const flat = SRC.replace(/\\n/g, '');
  const miss = REC.filter((t) => !flat.includes(t));
  ok(`録音済みの文 ${REC.length} 行を 1 字も変えずに置く`, miss.length === 0, miss);
}

// ================================================================ 4
section('4. 筋（閉包・集会・解決）');
{
  const P = require('./qa/progress');
  P.init(R);
  const slice0 = D.config.slice;
  D.config.slice = false;
  R.MapUtil.invalidate();
  for (const [write, restricted] of [['pain', false], ['legend', false], ['legend', true]]) {
    const r = P.closure({ variant: { ch_forest_pim: 'send', ch_forest_fawn: 'heal', ch_forest_write: 'pain', ch_marsh_write: write, ch_marsh_accuse: 'first' }, restricted });
    ok(`年代記=${write}${restricted ? '（寄り道・依頼なし）' : ''}: clearRegion('r_marsh')`, !!(r.flags.cleared_r_marsh && r.flags.marsh_finale_done && r.flags.marsh_reward_given), { assembly: !!r.flags.marsh_assembly_done, bell3: !!r.flags.marsh_bell_3, cleared: !!r.flags.cleared_r_marsh });
  }
  D.config.slice = slice0;
  R.MapUtil.invalidate();
  ok('縦切りのあいだ（slice）は湿原へ行けない（guard_east・guard_marsh が閉じたまま）', (() => { const q = P.closure({ variant: {} }); return !q.visited.has('loch') && !q.visited.has('marsh_bog') && !q.visited.has('marsh_manor_1'); })());
  const w = D.maps.world;
  const gm = (w.npcs || []).find((n) => n.id === 'guard_marsh');
  ok('湿原の北の入口の番人 guard_marsh（cond {slice:true}）と崖崩れの tilePatch', !!(gm && gm.cond && gm.cond.slice === true) && (w.tilePatches || []).some((p) => p.cond && p.cond.slice === true && p.rect[0] === 166 && p.rect[1] === 56));
}
// 集会と証拠（イベントの本物を、画面なしの ev で走らせる）
function fakeEv(opts) {
  const G = R.Game;
  const said = [];
  const choose = opts.choose || [];
  const ev = {
    flag: (k) => !!G.flags[k], setFlag: (k, v) => { G.flags[k] = v === undefined ? true : v; }, var: (k) => G.vars[k] || 0,
    setVar: (k, v) => { G.vars[k] = v; return v; }, addVar: (k, n) => { G.vars[k] = (G.vars[k] || 0) + (n == null ? 1 : n); return G.vars[k]; },
    has: (id) => (G.items[id] || 0) > 0, item: (id, n) => { G.items[id] = (G.items[id] || 0) + (n || 1); }, take: (id, n) => { G.items[id] = Math.max(0, (G.items[id] || 0) - (n || 1)); },
    gold: () => {}, lead: () => {}, leadDone: () => {}, lore: (id) => { G.flags[id] = true; }, choice: (k, v) => { G.choices[k] = v; }, choiceOf: (k) => G.choices[k],
    say: async (who, t) => { said.push([who, t]); }, caption: async (t) => { said.push(['caption', t]); }, choose: async (list) => { const v = choose.shift(); return typeof v === 'function' ? v(list) : v == null ? 0 : v; },
    fade: async () => {}, wait: async () => {}, warp: async () => {}, sfx: () => {}, bgm: () => {}, mapBgm: () => {}, jingle: () => {}, leave: async () => {}, appear: async () => {},
    call: async (id, args) => D.events[id].run(ev, Object.assign({}, args || {})), letter: async () => {}, battle: async () => 'win', clearRegion: async () => 1,
  };
  return { ev, said };
}
async function assembly() {
  const X = R.Marsh.ev;
  R.State.newGame({ seed: 3 });
  const G = R.Game;
  G.flags.marsh_emma_met = true;
  // 証拠 3 つでは集会を開けない
  for (const id of ['foot', 'book', 'doll']) G.flags['marsh_ev_' + id] = true;
  let f = fakeEv({});
  await D.events.loch_assembly.run(f.ev, {});
  ok('証拠 3 つでは集会を開けない', !G.flags.marsh_assembly_done && f.said.some(([, t]) => String(t).includes('四つ')));
  // 4 つ目（リナの絵）を手に入れると集会の手がかり
  f = fakeEv({});
  await X.evidence(f.ev, 'drawing');
  ok('証拠 4 つで集会を開ける（marsh_can_assemble）', G.flags.marsh_can_assemble === true && G.vars.marsh_evidence === 4);
  // ベッポを名指し（誤り）→ 捕まる・子が消える・新しい正しい証拠（石碑）が出る
  f = fakeEv({ choose: [1] });
  await D.events.loch_assembly.run(f.ev, {});
  ok('ベッポを名指し: 捕まる・もう一人消える・新しい証拠（石碑）', G.flags.marsh_held_beppo === true && G.vars.marsh_wrong === 1 && G.vars.marsh_lost === 1 && G.flags.marsh_ev_stone === true && !G.flags.marsh_assembly_done);
  // 霧そのもの: 正しくない証拠（人形）は数えない、正しい 3 つで納得
  const pick = (name) => (list) => list.findIndex((n) => n.includes(name));
  f = fakeEv({ choose: [3, pick('人形'), pick('足あと'), pick('記録帳'), pick('リナ')] });
  await D.events.loch_assembly.run(f.ev, {});
  ok('霧そのもの: 証拠 3 つ（人形は数えない）で集会が済み、捕まった人は放される', G.flags.marsh_assembly_done === true && !G.flags.marsh_held_beppo && G.flags.marsh_held_beppo_was === true && G.choices.ch_marsh_accuse === 'wrong');
  // 3 回間違えると、正しい証拠が全部そろう
  R.State.newGame({ seed: 4 });
  for (const id of ['doll', 'melda', 'foot', 'book']) R.Game.flags['marsh_ev_' + id] = true;
  R.Game.flags.marsh_emma_met = true;
  for (const who of [2, 1, 2]) { f = fakeEv({ choose: [who] }); await D.events.loch_assembly.run(f.ev, {}); }
  ok('3 回間違えると、正しい証拠（1・2・4・6）が全部そろう', ['foot', 'book', 'drawing', 'stone'].every((id) => R.Game.flags['marsh_ev_' + id]) && R.Game.vars.marsh_wrong === 3);
  // 館に先に行った（メルダの証言あり）: 魔女を名指ししようとすると一度止められる
  R.State.newGame({ seed: 5 });
  for (const id of ['melda', 'foot', 'book', 'drawing']) R.Game.flags['marsh_ev_' + id] = true;
  f = fakeEv({ choose: [0, 3, pick('足あと'), pick('記録帳'), pick('リナ')] });
  await D.events.loch_assembly.run(f.ev, {});
  ok('館に先に行った: 魔女の名指しは一度止められ、一度で正しく（first）', R.Game.flags.marsh_melda_warned === true && R.Game.flags.marsh_assembly_done === true && R.Game.choices.ch_marsh_accuse === 'first' && !R.Game.flags.marsh_held_melda);
  // 締めの礼: 一度で正しく → 探偵の帽子、間違えた → わびの鈴
  R.State.newGame({ seed: 6 });
  R.Game.flags.marsh_finale_done = true;
  f = fakeEv({});
  await D.events.marsh_reward.run(f.ev, {});
  const hat = (R.Game.items.u_sleuth_hat || 0) > 0;
  R.State.newGame({ seed: 7 });
  R.Game.flags.marsh_finale_done = true; R.Game.vars.marsh_wrong = 2;
  f = fakeEv({});
  await D.events.marsh_reward.run(f.ev, {});
  ok('町長の礼: 一度で正しく → 探偵の帽子、間違えた → わびの鈴（同じ強さの別の品）', hat && (R.Game.items.u_apology_bell || 0) > 0);
  // 沼の鐘: 鍵が無いと鳴らない、1・2 で北の道、3 でまん中の道（tilePatches の cond）
  R.State.newGame({ seed: 8 });
  const bog = D.maps.marsh_bog;
  const bellAt = (n) => (bog.objects || []).find((o) => o.type === 'examine' && o.event === 'bog_bell' && o.bell === n);
  f = fakeEv({});
  await D.events.bog_bell.run(f.ev, { x: bellAt(1).x, y: bellAt(1).y });
  ok('沼の鐘: 鐘の鍵が無いと鳴らない', !R.Game.flags.marsh_bell_1);
  R.Game.items.k_bell_key = 1;
  const open = (i) => R.State.check(bog.tilePatches[i].cond);
  for (const n of [1, 2]) { f = fakeEv({}); await D.events.bog_bell.run(f.ev, { x: bellAt(n).x, y: bellAt(n).y }); }
  const a = open(0) && !open(1);
  f = fakeEv({}); await D.events.bog_bell.run(f.ev, { x: bellAt(3).x, y: bellAt(3).y });
  ok('沼の鐘: 西と東で北の泥の道、北の鐘でまん中の泥の道（水が引く）', a && open(0) && open(1));
}
function clearing() {
  R.State.newGame({ seed: 7 });
  const G = R.Game;
  G.tier = 1;
  const cel = R.Tier.celebrate;
  R.Tier.celebrate = async () => {};
  let t = null;
  return R.Events._clearRegion('r_marsh').then((v) => { t = v; }).then(() => {
    R.Tier.celebrate = cel;
    ok('clearRegion: ティア 1 → 2、pendingTier、cleared_r_marsh', t === 2 && G.pendingTier === 2 && G.flags.cleared_r_marsh === true, { t, pending: G.pendingTier });
    const page = R.Tier.regionInfo('r_marsh').pageId;
    ok('clearRegion: ページ（霧のページ）を持つ', page === 'k_page_marsh' && (G.items[page] || 0) > 0, page);
  });
}

// ================================================================ 5
function battle() {
  section('5. 戦闘（予告・出現表・落とし物）');
  const A = D.bossActions;
  for (const id of ['eb_doll_raise', 'eb_mist_gather']) ok(`${id} は予告（telegraph → next、守る）`, !!(A[id] && A[id].telegraph && A[A[id].telegraph.next] && A[id].telegraph.guard === 'defend'));
  ok('人形の楽団: 指揮者が群れの頭（倒れると楽士が崩れる）、指揮者が予告を持つ', !!D.monsters.b_doll_conductor.leader && D.monsters.b_doll_conductor.actions.some((a) => a.id === 'eb_doll_raise'));
  ok('霧食らい: 第 2 の姿（hpBelow 0.5）と予告', !!(D.monsters.b_mistbeast.phases || []).length && D.monsters.b_mistbeast.actions.some((a) => a.id === 'eb_mist_gather'));
  ok('盗み専用: 霧食らい ac_st_mistbeast は盗みだけ（イベントで渡さない）', !!(D.items.ac_st_mistbeast && D.items.ac_st_mistbeast.stealOnly) && !SRC.includes('ac_st_mistbeast'));
  const zones = ['zw_marsh', 'zw_marsh_road', 'zw_marsh_lotus', 'z_marsh_manor', 'z_marsh_bog'];
  ok('出現表 5 つ（原野・街道・はすの池・館・沼）', zones.every((z) => D.encounters[z] && D.encounters[z].region === 'r_marsh'));
  const big = [];
  for (const z of zones) for (const g of D.encounters[z].groups) { const n = g.mons.reduce((a, m) => a + m[2], 0); if (n > 5) big.push(`${z} ${n}`); }
  ok('1 組は 5 匹まで（縦切りの後のダンジョンは 4〜5 匹の組もある）', big.length === 0 && D.encounters.z_marsh_bog.groups.some((g) => g.mons.reduce((a, m) => a + m[2], 0) >= 4), big);
  ok('町とダンジョンの出現表が実在（マップの zones）', MY_MAPS.every((id) => (D.maps[id].zones || []).every((z) => !z.zone || D.encounters[z.zone])));
  // 湿原の雑魚の段 1〜2（T1 前後で出る）のレアの落とし物は道具（装備のレアの落とし物は中盤より後）
  const early = Object.entries(D.monsters).filter(([id, m]) => /^(ghost|wisp|frog|doll|lizardman|spider)_[12]$/.test(id));
  const gear = early.filter(([, m]) => m.drops && m.drops.rare && D.items[m.drops.rare.item] && D.items[m.drops.rare.item].slot !== 'use');
  ok(`湿原の雑魚の段 1〜2（${early.length} 種）のレアの落とし物は道具`, gear.length === 0, gear.map(([id]) => id));
  ok('探偵の帽子・わびの鈴はレアの率・落とす率を上げない（湿原は T1 から）', ['u_sleuth_hat', 'u_apology_bell'].every((id) => { const m = D.items[id].mods || {}; return !m.rarePct && !m.dropPct; }));
  done('test_content_marsh');
}

assembly().then(clearing).then(battle).catch((e) => { console.error(e); process.exit(1); });
