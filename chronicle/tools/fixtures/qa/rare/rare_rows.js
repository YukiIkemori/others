// test_qa Q10 fixture (A22): planted faults for validate CH12 (BRIEF A12.4 / R4.3 / A22.2, DESIGN §9.7.3 · §10.6.4).
// Runs as the last data hook, after the region kits derived their rare-monster room zones.
(function (R) {
  'use strict';
  R.onData(function (R) {
    const RE = R.DB.rareEncounters;
    if (RE.z_r_mine_den) RE.z_r_mine_den = { mon: RE.z_r_mine_den.mon, rate: 40 };                 // not ⌈80/3⌉ = 27
    if (RE.z_r_marsh_teaparty) RE.z_r_marsh_teaparty = { mon: 'rm_prisma', rate: RE.z_r_marsh_teaparty.rate };   // wrong monster
    RE.zw_prologue_qa = { mon: 'rm_jewel_hare', rate: 80 };                                          // neither the 23 nor a room
    if (R.DB.encounters.zw_prologue) R.DB.encounters.zw_prologue_qa = R.DB.encounters.zw_prologue;
  });
})(window.RPG);
