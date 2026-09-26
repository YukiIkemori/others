// src/data/weapontypes.js（担当 techs）
(function (R) {
  'use strict';
  // 7 系統（SYSTEMS_REWORK §3.1）。素手は内部キー fist（R.Rules.UNARMED）で、ここには入れない。
  // desc は通常の武器の説明の 1 行目にもなる（rules.js autoDesc）ので 20 字以内。
  Object.assign(R.DB.weaponTypes, {
    sword: { name: '剣', order: 0, twoHanded: false, reach: false, kind: 'slash', icon: 'icon:sword', fx: 'slash',
      desc: '片手持ち。盾と合わせて攻守に強い。' },
    greatsword: { name: '大剣', order: 1, twoHanded: true, reach: false, kind: 'slash', icon: 'icon:greatsword', fx: 'slash2',
      desc: '両手持ち。重い一撃で敵をなぎ倒す。' },
    dagger: { name: '短剣', order: 2, twoHanded: false, reach: false, kind: 'pierce', icon: 'icon:dagger', fx: 'pierce',
      desc: '器用さで戦う。会心が出やすい。' },
    axe: { name: '斧', order: 3, twoHanded: false, reach: false, kind: 'slash', icon: 'icon:axe', fx: 'slash2',
      desc: '一撃が重い。打撃の槌やメイスもこの系統。' },
    spear: { name: '槍', order: 4, twoHanded: true, reach: true, kind: 'pierce', icon: 'icon:spear', fx: 'pierce',
      desc: '両手持ち。後列からでも届く。' },
    bow: { name: '弓', order: 5, twoHanded: true, reach: true, kind: 'pierce', icon: 'icon:bow', fx: 'arrow',
      desc: '両手持ち。後列から確実に射る。' },
    staff: { name: '杖', order: 6, twoHanded: false, reach: true, kind: 'blunt', icon: 'icon:staff', fx: 'strike',
      desc: '術の威力を高める。後列からも届く。' },
  });

  // The techs_<wtype>.js files load in file-name order (axe, bow, dagger…), so after
  // loading, re-register the t_ actions in the official order of DESIGN §6.1.2
  // (weapon-type order → lv order; techs of the same lv keep their file order).
  // Anything that walks R.DB.actions then sees the techs as the tech book lists them.
  R.onData(function sortTechs() {
    const A = R.DB.actions;
    const order = Object.keys(R.DB.weaponTypes);
    const pos = (t) => { const i = order.indexOf(t.wtype); return i < 0 ? order.length : i; };
    const ids = Object.keys(A).filter((id) => A[id] && A[id].kind === 'tech');
    ids.sort((a, b) => pos(A[a]) - pos(A[b]) || A[a].rank - A[b].rank); // stable
    for (const id of ids) { const t = A[id]; delete A[id]; A[id] = t; }
  });
})(window.RPG);
