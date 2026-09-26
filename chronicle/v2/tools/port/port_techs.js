// port_techs.js（RULES）: 今の木（chronicle/src、P0 の写しのハッシュは port/manifest.json）の技・術・属性・状態を v2 に移す。
//   node v2/tools/port/port_techs.js            → v2/src/data/{techs_<wtype>,spells_*,elements,statuses}.js を書く
//   node v2/tools/port/port_techs.js --check    → 書かずに数と参照だけ確かめる
// 技は STATS_REWORK §8.5（108 → 99。斧・槍の技を 5 系統へ移し、9 技を消す）。術・属性・状態は「そのまま」（登録先だけ R.DB.spells に）。
// 出力のファイルが以後の正（V2_PLAN §1.2）。この道具は移植のやり直し用に残す。
'use strict';
const fs = require('fs');
const path = require('path');
const { loadOld, lit, header, ROOT, V2 } = require('./port_items');

const CHECK = process.argv.includes('--check');
const R = loadOld();
const A = R.DB.actions;

// §8.5 の表: 旧 id → [新しい系統, 新 id, 新しい名前, 'keepReach'?]
const MOVE = {
  t_axe_crumble: ['greatsword', 't_greatsword_crumble', '打ち崩し'],
  t_axe_throw: ['greatsword', 't_greatsword_throw', '回し投げ', 'keepReach'],
  t_axe_rage: ['greatsword', 't_greatsword_rage', '荒ぶる心'],
  t_axe_bell: ['greatsword', 't_greatsword_bell', '鐘打ち'],
  t_axe_strip: ['greatsword', 't_greatsword_strip', 'はがし打ち'],
  t_axe_cliff: ['greatsword', 't_greatsword_cliff', '断崖落とし'],
  t_axe_thunder: ['greatsword', 't_greatsword_thunder', '神鳴り打ち'],
  t_axe_tremor: ['staff', 't_staff_tremor', '地揺らしの杖'],
  t_axe_storm: ['staff', 't_staff_storm', '嵐の杖'],
  t_spear_whirl: ['staff', 't_staff_whirl', '輪舞の杖'],
  t_spear_disarm: ['sword', 't_sword_disarm', '武器落とし'],
  t_spear_pierce: ['sword', 't_sword_pierce', '徹し突き'],
  t_spear_cloud: ['sword', 't_sword_cloud', '雲突き'],
  t_spear_butt: ['dagger', 't_dagger_butt', '柄打ち'],
  t_spear_skewer: ['dagger', 't_dagger_sweep', '薙ぎ払い'],
  t_spear_vault: ['dagger', 't_dagger_vault', 'かち上げ'],
  t_spear_surge: ['dagger', 't_dagger_surge', '荒波の連撃'],
  t_spear_receive: ['bow', 't_bow_receive', '迎え撃ち'],
  t_spear_ripple: ['bow', 't_bow_ripple', 'さざ波射ち'],
  t_spear_phalanx: ['bow', 't_bow_phalanx', '矢ぶすま'],
  t_spear_soar: ['bow', 't_bow_soar', '天翔ける矢'],
  t_spear_heavennet: ['bow', 't_bow_heavennet', '天網の矢'],
};
const DROP = ['t_axe_cleave', 't_axe_woodcut', 't_axe_reckless', 't_axe_whirl', 't_axe_twostroke', 't_axe_earthsplit', 't_axe_giant',
  't_spear_upthrust', 't_spear_starpierce'];
// 消える技を glim.from に持つ技の読み替え（同じ系統の近い技へ。無ければ 'attack'）
const DROP_TO = { t_axe_cleave: 'attack', t_axe_whirl: 't_greatsword_throw', t_spear_upthrust: 'attack' };
const WTYPES = ['sword', 'greatsword', 'dagger', 'bow', 'staff'];
const REACH = { bow: true, staff: true };
const r05 = (v) => Math.round(v / 0.05) * 0.05;
const fix = (v) => Math.round(v * 100) / 100;

