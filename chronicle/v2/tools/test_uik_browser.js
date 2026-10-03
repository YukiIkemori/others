#!/usr/bin/env node
// UIK のブラウザのテスト（V2_PLAN §4.4 の UIK の行）
//   measure のはみ出し（最長の名前・999/999・250/250・14 字の品名）、List のスクロール・フォーカス・cols・マウスとタッチの当たり、
//   Message の早送り・ログ・選択肢・cancel・連続 say・自動送り・下キー・stopVoice、caption、uiScale 1.0/1.3 で窓が画面の中、snapshot、1 フレームの重さ
//   node v2/tools/test_uik_browser.js        （先に node v2/tools/build.js）
'use strict';
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

const ev = B.ev;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ページの中: 一覧のテストの場面を積む
const LIST_SCENE = `(() => {
  const R = RPG, U = R.UIK;
  window.__ev = [];
  const rows = Array.from({ length: 20 }, (_, i) => ({ label: '行 ' + i, disabled: i === 3 }));
  const L = new U.List({ rows, rowH: 34, onSelect: (r, i) => __ev.push('sel' + i), onCancel: () => __ev.push('cancel'), onDetail: (r, i) => __ev.push('det' + i), onFocus: (r, i) => __ev.push('foc' + i) });
  window.__L = L;
  R.Engine.push({ id: 'uik_test', opaque: true, enter() {}, exit() {}, update() { (window.__G || L).update(); },
    draw(g) { g.fillStyle = '#101422'; g.fillRect(0, 0, R.W, R.H); U.panel(g, { x: 90, y: 90, w: 320, h: 190 }); L.draw(g, { x: 100, y: 100, w: 300, h: 170 });
      if (window.__G) window.__G.draw(g, { x: 450, y: 100, w: 300, h: 170 }); } });
  return true;
})()`;
const client = (lx, ly) => `(() => { const c = RPG.Gfx.canvas.getBoundingClientRect(); return { x: c.left + ${lx} / RPG.W * c.width, y: c.top + ${ly} / RPG.H * c.height }; })()`;
async function ptr(p, type, lx, ly, id) {
  await ev(p, `(() => { const c = RPG.Gfx.canvas.getBoundingClientRect(); const x = c.left + ${lx} / RPG.W * c.width, y = c.top + ${ly} / RPG.H * c.height;
    document.dispatchEvent(new PointerEvent('${type}', { pointerType: 'touch', pointerId: ${id || 7}, clientX: x, clientY: y, bubbles: true, isPrimary: true })); })()`);
}

