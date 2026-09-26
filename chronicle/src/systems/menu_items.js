// Field menu: 道具 (consumables / equipment / key items; use, equip, discard), 技・術
// (field use of spells, techs shown grey) and the Y detail popup (DESIGN §11.7.18):
//   R.Menu.detailLines(id, {member}) → [{text, color?, segs?, icon?, right?, rightColor?}]  (pure; tests T1–T3)
//   R.Menu.itemDetail(id, {member}) / R.Menu.actionDetail(id, {member}) → Promise (any button closes)
(function (R) {
  'use strict';
  const DB = R.DB;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const Menu = (R.Menu = R.Menu || {});
  const K = () => Menu.kit;

  const WHITE = '#ffffff';
  const RED = '#ff5a4a', GREEN = '#6ee07a', GRAY = '#8c8c8c', SUB = '#c8c8d8', OFF = '#606070';
  const DETAIL_W = 224; // text width in the popup (fitText squeezes longer lines, §11.7.18)

  // ------------------------------------------------------------ phrase tables (§11.7.18)
  const sgn = (v) => (v > 0 ? '+' : v < 0 ? '-' : '+') + Math.abs(Math.round(v * 100) / 100);
  const pct = (v) => sgn(v) + '%';
  const TARGET_NAMES = {
    enemy: '敵1体', enemies: '敵全体', group: 'ひと群れ', random: '敵ランダム', ally: '味方1人', allies: '味方全員', self: '自分',
    ally_dead: '倒れた1人', ally_any: '味方1人（倒れた人も）', party: '味方全員（倒れた人も）',
  };
  Menu.TARGET_NAMES = TARGET_NAMES;
  const FLAG_NAMES = { flying: '飛ぶ敵', metal: '鋼の魔物', boss: 'ボス', rare: 'めずらしい魔物' };
  const KIND_NAMES = { slash: '斬', blunt: '打', pierce: '突' };
  const WEIGHT_NAMES = { heavy: '重装', light: '軽装', cloth: '布' };
  const STAT_PCT = { strPct: 'str', vitPct: 'vit', dexPct: 'dex', agiPct: 'agi', intPct: 'int', mndPct: 'mnd' };
  // plain numeric keys: [name, % suffix, red when positive]
  const NUM_KEYS = {
    atk: ['攻撃力', 0], def: ['守備力', 0], mdef: ['術防', 0], hit: ['命中', 0], eva: ['回避', 0], crit: ['会心', 0], mag: ['術力', 0], spd: ['行動の速さ', 0],
    hpPct: ['最大HP', 1], mpPct: ['最大MP', 1], wpPct: ['最大WP', 1], defPct: ['守備力', 1], mdefPct: ['術防', 1],
    physPct: ['物理の威力', 1], magicPct: ['術の威力', 1], healPct: ['回復の術', 1], itemPct: ['回復の道具', 1],
    takenPct: ['受けるダメージ', 1, 1], mpCostPct: ['消費MP', 1, 1], wpCostPct: ['消費WP', 1, 1],
    expPct: ['経験値', 1], goldPct: ['ゴールド', 1], dropPct: ['ドロップ率', 1], rarePct: ['レア率', 1], superPct: ['超レア率', 1],
    rareEncPct: ['めずらしい魔物', 1], goldenPct: ['金色の魔物', 1], preemptPct: ['先制', 1], escapePct: ['逃げやすさ', 1], stealPct: ['盗み', 1],
  };
  // §3.3.16 order (the popup lists special effects in this order)
  const MOD_ORDER = [
    'atk', 'def', 'mdef', 'hit', 'eva', 'crit', 'spd', 'mag', 'strPct', 'vitPct', 'dexPct', 'agiPct', 'intPct', 'mndPct', 'hpPct', 'mpPct', 'wpPct',
    'defPct', 'mdefPct', 'physPct', 'magicPct', 'healPct', 'itemPct', 'takenPct', 'mpCostPct', 'wpCostPct', 'elemBoost', 'elemResist',
    'statusImmune', 'statusResist', 'profPct', 'glimPct', 'expPct', 'goldPct', 'dropPct', 'rarePct', 'superPct', 'rareEncPct', 'goldenPct',
    'preemptPct', 'escapePct', 'stealPct', 'autoSteal', 'encounterPct', 'regen', 'mpRegen', 'wpRegen', 'startBuffs', 'noSpell', 'hpLoss',
    'autoRevive', 'autoCounter', 'walkHeal', 'noFloorDamage',
  ];
  Menu.MOD_KEYS = MOD_ORDER.slice();
  const WEAPON_KEYS = ['element', 'onHit', 'vs', 'drain', 'sealTech', 'metalHit'];
  Menu.WEAPON_DETAIL_KEYS = WEAPON_KEYS.concat(['twoHanded', 'hit', 'crit', 'wtype', 'atk', 'mag']);
  const profName = (k) => (DB.weaponTypes[k] || K().WTYPE_NAMES[k] ? K().wtypeName(k) : DB.elements[k] || K().ELEM_NAMES[k] ? K().elemName(k) : k);
  const vsName = (k) => FLAG_NAMES[k] || (DB.statuses[k] || K().STATUS_NAMES[k] ? K().statusName(k) + 'の敵' : K().raceName(k) || k);
  const P = (text, bad) => ({ text, color: bad ? RED : WHITE });

  /**
   * special-effect phrases of an item (its weapon fields, then its mods in the §3.3.16 order) or of a
   * mods object: [{text, color}]. Unknown keys come out grey with their raw name (test T2 catches them).
   */
  function modPhrases(mods, it) {
    const out = [];
    const m = mods || {};
    const quirk = !!(it && it.quirk);
    if (it && it.type === 'weapon') {
      if (it.element) out.push(P(K().elemName(it.element) + 'の属性'));
      if (it.onHit && it.onHit.status) out.push(P('攻撃で' + K().statusName(it.onHit.status) + Math.round((it.onHit.chance || 0) * 100) + '%'));
      if (it.vs) for (const k of Object.keys(it.vs)) out.push(P(vsName(k) + 'に強い（×' + it.vs[k] + '）'));
      if (it.drain) out.push(P('与えた傷の' + Math.round((it.drain < 1 ? it.drain * 100 : it.drain)) + '%を吸う'));
      if (it.sealTech) out.push(P('技が使えない', 1));
      if (it.metalHit) out.push(P('鋼の魔物にも効く'));
    }
    const seen = {};
    const keys = MOD_ORDER.filter((k) => k in m).concat(Object.keys(m).filter((k) => !MOD_ORDER.includes(k)));
    for (const k of keys) {
      if (seen[k]) continue;
      seen[k] = 1;
      const v = m[k];
      if (v == null || v === 0 || v === false) continue;
      if (NUM_KEYS[k]) {
        const [name, isPct, badWhenUp] = NUM_KEYS[k];
        out.push(P(name + (isPct ? pct(v) : sgn(v)), badWhenUp ? v > 0 : v < 0));
      } else if (STAT_PCT[k]) out.push(P(K().STAT_NAMES[STAT_PCT[k]] + pct(v), v < 0));
      else if (k === 'elemBoost') for (const e of Object.keys(v)) out.push(P(K().elemName(e) + 'の威力' + pct(v[e]), v[e] < 0));
      else if (k === 'elemResist') {
        for (const e of Object.keys(v)) {
          const r = v[e], n = K().elemName(e);
          if (r === 1) continue;
          if (r === 0.5) out.push(P(n + 'に強い'));
          else if (r === 0) out.push(P(n + 'が効かない'));
          else if (r < 0) out.push(P(n + 'を吸う'));
          else if (r >= 1.5) out.push(P(n + 'に弱い', 1));
          else out.push(P(n + 'のダメージ×' + r, r > 1));
        }
      } else if (k === 'statusImmune') { if (v.length) out.push(P(v.map(K().statusName).join('・') + 'が効かない')); }
      else if (k === 'statusResist') { const ks = Object.keys(v).filter((s) => v[s]); if (ks.length) out.push(P(ks.map(K().statusName).join('・') + 'にかかりにくい')); }
      else if (k === 'profPct') for (const p of Object.keys(v)) out.push(P(profName(p) + 'の熟練度の伸び' + pct(v[p]), v[p] < 0));
      else if (k === 'glimPct') {
        for (const p of Object.keys(v)) {
          const n = p === 'tech' ? '技の閃き' : p === 'spell' ? '術の閃き' : profName(p) + 'の閃き';
          out.push(P(n + pct(v[p]), v[p] < 0));
        }
      } else if (k === 'autoSteal') out.push(P('攻撃でついでに盗む' + Math.round(v) + '%'));
      else if (k === 'encounterPct') out.push(P('魔物の出現' + pct(v), quirk && v > 0));
      else if (k === 'regen') out.push(P('手番ごとにHP回復'));
      else if (k === 'mpRegen') out.push(P('手番ごとにMP' + sgn(v)));
      else if (k === 'wpRegen') out.push(P('手番ごとにWP' + sgn(v)));
      else if (k === 'startBuffs') for (const s of Object.keys(v)) out.push(P('戦闘の始めに' + (K().BUFF_NAMES[s] || K().STAT_NAMES[s] || s) + sgn(v[s]) + '段', v[s] < 0));
      else if (k === 'noSpell') out.push(P('術が使えない', 1));
      else if (k === 'hpLoss') out.push(P('手番ごとに最大HP-' + Math.abs(v) + '%', 1));
      else if (k === 'autoRevive') out.push(P('倒れても起き上がる' + Math.round(v * 100) + '%'));
      else if (k === 'autoCounter') out.push(P('反撃' + Math.round(v * 100) + '%'));
      else if (k === 'walkHeal') out.push(P('歩くとHP回復'));
      else if (k === 'noFloorDamage') out.push(P('ダメージ床を受けない'));
      else out.push({ text: k, color: GRAY, unknown: true });
    }
    return out;
  }
  Menu.modPhrases = modPhrases;

  /** phrases of use effects (consumables) or of an action's extra effects */
  function effectPhrases(effects, o) {
    const opts = o || {};
    const out = [];
    for (const e of effects || []) {
      switch (e.type) {
        case 'heal': out.push(P(e.pct >= 1 ? 'HPをすべて回復' : 'HPを' + Math.round((e.pct || 0) * 100) + '%回復')); break;
        case 'healMp': out.push(P(e.pct >= 1 ? 'MPをすべて回復' : 'MPを' + Math.round((e.pct || 0) * 100) + '%回復')); break;
        case 'healWp': out.push(P(e.pct >= 1 ? 'WPをすべて回復' : 'WPを' + Math.round((e.pct || 0) * 100) + '%回復')); break;
        case 'revive': out.push(P('生き返らせる（HP' + Math.round((e.pct || 0) * 100) + '%）')); break;
        case 'cure': out.push(P(e.statuses === 'all' ? '悪い状態をすべて治す' : (e.statuses || []).map(K().statusName).join('・') + 'を治す')); break;
        case 'buff': out.push(P((K().BUFF_NAMES[e.stat] || e.stat) + sgn(e.stages) + '段')); break;
        case 'damage': if (!opts.skipDamage) out.push(P(e.element ? K().elemName(e.element) + 'のダメージ' : 'ダメージ')); break;
        case 'escape': out.push(P('必ず逃げ出せる')); break;
        case 'scan': out.push(P('HPと弱点を見破る')); break;
        case 'encounter': out.push(P((e.steps || 100) + '歩のあいだ魔物の出現' + pct(e.pct || 0) + (e.weakOnly ? '（弱い魔物だけ）' : ''))); break;
        case 'grow': out.push(P(K().STAT_NAMES[e.stat] + '+' + (e.n || 1))); break;
        case 'status': {
          const st = DB.statuses[e.status];
          const good = st ? !st.bad : ['regen', 'veil', 'counter', 'nimble', 'cover'].includes(e.status);
          out.push(P(K().statusName(e.status) + (good || e.chance == null ? '' : Math.round(e.chance * 100) + '%')));
          break;
        }
        case 'dispel': out.push(P(e.side === 'bad' ? '弱体を消す' : '強化を消す')); break;
        case 'cover': out.push(P('かばう')); break;
        case 'steal': out.push(P('盗む')); break;
        case 'teleport': out.push(P('行ったことのある町へ移動')); break;
        case 'exit': out.push(P('ダンジョンから脱出')); break;
        default: break;
      }
    }
    return out;
  }
  Menu.effectPhrases = effectPhrases;

  const approx = (s) => (R.Text && R.Text.approxWidth ? R.Text.approxWidth(s) : String(s).length * 32 / 3);
  const textW = (s) => {
    try { if (G() && G().ctx) return G().textWidth(s); } catch (e) { /* node */ }
    return approx(s);
  };
  /** pack phrases into at most `max` lines of `w` px joined by 「　」; the last line ends 「……ほか」 when they do not fit */
  function packLines(phrases, max, w) {
    const lines = [];
    let cur = [];
    const width = (segs) => segs.reduce((a, s, i) => a + textW(s.text) + (i ? textW('　') : 0), 0);
    for (const p of phrases) {
      if (cur.length && width(cur.concat([p])) > w) { lines.push(cur); cur = []; }
      cur.push(p);
    }
    if (cur.length) lines.push(cur);
    if (lines.length > max) {
      const keep = lines.slice(0, max);
      const last = keep[max - 1];
      const more = { text: '……ほか', color: SUB };
      while (last.length > 1 && width(last.concat([more])) > w) last.pop();
      last.push(more);
      return keep.map(joinSegs);
    }
    return lines.map(joinSegs);
  }
  function joinSegs(segs) {
    const out = [];
    segs.forEach((s, i) => { if (i) out.push({ text: '　', color: WHITE }); out.push(s); });
    return { text: out.map((s) => s.text).join(''), segs: out };
  }
  Menu.packLines = packLines;

  const gearTypes = { weapon: 1, shield: 1, head: 1, body: 1, hands: 1, feet: 1, acc: 1 };
  const seenMon = (id) => { const b = R.Game && R.Game.book && R.Game.book.mon && R.Game.book.mon[id]; return !!(b && (b.seen || b.kills)); };
  const monName = (id) => (seenMon(id) && DB.monsters[id] ? DB.monsters[id].name : '？？？');
  /** monsters that carry item id in drop slot `slot` (DB order) */
  function carriers(id, slot) {
    const out = [];
    for (const mid in DB.monsters) {
      const d = DB.monsters[mid].drops;
      const s = d && d[slot];
      if (s && s.item === id) out.push(mid);
    }
    return out;
  }
  /** the 入手 line of an item (§11.7.18, STYLE_JA §9) */
  function sourceLine(it, id) {
    switch (it.src) {
      case 'shop': return '入手：店で買える';
      case 'drop': return it.type === 'consumable' ? '入手：宝箱・魔物' : '入手：宝箱・ボス';
      case 'mdrop': {
        const list = carriers(id, 'rare');
        const seenOne = list.find(seenMon);
        return '入手：' + (seenOne ? DB.monsters[seenOne].name : '？？？') + (list.length > 1 ? 'ほか' : '') + 'が落とす（レア）';
      }
      case 'super': {
        const mon = it.exclusive || carriers(id, 'super')[0];
        return '入手：' + (mon ? monName(mon) : '？？？') + 'だけが落とす';
      }
      case 'relic': {
        const mon = it.exclusive || carriers(id, 'super')[0] || carriers(id, 'rare')[0] || carriers(id, 'normal')[0];
        return '入手：めずらしい魔物' + (mon ? monName(mon) : '？？？') + 'が落とす';
      }
      case 'reward': return '入手：物語のお礼の一品物';
      default: return it.unique ? '入手：物語のお礼の一品物' : '';
    }
  }
  Menu.sourceLine = sourceLine;

  function gradeRight(it) {
    const C = G().C;
    if (it.type === 'key') return ['大事なもの', SUB];
    if (it.unique) return ['一品物◆', C.cyan];
    const g = it.grade || 'normal';
    if (g === 'super') return ['超レア★★', C.super]; // BRIEF A6 (lead reading): 通常 / レア★ / 超レア★★
    if (g === 'rare') return ['レア★', C.rare];
    return ['通常', WHITE];
  }
  function kindLine(it) {
    if (it.type === 'weapon') return K().wtypeName(it.wtype) + '　' + (K().isTwoHanded(it.id || null) || it.twoHanded || (DB.weaponTypes[it.wtype] && DB.weaponTypes[it.wtype].twoHanded) ? '両手持ち' : '片手持ち');
    if (it.type === 'acc') return 'アクセサリ';
    const w = WEIGHT_NAMES[it.weight] || '';
    if (it.type === 'shield') return '盾' + (w ? '　' + w : '');
    return w || K().TYPE_NAMES[it.type] || '';
  }
  function numbersLine(it) {
    if (it.type === 'weapon') {
      const p = ['攻撃力 ' + (it.atk || 0), '術力 ' + (it.mag || 0)];
      if (it.hit) p.push('命中' + sgn(it.hit));
      if (it.crit) p.push('会心' + sgn(it.crit));
      return p.join('　');
    }
    if (it.type === 'acc') {
      // most accessories carry no numbers: the row stays empty and the popup closes the gap
      const p = [];
      if (it.atk) p.push('攻撃力' + sgn(it.atk));
      if (it.def) p.push('守備力' + sgn(it.def));
      if (it.mdef) p.push('術防' + sgn(it.mdef));
      return p.length ? p.join('　') : '―';
    }
    const p = ['守備力 ' + (it.def || 0), '術防 ' + (it.mdef || 0)];
    if (it.type === 'shield' && it.eva) p.push('回避' + sgn(it.eva));
    return p.join('　');
  }
  function statSegs(it) {
    const st = it.stats || {};
    const segs = [];
    for (const k of K().STATS6) {
      const v = st[k];
      if (!v) continue;
      if (segs.length) segs.push({ text: '　', color: WHITE });
      segs.push({ text: K().STAT_NAMES[k] + sgn(v), color: v > 0 ? GREEN : RED });
    }
    for (const k of ['hp', 'mp', 'wp']) {
      const v = st[k];
      if (!v) continue;
      if (segs.length) segs.push({ text: '　', color: WHITE });
      segs.push({ text: K().STAT_NAMES[k] + sgn(v), color: v > 0 ? GREEN : RED });
    }
    if (!segs.length) return { text: '能力値の増減なし', color: GRAY };
    return { text: segs.map((s) => s.text).join(''), segs };
  }
  function whoLine(id, member) {
    const party = (R.Game && R.Game.party) || [];
    const list = member && party.includes(member) ? [member].concat(party.filter((c) => c !== member)) : party.slice();
    const segs = [{ text: '装備：', color: SUB }];
    list.forEach((c, i) => {
      if (i) segs.push({ text: '　', color: WHITE });
      const ok = K().slotsFor(id).some((s) => K().canEquip(c, id, s));
      segs.push({ text: c.name, color: ok ? WHITE : OFF });
    });
    return { text: segs.map((s) => s.text).join(''), segs };
  }
  function useWhere(u) {
    if (!u) return '使うことはできない';
    if (u.battle && u.field) return '戦闘中・移動中に使える';
    if (u.battle) return '戦闘中だけ使える';
    if (u.field) return '移動中だけ使える';
    return '使うことはできない';
  }
  function descLines(desc, n, w) {
    let lines = String(desc || '').split('\n');
    if (lines.length < n && lines.some((l) => textW(l) > w)) {
      try { if (G() && G().ctx) lines = G().wrap(String(desc || '').replace(/\n/g, ''), w); } catch (e) { /* keep */ }
    }
    const out = lines.slice(0, n);
    while (out.length < n) out.push('');
    return out;
  }

  function itemLines(id, o) {
    const it = DB.items[id];
    const member = o && o.member;
    const L = [];
    const [right, rightColor] = gradeRight(it);
    L[0] = { text: K().itemLabel(id), color: K().itemColor(id), icon: it, right, rightColor };
    if (it.type === 'key') {
      for (let k = 1; k <= 9; k++) L[k] = { text: '' };
      if (it.use && it.use.field) L[1] = { text: '移動中に使える（使っても無くならない）', color: SUB };
      const d = descLines(it.desc, 2, DETAIL_W);
      L[10] = { text: d[0] }; L[11] = { text: d[1] };
      return L;
    }
    if (gearTypes[it.type]) {
      const withId = Object.assign({ id }, it);
      L[1] = { text: kindLine(withId), color: SUB };
      L[2] = { text: numbersLine(it) };
      L[3] = statSegs(it);
      const fx = packLines(modPhrases(it.mods, it), 4, DETAIL_W);
      for (let k = 0; k < 4; k++) L[4 + k] = fx[k] || { text: '' };
      L[8] = whoLine(id, member);
    } else {
      const u = it.use;
      L[1] = { text: useWhere(u), color: SUB };
      L[2] = { text: u ? '対象：' + (TARGET_NAMES[u.target] || '―') : '対象：―' };
      L[3] = { text: '持っている数：' + (R.State && R.Game ? R.State.count(id) : 0) };
      const ph = effectPhrases(u && u.effects);
      if (it.stone) ph.push(P(K().elemName(it.stone) + 'の熟練度+1'), P('術を閃くことがある'));
      const fx = packLines(ph, 4, DETAIL_W);
      for (let k = 0; k < 4; k++) L[4 + k] = fx[k] || { text: '' };
      L[8] = { text: '' };
    }
    L[9] = { text: sourceLine(it, id), color: SUB };
    const d = descLines(it.desc, 2, DETAIL_W);
    L[10] = { text: d[0] }; L[11] = { text: d[1] };
    return L;
  }

  function actionLines(id, o) {
    const a = DB.actions[id];
    const member = o && o.member;
    const tech = a.kind === 'tech';
    const L = [];
    const c = member || null;
    const costN = c ? K().cost(c, id) : tech ? a.wp || 0 : a.mp || 0;
    const cut = c && !tech && R.Rules && R.Rules.profMpKind ? R.Rules.profMpKind(c, id) : null;
    L[0] = { text: a.name, color: WHITE, right: (tech ? 'W ' : 'M ') + costN, rightColor: cut ? G().C.cyan : WHITE, big: true };
    if (tech) {
      const lv = (a.glim && a.glim.lv) || a.rank || 1;
      L[1] = { text: K().wtypeName(a.wtype) + 'の技　格' + lv + (lv === 9 ? '（奥義）' : lv >= 10 ? '（極意）' : ''), color: SUB };
    } else {
      const els = a.elements || [];
      const segs = [];
      if (els.length === 1) {
        segs.push({ text: K().elemName(els[0]), color: K().elemColor(els[0]) }, { text: 'の術　' + (a.step || a.rank || 1) + '段', color: SUB });
      } else {
        segs.push({ text: els.length === 2 ? '合成術　' : '三属性の術　', color: SUB });
        els.forEach((e, i) => { if (i) segs.push({ text: '＋', color: SUB }); segs.push({ text: K().elemName(e), color: K().elemColor(e) }); });
      }
      L[1] = { text: segs.map((s) => s.text).join(''), segs };
    }
    const reach = !tech || !!a.reach;
    L[2] = { text: '対象：' + (TARGET_NAMES[a.target] || '―') + '　中列から：' + (reach ? '届く' : '届かない') };
    // the first damage / heal / revive effect
    const effs = a.effects || [];
    const dmg = effs.find((e) => e.type === 'damage');
    let line3 = '―';
    if (dmg) {
      const pw = Math.round((dmg.power || 0) * 10);
      const hits = dmg.hits && dmg.hits > 1 ? dmg.hits : 0;
      const parts = ['威力 ' + pw + (hits ? '×' + hits + '回' : '') + (a.target === 'random' ? (hits ? '' : '×1回') + '（ランダム）' : '')];
      const els = tech ? (dmg.element ? [dmg.element] : []) : a.elements || [];
      if (els.length) parts.push(els.map(K().elemName).join('＋') + 'の属性');
      if (tech && (!dmg.formula || dmg.formula === 'phys')) {
        const kind = dmg.kind || (DB.weaponTypes[a.wtype] && DB.weaponTypes[a.wtype].kind);
        if (KIND_NAMES[kind]) parts.push(KIND_NAMES[kind]);
      }
      if (dmg.sure) parts.push('必ず当たる');
      line3 = parts.join('　');
    } else {
      const h = effs.find((e) => e.type === 'heal');
      const rv = effs.find((e) => e.type === 'revive');
      if (h) line3 = '回復 ' + Math.round((h.pct || 0) * 100) + '%';
      else if (rv) line3 = '生き返らせる（HP' + Math.round((rv.pct || 0) * 100) + '%）';
    }
    L[3] = { text: line3 };
    // extra effects (everything but the one shown on line 3)
    const firstShown = dmg || effs.find((e) => e.type === 'heal') || effs.find((e) => e.type === 'revive');
    const extra = effs.filter((e) => e !== firstShown);
    const ph = [];
    if (dmg && dmg.drain) ph.push(P('与えた傷の' + Math.round(dmg.drain * 100) + '%を吸う'));
    for (const e of extra) {
      if (e.type === 'status' && e.status === 'counter') ph.push(P('反撃の構え'));
      else ph.push(...effectPhrases([e], { skipDamage: false }));
    }
    const fe = a.fieldEffects && a.fieldEffects.find((e) => e.type === 'encounter');
    if (fe) ph.push(P('移動中は' + (fe.pct < 0 ? (fe.weakOnly ? '弱い魔物を避ける' : '魔物を避ける') : '魔物を呼ぶ')));
    const fx = packLines(ph, 1, DETAIL_W);
    L[4] = fx[0] || { text: '' };
    // who knows it (recruited members only)
    const book = (R.Game && R.Game.book && (tech ? R.Game.book.tech : R.Game.book.spell)) || {};
    const knowers = (book[id] || []).map((cid) => K().charById(cid)).filter(Boolean).map((ch) => ch.name);
    L[5] = knowers.length ? { text: '覚えている：' + knowers.join('　') } : { text: 'まだ誰も覚えていない。', color: GRAY };
    L[6] = { text: String(a.desc || '').split('\n')[0] };
    // Part A13: the member's proficiency bonus on damage / healing (and A13b's MP cut), on a row of its own under 威力
    if (c && R.Rules && R.Rules.profPowerPct) {
      const segs = [];
      if (dmg || effs.some((e) => e.type === 'heal')) {
        const pct = R.Rules.profPowerPct(c, a);
        const src = tech ? K().wtypeName(a.wtype) : (a.elements || []).length > 1 ? '平均' : K().elemName((a.elements || [])[0]);
        segs.push({ text: '熟練の補正 ', color: SUB }, { text: '+' + pct + '%', color: pct > 0 ? G().C.orange : GRAY }, { text: '（' + src + '）', color: SUB });
      }
      if (cut) segs.push({ text: (segs.length ? '　' : '') + (cut === 'free' ? '熟練でMP0' : '熟練でMP半分'), color: G().C.cyan });
      if (segs.length) {
        L.splice(4, 0, { text: segs.map((q) => q.text).join(''), segs });
      }
    }
    return L;
  }

  /** the rows of the Y popup for an item or a tech / spell (pure; drawing uses only this) */
  Menu.detailLines = function (id, o) {
    if (DB.items[id]) return itemLines(id, o || {});
    if (DB.actions[id]) return actionLines(id, o || {});
    return [];
  };

  // ------------------------------------------------------------ the popup layer
  let C = null;
  const cls = () => C || (C = build());
  /** Y (詳細): the item popup; any button closes it (the list keeps its cursor) */
  Menu.itemDetail = (id, o) => (DB.items[id] ? (R.sfx('confirm'), R.Engine.run(new (cls().Detail)(id, o || {}, 'item'))) : Promise.resolve());
  /** Y (詳細) on a tech or a spell */
  Menu.actionDetail = (id, o) => (DB.actions[id] ? (R.sfx('confirm'), R.Engine.run(new (cls().Detail)(id, o || {}, 'action'))) : Promise.resolve());
  Menu.itemScreen = () => R.Engine.run(new (cls().ItemScreen)());
  Menu.spellScreen = (o) => R.Engine.run(new (cls().SpellScreen)(o || {}));

  /** draw one detail row (text / segments / icon / right label) at (x, y) within w */
  function drawLine(l, x, y, w) {
    if (!l) return;
    if (l.icon) {
      K().drawIcon(l.icon, x, y + 2);
      K().fitText(l.text, x + 12, y, 150, { color: l.color || WHITE });
    } else if (l.segs) K().drawSegs(l.segs, x, y, w);
    else if (l.text) K().fitText(l.text, x, y, w, { color: l.color || WHITE });
    if (l.right) G().text(l.right, x + w, y, { align: 'right', color: l.rightColor || WHITE });
  }
  Menu.drawDetailLine = drawLine;

  let lastTab = 0;
  let lastFilter = 0;
  let lastSpellMember = 0;
  const FILTERS = [null, 'weapon', 'shield', 'head', 'body', 'hands', 'feet', 'acc'];
  const FILTER_NAMES = ['全部', '武器', '盾', '頭', '体', '手', '足', 'アクセサリ'];

  function build() {
    const Kt = K();

    class Detail extends Kt.Screen {
      constructor(id, o, kind) {
        super();
        this.id = id; this.o = o; this.kind = kind;
        this.lines = Menu.detailLines(id, o);
        const it = DB.items[id];
        this.isKey = !!(it && it.type === 'key');
        if (kind === 'item') {
          this.title = (it && Kt.TYPE_NAMES[it.type]) || '詳細';
          // rows 0–3 and 8–11 stay; empty rows in between are dropped so short items get a shorter window
          const keep = [];
          this.lines.forEach((l, i) => { if (i === 0 || (l && l.text)) keep.push({ l, i }); });
          this.rows = keep.map((k) => k.l);
          this.sep = keep.findIndex((k) => k.i >= 9); // a thin rule above 入手 / the description
          this.box = { x: 8, y: 20, w: 240, h: 16 + this.rows.length * 14 + (this.sep > 0 ? 4 : 0) };
          if (this.isKey) this.box.y = 60;
        } else {
          this.title = DB.actions[id].kind === 'tech' ? '技' : '術';
          this.rows = this.lines;
          this.sep = this.lines.length - 1; // the description (the last row) under a thin rule
          this.box = { x: 8, y: this.lines.length > 7 ? 49 : 56, w: 240, h: 16 + this.lines.length * 14 + 4 };
        }
      }
      input() {
        if (In().pressed('a') || In().pressed('b') || In().pressed('y')) { R.sfx('cancel'); this.close(); }
      }
      render() {
        const { x, y, w, h } = this.box;
        G().window(x, y, w, h, { title: this.title });
        this.rows.forEach((l, k) => {
          const extra = this.sep > 0 && k >= this.sep ? 4 : 0;
          if (extra && k === this.sep) G().rect(x + 8, y + 8 + 14 * k, DETAIL_W, 1, '#3a4470');
          drawLine(l, x + 8, y + 8 + 14 * k + extra, DETAIL_W);
        });
      }
    }

    // ============================================================ 道具
    const TABS = [
      { id: 'use', label: '道具', pred: (it) => it.type === 'consumable' },
      { id: 'gear', label: '装備品', pred: (it) => gearTypes[it.type] },
      { id: 'key', label: '大事なもの', pred: (it) => it.type === 'key' },
    ];
    const TAB_X = [14, 58, 108];
    class ItemScreen extends Kt.Screen {
      constructor() {
        super();
        this.tab = lastTab;
        this.filter = lastFilter;
        this.list = new R.UI.List({ x: 4, y: 30, w: 248, rows: 8, items: [], padX: 16, drawItem: (row, x, y, w) => this.drawRow(row, x, y, w) });
        this.refresh(false);
      }
      pred() {
        const t = TABS[this.tab];
        if (t.id !== 'gear' || !FILTERS[this.filter]) return t.pred;
        const f = FILTERS[this.filter];
        return (it) => it.type === f;
      }
      refresh(keep) {
        const all = R.State.items ? R.State.items(this.pred()) : Object.keys(R.Game.inv).filter((id) => DB.items[id] && this.pred()(DB.items[id])).map((id) => ({ id, count: R.Game.inv[id], item: DB.items[id] }));
        this.entries = all.filter((e) => e && e.item);
        this.list.setItems(this.entries.map((e) => ({ label: e.item.name, e })), keep);
      }
      get cur() { const r = this.list.item; return r && r.e; }
      input() {
        const d = In().dirRepeat();
        if (d === 'left' || d === 'right') {
          this.tab = (this.tab + (d === 'left' ? TABS.length - 1 : 1)) % TABS.length;
          lastTab = this.tab;
          R.sfx('cursor');
          this.refresh(false);
          return;
        }
        const lr = Kt.memberStep();
        if (lr && TABS[this.tab].id === 'gear') {
          this.filter = (this.filter + (lr < 0 ? FILTERS.length - 1 : 1)) % FILTERS.length;
          lastFilter = this.filter;
          R.sfx('page');
          this.refresh(false);
          return;
        }
        if (In().pressed('y') && this.cur) { this.flow(() => Menu.itemDetail(this.cur.id)); return; }
        const r = this.list.update();
        if (r === 'cancel') this.close();
        else if (r === 'select' && this.cur) this.flow(() => this.act(this.cur));
      }
      async act(e) {
        const it = e.item;
        const tab = TABS[this.tab].id;
        if (tab === 'key') {
          const u = it.use || {};
          if (u.field && (u.effects || []).length) {
            const res = await Menu.useItem(e.id);
            if (res === 'exit') this.close('exit');
          } else R.sfx('buzzer');
          return;
        }
        const row = this.list.index - this.list.top;
        const cy = Math.min(30 + 8 + row * 14 - 4, 112);
        if (tab === 'use') {
          const u = it.use || {};
          const usable = !!(u.field && (u.effects || []).length);
          const i = await Kt.choose([{ label: '使う', disabled: !usable }, { label: '捨てる', disabled: !!it.unique }], { x: 164, y: cy, w: 84, initial: usable ? 0 : 1 });
          if (i < 0) return;
          if (i === 0) {
            const res = await Menu.useItem(e.id);
            if (res === 'exit') { this.close('exit'); return; }
          } else await this.discard(e);
        } else {
          const i = await Kt.choose(['装備する', { label: '捨てる', disabled: !!it.unique }], { x: 164, y: cy, w: 84 });
          if (i < 0) return;
          if (i === 0) await this.equip(e);
          else await this.discard(e);
        }
        this.refresh(true);
      }
      async equip(e) {
        const id = e.id;
        const slots = Kt.slotsFor(id);
        const ok = (c) => slots.some((s) => Kt.canEquip(c, id, s));
        const party = R.Game.party;
        if (!party.some(ok)) { R.sfx('buzzer'); await Kt.msg('誰も装備できない。'); return; }
        const k = await Menu.pickMember({ title: '誰が装備する？', valid: ok, initial: Math.max(0, party.findIndex(ok)), x: 102, y: 40 });
        if (k < 0) return;
        const c = party[k];
        let slot = slots.filter((s) => Kt.canEquip(c, id, s))[0];
        const choices = slots.filter((s) => Kt.canEquip(c, id, s));
        if (choices.length > 1) {
          const j = await Kt.choose(choices.map((s) => ({ label: Kt.slotName(s), right: c.equip[s] ? Kt.itemName(c.equip[s]) : '―' })),
            { x: 76, y: 60, w: 172, title: 'どこに付ける？', initial: Math.max(0, choices.findIndex((s) => !c.equip[s])) });
          if (j < 0) return;
          slot = choices[j];
        }
        const r = Kt.equip(c, slot, id);
        if (!r.ok) { R.sfx('buzzer'); await Kt.msg(r.reason || '装備できない。'); return; }
        R.sfx('item');
        const shieldOff = r.removed.some((x) => DB.items[x] && DB.items[x].type === 'shield') && slot !== 'shield';
        await Kt.msg(c.name + 'は' + e.item.name + 'を装備した！' + (shieldOff ? '\n盾を外した。' : ''));
      }
      async discard(e) {
        const it = e.item;
        if (it.unique) { R.sfx('buzzer'); await Kt.msg('これは捨てられない。'); return; }
        let n = 1;
        if (e.count > 1) {
          n = await Kt.number({ min: 1, max: e.count, initial: 1, label: '捨てる数', x: 128, y: 100, w: 120 });
          if (n < 0) return;
        }
        if (!(await Kt.yesno(it.name + 'を' + (n > 1 ? n + '個' : '') + '捨てますか？'))) return;
        R.State.removeItem(e.id, n);
        R.sfx('confirm_soft');
        await Kt.msg(it.name + 'を捨てた。');
      }
      drawRow(row, x, y, w) {
        const e = row.e, it = e.item;
        Kt.drawIcon(it, x, y + 2);
        Kt.fitText(Kt.itemLabel(e.id), x + 11, y, w - 40, { color: Kt.itemColor(e.id) });
        if (it.type !== 'key') G().text(String(R.State.count(e.id)), x + w - 6, y, { align: 'right' });
      }
      render() {
        G().window(4, 4, 248, 24);
        TABS.forEach((t, i) => {
          const on = i === this.tab;
          G().text(t.label, TAB_X[i], 10, { color: on ? G().C.yellow : Kt.COL.gray });
          if (on) G().rect(TAB_X[i], 21, Math.ceil(G().textWidth(t.label)), 1, G().C.yellow);
        });
        if (TABS[this.tab].id === 'gear') {
          G().text('L◀', 188, 11, { align: 'right', color: Kt.COL.gray, size: 8 });
          Kt.fitText(FILTER_NAMES[this.filter], 210, 10, 40, { align: 'center', color: this.filter ? G().C.cyan : Kt.COL.sub });
          G().text('▶R', 232, 11, { color: Kt.COL.gray, size: 8 });
        }
        this.list.fitRows(8, 3).draw();
        const dy = this.list.y + this.list.h + 2 - 158; // the description window follows the list
        if (!this.entries.length) G().text(TABS[this.tab].id === 'gear' && this.filter ? 'この種類の装備品は持っていない。' : '何も持っていない。', 20, 38, { color: Kt.COL.gray });
        G().window(4, 158 + dy, 248, 60, this.cur ? { title: 'Y：詳細' } : undefined);
        const e = this.cur;
        if (!e) return;
        const it = e.item;
        const lines = String(it.desc || '').split('\n').slice(0, 2);
        lines.forEach((l, i) => Kt.fitText(l, 14, 167 + dy + i * 14, 226));
        if (TABS[this.tab].id === 'gear') {
          Kt.fitText(gearSummary(it), 14, 196 + dy, 150, { color: G().C.cyan });
          const party = R.Game.party;
          const n = party.length;
          party.forEach((c, i) => {
            const x = 234 - 18 * (n - 1 - i);
            const ok = Kt.slotsFor(e.id).some((s) => Kt.canEquip(c, e.id, s));
            Kt.drawSpriteAt(c, x, 190 + dy, { dark: !ok, darkAmt: 0.7, frame: ok ? Math.floor(R.Engine.frame / 20) : 0 });
          });
        } else if (it.type === 'consumable') {
          G().text(useWhere(it.use), 14, 198 + dy, { color: Kt.COL.gray });
          if (it.price) G().text('売値 ' + Math.floor(it.price / 2) + 'ゴールド', 242, 198 + dy, { align: 'right', color: Kt.COL.gray });
        } else if (it.use && it.use.field) G().text('Aで使う（使っても無くならない）', 14, 198 + dy, { color: Kt.COL.gray });
      }
    }

    // ============================================================ 技・術 (§11.7.3)
    class SpellScreen extends Kt.Screen {
      constructor(o) {
        super();
        const party = R.Game.party;
        this.m = o.member != null ? o.member : lastSpellMember < party.length ? lastSpellMember : 0;
        const knows = (c) => (c.spells || []).length || (c.techs || []).length;
        if (!knows(party[this.m])) { const k = party.findIndex(knows); if (k >= 0) this.m = k; }
        this.list = new R.UI.List({ x: 4, y: 46, w: 248, rows: 8, items: [], drawItem: (row, x, y, w) => this.drawRow(row, x, y, w) });
        this.note = '';
        this.refresh(false);
      }
      get c() { return R.Game.party[this.m]; }
      refresh(keep) {
        const c = this.c;
        // field spells are white, every other spell and every tech grey (techs are never used on the move, §11.7.3)
        const rows = Kt.spellList(c).map((id) => ({ id, spell: true, ok: !!DB.actions[id].field }));
        for (const id of Kt.allTechs(c)) rows.push({ id, spell: false, ok: false });
        this.rows = rows;
        this.list.setItems(rows, keep);
        this.note = '';
      }
      input() {
        const d = In().dirRepeat();
        const lr = Kt.memberStep() || (d === 'left' ? -1 : d === 'right' ? 1 : 0);
        if (lr) {
          this.m = Kt.cycle(this.m, lr, R.Game.party.length);
          lastSpellMember = this.m;
          R.sfx('cursor');
          this.refresh(false);
          return;
        }
        const row = this.list.item;
        if (In().pressed('y') && row) { this.flow(() => Menu.actionDetail(row.id, { member: this.c })); return; }
        if (In().pressed('a') && row) {
          const block = row.ok ? Menu.spellBlock(this.c, row.id) : '今は使えない。';
          if (block) { R.sfx('buzzer'); this.note = block; return; }
          R.sfx('confirm');
          this.flow(async () => {
            const res = await Menu.useSpell(this.c, row.id);
            if (res === 'exit') { this.close('exit'); return; }
            this.refresh(true);
          });
          return;
        }
        const prev = this.list.index;
        const r = this.list.update();
        if (r === 'cancel') this.close();
        if (this.list.index !== prev) this.note = '';
      }
      drawRow(row, x, y, w) {
        const a = DB.actions[row.id];
        const col = row.ok ? '#ffffff' : Kt.COL.gray;
        if (row.spell) Kt.drawElemIcons(a.elements || [], x, y + 2);
        else Kt.drawIcon({ type: 'weapon', wtype: a.wtype }, x, y + 2);
        const ix = row.spell ? Math.max(1, (a.elements || []).length) * 9 + 2 : 11;
        Kt.fitText(a.name, x + ix, y, w - ix - 40, { color: col });
        const cst = Kt.cost(this.c, row.id);
        const cc = row.spell && row.ok && Kt.costColor ? Kt.costColor(this.c, row.id) : null; // Part A13b: MP cut by proficiency
        G().text((row.spell ? 'M' : 'W') + cst, x + w - 6, y, { align: 'right', color: cc || col });
      }
      render() {
        const c = this.c, st = Kt.stats(c);
        G().window(4, 4, 248, 40);
        Kt.drawSpriteAt(c, 12, 12, { frame: Math.floor(R.Engine.frame / 20) });
        Kt.fitText(c.name, 34, 10, 60, { color: Kt.condColor(c) });
        G().text('M', 110, 10, { color: Kt.COL.sub });
        G().text(c.mp + '/' + (st.mp || 0), 166, 10, { align: 'right' });
        G().text('W', 176, 10, { color: Kt.COL.sub });
        G().text((c.wp || 0) + '/' + (st.wp || 0), 232, 10, { align: 'right' });
        G().text(c.hp <= 0 ? '戦闘不能' : '移動中に使える術だけ、白で出る。', 34, 24, { color: c.hp <= 0 ? G().C.dead : Kt.COL.gray, size: 8 });
        Kt.lrHint(244, 26);
        this.list.fitRows(8, 3).draw();
        const dy = this.list.y + this.list.h + 2 - 176; // the description window follows the list
        if (!this.rows.length) G().text('覚えている技・術がない。', 20, 54, { color: Kt.COL.gray });
        const row = this.list.item;
        G().window(4, 176 + dy, 248, 44, row ? { title: 'Y：詳細' } : undefined);
        if (!row) return;
        const a = DB.actions[row.id];
        if (this.note) { G().text(this.note, 14, 184 + dy, { color: G().C.yellow }); return; }
        Kt.fitText(String(a.desc || '').split('\n')[0], 14, 184 + dy, 226);
        const tag = row.spell ? (row.ok ? '移動中に使える' : '戦闘中だけ使える') : '技は戦闘中だけ使える';
        G().text(tag, 14, 200 + dy, { color: Kt.COL.gray, size: 8 });
      }
    }

    return { Detail, ItemScreen, SpellScreen };
  }

  /** one-line summary of an equipment item's main numbers (道具 gear tab, §11.7.2) */
  function gearSummary(it) {
    const parts = [];
    if (it.type === 'weapon') parts.push('攻撃力' + (it.atk || 0), '術力' + (it.mag || 0));
    else if (it.type !== 'acc') parts.push('守備力' + (it.def || 0), '術防' + (it.mdef || 0));
    const st = it.stats || {};
    for (const k of K().STATS6) if (st[k]) parts.push(K().STAT_NAMES[k] + sgn(st[k]));
    if (it.type === 'weapon' && it.element) parts.push(K().elemName(it.element));
    if (!parts.length) parts.push(it.mods ? '特殊効果あり（Yで詳細）' : '能力値の増減なし');
    return parts.join('　');
  }
  Menu.gearSummary = gearSummary;
})(window.RPG);
