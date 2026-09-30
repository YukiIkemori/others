#!/usr/bin/env node
// 終盤とエンディング（final_*.js・screens/ending.js）のテスト（node）。STORY_BIBLE §4.3 の灯の数 8・§5・§6・§7.9・§9.3〜§9.6・§11
//   node v2/tools/test_content_final.js
//   1 形: マップ・イベント・手がかり・読み物・手紙・場所・店が契約どおり、参照（人・物・範囲のイベント、行き先のマップと spawn）がそろう。
//        ビブリアと大書庫 1〜6 階は 1 枚の下絵（絵のファイルがあり、大きさがマップと同じ）。戦闘背景 library がある
//   2 置き場所: spawn・宝箱・泉・調べる物が歩ける所（調べる物は歩ける所から向ける所）、階段の行き先と戻りがそろう、泉は 1・3・4・5・6 階
//   3 文: ボイスは script.csv の行を 1 字も変えずに 1 回ずつ（v_berna_prologue_01 の流し直しだけは定数）、仲間 20 人の名前を出さない（A36）、主人公はしゃべらない
//   4 筋: 閉包で T8 → 終盤のロア → ビブリア → 大書庫 → エンディング（game_clear）。終盤のマップにすべて入る。体験版（slice）では終盤へ行けない
//   5 戦闘: 終盤のボスの編成（ティア 8）・ラザロのためらい（setup.hesitate）
//   6 エンディング: 地方のカード（§7.9。解決した順 8 枚＋ファロス）・朗読の章・クレジット（仲間は「旅の仲間たち」の一行だけ）・朝の写し・クリアの記録
'use strict';
const fs = require('fs');
const path = require('path');
const { inline: i18nInline } = require('./lib/i18n_src');
const { ok, section, done } = require('./lib/testkit');

const R = require('./lib/load')({ quiet: true });
const D = R.DB;
const V2 = path.resolve(__dirname, '..');
const CHRON = path.resolve(V2, '..');
const MY_MAPS = Object.keys(D.maps).filter((id) => D.maps[id].region === 'finale');
const EV_FILES = fs.readdirSync(path.join(V2, 'src', 'events')).filter((f) => /^final_/.test(f));
const SRC = i18nInline(EV_FILES.map((f) => fs.readFileSync(path.join(V2, 'src', 'events', f), 'utf8')).join('\n'));
const MAP_SRC = i18nInline(fs.readdirSync(path.join(V2, 'src', 'maps')).filter((f) => /^final_/.test(f)).map((f) => fs.readFileSync(path.join(V2, 'src', 'maps', f), 'utf8')).join('\n'));
const SCREEN_SRC = i18nInline(fs.readFileSync(path.join(V2, 'src', 'screens', 'ending.js'), 'utf8'));
const PAINTED = ['biblia', 'archive_1', 'archive_2', 'archive_3', 'archive_4', 'archive_5', 'archive_6'];
const DAWN = ['biblia_dawn', 'roa_dawn', 'roa_house_dawn'];
const F = R.Field;

