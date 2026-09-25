// Rules: character stats, levels, the FFT-style job/ability system, equipment.
// Pure logic (no DOM) — usable from node tools. Operates on character objects
// stored in R.Game.party and on R.Game.inv for equipment swaps.
//
// Character object (see DESIGN.md §State):
//   { id, name, level, exp, hp, mp, status:{poison:true,...},
//     job, jobs:{[jobId]:{jp, total, learned:[abilityId]}},
//     equip:{weapon,shield,head,body,acc}, set:{sub,reaction,support,field} }
(function (R) {
  'use strict';
  const U = R.U;
  const DB = R.DB;

  const STATS = ['hp', 'mp', 'str', 'vit', 'agi', 'int', 'mnd', 'luk'];
  const SLOTS = ['weapon', 'shield', 'head', 'body', 'acc'];
  // abilities added to existing jobs after saves existed (see Rules.syncMastery)
  const LATE_ABILITIES = ['thief_auto_steal'];
  const SLOT_NAMES = { weapon: '武器', shield: '盾', head: '頭', body: '体', acc: 'アクセサリ' };
  const SET_SLOTS = ['sub', 'reaction', 'support', 'field'];
  const STAT_NAMES = { hp: 'HP', mp: 'MP', str: '力', vit: '体力', agi: '素早さ', int: '知力', mnd: '精神', luk: '運' };
  const SET_NAMES = { sub: 'サブアクション', reaction: 'リアクション', support: 'サポート', field: 'フィールド' };
  // cumulative JP earned in a job needed for job level 1..8 — the base (tier 1) table.
  // Higher tiers scale it (playtest: intermediate/advanced jobs levelled up too fast, since
  // monsters pay more JP later): tier 2 ×1.6, tier 3 ×2.25, tier 4 ×2.75 → Rules.jpTable(jobId).
  const JP_TABLE = [0, 100, 250, 450, 700, 1000, 1400, 2000];
  const JP_TIER_MULT = { 1: 1, 2: 1.6, 3: 2.25, 4: 2.75 };
  const jpTables = {};
  const MAX_LEVEL = 99;
  const CAPS = { hp: 999, mp: 999, str: 255, vit: 255, agi: 255, int: 255, mnd: 255, luk: 255 };

  // mods whose values are lists or maps rather than numbers
  const LIST_MODS = { equip: 1, statusImmune: 1 };
  const MAP_MODS = { elemBoost: 1, elemResist: 1, startBuffs: 1 };

  const Rules = (R.Rules = {
    STATS, STAT_NAMES, SLOTS, SLOT_NAMES, SET_SLOTS, SET_NAMES, JP_TABLE, JP_TIER_MULT, MAX_LEVEL, CAPS,

    // ------------------------------------------------------------ creation
    newChar(id) {
      const d = DB.chars[id];
      const c = {
        id, name: d.name, level: 1, exp: 0, hp: 1, mp: 0, status: {},
        job: d.startJob, jobs: {},
        equip: { weapon: null, shield: null, head: null, body: null, acc: null },
        set: { sub: null, reaction: null, support: null, field: null },
      };
      Rules.jobRec(c, d.startJob).learned.push(...(d.startLearned || []).filter((a) => DB.abilities[a]));
      for (const s of SLOTS) if (d.startEquip && d.startEquip[s] && DB.items[d.startEquip[s]]) c.equip[s] = d.startEquip[s];
      const st = Rules.stats(c);
      c.hp = st.hp; c.mp = st.mp;
      Rules.syncUnlocks(c);
      return c;
    },
    /**
     * Save migration: saves from before the tier-scaled JP tables (R.Game.jpTables missing)
     * keep their job levels — a tier-2+ job's JP total is moved to the same place on its new
     * table (same level, same fraction of the way to the next; JP beyond Lv8 added as is).
     * Spendable JP is untouched. Unlocks are recorded before and after.
     */
    migrateJpTables(c) {
      Rules.syncUnlocks(c);
      const n = JP_TABLE.length;
      for (const jid in c.jobs) {
        const rec = c.jobs[jid], tab = Rules.jpTable(jid), t = rec.total || 0;
        if (tab === JP_TABLE || !t) continue;
        let v;
        if (t >= JP_TABLE[n - 1]) v = tab[n - 1] + (t - JP_TABLE[n - 1]);
        else {
          let i = 0;
          while (t >= JP_TABLE[i + 1]) i++;
          v = tab[i] + ((t - JP_TABLE[i]) / (JP_TABLE[i + 1] - JP_TABLE[i])) * (tab[i + 1] - tab[i]);
        }
        rec.total = Math.min(99999, Math.round(v));
      }
      Rules.syncUnlocks(c);
    },
    jobRec(c, jobId) {
      if (!c.jobs[jobId]) c.jobs[jobId] = { jp: 0, total: 0, learned: [] };
      return c.jobs[jobId];
    },

    // ------------------------------------------------------------ levels
    /** total EXP required to reach level L */
    expForLevel(L) {
      if (L <= 1) return 0;
      const n = L - 1;
      return Math.round(8 * Math.pow(n, 2.6) + 10 * n);
    },
    expToNext(c) { return c.level >= MAX_LEVEL ? 0 : Rules.expForLevel(c.level + 1) - c.exp; },
    /** add EXP; returns number of levels gained (HP/MP rise by the max increase) */
    gainExp(c, n) {
      if (c.level >= MAX_LEVEL) return 0;
      const before = Rules.stats(c);
      c.exp += Math.max(0, Math.floor(n));
      let g = 0;
      while (c.level < MAX_LEVEL && c.exp >= Rules.expForLevel(c.level + 1)) { c.level++; g++; }
      if (g) {
        const after = Rules.stats(c);
        if (c.hp > 0) c.hp = Math.min(after.hp, c.hp + (after.hp - before.hp));
        c.mp = Math.min(after.mp, c.mp + (after.mp - before.mp));
      }
      return g;
    },

    // --------------------------------------------------------------- jobs
    /** cumulative JP table of a job (levels 1..8), scaled by its tier */
    jpTable(jobId) {
      const j = DB.jobs[jobId];
      const tier = (j && j.tier) || 1;
      if (!jpTables[tier]) {
        const m = JP_TIER_MULT[tier] || 1;
        jpTables[tier] = JP_TABLE.map((v) => Math.round((v * m) / 10) * 10);
      }
      return jpTables[tier];
    },
    /** cumulative JP needed for job level lv (1..8) of a job */
    jpForJobLevel(jobId, lv) {
      const t = Rules.jpTable(jobId);
      return t[U.clamp(lv | 0, 1, t.length) - 1];
    },
    jobLevel(c, jobId) {
      const rec = c.jobs[jobId];
      const t = rec ? rec.total : 0;
      const tab = Rules.jpTable(jobId);
      let lv = 1;
      for (let i = 0; i < tab.length; i++) if (t >= tab[i]) lv = i + 1;
      return lv;
    },
    /** JP still needed for the next job level (0 at max) */
    jpToNextLevel(c, jobId) {
      const lv = Rules.jobLevel(c, jobId);
      const tab = Rules.jpTable(jobId);
      if (lv >= tab.length) return 0;
      return tab[lv] - ((c.jobs[jobId] && c.jobs[jobId].total) || 0);
    },
    /** does the character meet the job's requirements right now (job levels)? */
    meetsJobReq(c, jobId) {
      const j = DB.jobs[jobId];
      if (!j) return false;
      return (j.req || []).every(([rj, lv]) => Rules.jobLevel(c, rj) >= lv);
    },
    /**
     * Unlocks are permanent: once a job has been open it stays open (c.unlocked), even if the
     * JP table changes later. A job the character is in, has as its sub-command, or has JP /
     * learned abilities in also counts as unlocked (old saves).
     */
    isJobUnlocked(c, jobId) {
      if (!DB.jobs[jobId]) return false;
      if (c.unlocked && c.unlocked[jobId]) return true;
      if (c.job === jobId || (c.set && c.set.sub === jobId)) return true;
      const rec = c.jobs && c.jobs[jobId];
      if (rec && (rec.total > 0 || (rec.learned && rec.learned.length))) return true;
      return Rules.meetsJobReq(c, jobId);
    },
    /** remember every currently open job in c.unlocked (called on JP gain, job change, load) */
    syncUnlocks(c) {
      c.unlocked = c.unlocked || {};
      for (const jid in DB.jobs) if (!c.unlocked[jid] && Rules.isJobUnlocked(c, jid)) c.unlocked[jid] = true;
      return c.unlocked;
    },
    unlockedJobs(c) { return Object.keys(DB.jobs).filter((j) => Rules.isJobUnlocked(c, j)); },
    jobAbilities(jobId) { const j = DB.jobs[jobId]; return j ? (j.abilities || []).filter((a) => DB.abilities[a]) : []; },
    /** mastery (job level MAX or every ability learned) is permanent: rec.mastered stays set even if the job gains abilities later */
    isMastered(c, jobId) {
      const rec = c.jobs[jobId];
      if (!rec) return false;
      if (rec.mastered) return true;
      const list = Rules.jobAbilities(jobId);
      // マスター = job level MAX, or every ability learned (whichever comes first)
      const maxed = (rec.total || 0) >= Rules.jpTable(jobId)[Rules.jpTable(jobId).length - 1];
      if (!maxed && !(list.length > 0 && list.every((a) => rec.learned.includes(a)))) return false;
      rec.mastered = true;
      return true;
    },
    /**
     * Save migration for abilities added to a job after release: a character missing only such
     * abilities had mastered the job, so they get them for free (and stay mastered). A mastered
     * job also receives any ability added to it later.
     */
    syncMastery(c) {
      for (const jid in c.jobs) {
        const rec = c.jobs[jid], list = Rules.jobAbilities(jid);
        if (!rec || !list.length) continue;
        rec.learned = rec.learned || [];
        const missing = list.filter((a) => !rec.learned.includes(a));
        if (!missing.length) { rec.mastered = true; continue; }
        if (rec.mastered || missing.every((a) => LATE_ABILITIES.includes(a))) {
          for (const a of missing) rec.learned.push(a);
          rec.mastered = true;
        }
      }
    },
    /** has the character learned this ability (in its own job)? */
    learned(c, abilityId) {
      const a = DB.abilities[abilityId];
      if (!a) return false;
      const rec = c.jobs[a.job];
      return !!rec && rec.learned.includes(abilityId);
    },
    /** {ok, reason} */
    canLearn(c, abilityId) {
      const a = DB.abilities[abilityId];
      if (!a) return { ok: false, reason: '不明なアビリティ' };
      if (Rules.learned(c, abilityId)) return { ok: false, reason: '習得済み' };
      if (!Rules.isJobUnlocked(c, a.job)) return { ok: false, reason: 'ジョブ未開放' };
      const rec = Rules.jobRec(c, a.job);
      if (rec.jp < (a.jp || 0)) return { ok: false, reason: 'JPが足りない' };
      return { ok: true };
    },
    learn(c, abilityId) {
      if (!Rules.canLearn(c, abilityId).ok) return false;
      const a = DB.abilities[abilityId];
      const rec = Rules.jobRec(c, a.job);
      const before = Rules.stats(c);
      rec.jp -= a.jp || 0;
      rec.learned.push(abilityId);
      if (Rules.isMastered(c, a.job)) {
        // mastery bonus: max HP/MP rise, and the current values with them (like a level-up)
        const after = Rules.stats(c);
        if (c.hp > 0) c.hp = Math.min(after.hp, c.hp + Math.max(0, after.hp - before.hp));
        c.mp = Math.min(after.mp, c.mp + Math.max(0, after.mp - before.mp));
      }
      return true;
    },
    /** flat stats a job grants for good once mastered (DB.jobs[job].masterBonus) */
    jobMasterBonus(jobId) { const j = DB.jobs[jobId]; return (j && j.masterBonus) || {}; },
    /** summed mastery bonuses of every job the character has mastered: {hp, str, ...} */
    masterBonus(c) {
      const b = {};
      for (const jid in c.jobs || {}) {
        if (!Rules.isMastered(c, jid)) continue;
        const mb = Rules.jobMasterBonus(jid);
        for (const k in mb) b[k] = (b[k] || 0) + mb[k];
      }
      return b;
    },
    /** 'HP+10 力+3' — a job's mastery bonus for menus */
    masterBonusText(jobId) {
      const mb = Rules.jobMasterBonus(jobId);
      return STATS.filter((k) => mb[k]).map((k) => STAT_NAMES[k] + '+' + mb[k]).join(' ');
    },
    /** a job's signature ability id (DB.jobs[job].masterTrait), always active once the job is mastered */
    jobMasterTrait(jobId) {
      const j = DB.jobs[jobId], id = j && j.masterTrait;
      return id && DB.abilities[id] ? id : null;
    },
    /** '常時：反撃' — the signature ability for menus ('' if none) */
    masterTraitText(jobId) { const id = Rules.jobMasterTrait(jobId); return id ? '常時：' + DB.abilities[id].name : ''; },
    /** 'HP+10 力+3／常時：反撃' — the whole mastery perk (stats + signature) for menus */
    masterPerkText(jobId) {
      return [Rules.masterBonusText(jobId), Rules.masterTraitText(jobId)].filter(Boolean).join('／');
    },
    /** signature abilities c carries into every job (one per mastered job), in DB order */
    signatures(c) {
      const out = [];
      for (const jid in DB.jobs) {
        const id = c.jobs && c.jobs[jid] && Rules.jobMasterTrait(jid);
        if (id && Rules.isMastered(c, jid)) out.push(id);
      }
      return out;
    },
    /**
     * the reaction abilities active for c: the one set in the リアクション slot, then the
     * signature reactions of mastered jobs (each once)
     */
    reactions(c) {
      const out = [];
      const id = c.set && c.set.reaction;
      if (id && DB.abilities[id] && DB.abilities[id].kind === 'reaction' && Rules.learned(c, id)) out.push(id);
      for (const s of Rules.signatures(c)) if (DB.abilities[s].kind === 'reaction' && !out.includes(s)) out.push(s);
      return out;
    },
    /** mastered jobs of c, in DB order */
    masteredJobs(c) { return Object.keys(DB.jobs).filter((j) => c.jobs && c.jobs[j] && Rules.isMastered(c, j)); },
    /**
     * is a job's mastery perk known to the player? Only once someone in the party has mastered
     * the job (menus show 「マスター特典 ？？？」 until then).
     */
    perkKnown(jobId, party) {
      party = party || (R.Game && R.Game.party) || [];
      return party.some((c) => c && c.jobs && c.jobs[jobId] && Rules.isMastered(c, jobId));
    },
    /** add JP to current job. Returns {levelUps:[{job,level}], unlocked:[jobId], mastered:[jobId]} */
    gainJp(c, n) {
      const res = { levelUps: [], unlocked: [], mastered: [] };
      n = Math.max(0, Math.floor(n));
      if (!n) return res;
      const beforeUnlocked = new Set(Rules.unlockedJobs(c));
      const jid = c.job;
      const m0 = Rules.isMastered(c, jid);
      const st0 = m0 ? null : Rules.stats(c);
      const lv0 = Rules.jobLevel(c, jid);
      const rec = Rules.jobRec(c, jid);
      rec.jp = Math.min(9999, rec.jp + n);
      rec.total = Math.min(99999, rec.total + n);
      const lv1 = Rules.jobLevel(c, jid);
      if (lv1 > lv0) res.levelUps.push({ job: jid, level: lv1 });
      if (!m0 && Rules.isMastered(c, jid)) {
        res.mastered.push(jid);
        // mastery bonus: current HP/MP rise with the maxima (like a level-up)
        const st1 = Rules.stats(c);
        if (c.hp > 0) c.hp = Math.min(st1.hp, c.hp + Math.max(0, st1.hp - st0.hp));
        c.mp = Math.min(st1.mp, c.mp + Math.max(0, st1.mp - st0.mp));
      }
      for (const j of Rules.unlockedJobs(c)) if (!beforeUnlocked.has(j)) res.unlocked.push(j);
      Rules.syncUnlocks(c);
      return res;
    },
    /**
     * Change job. Unequips anything the new job cannot use (back to R.Game.inv),
     * drops a sub-command equal to the new job, clamps HP/MP.
     * Returns list of unequipped item ids.
     */
    changeJob(c, jobId) {
      if (!Rules.isJobUnlocked(c, jobId)) return null;
      c.job = jobId;
      Rules.jobRec(c, jobId);
      Rules.syncUnlocks(c);
      if (c.set.sub === jobId) c.set.sub = null;
      const removed = Rules.validateEquip(c);
      Rules.clampHpMp(c);
      return removed;
    },
    /** unequip items that are no longer allowed (after job/support change) */
    validateEquip(c) {
      const removed = [];
      for (const s of SLOTS) {
        const id = c.equip[s];
        if (id && !Rules.canEquip(c, id, s)) {
          c.equip[s] = null;
          if (R.State) R.State.addItem(id, 1);
          removed.push(id);
        }
      }
      return removed;
    },
    clampHpMp(c) {
      const st = Rules.stats(c);
      if (c.hp > st.hp) c.hp = st.hp;
      if (c.mp > st.mp) c.mp = st.mp;
    },

    // ------------------------------------------------ ability set slots
    /** learned abilities of a kind (reaction/support/field) from ANY job */
    slotOptions(c, kind) {
      if (kind === 'sub') {
        return Rules.unlockedJobs(c).filter((j) => j !== c.job && Rules.actionList(c, j).length > 0);
      }
      const out = [];
      for (const jid in c.jobs) for (const a of c.jobs[jid].learned) {
        const ab = DB.abilities[a];
        if (ab && ab.kind === kind) out.push(a);
      }
      return out;
    },
    setSlot(c, slot, value) {
      if (slot === 'sub' && value === c.job) return false;
      c.set[slot] = value || null;
      if (slot === 'support') Rules.validateEquip(c);
      Rules.clampHpMp(c);
      return true;
    },

    // --------------------------------------------------------- commands
    /** learned action abilities belonging to jobId, in the job's list order */
    actionList(c, jobId) {
      return Rules.jobAbilities(jobId).filter((a) => DB.abilities[a].kind === 'action' && Rules.learned(c, a));
    },
    /**
     * Battle command menu for a character:
     *  [{type:'attack'}, {type:'job',job}, {type:'job',job:sub}?, {type:'defend'}, {type:'item'}]
     */
    commands(c) {
      const out = [{ type: 'attack', name: '戦う' }];
      const j = DB.jobs[c.job];
      out.push({ type: 'job', job: c.job, name: (j && j.command) || '特技' });
      if (c.set.sub && DB.jobs[c.set.sub]) out.push({ type: 'job', job: c.set.sub, name: DB.jobs[c.set.sub].command || '特技' });
      out.push({ type: 'defend', name: '防御' });
      out.push({ type: 'item', name: '道具' });
      return out;
    },
    /** action abilities usable from the field menu (current + sub job) */
    fieldActions(c) {
      const out = [];
      for (const jid of [c.job, c.set.sub]) {
        if (!jid) continue;
        for (const a of Rules.actionList(c, jid)) if (DB.abilities[a].fieldUse) out.push(a);
      }
      return out;
    },
    mpCost(c, abilityId) {
      const a = DB.abilities[abilityId];
      if (!a || !a.mp) return 0;
      const m = Rules.mods(c);
      const pct = m.mpCostPct || 0;
      // reductions round down (but an MP ability never becomes free); increases round up
      const v = a.mp * (100 + pct) / 100;
      return Math.max(1, pct < 0 ? Math.floor(v + 1e-9) : Math.ceil(v - 1e-9));
    },

    // -------------------------------------------------------- equipment
    itemSlot(itemId) {
      const it = DB.items[itemId];
      if (!it) return null;
      return { weapon: 'weapon', shield: 'shield', head: 'head', body: 'body', acc: 'acc' }[it.type] || null;
    },
    /** can c equip itemId into slot (default: the item's natural slot)? */
    canEquip(c, itemId, slot) {
      const it = DB.items[itemId];
      if (!it) return false;
      slot = slot || Rules.itemSlot(itemId);
      const j = DB.jobs[c.job] || {};
      const m = Rules.mods(c, { ignoreEquip: true });
      const extra = m.equip || [];
      if (slot === 'shield' && it.type === 'weapon') {
        // dual wield: a one-handed weapon in the shield slot
        return !!m.twoSwords && !it.twoHanded && Rules.canEquip(c, itemId, 'weapon');
      }
      if (it.type !== slot) return false;
      if (it.only && !it.only.includes(c.id)) return false;
      switch (slot) {
        case 'weapon': return (j.weapons || []).includes(it.wtype) || extra.includes(it.wtype);
        case 'shield': return !!j.shield || extra.includes('shield');
        case 'head': return (j.heads || []).includes(it.atype) || extra.includes(it.atype);
        case 'body': return (j.bodies || []).includes(it.atype) || extra.includes(it.atype);
        case 'acc': return true;
      }
      return false;
    },
    /** equip itemId (from inventory) into slot, returning the old item to inventory. itemId null = unequip */
    equip(c, slot, itemId) {
      const old = c.equip[slot];
      if (itemId) {
        if (!Rules.canEquip(c, itemId, slot)) return false;
        if (R.State && !R.State.removeItem(itemId, 1)) return false;
      }
      if (old && R.State) R.State.addItem(old, 1);
      c.equip[slot] = itemId || null;
      // a two-handed weapon empties the shield slot
      const w = c.equip.weapon && DB.items[c.equip.weapon];
      if (slot === 'weapon' && w && w.twoHanded && c.equip.shield) {
        if (R.State) R.State.addItem(c.equip.shield, 1);
        c.equip.shield = null;
      }
      if (slot === 'shield' && itemId && w && w.twoHanded) {
        if (R.State) R.State.addItem(c.equip.weapon, 1);
        c.equip.weapon = null;
      }
      Rules.clampHpMp(c);
      return true;
    },
    /**
     * score used by '最強装備', weighted by what the member is good at: fighters value
     * 攻撃力/力, mages 魔力/知力, healers 精神 (a rod is never swapped for a knife on a mage)
     */
    itemScore(c, itemId) {
      const it = DB.items[itemId];
      if (!it) return -1;
      const st = it.stats || {};
      const b = { str: Rules.baseStat(c, 'str'), int: Rules.baseStat(c, 'int'), mnd: Rules.baseStat(c, 'mnd') };
      const mult = (DB.jobs[c.job] && DB.jobs[c.job].mult) || {};
      for (const k in b) b[k] *= mult[k] || 1;
      const phys = b.str >= Math.max(b.int, b.mnd) * 0.9;
      const caster = !phys && b.int >= b.mnd;
      const healer = !phys && !caster;
      const w = {
        atk: phys ? 1.3 : 0.3, mag: caster ? 3 : healer ? 0.8 : 0.2,
        str: phys ? 1 : 0.3, int: caster ? 1.5 : 0.3, mnd: healer ? 1.2 : 0.5, vit: 0.8, agi: phys ? 0.8 : 0.5, luk: phys ? 0.4 : 0.2,
      };
      let v = (it.atk || 0) * w.atk + (it.def || 0) * 1.2 + (it.mag || 0) * w.mag + (it.mdef || 0) * (phys ? 0.8 : 1);
      for (const k of ['str', 'vit', 'agi', 'int', 'mnd', 'luk']) v += (st[k] || 0) * w[k];
      v += ((st.hp || 0) + (st.mp || 0)) * 0.1;
      return v + (it.rare ? 0.5 : 0);
    },
    /**
     * equip the best available items for every slot. Returns true if anything changed.
     * Party-aware: the last copy of an item is left for a member who would gain clearly more from it.
     * The accessory is the player's own choice and is left alone unless opts.acc (sims).
     */
    optimize(c, opts) {
      let changed = false;
      const others = ((R.Game && R.Game.party) || []).filter((o) => o !== c);
      const gainFor = (o, id, slot) => (Rules.canEquip(o, id, slot) ? Rules.itemScore(o, id) - (o.equip[slot] ? Rules.itemScore(o, o.equip[slot]) : 0) : -Infinity);
      for (const slot of SLOTS) {
        if (slot === 'acc' && !(opts && opts.acc)) continue;
        if (slot === 'shield' && c.equip.weapon && DB.items[c.equip.weapon] && DB.items[c.equip.weapon].twoHanded) continue;
        const cur = c.equip[slot];
        const curScore = cur ? Rules.itemScore(c, cur) : 0;
        let best = cur, bestScore = curScore;
        for (const id in (R.Game && R.Game.inv) || {}) {
          if (!R.Game.inv[id]) continue;
          const it = DB.items[id];
          if (!it) continue;
          // the shield slot may hold an off-hand weapon when dual wielding
          if (it.type !== slot && !(slot === 'shield' && it.type === 'weapon')) continue;
          if (!Rules.canEquip(c, id, slot)) continue;
          const s = Rules.itemScore(c, id);
          if (s <= bestScore) continue;
          if (R.Game.inv[id] === 1 && it.type === slot) {
            const mine = s - curScore;
            if (others.some((o) => gainFor(o, id, slot) > mine * 1.25 + 0.5)) continue;
          }
          best = id; bestScore = s;
        }
        if (best !== cur) { Rules.equip(c, slot, best); changed = true; }
      }
      return changed;
    },

    // ---------------------------------------------------------- stats
    baseStat(c, stat, level) {
      const g = DB.chars[c.id].growth[stat];
      // growth curve only; c.bonus (seeds) is added after the job multiplier in stats()
      return g[0] + g[1] * ((level || c.level) - 1);
    },
    /** permanent stat gain (seeds). Returns new bonus. */
    grow(c, stat, n) {
      c.bonus = c.bonus || {};
      c.bonus[stat] = (c.bonus[stat] || 0) + n;
      return c.bonus[stat];
    },
    /**
     * Aggregated modifier object from: current job innate, set reaction/support/field
     * abilities (only their `mods`), and equipment `mods`.
     */
    mods(c, opts) {
      const out = {};
      const add = (m) => {
        if (!m) return;
        for (const k in m) {
          const v = m[k];
          if (LIST_MODS[k]) out[k] = (out[k] || []).concat(v);
          else if (MAP_MODS[k]) {
            out[k] = out[k] || {};
            for (const e in v) out[k][e] = k === 'elemResist' ? (out[k][e] == null ? v[e] : Math.min(out[k][e], v[e])) : (out[k][e] || 0) + v[e];
          } else if (typeof v === 'number') out[k] = (out[k] || 0) + v;
          else out[k] = v;
        }
      };
      const j = DB.jobs[c.job];
      if (j) add(j.innate);
      const slotted = [];
      for (const s of ['support', 'field', 'reaction']) {
        const a = c.set[s] && DB.abilities[c.set[s]];
        if (a && a.kind === s && Rules.learned(c, c.set[s])) { add(a.mods); slotted.push(c.set[s]); }
      }
      // mastered jobs' signature supports: always on, without a slot (never doubled with the slotted one)
      for (const id of Rules.signatures(c)) {
        const a = DB.abilities[id];
        if (a.kind !== 'reaction' && !slotted.includes(id)) add(a.mods);
      }
      if (!(opts && opts.ignoreEquip)) {
        for (const s of SLOTS) { const it = c.equip[s] && DB.items[c.equip[s]]; if (it) add(it.mods); }
      }
      return out;
    },
    /**
     * Full derived stats.
     * { hp,mp (max), str,vit,agi,int,mnd,luk, atk, atk2 (off-hand, dual wield) , def, mag, mdef,
     *   hit, eva, crit, element (weapon element), onHit (weapon status), element2/onHit2 (off-hand), mods }
     */
    stats(c) {
      const j = DB.jobs[c.job] || { mult: {} };
      const mult = j.mult || {};
      const m = Rules.mods(c);
      const mb = Rules.masterBonus(c);
      const s = {};
      for (const k of STATS) {
        // seeds ('grow', c.bonus) and mastered jobs' bonuses are flat, job-independent gains:
        // 力の種 +2 is +2 in every job
        let v = Rules.baseStat(c, k) * (mult[k] || 1) + ((c.bonus && c.bonus[k]) || 0) + (mb[k] || 0);
        v = v * (100 + (m[k + 'Pct'] || 0)) / 100;
        s[k] = v;
      }
      // equipment flat stats
      let atkW = 0, atkW2 = 0, def = 0, mag = 0, mdef = 0, eva = 0, hit = 0;
      let element = null, onHit = null, element2 = null, onHit2 = null;
      for (const slot of SLOTS) {
        const it = c.equip[slot] && DB.items[c.equip[slot]];
        if (!it) continue;
        const st = it.stats || {};
        for (const k of STATS) if (st[k]) s[k] += st[k];
        if (it.type === 'weapon') {
          if (slot === 'weapon') { atkW += it.atk || 0; element = it.element || element; onHit = it.onHit || onHit; }
          else { atkW2 += it.atk || 0; element2 = it.element || null; onHit2 = it.onHit || null; }
          hit += it.hit || 0;
        } else def += it.def || 0;
        mag += it.mag || 0;
        mdef += it.mdef || 0;
        eva += it.eva || 0;
      }
      for (const k of STATS) s[k] = U.clamp(Math.floor(s[k]), k === 'hp' ? 1 : 0, CAPS[k]);
      const w = c.equip.weapon && DB.items[c.equip.weapon];
      const unarmed = !w ? (m.unarmed || 0) : 0;
      const pct = (v, p) => Math.floor(v * (100 + (m[p] || 0)) / 100);
      s.atk = pct(s.str + atkW + unarmed + (m.atk || 0), 'atkPct');
      s.atk2 = c.equip.shield && DB.items[c.equip.shield] && DB.items[c.equip.shield].type === 'weapon' ? pct(s.str + atkW2 + (m.atk || 0), 'atkPct') : 0;
      s.def = pct(Math.floor(s.vit / 2) + def + (m.def || 0), 'defPct');
      s.mag = pct(s.int + mag + (m.mag || 0), 'magPct');
      s.mdef = pct(Math.floor(s.mnd / 2) + mdef + (m.mdef || 0), 'mdefPct');
      s.hit = 95 + hit + (m.hit || 0);
      s.eva = Math.floor(s.agi / 16) + eva + (m.eva || 0);
      s.crit = 3 + Math.floor(s.luk / 32) + (m.crit || 0) + (m.critPct || 0);
      s.element = element; s.onHit = onHit;
      s.element2 = s.atk2 ? element2 : null; s.onHit2 = s.atk2 ? onHit2 : null; // off-hand weapon (dual wield)
      s.mods = m;
      return s;
    },
    isAlive(c) { return c.hp > 0; },
  });
})(window.RPG);
