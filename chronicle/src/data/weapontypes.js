// src/data/weapontypes.js（担当 techs）
(function (R) {
  'use strict';
  Object.assign(R.DB.weaponTypes, {
    sword: { name: '剣', order: 0, twoHanded: false, reach: false, kind: 'slash', icon: 'icon:sword', fx: 'slash',
      desc: '片手持ち。盾と合わせて攻守に強い。' },
    greatsword: { name: '大剣', order: 1, twoHanded: true, reach: false, kind: 'slash', icon: 'icon:greatsword', fx: 'slash2',
      desc: '両手持ち。重い一撃で敵をなぎ倒す。' },
    dagger: { name: '短剣', order: 2, twoHanded: false, reach: false, kind: 'pierce', icon: 'icon:dagger', fx: 'pierce',
      desc: '器用さで戦う。会心が出やすい。' },
    axe: { name: '斧', order: 3, twoHanded: false, reach: false, kind: 'slash', icon: 'icon:axe', fx: 'slash2',
      desc: '命中は低いが、一撃の威力が高い。' },
    spear: { name: '槍', order: 4, twoHanded: true, reach: true, kind: 'pierce', icon: 'icon:spear', fx: 'pierce',
      desc: '両手持ち。中列からでも届く。' },
    bow: { name: '弓', order: 5, twoHanded: true, reach: true, kind: 'pierce', icon: 'icon:bow', fx: 'arrow',
      desc: '両手持ち。中列から確実に射る。' },
    club: { name: '棍棒', order: 6, twoHanded: false, reach: false, kind: 'blunt', icon: 'icon:club', fx: 'strike',
      desc: '打撃で、硬い敵や骨の敵に強い。' },
    staff: { name: '杖', order: 7, twoHanded: false, reach: false, kind: 'blunt', icon: 'icon:staff', fx: 'strike',
      desc: '術の威力を高める。杖の技は術に近い。' },
    katana: { name: '刀', order: 8, twoHanded: false, reach: false, kind: 'slash', icon: 'icon:katana', fx: 'slash',
      desc: '腕力と器用さで戦う。会心が出やすい。' },
    fist: { name: '体術', order: 9, twoHanded: false, reach: false, kind: 'blunt', icon: 'icon:fist', fx: 'strike',
      desc: '拳で戦う。腕力と素早さが大事。' },
    whip: { name: '鞭', order: 10, twoHanded: false, reach: true, kind: 'blunt', icon: 'icon:whip', fx: 'lash',
      desc: '中列から届き、敵の動きを乱す。' },
  });

  // The techs_<wtype>.js files load in file-name order (axe, bow, club…), so after
  // loading, re-register the t_ actions in the official order of DESIGN §6.1.2
  // (weapon-type order → lv order; the two lv-1 techs keep their file order).
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
