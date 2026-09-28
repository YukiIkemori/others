#!/usr/bin/env node
// 灰の荒野（ash_*.js）のテスト（node）。オーナーの決まりと、筋・置き場所・戦闘の考えどころを確かめる。
//   node v2/tools/test_content_ash.js
//   1 形: マップ・イベント・手がかり・編成・店・場所が契約どおり、参照がそろう。町と火山 2 階は 1 枚の下絵（map.art、絵のファイルがある）
//   2 置き場所: 泉は置かない（火山は 2 階の短いダンジョン。WORLD §6.2）、宝箱は床の上で見える、隠し通路なし（A27）、ワールドに宝箱なし、
//              戸口は 1 マス、街灯（lamp_post・snow_lamp）を置かない（灯りは溶岩の照り返しと崖の上のかがり火）、町の小物は道をふさがない、
//              灯りは道・戸口の前・出入り口に置かない
//   3 文: ボイスは声の担当の一覧の id だけ・仲間 20 人の名前を出さない（A36）・録音済みの文（フィーネ）を 1 字も変えずに置く
//   4 筋: 閉包で clearRegion('r_ash') に着く（八百長 2 通り・年代記 2 通り・寄り道と依頼なし）。縦切りのあいだは灰の荒野へ行けない（guard_ash）。
//        解決でティア +1・ページ・光の柱の場所。大会: 出場 → 5 回戦（負けてもその回から）→ 前夜の使い → 優勝。溶岩の堰は流れが入れ替わる。
//        写し手: 受けた = 止める、断った = 壁画 3 が白い。締めの品: 断った = 闘士の帯、受けた = 壁画の残り火
//   5 戦闘: ボスの予告、出現表の数（縦切りの後のダンジョンは 1 組 5 匹まで）、レアの落とし物は道具が主（中盤の手前）
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');

const R = require('./lib/load')({ quiet: true });
const D = R.DB;
const V2 = path.resolve(__dirname, '..');
const MY_MAPS = Object.keys(D.maps).filter((id) => /^(ash_|caldera|haimi)/.test(id));
const EV_FILES = fs.readdirSync(path.join(V2, 'src', 'events')).filter((f) => /^ash_/.test(f));
const SRC = EV_FILES.map((f) => fs.readFileSync(path.join(V2, 'src', 'events', f), 'utf8')).join('\n');
const MAP_SRC = fs.readdirSync(path.join(V2, 'src', 'maps')).filter((f) => /^ash_/.test(f)).map((f) => fs.readFileSync(path.join(V2, 'src', 'maps', f), 'utf8')).join('\n');
const PAINTED = ['caldera', 'ash_volcano_1', 'ash_volcano_2'];

