// The story's "次の目的" texts: the obj_s_* prefix (DESIGN §10.13.8, §3.3.15). Owner: story (A19).
//   obj_s_t6_home        T6 (story_after_clear) → back to obj_regions in story_home_t6
//   obj_s_final_roa      T8 (story_after_clear) → story_final_roa
//   obj_s_final_ferry    story_final_roa        → biblia_arrival
//   obj_s_final_archive  biblia_arrival         → the ending
//   obj_s_postgame       the ending (R.Ending)  → pg_clear (set by the oblivion owner's last scene)
//   obj_s_pg_clear       after 円環竜オウロボラ (set by the oblivion owner, §10.12)
(function (R) {
  'use strict';
  Object.assign(R.DB.objectives, {
    obj_s_t6_home:       { text: '師匠の様子を見に、\nロアの里へ帰ろう。' },
    obj_s_final_roa:     { text: '八枚のページがそろった。\nロアの里へ帰ろう。' },
    obj_s_final_ferry:   { text: 'ファロスの港から、\nビブリア島へ渡ろう。' },
    obj_s_final_archive: { text: '白の大書庫の頂を目指そう。' },
    obj_s_postgame:      { text: '大書庫の地下に、\n忘却の底が口を開けた。' },
    obj_s_pg_clear:      { text: 'すべての物語を書き終えた。' },
  });
})(window.RPG);
