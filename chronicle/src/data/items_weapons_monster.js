// src/data/items_weapons_monster.js（担当 weapons A9）
// §9.12 の武器（DESIGN §8.1.4）: 魔物の超レア 79（§9.12.4 のこの章の品）・魔物のレア 31（§9.12.5）・ティアが固定のレア魔物の超レア 2（§8.7.2）。
// §9.15 の 1 のとおり、表の行（id・名前・系統・T・効果の略記）をそのまま持ち、§8.6.2 の規則で品にする生成関数をこのファイルの中で 1 回回す:
// - units は系列の振り方。杖だけ、落とす魔物（レア品は最初の 1 種）の種族（§9.5.1）の主の能力値が精神なら m2（§8.6.2）。
// - 略記は §9.12.2（parse）。武器の項目（element onHit metalHit crit hit）は品に、ほかは mods に、stat:-1u は statsAdd に入る。
// - desc は §8.2.7 の文型（describe。2 行 × 全角 20 字に入る長い形、入らなければ短い形）。
// - 数値（atk mag stats price）は R.onData の R.WeaponItems.finish（→ fillItem）。値段は §8.3.8（レア ×3・超レア ×6）。
// 読み込み時はこのファイルの中のコードと表だけを使う（§1.2-2: ほかのファイルの関数・データを読まない。ロード順に依らない）。
// 名前の「サンゴ」は STYLE_JA §2（珊瑚 → サンゴ）に合わせた（DESIGN §9.12.4・§9.12.5 の表は「さんご」。報告に書いた）。
(function (R) {
  'use strict';
  const DB = R.DB;
  const WI = (R.WeaponItems = R.WeaponItems || {});
  const IDS = (WI.ids = WI.ids || {});
  IDS.msuper = []; IDS.mrare = []; IDS.fixed = [];

  // ---------------------------------------------------------------- 系列の振り方・並び（§8.1.2・§8.6.2）
  const WTYPES = ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'staff'];   // A19 の 7 系統（SYSTEMS_REWORK §3.1）
  const WTYPE_NAME = { sword: '剣', greatsword: '大剣', dagger: '短剣', axe: '斧', spear: '槍', bow: '弓', staff: '杖' };
  const UNITS = { sword: 's2', greatsword: 's2', axe: 's2', dagger: 'd2', bow: 'd2', spear: 's1d1', staff: 'i2' };
  const SERIES = { sword: 0, greatsword: 1, dagger: 2, axe: 3, spear: 5, bow: 6, staff: 7 };   // items_weapons.js の系列の順（メイス 4、精神の杖 8）
  // A19 で消えた 4 系統から移した品の上書き（SYSTEMS_REWORK §3.2。表の 8 列目の印）。units は旧の系統の振り方のまま。
  //   katana … 旧 刀 → 剣（刀の絵、会心 +8）        club / fclub … 旧 棍棒・体術 → 斧のメイス（打撃、命中 +10）
  //   claw … 旧 体術 → 短剣（爪、攻撃 ×0.85）         whip … 旧 鞭 → 弓・槍（攻撃 ×0.95）     whipd … 旧 鞭 → 短剣
  const CLUB = (it) => Object.assign(it, { kind: 'blunt', art: 'club', icon: 'icon:club', mult: 1.05, hit: (it.hit || 0) + 10 });
  const OV = {
    katana: { units: 's1d1', series: 0, set: (it) => Object.assign(it, { art: 'katana', icon: 'icon:katana', mult: 1.05, crit: (it.crit || 0) + 8 }) },
    club: { units: 's1v1', series: 4, set: CLUB },
    fclub: { units: 's1a1', series: 4, set: CLUB },
    claw: { units: 's1a1', set: (it) => Object.assign(it, { mult: 0.85 }) },
    whip: { units: 'd1a1', set: (it) => Object.assign(it, { mult: 0.95 }) },
    whipd: { units: 'd1a1', set: () => {} },
  };
  const U = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6];   // §4.3.1（stat:-1u の 1 単位 = round(U(T))）
  // 系統 → 種族（§9.5.1 の「種族」の最初の語）と、種族の主 / 副の能力値（§8.6.2 の表）。杖の units だけに使う
  const LINEAGE_RACE = {
    jelly: 'slime', rat: 'beast', bat: 'beast', paper: 'spirit', crab: 'aquatic', seabird: 'bird', bee: 'insect', mushroom: 'plant',
    plant: 'plant', fairy: 'fairy', treant: 'plant', scorpion: 'insect', snake: 'beast', mummy: 'undead', cactus: 'plant',
    sandworm: 'insect', wolf: 'beast', yeti: 'beast', frostling: 'fairy', owl: 'bird', mammoth: 'beast', ghost: 'spirit',
    wisp: 'spirit', frog: 'aquatic', doll: 'construct', lizardman: 'humanoid', spider: 'insect', merman: 'aquatic', kraken: 'aquatic',
    skeleton: 'undead', golem: 'construct', mole: 'beast', beetle: 'insect', crystal: 'construct', goblin: 'humanoid', salamander: 'beast',
    imp: 'demon', gargoyle: 'demon', orc: 'humanoid', chimera: 'beast', eyeball: 'demon', darkmage: 'humanoid', automaton: 'construct',
    armor: 'construct', wyvern: 'dragon', scribe: 'humanoid', book: 'construct', mimic: 'construct', void: 'spirit', chaos: 'beast',
    demon: 'demon', quicksilver: 'slime', mirror: 'insect', platinum: 'spirit',
  };
  const RACE_STATS = {
    beast: ['str', 'agi'], bird: ['agi', 'dex'], insect: ['dex', 'agi'], plant: ['mnd', 'vit'], aquatic: ['vit', 'mnd'],
    dragon: ['str', 'vit'], undead: ['int', 'mnd'], demon: ['int', 'str'], spirit: ['mnd', 'int'], construct: ['vit', 'str'],
    slime: ['vit', 'mnd'], humanoid: ['dex', 'str'], fairy: ['int', 'mnd'],
  };
  const raceOf = (monId) => LINEAGE_RACE[String(monId).replace(/_\d+$/, '')] || null;
  const unitsFor = (wtype, monId) => (wtype === 'staff' && (RACE_STATS[raceOf(monId)] || [])[0] === 'mnd' ? 'm2' : UNITS[wtype]);
  // 系列の振り方から外した品（A10a.5）: 能力値を下げるクセと同じ能力値に単位があると、詳細に「素早さ+」と「ただし素早さが下がる」が
  // 並ぶ。単位を系列のもう 1 つの能力値に寄せる（§8.3.4 の「2 単位を系列の 1 つの能力値に寄せてよい」。gear-a の品と同じ直し方）
  const UNITS_FIX = { w_axe_sr_crabclaw: 's2' };

  // ---------------------------------------------------------------- §9.12.2 の略記を {key:value} の組に直す
  /** 'el:water boost:water20 crit+8' → [{element:'water'}, {elemBoost:{water:20}}, {crit:8}]（1 語 = 1 つ、順番どおり） */
  function parse(str, T) {
    const out = [];
    for (const tok of String(str || '').trim().split(/\s+/).filter(Boolean)) {
      let m;
      if ((m = tok.match(/^el:(\w+)$/))) out.push({ element: m[1] });
      else if ((m = tok.match(/^onHit:([a-z]+)(\d+)$/))) out.push({ onHit: { status: m[1], chance: +m[2] / 100 } });
      else if (tok === 'metalHit') out.push({ metalHit: true });
      else if (tok === 'twoHanded') out.push({ twoHanded: true });
      else if (tok === 'regen' || tok === 'noFloorDamage') out.push({ [tok]: true });
      else if ((m = tok.match(/^boost:([a-z]+)(\d+)$/))) out.push({ elemBoost: { [m[1]]: +m[2] } });
      else if ((m = tok.match(/^res:([a-z]+)(-?[\d.]+)$/))) out.push({ elemResist: { [m[1]]: +m[2] } });
      else if ((m = tok.match(/^imm:([a-z]+)$/))) out.push({ statusImmune: [m[1]] });
      else if ((m = tok.match(/^sres:([a-z]+)(-?\d+)$/))) out.push({ statusResist: { [m[1]]: +m[2] / 100 } });
      else if ((m = tok.match(/^glim:([a-z]+)(\d+)$/))) out.push({ glimPct: { [m[1]]: +m[2] } });
      else if ((m = tok.match(/^prof:([a-z]+)(\d+)$/))) out.push({ profPct: { [m[1]]: +m[2] } });
      else if ((m = tok.match(/^buff:([a-z]+)\+(\d)$/))) out.push({ startBuffs: { [m[1]]: +m[2] } });
      else if ((m = tok.match(/^stat:([a-z]+)-(\d)u$/))) out.push({ statsAdd: { [m[1]]: -Math.max(1, Math.round(+m[2] * U[T])) } });
      else if ((m = tok.match(/^walkHeal:(\d+)$/))) out.push({ walkHeal: +m[1] });
      else if ((m = tok.match(/^([a-zA-Z]+)([+-]\d+)$/))) out.push({ [m[1]]: +m[2] });
      else throw new Error('weapons: 読めない略記 ' + tok);
    }
    return out;
  }

  // ---------------------------------------------------------------- 武器の項目と mods の分け方（§3.3.16・§8.5）
  const FIELDS = ['element', 'onHit', 'vs', 'drain', 'crit', 'hit', 'twoHanded', 'sealTech', 'metalHit'];
  const MAP_KEYS = ['elemResist', 'elemBoost', 'statusResist', 'glimPct', 'profPct', 'startBuffs'];
  /** 効果 1 つ（{key:value}）を品に置く。武器の項目は品へ、statsAdd は品へ、ほかは mods へ（マップは合わせる） */
  function apply(it, fx) {
    for (const [k, v] of Object.entries(fx || {})) {
      if (FIELDS.includes(k)) { it[k] = v; continue; }
      if (k === 'statsAdd') { it.statsAdd = Object.assign(it.statsAdd || {}, v); continue; }
      const mods = (it.mods = it.mods || {});
      if (MAP_KEYS.includes(k)) mods[k] = Object.assign(mods[k] || {}, v);
      else if (k === 'statusImmune') mods[k] = [...new Set([...(mods[k] || []), ...v])];
      else mods[k] = v;
    }
    return it;
  }
  /** §8.5 の書き方の {key:value}（武器の項目と mods が混ざった組）を 1 キー 1 組の配列にする */
  const split = (obj) => Object.entries(obj || {}).map(([k, v]) => ({ [k]: v }));

  // ---------------------------------------------------------------- §8.2.7 の文型（desc。STYLE_JA §4）
  const EL_NAME = { fire: '火', water: '水', wind: '風', earth: '土', light: '光', dark: '闇' };
  const ST = {
    poison: ['毒', '毒にする'], burn: ['やけど', 'やけどを負わせる'], sleep: ['眠り', '眠らせる'], paralyze: ['まひ', 'まひさせる'],
    freeze: ['凍結', '凍らせる'], stun: ['気絶', '気絶させる'], confuse: ['混乱', '混乱させる'], silence: ['沈黙', '術を封じる'],
    blind: ['暗闇', '目をくらませる'], death: ['即死', '一撃で倒す'],
  };
  const STAT_NAME = { str: '腕力', vit: '体力', dex: '器用さ', agi: '素早さ', int: '知力', mnd: '精神' };
  const VS_NAME = {
    plant: '植物', beast: '獣', flying: '飛ぶ敵', undead: '不死の魔物', dragon: '竜', construct: 'からくり', demon: '魔族',
    insect: '虫', bird: '鳥', aquatic: '水の魔物', spirit: '霊', slime: 'ゼリー', humanoid: '人型の敵', fairy: '妖精', metal: '鋼の魔物',
  };
  const BUFF_NAME = { atk: '攻撃', def: '守り', mag: '術力', mdef: '術防', agi: '素早さ' };
  const list = (keys, names) => keys.map((k) => names[k] || k).join('・');
  /** 効果 1 つ（{key:value}）→ [長い形, 短い形]（「ただし」は describe が付ける） */
  function phrase(fx) {
    const [k, v] = Object.entries(fx)[0];
    const P = (a, b) => [a, b || a];
    switch (k) {
      case 'element': return P(`${EL_NAME[v]}の属性で攻撃する。`, `${EL_NAME[v]}の属性。`);
      case 'onHit': return P(`${ST[v.status][1]}ことがある。`, `${ST[v.status][1]}。`);
      case 'vs': return P(`${list(Object.keys(v), VS_NAME)}に大きなダメージ。`);
      case 'drain': return P('与えた傷の一部を吸い取る。', '傷を吸う。');
      case 'metalHit': return P('鋼の魔物にも傷を与える。');
      case 'twoHanded': return P('両手持ちで盾は不可。', '両手持ち。');
      case 'sealTech': return P('技が使えない。');
      case 'noSpell': return P('術が使えない。');
      case 'crit': return v >= 0 ? P('会心が出やすい。') : P('会心が出にくい。');
      case 'hit': return v >= 0 ? P('よく当たる。') : P('当たりにくい。');
      case 'eva': return v >= 0 ? P('攻撃をかわしやすい。', 'かわしやすい。') : P('かわしにくい。');
      case 'spd': return v >= 0 ? P('すばやく動ける。', 'すばやい。') : P('動きが遅くなる。', '遅くなる。');
      case 'atk': return v >= 0 ? P('攻撃力が上がる。') : P('攻撃力が下がる。');
      case 'def': return v >= 0 ? P('守備力が上がる。') : P('守備力が下がる。', '守備が下がる。');
      case 'mdef': return v >= 0 ? P('術防が上がる。') : P('術防が下がる。');
      case 'mag': return P('術力が上がる。');
      case 'defPct': return v >= 0 ? P('守備力が上がる。') : P('守備力が下がる。', '守備が下がる。');
      case 'mdefPct': return v >= 0 ? P('術防が上がる。') : P('術防が下がる。');
      case 'hpPct': case 'mpPct': {
        const n = { hpPct: 'HP', mpPct: 'MP' }[k];
        return v >= 0 ? P(`最大${n}が上がる。`) : P(`最大${n}が下がる。`);
      }
      case 'regen': return P('戦闘中、HPが少しずつ戻る。', 'HPが戻る。');
      case 'mpRegen': return P('戦闘中、MPが少しずつ戻る。', 'MPが戻る。');
      case 'startBuffs': {
        const n = Object.keys(v).map((s) => BUFF_NAME[s] || STAT_NAME[s] || s).join('と');
        return P(`戦闘の始めに${n}が上がる。`, `始めに${n}が上がる。`);
      }
      case 'physPct': return v >= 0 ? P('物理攻撃の威力が上がる。', '物理が強くなる。') : P('物理攻撃の威力が下がる。', '物理が弱くなる。');
      case 'magicPct': return v >= 0 ? P('術の威力が上がる。', '術が強くなる。') : P('術の威力が下がる。', '術が弱くなる。');
      case 'healPct': return P('回復の術がよく効く。');
      case 'itemPct': return P('回復の道具がよく効く。');
      // 技も術も MP を使う（A18）ので、短い形にも「術の」「技の」を残す
      case 'mpCostPct': return v < 0 ? P('術のMPの消費が減る。', '術の消費MPが減る。') : P('術のMPの消費が増える。', '術の消費MPが増える。');
      case 'techCostPct': return v < 0 ? P('技のMPの消費が減る。', '技の消費MPが減る。') : P('技のMPの消費が増える。', '技の消費MPが増える。');
      case 'takenPct': return P('受けるダメージが増える。', '受ける傷が増える。');
      case 'hpLoss': return P('戦闘中にHPが減る。', 'HPが減っていく。');
      case 'elemBoost': return P(`${list(Object.keys(v), EL_NAME)}の攻撃が強くなる。`, `${list(Object.keys(v), EL_NAME)}が強くなる。`);
      case 'elemResist': {
        const ks = Object.keys(v), x = v[ks[0]], n = list(ks, EL_NAME);
        if (x > 1) return P(`${n}に弱くなる。`, `${n}に弱い。`);
        if (x < 0) return P(`${n}の攻撃を吸い取る。`, `${n}を吸う。`);
        if (x === 0) return P(`${n}の攻撃を受けない。`, `${n}が効かない。`);
        return P(`${n}のダメージを減らす。`, `${n}に強い。`);
      }
      case 'statusImmune': return P(`${v.map((s) => ST[s][0]).join('・')}が効かない。`);
      case 'statusResist': {
        const ks = Object.keys(v), n = ks.map((s) => ST[s][0]).join('・');
        return v[ks[0]] < 0 ? P(`${n}に弱い。`) : P(`${n}にかかりにくい。`);
      }
      case 'glimPct': {
        const ks = Object.keys(v);
        if (v[ks[0]] < 0) return P('閃きにくい。');
        const t = ks.includes('tech'), s = ks.includes('spell');
        const what = t && s ? '技と術' : t ? '技' : s ? '術' : WTYPES.includes(ks[0]) ? `${WTYPE_NAME[ks[0]]}の技` : `${EL_NAME[ks[0]] || ks[0]}の術`;
        return P(`${what}を閃きやすい。`, '閃きやすい。');
      }
      case 'profPct': return P(`${Object.keys(v).map((x) => WTYPE_NAME[x] || EL_NAME[x] || x).join('・')}の熟練度が伸びやすい。`);
      case 'dropPct': return P('魔物がアイテムを落としやすい。', 'アイテムをよく落とす。');   // A1.3（rules の autoDesc と同じ文）
      case 'rarePct': return P('レアアイテムを落としやすい。', 'レアをよく落とす。');
      case 'superPct': return P('超レアアイテムを落としやすい。', '超レアをよく落とす。');
      case 'goldPct': return v >= 0 ? P('手に入るお金が増える。', 'お金が増える。') : P('得るお金が減る。', 'お金が減る。');
      case 'expPct': return v >= 0 ? P('経験値が増える。') : v <= -100 ? P('経験値が入らない。') : P('経験値が減る。');
      case 'goldenPct': return P('金色の魔物に出会いやすい。', '金色に出会いやすい。');
      case 'rareEncPct': return P('めずらしい魔物に出会いやすい。', 'めずらしい魔物を呼ぶ。');
      case 'encounterPct': return v < 0 ? P('魔物に出会いにくい。', '魔物に会いにくい。') : P('魔物を呼ぶ。');   // 武器の + はいつもクセ（§8.2.7「ただし魔物を呼ぶ。」）
      case 'stealPct': return P('盗みが成功しやすい。');
      case 'escapePct': return P('逃げやすくなる。');
      case 'preemptPct': return P('先制しやすくなる。');
      case 'autoSteal': return P('攻撃が当たると、ついでに盗むことがある。', 'ついでに盗む。');
      case 'autoRevive': return P('倒れても一度だけ起き上がる。');
      case 'autoCounter': return P('攻撃を受けると反撃する。', '反撃する。');
      case 'noFloorDamage': return P('毒の沼や熱い床で傷つかない。');
      case 'walkHeal': return P('歩くとHPが少しずつ戻る。', '歩くとHPが戻る。');
      case 'statsAdd': return P(`${Object.keys(v).map((x) => STAT_NAME[x]).join('と')}が下がる。`);
      default:
        if (/^(str|vit|dex|agi|int|mnd)Pct$/.test(k)) return P(`${STAT_NAME[k.slice(0, 3)]}が割合で上がる。`, `${STAT_NAME[k.slice(0, 3)]}が上がる。`);
        throw new Error('weapons: 文型の無いキー ' + k);
    }
  }

  /** 表示の幅（全角 1、半角 0.5。STYLE_JA §1） */
  const width = (s) => { let w = 0; for (const ch of String(s)) w += ch.codePointAt(0) < 0x100 ? 0.5 : 1; return w; };
  const LINE_W = 20;
  function pack(sentences) {
    const lines = [''];
    for (const s of sentences) {
      const cur = lines[lines.length - 1];
      if (cur && width(cur + s) > LINE_W) lines.push(s); else lines[lines.length - 1] = cur + s;
    }
    return lines;
  }
  function permutations(a) {
    if (a.length <= 1) return [a.slice()];
    const out = [];
    a.forEach((x, i) => { for (const p of permutations(a.slice(0, i).concat(a.slice(i + 1)))) out.push([x].concat(p)); });
    return out;
  }
  const descProblems = [];
  /**
   * 効果の組の列と、クセの組の列から desc（2 行 × 全角 20 字）を作る（§8.2.7: 特殊効果の文 → クセの文「ただし〜」）。
   * 探す順: 短い形の重みが小さい方 → 効果の文の並べ方（表の順が先）→ 後ろの文から短い形に。クセの文はいつも最後。
   */
  function describe(effects, quirks) {
    // 短い形にするときの重み: 追加効果の短い形（「眠らせる。」）は「ことがある」が落ちて意味が変わるので、なるべく使わない（3）。
    // クセの文は品の引き換えなので、長い形（「ただし火に弱くなる。」）を効果の文より先に残す（2。§8.6.5・§8.7.2 の表の文と同じ）
    const cost = (fx) => (Object.keys(fx)[0] === 'onHit' ? 3 : 1);
    const eff = (effects || []).map((fx) => ({ p: phrase(fx), c: cost(fx) }));
    const qs = (quirks || []).map((q, i) => { const [a, b] = phrase(q); return { p: i === 0 ? ['ただし' + a, 'ただし' + b] : [a, b], c: 2 }; });
    const n = eff.length + qs.length, cands = [];
    permutations(eff.map((_, i) => i)).forEach((ord, oi) => {
      const sents = ord.map((i) => eff[i]).concat(qs);
      for (let m = 0; m < 1 << n; m++) {
        let c = 0, weight = 0, same = false;
        for (let i = 0; i < n; i++) if (m & (1 << i)) { if (sents[i].p[0] === sents[i].p[1]) same = true; c += sents[i].c; weight += n - i; }
        if (!same) cands.push({ text: sents.map((s, i) => s.p[(m >> i) & 1]), c, oi, weight });
      }
    });
    cands.sort((a, b) => a.c - b.c || a.oi - b.oi || a.weight - b.weight);
    for (const { text } of cands) {
      const lines = pack(text);
      if (lines.length <= 2 && lines.every((l) => width(l) <= LINE_W)) return lines.join('\n');
    }
    // 入らない組み合わせ（表の効果が多すぎる）。ゲームは止めず、tools/test_weapons.js が幅の検査で落とす。
    const text = pack(eff.concat(qs).map((s) => s.p[1]));
    descProblems.push(text.join('／'));
    return text.join('\n');
  }

  // ---------------------------------------------------------------- 品を作る（このファイルの品だけ）
  /** 1 本の武器を DB.items に置く。fx・q は {key:value} の組の配列（効果・クセ）。desc が無ければ describe で作る。 */
  function make(id, o) {
    const ov = o.ov ? OV[o.ov] : null;
    const it = { name: o.name, type: 'weapon', grade: o.grade, tier: o.tier, wtype: o.wtype, units: o.units };
    for (const fx of o.fx || []) apply(it, fx);
    for (const q of o.q || []) apply(it, q);
    if (o.q && o.q.length) it.quirk = true;
    if (ov) ov.set(it);   // 品の上書き（mult kind art icon hit crit）。desc は表の効果とクセだけから作る
    it.src = o.src;
    if (o.exclusive) it.exclusive = o.exclusive;
    it.desc = o.desc ? o.desc.replace(/／/g, '\n') : describe(o.fx, o.q);
    it.sort = o.tier * 100 + (it.units === 'm2' ? 8 : ov && ov.series !== undefined ? ov.series : SERIES[o.wtype]) + (o.grade === 'super' ? 70 : 50);   // §8.2.1
    if (DB.items[id]) R.loadErrors.push('weapons: 品の id が重なった ' + id);
    DB.items[id] = it;
    return it;
  }

  // ---------------------------------------------------------------- 超レア 79（§9.12.4。[落とす魔物, id, 名前, 系統, T(srTier), 特殊効果, クセ]）
  // 超レア枠の分母は魔物のデータ（雑魚 1/256、鋼 1/128）。1 品 = ただ 1 種の魔物（exclusive）。
  const SUPER = [
    ['jelly_2', 'w_staff_sr_bubble', 'あぶくの杖', 'staff', 3, 'el:water boost:water20', 'res:earth1.5'],
    ['jelly_3', 'w_spear_sr_venomjelly', '毒ゼリーの槍', 'spear', 5, 'onHit:poison40', 'res:fire1.5', 'whip'],
    ['jelly_4', 'w_sword_sr_jellygeneral', 'ゼリー将軍の剣', 'sword', 7, 'buff:atk+1 sres:stun50', 'stat:agi-1u'],
    ['rat_1', 'w_dagger_sr_rattooth', 'ネズミの前歯', 'dagger', 1, 'crit+10 stealPct+25', 'stat:vit-1u'],
    ['bat_2', 'w_sword_sr_crimson', '紅吸いの刀', 'sword', 3, 'crit+10 hpPct+5', 'res:light1.5', 'katana'],
    ['bat_4', 'w_bow_sr_nightwing', '夜翼の弓', 'bow', 7, 'el:dark onHit:blind25', 'res:light1.5'],
    ['paper_2', 'w_spear_sr_whiteline', '白線の槍', 'spear', 5, 'el:light crit+8', 'res:dark1.5'],
    ['paper_4', 'w_greatsword_sr_eraser', '白紙の大剣', 'greatsword', 8, 'onHit:silence30 physPct+10', 'hpPct-10'],
    ['crab_1', 'w_axe_sr_crabclaw', 'カニばさみの槌', 'axe', 1, 'crit+8 def+4', 'stat:agi-1u', 'fclub'],
    ['crab_3', 'w_bow_sr_foamshot', '泡しぶきの弓', 'bow', 5, 'el:water onHit:blind25', 'res:earth1.5'],
    ['seabird_2', 'w_spear_sr_stormbeak', '嵐のくちばし槍', 'spear', 3, 'el:wind boost:wind15', 'res:fire1.5'],
    ['bee_1', 'w_dagger_sr_stinger', '花バチの針', 'dagger', 1, 'crit+12 hit+5', 'res:fire1.5'],
    ['bee_2', 'w_spear_sr_venomneedle', '蜂針の槍', 'spear', 3, 'onHit:poison40', 'stat:vit-1u'],
    ['bee_4', 'w_bow_sr_thousand', '千本針の弓', 'bow', 7, 'crit+8 hit+10', 'stat:vit-1u'],
    ['mushroom_2', 'w_axe_sr_toadstool', 'まだらの棍棒', 'axe', 3, 'onHit:poison35', 'res:fire1.5', 'club'],
    ['mushroom_4', 'w_staff_sr_elder_cap', '長老ダケの杖', 'staff', 8, 'healPct+20 sres:poison50', 'stat:agi-1u'],
    ['plant_1', 'w_bow_sr_vine', '花づるの弓', 'bow', 1, 'onHit:paralyze15 hit+5', 'res:fire1.5', 'whip'],
    ['plant_4', 'w_staff_sr_moonbloom', '月待ち花の杖', 'staff', 7, 'el:dark boost:dark20', 'res:light1.5'],
    ['fairy_2', 'w_staff_sr_petal', '花びらの杖', 'staff', 3, 'el:light healPct+15', 'res:dark1.5'],
    ['treant_1', 'w_axe_sr_wander', 'さまよい木の枝', 'axe', 1, 'hpPct+10 sres:stun40', 'res:fire1.5', 'club'],
    ['treant_4', 'w_staff_sr_elder_root', '古老の根杖', 'staff', 8, 'boost:earth25 mdef+8', 'stat:agi-1u'],
    ['scorpion_1', 'w_dagger_sr_redtail', '赤い尾の短剣', 'dagger', 1, 'onHit:poison35 crit+5', 'res:wind1.5'],
    ['scorpion_2', 'w_dagger_sr_scorptail', '毒尾の爪', 'dagger', 3, 'onHit:poison35 crit+6', 'res:wind1.5', 'claw'],
    ['scorpion_4', 'w_dagger_sr_reaper', '死神の尾針', 'dagger', 7, 'onHit:death5 crit+6', 'hpPct-15', 'whipd'],
    ['snake_4', 'w_bow_sr_python', '大蛇王の弓', 'bow', 8, 'onHit:paralyze20 physPct+8', 'res:wind1.5', 'whip'],
    ['mummy_3', 'w_staff_sr_ankh', '冥府の杖', 'staff', 5, 'boost:dark20 mpCostPct-15', 'res:light1.5'],
    ['mummy_4', 'w_sword_sr_tombgeneral', '王墓の将軍剣', 'sword', 7, 'crit+6 imm:death', 'res:light1.5'],
    ['cactus_2', 'w_bow_sr_needlecactus', '針サボテンの弓', 'bow', 3, 'crit+10 hit+5', 'stat:mnd-1u'],
    ['cactus_4', 'w_axe_sr_cactusking', '大将の針棍棒', 'axe', 8, 'crit+8 onHit:stun15', 'res:wind1.5', 'club'],
    ['sandworm_2', 'w_greatsword_sr_rockworm', '岩ミミズの骨剣', 'greatsword', 5, 'onHit:stun20', 'stat:agi-1u'],
    ['sandworm_3', 'w_greatsword_sr_duneworm', '大地ミミズの牙剣', 'greatsword', 8, 'boost:earth20 physPct+8', 'res:wind1.5'],
    ['wolf_1', 'w_dagger_sr_greywolf', '灰色オオカミの爪', 'dagger', 1, 'preemptPct+8 crit+5', 'res:fire1.5', 'claw'],
    ['wolf_2', 'w_dagger_sr_frostfang', '霜牙の短剣', 'dagger', 3, 'el:water onHit:freeze15', 'res:earth1.5'],
    ['yeti_1', 'w_axe_sr_yeti', '雪男の大槌', 'axe', 2, 'physPct+8 res:water0.5', 'res:fire1.5', 'fclub'],
    ['yeti_2', 'w_axe_sr_icefist', '氷拳の斧', 'axe', 5, 'el:water onHit:freeze15', 'res:fire1.5'],
    ['frostling_1', 'w_dagger_sr_icicle', 'こおり小僧の爪', 'dagger', 1, 'el:water boost:water15', 'res:fire1.5', 'claw'],
    ['frostling_4', 'w_sword_sr_snowgeneral', '雪大将の刀', 'sword', 7, 'el:water onHit:freeze15', 'res:fire1.5', 'katana'],
    ['mammoth_2', 'w_spear_sr_irontusk', '鉄牙の大槍', 'spear', 5, 'physPct+10 onHit:stun15', 'stat:agi-1u'],
    ['ghost_3', 'w_spear_sr_chaincurse', '呪い鎖の鎌槍', 'spear', 5, 'el:dark onHit:silence25', 'res:light1.5', 'whip'],
    ['wisp_2', 'w_staff_sr_goblinfire', '化け火の杖', 'staff', 3, 'el:fire onHit:confuse15', 'res:water1.5'],
    ['wisp_4', 'w_bow_sr_yomi', '黄泉火の弓', 'bow', 8, 'el:dark onHit:burn20', 'res:light1.5'],
    ['frog_3', 'w_axe_sr_bullfrog', '大口ガエルの棍', 'axe', 5, 'hpPct+10 onHit:stun15', 'stat:agi-1u', 'club'],
    ['doll_3', 'w_dagger_sr_hexpin', '呪いのまち針', 'dagger', 5, 'onHit:silence20 boost:dark15', 'res:light1.5'],
    ['lizardman_2', 'w_spear_sr_marsh', '沼のもり槍', 'spear', 3, 'el:water hit+8', 'res:earth1.5'],
    ['lizardman_3', 'w_staff_sr_swampcharm', '沼の呪術杖', 'staff', 5, 'boost:water20 healPct+10', 'res:earth1.5'],
    ['lizardman_4', 'w_axe_sr_chieftain', '族長の大斧', 'axe', 8, 'physPct+10 crit+6', 'res:earth1.5'],
    ['spider_2', 'w_bow_sr_spidersilk', '毒糸の弓', 'bow', 3, 'onHit:poison35 hit+8', 'res:fire1.5', 'whip'],
    ['merman_2', 'w_spear_sr_harpoon', '魚人の大もり', 'spear', 3, 'el:water crit+8', 'res:earth1.5'],
    ['merman_3', 'w_staff_sr_coralwand', 'サンゴの杖', 'staff', 5, 'boost:water20 mpRegen+1', 'res:earth1.5'],
    ['merman_4', 'w_sword_sr_merknight', '魚人騎士の剣', 'sword', 8, 'el:water def+6', 'res:earth1.5'],
    ['kraken_2', 'w_spear_sr_eightarm', '八本腕のもり', 'spear', 5, 'onHit:paralyze20 hit+8', 'res:earth1.5', 'whip'],
    ['skeleton_1', 'w_sword_sr_cutlass', '骸骨水夫のカトラス', 'sword', 1, 'crit+6 hit+5', 'res:light1.5'],
    ['skeleton_5', 'w_sword_sr_admiral', '提督の金剣', 'sword', 8, 'crit+10 buff:atk+1', 'res:light2'],
    ['golem_2', 'w_axe_sr_ironore', '鉄鉱の大槌', 'axe', 5, 'onHit:stun20 physPct+8', 'stat:agi-1u', 'club'],
    ['mole_2', 'w_dagger_sr_ironclaw', '鉄のかぎ爪', 'dagger', 3, 'crit+8 hit+5', 'res:wind1.5', 'claw'],
    ['mole_4', 'w_axe_sr_mole_boss', '大親方のつるはし', 'axe', 8, 'crit+8 onHit:stun15', 'res:wind1.5'],
    ['beetle_3', 'w_spear_sr_sparkhorn', '火花角の槍', 'spear', 5, 'el:fire onHit:burn20', 'res:water1.5'],
    ['crystal_2', 'w_staff_sr_ruby', '紅水晶の杖', 'staff', 3, 'el:fire boost:fire20', 'res:water1.5'],
    ['goblin_1', 'w_axe_sr_goblinclub', '小鬼の棍棒', 'axe', 1, 'crit+6 goldPct+20', 'stat:int-1u', 'club'],
    ['goblin_2', 'w_axe_sr_goblin', '小鬼の手斧', 'axe', 3, 'crit+8 physPct+5', 'stat:mnd-1u'],
    ['goblin_4', 'w_sword_sr_goblincaptain', '小鬼の隊長の剣', 'sword', 7, 'buff:atk+1 sres:confuse50', 'stat:int-1u'],
    ['salamander_2', 'w_bow_sr_firebreath', '火吹きの弓', 'bow', 3, 'el:fire boost:fire15', 'res:water1.5'],
    ['salamander_4', 'w_spear_sr_flamehorn', '炎角の槍', 'spear', 7, 'el:fire crit+10', 'res:water1.5'],
    ['imp_1', 'w_spear_sr_soot_fork', 'すす悪魔の三つまた', 'spear', 1, 'crit+6 onHit:blind15', 'res:light1.5'],
    ['imp_4', 'w_staff_sr_hellfire', '業火の杖', 'staff', 7, 'el:fire boost:fire25', 'res:water1.5 mpCostPct+15'],
    ['gargoyle_2', 'w_dagger_sr_obsidian', '黒曜の短剣', 'dagger', 3, 'crit+12', 'stat:vit-1u'],
    ['gargoyle_4', 'w_axe_sr_gargoyle', '石像鬼の大斧', 'axe', 8, 'onHit:paralyze15 physPct+8', 'stat:agi-1u'],
    ['chimera_2', 'w_dagger_sr_triplefang', '三つ牙の爪', 'dagger', 5, 'el:fire crit+8', 'res:water1.5', 'claw'],
    ['eyeball_4', 'w_bow_sr_stargazer', '星見の弓', 'bow', 7, 'el:light hit+10', 'res:dark1.5'],
    ['darkmage_4', 'w_staff_sr_abyss', '深淵の杖', 'staff', 8, 'boost:dark25 mag+8', 'res:light1.5 hpPct-10'],
    ['automaton_2', 'w_bow_sr_clockwork', 'からくり弓', 'bow', 3, 'hit+15 crit+6', 'stat:agi-1u'],
    ['automaton_4', 'w_sword_sr_clockwork', 'からくり大将の刀', 'sword', 8, 'crit+10 buff:agi+1', 'res:water1.5', 'katana'],
    ['armor_3', 'w_sword_sr_knightless', '主なき騎士剣', 'sword', 5, 'crit+8 def+6', 'res:water1.5'],
    ['wyvern_2', 'w_spear_sr_windcutter', '風切りの竜槍', 'spear', 5, 'el:wind crit+10', 'res:fire1.5'],
    ['void_1', 'w_sword_sr_void', '虚無の剣', 'sword', 9, 'el:dark crit+12 physPct+10', 'res:light2'],
    ['chaos_1', 'w_axe_sr_chaos', '混沌の大斧', 'axe', 9, 'crit+12 physPct+12', 'stat:dex-2u'],
    ['quicksilver_2', 'w_spear_sr_quicksilver', '白銀の流れ槍', 'spear', 8, 'hit+15 crit+10 metalHit', 'stat:str-1u', 'whip'],
    ['mirror_2', 'w_spear_sr_mirrorhorn', '鏡角の槍', 'spear', 8, 'crit+15 metalHit', 'res:dark1.5'],
    ['platinum_2', 'w_sword_sr_platinum', '白金の太刀', 'sword', 9, 'crit+15 metalHit hit+10', 'res:dark1.5', 'katana'],
  ];

  // ---------------------------------------------------------------- 魔物のレア品 31（§9.12.5。[id, 名前, 系統, T(band), 特殊効果, クセ, 落とす魔物]）