async function main() {
  const S = await B.start();
  try {
    // ================================================================ 16:9
    const P = await B.open(S, 'dev.html?scene=uik_talk');
    const p = P.page;
    await sleep(300);

    section('measure のはみ出し（uiScale 1.0 と 1.3）');
    for (const sc of [1, 1.3]) {
      const r = await ev(p, `(() => { const U = RPG.UIK, T = U.T; RPG.uiScale = ${sc}; const u = U.u;
        const name = U.measure('鬱鬱鬱鬱鬱', { size: u(T.size.title), weight: 700 });
        const item = U.measure('鬱'.repeat(14), { size: u(T.size.body) });
        const hp = U.fracWidth(999, 999, { size: u(T.size.body) }), mp = U.fracWidth(250, 250, { size: u(T.size.body) });
        const fitted = U.fit('とても長い名前の品物がここに入る', u(120), { size: u(T.size.body) });
        const fs = U.fitSize('とても長い名前の品物がここに入る', u(120), { size: u(T.size.body) });
        const out = { name, item, hp, mp, W: T.fitW, u: u(1), fitOk: U.measure(fitted, { size: u(T.size.body) }) <= u(120), fsOk: U.measure(fs.s, { size: fs.size }) <= u(120) };
        RPG.fit && RPG.fit(); return out; })()`);
      ok(`[${sc}] 5 字の名前 ≤ fitW.name`, r.name <= r.W.name * r.u, r);
      ok(`[${sc}] 14 字の品名 ≤ fitW.item`, r.item <= r.W.item * r.u, r);
      ok(`[${sc}] 999/999 ≤ fitW.hp・250/250 ≤ fitW.mp`, r.hp <= r.W.hp * r.u && r.mp <= r.W.mp * r.u, r);
      ok(`[${sc}] fit・fitSize は幅以内`, r.fitOk && r.fsOk, r);
    }
    await ev(p, 'RPG.uiScale = 1, true');

    section('List（キーボード）');
    await ev(p, LIST_SCENE);
    await sleep(150);
    for (let i = 0; i < 7; i++) await B.press(p, 'down');
    let s = await ev(p, '({ i: __L.index, top: __L.top, vis: __L.visible })');
    ok('下 × 7 → index 7、スクロールして見える（top 3）', s.i === 7 && s.top === 3 && s.vis === 5, s);
    await B.press(p, 'a');
    ok('A → onSelect(7)', (await ev(p, '__ev')).includes('sel7'));
    await ev(p, '__L.focusIndex(0), __ev.length = 0, true');
    await B.press(p, 'up');
    s = await ev(p, '({ i: __L.index, top: __L.top })');
    ok('上で先頭から末尾へ回る（index 19、top 15）', s.i === 19 && s.top === 15, s);
    await ev(p, '__L.focusIndex(3), true');
    await B.press(p, 'a');
    ok('使えない行は選べない（onSelect なし）', !(await ev(p, '__ev')).includes('sel3'));
    await B.press(p, 'y');
    ok('Y → onDetail', (await ev(p, '__ev')).includes('det3'));
    await B.press(p, 'b');
    ok('B → onCancel', (await ev(p, '__ev')).includes('cancel'));
    ok('onFocus が動く', (await ev(p, '__ev.some((e) => e.startsWith("foc"))')));

    section('List（cols 3、←→ で列）');
    await ev(p, `window.__G = new RPG.UIK.List({ rows: Array.from({ length: 10 }, (_, i) => ({ label: 'g' + i })), rowH: 34, cols: 3 }), true`);
    await sleep(60);
    await B.press(p, 'right'); await B.press(p, 'right');
    ok('→ × 2 → 2', (await ev(p, '__G.index')) === 2);
    await B.press(p, 'down');
    ok('↓ → 5（1 段下）', (await ev(p, '__G.index')) === 5);
    await B.press(p, 'left');
    ok('← → 4', (await ev(p, '__G.index')) === 4);
    await B.press(p, 'down'); await B.press(p, 'down');
    ok('↓ で下の段が短い → その段の最後（9）', (await ev(p, '__G.index')) === 9, await ev(p, '__G.index'));
    await ev(p, 'window.__G = null, true');

    section('List（マウス）');
    await ev(p, '__L.focusIndex(0), __ev.length = 0, true');
    await sleep(60);
    let c = await ev(p, client(200, 100 + 34 * 2 + 17));
    await p.mouse.move(c.x, c.y); await sleep(80); await p.mouse.move(c.x + 3, c.y); await sleep(120);
    ok('マウスを重ねるとフォーカス（行 2）', (await ev(p, '__L.index')) === 2, await ev(p, '__L.index'));
    await p.mouse.click(c.x, c.y); await sleep(150);
    ok('クリックで決定（sel2）', (await ev(p, '__ev')).includes('sel2'), await ev(p, '__ev'));
    await p.mouse.wheel(0, 120); await sleep(150);
    ok('ホイールでスクロール（top 1）', (await ev(p, '__L.top')) === 1, await ev(p, '__L.top'));

    section('List（タッチ: タップで決定、引きずりはスクロールだけ）');
    await ev(p, '__L.focusIndex(0), __ev.length = 0, true');
    await sleep(60);
    await ptr(p, 'pointerdown', 200, 100 + 34 + 17); await sleep(80); await ptr(p, 'pointerup', 200, 100 + 34 + 17); await sleep(150);
    ok('タップ → sel1', (await ev(p, '__ev')).includes('sel1'), await ev(p, '__ev'));
    await ev(p, '__ev.length = 0, true');
    await ptr(p, 'pointerdown', 200, 250); await sleep(60);
    for (let y = 250; y >= 130; y -= 20) { await ptr(p, 'pointermove', 200, y); await sleep(40); }
    await ptr(p, 'pointerup', 200, 130); await sleep(150);
    s = await ev(p, '({ top: __L.top, ev: __ev })');
    ok('上へ引きずる → スクロール（top ≥ 3）、決定しない', s.top >= 3 && !s.ev.some((e) => e.startsWith('sel')), s);
    await ev(p, 'RPG.Engine.pop(), true');

    section('Message（送り・途中を全部出す・下キー・stopVoice）');
    await ev(p, 'window.__sv = 0, RPG.Audio.stopVoice = () => { __sv++; }, true');
    await ev(p, `window.__r = 'none', RPG.UIK.Message.say({ name: '甲', text: ['${'あ'.repeat(70)}', '二枚目'] }).then((v) => { __r = v; }), true`);
    await sleep(120);
    await B.press(p, 'a');
    s = await ev(p, 'RPG.UIK.Message.state()');
    ok('途中で A → そのページを全部出す', s && s.full && s.page === 0, s);
    const pages = s.pages;
    for (let i = 0; i < pages - 1; i++) await B.press(p, 'a');
    await sleep(120);
    s = await ev(p, 'RPG.UIK.Message.state()');
    ok('A で次のページ（最後のページ）', s && s.page === pages - 1, s);
    await B.press(p, 'down'); await sleep(50); await B.press(p, 'down');
    await sleep(100);
    ok('下キーでも送れる → undefined で解決・閉じる', (await ev(p, '__r')) === undefined && !(await ev(p, 'RPG.UIK.Message.busy()')), await ev(p, '__r'));
    ok('送ると R.Audio.stopVoice()', (await ev(p, '__sv')) >= 2, await ev(p, '__sv'));
    ok('場面 id は message（閉じたら積み上げに無い）', !(await ev(p, 'RPG.Engine.has("message")')));

    section('Message（早送り R）');
    await ev(p, `window.__r = 'none', RPG.UIK.Message.say({ name: '乙', text: ['${'い'.repeat(80)}', '${'う'.repeat(80)}', '${'え'.repeat(40)}'] }).then((v) => { __r = v; }), true`);
    await sleep(100);
    await B.press(p, 'r', 3500);
    await sleep(100);
    ok('R を押し続ける → 最後まで送られて閉じる', (await ev(p, '__r')) === undefined && !(await ev(p, 'RPG.UIK.Message.busy()')), await ev(p, 'RPG.UIK.Message.state()'));

    section('Message（選択肢・cancel・マウス）');
    await ev(p, `window.__r = 'none', RPG.UIK.Message.say({ text: '行く？', choices: ['はい', 'いいえ', 'あとで'] }).then((v) => { __r = v; }), true`);
    await B.waitFor(p, 'RPG.UIK.Message.state().full', 3000);
    await B.press(p, 'down');
    ok('↓ で選ぶ（1）', (await ev(p, 'RPG.UIK.Message.state().choice')) === 1);
    await B.press(p, 'b'); await sleep(80);
    ok('cancel が無ければ B では閉じない', (await ev(p, 'RPG.UIK.Message.busy()')) && (await ev(p, '__r')) === 'none');
    // 選択肢が出てすぐの決定よけは guard: true（物語の大事な分かれ道）だけ（uik/message.js の CHOICE_GUARD。持ち主 2026-10-03）
    await sleep(700);
    await B.press(p, 'a'); await sleep(80);
    ok('A → 1 で解決', (await ev(p, '__r')) === 1, await ev(p, '__r'));
    await ev(p, `window.__r = 'none', RPG.UIK.Message.say({ text: '泊まる？', choices: ['泊まる\\t30 G', 'やめておく'], cancel: 1, guard: true }).then((v) => { __r = v; }), true`);
    await B.waitFor(p, 'RPG.UIK.Message.state().full', 3000);
    await B.press(p, 'a'); await sleep(80);
    ok('選択肢が出てすぐの A は受けない', (await ev(p, 'RPG.UIK.Message.busy()')) && (await ev(p, '__r')) === 'none');
    await sleep(700);
    await B.press(p, 'b'); await sleep(80);
    ok('cancel: 1 → B で 1', (await ev(p, '__r')) === 1, await ev(p, '__r'));
    await ev(p, `window.__r = 'none', RPG.UIK.Message.say({ text: '', choices: ['一', '二', '三'] }).then((v) => { __r = v; }), true`);
    await sleep(700);
    const cr = await ev(p, 'RPG.UIK.Message.state().choiceRect');
    c = await ev(p, client(cr.x + cr.w / 2, cr.y + 8 * 1 + cr.rh * 2.5));
    await p.mouse.click(c.x, c.y); await sleep(150);
    ok('選択肢をクリック → 2', (await ev(p, '__r')) === 2, { r: await ev(p, '__r'), cr });

    // 選択肢だけの窓は直前の会話の名前を借りる。本文もその名前の下に置く（前は名前なしの高さに置かれ、名前に重なって上にずれた。オーナー 2026-10-01「宿で泊まろうとすると 2 個目で文章が上にずれる」）
    section('Message（続けて出す窓で本文の高さが変わらない）');
    await ev(p, `window.__r = 'none', RPG.UIK.Message.say({ name: '宿の主人', title: '砂の縁', text: '砂の縁の宿へようこそ。' }).then((v) => { __r = v; }), true`);
    await B.waitFor(p, 'RPG.UIK.Message.state() && RPG.UIK.Message.state().full', 3000);
    await sleep(60);
    const m1 = await ev(p, 'RPG.UIK.Message.state()');
    await B.press(p, 'a');
    await ev(p, `window.__r = 'none', RPG.UIK.Message.say({ text: '', choices: ['泊まる', 'やめておく'], cancel: 1, face: false }).then((v) => { __r = v; }), true`);
    await B.waitFor(p, 'RPG.UIK.Message.state() && RPG.UIK.Message.state().full', 3000);
    await sleep(60);
    const m2 = await ev(p, 'RPG.UIK.Message.state()');
    ok('選択肢だけの窓: 前の名前を借り、本文は 1 つ目と同じ高さ（上にずれない）', m2.name === '宿の主人' && m1.textY != null && m2.textY === m1.textY && m2.rect.y === m1.rect.y, { m1: [m1.name, m1.textY], m2: [m2.name, m2.textY] });
    await sleep(700); await B.press(p, 'b'); await sleep(80);
    const ysBy = {};
    for (const nm of ['宿の主人', '']) {
      await ev(p, `RPG.UIK.Message.say({ ${nm ? `name: '${nm}', ` : ''}text: ['一枚目', '二枚目', '三枚目'] }), true`);
      const ys = (ysBy[nm] = []);
      for (let i = 0; i < 3; i++) {
        await B.waitFor(p, 'RPG.UIK.Message.state() && RPG.UIK.Message.state().full', 3000);
        await sleep(40);
        ys.push(await ev(p, 'RPG.UIK.Message.state().textY'));
        await B.press(p, 'a');
      }
      ok(`続くページで本文の高さが同じ（名前${nm ? 'あり' : 'なし'}）`, ys.length === 3 && ys.every((y) => y === ys[0] && y != null), ys);
    }
    ok('名前の人 → 地の文と替わっても本文の高さは同じ（上下に跳ねない）', ysBy['宿の主人'][0] === ysBy[''][0] && ysBy[''][0] === m1.textY, ysBy);

    section('Message（連続の say・ログ・自動送り）');
    const chain = await ev(p, `(async () => { const M = RPG.UIK.Message; let a = 'none'; M.say({ name: '丙', text: '一つ目' }).then((v) => { a = v; });
      const p2 = M.say({ name: '丁', text: '二つ目' }); await Promise.resolve(); await Promise.resolve();
      return { a, busy: M.busy(), n: RPG.Engine.stack.filter((s) => s.id === 'message').length }; })()`);
    ok('前の say がまだ開いているときに新しい say → 前は undefined で解決、窓は 1 つ', chain.a === undefined && chain.busy && chain.n === 1, chain);
    await sleep(300);
    await B.press(p, 'x'); await sleep(80);
    ok('X → ログを開く', (await ev(p, 'RPG.UIK.Message.state().log')) === true);
    const lg = await ev(p, 'RPG.UIK.Message.log()');
    ok('ログに話者名つきで残る（丙・丁）', lg.some((e) => e.name === '丙' && e.text === '一つ目') && lg.some((e) => e.name === '丁'), lg.slice(-3));
    await B.press(p, 'x'); await sleep(80);
    ok('X → ログを閉じる', (await ev(p, 'RPG.UIK.Message.state().log')) === false);
    await B.press(p, 'y'); await sleep(50);
    ok('Y → 自動送り', (await ev(p, 'RPG.UIK.Message.auto()')) === true);
    ok('自動送り: 待てば閉じる（1 字 60 ms ＋ 1.2 秒）', await B.waitFor(p, '!RPG.UIK.Message.busy()', 4000));
    await ev(p, `window.__r = 'none', RPG.UIK.Message.say({ text: '選ぶ', choices: ['a', 'b'] }).then((v) => { __r = v; }), true`);
    await sleep(2500);
    ok('自動送りでも選択肢の前では止まる', (await ev(p, 'RPG.UIK.Message.busy()')) && (await ev(p, '__r')) === 'none');
    await B.press(p, 'a');
    await ev(p, 'RPG.UIK.Message.auto(false), true');

    section('caption');
    await ev(p, `window.__r = 'none', RPG.UIK.Message.caption('夜が明けない。', { ms: 500 }).then(() => { __r = 'done'; }), true`);
    ok('場面 id は caption', await ev(p, 'RPG.Engine.top().id === "caption" && RPG.UIK.Message.busy()'));
    ok('ms で自分で閉じる', await B.waitFor(p, '__r === "done" && !RPG.UIK.Message.busy()', 2000));
    await ev(p, `RPG.UIK.Message.caption('送るまで'), true`);
    await sleep(400); await B.press(p, 'a');
    ok('ms なしは A で閉じる', await B.waitFor(p, '!RPG.UIK.Message.busy()', 1500));
    await ev(p, `RPG.UIK.Message.say({ text: 'x' }); RPG.UIK.Message.caption('y'); RPG.UIK.Message.close(); true`);
    ok('close() はどちらも閉じる', !(await ev(p, 'RPG.UIK.Message.busy()')) && !(await ev(p, 'RPG.Engine.has("message") || RPG.Engine.has("caption")')));

    section('窓が画面の中（16:9、uiScale 1.0 と 1.3）');
    for (const size of [1, 1.3]) {
      await ev(p, `RPG.Settings.set('uiSize', ${size}), RPG.fit && RPG.fit(), true`);
      await sleep(100);
      await ev(p, `RPG.UIK.Message.say({ name: 'ロザンナ', title: '宿「かもめ亭」のおかみ', face: 'x', text: '${'お'.repeat(30)}', choices: ['泊まる\\t30 G', 'やめておく'] }), true`);
      await B.waitFor(p, 'RPG.UIK.Message.state() && RPG.UIK.Message.state().full', 4000);
      await sleep(50);
      const st = await ev(p, '({ s: RPG.UIK.Message.state(), W: RPG.W, H: RPG.H, u: RPG.uiScale })');
      const r = st.s.rect, q = st.s.choiceRect;
      ok(`[uiScale ${st.u}] 会話の窓と選択肢が画面の中`, r.x >= 0 && r.x + r.w <= st.W && r.y >= 0 && r.y + r.h <= st.H && q.y >= 0 && q.x + q.w <= st.W && q.y + q.h <= r.y, st);
      await ev(p, 'RPG.UIK.Message.close(), true');
    }
    await ev(p, `RPG.Settings.set('uiSize', 1), RPG.fit && RPG.fit(), true`);

    section('snapshot・toast・重さ');
    const sn = await ev(p, '(() => { const c = RPG.UIK.snapshot(); return c ? { w: c.width, h: c.height, W: RPG.W, H: RPG.H } : null; })()');
    ok('snapshot → 1/4 の canvas', sn && sn.w === Math.round(sn.W / 4) && sn.h === Math.round(sn.H / 4), sn);
    await ev(p, 'RPG.UIK.dropSnapshot(), true');
    const perf = await ev(p, `(() => { const R = RPG, U = R.UIK, g = R.Gfx.g;
      const L = new U.List({ rows: Array.from({ length: 30 }, (_, i) => ({ label: '品物の名前 ' + i, right: '×' + i, icon: 'potion' })), rowH: 34 });
      const N = 200, t0 = performance.now();
      for (let i = 0; i < N; i++) { U.panel(g, { x: 20, y: 20, w: 340, h: 440 }); L.draw(g, { x: 30, y: 30, w: 320, h: 420 }); U.prompts(g, [{ btn: 'a', label: '決定' }, { btn: 'b', label: '戻る' }]); }
      const list = (performance.now() - t0) / N;
      const t1 = performance.now();
      for (let i = 0; i < N; i++) { U.paper(g, { x: 100, y: 380, w: 760, h: 150 }); U.text(g, '灯台の灯が消えてから、夜の海はずっと荒れたまま。', 250, 420, { size: 16.5, color: U.T.color.ink }); }
      return { list, talk: (performance.now() - t1) / N }; })()`);
    console.log('  1 フレーム（desk）: 窓＋一覧 12 行＋ボタン表示 ' + perf.list.toFixed(3) + ' ms、会話の札 ' + perf.talk.toFixed(3) + ' ms');
    ok('メニューの 1 フレーム ≤ 1 ms（§2.10、desk）', perf.list <= 1, perf);
    ok('会話の札の 1 フレーム ≤ 1 ms（desk）', perf.talk <= 1, perf);
    ok('0 console errors（16:9）', P.errors.length === 0, P.errors);
    await P.close();

    // ================================================================ スマホ縦
    const Q = await B.open(S, 'dev.html?scene=uik_talk', { phone: true });
    const q = Q.page;
    await sleep(300);
    await ev(q, `window.__r = 'none', RPG.UIK.Message.say({ name: 'ロザンナ', face: 'x', text: ['${'か'.repeat(20)}', '二'], choices: ['はい', 'いいえ'] }).then((v) => { __r = v; }), true`);
    await sleep(200);
    const st2 = await ev(q, '({ s: RPG.UIK.Message.state(), W: RPG.W, H: RPG.H, u: RPG.uiScale, layout: RPG.layout })');
    ok('縦持ち: uiScale 1.3・会話の窓が幅いっぱいで画面の中', st2.layout === 'tall' && st2.u >= 1.3 && st2.s.rect.x >= 0 && st2.s.rect.x + st2.s.rect.w <= st2.W && st2.s.rect.w > st2.W * 0.85 && st2.s.rect.y + st2.s.rect.h <= st2.H, st2);
    const rr = st2.s.rect;
    await q.touchscreen.tap(...Object.values(await ev(q, client(rr.x + rr.w / 2, rr.y + rr.h / 2))));
    await sleep(150);
    await q.touchscreen.tap(...Object.values(await ev(q, client(rr.x + rr.w / 2, rr.y + rr.h / 2))));
    await sleep(200);
    ok('縦持ち: タップで全部出す → 次のページ', (await ev(q, 'RPG.UIK.Message.state().page')) === 1, await ev(q, 'RPG.UIK.Message.state()'));
    await B.waitFor(q, 'RPG.UIK.Message.state().full', 3000);
    const cr2 = await ev(q, 'RPG.UIK.Message.state().choiceRect');
    await B.waitFor(q, 'RPG.UIK.Message.state().armed', 3000);   // 出てすぐの決定は受けない（CHOICE_GUARD）
    await q.touchscreen.tap(...Object.values(await ev(q, client(cr2.x + cr2.w / 2, cr2.y + 8 * 1.3 + cr2.rh * 1.5))));
    await sleep(200);
    ok('縦持ち: 選択肢をタップ → 1', (await ev(q, '__r')) === 1, await ev(q, '__r'));
    ok('0 console errors（縦持ち）', Q.errors.length === 0, Q.errors);
    await Q.close();
  } finally { await B.stop(S); }
  done('test_uik_browser');
}
main().catch((e) => { console.error(e); process.exit(2); });
