// The ending (DESIGN §10.11, §11.9). Owner: story (A19). Called by archive_6_boss after ネムレア falls:
//   await ev.ending()  →  R.Ending.start()  (runs inline in the calling event)
//
//   E1 虚ろの間     ネムレア is named and sleeps: white light drawn into the chronicle
//   E2 同上         フィーネ returns into the story
//   E3 大書庫の前   ラザロ wakes; ロウェル gives him a shoulder            (archive_1, the entrance hall)
//   E4 ビブリア     the town remembers; ノア sings ミラ's song             (biblia, the plaza)
//   E5 後日談       each companion in the party: sprite ×2 at (24,72), name (72,72), epilogue (72,92+14k)
//   E6 その後       ロウェル goes out to gather tales; ラザロ copies old books by hand beside ミラ's portrait
//   E7 ロアの里     ベルナ tells the children a storyteller's story → 終章『語り部の旅』 (size-16 caption + chapter)
//   E8 クレジット   black, rising 0.3px/frame (hold A/B to hurry); the logo and © Studio Metem held 180 frames
//   E9 後日         「ねえ、フィーネって誰？」「それは、また別のお話。」 → 「――おしまい」
//   E10 記録        gameClear, game_clear, clearCount+1, position/respawn = DB.config.postgameStart,
//                   objective obj_s_postgame → offer to save → the title screen
// BGM `ending` from E1 to the end (§11.9). Field scenes are played on the real maps with stand-ins (R.Story.actor);
// the cards, the credits and 「おしまい」 are drawn by EndingLayer (opaque, over the field).
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const In = () => R.Input;
  const S = () => R.Story;
  const said = (id, t) => (R.Story ? R.Story.said(id, t) : t);

  // ------------------------------------------------------------ the credits (§11.9)
  const CREDITS = [
    ['title', 'ルミナス・クロニクル'],
    ['sub', '〜八つの伝承〜'],
    ['gap', 3],
    ['head', '企画・制作'], ['name', 'Studio Metem'], ['gap', 1],
    ['head', 'シナリオ'], ['name', 'Studio Metem'], ['gap', 1],
    ['head', 'プログラム'], ['name', 'Studio Metem'], ['gap', 1],
    ['head', 'ドット絵'], ['name', 'Studio Metem'], ['gap', 1],
    ['head', '音楽・効果音'], ['name', 'Studio Metem'], ['gap', 1],
    ['head', 'テストプレイ'], ['name', 'Studio Metem'], ['gap', 3],
    ['head', 'フォント'], ['name', 'DotGothic16'], ['small', '（SIL Open Font License）'], ['gap', 3],
    ['name', 'そして、ルミナス・クレストの'], ['name', '三人の勇者を名付けてくれたあなたへ'], ['gap', 4],
    ['name', R.COPYRIGHT || '© Studio Metem'],
  ];
  const LH = { title: 26, sub: 18, head: 16, name: 16, small: 14 };

  // ------------------------------------------------------------ small drawing helpers
  function sheetFrame(key, dir, f) {
    if (!key || !G().has(key)) return null;
    const s = G().get(key);
    if (!s) return null;
    if (s.getContext || s.width) return s;
    if (Array.isArray(s)) return s[(f || 0) % s.length];
    const a = s[dir] || s.down || s[Object.keys(s)[0]];
    return Array.isArray(a) ? a[(f || 0) % a.length] : a;
  }
  const spriteOf = (c) => (R.Party && R.Party.spriteKey ? R.Party.spriteKey(c) : 'party:' + c.id);
  let logoCache = null;
  /** the title logo (the same size as the title screen, §11.8.1) */
  function logo() {
    if (logoCache) return logoCache;
    const S2 = R.SCALE || 4, size = 64 / 3;
    const text = R.TITLE || 'ルミナス・クロニクル';
    const tmp = G().makeCanvas(8, 8).getContext('2d');
    tmp.font = size * S2 + 'px ' + G().FONT;
    const tw = Math.ceil(tmp.measureText(text).width / S2);
    const pad = 4;
    const cv = G().makeCanvas((tw + pad * 2) * S2, Math.ceil(size + pad * 2) * S2);
    const c = cv.getContext('2d');
    c.scale(S2, S2);
    c.font = size + 'px ' + G().FONT;
    c.textBaseline = 'top';
    c.lineJoin = 'round';
    c.fillStyle = '#1a1238';
    c.fillText(text, pad + 1, pad + 1.25);
    c.strokeStyle = '#3a2a60';
    c.lineWidth = 1.5;
    c.strokeText(text, pad, pad);
    const gr = c.createLinearGradient(0, pad + 2, 0, pad + size);
    gr.addColorStop(0, '#fffdf0'); gr.addColorStop(0.45, '#fff4c8'); gr.addColorStop(0.55, '#f8e4a8'); gr.addColorStop(1, '#fff0c0');
    c.fillStyle = gr;
    c.fillText(text, pad, pad);
    return (logoCache = { cv, w: cv.width / S2, h: cv.height / S2, pad });
  }
  /** the thin gold rule with diamonds (as the title screen) */
  function rule(cx, y, half) {
    const g = G();
    g.rect(cx - half, y, half * 2, 1, '#c8a040');
    g.rect(cx - half + 20, y + 1, half * 2 - 40, 1, '#5a4420');
    for (const x of [cx - half, cx, cx + half - 1]) { g.rect(x - 1, y - 1, 3, 3, '#c8a040'); g.rect(x, y, 1, 1, '#fff0b0'); }
  }
  /** motes of pale light drifting up (the ending's cards and credits) */
  function makeMotes(n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push({ x: R.U.rf(0, R.W), y: R.U.rf(0, R.H), v: R.U.rf(0.08, 0.3), p: R.U.rf(0, 6.28) });
    return out;
  }
  function drawMotes(ms, t, alpha) {
    const g = G(), c = g.ctx;
    for (const m of ms) {
      m.y -= m.v;
      if (m.y < -4) { m.y = R.H + 2; m.x = R.U.rf(0, R.W); }
      c.globalAlpha = alpha * (0.35 + 0.35 * Math.sin(m.p + t / 40));
      g.rect(Math.round(m.x + Math.sin(m.p + t / 90) * 3), Math.round(m.y), 1, 1, '#fff4c8');
    }
    c.globalAlpha = 1;
  }

  // ------------------------------------------------------------ the layer (cards, credits, the end)
  class EndingLayer extends R.Layer {
    constructor() {
      super();
      this.opaque = true;
      this.t = 0;
      this.scene = null;
      this.onA = null;
      this.motes = makeMotes(26);
    }
    tick() { this.t++; if (this.scene && this.scene.tick) this.scene.tick(this); }
    update() {
      if (this.onA && (In().pressed('a') || In().pressed('b'))) { const r = this.onA; this.onA = null; R.sfx('confirm_soft'); r(true); }
    }
    draw() {
      G().clear('#000');
      if (this.scene && this.scene.draw) this.scene.draw(this);
    }
    /** resolves on A/B, or after n frames */
    wait(n) {
      return new Promise((res) => {
        let done = false;
        const fin = (v) => { if (!done) { done = true; this.onA = null; res(v); } };
        this.onA = fin;
        if (n) R.Engine.wait(n).then(() => fin(false));
      });
    }
  }

  /** E5/E6: a figure (×2) and its lines, on black (§11.9) */
  function card(o) {
    return {
      t0: null,
      draw(L) {
        if (this.t0 == null) this.t0 = L.t;
        const g = G(), c = g.ctx, k = Math.min(1, (L.t - this.t0) / 30);
        drawMotes(L.motes, L.t, 0.6);
        c.globalAlpha = k;
        if (o.head) g.text(o.head, 128, 36, { align: 'center', color: g.C.gold, shadow: '#000' });
        const img = sheetFrame(o.sprite, 'down', Math.floor(L.t / 30) % 2);
        if (img) {
          g.rect(20, 68, 40, 56, '#0c1026');
          g.strokeRect(20, 68, 40, 56, '#3a4270');
          g.draw(img, 24 + (32 - img.width * 2) / 2, 72 + (48 - img.height * 2), { w: img.width * 2, h: img.height * 2 });
        }
        g.text(o.name, 72, 72, { color: g.C.gold, shadow: '#000' });
        // the lines beside the figure (§11.9); a line too wide for that column goes, centred, under it
        const lines = o.lines.map((ln) => (R.Text && R.Text.fmt ? R.Text.fmt(ln) : ln));
        const wide = lines.some((ln) => g.textWidth(ln) > R.W - 72 - 1);
        lines.forEach((ln, i) => {
          if (wide) g.text(ln, 128, 132 + 14 * i, { align: 'center', color: '#ffffff', shadow: '#000' });
          else g.text(ln, 72, 92 + 14 * i, { color: '#ffffff', shadow: '#000' });
        });
        c.globalAlpha = 1;
      },
    };
  }

  /** E8: the rising credits → resolves when the last line has come to rest */
  function credits(done, walkers) {
    let h = 0;
    const items = CREDITS.map(([kind, v]) => {
      const it = { kind, v, y: h };
      h += kind === 'gap' ? v * 12 : LH[kind] || 16;
      return it;
    });
    const stopAt = items[items.length - 1].y - 96;
    return {
      pos: -R.H,
      hold: 0,
      walk: 0,
      finished: false,
      tick() {
        const fast = In().down('a') || In().down('b');
        this.walk += 1;
        if (this.pos < stopAt) { this.pos = Math.min(stopAt, this.pos + (fast ? 1.5 : 0.3)); return; }
        if (!this.finished && ++this.hold > 150) { this.finished = true; done(); }
      },
      draw(L) {
        const g = G(), c = g.ctx;
        drawMotes(L.motes, L.t, 0.8);
        for (const it of items) {
          const y = Math.round(it.y - this.pos);
          if (y < -24 || y > R.H - 36) continue;
          c.globalAlpha = Math.max(0, Math.min(1, (y + 8) / 36, (R.H - 40 - y) / 30));
          if (it.kind === 'title') g.text(it.v, 128, y, { align: 'center', size: 16, color: '#fff4c8', shadow: '#3a2a60' });
          else if (it.kind === 'sub') g.text(it.v, 128, y, { align: 'center', color: '#e0d8ff', shadow: '#000' });
          else if (it.kind === 'head') g.text(it.v, 128, y, { align: 'center', color: g.C.gold, shadow: '#000' });
          else if (it.kind === 'name') g.text(it.v, 128, y, { align: 'center', color: '#ffffff', shadow: '#000' });
          else if (it.kind === 'small') g.text(it.v, 128, y, { align: 'center', size: 8, color: '#c8c8e0', shadow: '#000' });
        }
        c.globalAlpha = 1;
        // the party walks along the bottom, a storyteller and her companions on the road
        const span = R.W + 90;
        g.rect(0, R.H - 30, R.W, 1, '#1c2040');
        walkers.forEach((key, i) => {
          const img = sheetFrame(key, 'right', Math.floor(this.walk / 10) % 2);
          if (!img) return;
          const x = ((this.walk * 0.3 - i * 20) % span + span) % span - 40;
          g.draw(img, Math.round(x), R.H - 30 - img.height + 1);
        });
      },
    };
  }

  /** after the credits: the logo, the rule, the subtitle and © held (§11.9) */
  function logoCard() {
    return {
      t0: null,
      draw(L) {
        if (this.t0 == null) this.t0 = L.t;
        const g = G(), c = g.ctx;
        drawMotes(L.motes, L.t, 0.8);
        c.globalAlpha = Math.min(1, (L.t - this.t0) / 60);
        const lg = logo();
        g.draw(lg.cv, 128 - lg.w / 2, 80 - lg.pad, { w: lg.w, h: lg.h });
        rule(128, 103, 100);
        g.text(R.SUBTITLE || '〜八つの伝承〜', 128, 108, { align: 'center', color: '#e0d8ff', shadow: '#1a1238' });
        g.text(R.COPYRIGHT || '© Studio Metem', 128, 180, { align: 'center', color: '#c8c8e0', shadow: '#000' });
        c.globalAlpha = 1;
      },
    };
  }
  /** 「――おしまい」 */
  function fin() {
    return {
      t0: null,
      draw(L) {
        if (this.t0 == null) this.t0 = L.t;
        const g = G(), c = g.ctx;
        drawMotes(L.motes, L.t, 0.6);
        c.globalAlpha = Math.min(1, (L.t - this.t0) / 80);
        g.text('――おしまい', 128, 100, { align: 'center', size: 16, color: '#ffffff', shadow: '#1a1040' });
        c.globalAlpha = 1;
      },
    };
  }

  // ------------------------------------------------------------ field scenes
  const actor = (ev, id, spr, x, y, dir) => (R.Story ? R.Story.actor(ev, id, spr, x, y, dir) : ev.npc(id));
  const drop = () => { if (R.Story) R.Story.dropActors(); };
  const onField = () => !!(R.Field && R.Field.map);

  /** fade to black (30 frames, §11.9), move, stage, fade in */
  async function goto(ev, map, at, stage) {
    ev.closeMessage();
    await ev.fadeOut(30);
    drop();
    if (onField()) await ev.warp(map, at, { fade: false });
    if (R.Field && R.Field.layer) R.Field.layer.banner = null;
    const out = onField() && stage ? stage() : {};
    ev.refresh();
    await ev.wait(10);
    await ev.fadeIn(30);
    return out || {};
  }

  // E1 · E2: the hall of the void
  async function voidHall(ev) {
    const m = onField() ? R.Field.map : null;
    const boss = m && m.npc('boss');
    await ev.wait(30);
    await ev.say(said('nemrea', '名を……呼ばれたのは……\nはじめてだ……。'));
    await ev.say(said('nemrea', '……ああ……\n眠い……。'));
    ev.closeMessage();
    ev.sfx('holy');
    await ev.flash('#ffffff', 20);
    if (boss) { boss.hidden = true; boss.present = false; }
    await ev.flash('#ffffff', 12);
    await ev.say('ネムレアの姿は、白い光に\nなって、年代記の中へ\n吸い込まれていった。');
    ev.sfx('quill');
    await ev.say('年代記の最後のページに、\nひとつの名が、静かに\n書き記されていた。');
    ev.closeMessage();
    let fine = m && m.npc('st_fine');
    if (m && !fine) {
      const p = R.Field.pos();
      fine = actor(ev, 'st_fine', 'npc:fine_fade', p.x + 1, p.y - 1, 'down');
    }
    const f = fine ? ev.npc('st_fine') : null;
    if (f) f.face('player');
    await ev.say(said('fine', 'ありがとう、{hero}。\nこれで王は、物語の中で\n眠り続ける。'));
    await ev.say(said('fine', 'わたしも、物語に還る時間。'));
    await ev.say(said('fine', '……語り継いでね。\nわたしのことも、\nあなたの旅のことも。'));
    ev.closeMessage();
    ev.sfx('light');
    await ev.flash('#fffbe0', 24);
    if (f) f.hide();
    await ev.flash('#ffffff', 16);
    await ev.say('フィーネは、光になって\n消えていった。');
    ev.closeMessage();
    await ev.wait(40);
  }

  // E3: in front of the archive (its entrance hall)
  async function archiveGate(ev) {
    const st = await goto(ev, 'archive_1', { x: 19, y: 29, dir: 'up' }, () => ({
      lz: actor(ev, 'st_lazaro', 'npc:lazaro', 19, 27, 'down'),
      rw: actor(ev, 'st_rowell', 'npc:rowell', 22, 28, 'left'),
    }));
    await ev.wait(30);
    await ev.say('大書庫の入口で、\nラザロが目を覚ました。');
    await ev.say(said('lazaro', '……ミラ。\nああ、ミラ……。'));
    ev.closeMessage();
    if (st.rw) { await st.rw.walk('L2'); st.rw.face('left'); }
    await ev.say('ロウェルが、ラザロに\nそっと肩を貸した。');
    await ev.say(said('rowell', '帰りましょう、院長。\n……ミラさんの話を、\n聞かせてください。'));
    ev.closeMessage();
    await ev.wait(40);
  }

  // E4: ビブリア remembers
  async function bibliaMorning(ev) {
    const st = await goto(ev, 'biblia', { x: 24, y: 25, dir: 'up' }, () => ({
      noa: actor(ev, 'st_noa', 'npc:woman', 24, 23, 'down'),
      kid: actor(ev, 'st_kid', 'npc:boy', 21, 24, 'right'),
      mom: actor(ev, 'st_mom', 'npc:woman', 26, 22, 'down'),
    }));
    await ev.wait(30);
    await ev.say('ビブリアの町の人たちが、\nひとり、またひとりと、\n名前を思い出していく。');
    if (st.kid) { await st.kid.walk('R'); st.kid.face('up'); }
    await ev.say('お母さん！　ぼく、\n自分の名前、思い出したよ！');
    if (st.mom) { await st.mom.walk('D'); st.mom.face('left'); }
    await ev.say('ええ……ええ！\nちゃんと、呼んであげる。\n何度でも。');
    ev.closeMessage();
    if (st.noa) st.noa.face('up');
    await ev.say('ノア「ミラ。あなたの歌、\nみんなに届いたよ。」');
    ev.closeMessage();
    await ev.caption('♪　白い本のページに、\nあなたの名を書こう\n忘れないように、なくさぬように', { frames: 240 });
    await ev.wait(20);
  }

  // E7: ロアの里 — the chronicle's last chapter
  async function roaTale(ev) {
    const st = await goto(ev, 'roa', { x: 25, y: 19, dir: 'left' }, () => ({
      berna: actor(ev, 'st_berna', 'npc:berna', 22, 17, 'down'),
      a: actor(ev, 'st_kid_a', 'npc:girl', 21, 19, 'up'),
      b: actor(ev, 'st_kid_b', 'npc:boy', 22, 19, 'up'),
      c: actor(ev, 'st_kid_c', 'npc:girl', 23, 19, 'up'),
    }));
    await ev.wait(30);
    await ev.say('ロアの里の語り石のそばで、\nベルナが子どもたちに\n物語を語っていた。');
    await ev.say(said('berna', 'これは、ある語り部の物語。'));
    await ev.say(said('berna', 'その語り部の名は、{hero}。'));
    ev.closeMessage();
    ev.sfx('quill');
    await ev.wait(30);
    const j = R.jingle('chapter');
    await Promise.all([ev.caption('年代記に、終章\n『語り部の旅』が記された。', { size: 16, frames: 240, highlight: '『語り部の旅』' }), Promise.resolve(j)]);
    await ev.caption('それは、九つ目の\n伝承になった。', { frames: 150 });
    if (st.a) st.a.face('right');
    await ev.say('子ども「海の向こうにも、伝説って\nあるの？」');
    await ev.say(said('berna', 'あるとも。三人の勇者が、\n魔王を倒したお話がね。'));
    await ev.say(said('berna', 'でも、それはまた今度。\n今日は、{hero}の話の\n続きをしようね。'));
    ev.closeMessage();
    await ev.wait(40);
  }

  // E9: some days later
  async function someDaysLater(ev) {
    const st = await goto(ev, 'roa', { x: 25, y: 19, dir: 'left' }, () => ({
      berna: actor(ev, 'st_berna', 'npc:berna', 22, 17, 'down'),
      a: actor(ev, 'st_kid_a', 'npc:girl', 22, 18, 'up'),
    }));
    await ev.caption('それから、しばらくして――');
    await ev.say('子ども「ねえ、フィーネって誰？」');
    if (st.berna) { st.berna.face('up'); await ev.wait(40); st.berna.face('down'); }
    await ev.say(said('berna', 'それは、また別のお話。'));
    ev.closeMessage();
    await ev.wait(60);
  }

  // ------------------------------------------------------------ E10: the clear record
  function record() {
    const g = R.Game;
    if (!g) return;
    g.gameClear = true;
    R.State.setFlag('game_clear');
    g.clearCount = (g.clearCount || 0) + 1;
    for (const f of ['st_show_rival', 'st_show_fine', 'st_show_extra']) if (R.State.flag(f)) R.State.setFlag(f, false);
    const pg = (R.DB.config && R.DB.config.postgameStart) || { map: 'roa', spawn: 'entrance' };
    g.onShip = false;
    g.pos = { map: pg.map, spawn: pg.spawn, dir: 'up' };
    g.respawn = { map: pg.map, spawn: pg.spawn };
    g.objective = 'obj_s_postgame';
    R.State.healAll({ reserve: true });
    R.emit('objective', 'obj_s_postgame', null);
  }
  // ------------------------------------------------------------ the whole sequence
  async function play(ev) {
    if (R.Story && R.Story.autoPos) R.Story.autoPos(ev);
    R.UI.closeMessage();
    R.bgm('ending', { fade: 60 });
    await voidHall(ev);
    ev.heal();
    await archiveGate(ev);
    await bibliaMorning(ev);

    // E5 · E6 on cards
    ev.closeMessage();
    await ev.fadeOut(30);
    const L = new EndingLayer();
    R.Engine.push(L);
    try {
      await ev.fadeIn(30);
      const comps = (R.Game.party || []).filter((c) => c.id !== 'hero');
      L.scene = { draw(Lr) { drawMotes(Lr.motes, Lr.t, 0.8); G().text('――そして、仲間たちは', 128, 104, { align: 'center', color: '#e0d8ff', shadow: '#000' }); } };
      await L.wait(120);
      for (const c of comps) {
        const d = (R.DB.companions && R.DB.companions[c.id]) || {};
        const text = d.epilogue || '';
        L.scene = card({ sprite: spriteOf(c), name: c.name, lines: text.split('\n').slice(0, 3) });
        await L.wait(150);
      }
      L.scene = card({ sprite: 'npc:rowell', name: 'ロウェル', lines: ['記録院をやめ、見習いの', '語り部として旅に出た。', '「覚えて、語るために」'] });
      await L.wait(150);
      L.scene = card({ sprite: 'npc:lazaro', name: 'ラザロ', lines: ['小さな部屋で、ミラの肖像画の', 'そばに座り、古い本を', '手で書き写している。'] });
      await L.wait(170);
      R.Engine.remove(L);
    } catch (e) { R.Engine.remove(L); throw e; }

    await roaTale(ev);

    // E8: the credits, then the logo
    ev.closeMessage();
    await ev.fadeOut(40);
    const walkers = (R.Game.party || []).map(spriteOf);
    R.Engine.push(L);
    L.scene = null;
    try {
      await new Promise((res) => { L.scene = credits(res, walkers); R.Engine.fadeIn(40); });
      await ev.fadeOut(40);
      L.scene = logoCard();
      await ev.fadeIn(40);
      await ev.wait(180);
      await ev.fadeOut(40);
      R.Engine.remove(L);
    } catch (e) { R.Engine.remove(L); throw e; }

    await someDaysLater(ev);

    // 「――おしまい」
    await ev.fadeOut(40);
    drop();
    R.Engine.push(L);
    L.scene = fin();
    await ev.fadeIn(40);
    await L.wait(0);

    // E10
    record();
    L.scene = { draw(Lr) { drawMotes(Lr.motes, Lr.t, 0.6); G().text('――おしまい', 128, 100, { align: 'center', size: 16, color: '#ffffff', shadow: '#1a1040' }); } };
    const yes = await R.UI.yesno('冒険の記録を書き記しますか？\nつづきからは、ロアの里で\n再開できます。');
    R.UI.closeMessage();
    if (yes) {
      if (R.Menu && R.Menu.saveScreen) await R.Menu.saveScreen({ ending: true, noCode: true });
      else if (R.Save && R.Save.save) await R.Save.save(R.Save.lastSlot || 0, R.State.serialize());
    }
    R.UI.closeMessage();
    await R.Engine.fadeOut(60);
    R.Engine.remove(L);
    if (R.Title && R.Title.start) R.Title.start();
  }

  R.Ending = {
    CREDITS,
    EndingLayer,
    record,
    /** the scenes one by one (screenshots / tests): voidHall archiveGate bibliaMorning roaTale someDaysLater */
    scenes: { voidHall, archiveGate, bibliaMorning, roaTale, someDaysLater },
    card, credits, logoCard, fin,
    /** play the whole ending (inline when called from a running event) */
    start() { return R.Events.run((ev) => play(ev)); },
  };
})(window.RPG);
