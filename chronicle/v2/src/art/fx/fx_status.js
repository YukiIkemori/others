// BSCENE: 状態・強化・弱体・呼び出し・逃げるの効果と、状態の小さな印（右上の一覧の名前の右・敵の頭の上）
//   R.BFX.statusMark(g, id, x, y, r)   印は色の札と 1〜2 字（毒・眠・攻▲…。表は MARK、無ければ R.DB.statuses[id].icon）。→ 幅
//   R.BFX.statusMarkW(g, id, r) 印の幅 / R.BFX.statusList(u) 人の状態 → 印に渡す物（強化・弱体は {id, stage}）
(function (R) {
  'use strict';
  const BFX = R.BFX;
  const U = () => BFX.u;

  BFX.add('status', {
    n: 12, w: 96, h: 96, fps: 22,
    draw(g, k, i, rng) {
      const a = U().bell(k);
      for (let j = 0; j < 9; j++) {
        const x = (rng.next() - 0.5) * 50, y = 20 - ((k * 70 + j * 11) % 70), r = 3 + (j % 3) * 2;
        g.strokeStyle = `rgba(200,150,255,${0.8 * a})`; g.lineWidth = 1.5;
        g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
      }
    },
  });
  function arrows(id, rgb, up) {
    BFX.add(id, {
      n: 12, w: 96, h: 112, fps: 22,
      draw(g, k) {
        const a = U().bell(k);
        for (let j = 0; j < 3; j++) {
          const x = (j - 1) * 18, off = ((k * 60 + j * 20) % 60) * (up ? -1 : 1);
          const y = (up ? 30 : -30) + off, s = up ? -1 : 1;
          g.fillStyle = `rgba(${rgb},${0.85 * a})`;
          g.beginPath(); g.moveTo(x, y + 10 * s); g.lineTo(x - 7, y); g.lineTo(x - 2.5, y); g.lineTo(x - 2.5, y - 10 * s); g.lineTo(x + 2.5, y - 10 * s); g.lineTo(x + 2.5, y); g.lineTo(x + 7, y); g.closePath(); g.fill();
        }
      },
    });
  }
  arrows('buff', '255,220,140', true);
  arrows('debuff', '190,140,255', false);
  // 煙（呼び出し・逃げる）
  function smoke(id, rgb) {
    BFX.add(id, {
      n: 12, w: 128, h: 112, fps: 20, blend: 'source-over',
      draw(g, k, i, rng) {
        const a = 1 - k;
        for (let j = 0; j < 10; j++) {
          const ang = rng.next() * Math.PI * 2, d = 8 + k * 40 * (0.6 + rng.next() * 0.6);
          g.fillStyle = `rgba(${rgb},${0.5 * a})`;
          g.beginPath(); g.arc(Math.cos(ang) * d, Math.sin(ang) * d * 0.6 - k * 10, 10 + k * 14, 0, 7); g.fill();
        }
      },
    });
  }
  smoke('summon', '120,110,150');
  smoke('smoke', '150,150,170');
  // 盗む（光る手と品の粒）
  BFX.add('steal', {
    n: 10, w: 96, h: 96, fps: 22,
    draw(g, k) {
      const a = U().bell(k);
      U().glowDot(g, 0, 0, 30, '255,236,170', 0.5 * a);
      U().star(g, -20 + k * 40, -10 - Math.sin(k * Math.PI) * 18, 9, 4, '255,250,230', a, k * 3);
    },
  });

  // ---------------------------------------------------------------- 状態の印
  // 印は 1〜2 字の札（日本語・中国語は漢字 1 字が基本、魔防など 2 字も入る。英語は 3 字、韓国語は 2 字）。
  //   強化・弱体（buff_<atk|def|mag|mdef|agi>）は「攻」などの字＋▲（上がる・緑）/▼（下がる・赤）。2 段なら ▲▲ / ▼▼。
  //   前は強化・弱体と一部の状態（やけど・凍結・加護…）に印の表が無く、id の頭の字（buff_atk → b）が出ていた（持ち主 2026-10-04）。
  const MARK = {
    poison: ['#c08af0', R.T('art.fx_status.MARK.poison.1')], burn: ['#ff9a5c', R.T('art.fx_status.MARK.burn.1')], sleep: ['#8fb0f0', R.T('art.fx_status.MARK.sleep.1')],
    paralyze: ['#f0d060', R.T('art.fx_status.MARK.paralyze.1')], paralysis: ['#f0d060', R.T('art.fx_status.MARK.paralysis.1')], freeze: ['#9fe3ff', R.T('art.fx_status.MARK.freeze.1')],
    stun: ['#ffe080', R.T('art.fx_status.MARK.stun.1')], confuse: ['#f09ad0', R.T('art.fx_status.MARK.confuse.1')], silence: ['#b0c8e0', R.T('art.fx_status.MARK.silence.1')],
    blind: ['#a0a0b0', R.T('art.fx_status.MARK.blind.1')], regen: ['#8ee08a', R.T('art.fx_status.MARK.regen.1')], veil: ['#8fd6d8', R.T('art.fx_status.MARK.veil.1')],
    counter: ['#f4b26c', R.T('art.fx_status.MARK.counter.1')], nimble: ['#b6f0a0', R.T('art.fx_status.MARK.nimble.1')], cover: ['#ecc97c', R.T('art.fx_status.MARK.cover.1')],
    stone: ['#b8b0a0', R.T('art.fx_status.MARK.stone.1')], charm: ['#ff9ab0', R.T('art.fx_status.MARK.charm.1')], slow: ['#90a8d0', R.T('art.fx_status.MARK.slow.1')],
    haste: ['#8ee08a', R.T('art.fx_status.MARK.haste.1')], protect: ['#ecc97c', R.T('art.fx_status.MARK.protect.1')], shell: ['#8fd6d8', R.T('art.fx_status.MARK.shell.1')],
    berserk: ['#f47e6c', R.T('art.fx_status.MARK.berserk.1')], doom: ['#c090f0', R.T('art.fx_status.MARK.doom.1')], guard: ['#ecc97c', R.T('art.fx_status.MARK.guard.1')],
    buff_atk: ['', R.T('art.fx_status.MARK.buff_atk.1')], buff_def: ['', R.T('art.fx_status.MARK.buff_def.1')], buff_mag: ['', R.T('art.fx_status.MARK.buff_mag.1')],
    buff_mdef: ['', R.T('art.fx_status.MARK.buff_mdef.1')], buff_agi: ['', R.T('art.fx_status.MARK.buff_agi.1')],
  };
  BFX.MARK = MARK;
  const BUFF_UP = { line: '#8ee08a', bg: 'rgba(22,58,26,0.92)' }, BUFF_DOWN = { line: '#ff8a76', bg: 'rgba(70,20,22,0.92)' };
  /** 印の中身: → {label, color, bg, stage（強化 +1/+2・弱体 -1/-2、状態は 0）} */
  function markOf(id) {
    const key = typeof id === 'string' ? id : (id && (id.id || id.key)) || '';
    const isBuff = /^buff_/.test(key);
    const stage = isBuff ? ((id && typeof id === 'object' && id.stage) | 0) || 1 : 0;
    const d = R.DB.statuses && R.DB.statuses[key];
    const m = MARK[key] || [`hsl(${(R.U && R.U.hash ? R.U.hash(key) : 0) % 360},55%,65%)`, (d && (d.icon || d.name)) || [...key][0] || '?'];
    const st = stage > 0 ? BUFF_UP : stage < 0 ? BUFF_DOWN : null;
    return { label: String(m[1]), color: st ? st.line : m[0], bg: st ? st.bg : 'rgba(14,16,28,0.85)', stage };
  }
  const latin = (s) => /^[\x20-\x7e]+$/.test(s);
  const fontPx = (label, r) => r * (latin(label) ? 1.42 : [...label].length > 1 ? 1.3 : 1.5);
  /** 印の幅（描かずに測る） */
  BFX.statusMarkW = function (g, id, r) {
    const m = markOf(id), fs = fontPx(m.label, r);
    g.save(); g.font = R.Gfx.font(fs, 700); const tw = g.measureText(m.label).width; g.restore();
    const pad = r * 0.45, aw = m.stage ? r * 0.95 + r * 0.25 : 0;
    return Math.max(2 * r + 3, tw + pad * 2 + aw + 3);
  };
  /** 状態の印を描く。x は左端、y は真ん中、r は高さの半分の目安。→ 幅 */
  BFX.statusMark = function (g, id, x, y, r) {
    const m = markOf(id), fs = fontPx(m.label, r), w = BFX.statusMarkW(g, id, r), h = 2 * r + 3;
    const pad = r * 0.45, aw = m.stage ? r * 0.95 + r * 0.25 : 0;
    g.save();
    if (R.UIK && R.UIK.rr) R.UIK.rr(g, x, y - h / 2, w, h, h / 2); else { g.beginPath(); g.rect(x, y - h / 2, w, h); }
    g.fillStyle = m.bg; g.fill();
    g.strokeStyle = m.color; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = m.color; g.font = R.Gfx.font(fs, 700); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(m.label, x + (w - aw) / 2 + (aw ? pad * 0.3 : 0), y + 0.5);
    if (m.stage) {
      // ▲（上がる）/ ▼（下がる）。2 段は 2 つ重ねる
      const up = m.stage > 0, n = Math.min(2, Math.abs(m.stage)), a = r * 0.42, cx = x + w - pad - a;
      for (let i = 0; i < n; i++) {
        const cy = n === 1 ? y : y + (i === 0 ? -1 : 1) * a * 0.75 * (up ? 1 : -1);
        const ah = n === 1 ? a * 0.95 : a * 0.62;
        g.beginPath();
        if (up) { g.moveTo(cx, cy - ah); g.lineTo(cx + a, cy + ah * 0.8); g.lineTo(cx - a, cy + ah * 0.8); }
        else { g.moveTo(cx, cy + ah); g.lineTo(cx + a, cy - ah * 0.8); g.lineTo(cx - a, cy - ah * 0.8); }
        g.closePath(); g.fill();
      }
    }
    g.restore();
    return w;
  };
  /** 戦闘の人の状態の一覧（status の id の配列 ＋ buffs）→ 印に渡す物（強化・弱体は {id, stage}） */
  BFX.statusList = function (u) {
    const b = (u && u.buffs) || {};
    return ((u && u.status) || []).map((s) => {
      const k = typeof s === 'string' && /^buff_(\w+)$/.exec(s);
      return k ? { id: s, stage: b[k[1]] | 0 || 1 } : s;
    });
  };
  BFX.statusName = function (id) {
    const d = R.DB.statuses && R.DB.statuses[id];
    if (d && d.name) return d.name;
    const N = { poison: R.T('art.fx_status.statusName.N.poison'), sleep: R.T('art.fx_status.statusName.N.sleep'), paralysis: R.T('art.fx_status.statusName.N.paralysis'), paralyze: R.T('art.fx_status.statusName.N.paralyze'), confuse: R.T('art.fx_status.statusName.N.confuse'), blind: R.T('art.fx_status.statusName.N.blind'), silence: R.T('art.fx_status.statusName.N.silence'), stone: R.T('art.fx_status.statusName.N.stone'), charm: R.T('art.fx_status.statusName.N.charm'), stun: R.T('art.fx_status.statusName.N.stun'), slow: R.T('art.fx_status.statusName.N.slow'), haste: R.T('art.fx_status.statusName.N.haste'), regen: R.T('art.fx_status.statusName.N.regen'), protect: R.T('art.fx_status.statusName.N.protect'), shell: R.T('art.fx_status.statusName.N.shell'), berserk: R.T('art.fx_status.statusName.N.berserk'), doom: R.T('art.fx_status.statusName.N.doom'), guard: R.T('art.fx_status.statusName.N.guard') };
    return N[id] || id;
  };
})(window.RPG);
