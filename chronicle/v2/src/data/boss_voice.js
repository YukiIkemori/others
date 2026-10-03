// BSCENE: ボスの声（持ち主 2026-10-03「ボスに声を」）。戦闘の始め・暴走（怒り狂った／本気になった）・必殺技・倒れた時の短い一言。
//   話せる相手（人・言葉を持つ魔物・竜・王・霊）だけ。言葉の無い獣（ページ食らい・狼・大ダコ…）には付けない。
//   start / enrage / defeat: 声の札の並び（1 つ以上なら選ぶ）。ult: ボスの行動 id（演出の表の ult: 1 の行）→ その技の掛け声。
//   音は chronicle/assets/voice/<id>.ogg（台本 chronicle/design/voice/boss_lines.csv、配役 casting.json の boss、tools/boss_voice.js が照らし合わせる）。
//   字幕の文は R.T('bossVoice.<id>')（src/i18n/<言語>/boss_voice.js）。鳴らし方と字幕は src/systems/battle/voice_boss.js
(function (R) {
  'use strict';
  const V = (id, text) => ({ id, text });
  R.DB.bossVoice = {
    b_sandking: {
      start: [V('bv_sandking_start_1', R.T('bossVoice.bv_sandking_start_1'))],
      enrage: [V('bv_sandking_enrage_1', R.T('bossVoice.bv_sandking_enrage_1'))],
      ult: { eb_king_judgment: V('bv_sandking_ult_1', R.T('bossVoice.bv_sandking_ult_1')) },
      defeat: [V('bv_sandking_defeat_1', R.T('bossVoice.bv_sandking_defeat_1'))],
    },
    b_icegiant: {
      start: [V('bv_icegiant_start_1', R.T('bossVoice.bv_icegiant_start_1'))],
      enrage: [V('bv_icegiant_enrage_1', R.T('bossVoice.bv_icegiant_enrage_1'))],
      ult: { eb_avalanche_drop: V('bv_icegiant_ult_1', R.T('bossVoice.bv_icegiant_ult_1')) },
      defeat: [V('bv_icegiant_defeat_1', R.T('bossVoice.bv_icegiant_defeat_1'))],
    },
    b_whitedragon: {
      start: [V('bv_whitedragon_start_1', R.T('bossVoice.bv_whitedragon_start_1'))],
      enrage: [V('bv_whitedragon_enrage_1', R.T('bossVoice.bv_whitedragon_enrage_1'))],
      ult: { eb_glacier_fall: V('bv_whitedragon_ult_1', R.T('bossVoice.bv_whitedragon_ult_1')) },
      defeat: [V('bv_whitedragon_defeat_1', R.T('bossVoice.bv_whitedragon_defeat_1'))],
    },
    b_mistbeast: {
      start: [V('bv_mistbeast_start_1', R.T('bossVoice.bv_mistbeast_start_1'))],
      enrage: [V('bv_mistbeast_enrage_1', R.T('bossVoice.bv_mistbeast_enrage_1'))],
      defeat: [V('bv_mistbeast_defeat_1', R.T('bossVoice.bv_mistbeast_defeat_1'))],
    },
    b_captain: {
      start: [V('bv_captain_start_1', R.T('bossVoice.bv_captain_start_1'))],
      enrage: [V('bv_captain_enrage_1', R.T('bossVoice.bv_captain_enrage_1'))],
      ult: { eb_captain_barrage: V('bv_captain_ult_1', R.T('bossVoice.bv_captain_ult_1')) },
      defeat: [V('bv_captain_defeat_1', R.T('bossVoice.bv_captain_defeat_1'))],
    },
    b_ironwarden: {
      start: [V('bv_ironwarden_start_1', R.T('bossVoice.bv_ironwarden_start_1'))],
      enrage: [V('bv_ironwarden_enrage_1', R.T('bossVoice.bv_ironwarden_enrage_1'))],
      ult: { eb_anvil_drop: V('bv_ironwarden_ult_1', R.T('bossVoice.bv_ironwarden_ult_1')) },
      defeat: [V('bv_ironwarden_defeat_1', R.T('bossVoice.bv_ironwarden_defeat_1'))],
    },
    b_orrery: {
      start: [V('bv_orrery_start_1', R.T('bossVoice.bv_orrery_start_1'))],
      enrage: [V('bv_orrery_enrage_1', R.T('bossVoice.bv_orrery_enrage_1'))],
      ult: { eb_orrery_eclipse: V('bv_orrery_ult_1', R.T('bossVoice.bv_orrery_ult_1')) },
      defeat: [V('bv_orrery_defeat_1', R.T('bossVoice.bv_orrery_defeat_1'))],
    },
    b_rowell1: {
      start: [V('bv_rowell1_start_1', R.T('bossVoice.bv_rowell1_start_1'))],
      enrage: [V('bv_rowell1_enrage_1', R.T('bossVoice.bv_rowell1_enrage_1'))],
      ult: { eb_rowell_verdict: V('bv_rowell1_ult_1', R.T('bossVoice.bv_rowell1_ult_1')) },
      defeat: [V('bv_rowell1_defeat_1', R.T('bossVoice.bv_rowell1_defeat_1'))],
    },
    b_rowell2: {
      start: [V('bv_rowell2_start_1', R.T('bossVoice.bv_rowell2_start_1'))],
      enrage: [V('bv_rowell2_enrage_1', R.T('bossVoice.bv_rowell2_enrage_1'))],
      ult: { eb_rowell_redact: V('bv_rowell2_ult_1', R.T('bossVoice.bv_rowell2_ult_1')) },
      defeat: [V('bv_rowell2_defeat_1', R.T('bossVoice.bv_rowell2_defeat_1'))],
    },
    b_shade_sword: {
      start: [V('bv_shade_sword_start_1', R.T('bossVoice.bv_shade_sword_start_1'))],
      enrage: [V('bv_shade_sword_enrage_1', R.T('bossVoice.bv_shade_sword_enrage_1'))],
      defeat: [V('bv_shade_sword_defeat_1', R.T('bossVoice.bv_shade_sword_defeat_1'))],
    },
    b_shade_prayer: {
      enrage: [V('bv_shade_prayer_enrage_1', R.T('bossVoice.bv_shade_prayer_enrage_1'))],
      defeat: [V('bv_shade_prayer_defeat_1', R.T('bossVoice.bv_shade_prayer_defeat_1'))],
    },
    b_shade_star: {
      enrage: [V('bv_shade_star_enrage_1', R.T('bossVoice.bv_shade_star_enrage_1'))],
      defeat: [V('bv_shade_star_defeat_1', R.T('bossVoice.bv_shade_star_defeat_1'))],
    },
    b_lazaro: {
      start: [V('bv_lazaro_start_1', R.T('bossVoice.bv_lazaro_start_1'))],
      enrage: [V('bv_lazaro_enrage_1', R.T('bossVoice.bv_lazaro_enrage_1'))],
      ult: { eb_lazaro_redact: V('bv_lazaro_ult_1', R.T('bossVoice.bv_lazaro_ult_1')), eb_lazaro_rewrite: V('bv_lazaro_ult_2', R.T('bossVoice.bv_lazaro_ult_2')) },
      defeat: [V('bv_lazaro_defeat_1', R.T('bossVoice.bv_lazaro_defeat_1'))],
    },
    b_nemrea1: {
      start: [V('bv_nemrea1_start_1', R.T('bossVoice.bv_nemrea1_start_1'))],
      enrage: [V('bv_nemrea1_enrage_1', R.T('bossVoice.bv_nemrea1_enrage_1'))],
      ult: { eb_whiteout: V('bv_nemrea1_ult_1', R.T('bossVoice.bv_nemrea1_ult_1')) },
      defeat: [V('bv_nemrea1_defeat_1', R.T('bossVoice.bv_nemrea1_defeat_1'))],
    },
    b_nemrea2: {
      start: [V('bv_nemrea2_start_1', R.T('bossVoice.bv_nemrea2_start_1'))],
      enrage: [V('bv_nemrea2_enrage_1', R.T('bossVoice.bv_nemrea2_enrage_1'))],
      ult: { eb_nemrea2_close: V('bv_nemrea2_ult_1', R.T('bossVoice.bv_nemrea2_ult_1')), eb_eight_legends: V('bv_nemrea2_ult_2', R.T('bossVoice.bv_nemrea2_ult_2')), eb_nemrea_rewrite: V('bv_nemrea2_ult_3', R.T('bossVoice.bv_nemrea2_ult_3')) },
      defeat: [V('bv_nemrea2_defeat_1', R.T('bossVoice.bv_nemrea2_defeat_1'))],
    },
    b_valzard_echo: {
      start: [V('bv_valzard_echo_start_1', R.T('bossVoice.bv_valzard_echo_start_1'))],
      enrage: [V('bv_valzard_echo_enrage_1', R.T('bossVoice.bv_valzard_echo_enrage_1'))],
      ult: { eb_echo_despair: V('bv_valzard_echo_ult_1', R.T('bossVoice.bv_valzard_echo_ult_1')) },
      defeat: [V('bv_valzard_echo_defeat_1', R.T('bossVoice.bv_valzard_echo_defeat_1'))],
    },
    b_ouroboros: {
      start: [V('bv_ouroboros_start_1', R.T('bossVoice.bv_ouroboros_start_1'))],
      enrage: [V('bv_ouroboros_enrage_1', R.T('bossVoice.bv_ouroboros_enrage_1'))],
      ult: { eb_ouro_end: V('bv_ouroboros_ult_1', R.T('bossVoice.bv_ouroboros_ult_1')), eb_rewind: V('bv_ouroboros_ult_2', R.T('bossVoice.bv_ouroboros_ult_2')), eb_tail_devour: V('bv_ouroboros_ult_3', R.T('bossVoice.bv_ouroboros_ult_3')) },
      defeat: [V('bv_ouroboros_defeat_1', R.T('bossVoice.bv_ouroboros_defeat_1'))],
    },
    b_tamer: {
      start: [V('bv_tamer_start_1', R.T('bossVoice.bv_tamer_start_1'))],
      enrage: [V('bv_tamer_enrage_1', R.T('bossVoice.bv_tamer_enrage_1'))],
      defeat: [V('bv_tamer_defeat_1', R.T('bossVoice.bv_tamer_defeat_1'))],
    },
    b_sister_elder: {
      start: [V('bv_sister_elder_start_1', R.T('bossVoice.bv_sister_elder_start_1'))],
      enrage: [V('bv_sister_elder_enrage_1', R.T('bossVoice.bv_sister_elder_enrage_1'))],
      defeat: [V('bv_sister_elder_defeat_1', R.T('bossVoice.bv_sister_elder_defeat_1'))],
    },
    b_armorman: {
      start: [V('bv_armorman_start_1', R.T('bossVoice.bv_armorman_start_1'))],
      enrage: [V('bv_armorman_enrage_1', R.T('bossVoice.bv_armorman_enrage_1'))],
      ult: { eb_barga_bash: V('bv_armorman_ult_1', R.T('bossVoice.bv_armorman_ult_1')) },
      defeat: [V('bv_armorman_defeat_1', R.T('bossVoice.bv_armorman_defeat_1'))],
    },
    b_zakuro: {
      start: [V('bv_zakuro_start_1', R.T('bossVoice.bv_zakuro_start_1'))],
      enrage: [V('bv_zakuro_enrage_1', R.T('bossVoice.bv_zakuro_enrage_1'))],
      ult: { eb_zakuro_iai: V('bv_zakuro_ult_1', R.T('bossVoice.bv_zakuro_ult_1')) },
      defeat: [V('bv_zakuro_defeat_1', R.T('bossVoice.bv_zakuro_defeat_1'))],
    },
    b_hawk_chief: {
      start: [V('bv_hawk_chief_start_1', R.T('bossVoice.bv_hawk_chief_start_1'))],
      enrage: [V('bv_hawk_chief_enrage_1', R.T('bossVoice.bv_hawk_chief_enrage_1'))],
      ult: { eb_hawk_storm: V('bv_hawk_chief_ult_1', R.T('bossVoice.bv_hawk_chief_ult_1')) },
      defeat: [V('bv_hawk_chief_defeat_1', R.T('bossVoice.bv_hawk_chief_defeat_1'))],
    },
    b_frost_admiral: {
      start: [V('bv_frost_admiral_start_1', R.T('bossVoice.bv_frost_admiral_start_1'))],
      enrage: [V('bv_frost_admiral_enrage_1', R.T('bossVoice.bv_frost_admiral_enrage_1'))],
      ult: { eb_admiral_cannon: V('bv_frost_admiral_ult_1', R.T('bossVoice.bv_frost_admiral_ult_1')) },
      defeat: [V('bv_frost_admiral_defeat_1', R.T('bossVoice.bv_frost_admiral_defeat_1'))],
    },
  };
})(window.RPG);
