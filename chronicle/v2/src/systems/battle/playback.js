// BSCENE: 出来事の列（B.round() の結果、R.Contract.BATTLE_EVENTS）を順に演出する。
// 踏み込み → 攻撃の構え → 効果（味方→敵は左向き、敵→味方は右向き）→ 数字（相手の頭の上。白・会心は金・回復は緑・MP は青・ミスは灰）→ 戻る。
// 時間は戦闘の時計（st.clock。倍速 ×1/×2/×3 と A の早送りで速くなる）。レア以上を盗んだ・手に入れた中央の札は実時間で約 1.5 秒（早送りでも 0.6 秒以上、A12）。
// 知らない種類の出来事は飛ばす（止まらない）。演出した種類と時間は st.log に残す（テスト）。
(function (R) {
  'use strict';
  const Bt = (R.Battle = R.Battle || {});
  const _ = (Bt._ = Bt._ || {});
  const P = (_.play = {});
  const sfx = (id) => { try { R.Audio.sfx(id); } catch (e) { /* ignore */ } };

  const WFX = { sword: 'slash', greatsword: 'smash', dagger: 'thrust', bow: 'shoot', staff: 'smash' };
  const ELEMS = ['fire', 'water', 'ice', 'thunder', 'wind', 'earth', 'light', 'dark'];
  const SLOT_ICON = { shield: 'shield', head: 'helm', body: 'armor', hands: 'glove', feet: 'boots', acc: 'ring', use: 'potion', key: 'key' };
  P.itemName = (id) => { const d = R.DB.items && R.DB.items[id]; return (d && d.name) || (_.names && _.names[id]) || String(id); };
  P.itemIcon = (id) => { const d = (R.DB.items && R.DB.items[id]) || {}; return d.icon || (d.slot === 'weapon' ? d.wtype || 'sword' : SLOT_ICON[d.slot]) || 'gem'; };
  P.gradeOf = (id, g) => g || ((R.DB.items && R.DB.items[id] && R.DB.items[id].grade) || 'normal');
  const rare = (g) => g === 'rare' || g === 'super';

  // ---------------------------------------------------------------- 動き（tween）
  P.tween = function (st, obj, key, to, ms) {
    return new Promise((res) => {
      st.tweens = (st.tweens || []).filter((t) => !(t.obj === obj && t.key === key && (t.res(), true)));
      st.tweens.push({ obj, key, from: obj[key] || 0, to, t0: st.clock, ms: Math.max(1, ms), res });
    });
  };
  P.tick = function (st, dt) {
    const tw = st.tweens || [];
    for (let i = tw.length - 1; i >= 0; i--) {
      const t = tw[i], k = Math.min(1, (st.clock - t.t0) / t.ms), e = 1 - (1 - k) * (1 - k);
      t.obj[t.key] = t.from + (t.to - t.from) * e;
      if (k >= 1) { tw.splice(i, 1); t.res(); }
    }
    for (const uid of Object.keys(st.vis)) {
      const v = st.vis[uid];
      if (v.flash > 0) v.flash = Math.max(0, v.flash - dt / 220);
    }
    if (st.ghost) for (const uid of Object.keys(st.ghost)) { const gh = st.ghost[uid]; gh.k -= dt / 400 * Math.max(0.05, gh.k - gh.to); if (gh.k <= gh.to + 0.002) delete st.ghost[uid]; }
  };

  function setPose(st, uid, pose) { const v = st.vis[uid]; if (v) { v.pose = pose; v.poseT = R.Engine.time; } }
  function nameOf(st, uid) { const u = st.unit(uid); return u ? u.name : ''; }
  function centerOf(st, uid) {
    const a = st.actor(uid);
    if (!a) return { x: R.W / 2, y: R.H / 2 };
    return { x: a.x + (st.vis[uid] && st.vis[uid].dx || 0), y: a.y - _.actors.height(a) * 0.5 };
  }
  function headOf(st, uid) { const a = st.actor(uid); return a ? { x: a.x, y: a.y - _.actors.height(a) } : { x: R.W / 2, y: R.H / 3 }; }

  // ---------------------------------------------------------------- 表示物
  P.pop = function (st, uid, text, kind, o) {
    const h = headOf(st, uid);
    const n = st.pops.filter((p) => p.uid === uid && st.clock - p.t0 < 500).length;
    st.pops.push(Object.assign({ uid, text: String(text), kind, x: h.x, y: h.y - 6 - n * 18, t0: st.clock }, o));
  };
  P.fx = function (st, id, x, y, o) {
    if (!id || !R.BFX || !R.BFX.defs[id]) return;
    if (R.Hd && R.Hd.quality && R.Hd.quality() === 'off' && !/^(hit|slash|smash|thrust|shoot|claw|bite)$/.test(id)) return;
    st.fxs.push(Object.assign({ id, x, y, t0: st.clock }, o));
  };
  P.drawFx = function (g, st) {
    const out = [];
    for (const f of st.fxs) {
      const t = st.clock - f.t0;
      if (t < 0) { out.push(f); continue; }
      if (R.BFX.draw(g, f.id, f.x, f.y, t, f)) out.push(f);
    }
    st.fxs = out;
  };
  const NUM = {
    dmg: { fill: ['#ffffff', '#f4f0e8'], stroke: 'rgba(24,18,30,0.95)', size: 22 },
    crit: { fill: ['#ffffff', '#fff0c0', '#ffc860'], stroke: 'rgba(40,22,6,0.95)', size: 30 },
    heal: { fill: ['#d8ffc8', '#9ee88a'], stroke: 'rgba(10,30,10,0.9)', size: 22 },
    mp: { fill: ['#e0f0ff', '#8cc0ff'], stroke: 'rgba(8,16,40,0.9)', size: 22 },
    miss: { fill: ['#c8c4bc', '#9a958c'], stroke: 'rgba(20,20,26,0.9)', size: 18 },
    label: { fill: ['#ecc97c', '#ecc97c'], stroke: 'rgba(40,22,6,0.9)', size: 12 },
    status: { fill: ['#e6d0ff', '#c6a0f0'], stroke: 'rgba(30,14,40,0.9)', size: 14 },
  };
  P.drawPops = function (g, st) {
    const k = R.uiScale || 1, reduce = R.Settings.get('reduceMotion');
    const keep = [];
    for (const p of st.pops) {
      const t = st.clock - p.t0;
      if (t > 1250) continue;
      keep.push(p);
      const S = NUM[p.kind] || NUM.dmg;
      const rise = Math.min(1, t / 520), e = 1 - (1 - rise) * (1 - rise);
      let a = t < 700 ? 1 : 1 - (t - 700) / 550;
      a = Math.max(0, Math.min(1, a)) * Math.min(1, t / 60);
      let sc = 1;
      if (p.kind === 'crit' && !reduce) sc = t < 160 ? 1 + 0.25 * (t / 160) : t < 320 ? 1.25 - 0.25 * ((t - 160) / 160) : 1;
      const size = S.size * k * sc;
      const x = p.x, y = p.y - e * 26 * k;
      g.save();
      g.globalAlpha = a;
      g.font = R.Gfx.font(size, 700);
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.lineJoin = 'round'; g.strokeStyle = S.stroke; g.lineWidth = Math.max(3, size * 0.2);
      g.strokeText(p.text, x, y);
      const gr = g.createLinearGradient(0, y - size, 0, y);
      S.fill.forEach((c, i) => gr.addColorStop(S.fill.length > 1 ? i / (S.fill.length - 1) : 0, c));
      g.fillStyle = gr; g.fillText(p.text, x, y);
      if (p.tag) {
        g.font = R.Gfx.font(12 * k, 700);
        g.lineWidth = 3; g.strokeStyle = 'rgba(40,22,6,0.9)';
        g.strokeText(p.tag, x - size * 0.9, y - size * 0.95);
        g.fillStyle = p.tagColor || '#ecc97c'; g.fillText(p.tag, x - size * 0.9, y - size * 0.95);
      }
      g.restore();
    }
    st.pops = keep;
  };
  /** 予告の文（画面の端。E18）: 出た直後は大きく、その後は見出しの下に小さく残す */
  P.drawTele = function (g, st) {
    const tl = st.tele;
    if (!tl) return;
    const k = R.uiScale || 1, t = R.Engine.time - tl.t0, Kt = _.K;
    const big = t < 1600;
    const y = st.L.tall ? st.L.stageH - 70 * k : (R.safe.t || 0) + 74 * k;
    const size = (big ? 17 : 13) * k;
    const w = Math.min(R.W - 24 * k, Kt.measure(tl.text, { size, weight: 700 }) + 70 * k);
    const x = st.L.tall ? (R.W - w) / 2 : (R.safe.l || 0) + 16 * k;
    const a = Math.min(1, t / 160);
    g.save();
    g.globalAlpha = a;
    const gr = g.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, 'rgba(10,30,36,0.78)'); gr.addColorStop(1, 'rgba(10,30,36,0)');
    g.fillStyle = gr; g.fillRect(x, y, w, size + 16 * k);
    g.fillStyle = tl.tint || '#8fd6d8'; g.fillRect(x, y, 2 * k, size + 16 * k);
    Kt.diamond(g, x + 16 * k, y + (size + 16 * k) / 2, 5 * k, null, tl.tint || '#8fd6d8', 1.2);
    Kt.text(g, tl.text, x + 30 * k, y + 8 * k, { size, weight: 700, color: big ? '#e6fbfb' : '#bfe6e8', raw: true, shadow: true });
    g.restore();
  };
  /** レア以上の中央の札（A12） */
  P.drawCard = function (g, st) {
    const c = st.card;
    if (!c) return;
    const k = R.uiScale || 1, Kt = _.K, t = R.Engine.time - c.t0;
    const sup = c.grade === 'super';
    const col = sup ? Kt.COL.superRare : Kt.COL.rare, rgb = sup ? '255,182,94' : '134,200,255';
    const w = Math.min(R.W - 32 * k, 380 * k), h = 92 * k;
    const x = (R.W - w) / 2, y = (st.L.tall ? st.L.stageH * 0.42 : R.H * 0.36) - h / 2;
    const a = Math.min(1, t / 140) * (c.out ? Math.max(0, 1 - (R.Engine.time - c.out) / 160) : 1);
    g.save();
    g.globalAlpha = a;
    g.translate(0, (1 - Math.min(1, t / 180)) * 8);
    const glow = g.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, w * 0.7);
    glow.addColorStop(0, `rgba(${rgb},0.28)`); glow.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = glow; g.fillRect(x - w * 0.2, y - h, w * 1.4, h * 3);
    Kt.box(g, { x, y, w, h }, { a: 0.82, r: 12 * k, edge: `rgba(${rgb},0.8)` });
    Kt.text(g, c.label, x + w / 2, y + 12 * k, { size: 11.5 * k, weight: 700, color: col, align: 'center', raw: true, track: 3 });
    const size = 21 * k;
    const nw = Kt.measure(c.name, { size, weight: 700 });
    const iconS = 24 * k;
    const stars = sup ? '★★' : '★';
    const sw = Kt.measure(stars, { size: 15 * k, weight: 700 });
    const total = iconS + 10 * k + nw + 8 * k + sw;
    let cx = x + (w - total) / 2;
    Kt.icon(g, c.icon, cx, y + 40 * k, iconS, col);
    cx += iconS + 10 * k;
    Kt.text(g, c.name, cx, y + 40 * k, { size, weight: 700, color: col, raw: true, shadow: true });
    Kt.text(g, stars, cx + nw + 8 * k, y + 44 * k, { size: 15 * k, weight: 700, color: col, raw: true });
    g.restore();
  };
  P.card = async function (st, item, grade, how) {
    const MIN = Bt.MIN;
    st.card = { name: P.itemName(item), grade, icon: P.itemIcon(item), label: how === 'steal' ? (grade === 'super' ? '超レアを盗んだ！' : 'レアを盗んだ！') : (grade === 'super' ? '超レアを手に入れた！' : 'レアを手に入れた！'), t0: R.Engine.time };
    try { R.Audio.jingle(grade === 'super' ? 'superrare' : 'rare'); } catch (e) { /* ignore */ }
    const t0 = R.Engine.time;
    await R.until(() => { const el = R.Engine.time - t0; return st.dead || el >= MIN.rareCard || (el >= MIN.rareCardSkip && (R.Input.pressed('a') || R.Input.pointer.pressed)); });
    st.log.push({ t: 'card', ms: R.Engine.time - t0, grade });
    st.card.out = R.Engine.time;
    await R.wait(160);
    st.card = null;
  };

  // ---------------------------------------------------------------- 同期（出来事の後の本当の値）
  P.snapshot = function (st) {
    for (const u of st.B.units) if (!st.vis[u.uid]) { st.vis[u.uid] = { hp: u.hp, mp: u.mp, maxHp: u.maxHp, maxMp: u.maxMp, alive: u.alive, status: (u.status || []).slice(), pose: 'idle', poseT: 0, dx: 0, dy: 0, flash: 0, gone: 0, appear: 1 }; }
  };
  P.sync = function (st) {
    for (const u of st.B.units) {
      let v = st.vis[u.uid];
      if (!v) continue;
      v.hp = u.hp; v.mp = u.mp; v.maxHp = u.maxHp; v.maxMp = u.maxMp; v.status = (u.status || []).slice();
      if (u.alive !== v.alive) {
        v.alive = u.alive;
        if (u.side === 'enemy') v.gone = u.alive ? 0 : 1;
      }
      if (u.side === 'party') v.pose = u.alive ? (v.pose === 'victory' ? 'victory' : 'idle') : 'ko';
      else if (u.alive && v.pose !== 'tele') v.pose = 'idle';
      // B.units に居る敵で、actors に居ない（呼び出しの本物）→ 足す
      if (!st.actor(u.uid)) addActor(st, u);
    }
  };
  function addActor(st, u) {
    const k = _.actors.keyOf(u);
    const a = { uid: u.uid, side: u.side, id: u.id, name: u.name, look: u.look || u.sprite, sprite: u.sprite, wtype: u.wtype, size: u.size, boss: !!u.boss, golden: !!u.golden, key: k.key, opts: k.opts };
    Object.assign(a, _.layout.freeSpot(st.L, st.actors.filter((x) => x.side === 'enemy' && !(st.vis[x.uid] && st.vis[x.uid].gone >= 1))));
    st.actors.push(a);
    if (!st.vis[u.uid]) st.vis[u.uid] = { hp: u.hp, mp: u.mp, maxHp: u.maxHp, maxMp: u.maxMp, alive: true, status: [], pose: 'idle', poseT: 0, dx: 0, dy: 0, flash: 0, gone: 0, appear: 0 };
    return a;
  }

  // ---------------------------------------------------------------- 1 ラウンドの演出
  // データの fx の名前（技・術・道具。段の数字つき）→ R.BFX の効果の id
  const FX_ALIAS = {
    water: 'ice', holy: 'light', arrow: 'shoot', pierce: 'thrust', strike: 'smash', explosion: 'fire', magic: 'light', gravity: 'dark',
    death: 'dark', drain: 'dark', poison: 'status', sleep: 'status', silence: 'status', regen: 'heal', cure: 'heal', stance: 'buff', scan: 'buff',
  };
  function bfxId(name) {
    if (!name) return null;
    if (R.BFX.defs[name]) return name;
    const base = String(name).replace(/\d+$/, '');
    if (R.BFX.defs[base]) return base;
    const a = FX_ALIAS[base];
    return a && R.BFX.defs[a] ? a : null;
  }
  P.bfxId = bfxId;
  /** 合成術（2・3 属性）の演出の並び: データの fxs（RULES の依頼 14。fx は先頭の属性だけ）→ BFX の id の配列（重ならない） */
  function fxsFor(e) {
    const dbk = e.cmd === 'skill' ? 'techs' : e.cmd === 'spell' ? 'spells' : e.cmd === 'item' ? 'items' : null;
    const d = (dbk && R.DB[dbk] && R.DB[dbk][e.id]) || {};
    const list = (d.fxs || (d.use && d.use.fxs) || []).map(bfxId).filter(Boolean);
    return list.length > 1 ? [...new Set(list)] : null;
  }
  function fxFor(st, e) {
    const u = st.unit(e.uid) || {};
    const dbk = e.cmd === 'skill' ? 'techs' : e.cmd === 'spell' ? 'spells' : e.cmd === 'item' ? 'items' : null;
    const d = (dbk && R.DB[dbk] && R.DB[dbk][e.id]) || {};
    const dfx = bfxId(d.fx || (d.use && d.use.fx));
    if (dfx) return dfx;
    let el = d.element || (ELEMS.includes(e.kind) ? e.kind : null);
    // データに属性が無ければ、この行動の最初のダメージの kind（属性）を使う
    if (!el && st._evs) {
      for (let i = st._evi + 1; i < st._evs.length; i++) { const x = st._evs[i]; if (x.t === 'act' || x.t === 'turn') break; if (x.t === 'dmg' && ELEMS.includes(x.kind)) { el = x.kind; break; } }
    }
    if (el) el = bfxId(el) || el;   // 水 → ice の絵など
    if (e.cmd === 'spell' || e.cmd === 'item') {
      const toAlly = (e.targets || []).some((t) => (st.unit(t) || {}).side === u.side);
      if (toAlly) return d.mp != null && /mp|ether|魔力/.test(e.id + (d.name || '')) ? 'mp' : 'heal';
      return el && R.BFX.defs[el] ? el : 'light';
    }
    if (u.side === 'party') return el && e.cmd === 'skill' ? el : WFX[u.wtype] || 'slash';
    if (el && R.BFX.defs[el]) return el;
    const h = [...String(e.id || e.name || '')].reduce((s, c) => s + c.charCodeAt(0), 0);
    return ['claw', 'bite', 'hit'][h % 3];
  }
  async function returnActor(st, ctx) {
    const uid = ctx.actor;
    if (uid && st.banner && st.glim && st.glim.uid === uid) _.glimmer.release(st);
    ctx.actor = null; ctx.act = null; ctx.fx = null; ctx.fxs = null;
    if (!uid) return;
    const v = st.vis[uid];
    if (!v) return;
    if (Math.abs(v.dx || 0) > 0.5) await P.tween(st, v, 'dx', 0, 150);
    if (v.alive && v.pose !== 'ko') setPose(st, uid, 'idle');
  }

  const H = {};
  H.turn = async (st, e, ctx) => { if (ctx.actor && ctx.actor !== e.uid) await returnActor(st, ctx); };
  H.act = async (st, e, ctx) => {
    if (ctx.actor) await returnActor(st, ctx);
    const u = st.unit(e.uid);
    if (!u) return;
    ctx.actor = e.uid; ctx.act = e; ctx.fx = fxFor(st, e); ctx.fxs = fxsFor(e); ctx.hits = 0;
    const an = u.name;
    st.head = e.cmd === 'attack' ? { name: `${an}の攻撃`, t0: R.Engine.time } : { name: e.name || '', sub: an, t0: R.Engine.time };
    if (st.tele && st.tele.uid === e.uid) { st.tele = null; }
    const v = st.vis[e.uid];
    const sp = st.speed();
    if (u.side === 'party') {
      // ボイス（A37）
      const big = _.voice.isBig(e.cmd, e.id);
      const kind = e.cmd === 'spell' ? 'spell' : big ? 'bigtech' : e.cmd === 'attack' || e.cmd === 'skill' ? 'attack' : null;
      if (kind) _.voice.play(u, kind, { speed: sp, force: big, rng: st.vrng });
      if (e.cmd === 'spell') {
        setPose(st, e.uid, 'cast');
        P.fx(st, 'cast', st.actor(e.uid).x, st.actor(e.uid).y - 34, {});
        sfx('magic');
        await st.pwait(460);
      } else if (e.cmd === 'item') {
        setPose(st, e.uid, 'item'); sfx('item'); await st.pwait(300);
      } else if (e.cmd === 'defend') {
        setPose(st, e.uid, 'guard'); await st.pwait(260);
      } else {
        const ranged = u.wtype === 'bow';
        if (!ranged) { setPose(st, e.uid, 'step'); await P.tween(st, v, 'dx', -64, 170); }
        setPose(st, e.uid, _.actors.ATTACK_POSE[u.wtype] || 'slash');
        sfx('attack');
        await st.pwait(ranged ? 260 : 200);
      }
    } else {
      if (e.cmd === 'defend') { await st.pwait(200); return; }
      if (e.cmd === 'spell') { setPose(st, e.uid, 'attack'); P.fx(st, 'cast', st.actor(e.uid).x, st.actor(e.uid).y - 30, {}); sfx('magic'); await st.pwait(420); return; }
      await P.tween(st, v, 'dx', 26, 120);
      setPose(st, e.uid, 'attack'); sfx('enemy_attack');
      await st.pwait(160);
    }
  };
  function hitFx(st, e, ctx) {
    const c = centerOf(st, e.uid);
    const tgt = st.unit(e.uid) || {};
    const flip = tgt.side === 'enemy';   // 右向きで描いた効果: 味方→敵は反転（左向き）
    const id = ctx.fx || 'hit';
    const onBody = /^(fire|ice|earth|heal|mp|revive)$/.test(id);
    const a = st.actor(e.uid);
    P.fx(st, id, c.x, onBody && a ? a.y - 40 : c.y, { flip });
    // 合成術: 残りの属性の演出を少しずつ遅らせて重ねる（最初の一撃だけ）
    if (ctx.fxs && ctx.hits === 0) {
      ctx.fxs.filter((f) => f !== id).forEach((f, i) => {
        const body = /^(fire|ice|earth|heal|mp|revive)$/.test(f);
        P.fx(st, f, c.x + (i % 2 ? 8 : -8), body && a ? a.y - 40 : c.y, { flip, t0: st.clock + 110 * (i + 1) });
      });
    }
    if (id !== 'hit' && !/^(heal|mp|revive)$/.test(id)) P.fx(st, 'hit', c.x + (flip ? 6 : -6), c.y, { flip, t0: st.clock + 60 });
    const ES = { fire: 'fire', ice: 'ice', thunder: 'thunder', wind: 'wind', earth: 'earth', light: 'holy', dark: 'dark', shoot: 'arrow' };
    if (ES[id] && ctx.hits === 0) sfx(ES[id]);
  }
  H.dmg = async (st, e, ctx) => {
    const v = st.vis[e.uid], u = st.unit(e.uid);
    if (!v || !u) return;
    hitFx(st, e, ctx);
    if (e.crit) { P.fx(st, 'crit', centerOf(st, e.uid).x, centerOf(st, e.uid).y, {}); if (R.Settings.get('shake') !== 'off' && !R.Settings.get('reduceMotion')) st.shake = { t0: R.Engine.time, ms: 260, amp: 4 }; }
    const mpDmg = e.kind === 'mp';
    const before = mpDmg ? v.mp : v.hp;
    if (mpDmg) v.mp = Math.max(0, v.mp - e.n); else v.hp = Math.max(0, v.hp - e.n);
    if (u.side === 'party' && !mpDmg && v.maxHp > 0) { st.ghost[e.uid] = { k: before / v.maxHp, to: v.hp / v.maxHp }; }
    v.flash = 1;
    setPose(st, e.uid, 'hit');
    P.pop(st, e.uid, (e.n | 0).toLocaleString('en-US'), e.crit ? 'crit' : mpDmg ? 'mp' : 'dmg', e.crit ? { tag: '会心' } : e.weak ? { tag: '弱点', tagColor: '#f4a07c' } : {});
    sfx(u.side === 'party' ? 'hurt' : e.crit ? 'crit' : 'hit');
    if (u.side === 'party' && e.n > 0) _.voice.play(u, 'hurt', { speed: st.speed(), rng: st.vrng, force: false, chance: true });
    ctx.hits++;
    await st.pwait(170);
    if (v.alive && v.pose === 'hit') setPose(st, e.uid, 'idle');
  };
  H.heal = async (st, e) => {
    const v = st.vis[e.uid];
    if (!v) return;
    if (e.mp) v.mp = Math.min(v.maxMp || v.mp + e.n, v.mp + e.n); else v.hp = Math.min(v.maxHp || v.hp + e.n, v.hp + e.n);
    const a = st.actor(e.uid);
    if (a) P.fx(st, e.mp ? 'mp' : 'heal', a.x, a.y - 40, {});
    P.pop(st, e.uid, '+' + (e.n | 0).toLocaleString('en-US'), e.mp ? 'mp' : 'heal');
    sfx('heal');
    await st.pwait(220);
  };
  H.miss = async (st, e) => {
    const v = st.vis[e.uid], u = st.unit(e.uid);
    P.pop(st, e.uid, 'ミス', 'miss');
    sfx('miss');
    if (v && u) { const d = u.side === 'party' ? 14 : -14; await P.tween(st, v, 'dx', (v.dx || 0) + d, 90); await P.tween(st, v, 'dx', 0, 120); }
    else await st.pwait(200);
  };
  H.status = async (st, e) => {
    const v = st.vis[e.uid];
    if (!v) return;
    // 強化・弱体（BATTLE 34-3）: {id:'buff_<atk|def|mag|mdef|agi>', on, stage:-2..2}
    const bm = /^buff_(atk|def|mag|mdef|agi)$/.exec(e.id || '');
    if (bm) {
      const BN = { atk: '攻撃', def: '防御', mag: '魔力', mdef: '魔防', agi: '素早さ' };
      const stg = e.stage | 0;
      const up = stg > 0;
      v.status = v.status.filter((x) => (x.id || x) !== e.id);
      if (e.on && stg) v.status.push(e.id);
      const a0 = st.actor(e.uid);
      if (a0 && e.on && stg) P.fx(st, up ? 'buff' : 'debuff', a0.x, a0.y - 40, {});
      P.pop(st, e.uid, !e.on || !stg ? `${BN[bm[1]]}が元に戻った` : `${BN[bm[1]]}${up ? '↑' : '↓'}${Math.abs(stg) > 1 ? '↑↓'[up ? 0 : 1] : ''}`, 'status');
      sfx(e.on && stg ? (up ? 'buff' : 'debuff') : 'heal');
      await st.pwait(240);
      return;
    }
    const name = R.BFX.statusName ? R.BFX.statusName(e.id) : e.id;
    const has = v.status.some((s) => (s.id || s) === e.id);
    if (e.on && !has) v.status.push(e.id);
    if (!e.on) v.status = v.status.filter((s) => (s.id || s) !== e.id);
    const a = st.actor(e.uid);
    const good = /haste|regen|protect|shell|guard|buff|up/.test(e.id);
    if (a && e.on) P.fx(st, good ? 'buff' : 'status', a.x, a.y - 40, {});
    P.pop(st, e.uid, e.on ? name : `${name}が治った`, 'status');
    sfx(e.on ? (good ? 'buff' : 'debuff') : 'heal');
    await st.pwait(260);
  };
  H.ko = async (st, e) => {
    const v = st.vis[e.uid], u = st.unit(e.uid);
    if (!v || !u) return;
    v.alive = false; v.hp = 0;
    if (u.side === 'party') {
      setPose(st, e.uid, 'ko');
      _.voice.play(u, 'ko', { speed: 1, force: true, rng: st.vrng });
      sfx('death');
      await st.pwait(360);
    } else {
      v.flash = 1;
      sfx(u.boss ? 'boss_die' : 'enemy_die');
      P.tween(st, v, 'gone', 1, u.boss ? 900 : 420);
      await st.pwait(u.boss ? 600 : 240);
    }
  };
  H.revive = async (st, e) => {
    const v = st.vis[e.uid];
    if (!v) return;
    v.alive = true; v.gone = 0;
    const a = st.actor(e.uid);
    if (a) P.fx(st, 'revive', a.x, a.y - 60, {});
    setPose(st, e.uid, 'idle');
    sfx('revive');
    await st.pwait(420);
  };
  H.glimmer = async (st, e, ctx) => { await _.glimmer.play(st, e, ctx); };
  H.telegraph = async (st, e) => {
    // 予約が消えた（風で吹き飛んだ・眠った。BATTLE 34-2）: 端の文を消して構えを戻す
    if (e.cancel || (!e.text && !e.next)) {
      if (st.tele && st.tele.uid === e.uid) st.tele = null;
      const v0 = st.vis[e.uid];
      if (v0 && v0.pose === 'tele') { v0.pose = 'idle'; v0.poseT = R.Engine.time; }
      return;
    }
    st.tele = { uid: e.uid, text: e.text, tint: e.tint || '#8fd6d8', t0: R.Engine.time };
    const v = st.vis[e.uid];
    if (v) { v.pose = e.pose || 'tele'; v.poseT = R.Engine.time; }
    sfx('bell');
    await Promise.all([st.pwait(1300), st.rwait(900)]);
  };
  H.summon = async (st, e) => {
    const m = e.mon;
    let u = m && typeof m === 'object' && m.uid != null ? m : null;
    if (!u) {
      const id = typeof m === 'string' ? m : (m && m.id) || 'unknown';
      const d = (R.DB.monsters && R.DB.monsters[id]) || {};
      u = { uid: 'sum_' + (st.actors.length + 1), side: 'enemy', id, name: d.name || id, hp: 1, mp: 0, maxHp: 1, maxMp: 0, row: 'front', status: [], sprite: d.sprite || id, size: d.size || 's', alive: true };
    }
    if (!st.B.units.some((x) => x.uid === u.uid)) st.extra[u.uid] = u;
    const a = st.actor(u.uid) || addActor(st, u);
    const v = st.vis[u.uid];
    v.gone = 0; v.appear = 0; v.alive = true;
    P.fx(st, 'summon', a.x, a.y - 20, {});
    sfx('teleport');
    await P.tween(st, v, 'appear', 1, 420);
  };
  H.flee = async (st, e) => {
    const v = st.vis[e.uid], u = st.unit(e.uid);
    if (!v || !u) return;
    sfx('escape');
    const a = st.actor(e.uid);
    if (a) P.fx(st, 'smoke', a.x, a.y - 20, {});
    P.tween(st, v, 'dx', u.side === 'party' ? 120 : -120, 380);
    if (u.side === 'enemy') { v.alive = false; await P.tween(st, v, 'gone', 1, 380); }
    else await st.pwait(380);
  };
  H.steal = async (st, e, ctx) => {
    const a = st.actor(e.target);
    if (a) P.fx(st, 'steal', a.x, a.y - _.actors.height(a) * 0.5, { flip: true });
    sfx('steal');
    if (!e.item) { P.pop(st, e.target != null ? e.target : e.uid, '盗めなかった', 'miss'); await st.pwait(300); return; }
    const g = P.gradeOf(e.item, e.grade);
    ctx.stolen = e.item;
    st.head = { name: `${P.itemName(e.item)}を盗んだ！`, sub: nameOf(st, e.uid), t0: R.Engine.time };
    if (rare(g)) await P.card(st, e.item, g, 'steal');
    else await st.pwait(500);
  };
  H.gain = async (st, e, ctx) => {
    st.collected.gains.push(e);
    const g = P.gradeOf(e.item, e.grade);
    if (e.stolen) {
      if (ctx.stolen === e.item) return;   // steal の札で見せた
      st.head = { name: `${P.itemName(e.item)}を盗んだ！`, t0: R.Engine.time };
      if (rare(g)) await P.card(st, e.item, g, 'steal'); else await st.pwait(400);
    }
  };
  H.grow = async (st, e) => { st.collected.grow.push(e); };
  H.prof = async (st, e) => { st.collected.prof.push(e); };
  H.msg = async (st, e) => { st.head = { name: e.text, t0: R.Engine.time }; await st.pwait(900); };
  H.end = async () => {};
  P.handlers = H;

  P.run = async function (st, evs) {
    st.phase = 'play';
    st.activeUid = null;
    st.ui = null;
    st.vrng = st.vrng || R.rng('bvoice:' + ((R.Game && R.Game.seed) || 0));
    const ctx = { actor: null, act: null, fx: null, hits: 0 };
    const C = R.Contract;
    st._evs = evs;
    for (let ei = 0; ei < evs.length; ei++) {
      const e = evs[ei];
      st._evi = ei;
      if (st.dead) return;
      if (!e || typeof e !== 'object') continue;
      if (C && C.check && R.Dev) { const r = C.check('battleEvent', e); if (!r.ok) console.warn('[battle] event shape: ' + r.errors.join('; ')); }
      const t0 = R.Engine.time;
      const h = H[e.t];
      try { if (h) await h(st, e, ctx); } catch (err) { console.error('[battle playback] ' + e.t, err); }
      st.log.push({ t: e.t, ms: R.Engine.time - t0 });
      if (st.log.length > 400) st.log.splice(0, 100);
    }
    await returnActor(st, ctx);
    await st.pwait(220);
    await _.glimmer.settle(st);
    P.sync(st);
    st.head = null;
    st.phase = 'idle';
  };
})(window.RPG);