// ================================================================ 1
section('1. 形と参照');
ok('R.loadErrors 0', R.loadErrors.length === 0, R.loadErrors);
ok(`灰の荒野のマップ ${MY_MAPS.length} 枚（町・闘技場・屋内 7・宿場・火山 2）`, MY_MAPS.length >= 12, MY_MAPS);
for (const id of MY_MAPS) {
  const r = R.Contract.check('map', D.maps[id]);
  if (!r.ok) ok(`map ${id} が K.map`, false, r.errors);
}
const myEvents = [...SRC.matchAll(/\bE\('([a-z0-9_]+)'/g)].map((m) => m[1]);
ok(`灰の荒野のイベント ${myEvents.length} 本が R.DB.events にある`, myEvents.length >= 60 && myEvents.every((id) => D.events[id]), myEvents.filter((id) => !D.events[id]));
{
  const bad = myEvents.filter((id) => !R.Contract.check('event', D.events[id]).ok);
  ok('灰の荒野のイベントが K.event', bad.length === 0, bad);
  const miss = [];
  for (const id of MY_MAPS.concat(['world'])) {
    const m = D.maps[id];
    for (const o of m.objects || []) if (o.event && !D.events[o.event]) miss.push(`${id} obj ${o.event}`);
    for (const n of m.npcs || []) if (typeof n.talk === 'string' && !D.events[n.talk]) miss.push(`${id} npc ${n.id} → ${n.talk}`);
    for (const t of m.triggers || []) if (!D.events[t.event]) miss.push(`${id} trigger ${t.event}`);
  }
  ok('マップの人・物・範囲のイベントがすべてある', miss.length === 0, miss);
  // イベントが話しかける人（ev.say('<id>')・appear・leave）が、そのイベントのマップにいる
  const lost = [];
  for (const m of SRC.matchAll(/ev\.(?:appear|leave)\(\[?'([a-z0-9_]+)'/g)) if (!MY_MAPS.some((id) => (D.maps[id].npcs || []).some((n) => n.id === m[1]))) lost.push(m[1]);
  ok('appear・leave する人がマップにいる', lost.length === 0, lost);
}
const leads = Object.entries(D.leads).filter(([, l]) => l.region === 'r_ash');
ok(`灰の荒野の手がかり ${leads.length} 件（地方・依頼・うわさ）`, leads.length >= 12, leads.length);
ok('手がかりが K.lead', leads.every(([, l]) => R.Contract.check('lead', l).ok), leads.filter(([, l]) => !R.Contract.check('lead', l).ok).map(([id]) => id));
ok('編成（大会 4 回戦・決勝ザクロ・炎の番犬・溶岩の巨獣・写し手）', ['tr_ash_r1', 'tr_ash_r2', 'tr_ash_r3', 'tr_ash_r4', 'tr_b_zakuro', 'tr_b_hellhound', 'tr_b_lavabeast', 'tr_ash_copyists'].every((t) => D.troops[t] && R.Contract.check('troop', D.troops[t]).ok));
ok('場所 caldera・haimi・volcano', ['caldera', 'haimi', 'volcano'].every((id) => D.locations[id] && D.locations[id].region === 'r_ash' && D.maps[D.locations[id].map]));
ok('店 4 つ（殻の道具屋・武具屋・闘技場の売り台・灰見の宿）と品がそろう', ['shop_caldera_items', 'shop_caldera_arms', 'shop_arena', 'shop_haimi'].every((id) => D.shops[id] && R.Contract.check('shop', D.shops[id]).ok &&
  [...D.shops[id].items, ...Object.values(D.shops[id].tier || {}).flat()].every((it) => D.items[it])));
ok('地方 r_ash の錠が外れ、光の柱の場所・ボス・章の要約がある', !D.regions.r_ash.slice && !!D.regions.r_ash.beaconAt && D.regions.r_ash.bossTroop === 'tr_b_lavabeast' && !!D.regions.r_ash.chapter.summary);
ok('年代記の章 r_ash（E14）', !!(D.chronicle && D.chronicle.r_ash && R.Contract.check('chronicleEntry', D.chronicle.r_ash).ok));
ok('読み物 lo_ev_ash・lo_time_ash（必）・lo_war_ash', ['lo_ev_ash', 'lo_time_ash', 'lo_war_ash'].every((id) => D.lore[id]) && D.lore.lo_ev_ash.must && D.lore.lo_time_ash.must);
ok('大事な物・一品物（出場の札・種火・火の鳥の羽・湯の花・闘士の帯・壁画の残り火・残り火の宝珠・灰のページ）', ['k_arena_token', 'k_seed_fire', 'k_phoenix_plume', 'k_spa_salt', 'u_champion_belt', 'u_mural_ember', 'ac_tale_ash', 'k_page_ash'].every((id) => D.items[id]));
{
  const miss = [];
  for (const id of PAINTED) {
    const a = D.maps[id].art;
    if (!a || !a.image) { miss.push(id + ' no art'); continue; }
    const [theme, , name] = a.image.split('/');
    for (const f of [`${name}@32.png`, `${name}@24.png`, `${name}.json`]) if (!fs.existsSync(path.join(V2, 'assets', 'env', theme, 'under', f))) miss.push(`${id} ${f}`);
    if (a.closed && !fs.existsSync(path.join(V2, 'assets', 'env', theme, 'under', a.closed.split('/')[2] + '@32.png'))) miss.push(`${id} closed`);
    if (miss.length) continue;
    const j = JSON.parse(fs.readFileSync(path.join(V2, 'assets', 'env', theme, 'under', name + '.json'), 'utf8'));
    if (j.size32[0] !== D.maps[id].w * 32 || j.size32[1] !== D.maps[id].h * 32) miss.push(`${id} size ${j.size32}`);
  }
  ok('町・火山 2 階は 1 枚の下絵（絵とメタがあり、大きさがマップと同じ）', miss.length === 0, miss);
  const v1 = D.maps.ash_volcano_1;
  const jf = path.join(V2, 'assets', 'env', 'ash', 'under', 'ash_volcano_1.json');
  const j = fs.existsSync(jf) ? JSON.parse(fs.readFileSync(jf, 'utf8')) : {};
  // live: 流れている方の渡り場（tilePatches[i] の cond が真 = 溶岩）が閉じた絵。live の cond は、その tilePatch の cond の否定
  const neg = (c) => (c[0] === '!' ? c.slice(1) : '!' + c);
  ok('火山 1 階の下絵は両方の渡り場が冷えた形、流れている方は閉じた絵（live が tilePatches と同じ）', JSON.stringify(j.live) === JSON.stringify(v1.meta.live) && (j.live || []).every((L, i) => v1.tilePatches[i] && L.cond === neg(v1.tilePatches[i].cond)));
}

// ================================================================ 2
section('2. 置き場所（泉・宝箱・戸口・灯り）');
{
  const dungeons = MY_MAPS.filter((id) => D.maps[id].kind === 'dungeon');
  const withSpring = dungeons.filter((id) => (D.maps[id].objects || []).some((o) => o.type === 'spring'));
  ok(`ダンジョン ${dungeons.length} 階に泉は置かない（火山は 2 階。WORLD §6.2、持ち主の決まり）`, withSpring.length === 0, withSpring);
  const secret = MY_MAPS.filter((id) => Object.values(D.maps[id].legend).some((l) => l.secret) && R.MapUtil.grid(D.maps[id]).some((r) => [...r].some((c) => D.maps[id].legend[c] && D.maps[id].legend[c].secret)));
  ok('隠し通路なし', secret.length === 0, secret);
  const w = D.maps.world;
  const L = (w.meta && w.meta.xform && R.WorldXform) ? (x, y) => R.WorldXform.toL(w, x, y) : (x, y) => [x, y];
  const inAsh = (o) => { const [x, y] = L(o.x, o.y); return x >= 96 && x <= 206 && y >= 115 && y <= 162; };
  ok('ワールドの灰の荒野に宝箱なし', !(w.objects || []).some((o) => o.type === 'chest' && inAsh(o)));
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
  const wide = [];
  for (const id of MY_MAPS) for (const o of D.maps[id].objects || []) if (o.type === 'building' && o.door && (o.door.w || 1) !== 1) wide.push(id + ':' + o.id);
  for (const id of MY_MAPS.filter((q) => D.maps[q].kind === 'interior')) for (const e of D.maps[id].exits || []) if (e.w !== 1 || e.h !== 1) wide.push(id);
  ok('戸口は 1 マス（町の建物と屋内の出口）', wide.length === 0, wide);
  const street = MY_MAPS.flatMap((id) => (D.maps[id].objects || []).filter((o) => o.type === 'prop' && /^(lamp_post|snow_lamp)$/.test(o.id)).map((o) => id + ':' + o.x + ',' + o.y));
  ok('街灯（lamp_post・snow_lamp）を置かない', street.length === 0, street);
  // 灯り（かがり火・溶岩の照り返し）は歩けないマス（崖・岩・溶岩）の上。道・戸口の前・出入り口に置かない
  const onWalk = [];
  for (const id of MY_MAPS.filter((q) => D.maps[q].kind !== 'interior')) {
    const m = D.maps[id];
    for (const o of (m.objects || []).filter((q) => q.type === 'prop' && /^(iron_brazier|lava_glow)$/.test(q.id))) {
      const c = R.MapUtil.cell(m, o.x, o.y);
      if (c && c.walk !== false && !c.solid) onWalk.push(`${id} ${o.id} ${o.x},${o.y}`);
    }
  }
  ok('町と火山の灯りは崖・岩・溶岩の上（歩けるマス・道の上に無い）', onWalk.length === 0, onWalk);
  // 町の小物は通り道をふさがない: 飾りの小物は下絵に描く。当たりのある物が歩けるマスに 1 つも無い（掲示板は闘技場の壁の上）
  const cal = D.maps.caldera;
  const clutter = (cal.objects || []).filter((o) => o.type === 'prop' && R.DB.props[o.id] && R.DB.props[o.id].solid).filter((o) => { const c = R.MapUtil.cell(cal, o.x, o.y); return c && c.walk !== false && !c.solid; });
  ok('カルデラの歩けるマスに当たりのある小物が無い', clutter.length === 0, clutter.map((o) => o.id + ' ' + o.x + ',' + o.y));
  // 飾りの小物は下絵に（オーナーの決まり 2026-09-28）: 下絵のマップのスプライトは働く物（宝箱・調べる物・灯り・掲示板・レバー）だけ
  const deco = [];
  for (const id of PAINTED) for (const o of (D.maps[id].objects || []).filter((q) => q.type === 'prop')) if (!/^(iron_brazier|lava_glow|board|lever)$/.test(o.id)) deco.push(`${id} ${o.id}`);
  ok('下絵のマップの物のスプライトは、働く物だけ（飾りは絵の中）', deco.length === 0, deco);
}

// ================================================================ 3
section('3. 文（声・A36・録音の文）');
{
  const ids = [...SRC.matchAll(/'(v_[a-z0-9_]+)'/g)].map((m) => m[1]);
  const known = fs.readFileSync(path.join(V2, 'design', 'voice_story_map.json'), 'utf8') + fs.readFileSync(path.join(V2, '..', 'design', 'voice', 'script.csv'), 'utf8');
  const unknown = ids.filter((id) => !known.includes(id));
  ok(`灰の荒野のイベントのボイス ${ids.length} 本は、声の担当の一覧にある id だけ`, unknown.length === 0, unknown);
  const names = Object.values(D.companions || {}).map((c) => c.name).filter((n) => n && n.length >= 2);
  const hits = names.filter((n) => SRC.includes(n) || MAP_SRC.includes(n));
  ok(`仲間 ${names.length} 人の名前を灰の荒野の文に出さない（A36）`, hits.length === 0, hits);
  const REC = ['燃え尽きることと、忘れられることは、違うわ。'];
  const flat = SRC.replace(/\\n/g, '');
  ok('録音済みの文（v_fine_ash_01）を 1 字も変えずに置く', REC.every((t) => flat.includes(t)));
}

// ================================================================ 4
section('4. 筋（閉包・大会・解決）');
{
  const P = require('./qa/progress');
  P.init(R);
  const slice0 = D.config.slice;
  D.config.slice = false;
  R.MapUtil.invalidate();
  for (const [bribe, write, restricted] of [['refuse', 'pain', false], ['accept', 'rebirth', false], ['refuse', 'rebirth', true]]) {
    const r = P.closure({ variant: { ch_forest_pim: 'send', ch_forest_fawn: 'heal', ch_forest_write: 'pain', ch_ash_bribe: bribe, ch_ash_write: write }, restricted });
    ok(`八百長=${bribe} 年代記=${write}${restricted ? '（寄り道・依頼なし）' : ''}: clearRegion('r_ash')`, !!(r.flags.cleared_r_ash && r.flags.ash_finale_done && r.flags.ash_reward_given), { champion: !!r.flags.ash_champion, beast: !!r.flags.ash_lavabeast, cleared: !!r.flags.cleared_r_ash });
  }
  D.config.slice = slice0;
  R.MapUtil.invalidate();
  ok('縦切りのあいだ（slice）は灰の荒野へ行けない（guard_ash が閉じたまま）', (() => { const q = P.closure({ variant: {} }); return !q.visited.has('caldera') && !q.visited.has('ash_volcano_1') && !q.visited.has('haimi_inn'); })());
  const w = D.maps.world;
  const g = (w.npcs || []).find((n) => n.id === 'guard_ash');
  ok('カシムの東の峠の番人 guard_ash（cond {slice:true}）と崖崩れの tilePatch', !!(g && g.cond && g.cond.slice === true) && (w.tilePatches || []).some((p) => p.cond && p.cond.slice === true && Math.abs(p.rect[0] - g.x) <= 4 && Math.abs(p.rect[1] - g.y) <= 4));
  // ワールドは拡大されることがある（worldv3: meta.xform）。L の座標（tools/gen_world_ash.js の PL）を W に写して見る
  const X = (w.meta && w.meta.xform && R.WorldXform) ? (lx, ly) => R.WorldXform.toW(w, lx, ly) : (lx, ly) => [lx, ly];
  ok('潮見橋が湿原の沼の道につながる（橋のマスは歩ける）', [113, 117, 121].every((y) => { const [wx, wy] = X(186, y); const c = R.MapUtil.cell(w, Math.round(wx), Math.round(wy)); return c && c.walk !== false && !c.solid; }));
}
function fakeEv(opts) {
  const G = R.Game;
  const said = [];
  const choose = opts.choose || [];
  const battles = opts.battles || [];
  const ev = {
    flag: (k) => !!G.flags[k], setFlag: (k, v) => { G.flags[k] = v === undefined ? true : v; }, var: (k) => G.vars[k] || 0,
    setVar: (k, v) => { G.vars[k] = v; return v; }, addVar: (k, n) => { G.vars[k] = (G.vars[k] || 0) + (n == null ? 1 : n); return G.vars[k]; },
    has: (id) => (G.items[id] || 0) > 0, item: (id, n) => { G.items[id] = (G.items[id] || 0) + (n || 1); }, take: (id, n) => { G.items[id] = Math.max(0, (G.items[id] || 0) - (n || 1)); },
    gold: (n) => { G.gold = Math.max(0, (G.gold || 0) + (n || 0)); }, lead: () => {}, leadDone: () => {}, lore: (id) => { G.flags[id] = true; }, choice: (k, v) => { G.choices[k] = v; }, choiceOf: (k) => G.choices[k],
    say: async (who, t) => { said.push([who, t]); }, caption: async (t) => { said.push(['caption', t]); }, choose: async (list) => { const v = choose.shift(); return typeof v === 'function' ? v(list) : v == null ? 0 : v; },
    fade: async () => {}, wait: async () => {}, warp: async (m, s) => { said.push(['warp', m + ':' + s]); }, sfx: () => {}, bgm: () => {}, mapBgm: () => {}, jingle: () => {}, leave: async () => {}, appear: async () => {},
    call: async (id, args) => D.events[id].run(ev, Object.assign({}, args || {})), letter: async () => {}, rest: () => { said.push(['rest']); }, inn: async () => true, shop: async () => {},
    battle: async (t) => { const r = battles.length ? battles.shift() : 'win'; said.push(['battle', t, r]); return r; }, clearRegion: async () => 1,
  };
  return { ev, said };
}
async function story() {
  const X = R.Ash.ev;
  R.State.newGame({ seed: 3 });
  const G = R.Game;
  // 出場 → 1 回戦を負け → もう一度 → 勝ち
  let f = fakeEv({ choose: [0] });
  await D.events.arena_reception.run(f.ev, {});
  ok('受付で出場（出場の札）', G.flags.ash_entered === true && (G.items.k_arena_token || 0) > 0);
  f = fakeEv({ choose: [0], battles: ['lose'] });
  await D.events.arena_reception.run(f.ev, {});
  ok('1 回戦に負けると控え室で全快し、同じ回からやり直せる', X.round(f.ev) === 0 && G.vars.ash_losses === 1 && f.said.some((s) => s[0] === 'rest') && f.said.some((s) => s[0] === 'battle' && s[1] === 'tr_ash_r1'));
  for (let n = 1; n <= 4; n++) { f = fakeEv({ choose: [0] }); await D.events.arena_reception.run(f.ev, {}); }
  ok('1〜4 回戦を勝ち抜く（相手の組が回ごとに違う）', G.vars.ash_round === 4 && G.vars.ash_bout === 0);
  f = fakeEv({ choose: [0] });
  await D.events.arena_reception.run(f.ev, {});
  ok('決勝は、宿で休む（前夜）まで出られない', G.vars.ash_round === 4 && !f.said.some((s) => s[0] === 'battle'));
  f = fakeEv({ choose: [0, 1] });
  await D.events.caldera_inn_keeper.run(f.ev, {});
  ok('4 回戦のあと宿で休むと、決勝の前夜の使い（受けた）', G.flags.ash_eve_done === true && G.choices.ch_ash_bribe === 'accept' && f.said.some((s) => /明後日の夜明け前/.test(String(s[1]))));
  f = fakeEv({ choose: [0] });
  await D.events.arena_reception.run(f.ev, {});
  ok('決勝ザクロ → 優勝（岩戸が開く）。一度負けたので無敗ではない', G.flags.ash_champion === true && !G.flags.ash_unbeaten && f.said.some((s) => s[0] === 'battle' && s[1] === 'tr_b_zakuro'));
  // 受けた: 写し手を止める
  f = fakeEv({});
  await D.events.volcano_copyists.run(f.ev, {});
  ok('受けた: 刻限を知っていて、写し手を止める（壁画 3 は白くならない）', G.flags.ash_copy_stopped === true && !G.flags.ash_mural_blank && f.said.some((s) => s[0] === 'battle' && s[1] === 'tr_ash_copyists'));
  // 断った場合: もう白くされている
  R.State.newGame({ seed: 4 });
  R.Game.flags.ash_champion = true; R.Game.choices.ch_ash_bribe = 'refuse';
  f = fakeEv({});
  await D.events.volcano_copyists.run(f.ev, {});
  ok('断った: 着いたときには壁画 3 の後半が白い', R.Game.flags.ash_mural_blank === true && !R.Game.flags.ash_copy_stopped);
  // 溶岩の堰: 引くたびに流れが入れ替わる（2 通りの tilePatches）
  const v1 = D.maps.ash_volcano_1;
  const open = (i) => !R.State.check(v1.tilePatches[i].cond);   // tilePatch は流れている方を溶岩にする
  const a0 = open(0) && !open(1);
  f = fakeEv({ choose: [0] }); await D.events.volcano_sluice.run(f.ev, {});
  const a1 = !open(0) && open(1);
  f = fakeEv({ choose: [0] }); await D.events.volcano_sluice.run(f.ev, {});
  ok('溶岩の堰: はじめは西の渡り場、引くと北の渡り場、もう一度で西へ戻る', a0 && a1 && open(0) && !open(1));
  // 壁画: 3 つ目で岩戸（階段の cond）が開く
  const stairs = (v1.objects || []).find((o) => o.type === 'stairs');
  const muralAt = (n) => (v1.objects || []).find((o) => o.type === 'examine' && o.event === 'volcano_mural' && o.mural === n);
  for (const n of [2, 1]) { f = fakeEv({}); await D.events.volcano_mural.run(f.ev, { x: muralAt(n).x, y: muralAt(n).y }); }
  const before = R.State.check(stairs.cond);
  f = fakeEv({}); await D.events.volcano_mural.run(f.ev, { x: muralAt(3).x, y: muralAt(3).y });
  ok('壁画は好きな順。3 つ目で火口への岩戸が開く（白くされた壁画も数える）', !before && R.State.check(stairs.cond) && f.said.some((s) => /白く塗りこめられて/.test(String(s[1]))));
  // 卵に語る: 白い壁画の行は短い → 締め → 断った = 闘士の帯
  R.Game.flags.ash_lavabeast = true;
  f = fakeEv({ choose: [1] });
  await D.events.crater_egg.run(f.ev, {});
  ok('卵に語る（白くされた壁画は一行短い）→ 締め → 年代記（痛み）で歌い手の席', R.Game.flags.ash_egg && R.Game.flags.ash_finale_done && R.Game.choices.ch_ash_write === 'pain' && R.Game.flags.ash_singer_board && f.said.some((s) => s[1] === X.TELL_BLANK));
  ok('断った: 族長から闘士の帯', (R.Game.items.u_champion_belt || 0) > 0 && !(R.Game.items.u_mural_ember || 0));
  R.State.newGame({ seed: 5 });
  R.Game.flags.ash_finale_done = true; R.Game.choices.ch_ash_bribe = 'accept';
  f = fakeEv({});
  await D.events.ash_reward.run(f.ev, {});
  ok('受けた: カヤから壁画の残り火（同じ強さの別の品）', (R.Game.items.u_mural_ember || 0) > 0 && !(R.Game.items.u_champion_belt || 0));
  // 無敗: 一度も負けずに優勝
  R.State.newGame({ seed: 6 });
  R.Game.flags.ash_entered = true; R.Game.vars.ash_round = 4; R.Game.flags.ash_eve_done = true; R.Game.choices.ch_ash_bribe = 'refuse';
  f = fakeEv({ choose: [0] });
  await D.events.arena_reception.run(f.ev, {});
  ok('一度も負けずに優勝すると「無敗の語り部」', R.Game.flags.ash_champion && R.Game.flags.ash_unbeaten);
}
function clearing() {
  R.State.newGame({ seed: 7 });
  const G = R.Game;
  G.tier = 1;
  const cel = R.Tier.celebrate;
  R.Tier.celebrate = async () => {};
  let t = null;
  return R.Events._clearRegion('r_ash').then((v) => { t = v; }).then(() => {
    R.Tier.celebrate = cel;
    ok('clearRegion: ティア 1 → 2、pendingTier、cleared_r_ash', t === 2 && G.pendingTier === 2 && G.flags.cleared_r_ash === true, { t, pending: G.pendingTier });
    const page = R.Tier.regionInfo('r_ash').pageId;
    ok('clearRegion: ページ（灰のページ）を持つ', page === 'k_page_ash' && (G.items[page] || 0) > 0, page);
  });
}

// ================================================================ 5
function battle() {
  section('5. 戦闘（予告・出現表・落とし物）');
  const A = D.bossActions;
  for (const id of ['eb_tamer_whistle', 'eb_sumi_chant', 'eb_barga_raise', 'eb_zakuro_stance', 'eb_hound_inhale', 'eb_beast_swell']) ok(`${id} は予告（telegraph → next、守る）`, !!(A[id] && A[id].telegraph && A[A[id].telegraph.next] && A[id].telegraph.guard === 'defend'));
  ok('獣使い・姉ヒノエが群れの頭（倒れると残りが降りる）', !!D.monsters.b_tamer.leader && !!D.monsters.b_sister_elder.leader);
  ok('ザクロ: 第 2 の姿（hpBelow 0.5）と予告', !!(D.monsters.b_zakuro.phases || []).length && D.monsters.b_zakuro.actions.some((a) => a.id === 'eb_zakuro_stance'));
  ok('溶岩の巨獣: 第 2 の姿と予告', !!(D.monsters.b_lavabeast.phases || []).length && D.monsters.b_lavabeast.actions.some((a) => a.id === 'eb_beast_swell'));
  ok('盗み専用: 溶岩の巨獣 ac_st_lavabeast は盗みだけ（イベントで渡さない）', !!(D.items.ac_st_lavabeast && D.items.ac_st_lavabeast.stealOnly) && !SRC.includes('ac_st_lavabeast'));
  const zones = ['zw_ash_plain', 'zw_ash_road', 'zw_ash_spa', 'zw_ash_beach', 'z_ash_volcano', 'z_ash_crater'];
  ok('出現表 6 つ（原・街道・湯の郷・浜・火山・火口）', zones.every((z) => D.encounters[z] && D.encounters[z].region === 'r_ash'));
  const big = [];
  for (const z of zones) for (const g of D.encounters[z].groups) { const n = g.mons.reduce((a, m) => a + m[2], 0); if (n > 5) big.push(`${z} ${n}`); }
  ok('1 組は 5 匹まで（縦切りの後のダンジョンは 4〜5 匹の組もある）', big.length === 0 && D.encounters.z_ash_crater.groups.some((g) => g.mons.reduce((a, m) => a + m[2], 0) >= 4), big);
  ok('町とダンジョンの出現表が実在（マップの zones）', MY_MAPS.every((id) => (D.maps[id].zones || []).every((z) => !z.zone || D.encounters[z.zone])));
  const early = Object.entries(D.monsters).filter(([id]) => /^(salamander|imp|gargoyle|orc|chimera)_[12]$/.test(id) || /^ash_/.test(id));
  const gear = early.filter(([, m]) => m.drops && m.drops.rare && D.items[m.drops.rare.item] && D.items[m.drops.rare.item].slot !== 'use');
  ok(`灰の雑魚の段 1〜2 と大会の相手（${early.length} 種）のレアの落とし物は道具`, gear.length === 0, gear.map(([id]) => id));
  ok('闘士の帯・壁画の残り火はレアの率・落とす率を上げない（灰は T1 から）', ['u_champion_belt', 'u_mural_ember'].every((id) => { const m = D.items[id].mods || {}; return !m.rarePct && !m.dropPct; }));
  done('test_content_ash');
}

story().then(clearing).then(battle).catch((e) => { console.error(e); process.exit(1); });
