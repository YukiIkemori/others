#!/usr/bin/env node
// 術の強さ・知力の効き・MP の量のシミュレーター（担当 A8。DESIGN §7.12.1・§12.3 の P1〜P11）。
//
//   node tools/sim_spells.js [--seed 1] [--battles 400] [--rules auto|shim|real] [--engine auto|model|real] [--json out.json] [-q]
//
// P1〜P7・P10 は §4 の式（R.Rules.K・R.Mon.curve の値）と術のデータ（R.DB.actions の s_）から計算する。
// P8・P9・P11 は戦闘が要る。新しい戦闘エンジン（R.Battle.simulate が R.Glimmer を呼ぶもの）があれば
// tools/lib/party_model.js の runBattle（本物のオート）で数え、まだ無ければこのファイルの小さな戦闘モデル
// （§4.13.2 のオートの MP の使い方・§4.14 の魔物・§4.12.1 の戦闘後の回復）で数える。どちらを使ったかを出力の先頭に書く。
'use strict';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const SEED = +opt('seed', 1), BATTLES = +opt('battles', 400), QUIET = args.includes('-q');
const H = require('./fixtures/spells/lib/harness')({ rules: opt('rules', 'auto') });
const R = H.R, DB = R.DB, U = R.U, G = R.Glimmer;
const PM = require('./lib/party_model');
const t0 = Date.now();
const log = (...a) => { if (!QUIET) console.log(...a); };
const results = [];
function crit(id, label, value, ok, detail) {
  results.push({ id, label, value, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(4)} ${label}: ${value}${detail ? '  (' + detail + ')' : ''}`);
}
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1), f2 = (x) => x.toFixed(2), pc = (x) => Math.round(x * 100) + '%';

// ---------------------------------------------------------------- 定数と式（§4.3・§4.6・§4.14）
const K = PM.K(R);
const W = (T) => K.W[T], UU = (T) => K.U[T], LZ = (T) => 6 + 6 * T;
const DK = (L) => (R.Rules.dk ? R.Rules.dk(L) : 40 + 5 * L);
const curve = (L) => (R.Mon && R.Mon.curve ? R.Mon.curve(L) : {
  hp: 6 + 2.6 * L + 0.1 * L * L, atk: 4 + 3.15 * Math.pow(Math.max(0, L - 1), 0.9), def: 20 + 2.5 * L, mdef: 20 + 2.5 * L, agi: 24 + 0.6 * L,
});
const STAGE = K.STAGE || [0.63, 0.77, 1, 1.3, 1.6];
const BOSS = (K.BOSS && K.BOSS.region) || { lvOff: 3, hpMul: 18, atk: 1.5, mag: 1.4, def: 1.2, agi: 1.2 };
const MOB = K.MOB || { atk: 0.6, mag: 0.6 };
const SLOT_UNITS = [2, 2, 1, 1, 2, 1, 1, 1, 1];               // 武器1・武器2・盾・頭・体・手・足・アクセ×2（12 単位。§4.3.3）
const gearStat = (T, grade) => SLOT_UNITS.reduce((s, u) => s + Math.max(1, Math.round(u * UU(T))) * ({ normal: 1, rare: 2, super: 3 })[grade], 0);
// §4.3.7 の術師: 知力 52、同じ T の杖（mag = W(T)）。Z = 知力の装備なし、N = 全身を通常品、S = 全身を超レア
const INT0 = 52;
const intOf = (T, g) => INT0 + (g === 'Z' ? 0 : gearStat(T, g === 'N' ? 'normal' : g === 'R' ? 'rare' : 'super'));
const magOf = (T, g) => Math.round(W(T) * (64 + intOf(T, g)) / 64);
const atkOf = (T, g, str) => Math.round(W(T) * (64 + str + (g === 'Z' ? 0 : gearStat(T, g === 'N' ? 'normal' : 'super'))) / 64);
function spOf(a) {  // 1 体に当たる SP の合計（多段は合計。random は全部が 1 体に当たったとき）
  let s = 0;
  for (const e of a.effects) if (e.type === 'damage' && e.formula === 'magic') s += e.power * (e.hits || 1);
  return s;
}
const dmgEff = (a) => a.effects.find((e) => e.type === 'damage' && e.formula === 'magic');
/** §4.6.2 の術のダメージ（期待値。rand を渡せば 1 回分） */
function magicDamage(mag, a, o) {
  o = o || {};
  const L = o.Lb, dk = DK(L), mdef = o.mdef != null ? o.mdef : dk / 2;
  const e = dmgEff(a) || {};
  let d = mag * spOf(a) * dk / (dk + mdef * (1 - (e.ignoreMdef || 0)));
  d *= o.elem != null ? o.elem : 1;
  d *= 1 + (o.elemBoost || 0) / 100;
  d *= STAGE[2 + (o.st || 0)] / STAGE[2 + (o.tst || 0)];
  d *= 1 + (o.magicPct || 0) / 100;
  if (o.defend) d *= 0.5;
  if (o.rand != null) d *= o.rand;
  return d;
}
const A = (id) => DB.actions[id];
const SPELLS = Object.keys(DB.actions).filter((k) => k.startsWith('s_')).map(A);

// ---------------------------------------------------------------- 戦闘エンジンの有無
function engineReady() {
  if (opt('engine', 'auto') === 'model') return false;
  try {
    const src = String(R.Battle && R.Battle.Engine);
    return !!(R.Battle && R.Battle.simulate && /Glimmer/.test(src) && /rankB/.test(src));
  } catch (e) { return false; }
}
const ENGINE = engineReady();
if (opt('engine', 'auto') === 'real' && !ENGINE) { console.log('新しい戦闘エンジンがまだありません'); process.exit(2); }
console.log(`sim_spells: seed=${SEED} rules=${H.info.rules} battles=${ENGINE ? 'engine(R.Battle.simulate)' : 'model'}${H.info.specData.length ? ' specData=' + H.info.specData.join(',') : ''}`);
U.seed(SEED);

// ---------------------------------------------------------------- 術力の表（§4.17.2 と比べる）
const TABLE_ZNS = [[15, 16, 19], [25, 30, 39], [38, 46, 62], [54, 70, 101], [73, 95, 140], [92, 128, 200], [116, 164, 260], [141, 211, 350], [170, 259, 435], [203, 329, 581]];
log('\n## 術力（§4.3.7 の術師: 知力 52・同じ杖）と §4.17.2 の表');
log('T  | Z   N   S   | 表 Z/N/S      | PM（本物の品）Z / N / S');
const pmMag = [];
for (let T = 0; T <= 9; T++) {
  const z = magOf(T, 'Z'), n = magOf(T, 'N'), s = magOf(T, 'S');
  let pmv = '—';
  try {
    const m = ['none', 'shop', 'super'].map((g) => {
      const r = PM.build(R, { tier: T, members: ['hero'], heroType: 'mage', favor: { kind: 'element', id: 'fire' }, build: 'magic', gear: g });
      return R.Rules.stats(r.party[0]).mag;
    });
    pmMag[T] = m; pmv = m.join(' / ');
  } catch (e) { pmv = 'error ' + e.message.slice(0, 40); }
  log(`T${T} | ${String(z).padEnd(3)} ${String(n).padEnd(3)} ${String(s).padEnd(3)} | ${TABLE_ZNS[T].join('/').padEnd(13)} | ${pmv}`);
}

// ---------------------------------------------------------------- P1
log('\n## P1 1段の術（SP 1.3）で標準の魔物（Lb = LZ(T)+1）を倒す回数（N の術師）');
const p1 = [];
for (let T = 0; T <= 9; T++) {
  const Lb = LZ(T) + 1, c = curve(Lb);
  const d = magicDamage(magOf(T, 'N'), A('s_water_1'), { Lb, mdef: c.mdef });
  p1.push(c.hp / d);
  log(`  T${T}: 術力 ${magOf(T, 'N')}・1 撃 ${f1(d)}・HP ${f1(c.hp)} → ${f2(c.hp / d)} 回   （Z ${f2(c.hp / magicDamage(magOf(T, 'Z'), A('s_water_1'), { Lb, mdef: c.mdef }))}・S ${f2(c.hp / magicDamage(magOf(T, 'S'), A('s_water_1'), { Lb, mdef: c.mdef }))}）`);
}

// ---------------------------------------------------------------- P2（§7.11.1 の表）
const P2ROWS = [
  ['s_fire_1', 0, 15, 18], ['s_water_1', 0, [13, 14], [15, 16]], ['s_earth_1', 0, [13, 14], [15, 16]], ['s_light_2', 1, 30, 39], ['s_fire_2', 1, 20, 26],
  ['s_wind_3', 2, 67, 91], ['s_fire_earth_a', 3, 121, 175], ['s_water_wind_a', 3, 68, 98], ['s_dark_4', 4, 139, 205], ['s_fire_4', 4, 95, 140],
  ['s_water_wind_b', 5, 290, 453], ['s_fire_dark_b', 5, 154, 240], ['s_wind_dark_b', 5, 154, 240], ['s_fire_5', 6, 372, 589], ['s_wind_5', 6, 180, 286],
  ['s_fire_water_earth', 7, 338, 560], ['s_fire_water_wind', 7, 380, 630], ['s_fire_light_dark', 7, 760, 1260],
];
log('\n## P2 閃ける時期のダメージ（§7.11.1 の表 ±10%）');
let p2bad = [];
for (const [id, T, wn, ws] of P2ROWS) {
  const Lb = LZ(T), dN = magicDamage(magOf(T, 'N'), A(id), { Lb }), dS = magicDamage(magOf(T, 'S'), A(id), { Lb });
  const inside = (v, w) => Array.isArray(w) ? v >= w[0] * 0.9 && v <= w[1] * 1.1 : Math.abs(v - w) <= w * 0.1;
  const okN = inside(dN, wn), okS = inside(dS, ws);
  if (!okN || !okS) p2bad.push(id);
  log(`  ${(A(id).name + '（' + id + '）').padEnd(28)} T${T} SP ${f2(spOf(A(id)))}  N ${Math.round(dN)}（表 ${wn}）${okN ? '' : ' ×'}  S ${Math.round(dS)}（表 ${ws}）${okS ? '' : ' ×'}`);
}

// ---------------------------------------------------------------- P3・P4・P5
const T8 = 8, Lb8 = LZ(T8);
const d3 = ['Z', 'N', 'S'].map((g) => magicDamage(magOf(T8, g), A('s_fire_5'), { Lb: Lb8 }));
log(`\n## P3 知力ビルド（T8・日輪落とし）: Z ${Math.round(d3[0])}・N ${Math.round(d3[1])}・S ${Math.round(d3[2])}`);
if (pmMag[8]) log(`   参考（party_model の本物の品）: 術力 Z ${pmMag[8][0]}・N ${pmMag[8][1]}・S ${pmMag[8][2]} → S/Z ${f2(pmMag[8][2] / pmMag[8][0])}・S/N ${f2(pmMag[8][2] / pmMag[8][1])}`);
// P4: 地方ボス（Lb = LZ+3、守り ×1.2）に 皆既日食（S の術師）÷ 剣の格 9 の技（S の戦士、腕力 50）
const Lbb = LZ(T8) + BOSS.lvOff, cb = curve(Lbb), bdef = cb.def * BOSS.def, bmdef = cb.mdef * BOSS.def;
const eclipse = magicDamage(magOf(T8, 'S'), A('s_fire_light_dark'), { Lb: Lbb, mdef: bmdef });
const sw9 = Object.keys(DB.actions).find((k) => A(k).kind === 'tech' && A(k).wtype === 'sword' && A(k).glim.lv === 9);
function physExpect(atk, tech, L, def, o) {
  o = o || {};
  const dk = DK(L);
  let s = 0;
  for (const e of tech.effects) if (e.type === 'damage') {
    const guard = dk / (dk + def * (1 - (typeof e.ignoreDef === 'number' ? e.ignoreDef : 0)));
    const crit = o.crit ? Math.min(0.6, o.crit + (e.critBonus || 0) / 100) : 0;
    const perHit = atk * e.power * (crit ? (1 - crit) * guard + crit * 1.5 : guard) * (o.hit != null ? o.hit : 1);
    s += perHit * (e.hits || 1);
  }
  return s;
}
const atkS = atkOf(T8, 'S', 50);
const warriorBase = physExpect(atkS, { effects: [{ type: 'damage', power: 3.0 }] }, Lbb, bdef);
const warriorTech = physExpect(atkS, A(sw9), Lbb, bdef);
const warriorReal = physExpect(atkS, A(sw9), Lbb, bdef, { hit: Math.min(1, (90 + Math.floor(30 / 4) - 5) / 100), crit: (2 + Math.floor(30 / 16) + 2) / 100 });
log(`\n## P4 大技の手応え（T8・地方ボス）: 皆既日食 S ${Math.round(eclipse)} ÷ 戦士 S の格 9 の技（攻撃力 ${atkS}）`);
log(`   P 3.0 の基準 ${Math.round(warriorBase)} → ${f2(eclipse / warriorBase)}   データの ${A(sw9).name} ${Math.round(warriorTech)} → ${f2(eclipse / warriorTech)}   命中と会心を入れると ${Math.round(warriorReal)} → ${f2(eclipse / warriorReal)}`);
const Lm = LZ(T8), hpM = curve(Lm).hp;
function wipeRate(g, n) {
  let w = 0;
  for (let i = 0; i < n; i++) {
    let all = true;
    for (let k = 0; k < 3; k++) if (Math.round(magicDamage(magOf(T8, g), A('s_fire_water_earth'), { Lb: Lm, rand: U.rf(0.95, 1.05) })) < Math.round(hpM)) all = false;
    if (all) w++;
  }
  return w / n;
}
const wipeS = wipeRate('S', 20000), wipeN = wipeRate('N', 20000);
log(`\n## P5 大噴火 1 回で標準の魔物 3 体（T8・HP ${Math.round(hpM)}）: S ${pc(wipeS)} 全滅・N ${pc(wipeN)} 全滅`);

// ---------------------------------------------------------------- P6
const maxSP = (pred) => Math.max(...SPELLS.filter(pred).map(spOf));
const st13E = maxSP((a) => a.cls === 'single' && a.step <= 3 && a.target === 'enemy');
const cAE = maxSP((a) => a.cls === 'comboA' && a.target === 'enemy'), cAA = maxSP((a) => a.cls === 'comboA' && a.target === 'enemies');
const cBE = maxSP((a) => a.cls === 'comboB' && a.target === 'enemy'), cBA = maxSP((a) => a.cls === 'comboB' && a.target === 'enemies');
const BIG = ['s_fire_water_wind', 's_fire_wind_earth', 's_fire_light_dark', 's_earth_light_dark'];
const trE = maxSP((a) => a.cls === 'triple' && !BIG.includes(spellIdOf(a)) && a.target === 'enemy');
const s5E = maxSP((a) => a.cls === 'single' && a.step === 5 && a.target === 'enemy');
function spellIdOf(a) { return Object.keys(DB.actions).find((k) => DB.actions[k] === a); }
log(`\n## P6 合成の価値（SP の最大）: 合成A 単体 ${cAE} ÷ 1〜3段 単体 ${st13E} = ${f2(cAE / st13E)}、合成B/A 単体 ${f2(cBE / cAE)}・全体 ${f2(cBA / cAA)}、3属性（大技以外）単体 ${trE} ÷ 5段 ${s5E} = ${f2(trE / s5E)}`);

// ---------------------------------------------------------------- P7
log('\n## P7 MP の量（成長 S の術師、Lv = LZ(T)+1）と、その時期の一番上の段');
const TOP = [['1段', (a) => a.cls === 'single' && a.step === 1], ['2段', (a) => a.cls === 'single' && a.step === 2], ['3段', (a) => a.cls === 'single' && a.step === 3],
  ['合成A', (a) => a.cls === 'comboA'], ['4段・合成A', (a) => (a.cls === 'single' && a.step === 4) || a.cls === 'comboA'], ['合成B', (a) => a.cls === 'comboB'],
  ['5段', (a) => a.cls === 'single' && a.step === 5], ['3属性', (a) => a.cls === 'triple'], ['大技', (a) => BIG.includes(spellIdOf(a))], ['大技', (a) => BIG.includes(spellIdOf(a))]];
const mageS = Object.keys(DB.companions).find((id) => !id.startsWith('_') && DB.companions[id].growth && DB.companions[id].growth.mp === 'S') || 'teo';
const p7 = [];
for (let T = 0; T <= 9; T++) {
  const c = H.makeChar({ id: mageS, level: LZ(T) + 1 });
  const mp = R.Rules.maxAt ? R.Rules.maxAt(c, 'mp', LZ(T) + 1) : R.Rules.stats(c).mp;
  const [label, pred] = TOP[T];
  const hi = Math.max(...SPELLS.filter(pred).map((a) => a.mp)), lo = Math.min(...SPELLS.filter(pred).map((a) => a.mp));
  p7.push(mp / hi);
  log(`  T${T}: 最大MP ${mp}（${DB.companions[mageS].name}・Lv${LZ(T) + 1}）・${label} ${lo}〜${hi} → ${f1(mp / hi)}〜${f1(mp / lo)} 回`);
}

// ---------------------------------------------------------------- P10（§7.4.5 の表を抽選 10 万回で）
const SF = (int) => U.clamp((128 + int) / 168, 0.6, 2.0);
const P10T = { 0.15: [[0.16, 0.12, 0.08, 0.04], [0.21, 0.16, 0.11, 0.05], [0.30, 0.22, 0.15, 0.07]], 0.30: [[0.32, 0.24, 0.16, 0.08], [0.43, 0.32, 0.21, 0.11], [0.60, 0.45, 0.30, 0.15]], 0.40: [[0.43, 0.32, 0.21, 0.11], [0.57, 0.43, 0.29, 0.14], [0.80, 0.60, 0.40, 0.20]] };
function statusP(chance, int, res) {
  if (R.Battle && typeof R.Battle.statusChance === 'function') return R.Battle.statusChance({ chance, int, res });
  return U.clamp(chance * SF(int) * (1 - res), 0, 0.95);
}
let p10bad = 0, p10n = 0;
log('\n## P10 状態異常の決まりやすさ（§7.4.5。p = chance × SF(知力) × (1 − 耐性)、抽選 10 万回）');
for (const ch of [0.15, 0.30, 0.40]) {
  const row = [];
  [52, 112, 232].forEach((int, i) => {
    [0, 0.25, 0.5, 0.75].forEach((res, j) => {
      const p = statusP(ch, int, res);
      let hit = 0;
      for (let n = 0; n < 100000; n++) if (U.chance(p)) hit++;
      const v = hit / 100000, want = P10T[ch][i][j];
      p10n++;
      if (Math.abs(v - want) > want * 0.1 + 0.005) p10bad++;
      row.push(v.toFixed(2));
    });
    row.push('|');
  });
  log(`  chance ${ch.toFixed(2)}: ${row.join(' ')}`);
}

// ---------------------------------------------------------------- P8・P9・P11 戦闘
// 小さな戦闘モデル（エンジンが無いとき）: §4.13.2 のオートの MP の使い方を、標準のパーティ（PM.standard）で数える。
//  味方: 前列の 2 人と弓は通常攻撃（命中 92%・会心 5%）で集中攻撃。術師（マルタ）は
//   ① 40% を切った人がいれば回復（2 人以上なら全体）、② 1 戦に 1 回、MP 50% 以上で候補の開いた属性の一番安い術（閃きねらい）、
//   ③ MP 30% 以上で、全体の術で 2 体以上倒せるならいちばん安いもの、④ ほかは鞭で攻撃。
//  魔物: 標準の魔物（曲線 × K.MOB）2〜5 体（平均 3.35 体）。1 体が 1 回、前列 2 : 中列 1 で狙う。受けるダメージが
//   §4.17.3 A2（パーティの最大HP の 8〜12%）の真ん中の 10% になるように、1 度だけ倍率を合わせる（balance の担当が A2 を満たす前提）。
//  戦闘後: HP 全快・MP 10%（§4.12.1）。
function party(T) {
  const r = PM.standard(R, T, {});
  return r.party.map((c) => ({ c, st: R.Rules.stats(c) }));
}
const knownSpells = (c, pred) => (c.spells || []).map((id) => ({ id, a: A(id) })).filter((x) => x.a && (!pred || pred(x.a)));
const cheapest = (list) => list.slice().sort((x, y) => x.a.mp - y.a.mp || x.a.order - y.a.order)[0];
function battleModel(T, P, o) {
  o = o || {};
  const Lb = LZ(T) + 1, cv = curve(Lb);
  const nMon = (() => { const r = U.r(); return r < 0.25 ? 2 : r < 0.55 ? 3 : r < 0.85 ? 4 : 5; })();
  const mons = [];
  for (let i = 0; i < nMon; i++) mons.push({ hp: cv.hp, max: cv.hp, atk: cv.atk * MOB.atk, def: cv.def, mdef: cv.mdef });
  const dk = DK(Lb);
  const mage = P.find((m) => m.c.id === 'marta') || P.find((m) => (m.c.spells || []).length);
  let hunted = false, casts = 0, mp0 = mage ? mage.c.mp : 0, hpLost = 0;
  const hp0 = P.map((m) => m.c.hp);
  let rounds = 0;
  const alive = () => mons.filter((m) => m.hp > 0);
  const focus = () => alive().sort((a, b) => a.hp - b.hp)[0];
  while (alive().length && rounds < 20) {
    rounds++;
    for (const m of P) {
      if (m.c.hp <= 0 || !alive().length) continue;
      if (m === mage) {
        const mpMax = m.st.mp;
        const hurt = P.filter((x) => x.c.hp > 0 && x.c.hp < x.st.hp * 0.4);
        const heals = knownSpells(m.c, (a) => a.effects.some((e) => e.type === 'heal') && a.target !== 'party');
        let cast = null, targets = null;
        if (hurt.length && heals.length) {
          const all = heals.filter((x) => x.a.target === 'allies'), one = heals.filter((x) => x.a.target === 'ally');
          const pick = hurt.length >= 2 && all.length ? cheapest(all) : one.length ? cheapest(one) : cheapest(heals);
          if (pick && m.c.mp >= pick.a.mp) { cast = pick; targets = pick.a.target === 'allies' ? P : [hurt[0]]; }
        }
        if (!cast && !hunted && m.c.mp >= mpMax * 0.5) {
          const els = ['fire', 'water', 'wind', 'earth', 'light', 'dark'].filter((e) => knownSpells(m.c, (a) => a.elements.includes(e)).length &&
            G.candidates(m.c, { kind: 'spell', elements: [e], rankB: T + 1, ef: 1, tier: T, row: m.c.row, silenced: false }).length);
          if (els.length) {
            const e = els[Math.floor(U.r() * els.length)];
            const pick = cheapest(knownSpells(m.c, (a) => a.elements.includes(e)));
            if (pick && m.c.mp >= pick.a.mp) { cast = pick; hunted = true; }
          }
        }
        if (!cast && m.c.mp >= mpMax * 0.3) {
          const aoe = knownSpells(m.c, (a) => a.target === 'enemies' && dmgEff(a)).filter((x) => {
            const d = magicDamage(m.st.mag, x.a, { Lb, mdef: cv.mdef });
            return alive().filter((mo) => mo.hp <= d).length >= 2;
          });
          if (aoe.length) cast = cheapest(aoe);
        }
        if (cast && m.c.mp >= cast.a.mp) {
          m.c.mp -= cast.a.mp; casts++;
          const a = cast.a;
          if (dmgEff(a)) {
            const tg = a.target === 'enemies' ? alive() : [focus()];
            for (const mo of tg) mo.hp -= magicDamage(m.st.mag, a, { Lb, mdef: cv.mdef, rand: U.rf(0.95, 1.05) });
          }
          for (const e of a.effects) if (e.type === 'heal') {
            const MNDF = U.clamp((128 + m.st.mnd) / 168, 0.75, 2.2);
            for (const x of (targets || (a.target === 'allies' ? P : [P.slice().sort((p, q) => p.c.hp / p.st.hp - q.c.hp / q.st.hp)[0]]))) if (x.c.hp > 0) x.c.hp = Math.min(x.st.hp, x.c.hp + x.st.hp * e.pct * MNDF);
          }
          continue;
        }
      }
      // 通常攻撃
      const w = m.st.w && (m.st.w.weapon2 && m === mage ? m.st.w.weapon2 : m.st.w.weapon1);
      const atk = (w && w.atk) || 10;
      const tg = focus();
      if (!tg) break;
      if (U.r() < 0.92) {
        const critHit = U.r() < 0.05;
        tg.hp -= atk * (critHit ? 1.5 : dk / (dk + tg.def)) * U.rf(0.9, 1.1);
      }
    }
    // 魔物の手番
    for (const mo of alive()) {
      const tgts = P.filter((x) => x.c.hp > 0);
      if (!tgts.length) break;
      const wsum = tgts.reduce((s, x) => s + (x.c.row === 'middle' ? 1 : 2), 0);
      let r = U.r() * wsum, tg = tgts[0];
      for (const x of tgts) { r -= x.c.row === 'middle' ? 1 : 2; if (r < 0) { tg = x; break; } }
      if (U.r() < 0.95 - (tg.st.eva || 0) / 100) {
        const d = mo.atk * dk / (dk + (tg.st.def || 0)) * (tg.c.row === 'middle' ? 0.7 : 1) * U.rf(0.9, 1.1) * (o.scale || 1);
        tg.c.hp = Math.max(0, tg.c.hp - d);
      }
    }
  }
  for (let i = 0; i < P.length; i++) hpLost += Math.max(0, hp0[i] - P[i].c.hp);
  const hpMax = P.reduce((s, x) => s + x.st.hp, 0);
  const res = { rounds, casts, mpUsed: mage ? mp0 - mage.c.mp : 0, mpMax: mage ? mage.st.mp : 1, hpLostPct: hpLost / hpMax, downs: P.filter((x) => x.c.hp <= 0).length };
  // 戦闘後（§4.12.1）
  for (const m of P) {
    if (m.c.hp <= 0 && !o.keepDown) m.c.hp = m.st.hp;   // 雑魚戦のモデルでは倒れた人も次の戦闘の前に戻す（蘇生の道具・術）
    else m.c.hp = m.st.hp;
    m.c.mp = Math.min(m.st.mp, m.c.mp + Math.ceil(m.st.mp * (K.AFTER ? K.AFTER.mpPct : 0.1)));
  }
  return res;
}
function calibrate(T) {
  let lo = 0.2, hi = 5;
  for (let it = 0; it < 14; it++) {
    const mid = (lo + hi) / 2;
    const P = party(T);
    let s = 0;
    for (let i = 0; i < 120; i++) { for (const m of P) m.c.mp = m.st.mp; s += battleModel(T, P, { scale: mid }).hpLostPct; }
    if (s / 120 < 0.10) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
function floorRun(T, n, startPct, scale) {
  const P = party(T);
  for (const m of P) m.c.mp = Math.round(m.st.mp * startPct);
  const mage = P.find((m) => m.c.id === 'marta');
  const out = [];
  for (let i = 0; i < n; i++) out.push(battleModel(T, P, { scale }));
  return { list: out, endPct: mage.c.mp / mage.st.mp, mage };
}
log(`\n## P8・P11 雑魚戦の MP（標準のパーティ・オート。術師 = マルタ）`);
function engineFloor(T, n, startPct) {
  const P0 = PM.standard(R, T, {});
  const party0 = P0.party;
  for (const c of party0) { const s = R.Rules.stats(c); c.mp = Math.round(s.mp * startPct); }
  const zones = Object.keys(DB.encounters || {}).filter((z) => !/prologue|postgame|finale/.test(z) && (DB.encounters[z].tier === 'dyn' || DB.encounters[z].tier === T));
  const mi = party0.findIndex((c) => c.id === 'marta');
  const out = [];
  for (let i = 0; i < n; i++) {
    const zone = zones.length ? zones[Math.floor(U.r() * zones.length)] : null;
    const r = PM.runBattle(R, { party: party0, inv: P0.inv, zone, tier: T, seed: Math.floor(U.r() * 1e9) });
    if (!r) return null;
    out.push({ casts: r.casts[mi], mpPct: r.mpUsedBy[mi], hp: r.hpLostPct / 100, result: r.result });
    const end = r.party || [];
    for (let k = 0; k < party0.length; k++) if (end[k]) { party0[k].hp = end[k].hp; party0[k].mp = end[k].mp; party0[k].wp = end[k].wp; }
    PM.afterBattle(R, party0, r.result === 'lose' ? 'lose' : 'win');
    for (const c of party0) if (c.hp <= 0) c.hp = R.Rules.stats(c).hp;   // 倒れた人は次の戦闘の前に戻す（蘇生の道具・術）
  }
  const s = R.Rules.stats(party0[mi]);
  return { list: out, endPct: party0[mi].mp / s.mp };
}
const p8 = [], p11 = [], p8m = [], p11m = [];
for (let T = 0; T <= 8; T++) {
  // 戦闘モデル（参考。エンジンが無いときは判定にも使う）
  const scale = calibrate(T);
  const mc = [], mm = [], mh = [], e60 = [], e100 = [];
  for (let f = 0; f < Math.max(8, Math.round(BATTLES / 12)); f++) {
    const run = floorRun(T, 12, 0.6, scale);
    for (const b of run.list) { mc.push(b.casts); mm.push(b.mpUsed / b.mpMax); mh.push(b.hpLostPct); }
    e60.push(run.endPct);
    e100.push(floorRun(T, 12, 1.0, scale).endPct);
  }
  p8m.push({ T, casts: mean(mc), mpPct: mean(mm), hp: mean(mh), scale });
  p11m.push({ T, end60: Math.min(...e60), end60mean: mean(e60), end100: mean(e100) });
  let line = `  T${T}: モデル 詠唱 ${f2(mean(mc))}/戦・MP ${pc(mean(mm))}/戦・HP の減り ${pc(mean(mh))}（倍率 ${f2(scale)}）・12 戦後の MP ${pc(mean(e60))}（最低 ${pc(Math.min(...e60))}、満タンから ${pc(mean(e100))}）`;
  if (ENGINE) {
    const ec = [], em = [], eh = [], ee = [];
    const floors = Math.max(3, Math.round(Math.min(BATTLES, 240) / 12));
    for (let f = 0; f < floors; f++) {
      const run = engineFloor(T, 12, 0.6);
      if (!run) break;
      for (const b of run.list) { ec.push(b.casts); em.push(b.mpPct); eh.push(b.hp); }
      ee.push(run.endPct);
    }
    p8.push({ T, casts: mean(ec), mpPct: mean(em), hp: mean(eh) });
    p11.push({ T, end60: ee.length ? Math.min(...ee) : NaN, end60mean: mean(ee) });
    line += `\n       エンジン 詠唱 ${f2(mean(ec))}/戦・MP ${pc(mean(em))}/戦・HP の減り ${pc(mean(eh))}・12 戦後の MP ${pc(mean(ee))}（最低 ${pc(ee.length ? Math.min(...ee) : 0)}）`;
  }
  log(line);
}
const P8 = ENGINE ? p8 : p8m, P11 = ENGINE ? p11 : p11m;
// 参考: §7.5.3 の説明のモデル（術師 成長 S が 1 戦に 1 回、その時期の中くらいの段を唱え、戦闘後に 10% 戻る。12 戦、60% で始めて）
{
  const MID = [['1段', (a) => a.cls === 'single' && a.step === 1], ['1段', (a) => a.cls === 'single' && a.step === 1], ['2段', (a) => a.cls === 'single' && a.step === 2],
    ['3段', (a) => a.cls === 'single' && a.step === 3], ['3段', (a) => a.cls === 'single' && a.step === 3], ['合成A', (a) => a.cls === 'comboA'],
    ['4段', (a) => a.cls === 'single' && a.step === 4], ['合成B', (a) => a.cls === 'comboB'], ['5段', (a) => a.cls === 'single' && a.step === 5]];
  const out = [];
  for (let T = 0; T <= 8; T++) {
    const c = H.makeChar({ id: mageS, level: LZ(T) + 1 });
    const max = R.Rules.maxAt ? R.Rules.maxAt(c, 'mp', LZ(T) + 1) : R.Rules.stats(c).mp;
    const cost = Math.max(...SPELLS.filter(MID[T][1]).map((a) => a.mp));
    let mp = Math.round(max * 0.6);
    for (let i = 0; i < 12; i++) { mp = Math.max(0, mp - cost); mp = Math.min(max, mp + Math.ceil(max * 0.1)); }
    out.push(`T${T} ${MID[T][0]}(MP${cost}) ${pc(mp / max)}`);
  }
  log('  参考（§7.5.3 のモデル・1 戦に 1 回・中くらいの段の一番高い MP）: ' + out.join('  '));
}


// P9: 地方ボス戦の回復の釣り合い（回復役マルタ・光 A）
log('\n## P9 回復の釣り合い（地方ボス戦・回復役マルタ）');
const p9 = [];
for (let T = 1; T <= 7; T++) {
  const P = party(T);
  const healer = P.find((m) => m.c.id === 'marta');
  if (!healer.c.spells.includes('s_light_3')) healer.c.spells.push('s_light_3');
  if (!healer.c.spells.includes('s_light_1')) healer.c.spells.push('s_light_1');
  const Lb = LZ(T) + BOSS.lvOff, cv = curve(Lb), dk = DK(Lb);
  const batk = cv.atk * BOSS.atk;
  const MNDF = U.clamp((128 + healer.st.mnd) / 168, 0.75, 2.2);
  const healPct = ((healer.st.mods && healer.st.mods.healPct) || 0) / 100;
  let minRatio = Infinity, worst = null, sumHeal = 0, sumAoe = 0;
  for (const x of P) {
    const aoe = batk * 0.7 * dk / (dk + (x.st.def || 0)) * (x.c.row === 'middle' ? 0.7 : 1);
    const heal = x.st.hp * 0.30 * MNDF * (1 + healPct);
    sumHeal += heal; sumAoe += aoe;
    if (heal / aoe < minRatio) { minRatio = heal / aoe; worst = `${x.c.name}（${x.c.row === 'middle' ? '中列' : '前列'}・全体攻撃で ${pc(aoe / x.st.hp)}）`; }
  }
  const ratio = sumHeal / sumAoe;
  // 何ラウンド MP がもつか（ボス 2 回行動: 単体 60%・全体 40%。倒れる前に回復する。MP 満タンから）
  const lasts = [];
  for (let trial = 0; trial < 400; trial++) {
    for (const x of P) x.c.hp = x.st.hp;
    healer.c.mp = healer.st.mp;
    let r = 0;
    for (; r < 40; r++) {
      for (let act = 0; act < 2; act++) {
        if (U.r() < 0.6) {
          const tg = P[Math.floor(U.r() * P.length)];
          tg.c.hp -= batk * 1.0 * dk / (dk + (tg.st.def || 0)) * (tg.c.row === 'middle' ? 0.7 : 1) * U.rf(0.9, 1.1);
        } else for (const x of P) x.c.hp -= batk * 0.7 * dk / (dk + (x.st.def || 0)) * (x.c.row === 'middle' ? 0.7 : 1) * U.rf(0.9, 1.1);
      }
      const low = P.filter((x) => x.c.hp < x.st.hp * 0.6);
      let need = null;
      if (low.length >= 2) need = A('s_light_3');
      else if (low.length === 1) need = A('s_light_1');
      if (need) {
        if (healer.c.mp < need.mp) break;
        healer.c.mp -= need.mp;
        for (const x of (need.target === 'allies' ? P : low)) x.c.hp = Math.min(x.st.hp, Math.max(0, x.c.hp) + x.st.hp * need.effects[0].pct * MNDF * (1 + healPct));
      }
    }
    lasts.push(r);
  }
  lasts.sort((a, b) => a - b);
  p9.push({ T, ratio, minRatio, worst, lastsMed: lasts[lasts.length >> 1], lasts10: lasts[Math.floor(lasts.length * 0.1)] });
  log(`  T${T}: あまねく光の回復量 ÷ ボスの全体攻撃のダメージ（全員の合計）${f2(ratio)}（一番痛い人 ${worst} で ${f2(minRatio)}）・回復役の MP がもつラウンド 中央値 ${lasts[lasts.length >> 1]}（下位 10% ${lasts[Math.floor(lasts.length * 0.1)]}）・最大MP ${healer.st.mp}・精神 ${healer.st.mnd}`);
}

// ---------------------------------------------------------------- 判定
console.log('\n## 判定');
crit('P1', '1段の術で標準の魔物を倒す回数（N）', p1.map(f2).join(' / '), p1.every((x) => x >= 1.6 && x <= 2.3), '全ティア 1.6〜2.3');
crit('P2', '閃ける時期のダメージ（§7.11.1）', p2bad.length ? '外れ: ' + p2bad.join(',') : `${P2ROWS.length} 行すべて表の ±10%`, !p2bad.length, '表の ±10%');
crit('P3', '知力ビルドの倍率（T8）', `S/Z ${f2(d3[2] / d3[0])}・S/N ${f2(d3[2] / d3[1])}`, d3[2] / d3[0] >= 2.4 && d3[2] / d3[0] <= 2.7 && d3[2] / d3[1] >= 1.6 && d3[2] / d3[1] <= 1.75, 'S/Z 2.4〜2.7・S/N 1.6〜1.75');
crit('P4', '大技の手応え（皆既日食 ÷ 戦士の格 9、地方ボス）', `${f2(eclipse / warriorBase)}（データの技で ${f2(eclipse / warriorTech)}）`, eclipse / warriorBase >= 1.6 && eclipse / warriorBase <= 2.2 && eclipse / warriorTech >= 1.6 && eclipse / warriorTech <= 2.2, '1.6〜2.2');
crit('P5', '全滅の手応え（T8・大噴火 1 回・3 体）', `S ${pc(wipeS)}・N ${pc(wipeN)}`, wipeS >= 0.95 && wipeN <= 0.2, 'S ≥ 95%・N ≤ 20%');
crit('P6', '合成の価値', `A/1〜3段 ${f2(cAE / st13E)}・B/A ${f2(cBE / cAE)}/${f2(cBA / cAA)}・三/5段 ${f2(trE / s5E)}`, cAE / st13E >= 1.3 && cBE / cAE >= 1.2 && cBA / cAA >= 1.2 && trE / s5E >= 1.2, '≥ 1.3・≥ 1.2・≥ 1.2');
crit('P7', 'MP の量（満タンから一番上の段を撃てる回数）', p7.map(f1).join(' / '), p7.every((x) => x >= 5), 'T0〜T6 は 5 回以上、T7〜T9 は大技 5 回以上');
{
  const castAvg = mean(P8.map((x) => x.casts)), mpOk = P8.every((x) => x.mpPct <= 0.12);
  const low = P8.filter((x) => x.casts < 0.75).map((x) => 'T' + x.T);
  crit('P8', `雑魚戦の MP（術師・${ENGINE ? 'エンジン' : 'モデル'}）`, `詠唱 平均 ${f2(castAvg)}（${P8.map((x) => f2(x.casts)).join('/')}）・MP ${P8.map((x) => Math.round(x.mpPct * 100)).join('/')}%` + (low.length ? `・0.75 未満 ${low.join(',')}` : ''),
    castAvg >= 0.75 && mpOk, '詠唱 0.75 回以上/戦（T0〜T8 の平均）・MP 使用 12% 以下/戦（全ティア）');
}
crit('P9', '回復の釣り合い（地方ボス戦）', `比（全員の合計）${p9.map((x) => f2(x.ratio)).join('/')}（一番痛い人 ${p9.map((x) => f2(x.minRatio)).join('/')}）・もつラウンド ${p9.map((x) => x.lastsMed).join('/')}`, p9.every((x) => x.ratio >= 2 && x.lastsMed >= 8), 'あまねく光 1 回の回復量 ≥ 全体攻撃 1 回のダメージの 2 倍・MP が 8 ラウンド以上');
crit('P10', '状態の決まりやすさ（§7.4.5）', `${p10n - p10bad}/${p10n} が表の ±10%`, p10bad === 0, '表の ±10%');
crit('P11', `1 フロアの持久力（12 戦・60% で始めて・${ENGINE ? 'エンジン' : 'モデル'}）`, P11.map((x) => pc(x.end60mean)).join('/') + '（最低 ' + P11.map((x) => pc(x.end60)).join('/') + '）', P11.every((x) => x.end60 >= 0.3), '術師の MP が 30% 以上');

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (opt('json', null)) require('fs').writeFileSync(opt('json'), JSON.stringify({ seed: SEED, engine: ENGINE, rules: H.info.rules, results, p1, p7, p8, p8m, p9, p11, p11m }, null, 1));
process.exitCode = failed.length ? 1 : 0;
