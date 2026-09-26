// BSCENE: 戦闘ボイス（BRIEF A37、design/notes/audio.md §13.2）。
//   仲間: assets/voice/b_<仲間の id>_<kind>_<n>   kind = attack(1–3) bigtech(1–2) spell hurt(1–2) ko victory
//   主人公: v_hero_<m|f>_<kind>_<n>                kind = attack glimmer bigtech? spell hurt ko victory
// 鳴らし方（A37）: 通常攻撃は約 1/3、大技と閃きは必ず、同時に 2 人は話さない（新しい声が前を止める）、勝利は生き残り 1 人だけ、
// 倍速では短い掛け声（attack・hurt）だけ。設定「戦闘ボイス」= 'on'（あり）/ 'big'（大技だけ）/ 'off'（なし）。
// 声のファイルが無い・音が使えない・node では何もしない（エラーにしない）。
(function (R) {
  'use strict';
  const Bt = (R.Battle = R.Battle || {});
  const _ = (Bt._ = Bt._ || {});
  const V = (_.voice = {});

  const SHORT = { attack: 1, hurt: 1 };
  const BIG = { bigtech: 1, glimmer: 1 };
  let cur = null;          // 今鳴っている {id, h}
  const last = {};         // who+kind → 最後の id（同じ声を続けない）
  V.log = [];              // テスト用: [{who, kind, id|null, why}]（最後の 50）
  let seq = 0;

  function note(o) { V.log.push(o); if (V.log.length > 50) V.log.shift(); }

  /** その人の声の接頭辞（主人公は見た目 hero_<m|f>_… か R.Game.chars.hero.sex から） */
  V.prefix = function (unit, kind) {
    if (!unit) return null;
    const id = unit.id;
    if (id === 'hero' || /^hero_/.test(unit.look || '')) {
      const G = R.Game, c = G && G.chars && G.chars.hero;
      const sex = (c && (c.sex || c.gender)) || (/^hero_([mf])_/.exec(unit.look || c && c.look || '') || [])[1] || 'm';
      return `v_hero_${sex === 'f' ? 'f' : 'm'}_${kind}_`;
    }
    return `b_${id}_${kind}_`;
  };

  /** 接頭辞に合う声の id（RPG_MEDIA.voice にある物だけ） */
  V.clips = function (pre) {
    const M = R.Media;
    if (!M || !pre) return [];
    try {
      if (typeof M.table === 'function') {
        const t = M.table();
        if (t && t.voice) return Object.keys(t.voice).filter((k) => k.startsWith(pre) && /^\d+$/.test(k.slice(pre.length))).sort();
      }
      if (typeof M.has === 'function') { const out = []; for (let n = 1; n <= 4; n++) if (M.has('voice', pre + n)) out.push(pre + n); return out; }
    } catch (e) { /* 無ければ鳴らさない */ }
    return [];
  };

  function setting() {
    const s = R.Settings && R.Settings.get('battleVoice');
    return s === 'off' || s === false ? 'off' : s === 'big' ? 'big' : 'on';
  }

  /**
   * 鳴らしてよければ鳴らす。kind: attack bigtech glimmer spell hurt ko victory。o = {speed, force, rng}
   * → 鳴らした id か null
   */
  V.play = function (unit, kind, o) {
    o = o || {};
    const mode = setting();
    const why = (w) => { note({ who: unit && unit.id, kind, id: null, why: w }); return null; };
    if (mode === 'off') return why('off');
    if (mode === 'big' && !BIG[kind]) return why('big-only');
    if ((o.speed || 1) > 1 && !SHORT[kind] && !BIG[kind]) return why('speed');
    const rnd = o.rng ? o.rng.next() : Math.random();
    if ((kind === 'attack' || kind === 'hurt') && !o.force && rnd > 1 / 3) return why('chance');
    let kinds = [kind];
    if (kind === 'glimmer') kinds = ['glimmer', 'bigtech'];   // 仲間には閃きの声が無い → 大技の声
    else if (kind === 'bigtech') kinds = ['bigtech', 'glimmer', 'attack'];
    let ids = [];
    for (const k of kinds) { ids = V.clips(V.prefix(unit, k)); if (ids.length) break; }
    if (!ids.length) return why('no-clip');
    const key = unit.id + ':' + kind;
    const pool = ids.length > 1 ? ids.filter((i) => i !== last[key]) : ids;
    const id = pool[Math.floor((o.rng ? o.rng.next() : Math.random()) * pool.length) % pool.length];
    last[key] = id;
    V.stop();
    let h = null;
    try {
      const A = R.Audio;
      if (A && typeof A.playVoice === 'function') h = A.playVoice(id);   // 前の声（会話も）を止めて 1 本だけ
      else if (A && typeof A.voice === 'function') A.voice(id);
    } catch (e) { h = null; }
    cur = { id, h, n: ++seq };
    note({ who: unit.id, kind, id, why: 'play' });
    return id;
  };
  V.stop = function () {
    if (!cur) return;
    try { if (R.Audio && R.Audio.stopVoice) R.Audio.stopVoice(cur.h || undefined); } catch (e) { /* ignore */ }
    cur = null;
  };

  /** 技が「大技」か（A37 の必ず鳴らす方）: データの big / grade、または MP 8 以上 */
  V.isBig = function (cmd, id) {
    if (cmd !== 'skill' && cmd !== 'spell') return false;
    const d = (cmd === 'skill' ? R.DB.techs : R.DB.spells) || {};
    const s = d[id];
    if (!s) return false;
    if (s.big || s.finisher || s.grade === 'big') return true;
    return cmd === 'skill' && (s.mp || 0) >= 8;
  };
})(window.RPG);