// ================================================================ 1
section('1. 形と参照');
ok('R.loadErrors 0', R.loadErrors.length === 0, R.loadErrors);
ok(`終盤のマップ ${MY_MAPS.length} 枚（町 1・屋内 8・大書庫 6・朝の写し 3）`, MY_MAPS.length >= 18 && PAINTED.concat(DAWN).every((id) => MY_MAPS.includes(id)), MY_MAPS);
for (const id of MY_MAPS) {
  const r = R.Contract.check('map', D.maps[id]);
  if (!r.ok) ok(`map ${id} が K.map`, false, r.errors);
}
const myEvents = [...SRC.matchAll(/\bE\('([a-z0-9_]+)'/g)].map((m) => m[1]);
ok(`終盤のイベント ${myEvents.length} 本が R.DB.events にある`, myEvents.length >= 50 && myEvents.every((id) => D.events[id]), myEvents.filter((id) => !D.events[id]));
{
  const bad = myEvents.filter((id) => !R.Contract.check('event', D.events[id]).ok);
  ok('終盤のイベントが K.event', bad.length === 0, bad);
  const miss = [];
  for (const id of MY_MAPS.concat(['roa', 'pharos'])) {
    const m = D.maps[id];
    for (const o of m.objects || []) if (o.event && !D.events[o.event]) miss.push(`${id} obj ${o.event}`);
    for (const n of m.npcs || []) if (typeof n.talk === 'string' && !D.events[n.talk]) miss.push(`${id} npc ${n.id} → ${n.talk}`);
    for (const t of m.triggers || []) if (!D.events[t.event]) miss.push(`${id} trigger ${t.event}`);
    const tos = (m.exits || []).map((e) => e.to).concat((m.objects || []).map((o) => o.to || (o.door && o.door.to)).filter(Boolean));
    for (const to of tos) if (!D.maps[to.map] || !(D.maps[to.map].spawns || {})[to.spawn]) miss.push(`${id} → ${to.map}:${to.spawn}`);
  }
  ok('マップの人・物・範囲のイベントと行き先（マップ・spawn）がすべてある', miss.length === 0, miss);
  const warps = [...SRC.matchAll(/ev\.warp\('([a-z0-9_]+)', '([a-z0-9_]+)'\)/g)].filter((m) => !(D.maps[m[1]] && D.maps[m[1]].spawns[m[2]])).map((m) => m[1] + ':' + m[2]);
  ok('ev.warp の行き先がある', warps.length === 0, warps);
  const ALL = new Set(MY_MAPS.concat(['roa', 'pharos', 'roa_house']).flatMap((id) => (D.maps[id].npcs || []).map((n) => n.id)));
  const ADHOC = new Set(['fine', 'king', 'nemrea', 'gatewoman2']);   // 声だけの話し手（T8 のフィーネ・王・ネムレア）・ロアの門のおかみ（序章の人）
  const lost = [];
  for (const m of SRC.matchAll(/ev\.(?:appear|leave|say|npc)\(\[?'([a-z0-9_]+)'/g)) if (!ADHOC.has(m[1]) && !ALL.has(m[1])) lost.push(m[1]);
  for (const m of SRC.matchAll(/ev\.appear\(\[([^\]]+)\]/g)) for (const q of m[1].matchAll(/'([a-z0-9_]+)'/g)) if (!ALL.has(q[1])) lost.push(q[1]);
  ok('話す人・appear・leave・npc() の人がマップにいる', lost.length === 0, [...new Set(lost)]);
}
{
  const leads = ['l_main_margin_8', 'l_main_final_roa', 'l_main_final_ferry', 'l_main_final_archive', 'l_main_margin_noa', 'l_main_margin_study', 'l_post_oblivion'];
  ok('手がかり（T8 の余白・ロアへ・船・大書庫・ノアの歌・書斎・忘却の底）が K.lead', leads.every((id) => D.leads[id] && R.Contract.check('lead', D.leads[id]).ok), leads.filter((id) => !D.leads[id] || !R.Contract.check('lead', D.leads[id]).ok));
  const lore = ['lo_mira_portrait', 'lo_mira_dawnword', 'lo_arena_record', 'lo_east_letter', 'lo_three_shades', 'lo_berna_confession'];
  ok('読み物（§10.2 の終盤の読み物・ベルナの封書）が K.lore', lore.every((id) => D.lore[id] && R.Contract.check('lore', D.lore[id]).ok), lore.filter((id) => !D.lore[id]));
  const letters = R.Final.ev.CONFESSION || [];
  ok('ベルナの封書（§10.4）は 4 枚の手紙の札。{hero} は開くときに名前になる', letters.length === 4 && letters.every((id) => D.letters[id] && R.Contract.check('letter', D.letters[id]).ok) &&
    /^\{hero\}|^[^{]/.test([].concat(D.letters[letters[0]].text)[0]), letters);
  ok('ラザロの手紙 lo_lz_1〜8 が書斎の箱で読める（letter_lz_n がある）', [1, 2, 3, 4, 5, 6, 7, 8].every((n) => D.lore['lo_lz_' + n] && D.letters['letter_lz_' + n]));
  ok('場所 biblia・archive（終盤。体験版のワープの一覧から外れる）', ['biblia', 'archive'].every((id) => D.locations[id] && D.locations[id].region === 'finale' && D.maps[D.locations[id].map].spawns[D.locations[id].spawn]));
  ok('店 shop_biblia・shop_biblia_arms（品がそろう）', ['shop_biblia', 'shop_biblia_arms'].every((id) => D.shops[id] && R.Contract.check('shop', D.shops[id]).ok && D.shops[id].items.length && D.shops[id].items.every((it) => D.items[it])));
  ok('終章の年代記 finale（ラザロの章の選択 2 通り）', !!(D.chronicle.finale && D.chronicle.finale.parts.filter((p) => p.cond && p.cond.choice === 'ch_lazaro_write').length === 2));
}
{
  const miss = [];
  for (const id of PAINTED.concat(['biblia_dawn', 'roa_dawn'])) {
    const a = D.maps[id].art;
    if (!a || !a.image) { miss.push(id + ' no art'); continue; }
    const f = path.join(V2, 'assets', 'env', a.image + '@32.png');
    if (!fs.existsSync(f)) { miss.push(id + ' no file ' + a.image); continue; }
    const b = fs.readFileSync(f);
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
    if (w !== D.maps[id].w * 32 || h !== D.maps[id].h * 32) miss.push(`${id} size ${w}x${h} ≠ ${D.maps[id].w * 32}x${D.maps[id].h * 32}`);
  }
  ok('ビブリアと大書庫 1〜6 階・朝の写し（町と里）は 1 枚の下絵（@32 の大きさがマップと同じ）', miss.length === 0, miss);
  const bb = path.join(V2, 'assets', 'env', 'bbg', 'library');
  ok('戦闘背景 library（描いた絵の層 back・ground・post と _tall）', ['back', 'ground', 'post', 'back_tall', 'ground_tall', 'post_tall'].every((n) => fs.existsSync(path.join(bb, n + '.png'))) && fs.existsSync(path.join(bb, 'library.json')));
  ok('戦闘背景 library が BEAST に登録されている（hd:bbg:library）', (R.Beast && R.Beast.BBG_IDS || []).includes('library'), R.Beast && R.Beast.BBG_IDS);
  // PNG の付随チャンク（IHDR/PLTE/IDAT/IEND/tRNS/gAMA/sRGB/iCCP/pHYs だけ）
  const OKC = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'sRGB', 'iCCP', 'pHYs']);
  const files = fs.readdirSync(path.join(V2, 'assets', 'env', 'finale', 'under')).filter((f) => f.endsWith('.png')).map((f) => path.join(V2, 'assets', 'env', 'finale', 'under', f))
    .concat(fs.readdirSync(bb).filter((f) => f.endsWith('.png')).map((f) => path.join(bb, f)));
  const extra = [];
  for (const f of files) {
    const b = fs.readFileSync(f);
    for (let i = 8; i < b.length;) { const n = b.readUInt32BE(i), t = b.toString('latin1', i + 4, i + 8); if (!OKC.has(t)) { extra.push(path.basename(f) + ':' + t); break; } i += 12 + n; }
  }
  ok(`描いた絵の PNG ${files.length} 枚に付随チャンク（来歴・文字）が無い`, extra.length === 0, extra);
}

// ================================================================ 2
section('2. 置き場所');
{
  const bad = [];
  const walk = (m, x, y) => F._walkable(m, x, y, null, 0);
  const near = (m, x, y) => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => walk(m, x + dx, y + dy));
  for (const id of MY_MAPS) {
    const m = D.maps[id];
    for (const [k, s] of Object.entries(m.spawns || {})) if (!walk(m, s.x, s.y)) bad.push(`${id} spawn ${k} (${s.x},${s.y})`);
    for (const o of m.objects || []) {
      if (o.type === 'chest' && !near(m, o.x, o.y)) bad.push(`${id} chest ${o.id} (${o.x},${o.y}) は届かない`);
      if (o.type === 'chest' && m.rows[o.y] && /[X~rT]/.test([...m.rows[o.y]][o.x])) bad.push(`${id} chest ${o.id} が壁・書架の上`);
      if (o.type === 'spring') for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (/[X~r]/.test([...m.rows[o.y + dy]][o.x + dx])) bad.push(`${id} spring ${o.id} が壁の上`);
      if (o.type === 'examine' && !walk(m, o.x, o.y) && !near(m, o.x, o.y) && !(m.tilePatches || []).length) bad.push(`${id} exam ${o.event} (${o.x},${o.y}) は向けない`);
    }
    for (const n of m.npcs || []) if (!DAWN.includes(id) && m.rows[n.y] && /[X~rTw]/.test([...m.rows[n.y]][n.x])) bad.push(`${id} npc ${n.id} (${n.x},${n.y}) が壁の上`);
  }
  ok('spawn・宝箱・泉・調べる物・人が歩ける所（向ける所）', bad.length === 0, bad);
  // 大書庫の階段: 行き先の spawn がその階の戻りの階段の近く
  const pairs = [['archive_1', 'archive_2'], ['archive_2', 'archive_3'], ['archive_3', 'archive_4'], ['archive_4', 'archive_5'], ['archive_5', 'archive_6']];
  const miss = [];
  for (const [a, b] of pairs) {
    const up = (D.maps[a].objects || []).filter((o) => o.type === 'stairs' && o.to.map === b);
    const down = (D.maps[b].objects || []).filter((o) => o.type === 'stairs' && o.to.map === a);
    if (!up.length || !down.length) { miss.push(`${a} ↔ ${b}`); continue; }
    const s1 = D.maps[b].spawns[up[0].to.spawn], s2 = D.maps[a].spawns[down[0].to.spawn];
    if (!down.some((o) => Math.abs(o.x - s1.x) + Math.abs(o.y - s1.y) <= 3)) miss.push(`${b}.${up[0].to.spawn} は下りの階段のそばでない`);
    if (!up.some((o) => Math.abs(o.x - s2.x) + Math.abs(o.y - s2.y) <= 3)) miss.push(`${a}.${down[0].to.spawn} は上りの階段のそばでない`);
  }
  ok('大書庫の階段: 1〜6 階の上りと下りがそろい、着く所が戻りの階段のそば', miss.length === 0, miss);
  const springs = PAINTED.filter((id) => (D.maps[id].objects || []).some((o) => o.type === 'spring'));
  ok('泉は大書庫の 1・3・4・5・6 階（2 階と町には無い。WORLD §6.4「1・2・4 階に足す／今の 3 か所」を今の階の並びで）', JSON.stringify(springs) === JSON.stringify(['archive_1', 'archive_3', 'archive_4', 'archive_5', 'archive_6']), springs);
  ok('大書庫の出現表（1〜3 階 z_finale_archive_lo・4〜5 階 _hi・6 階なし）', ['archive_1', 'archive_2', 'archive_3'].every((id) => D.maps[id].zones[0].zone === 'z_finale_archive_lo') &&
    ['archive_4', 'archive_5'].every((id) => D.maps[id].zones[0].zone === 'z_finale_archive_hi') && !D.maps.archive_6.zones.length && D.encounters.z_finale_archive_lo && D.encounters.z_finale_archive_hi);
  ok('封印の扉（3 階）とラザロの後の白い紙（5 階）は tilePatch で閉じる', (D.maps.archive_3.tilePatches || []).some((p) => p.cond === '!final_rowell') && (D.maps.archive_5.tilePatches || []).some((p) => p.cond === '!final_lazaro'));
}

// ================================================================ 3
section('3. 文（ボイス・仲間・主人公）');
{
  const rows = fs.readFileSync(path.join(CHRON, 'design', 'voice', 'script.csv'), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const head = rows.shift().split(',');
  const ii = head.indexOf('id');
  const ids = new Set(rows.map((r) => r.split(',')[ii]));
  const used = [...SRC.matchAll(/voice:\s*'(v_[a-z0-9_]+)'/g)].map((m) => m[1]);
  const unknown = used.filter((id) => !ids.has(id));
  ok(`終盤のボイス ${used.length} 本はどれも script.csv の録音済みの行`, used.length >= 55 && unknown.length === 0, unknown);
  const dup = used.filter((id, i) => used.indexOf(id) !== i);
  ok('どのボイスも 1 回だけ', dup.length === 0, dup);
  ok('v_berna_prologue_01 はエンディングで定数から流し直す（ev.say の 1 回は序章のまま）', !used.includes('v_berna_prologue_01') && /FIRST_MORNING = 'v_berna_prologue_01'/.test(SRC));
  const names = Object.values(D.companions || {}).map((c) => c && c.name).filter((n) => n && n.length >= 2);
  const all = SRC + MAP_SRC + SCREEN_SRC;
  const hit = names.filter((n) => new RegExp(`['「\\n　]${n}[「」、。！？\\n　']`).test(all));
  ok(`仲間 ${names.length} 人の名前を終盤の文に出さない（A36）`, names.length >= 18 && hit.length === 0, hit);
  ok('主人公はしゃべらない（ev.say(\'hero\' が無い）', !/ev\.say\('hero'/.test(SRC));
}

// ================================================================ 4
section('4. 筋（閉包）と体験版の錠');
{
  const P = require('./qa/progress');
  P.init(R);
  const SL = R.DB.config.slice;
  R.DB.config.slice = false; R.MapUtil.invalidate();
  const v = { ch_forest_pim: 'send', ch_forest_fawn: 'heal', ch_snow_tale: 'dragon', ch_desert_hawk: 'water', ch_desert_route: 'long', ch_marsh_accuse: 'first',
    ch_ash_bribe: 'refuse', ch_isles_wreck: 'help', ch_mine_side: 'accord', ch_star_order: 'public', ch_star_way: 'sneak', ch_lazaro_write: 'sin' };
  for (const rs of ['forest', 'desert', 'snow', 'marsh', 'isles', 'mine', 'ash', 'star']) v['ch_' + rs + '_write'] = 'pain';
  const r = P.closure({ variant: v });
  const need = ['story_t8', 'final_roa', 'final_open', 'final_sailed', 'final_arrived', 'final_golem', 'final_rowell', 'final_shades', 'final_lazaro', 'final_nemrea1', 'game_clear'];
  ok('閉包: T8 → 終盤のロア → 船 → ビブリア → 本の巨人 → 封印の扉 → 三つの影 → ラザロ → 虚ろの王 → エンディング', need.every((f) => r.flags[f]), need.filter((f) => !r.flags[f]));
  const unv = MY_MAPS.filter((id) => !r.visited.has(id));
  ok('閉包で終盤のマップにすべて入る', unv.length === 0, unv);
  R.DB.config.slice = SL; R.MapUtil.invalidate();
  const d = P.closure({ variant: v });
  const leak = MY_MAPS.filter((id) => d.visited.has(id));
  ok('体験版（slice）の閉包は終盤に入らず、T8 も起きない', leak.length === 0 && !d.flags.story_t8, { leak, t8: !!d.flags.story_t8 });
  ok('体験版では終盤のマップが閉じている（R.DemoGate.isOpen が偽）', MY_MAPS.every((id) => !R.DemoGate.isOpen(id)));
  ok('体験版の錠に終盤は入っていない（sliceOpen）', !(R.DB.config.sliceOpen || []).includes('finale'));
}

// ================================================================ 5
section('5. 戦闘');
{
  const T = D.troops;
  const need = ['tr_b_bookgolem', 'tr_b_heroshades', 'tr_b_lazaro', 'tr_b_nemrea1', 'tr_b_nemrea2'];
  ok('終盤のボスの編成がある（ティア 8）', need.every((t) => T[t] && R.Contract.check('troop', T[t]).ok && T[t].tier === 8), need.filter((t) => !T[t]));
  ok('終盤のボスの編成はイベントから 1 回ずつ', need.every((t) => (SRC.match(new RegExp(`battle\\('${t}'`, 'g')) || []).length === 1));
  ok('虚ろの王（第 1・第 2 形態）は逃げられない', /battle\('tr_b_nemrea1', \{[^}]*noEscape: true/.test(SRC) && /battle\('tr_b_nemrea2', \{[^}]*noEscape: true/.test(SRC));
  const core = fs.readFileSync(path.join(V2, 'src', 'systems', 'battle_core.js'), 'utf8');
  ok('ラザロのためらい（痛み 6 以上）: setup.hesitate を戦闘が読む（最初の手番だけ何もしない）', /hesitate: setup\.hesitate/.test(core) && /this\.o\.hesitate/.test(core) && /hesitate: pained \?/.test(SRC));
}

// ================================================================ 6
section('6. エンディング');
{
  const X = R.Final.ev;
  ok('R.Ending: titlePage・reading・cards・credits・fin・glow', ['titlePage', 'reading', 'cards', 'credits', 'fin', 'glow'].every((k) => typeof R.Ending[k] === 'function'));
  // 8 地方を解いた状態（解いた順 = 章の並び）で、カード・朗読の章
  const G = R.State.newGame({ seed: 3 }) || R.Game;
  const order = ['r_star', 'r_forest', 'r_ash', 'r_isles', 'r_mine', 'r_marsh', 'r_snow', 'r_desert'];
  R.Game.chronicle = { chapters: order.map((id) => ({ id, summaryKey: id })) };
  for (const rid of order) { R.Game.cleared[rid] = true; R.Game.flags['cleared_' + rid] = true; }
  Object.assign(R.Game.choices, { ch_forest_write: 'pain', ch_desert_write: 'legend', ch_snow_write: 'glory', ch_snow_tale: 'dragon', ch_mine_side: 'smiths', ch_isles_wreck: 'help' });
  const cards = X.endingCards();
  ok('地方のカード: 解いた順の 8 枚＋ファロス（タデオ）', cards.length === 9 && cards[0].name === D.regions.r_star.name && cards[8].name.length > 0, cards.map((c) => c.name));
  ok('カードの文が選択で変わる（森は痛み・砂漠は伝説・鉱山は鍛冶衆）', /ゴード/.test(cards[1].text) && /ナディア/.test(cards[7].text) && /ヘルガ/.test(cards[4].text), cards.map((c) => c.text.split('\n')[1]));
  const miss = cards.filter((c) => !fs.existsSync(path.join(V2, 'assets', 'env', c.image + '@24.png')));
  ok('カードの絵（町の下絵 @24）がある', miss.length === 0, miss.map((c) => c.image));
  const rd = X.endingReading();
  ok('朗読の章 8（章の題と、最初の一文）', rd.length === 8 && rd.every((c) => c.title && c.text), rd.map((c) => c.title));
  const rows = R.Ending.creditRows();
  const txt = rows.map((r) => r[1]).join('\n');
  ok('クレジット: キャストは主人公と物語の人物、仲間は「旅の仲間たち」の一行、企画・制作 Studio Metem', /旅の仲間たち/.test(txt) && /Studio Metem/.test(txt) && /ベルナ/.test(txt));
  const ev = D.events.final_ending;
  const wv = [].concat(ev.meta.warp || []).map((w) => w.to);
  ok('エンディングの朝の写し（biblia_dawn・roa_dawn・roa_house_dawn）へ着く（meta.warp）', DAWN.every((id) => wv.includes(id)));
  ok('朝の写しは光だけ朝（明るさ k ≥ 0.9）で、出口と人の話は無い', DAWN.every((id) => D.maps[id].light.k >= 0.9 && !(D.maps[id].exits || []).length && !(D.maps[id].triggers || []).length));
  ok('クリアの記録: game_clear・つづきはロアの里（G.pos）・札に「クリア」', /G\.pos = \{ map: 'roa'/.test(SRC) && /card\.clear = true/.test(fs.readFileSync(path.join(V2, 'src', 'core', 'save.js'), 'utf8')));
  ok('題の一行は「夜があって、朝が来た。」（§9.4 の E3）', X.TITLE_LINE === '夜があって、朝が来た。');
  void G;
}

done('test_content_final');
