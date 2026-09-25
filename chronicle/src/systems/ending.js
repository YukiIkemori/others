// Ending (DESIGN §7.4): called by the last boss event via ev.ending() →
// R.Ending.start(). Sequence: black narration → the throne room of Regnas
// (field renderer, celebrating NPCs with cond 'game_clear') and the king's
// thanks → epilogues for Yuki / Non / Metem over battle backdrops → scrolling
// credits over a starry sky with the party walking → "おわり" → offer to save
// the cleared game (restarts in the throne room) → title screen.
//   await R.Ending.start()
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const In = () => R.Input;

  const CREDITS = [
    ['title', 'ルミナス・クレスト'],
    ['gap', 3],
    ['head', 'Director'], ['name', 'Claude'], ['gap', 2],
    ['head', 'Programming'], ['name', 'Claude'], ['gap', 2],
    ['head', 'Art'], ['name', 'Claude'], ['gap', 2],
    ['head', 'Music'], ['name', 'Claude'], ['gap', 2],
    ['head', 'Font'], ['name', 'DotGothic16 (SIL OFL)'], ['gap', 2],
    ['head', 'Special thanks'], ['name', '{yuki}・{non}・{metem}'], ['gap', 3],
    ['name', 'そして、遊んでくれた'], ['name', 'あなたに'], ['gap', 1],
    ['head', 'ありがとう！'],
  ];

  const EPILOGUES = [
    { who: ['yuki'], bg: 'bbg:grass', text: [
      '{yuki}はレグナスの騎士団に\n迎えられた。',
      '父の剣を受け継いだ彼は、\n今も国を守る立派な騎士として\n戦い続けている。',
    ] },
    { who: ['non'], bg: 'bbg:shrine', text: [
      '{non}は、自分を育ててくれた\n神殿へと帰っていった。',
      '傷ついた人々を癒やす彼女の笑顔は、\nいつしか「町の光」と\n呼ばれるようになった。',
    ] },
    { who: ['metem'], bg: 'bbg:tower', text: [
      '{metem}は、アルカナの魔法学院で\n史上最年少の教師になった。',
      '星を見上げる彼女の手には、\n新しい魔法の書。\f「次は、わたしが\n伝説をつくる番よ！」',
    ] },
    { who: ['yuki', 'non', 'metem'], bg: 'bbg:hills', text: [
      'そして3人は、ときおり集まっては、\n旅の思い出を語り合うのだった。',
    ] },
  ];

  // ------------------------------------------------------------ art (cached)
  let skyCache = null;
  function sky() {
    if (skyCache) return skyCache;
    const cv = G().makeCanvas(R.W, R.H), c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, R.H);
    g.addColorStop(0, '#02030c');
    g.addColorStop(0.6, '#0a1236');
    g.addColorStop(1, '#1c2350');
    c.fillStyle = g;
    c.fillRect(0, 0, R.W, R.H);
    // distant hills and the ground strip the party walks on
    c.fillStyle = '#0c1430';
    for (let x = 0; x < R.W; x++) {
      const h = 18 + Math.round(8 * Math.sin(x / 23) + 5 * Math.sin(x / 9 + 1));
      c.fillRect(x, R.H - 34 - h, 1, h);
    }
    c.fillStyle = '#10204a'; c.fillRect(0, R.H - 34, R.W, 34);
    c.fillStyle = '#1a3060'; c.fillRect(0, R.H - 34, R.W, 2);
    return (skyCache = cv);
  }
  function makeStars(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ x: Math.floor(R.U.rf(0, R.W)), y: Math.floor(R.U.rf(0, R.H - 60)), p: R.U.rf(0, 6.28), s: R.U.rf(0.02, 0.07), b: R.U.r() });
    }
    return out;
  }
  function drawStars(stars, t) {
    for (const s of stars) {
      G().ctx.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.p + t * s.s)) * (0.4 + 0.6 * s.b);
      G().rect(s.x, s.y, s.b > 0.85 ? 2 : 1, s.b > 0.85 ? 2 : 1, s.b > 0.6 ? '#fff6d8' : '#c8d4ff');
    }
    G().ctx.globalAlpha = 1;
  }
  function frame(key, dir, f) {
    const s = G().get(key);
    if (!s) return null;
    if (s.getContext) return s;
    const a = s[dir] || s.down;
    return Array.isArray(a) ? a[f % a.length] : a;
  }
  const partyKey = (id) => {
    const c = R.Game && R.State.char(id);
    return 'party:' + id + ':' + ((c && c.job) || (R.DB.chars[id] && R.DB.chars[id].startJob) || 'warrior');
  };

  // ------------------------------------------------------------ the layer
  class EndingLayer extends R.Layer {
    constructor() {
      super();
      this.opaque = true;
      this.t = 0;
      this.scene = null;
      this.onA = null;
    }
    tick() {
      this.t++;
      if (this.scene && this.scene.tick) this.scene.tick(this);
    }
    update() {
      if (this.onA && In().pressed('a')) { const r = this.onA; this.onA = null; R.sfx('confirm_soft'); r(); }
    }
    draw() {
      G().clear('#000');
      if (this.scene && this.scene.draw) this.scene.draw(this);
    }
    waitA() { return new Promise((res) => { this.onA = res; }); }
  }

  /** centred lines fading in on black */
  function narration(lines) {
    return {
      t0: 0,
      draw(L) {
        const k = Math.min(1, (L.t - this.t0) / 50);
        G().ctx.globalAlpha = k;
        const y0 = (R.H - lines.length * 16) / 2;
        lines.forEach((l, i) => G().text(l, R.W / 2, y0 + i * 16, { align: 'center', color: '#e8ecff', shadow: '#000' }));
        G().ctx.globalAlpha = 1;
      },
    };
  }

  /** a battle backdrop with the characters standing on it (message window below) */
  function epilogue(ep) {
    return {
      draw(L) {
        let bg = G().get(ep.bg);
        if (Array.isArray(bg)) bg = bg[Math.floor(L.t / 16) % bg.length];
        if (bg) G().draw(bg, 0, 0);
        const n = ep.who.length, gap = 44;
        ep.who.forEach((id, i) => {
          const img = frame(partyKey(id), 'down', Math.floor(L.t / 24) + i);
          if (!img) return;
          const w = img.width * 2, h = img.height * 2;
          const cx = R.W / 2 + (i - (n - 1) / 2) * gap;
          G().draw(img, Math.round(cx - w / 2), 128 - h, { w, h });
        });
        G().rect(0, 144, R.W, R.H - 144, '#000');
      },
    };
  }

  /** scrolling credits over the night sky; the party walks along the bottom */
  function credits(done) {
    const stars = makeStars(70);
    let h = 0;
    const items = CREDITS.map(([kind, v]) => {
      const it = { kind, v, y: h };
      h += kind === 'gap' ? v * 14 : kind === 'title' ? 30 : kind === 'head' ? 18 : 16;
      return it;
    });
    // scrolling stops with the last line held in the middle of the screen
    const stopAt = items[items.length - 1].y - Math.round(R.H / 2) + 30;
    return {
      pos: -R.H + 40,
      walk: 0,
      hold: 0,
      finished: false,
      tick(L) {
        const fast = In().down('a') || In().down('b');
        this.walk += fast ? 2 : 1;
        if (this.pos < stopAt) { this.pos = Math.min(stopAt, this.pos + (fast ? 1.6 : 0.33)); return; }
        if (!this.finished && ++this.hold > 240) { this.finished = true; done(); }
      },
      draw(L) {
        G().draw(sky(), 0, 0);
        drawStars(stars, L.t);
        for (const it of items) {
          const y = Math.round(it.y - this.pos);
          if (y < -30 || y > R.H - 40) continue;
          const fadeTop = Math.min(1, (y + 10) / 40), fadeBot = Math.min(1, (R.H - 46 - y) / 30);
          G().ctx.globalAlpha = Math.max(0, Math.min(fadeTop, fadeBot));
          if (it.kind === 'title') G().text(it.v, R.W / 2, y, { align: 'center', size: 16, color: '#ffe890', shadow: '#301800' });
          else if (it.kind === 'head') G().text(it.v, R.W / 2, y, { align: 'center', color: '#9fb4ff', shadow: '#000' });
          else if (it.kind === 'name') G().text(it.v, R.W / 2, y, { align: 'center', color: '#ffffff', shadow: '#000' });
        }
        G().ctx.globalAlpha = 1;
        // the party walks east, looping across the screen
        const ids = ['yuki', 'non', 'metem'];
        const span = R.W + 80;
        ids.forEach((id, i) => {
          const img = frame(partyKey(id), 'right', Math.floor(this.walk / 10));
          if (!img) return;
          const x = ((this.walk * 0.35 - i * 20) % span + span) % span - 40;
          G().draw(img, Math.round(x), R.H - 34 - img.height + 4);
        });
      },
    };
  }

  /** "おわり": the three stand under the stars, looking up */
  function fin() {
    const stars = makeStars(70);
    return {
      t0: null,
      draw(L) {
        if (this.t0 == null) this.t0 = L.t;
        const k = Math.min(1, (L.t - this.t0) / 90);
        G().draw(sky(), 0, 0);
        drawStars(stars, L.t);
        ['metem', 'yuki', 'non'].forEach((id, i) => {
          const img = frame(partyKey(id), 'up', 0);
          if (img) G().draw(img, Math.round(R.W / 2 - 8 + (i - 1) * 22), R.H - 34 - img.height + 4);
        });
        G().ctx.globalAlpha = k;
        G().text('おわり', R.W / 2, R.H / 2 - 20, { align: 'center', size: 21, color: '#ffffff', shadow: '#1a1040' });
        G().ctx.globalAlpha = 1;
        if (L.t - this.t0 > 150 && Math.floor(L.t / 30) % 2 === 0) {
          G().text('Aボタンを押してください', R.W / 2, R.H - 84, { align: 'center', size: 8, color: '#b8c0e8' });
        }
      },
    };
  }

  // ------------------------------------------------------------ the sequence
  async function throneRoom(ev) {
    await ev.warp('regnas_castle', 'ending', { fade: false, dir: 'up' });
    if (R.Field.layer) R.Field.layer.banner = null;
    R.bgm('ending');
    if (R.Field.npc('king')) ev.npc('king').face('down');
    await ev.fadeIn(60);
    await ev.wait(20);
    await ev.player.walk('UUUUUU');
    await ev.wait(20);
    await ev.say('{yuki}、{non}、{metem}！\nよくぞ無事に戻った！');
    await ev.say('魔王ヴァルザードは滅び、\n世界に光が戻った。\nそなたたちこそ、\nまことの勇者じゃ！');
    await ev.say('王妃「おかえりなさい。\nあなたたちの無事を、\nずっと信じていましたよ。」');
    await ev.say('大臣「レグナス万歳！\n勇者万歳！」');
    R.sfx('confirm');
    await ev.say('兵士たち「ばんざーい！\nばんざーい！」');
    await ev.say('{yuki}「みんながいたから、\nここまで来られたんだ。」\f{non}「はい！　神様も、\nきっと見守って\nくださいました。」\f{metem}「ま、当然の結果ね。\n……でも、ありがと。ふたりとも。」');
    await ev.say('この光が、永遠に\n続かんことを……。');
    await ev.fadeOut(90);
    R.UI.closeMessage();
  }

  async function play(ev) {
    R.UI.closeMessage();
    if (R.Audio && R.Audio.stopBGM) { try { R.Audio.stopBGM(90); } catch (e) { /* ignore */ } }
    await ev.fadeOut(90);
    ev.heal(); // everyone walks into the throne room on their own feet
    const L = new EndingLayer();
    R.Engine.push(L);
    L.scene = narration(['魔王ヴァルザードは滅びた。', '', '魔の渦は消え去り、', '世界にふたたび', '光が戻った……。']);
    await ev.fadeIn(60);
    await ev.wait(260);
    await ev.fadeOut(60);
    R.Engine.remove(L);

    await throneRoom(ev);

    R.Engine.push(L);
    for (const ep of EPILOGUES) {
      L.scene = epilogue(ep);
      await ev.fadeIn(40);
      for (const t of ep.text) await R.UI.say(t, { keep: true });
      R.UI.closeMessage();
      await ev.fadeOut(40);
    }

    await new Promise((res) => {
      L.scene = credits(res);
      R.Engine.fadeIn(60);
    });
    await ev.fadeOut(80);
    L.scene = fin();
    await ev.fadeIn(30);
    await ev.wait(150);
    await L.waitA();

    // offer to record the cleared game: it resumes in the throne room
    const g = R.Game;
    g.flags.game_clear = true;
    g.clears = (g.clears || 0) + 1;
    g.onShip = false;
    g.pos = { map: 'regnas_castle', x: 19, y: 3, dir: 'up', spawn: 'start' };
    g.respawn = { map: 'regnas_castle', spawn: 'start' };
    g.objective = 'obj_postgame'; // the clear save continues into the post-game (深淵の迷宮)
    if (await R.UI.yesno('クリアデータを記録しますか？')) {
      R.UI.closeMessage();
      if (R.Menu && R.Menu.saveScreen) await R.Menu.saveScreen({ ending: true });
      else if (R.Save && R.Save.save) await R.Save.save(R.Save.lastSlot || 0, R.State.serialize());
    }
    R.UI.closeMessage();
    await R.Engine.fadeOut(60);
    R.Engine.remove(L);
    if (R.Title && R.Title.start) R.Title.start();
  }

  R.Ending = {
    CREDITS,
    EPILOGUES,
    /** play the whole ending (inline when called from a running event) */
    start() { return R.Events.run((ev) => play(ev)); },
  };
})(window.RPG);