const out = {};
for (const w of WTYPES) out[w] = {};
const rename = {};
for (const id in MOVE) rename[id] = MOVE[id][1];
const mapFrom = (list) => {
  const res = [];
  for (const f of list || []) {
    let n = f;
    if (rename[f]) n = rename[f];
    else if (DROP.includes(f)) n = DROP_TO[f] || 'attack';
    if (!res.includes(n)) res.push(n);
  }
  return res.length ? res : ['attack'];
};
for (const id of Object.keys(A)) {
  const a = A[id];
  if (!a || a.kind !== 'tech') continue;
  if (DROP.includes(id)) continue;
  const t = JSON.parse(JSON.stringify(a));
  let nid = id;
  if (MOVE[id]) {
    const [w, newId, name, keep] = MOVE[id];
    nid = newId; t.wtype = w; t.name = name;
    const toMelee = !REACH[w] && !keep;
    if (w === 'staff') {
      // 杖に移る物理の技は術力で打つ（formula:'magic'、威力 ×0.9）
      t.reach = true; t.magic = true;
      for (const e of t.effects || []) if (e.type === 'damage') { e.formula = 'magic'; e.power = fix(r05(e.power * 0.9)); delete e.kind; }
    } else if (toMelee && t.reach) {
      // 後列から届く技の ×0.85 の割引を戻す（DESIGN 4.6.6）
      t.reach = false;
      for (const e of t.effects || []) if (e.type === 'damage' && typeof e.power === 'number') e.power = fix(r05(e.power / 0.85));
    } else if (REACH[w]) t.reach = true;
  }
  if (!WTYPES.includes(t.wtype)) throw new Error('tech with a removed type: ' + id);
  if (t.glim) t.glim.from = mapFrom(t.glim.from);
  // 説明の「斧」「槍」を系統に合わせる（移した技だけ）
  if (MOVE[id] && t.desc) t.desc = t.desc.replace(/斧/g, t.wtype === 'staff' ? '杖' : '大剣').replace(/槍/g, { sword: '剣', dagger: '短剣', bow: '矢', staff: '杖' }[t.wtype] || '剣');
  out[t.wtype][nid] = t;
}
// 系統の中は lv の順（同じ lv は元の順）
const counts = {};
for (const w of WTYPES) {
  const ids = Object.keys(out[w]).sort((x, y) => out[w][x].rank - out[w][y].rank);
  const o = {};
  for (const id of ids) o[id] = out[w][id];
  out[w] = o;
  counts[w] = ids.length;
}
const all = Object.assign({}, ...WTYPES.map((w) => out[w]));
const problems = [];
for (const id in all) for (const f of all[id].glim.from) if (f !== 'attack' && !all[f]) problems.push(id + ' from ' + f);
const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log('techs', counts, 'total', total, problems.length ? 'PROBLEMS ' + problems.join(', ') : 'refs ok');
if (total !== 99 || problems.length) process.exitCode = 1;

const NAMES = { sword: '剣', greatsword: '大剣', dagger: '短剣', bow: '弓', staff: '杖' };
if (!CHECK) {
  const dir = path.join(V2, 'src', 'data');
  fs.mkdirSync(dir, { recursive: true });
  for (const w of WTYPES) {
    const body = header(`techs_${w}.js — ${NAMES[w]}の技 ${counts[w]}（RULES。STATS_REWORK §8.5。tools/port/port_techs.js の出力を正とする）`) +
      `(function (R) {\n  'use strict';\n  R.defs('techs', ${lit(out[w], 2)});\n})(window.RPG);\n`;
    fs.writeFileSync(path.join(dir, `techs_${w}.js`), body);
  }
  // 術・属性・状態: そのまま（登録先を R.DB.spells に。属性の icon は R.Contract.ICONS の名前に）
  for (const f of ['spells_single.js', 'spells_pair.js', 'spells_triple.js', 'elements.js', 'statuses.js']) {
    let s = fs.readFileSync(path.join(ROOT, 'src', 'data', f), 'utf8');
    s = s.replace('Object.assign(R.DB.actions, {', "R.defs('spells', {");
    // 合成術の演出は属性ごとの配列: K.skill.fx は文字なので、先頭を fx に、全部を fxs に（BSCENE は fxs があれば重ねる）
    s = s.replace('return Object.assign(a, o || {});', 'const r = Object.assign(a, o || {});\n    if (Array.isArray(r.fx)) { r.fxs = r.fx; r.fx = r.fx[0]; }\n    return r;');
    if (f === 'elements.js') s = s.replace(/icon: 'icon:el_(\w+)'/g, (m, e) => "icon: '" + (e === 'water' ? 'ice' : e) + "'");   // 水の印は R.Contract.ICONS に無い（CORE に依頼中）
    s = s.replace(/^\/\/ /, `// （RULES。今の木の src/data/${f} から「そのまま」移した。tools/port/port_techs.js）\n// `);
    fs.writeFileSync(path.join(dir, f), s);
  }
  console.log('wrote techs_*.js, spells_*.js, elements.js, statuses.js');
}
