// 仮の実装: BATTLE（R.Mon・R.BattleCore・R.BattleAI）と BSCENE（R.Battle）。本物は src/systems/{mon,battle_core,battle_ai}.js・
// src/systems/battle/*。V2_PLAN §2.5.13・§2.5.3（全滅とやり直し）
// 仮の戦闘は「A で 1 行で勝つ」。形（units・options・出来事の列・rewards）は契約のとおりに返す。
(function (R) {
  'use strict';

  function monName(id) { const m = R.DB.monsters[id]; return (m && m.name) || id; }
  function enemyList(setup) {
    let mons = setup.mons;
    if (!mons && setup.troop) { const t = R.DB.troops[setup.troop]; mons = (t && t.mons) || [[setup.troop, 1]]; }
    const out = [];
    for (const [id, n] of mons || []) for (let i = 0; i < (n || 1); i++) out.push(id);
    return out;
  }

  R.Stubs.define('Mon', {
    /** 仮: 出現表の歩数で決まった間隔（24 歩ごと）に出る */
    encounter(zoneId, o) {
      const steps = (o && o.steps) || 0;
      if (!zoneId || steps <= 0 || steps % 24 !== 0) return null;
      const z = R.DB.encounters[zoneId];
      return { mons: (z && z.mons) || [['stub_slime', 2]], zone: zoneId, tier: R.Tier.get(), dark: !!(o && o.dark) };
    },
  });

  R.Stubs.define('BattleCore', {
    create(setup) {
      const G = R.Game;
      const units = [];
      for (const c of R.Party.members()) {
        units.push({ uid: 'p_' + c.id, side: 'party', id: c.id, name: c.name, hp: c.hp, mp: c.mp, maxHp: R.Growth.baseMax(c, 'hp'), maxMp: R.Growth.baseMax(c, 'mp'), row: c.row || 'front', status: [], sprite: c.look, size: 'M', alive: c.hp > 0, wtype: null });
      }
      enemyList(setup).forEach((id, i) => {
        units.push({ uid: 'e_' + i, side: 'enemy', id, name: monName(id), hp: 10, mp: 0, maxHp: 10, maxMp: 0, row: 'front', status: [], sprite: id, size: 'S', alive: true, wtype: null });
      });
      let over = null, repeatOn = false;
      const B = {
        setup, units,
        get over() { return over; },
        get repeatOn() { return repeatOn; },
        setRepeat(v) { repeatOn = !!v; },
        options() { return [{ cmd: 'attack', target: 'enemy' }, { cmd: 'defend', target: 'self' }]; },
        partyOptions() { return setup.noEscape ? ['fight'] : ['fight', 'escape']; },
        submit() {},
        repeat() {},
        round() {
          const hero = units.find((u) => u.side === 'party') || { uid: 'p_hero', name: '一行' };
          const foes = units.filter((u) => u.side === 'enemy' && u.alive);
          const ev = [{ t: 'turn', uid: hero.uid }, { t: 'act', uid: hero.uid, cmd: 'attack', id: 'attack', name: '攻撃', targets: foes.map((f) => f.uid) }];
          for (const f of foes) { ev.push({ t: 'dmg', uid: f.uid, n: f.hp, crit: false, weak: false, kind: 'phys' }); f.hp = 0; f.alive = false; ev.push({ t: 'ko', uid: f.uid }); }
          over = 'win';
          ev.push({ t: 'end', result: 'win' });
          if (G) G.battle.lastRound = [{ uid: hero.uid, cmd: 'attack' }];
          return ev;
        },
        rewards() { return { gold: 12, drops: [], grow: [], prof: [], glimmers: [] }; },
      };
      return B;
    },
  });

  R.Stubs.define('BattleAI', {
    enemyCommand() { return { cmd: 'attack', target: null }; },
    partyCommand() { return { cmd: 'attack', target: null }; },
  });

  // ---------------------------------------------------------------- 戦闘の場面（仮）
  function battleScene(setup, done) {
    const B = R.BattleCore.create(setup);
    const foes = B.units.filter((u) => u.side === 'enemy');
    const names = [...new Set(foes.map((f) => f.name))];
    const st = { phase: 'intro', line: `${names.join('・')}が あらわれた！`, t0: R.Engine.time };
    const enemyPos = (i) => ({ x: 120 + (i % 3) * 110 + (i >= 3 ? 50 : 0), y: 360 + (i % 2) * 60 + (i >= 3 ? -60 : 0) });
    const partyPos = [[575, 338], [616, 395], [668, 361], [726, 425]];
    const scene = {
      id: 'battle',
      opaque: true,
      enter() { R.Input.touchLayout('battle'); },
      exit() {},
      update() {
        const I = R.Input;
        if (!(I.pressed('a') || I.pointer.pressed)) return;
        if (st.phase === 'intro') {
          const evs = B.round();
          const hero = B.units.find((u) => u.side === 'party');
          st.line = `${hero ? hero.name : '一行'}の攻撃！ ${names.join('・')}を たおした！（仮の戦闘）`;
          st.phase = 'won';
          st.events = evs;
        } else if (st.phase === 'won') {
          const rw = B.rewards();
          R.Game.gold += rw.gold;
          done({ result: 'win', rewards: rw });
        }
      },
      draw(g) {
        const gr = g.createLinearGradient(0, 0, 0, R.H);
        gr.addColorStop(0, '#141a38'); gr.addColorStop(0.44, '#2a2c52'); gr.addColorStop(0.45, '#1c2230'); gr.addColorStop(1, '#10141e');
        g.fillStyle = gr; g.fillRect(0, 0, R.W, R.H);
        // 16:9 の配置（960 幅）を今の幅に合わせる（縦持ちは縮めて中ほどに置く）
        const sx = Math.min(1, R.W / 960), dx = R.W >= 960 ? (R.W - 960) / 2 : 0, dy = R.layout === 'tall' ? (R.H - 540) * 0.3 : 0;
        const X = (x) => x * sx + dx, Y = (y) => y + dy;
        foes.forEach((f, i) => {
          if (!f.alive) return;
          const p = enemyPos(i);
          R.Gfx.roundRect(X(p.x) - 24, Y(p.y) - 44, 48, 44, 10, '#6a5a9a', '#b8a8e8', 1.5);
          R.UIK.text(g, f.name, X(p.x), Y(p.y) + 6, { size: 12, align: 'center', color: R.UIK.T.color.text2 });
        });
        R.Party.members().forEach((c, i) => {
          const [x, y] = partyPos[i];
          R.Gfx.roundRect(X(x) - 16, Y(y) - 62, 32, 62, 8, i === 0 ? '#b98f47' : '#4f6a8a', '#f6f0e3', 1);
        });
        // パーティの一覧（右上）
        const k = R.uiScale;
        const px = R.W - (R.safe.r || 0) - 260 * k;
        R.UIK.fadePanel(g, { x: px - 20 * k, y: 10 * k, w: 280 * k, h: R.Party.members().length * 44 * k + 16 * k }, { side: 'r' });
        R.Party.members().forEach((c, i) => {
          const y = 18 * k + i * 44 * k, mh = R.Growth.baseMax(c, 'hp'), mm = R.Growth.baseMax(c, 'mp');
          R.UIK.text(g, c.name, px, y, { size: 15 * k, weight: 700 });
          R.UIK.text(g, `HP ${c.hp}/${mh}`, px + 110 * k, y, { size: 13 * k });
          R.UIK.text(g, `MP ${c.mp}/${mm}`, px + 190 * k, y, { size: 13 * k });
          R.UIK.gauge(g, { x: px + 110 * k, y: y + 20 * k, w: 70 * k, h: 3 }, c.hp, mh, 'hp');
          R.UIK.gauge(g, { x: px + 190 * k, y: y + 20 * k, w: 50 * k, h: 3 }, c.mp, mm, 'mp');
        });
        // 1 行の文
        const w = Math.min(R.W - 32, 720 * k), h = 52 * k;
        const x = (R.W - w) / 2, y = R.H - (R.safe.b || 0) - h - 44 * k;
        R.UIK.panel(g, { x, y, w, h }, {});
        R.UIK.text(g, st.line, x + 20 * k, y + (h - 16 * k) / 2, { size: 16 * k });
        R.UIK.prompts(g, [{ btn: 'a', label: st.phase === 'intro' ? 'たたかう' : 'つぎへ' }]);
      },
    };
    return scene;
  }

  R.Stubs.define('Battle', {
    start(setup) {
      setup = setup || {};
      return new Promise((resolve) => {
        R.Save.checkpoint('battle', { setup, seed: R.Game.seed });
        R.emit('battle:start', { setup });
        R.Audio.pushBgm(setup.bgm || (setup.boss ? 'boss' : 'battle'));
        const prevLayout = R.Input.layoutName;
        let fin = false;
        const done = (res) => {
          if (fin) return; fin = true;
          R.Engine.remove(scene, res);
          R.Audio.popBgm();
          R.Input.touchLayout(prevLayout);
          R.emit('battle:end', res);
          if (res.result === 'win') R.Save.autosave('battle');
          resolve(res);
        };
        const scene = battleScene(setup, done);
        R.Engine.push(scene);
      });
    },
  });
})(window.RPG);
