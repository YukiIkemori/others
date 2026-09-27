// CONTENT-P: 旅人の古井戸（寄り道 #3、V2_PLAN §3.2・§3.4 q_pharos_well、WORLD_REDESIGN §2.7-3）
//   well_nest   宝石ウサギの巣に入った（1 回）: 依頼 q_pharos_well と寄り道のうわさ l_opt_well が解決
//   well_grave  旅人の墓標（井戸の底の花の話）
(function (R) {
  'use strict';
  const D = R.DB.events;
  const X = () => R.ContentP.ev;

  D.well_nest = {
    once: true,
    meta: { needs: [], gives: ['flag:prologue_well_nest'] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, '花の咲くくぼみに、\n光る毛並みの小さなけものの\n巣がある。');
      await E.narr(ev, '宝石ウサギの巣だ……！\nきらきらした音の正体は、\nこれだったのか。');
      ev.setFlag('prologue_well_nest');
      if (R.Game.leads && R.Game.leads.q_pharos_well) ev.leadDone('q_pharos_well');
      if (R.Game.leads && R.Game.leads.l_opt_well) ev.leadDone('l_opt_well');
    },
  };
  D.well_grave = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, '古い旅人の墓標がある。');
      await E.narr(ev, '「井戸の底の花を、\nいつか娘に見せたかった。」');
    },
  };
})(window.RPG);
