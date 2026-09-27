#!/usr/bin/env node
// FIELD（V2_PLAN §4.4 の FIELD の行、node）: 8 方向・壁沿い・角を切らない・隊列・NPC を押す・一方通行・2 つの高さ・隠し通路・
// 魔除けの香（ward を渡す）・ワープと脱出・タイル進入で 1 回・歩数の出現・暗がりの半径・灯籠と泉の安全地帯・カメラが端で止まる・
// 宝箱・泉・床のスイッチ・トリガー（enter は入るたび／once は 1 回・step）・ハブの結果・NPC の命令・ついてくる人・契約の形。
// ブラウザの項目（ダッシュで焼けていないチャンク・全滅の後の不変条件・スクショ）は test_field_browser.js。
//   node v2/tools/test_field.js
'use strict';
const path = require('path');
const { ok, section, done } = require('./lib/testkit');
const FX = path.join(__dirname, 'test_field_fx');
const R = require('./lib/load')({ quiet: true, dev: true, fixtures: true, fixtureDirs: [path.join(__dirname, 'fixtures'), FX], extra: [path.join(FX, 'maps.js')] });
const S = R.Field._s;
const I = R.Input;

const adv = (ms) => R.Engine.advance(ms);
async function flush() { for (let i = 0; i < 5; i++) await Promise.resolve(); }
async function settle(ms) { for (let t = 0; t < (ms || 400); t += 50) { adv(50); await flush(); } }
async function enter(map, x, y, dir) { await R.Field.enter(map, { x, y, dir: dir || 's' }, { fade: 0, noAutosave: true }); await settle(100); }
async function hold(btns, ms) {
  for (const b of [].concat(btns)) I._set(b, true);
  for (let t = 0; t < ms; t += 16.67) { adv(16.67); await flush(); }
  for (const b of [].concat(btns)) I._set(b, false);
}
/** 1 歩: 押して、歩き終わるまで待つ */
async function step(btns) {
  await hold(btns, 34);
  for (let i = 0; i < 40 && (S.mv || S.arriving); i++) { adv(16.67); await flush(); }
  await settle(60);
}
/** 暗転（Engine.time で進む）を含む Promise を、時間を進めながら待つ */
async function drive(p, ms) {
  let fin = false, val;
  p.then((v) => { fin = true; val = v; }, (e) => { fin = true; console.error(e); });
  for (let t = 0; t < (ms || 3000) && !fin; t += 16.67) { adv(16.67); await flush(); }
  return val;
}
const at = () => [R.Field.pos.x, R.Field.pos.y];
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

