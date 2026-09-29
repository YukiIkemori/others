// 武器の系統 5 つ（R.DB.weaponTypes。RULES）。STATS_REWORK §8.1（A29: 剣・大剣・短剣・弓・杖、武器枠 1 つ）。
// 数値（mult・命中・会心・能力値・magMult）は R.Rules.K.WTYPE が正。ここは名前・並び・演出・1 行の説明（20 字以内）。
// 素手は内部キー fist（R.Rules.UNARMED）で、ここには入れない。
// 派生技（techs_*.js の末尾。derived:{from, lv}、glim なし）: 親の技 from を使った行動の後だけ、まれに編み出す（R.Glimmer.deriveRoll・K.DERIVE）。
// 大剣の系統は大剣・大斧（art 'axe'）・大槌（art 'club'、kind 'blunt'）・大銛や大鎌を含む。剣の系統は剣・刀（'katana'）・細剣（'rapier'）。
(function (R) {
  'use strict';
  R.defs('weaponTypes', {
    sword: { name: R.T('weaponTypes.sword.name'), order: 0, twoHanded: false, reach: false, kind: 'slash', icon: 'sword', fx: 'slash', pose: 'slash',
      desc: R.T('weaponTypes.sword.desc') },
    greatsword: { name: R.T('weaponTypes.greatsword.name'), order: 1, twoHanded: true, reach: false, kind: 'slash', icon: 'greatsword', fx: 'slash2', pose: 'smash',
      desc: R.T('weaponTypes.greatsword.desc') },
    dagger: { name: R.T('weaponTypes.dagger.name'), order: 2, twoHanded: false, reach: false, kind: 'pierce', icon: 'dagger', fx: 'pierce', pose: 'thrust',
      desc: R.T('weaponTypes.dagger.desc') },
    bow: { name: R.T('weaponTypes.bow.name'), order: 3, twoHanded: true, reach: true, kind: 'pierce', icon: 'bow', fx: 'arrow', pose: 'shoot',
      desc: R.T('weaponTypes.bow.desc') },
    staff: { name: R.T('weaponTypes.staff.name'), order: 4, twoHanded: false, reach: true, kind: 'blunt', icon: 'staff', fx: 'strike', pose: 'smash',
      desc: R.T('weaponTypes.staff.desc') },
  });

  // 技・術をひとつの表 R.DB.actions にもまとめる（今の木の戦闘・閃きのコードが DB.actions を読むため。
  // 技は系統の順 → lv の順、術は spells_*.js の order の順）。R.DB.techs・R.DB.spells が正で、actions は読むだけの写し。
  R.onData(function buildActions() {
    const A = (R.DB.actions = R.DB.actions || {});
    const order = Object.keys(R.DB.weaponTypes);
    const T = R.DB.techs || {}, S = R.DB.spells || {};
    const tids = Object.keys(T).sort((a, b) => order.indexOf(T[a].wtype) - order.indexOf(T[b].wtype) || (T[a].rank || 0) - (T[b].rank || 0));
    for (const id of tids) if (!A[id]) A[id] = T[id];
    for (const id of Object.keys(S)) if (!A[id]) A[id] = S[id];
  });
})(window.RPG);
