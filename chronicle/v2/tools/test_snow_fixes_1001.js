#!/usr/bin/env node
// 持ち主の製品版の試遊（2026-10-01）の雪原の報告で直した物の戻りの確かめ: node v2/tools/test_snow_fixes_1001.js
//   煙突に見えた物（雪をかぶった大きすぎる薪の山・部屋のなかほどのかまど・野に置いた煙突の物）・ユールの左下の宝箱と当たり・
//   つららの回廊の入口の印・雪の林の北の口と着く向き・丸木橋の上の膜・白竜の峰の一方通行の斜面（印・一言）・氷の壁のヒント
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');

const V2 = path.resolve(__dirname, '..');
const R = require('./lib/load')({ quiet: true });
const M = R.DB.maps;
const F = R.Field;
const pass = (m, x, y) => !!F._walkable(m, x, y, null, 0);

section('煙突に見えた物');
{
  const j = JSON.parse(fs.readFileSync(path.join(V2, 'assets/env/snow/props/firewood.json'), 'utf8'));
  ok('雪の薪の山（firewood）は 1 マスの物の大きさ（32 で高さ 32 以下・幅 48 以下）', j.cell['32'][1] <= 32 && j.cell['32'][0] <= 48, j.cell);
  let png = null;
  try { png = fs.readFileSync(path.join(V2, 'assets/env/snow/props/firewood@32.png')); } catch (e) { /* */ }
  ok('firewood@32.png の大きさが json の cell と同じ', !!png && png.readUInt32BE(16) === j.cell['32'][0] && png.readUInt32BE(20) === j.cell['32'][1]);
  const inside = Object.values(M).filter((m) => m.region === 'r_snow' && m.kind === 'interior');
  const fw = inside.filter((m) => (m.objects || []).some((o) => o.type === 'prop' && o.id === 'firewood')).map((m) => m.id);
  ok('雪原の屋内に雪をかぶった薪（firewood）を置かない（woodpile）', fw.length === 0, fw);
  ok('屋内の薪の山 woodpile が物として登録されている', !!R.DB.props.woodpile && R.DB.props.woodpile.solid === true);
  const stoves = [];
  for (const m of inside) for (const o of m.objects || []) if (o.type === 'prop' && o.id === 'stove' && o.y !== 2) stoves.push(m.id + '@' + o.x + ',' + o.y);
  ok('雪原の屋内のかまど（煙突つき）は奥の壁ぎわ（y 2）だけ', stoves.length === 0, stoves);
  const pipes = Object.values(M).filter((m) => (m.objects || []).some((o) => o.type === 'prop' && o.id === 'stove_pipe')).map((m) => m.id);
  ok('煙突の物（stove_pipe）を野に置かない', pipes.length === 0, pipes);
}

section('ユールの左下の宝箱');
{
  const y = M.yule, c = (y.objects || []).find((o) => o.type === 'chest' && o.id === 'yule_c2');
  ok('yule_c2 は描いた平らな雪の上（4,42）', !!c && c.x === 4 && c.y === 42, c && [c.x, c.y]);
  ok('宝箱の前（4,41・5,42）は歩ける', pass(y, 4, 41) && pass(y, 5, 42));
  const edge = [[3, 43], [4, 44], [5, 44], [6, 45]];
  ok('描いた吹きだまりの縁の外（3,43・4,44・5,44・6,45）は歩けない（昼・夜）', edge.every(([x, yy]) => !pass(y, x, yy) && !pass(M.yule_night, x, yy)));
}

section('入口の印（wayfind）');
{
  const W = F.wayfind;
  const lake = W.info(M.f_lake).exits.find((e) => e.to && e.to.map === 'icicle_1');
  ok('つららの回廊の入口の印は描いた洞の口のまん中（x 8.5）', !!lake && lake.x + lake.w / 2 === 8.5, lake);
  const wide = [];
  for (const m of Object.values(M)) {
    if (!['town', 'dungeon', 'field'].includes(m.kind)) continue;
    const info = W.info(m);
    for (const o of m.objects || []) {
      if ((o.type !== 'door' && o.type !== 'stairs') || !o.to || (o.w || 1) === 1) continue;
      const e = info.exits.find((q) => q.warp && q.x === o.x && q.y === o.y);
      if (e && e.w !== o.w) wide.push(m.id);
    }
  }
  ok('幅のある入口（door の w）の印は四角ぜんたいの幅で出す', wide.length === 0, wide);
}