async function main() {
  R.Dev.applyState('field_lab');
  await R.Field.enter('field_lab', 'a', { fade: 0, noAutosave: true });
  await settle(200);

  section('契約（R.Contract）');
  ok('checkApi Field', R.Contract.checkApi('Field').ok, R.Contract.checkApi('Field').errors);
  for (const n of ['Field.camera', 'Field.hud', 'Field.encounter']) ok('checkApi ' + n, R.Contract.checkApi(n).ok, R.Contract.checkApi(n).errors);
  ok('scene is K.scene, id field, opaque', R.Contract.check('scene', R.Field.scene).ok && R.Field.scene.id === 'field' && R.Field.scene.opaque);
  ok('pos is K.pos', R.Contract.check('pos', R.Field.pos).ok, R.Field.pos);
  ok('not using the stub (claimed)', !R.Stubs.installed.Field && !!R.Stubs.claimed.Field);
  ok('top of the stack is the field', R.Engine.top() && R.Engine.top().id === 'field');

  section('トリガー（enter は入るたび、once は 1 回）');
  const C = R._fieldLab;
  ok('enter trigger ran on the first entry', C.enter === 1 && C.once === 1, C);
  await enter('field_lab', 4, 4);
  ok('enter trigger runs again, once-trigger does not', C.enter === 2 && C.once === 1, C);
  ok('once flag is tr_<map>_<id>', R.Game.flags.tr_field_lab_first === true);

  section('8 方向・連続歩行');
  const DIRS = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
  const eight = [['down'], ['up'], ['left'], ['right'], ['down', 'right'], ['down', 'left'], ['up', 'right'], ['up', 'left']];
  for (const d of eight) {
    await enter('field_lab', 4, 10);
    await step(d);
    const v = d.reduce((a, b) => [a[0] + DIRS[b][0], a[1] + DIRS[b][1]], [0, 0]);
    ok('step ' + d.join('+'), same(at(), [4 + v[0], 10 + v[1]]), at());
  }
  await enter('field_lab', 2, 9, 'e');
  const t0 = R.Engine.time;
  await hold('right', 990);
  for (let i = 0; i < 30 && S.mv; i++) { adv(16.67); await flush(); }
  ok('holding right 1 s walks 4 tiles (no stop between steps)', R.Field.pos.x === 6, { x: R.Field.pos.x, ms: R.Engine.time - t0 });
  await enter('field_lab', 2, 9, 'e');
  await hold(['right', 'b'], 700 + 10);
  for (let i = 0; i < 30 && S.mv; i++) { adv(16.67); await flush(); }
  ok('dash (B) is faster: 0.7 s ≥ 4 tiles', R.Field.pos.x >= 6, R.Field.pos);

  section('角を切らない・壁沿いに滑る（A7）');
  await enter('field_lab', 8, 8);
  await step(['up', 'right']);
  ok('NE past a wall corner → slides east, not diagonal', same(at(), [9, 8]), at());
  await enter('field_lab', 7, 4);
  await step(['up', 'right']);
  ok('NE into a wall → slides north along it', same(at(), [7, 3]), at());
  await enter('field_lab', 4, 4);
  await step(['up', 'right']);
  ok('NE with the diagonal cell solid → slides east', same(at(), [5, 4]), at());
  await enter('field_lab', 2, 1, 'n');
  const p0 = at();
  await step('up');
  ok('blocked by the outer wall: stays', same(at(), p0), at());

  section('隊列のなぞり');
  await enter('field_lab', 2, 10, 'e');
  for (let i = 0; i < 4; i++) await step('right');
  const tr = R.Field.trail();
  ok('3 followers', tr.length === 3, tr);
  ok('followers stand on the leader\'s last tiles', same([tr[0].x, tr[0].y], [5, 10]) && same([tr[1].x, tr[1].y], [4, 10]) && same([tr[2].x, tr[2].y], [3, 10]), tr);
  R.Field.setGuest({ id: 'pim', look: 'npc_pim' });
  ok('guest joins at the end of the line (E8)', R.Field.trail().length === 4 && R.Field.trail()[3].guest && R.Game.guest && R.Game.guest.look === 'npc_pim');
  await step('right');
  ok('guest follows', same([R.Field.trail()[3].x, R.Field.trail()[3].y], [4, 10]) || same([R.Field.trail()[3].x, R.Field.trail()[3].y], [3, 10]), R.Field.trail());
  R.Field.setGuest(null);
  ok('guest leaves', R.Field.trail().length === 3 && R.Game.guest === null);

  section('タイル進入で 1 回・歩数');
  await enter('field_lab', 2, 10, 'e');
  let steps = 0;
  const onStep = () => steps++;
  R.on('step', onStep);
  const g0 = R.Game.steps || 0;
  await hold('right', 490);
  for (let i = 0; i < 30 && S.mv; i++) { adv(16.67); await flush(); }
  await settle(600);   // 立ち止まっている間は判定しない
  ok('one step event per tile entered (2 tiles → 2)', steps === 2, steps);
  ok('R.Game.steps counts steps', (R.Game.steps || 0) - g0 === 2, (R.Game.steps || 0) - g0);
  R.off('step', onStep);

  section('NPC を押す（A3）');
  await enter('field_lab', 4, 7, 's');
  const push = S.npcById.lab_push;
  await hold('down', 150);
  ok('a short push only bumps', same([push.x, push.y], [4, 8]) && same(at(), [4, 7]));
  await hold('down', 420);
  await settle(300);
  ok('holding pushes the NPC aside (1 step)', !same([push.x, push.y], [4, 8]) && Math.abs(push.x - 4) + Math.abs(push.y - 8) === 1, [push.x, push.y]);
  if (same(at(), [4, 7])) await step('down');
  ok('… and the way is open', same(at(), [4, 8]), at());
  for (let i = 0; i < 6; i++) await step('down');
  await settle(3600);
  ok('the NPC goes back home after a while', same([push.x, push.y], [4, 8]), [push.x, push.y]);
  await enter('field_lab', 6, 7, 's');
  const rock = S.npcById.lab_rock;
  await hold('down', 900);
  await settle(200);
  ok('pushable:false does not move', same([rock.x, rock.y], [6, 8]) && same(at(), [6, 7]), { npc: [rock.x, rock.y], me: at() });

  section('一方通行（E5）');
  await enter('field_lab', 3, 11, 's');
  await step('down');
  ok('the ledge can be taken in its direction', same(at(), [3, 12]), at());
  await enter('field_lab', 3, 13, 'n');
  await step('up');
  ok('… but not against it', same(at(), [3, 13]), at());
  await enter('field_lab', 2, 11, 's');
  await step(['down', 'right']);
  ok('diagonal into a ledge is not allowed (slides)', !same(at(), [3, 12]), at());

  section('2 つの高さ（足場の下をくぐる・はしご・隊列が高さをなぞる）');
  await enter('field_lab', 15, 6, 'n');
  await step('up'); await step('up');
  ok('lv 0 walks under the deck', same(at(), [15, 4]) && S.lv === 0, { at: at(), lv: S.lv });
  await step('up'); await step('up');
  ok('… across it (still lv 0)', same(at(), [15, 2]) && S.lv === 0, { at: at(), lv: S.lv });
  await enter('field_lab', 12, 3, 'e');
  await step('right');
  ok('onto the ladder (lv stays 0)', same(at(), [13, 3]) && S.lv === 0, { at: at(), lv: S.lv });
  await step('right');
  ok('ladder → deck = lv 1', same(at(), [14, 3]) && S.lv === 1, { at: at(), lv: S.lv });
  await step('right'); await step('right');
  ok('walks on the deck at lv 1', same(at(), [16, 3]) && S.lv === 1);
  await step('down');
  await step('down');
  ok('cannot step off the deck edge at lv 1', same(at(), [16, 4]) && S.lv === 1, { at: at(), lv: S.lv });
  const trl = R.Field.trail();
  ok('followers trace the height (lv 1 on the deck)', trl[0].lv === 1 && same([trl[0].x, trl[0].y], [16, 3]), trl);
  await step('up'); await step('left'); await step('left'); await step('left');
  ok('back to the ladder at lv 1', same(at(), [13, 3]) && S.lv === 1, { at: at(), lv: S.lv });
  await step('left');
  ok('ladder → ground = lv 0', same(at(), [12, 3]) && S.lv === 0, { at: at(), lv: S.lv });
  ok('passable(): deck at lv 1, not plain ground at lv 1', R.Field.passable('field_lab', 15, 3, null, 1) && !R.Field.passable('field_lab', 15, 6, null, 1));

  section('隠し通路（入った瞬間に見つける）');
  let dirty = [];
  const origDirty = R.Terrain.dirty;
  R.Terrain.dirty = function (m, x, y) { dirty.push(x + ',' + y); return origDirty.apply(this, arguments); };
  await enter('field_lab', 7, 5, 'e');
  ok('secret is passable (wall that can be walked)', R.Field.passable('field_lab', 8, 5));
  ok('not found before entering', !R.MapUtil.secretFound('field_lab', 8, 5));
  let found = 0;
  const onSecret = () => found++;
  R.on('secret:found', onSecret);
  await step('right');
  ok('found on entering', R.MapUtil.secretFound('field_lab', 8, 5) && found === 1 && R.Game.secrets.field_lab.includes('8,5'));
  ok('the chunk is re-baked (R.Terrain.dirty at the cell)', dirty.includes('8,5'), dirty);
  await step('left'); await step('right');
  ok('found only once', found === 1 && R.Game.secrets.field_lab.length === 1);
  R.off('secret:found', onSecret);
  R.Terrain.dirty = origDirty;

  section('出現: 歩数・suppress・ward・安全地帯・暗がり（setup.dark）');
  const calls = [];
  const origEnc = R.Mon.encounter;
  R.Mon.encounter = function (zone, o) { calls.push({ zone, o: Object.assign({}, o), at: at() }); return null; };
  await enter('field_lab', 10, 9, 'e');
  await settle(1000);
  ok('standing still: no encounter rolls', calls.length === 0);
  await step('right'); await step('left');
  ok('one roll per step', calls.length === 2, calls.length);
  ok('roll gets tier/dark/steps/ward', calls[0] && typeof calls[0].o.tier === 'number' && typeof calls[0].o.dark === 'boolean' && typeof calls[0].o.steps === 'number' && calls[0].o.ward === false, calls[0]);
  calls.length = 0;
  R.Field.encounter.suppress(3);
  for (let i = 0; i < 4; i++) await step(i & 1 ? 'left' : 'right');
  ok('suppress(3) skips 3 steps', calls.length === 1, calls.length);
  calls.length = 0;
  R.Field.encounter.ward(2);
  for (let i = 0; i < 3; i++) await step(i & 1 ? 'left' : 'right');
  ok('ward(2): the next 2 rolls carry ward:true (BATTLE judges weak tables)', calls.length === 3 && calls[0].o.ward && calls[1].o.ward && !calls[2].o.ward, calls.map((c) => c.o.ward));
  calls.length = 0;
  await enter('field_lab', 5, 5, 'e');
  await step('left'); await step('right');
  ok('no rolls within 3 tiles of a spring', calls.length === 0 && R.Field.safeAt(5, 4) === 'spring' && R.Field.safeAt(7, 4) === null, calls);
  ok('no rolls within 5 tiles of a lit waylamp (E21)', R.Field.safeAt(18, 14) === 'waylamp' && R.Field.safeAt(16, 8) === null && R.Game.lamps.lab_wl === true);
  await enter('field_lab', 19, 14, 'w');
  calls.length = 0;
  await step('left'); await step('right');
  ok('… and stepping there rolls nothing', calls.length === 0, calls);
  // 暗がり
  await enter('field_lab', 14, 9, 'e');
  ok('dark area: party lantern radius 4', R.Field.dark.visibleAt(18, 9) && !R.Field.dark.visibleAt(19, 9) && R.Field.dark.visibleAt(3, 3));
  calls.length = 0;
  await step('right');
  ok('rolls outside a light in the dark carry dark:true', calls[0] && calls[0].o.dark === true, calls[0]);
  ok('brazier unlit: no light', !R.Field.dark.litAt(12, 14));
  await enter('field_lab', 12, 11, 's');
  R.Input._set('a', true); adv(17); await flush(); R.Input._set('a', false); await settle(100);
  ok('A lights the brazier (R.Game.lit)', (R.Game.lit.field_lab || []).includes('lab_b'), R.Game.lit);
  ok('lit brazier: radius 3 stays bright, outside dark', R.Field.dark.litAt(15, 12) && !R.Field.dark.litAt(16, 12) && !R.Field.dark.battleDark(13, 13) && R.Field.dark.battleDark(20, 9));
  R.Mon.encounter = origEnc;

  section('宝箱・泉・床のスイッチ・step のトリガー');
  await enter('field_lab', 10, 9, 's');
  const gold0 = R.Game.gold;
  let opened = 0;
  const onChest = () => opened++;
  R.on('chest:open', onChest);
  R.Input._set('a', true); adv(17); await flush(); R.Input._set('a', false); await settle(100);
  ok('A opens the chest in front (gold)', R.Game.gold === gold0 + 50 && (R.Game.chests.field_lab || []).includes('lab_c') && opened === 1, { gold: R.Game.gold - gold0 });
  R.Input._set('a', true); adv(17); await flush(); R.Input._set('a', false); await settle(100);
  ok('opening twice gives nothing more', R.Game.gold === gold0 + 50 && opened === 1);
  R.off('chest:open', onChest);
  // 宝箱の中身は文の窓で出る（2026-09-27 から。右上の通知ではない）: 窓を閉じてから次へ
  for (let i = 0; i < 4 && R.Field._locked(); i++) { R.Input._set('a', true); adv(17); await flush(); R.Input._set('a', false); await settle(100); }
  ok('chest message closes with A and unlocks the field', !R.Field._locked());
  await enter('field_lab', 4, 2, 'w');
  R.Party.members().forEach((c) => { c.hp = 1; });
  R.Input._set('a', true); adv(17); await flush(); R.Input._set('a', false); await settle(100);
  ok('spring restores (restoreAll) and is remembered', R.Party.members().every((c) => c.hp > 1) && (R.Game.springs.field_lab || []).includes('lab_s'));
  await enter('field_lab', 11, 8, 'n');
  let sw = null;
  const onSw = (e) => { sw = e; };
  R.on('switch', onSw);
  await step('up');
  ok('stepping on a plate switch sets its flag (E7)', R.Game.flags.lab_sw === true && sw && sw.on === true, sw);
  R.off('switch', onSw);
  await enter('field_lab', 9, 4, 'e');
  const st0 = C.step;
  await step('right');
  ok('step trigger fires on entering its tile', C.step === st0 + 1, C);
  await step('left'); await step('right');
  ok('once step trigger fires only once', C.step === st0 + 1, C);

  section('カメラ（端で止まる・小さいマップは中央）');
  await enter('field_world', 1, 1, 's');
  let cam = R.Field._cam({});
  ok('stops at the top-left edge', cam.cx === 0 && cam.cy === 0, cam);
  await enter('field_world', 78, 48, 's');
  cam = R.Field._cam({});
  ok('stops at the bottom-right edge', cam.cx === 80 * 32 - R.W && cam.cy === 50 * 32 - R.H, cam);
  await enter('field_world', 40, 25, 's');
  cam = R.Field._cam({});
  ok('follows the leader in the middle', cam.cx === 40 * 32 + 16 - R.W / 2 && cam.cy === 25 * 32 + 16 - R.H / 2, cam);
  await enter('field_lab', 4, 4);
  cam = R.Field._cam({});
  ok('smaller map is centred', cam.cx === Math.round((24 * 32 - R.W) / 2), cam);
  R.Settings.set('fieldZoom', 'far');
  ok('far = 24 px tiles', R.Field._tile() === 24 && R.Field._charScale() === 0.9);
  R.Settings.set('fieldZoom', 'near');
  ok('near = 40 px tiles', R.Field._tile() === 40 && R.Field._charScale() === 1.4);
  R.Settings.set('fieldZoom', 'normal');
  await enter('field_world', 40, 25, 's');
  const pf = R.Field.camera.focus(45, 25, { ms: 200 });
  await settle(300); await pf;
  cam = R.Field._cam({});
  ok('camera.focus moves to the point', cam.cx === 45 * 32 + 16 - R.W / 2, cam);
  R.Field.camera.follow({ ms: 100 }); await settle(200);
  ok('camera.follow returns to the leader', R.Field._cam({}).cx === 40 * 32 + 16 - R.W / 2);

  section('ワープ・脱出・lastTown・ハブの結果');
  await enter('field_pharos', 24, 16, 's');
  ok('lastTown is K.place', R.Contract.check('place', R.Game.lastTown).ok && R.Game.lastTown.map === 'field_pharos', R.Game.lastTown);
  await R.Field.enter('field_verda', 'entry', { fade: 0, noAutosave: true }); await settle(100);
  const wl = R.Field.warpList();
  ok('warpList: visited town + dungeon entrance', wl.some((w) => w.id === 'field_pharos') && wl.some((w) => w.id === 'field_verda'), wl);
  ok('warpList items are K.warpEntry', wl.every((w) => R.Contract.check('warpEntry', w).ok));
  ok('escape is allowed in a dungeon', R.Field.escapeOk());
  await drive(R.Field.escape()); await settle(100);
  ok('escape leaves the dungeon (entry map\'s outside exit)', R.Field.pos.map === 'field_world', R.Field.pos);
  ok('escape outside a dungeon does nothing', (await drive(R.Field.escape())) === false && R.Field.pos.map === 'field_world');
  await drive(R.Field.warp('field_pharos')); await settle(100);
  ok('warp goes to the location spawn', R.Field.pos.map === 'field_pharos' && R.Field.pos.x === 24 && R.Field.pos.y === 16, R.Field.pos);
  const origOpen = R.Screens.open;
  R.Screens.open = () => Promise.resolve({ warp: 'field_verda' });
  R.Input._set('y', true); adv(17); await flush(); R.Input._set('y', false);
  await settle(800);
  ok('hub result {warp} runs after the menu closes', R.Field.pos.map === 'field_verda' && Object.keys(R.Field.locks()).length === 0, { pos: R.Field.pos, locks: R.Field.locks() });
  R.Screens.open = () => Promise.resolve({ escape: true });
  R.Input._set('y', true); adv(17); await flush(); R.Input._set('y', false);
  await settle(800);
  ok('hub result {escape}', R.Field.pos.map === 'field_world');
  R.Screens.open = origOpen;

  section('戦闘の abort では何もしない');
  const origBattle = R.Battle.start, origEnc2 = R.Mon.encounter;
  R.Mon.encounter = () => ({ troop: 'tr_stub' });
  R.Battle.start = () => Promise.resolve({ result: 'abort', to: 'inn' });
  await enter('field_world', 40, 18, 'w');
  const before = R.Field.pos;
  await step('left');
  await settle(100);
  ok('after an aborted battle: unlocked, same place, no warp', Object.keys(R.Field.locks()).length === 0 && R.Field.pos.map === 'field_world' && R.Field.pos.x === before.x - 1, { locks: R.Field.locks(), pos: R.Field.pos });
  R.Battle.start = origBattle; R.Mon.encounter = origEnc2;

  section('NPC の命令（R.Field.npc）');
  await enter('field_pharos', 24, 18, 's');
  const h = R.Field.npc('ph_hanna');
  ok('npc() has move/face/act/hide/show/setPos', R.Contract.check('fieldNpc', h).ok);
  const mp = h.move([[23, 17], [21, 17]]);
  await settle(1500); await mp;
  ok('move walks the path', same([S.npcById.ph_hanna.x, S.npcById.ph_hanna.y], [21, 17]), [S.npcById.ph_hanna.x, S.npcById.ph_hanna.y]);
  await h.hide();
  ok('hide', !S.npcById.ph_hanna.vis);
  await h.show(); await h.setPos(10, 10); await h.face('n');
  ok('show/setPos/face', S.npcById.ph_hanna.vis && S.npcById.ph_hanna.x === 10 && S.npcById.ph_hanna.dir === 'n');
  ok('unknown npc → no-op handle (no throw)', typeof R.Field.npc('nobody').move === 'function');

  section('話す（A）と新しい話の印');
  await enter('field_pharos', 23, 15, 's');
  let talked = null;
  const onTalk = (e) => { talked = e; };
  R.on('talk', onTalk);
  R.Input._set('a', true); adv(17); await flush(); R.Input._set('a', false); await settle(100);
  ok('A talks to the NPC in front', talked && talked.npc === 'ph_hanna', talked);
  ok('the NPC turns to the party', S.npcById.ph_hanna.dir === 'n');
  R.UIK.Message.close(); await settle(200);
  ok('after talking: unlocked', Object.keys(R.Field.locks()).length === 0 && !R.Events.busy(), R.Field.locks());
  R.off('talk', onTalk);

  section('チャンク（持つ範囲・R.Hd.track・焼き直し）');
  await enter('field_world', 40, 25, 's');
  const cs = R.Field.chunks.stats();
  ok('visible chunks ready after entering (no misses)', cs.ready >= 6 && S.stat.miss === 0, cs);
  const v = R.Field.chunks.view({});
  ok('view covers the screen', (v.x1 - v.x0 + 1) * 8 * 32 >= R.W && (v.y1 - v.y0 + 1) * 8 * 32 >= R.H, v);

  done('test_field');
}
process.on('exit', (c) => { if (!global.__done && c === 0) { console.log('FAIL  test ended early (a Promise never settled)'); process.exitCode = 1; } });
main().then(() => { global.__done = true; }).catch((e) => { console.error(e); process.exit(2); });
