/**
 * Engine Core — foundational utilities with ZERO engine-internal imports.
 * External modules (events.js, market.js, official.js, advanced.js) import from here
 * to break the circular dependency chain.
 */

import { ic } from '../icons.js';

// === Money tracking helper (gross income/expense for monthly summary) ===
export function addMoney(state, amount) {
  state.money += amount;
  if (amount > 0) state._monthIncome = (state._monthIncome || 0) + amount;
  else if (amount < 0) state._monthExpense = (state._monthExpense || 0) + Math.abs(amount);
}

// === Crisis counter: max 2 simultaneous economic crises ===
export function activeCrisisCount(s) {
  let count = 0;
  if (s.recessionTurnsLeft > 0) count++;
  if (s.advanced?.stagflationTurnsLeft > 0) count++;
  if (s.advanced?.debtCrisisActive) count++;
  return count;
}

// === Calendar ===
export function getCalendarMonth(turn) { return ((turn + 6) % 12) + 1; } // turn0=Jul
export function getAge(turn) { return 18 + Math.floor(turn / 12); }

export function getLifeStage(turn) {
  if (turn <= 1) return 'summer';
  if (turn <= 49) return 'university';
  return 'work';
}

export function getLifeStageLabel(turn, state) {
  const stage = getLifeStage(turn);
  if (stage === 'summer') return '高考后暑假';
  if (stage === 'university') {
    const yr = Math.floor((turn - 2) / 12) + 1;
    return `大${['一', '二', '三', '四'][Math.min(yr - 1, 3)]}`;
  }
  if (state?.fullTimeDoujin) {
    const m = state.doujinMonths || 1;
    return `全职同人第${m}月`;
  }
  if (state?.unemployed) return `失业中`;
  return `工作第${Math.floor((turn - 50) / 12) + 1}年`;
}

export function getTimeLabel(turn) {
  const m = getCalendarMonth(turn);
  const emoji = m >= 3 && m <= 5 ? ic('flower-lotus') : m >= 6 && m <= 8 ? ic('sun') : m >= 9 && m <= 11 ? ic('leaf') : ic('snowflake');
  return `${emoji} ${getAge(turn)}岁 · ${getLifeStageLabel(turn)} · ${m}月`;
}

// === Time Computation ===
export function getBaseTime(turn) {
  const stage = getLifeStage(turn);
  const m = getCalendarMonth(turn);
  if (stage === 'summer') return 9;
  if (stage === 'university') {
    if (m === 6 || m === 12 || m === 1) return 3; // exam
    if (m === 7 || m === 8 || m === 2) return 8;   // break
    return 5;
  }
  const wy = (turn - 50) / 12;
  return Math.max(2, Math.round(3.5 - wy * 0.15));
}

export function computeEffectiveTime(turn, debuffs) {
  let t = getBaseTime(turn);
  for (const d of debuffs) t += d.delta;
  return Math.max(0, Math.min(10, t));
}

// === Creative Skill: Learning by Doing (Arrow 1962) ===
const SKILL_THRESHOLDS = [0, 30, 100, 300, 800];

export function getCreativeSkill(state) {
  let exp = state.skillExp;
  if (exp == null) {
    exp = migrateSkillExp(state);
    state.skillExp = exp;
  }
  for (let i = SKILL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (exp >= SKILL_THRESHOLDS[i]) {
      if (i >= SKILL_THRESHOLDS.length - 1) {
        const over = exp - SKILL_THRESHOLDS[i];
        return Math.round(Math.min(5.0, 4 + over / (over + 400)) * 10) / 10;
      }
      const base = SKILL_THRESHOLDS[i];
      const next = SKILL_THRESHOLDS[i + 1];
      return Math.round((i + (exp - base) / (next - base)) * 10) / 10;
    }
  }
  return 0;
}

function migrateSkillExp(state) {
  const cumulative = (state.totalHVP || 0) * 3 + (state.totalLVP || 0);
  if (cumulative === 0) return 0;
  const oldSkill = Math.min(4.0, Math.log2(1 + cumulative));
  const level = Math.floor(Math.min(oldSkill, 4));
  const frac = oldSkill - level;
  if (level >= SKILL_THRESHOLDS.length - 1) {
    const cf = Math.min(frac, 0.95);
    return SKILL_THRESHOLDS[level] + 400 * cf / (1 - cf);
  }
  return SKILL_THRESHOLDS[level] + frac * (SKILL_THRESHOLDS[level + 1] - SKILL_THRESHOLDS[level]);
}

export function getSkillEffects(skill) {
  return {
    costReduction: Math.min(0.20, skill * 0.03),
    repBonus:      1 + Math.min(0.5, skill * 0.08),
    soloHVPMonths: skill >= 4 ? 2 : 3,
    breakthroughChance: Math.min(0.25, skill * 0.025),
  };
}

export function getSkillLabel(skill) {
  if (skill < 1) return '入门';
  if (skill < 2) return '初学';
  if (skill < 3) return '熟练';
  if (skill < 4) return '精通';
  return '大师';
}

export function getRealityDrain(turn) {
  const stage = getLifeStage(turn);
  if (stage === 'summer') return 0;
  if (stage === 'university') return 0.6 + Math.floor((turn - 2) / 12) * 0.2;
  return 2.0 + ((turn - 50) / 12) * 0.3;
}

export function applyPassionDecay(turn, rawAmount) {
  const yearsIn = turn / 12;
  const mult = Math.max(0.45, 1 - yearsIn * 0.03);
  return Math.max(1, Math.round(rawAmount * mult));
}

// === Reputation helper ===
export function addReputation(state, rawGain) {
  if (rawGain <= 0) { state.reputation = Math.max(0, state.reputation + rawGain); return rawGain; }
  const factor = 1 / Math.sqrt(1 + 2 * state.reputation);
  const actual = rawGain * factor;
  state.reputation += actual;
  return actual;
}