section('雪の林の口');
{
  const ea = M.f_eastroad, sw = M.snow_woods;
  const down = (ea.exits || []).find((e) => e.to && e.to.map === 'snow_woods');
  const sp = down && sw.spawns[down.to.spawn];
  ok('灯守りの街道の南の端 → 雪の林の北の口（上の端・南向き）', !!sp && sp.y <= 2 && sp.dir === 's', down && down.to);
  const outs = (sw.exits || []).filter((e) => e.to && e.to.map !== 'snow_woods');
  ok('雪の林の出口は北の端だけで、街道の南の端（北向き）へ', outs.length >= 1 && outs.every((e) => e.y === 0 && e.to.map === 'f_eastroad' && ea.spawns[e.to.spawn].dir === 'n'), outs);
  ok('北の口のマスは歩ける（描き足した道）', [8, 9, 10].every((x) => [0, 1, 2, 3, 4].every((y) => pass(sw, x, y))));
  ok('南の口の雪に埋もれた道は通せんぼ（文あり）', (sw.triggers || []).some((t) => t.gate && t.y === 41 && t.gate.text && t.gate.text !== 'map.snow_woods.south_end'));
  // 雪原のエリアの端の出口: 着く所は行き先の反対の端で、出た向きを向く
  const opp = { n: 's', s: 'n', e: 'w', w: 'e' };
  const edgeOf = (m, x, y, w, h) => (y === 0 ? 'n' : y + h >= m.h ? 's' : x === 0 ? 'w' : x + w >= m.w ? 'e' : null);
  const bad = [];
  for (const m of Object.values(M)) {
    if (m.region !== 'r_snow') continue;
    for (const e of m.exits || []) {
      const d = e.to && M[e.to.map], s = d && d.spawns && d.spawns[e.to.spawn];
      const ed = edgeOf(m, e.x, e.y, e.w || 1, e.h || 1);
      if (!s || !ed || (d.kind !== 'field' && m.kind !== 'field')) continue;
      const sed = edgeOf(d, s.x, s.y, 1, 1) || (s.y <= 2 ? 'n' : s.y >= d.h - 3 ? 's' : s.x <= 2 ? 'w' : s.x >= d.w - 3 ? 'e' : null);
      if (!sed) continue;   // 端でない所（洞の口・戸口の前）に着く出口は、口の向きに着くので数えない
      if (s.dir !== ed || sed !== opp[ed]) bad.push(`${m.id}→${e.to.map}.${e.to.spawn}`);
    }
  }
  ok('雪原のエリアの端の出口は、行き先の反対の端に、出た向きを向いて着く', bad.length === 0, bad);
}

section('丸木橋の上の膜');
{
  let clear = true;
  for (const t of [24, 32, 40]) {
    const f = path.join(V2, `assets/env/snow/under/snow_woods_over@${t}.png`);
    // PNG の画素を読む道具が node に無いので python（PIL）で確かめる（無ければ飛ばす）
    try {
      const out = require('child_process').execFileSync('python3', ['-c', `from PIL import Image\nim=Image.open(${JSON.stringify(f)}).convert('RGBA')\nt=${t}\nb=im.crop((28*t,23*t,38*t,25*t)).getchannel('A').getextrema()\nprint(b[1])`]).toString().trim();
      if (+out !== 0) clear = false;
    } catch (e) { clear = null; }
  }
  ok('雪の林の丸木橋の道（x 28〜37, y 23〜24）の上の膜は空（人の上に地面のかけらを描かない）', clear !== false, clear);
}

section('一方通行の斜面・氷の壁');
{
  for (const id of ['peak_1', 'snow_woods']) {
    const m = M[id];
    const inSlope = (o) => (m.slope || []).some((r) => o.x >= r.x && o.y >= r.y && o.x < r.x + (r.w || 1) && o.y < r.y + (r.h || 1) && r.dir === o.dir);
    ok(`${id}: 一方通行のマスは雪の斜面（snow）で、下る向きの印（slope）の中`, (m.oneway || []).length > 0 && m.oneway.every((o) => o.snow && inSlope(o)), m.oneway);
  }
  ok('峰の東の斜面は南へは下りられ、北へは上がれない', F.passable(M.peak_1, 47, 30, 's') && !F.passable(M.peak_1, 47, 30, 'n'));
  ok('斜面の一言の文がある', ['sys.move.onewayBump.say', 'sys.move.onewayBump.snow'].every((k) => R.T(k) !== k));
  const say2 = R.I18n.table('ja')['events.peak_icewall.say_2'];
  ok('氷の壁（火種なし）でユールの大火祭の火をほのめかす', Array.isArray(say2) && say2.some((s) => /大火祭/.test(s)), say2);
  ok('峰に着いたときの一言もユールの大火祭の火を指す', /大火祭/.test(R.I18n.table('ja')['events.peak_arrive.caption_2']));
}

done('snow fixes 2026-10-01');