// クセは §8.3.6 の弱い方をちょうど 1 つ（D3。品の趣に合わせて選んだ。desc の「ただし〜」は describe が付ける）。
  // 魔物のレア枠（1/32。鋼・宝箱もどき 1/16）だけで手に入る。1 品を 3 種類の魔物まで（どれも同じ帯）。
  const RARE = [
    ['w_bow_leaf', '木の葉の弓', 'bow', 1, 'hit+8', 'res:fire1.25', ['bee_1', 'plant_1', 'fairy_1']],
    ['w_dagger_scorpion', 'サソリの小刀', 'dagger', 1, 'onHit:poison25', 'hpPct-10', ['scorpion_1', 'snake_1', 'sandworm_1']],
    ['w_spear_coral', 'サンゴの槍', 'spear', 1, 'el:water', 'res:earth1.25', ['merman_1', 'kraken_1', 'skeleton_1']],
    ['w_axe_ashen', '灰の棍棒', 'axe', 1, 'onHit:stun15', 'spd-15', ['orc_1', 'chimera_1'], 'club'],
    ['w_dagger_bloodbat', '血吸いの短剣', 'dagger', 3, 'crit+8', 'res:light1.25', ['bat_2']],
    ['w_bow_gull', 'カモメの弓', 'bow', 3, 'el:wind', 'defPct-25', ['seabird_2']],
    ['w_staff_sprout', '芽吹きの杖', 'staff', 3, 'healPct+10', 'res:fire1.25', ['bee_2', 'mushroom_2', 'plant_2']],
    ['w_bow_snakeskin', '大蛇の弓', 'bow', 3, 'onHit:poison25', 'mdefPct-25', ['scorpion_2', 'snake_2'], 'whip'],
    ['w_dagger_frost', '霜の短剣', 'dagger', 3, 'el:water', 'res:fire1.25', ['wolf_2', 'frostling_2', 'owl_2']],
    ['w_spear_mist', '霧の槍', 'spear', 3, 'onHit:blind20', 'res:wind1.25', ['ghost_2', 'wisp_2', 'doll_2'], 'whip'],
    ['w_spear_reed', 'アシの槍', 'spear', 3, 'hit+8', 'defPct-25', ['frog_2', 'lizardman_2', 'spider_2']],
    ['w_axe_pick', '鉱夫のつるはし', 'axe', 3, 'crit+6', 'spd-15', ['mole_2', 'beetle_2', 'goblin_2']],
    ['w_axe_ember', '残り火の斧', 'axe', 3, 'el:fire', 'res:water1.25', ['salamander_2', 'imp_2', 'gargoyle_2']],
    ['w_bow_star', '星明かりの弓', 'bow', 3, 'hit+10', 'res:dark1.25', ['eyeball_2', 'darkmage_2', 'automaton_2']],
    ['w_axe_rat', '鉄歯の棍棒', 'axe', 5, 'crit+6', 'mdefPct-25', ['rat_3'], 'club'],
    ['w_staff_tombpriest', '墓守の杖', 'staff', 5, 'boost:dark15', 'res:light1.25', ['mummy_3']],
    ['w_dagger_wormtooth', '大ミミズの牙爪', 'dagger', 5, 'crit+6', 'eva-10', ['sandworm_2', 'kraken_2', 'golem_2'], 'claw'],
    ['w_greatsword_beastfang', '大獣の牙剣', 'greatsword', 5, 'physPct+8', 'mdefPct-25', ['yeti_2', 'mammoth_2', 'orc_2']],
    ['w_greatsword_blank', '白紙の刃', 'greatsword', 7, 'onHit:silence20', 'mpCostPct+25', ['paper_4']],
    ['w_spear_hornet', '大バチの槍', 'spear', 7, 'onHit:poison30', 'hpPct-10', ['bee_4', 'plant_4', 'treant_4']],
    ['w_sword_sand', '砂けむりの刀', 'sword', 7, 'el:earth', 'res:wind1.25', ['scorpion_4', 'snake_4', 'cactus_4'], 'katana'],
    ['w_axe_dune', '大地の斧', 'axe', 7, 'el:earth', 'spd-15', ['sandworm_3']],
    ['w_sword_moon', '月の刀', 'sword', 7, 'el:dark', 'res:light1.25', ['wolf_4', 'frostling_4', 'owl_4'], 'katana'],
    ['w_dagger_wolfking', 'オオカミ王の牙爪', 'dagger', 7, 'crit+10', 'defPct-25', ['wolf_5', 'frostling_5'], 'claw'],
    ['w_sword_bellringer', '鐘つきの剣', 'sword', 7, 'onHit:stun15', 'encounterPct+50', ['ghost_4', 'wisp_4', 'frog_4']],
    ['w_sword_tide', '潮の刀', 'sword', 7, 'el:water', 'res:earth1.25', ['merman_4', 'kraken_3', 'skeleton_4'], 'katana'],
    ['w_axe_forgehammer', '鍛冶場の大槌', 'axe', 7, 'physPct+8', 'spd-15', ['mole_4', 'beetle_4', 'goblin_4'], 'club'],
    ['w_sword_ash', '灰かぶりの刀', 'sword', 7, 'el:fire', 'res:water1.25', ['salamander_4', 'imp_4', 'gargoyle_4'], 'katana'],
    ['w_axe_brimstone', '硫黄の槌', 'axe', 7, 'el:fire', 'hpPct-10', ['orc_3', 'chimera_3'], 'fclub'],
    ['w_sword_starblade', '星の剣', 'sword', 7, 'el:light', 'res:dark1.25', ['eyeball_4', 'darkmage_4', 'automaton_4']],
    ['w_greatsword_chaoshorn', '混沌の角剣', 'greatsword', 9, 'physPct+10', 'takenPct+15', ['chaos_1', 'chaos_2', 'demon_3']],
  ];

  for (const [mon, id, name, wtype, tier, fx, q, ov] of SUPER) {
    make(id, { name, wtype, tier, grade: 'super', src: 'super', exclusive: mon, ov, units: UNITS_FIX[id] || (ov ? OV[ov].units : unitsFor(wtype, mon)), fx: parse(fx, tier), q: parse(q, tier) });
    IDS.msuper.push(id);
  }
  for (const [id, name, wtype, tier, fx, q, mons, ov] of RARE) {
    make(id, { name, wtype, tier, grade: 'rare', src: 'mdrop', ov, units: ov ? OV[ov].units : unitsFor(wtype, mons[0]), fx: parse(fx, tier), q: parse(q, tier) });
    IDS.mrare.push(id);
  }

  // ---------------------------------------------------------------- ティアが固定のゾーンのレア魔物の超レア 2（§8.7.2。表の文と数値のまま）
  make('w_staff_sr_goldquill', {
    name: '黄金の羽ペン杖', wtype: 'staff', tier: 8, grade: 'super', src: 'super', exclusive: 'rm_golden_quill', units: 'i2',
    fx: split({ mag: 15, glimPct: { spell: 20 }, mpCostPct: -15 }), q: split({ statsAdd: { str: -5 } }),
    desc: '術力が上がる。術を閃きやすい。／術のMPの消費が減る。ただし腕力が下がる。',
  });
  make('w_sword_sr_dreamcut', {
    name: '夢断ちの太刀', wtype: 'sword', tier: 9, grade: 'super', src: 'super', exclusive: 'rm_dream_tapir', units: 's1d1', ov: 'katana',
    fx: split({ crit: 15, onHit: { status: 'sleep', chance: 0.2 }, physPct: 10 }), q: split({ hpPct: -15 }),
    desc: '会心が出やすい。眠らせることがある。／物理が強くなる。ただし最大HPが下がる。',
  });
  IDS.fixed.push('w_staff_sr_goldquill', 'w_sword_sr_dreamcut');

  // 検査・ツール用（tools/test_weapons.js・check_weapons.js）。落とす魔物は品のデータには書かない（§9.12 の割り当ては魔物の側）
  Object.assign(WI, {
    MSUPER_DROPPER: Object.fromEntries(SUPER.map((r) => [r[1], r[0]])),
    MRARE_DROPPERS: Object.fromEntries(RARE.map((r) => [r[0], r[6]])),
    UNITS_FIX,
    OV_MONSTER: OV, LINEAGE_RACE, RACE_STATS, parse, phrase, describe, width, descProblems,
  });

  R.onData(() => {
    if (!R.WeaponItems.finish) { R.loadErrors.push('items_weapons_monster: items_weapons.js（R.WeaponItems.finish）が読み込まれていない'); return; }
    R.WeaponItems.finish([].concat(IDS.msuper, IDS.mrare, IDS.fixed));
  });
})(window.RPG);
