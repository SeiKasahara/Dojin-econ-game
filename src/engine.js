/**
 * Game Engine — 同人社团物语 v4
 * 
 */

import { createMarketState, tickMarket, getCompetitionModifier } from './market.js';
import { createOfficialState, tickOfficial, getSecondHandModifier, recordPlayerWork } from './official.js';
import { createAdvancedState, tickAdvanced, getAdvancedCostMod, getAdvancedSalesMod, getSignalCost, ADVANCED_EVENTS } from './advanced.js';

// === Crisis counter: max 2 simultaneous economic crises ===
export function activeCrisisCount(s) {
  let count = 0;
  if (s.recessionTurnsLeft > 0) count++;
  if (s.advanced?.stagflationTurnsLeft > 0) count++;
  if (s.advanced?.debtCrisisActive) count++;
  return count;
}

// === Calendar ===
function getCalendarMonth(turn) { return ((turn + 6) % 12) + 1; } // turn0=Jul
export function getAge(turn) { return 18 + Math.floor(turn / 12); }

export function getLifeStage(turn) {
  if (turn <= 1) return 'summer';
  if (turn <= 49) return 'university';
  return 'work';
}

export function getLifeStageLabel(turn) {
  const stage = getLifeStage(turn);
  if (stage === 'summer') return '高考后暑假';
  if (stage === 'university') {
    const yr = Math.floor((turn - 2) / 12) + 1;
    return `大${['一', '二', '三', '四'][Math.min(yr - 1, 3)]}`;
  }
  return `工作第${Math.floor((turn - 50) / 12) + 1}年`;
}

export function getTimeLabel(turn) {
  const m = getCalendarMonth(turn);
  const emoji = m >= 3 && m <= 5 ? '🌸' : m >= 6 && m <= 8 ? '☀️' : m >= 9 && m <= 11 ? '🍂' : '❄️';
  return `${emoji} ${getAge(turn)}岁 · ${getLifeStageLabel(turn)} · ${m}月`;
}

// === Time Computation ===
function getBaseTime(turn) {
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

function computeEffectiveTime(turn, debuffs) {
  let t = getBaseTime(turn);
  for (const d of debuffs) t += d.delta;
  return Math.max(0, Math.min(10, t));
}

function getRealityDrain(turn) {
  const stage = getLifeStage(turn);
  if (stage === 'summer') return 0;
  if (stage === 'university') return 1 + Math.floor((turn - 2) / 12) * 0.4;
  return 3 + ((turn - 50) / 12) * 0.6;
}

// === Partner Types ===
// feeRange: [min, max] — cost to hire. 15% chance of fee=0 (人好)
export const PARTNER_TYPES = {
  supportive: { id: 'supportive', name: '默契搭档', emoji: '😊', desc: '合作愉快，效率提升', salesBonus: 1.3, passionPerTurn: 2, dramaChance: 0, feeRange: [600, 1000] },
  demanding:  { id: 'demanding',  name: '严格搭档', emoji: '😤', desc: '要求极高，出品精良但压力大', salesBonus: 1.5, passionPerTurn: -3, dramaChance: 0.12, feeRange: [1000, 1500] },
  unreliable: { id: 'unreliable', name: '不靠谱搭档', emoji: '😅', desc: '有时很给力，有时完全消失', salesBonus: 0.9, passionPerTurn: -1, dramaChance: 0.25, feeRange: [400, 800] },
  toxic:      { id: 'toxic',      name: '有毒搭档', emoji: '😈', desc: '经常制造矛盾，但就是甩不掉...', salesBonus: 1.1, passionPerTurn: -6, dramaChance: 0.35, feeRange: [800, 1200] },
};

function rollPartnerType() {
  const r = Math.random();
  if (r < 0.50) return 'supportive';
  if (r < 0.75) return 'demanding';
  if (r < 0.92) return 'unreliable';
  return 'toxic';
}

// === Initial State ===
export function createInitialState(communityPreset = 'mid') {
  return {
    turn: 0, phase: 'action',
    passion: 90, reputation: 0.3, time: 9, money: 2000,
    infoDisclosure: 0.2,
    hasPartner: false, partnerType: null, partnerTurns: 0,
    partnerFee: 0,      // ¥ per HVP project, 0 = free
    timeDebuffs: [],
    recessionTurnsLeft: 0,
    monthlyIncome: 0,
    unemployed: false,       // true = lost job, must find new one
    jobSearchTurns: 0,       // months spent searching
    // HVP multi-turn project: null or { progress, needed, printCost }
    hvpProject: null,
    recentLVP: 0,
    lastCreativeTurn: 0,
    playerPrice: { hvp: null, lvp: null },
    // Doujin events (同人展)
    attendingEvent: null,     // current event being attended: { name, salesBoost, cost }
    availableEvents: [],      // events available this month
    // Market ecosystem (Phase 2)
    market: createMarketState(communityPreset),
    // Official IP & secondhand (Phase 3)
    official: createOfficialState(),
    // Advanced: stagflation, AI, network, Kirzner (Phase 4+5)
    advanced: createAdvancedState(),
    // Event frequency tracking
    eventCounts: {},
    scheduledFired: {},
    // Cumulative
    totalHVP: 0, totalLVP: 0, totalRevenue: 0, totalSales: 0, maxReputation: 0.3,
    lastResult: null, lastEvent: null,
    achievements: [], gameOverReason: '',
  };
}

// === Actions ===
// Time is monthly leisure: 0-10 scale (10=entire month free, 0=no free time)
// HVP is multi-turn: solo 3 months, with partner 2 months
export const ACTIONS = {
  hvp:         { id: 'hvp',         name: '创作同人本', emoji: '📖', type: 'hvp',
                 costLabel: '热情-15/月 印刷¥2500~3000 需闲暇≥4', requires: { passion: 15, time: 4 } },
  lvp:         { id: 'lvp',         name: '制作谷子',   emoji: '🔑', type: 'lvp',
                 costLabel: '热情-8 资金-200 需闲暇≥2', requires: { passion: 10, time: 2 } },
  rest:        { id: 'rest',        name: '休息充电',   emoji: '☕', type: 'rest',
                 costLabel: '热情+15~25', requires: {} },
  promote_light: { id: 'promote_light', name: '轻度宣发', emoji: '📢', type: 'promote',
                   costLabel: '热情-3 小幅提升信息', requires: { passion: 3, time: 1 }, promoteIntensity: 'light' },
  promote_heavy: { id: 'promote_heavy', name: '全力宣发', emoji: '📣', type: 'promote',
                   costLabel: '热情-12 大幅提升信息 需闲暇≥3', requires: { passion: 10, time: 3 }, promoteIntensity: 'heavy' },
  findPartner: { id: 'findPartner', name: '寻找搭档',   emoji: '🤝', type: 'social',
                 costLabel: '热情-3 搭档有稿费成本', requires: { passion: 3, time: 2 } },
  partTimeJob: { id: 'partTimeJob', name: '普通打工',   emoji: '🏪', type: 'work',
                 costLabel: '热情-8 赚¥300~500 仅学生/失业', requires: { passion: 5, time: 3 } },
  freelance:   { id: 'freelance',   name: '接稿赚钱',   emoji: '🎨', type: 'freelance',
                 costLabel: '热情-12 收入看声誉 时间看状态', requires: { passion: 8, time: 2 } },
  attendEvent: { id: 'attendEvent', name: '参加同人展', emoji: '🎪', type: 'attendEvent',
                 costLabel: '需有同人展·路费·闲暇≥3', requires: { passion: 5, time: 3 } },
  jobSearch:   { id: 'jobSearch',   name: '找工作',     emoji: '💼', type: 'jobSearch',
                 costLabel: '热情-10 面试奔波', requires: { passion: 5 } },
};

// Dynamic action info (for UI)
export function getActionDisplay(actionId, state) {
  const base = ACTIONS[actionId];
  if (!base) return null;
  if (actionId === 'rest') {
    const yearsIn = state.turn / 12;
    const eff = Math.max(30, Math.round((1 - yearsIn * 0.1) * 100));
    const idle = state.turn - state.lastCreativeTurn;
    let extra = '';
    if (idle >= 3) extra = ` ⚠️已${idle}月未活动`;
    return { ...base, costLabel: `恢复效率${eff}%${extra}` };
  }
  if (actionId === 'jobSearch') {
    return { ...base, costLabel: `已找${state.jobSearchTurns}月 成功率${Math.round(Math.min(85, (30 + state.jobSearchTurns * 10) * (state.recessionTurnsLeft > 0 ? 0.5 : 1)))}%` };
  }
  if (actionId === 'freelance') {
    const tc = getFreelanceTimeCost(state);
    const label = state.unemployed ? '失业接稿' : getLifeStage(state.turn) === 'university' ? '课余接稿' : '下班接稿';
    return { ...base, costLabel: `热情-12 需闲暇≥${tc} ${label}` };
  }
  if (actionId === 'partTimeJob') {
    const stage = getLifeStage(state.turn);
    if (stage === 'work' && !state.unemployed) return { ...base, costLabel: '仅学生/失业可用' };
    return base;
  }
  if (actionId === 'attendEvent') {
    if (state.totalHVP === 0 && state.totalLVP === 0) {
      return { ...base, costLabel: '没有作品可卖！先创作' };
    }
    if (!state.availableEvents || state.availableEvents.length === 0) {
      return { ...base, costLabel: '本月无同人展' };
    }
    const evts = state.availableEvents;
    const best = evts[0];
    return { ...base, costLabel: `${best.name}@${best.city} 路费¥${best.travelCost} 销量×${best.salesBoost}` };
  }
  if (actionId === 'promote_light' || actionId === 'promote_heavy') {
    const sigCost = state.advanced ? getSignalCost(state.advanced) : 1.0;
    const sigLabel = sigCost > 1.2 ? ` 通胀×${sigCost.toFixed(1)}` : '';
    return { ...base, costLabel: base.costLabel + sigLabel };
  }
  if (actionId === 'hvp') {
    if (state.hvpProject) {
      const p = state.hvpProject;
      return { ...base, name: `继续创作同人本`, costLabel: `进度 ${p.progress}/${p.needed} · 热情-15 需闲暇≥4` };
    }
    const solo = '独自:3个月';
    const partner = state.hasPartner ? ' 搭档:2个月' : '';
    return { ...base, costLabel: `${solo}${partner} 热情-15/月 需闲暇≥4` };
  }
  return base;
}

// Freelance time cost depends on life situation
export function getFreelanceTimeCost(state) {
  if (state.unemployed) return 2;                        // 失业：时间多，闲暇消耗少
  if (getLifeStage(state.turn) === 'university') return 3; // 学生：中等
  return 5;                                               // 在职：下班后还要接稿，消耗大
}

export function canPerformAction(state, actionId) {
  const r = ACTIONS[actionId]?.requires;
  if (!r) return false;
  // Unemployed: can only rest, find job, or freelance
  if (state.unemployed) {
    if (!['rest', 'jobSearch', 'freelance'].includes(actionId)) return false;
  }
  // jobSearch: only when unemployed
  if (actionId === 'jobSearch' && !state.unemployed) return false;
  // partTimeJob: only students or unemployed
  if (actionId === 'partTimeJob') {
    const stage = getLifeStage(state.turn);
    if (stage === 'work' && !state.unemployed) return false;
  }
  // attendEvent: need events available AND have completed works to sell
  if (actionId === 'attendEvent') {
    if (!state.availableEvents || state.availableEvents.length === 0) return false;
    if (state.totalHVP === 0 && state.totalLVP === 0) return false;
  }
  if (r.passion && state.passion < r.passion) return false;
  // Freelance: dynamic time requirement
  if (actionId === 'freelance') {
    if (state.time < getFreelanceTimeCost(state)) return false;
  } else {
    if (r.time && state.time < r.time) return false;
  }
  return true;
}

// === Doujin Event Generation (同人展) ===
const EVENT_CITIES = ['本市', '邻市', '省会', '一线城市', '异地'];
const EVENT_TRAVEL_COST = { '本市': 50, '邻市': 200, '省会': 500, '一线城市': 800, '异地': 1200 };
const EVENT_NAMES_BIG = ['CP大展', '同人祭', '创作者之夜', '超级同人嘉年华'];
const EVENT_NAMES_SMALL = ['同好交流会', '小型贩售会', '创作者市集', '主题Only'];

export function generateEvents(state) {
  const cs = state.market ? state.market.communitySize : 10000;
  const month = ((state.turn + 6) % 12) + 1;
  const events = [];

  // Big events: ~3/year for small communities, more for large
  // Typically in Jan(寒假), May(五一), Aug(暑假), Oct(国庆)
  const isBigMonth = [1, 5, 8, 10].includes(month);
  if (isBigMonth) {
    const city = cs > 15000 ? EVENT_CITIES[3] : cs > 5000 ? EVENT_CITIES[2] : EVENT_CITIES[1];
    events.push({
      name: EVENT_NAMES_BIG[Math.floor(Math.random() * EVENT_NAMES_BIG.length)],
      city,
      travelCost: EVENT_TRAVEL_COST[city],
      salesBoost: 3.0,  // face-to-face: I→1, huge conversion boost
      reputationBoost: 0.3,
      passionBoost: 8,
      size: 'big',
    });
  }

  // Small events: frequency scales with community size
  // Small community: ~1/quarter, Large: nearly monthly
  const smallEventChance = cs > 15000 ? 0.7 : cs > 8000 ? 0.5 : cs > 3000 ? 0.3 : 0.1;
  if (Math.random() < smallEventChance) {
    const city = Math.random() < 0.6 ? '本市' : '邻市';
    events.push({
      name: EVENT_NAMES_SMALL[Math.floor(Math.random() * EVENT_NAMES_SMALL.length)],
      city,
      travelCost: EVENT_TRAVEL_COST[city],
      salesBoost: 1.8,
      reputationBoost: 0.1,
      passionBoost: 3,
      size: 'small',
    });
  }

  // Occasionally: distant but high-value event
  if (cs > 10000 && Math.random() < 0.08) {
    events.push({
      name: '全国同人盛典',
      city: '异地',
      travelCost: EVENT_TRAVEL_COST['异地'],
      salesBoost: 5.0,
      reputationBoost: 0.5,
      passionBoost: 12,
      size: 'mega',
    });
  }

  return events;
}

// === Community Feedback B (Inverted-U) ===
function calculateFeedback(state) {
  const theta = state.reputation, t = state.turn;
  const num = Math.pow(theta, 1.5);
  const den = 1 + 0.5 * Math.pow(theta, 2.5);
  return Math.round(0.5 * 30 * Math.pow(0.997, t) * num / den * 10) / 10;
}

// === Sales (Translated CES model from consumer.md) ===
// Q_H* = γ_H + β_H^σ · p_H^(-σ) / Σ · m^s
// Simplified: total market demand split among N_HVP creators by reputation share
function calculateSales(actionId, state) {
  const communitySize = state.market ? state.market.communitySize : 10000;
  const alphaMod = state.market ? state.market.consumerAlpha : 1.0;

  // --- Translated CES: market-level demand ---
  // γ_H = committed consumption (底线需求, always exists)
  // m^s = supernumerary income available for doujin spending
  const gamma_H = 5;   // committed HVP demand per 1000 consumers/month (units)
  const gamma_L = 15;   // committed LVP demand per 1000 consumers/month
  const beta_H = 0.72;  // supernumerary allocation to HVP
  const consumerBudget = state.recessionTurnsLeft > 0 ? 60 : 100; // m^s per 1000 consumers
  const m_s = Math.max(0, consumerBudget - gamma_H * 50 - gamma_L * 15); // supernumerary after committed

  const type = actionId === 'lvp' ? 'lvp' : 'hvp';
  const isHVP = type === 'hvp';

  // Total market demand for this type (per 1000 consumers)
  const totalDemand = isHVP
    ? gamma_H + beta_H * m_s / 50          // committed + supernumerary allocation
    : gamma_L + (1 - beta_H) * m_s / 15;   // B-type gets rest

  // Scale by community size (per 1000 consumers)
  const marketDemand = totalDemand * (communitySize / 1000) * alphaMod;

  // --- Player's share: depends on reputation vs competition ---
  // Player's share = α_player / Σα_all (sub-level CES share)
  const nCompetitors = isHVP ? (state.market?.nHVP || 9) : (state.market?.nLVP || 55);
  // Average NPC reputation ~2.0 for HVP, ~0.5 for LVP
  const npcAvgRep = isHVP ? 2.0 : 0.5;
  const totalAlpha = nCompetitors * npcAvgRep + state.reputation;
  const playerShare = totalAlpha > 0 ? state.reputation / totalAlpha : 0.1;

  // --- Information disclosure: conversion from awareness to purchase ---
  const baseConversion = 0.20;
  const infoBonus = state.infoDisclosure * 0.50;
  const conversion = Math.min(0.95, baseConversion + infoBonus);

  // --- Doujin event boost (face-to-face: I→1, search cost→0) ---
  const eventBoost = state.attendingEvent ? state.attendingEvent.salesBoost : 1.0;

  // --- Other modifiers ---
  const partnerMult = state.hasPartner ? (PARTNER_TYPES[state.partnerType]?.salesBonus || 1) : 1;
  const shMod = getSecondHandModifier(state.official, type);
  const advMod = state.advanced ? getAdvancedSalesMod(state.advanced, type) : 1.0;
  const noise = 0.85 + Math.random() * 0.3;

  // --- Calculate final sales ---
  const rawSales = marketDemand * playerShare * conversion * partnerMult * shMod * advMod * eventBoost * noise;
  const sales = Math.max(1, Math.round(rawSales));

  // === Full breakdown for educational display ===
  const result = {
    communitySize,
    // Translated CES layer
    gamma: isHVP ? gamma_H : gamma_L,
    supernumerary: Math.round(m_s),
    marketDemand: Math.round(marketDemand),
    // Sub-CES layer
    playerRep: state.reputation.toFixed(1),
    nCompetitors,
    playerShare: Math.round(playerShare * 1000) / 10, // percentage with 1 decimal
    awareness: Math.round(marketDemand * playerShare),
    // Conversion
    baseConversion: 20,
    infoBonus: Math.round(infoBonus * 100),
    conversion: Math.round(conversion * 100),
    // Modifiers
    partnerMult: Math.round(partnerMult * 100),
    recessionActive: state.recessionTurnsLeft > 0,
    shModPct: Math.round(shMod * 100),
    advMod: Math.round(advMod * 100),
    eventBoost: Math.round(eventBoost * 100),
    noise: Math.round(noise * 100),
    alphaMod: Math.round(alphaMod * 100),
  };

  if (isHVP) {
    result.hvpSales = sales;
    result.hvpPrice = state.playerPrice.hvp || (40 + Math.floor(Math.random() * 20));
  } else {
    result.lvpSales = sales;
    result.lvpPrice = state.playerPrice.lvp || (12 + Math.floor(Math.random() * 8));
  }
  result.totalRevenue = (result.hvpSales || 0) * (result.hvpPrice || 0) + (result.lvpSales || 0) * (result.lvpPrice || 0);
  return result;
}

// === Supply-Demand chart data ===
export function getSupplyDemandData(state, sales) {
  const Pmax = 20 + state.reputation * 15;
  const slope = 0.8 - state.infoDisclosure * 0.4;
  const Qsupply = sales?.hvpSales || sales?.lvpSales || 5;
  return { Pmax, slope, Qsupply, Peq: Math.max(5, Pmax - slope * Qsupply), Qmax: Math.ceil(Pmax / slope) + 5, reputation: state.reputation, infoDisclosure: state.infoDisclosure, recessionActive: state.recessionTurnsLeft > 0 };
}

// ============================================================
// EVENTS SYSTEM: Scheduled (fixed) + Limited (capped) + Random
// ============================================================

// --- Scheduled events: fire at specific turns, guaranteed ---
const SCHEDULED_EVENTS = [
  // 社团招新: September of Y1 and Y2
  {
    turns: [2, 14],
    event: {
      id: 'uni_club', emoji: '🎭', title: '社团招新',
      desc: '大学社团招新季！你加入了创作相关社团，认识了很多同好。',
      effect: '声誉+0.2 热情+5', effectClass: 'positive',
      apply: (s) => { s.reputation += 0.2; s.passion = Math.min(100, s.passion + 5); },
      tip: '社群网络扩展降低了协作搜寻成本。在Producer模型中，p_collab(θ)随社交网络规模递增——认识的人越多，越容易找到搭档。',
    },
  },
  // 期末考试: every December and June during university
  {
    condition: (turn) => getLifeStage(turn) === 'university' && (getCalendarMonth(turn) === 12 || getCalendarMonth(turn) === 6),
    event: {
      id: 'uni_exam', emoji: '📝', title: '期末考试周',
      desc: '期末考试来了！接下来要全力复习，创作只能暂停...',
      effect: '时间-3h（持续2回合）', effectClass: 'negative',
      apply: (s) => { s.timeDebuffs.push({ id: 'exam', reason: '期末考试', turnsLeft: 2, delta: -3 }); s.time = computeEffectiveTime(s.turn, s.timeDebuffs); },
      tip: '考试是周期性的外生时间冲击。大学生创作者的产出呈明显的学期周期——寒暑假是同人产出的高峰期，考试月是低谷。',
    },
  },
  // 毕业
  {
    turns: [49],
    event: {
      id: 'graduation', emoji: '🎓', title: '毕业了',
      desc: '四年大学生活结束了。从此以后，同人创作变成了"业余爱好"。工作会给你收入，但空闲时间将大幅减少...',
      effect: '热情-5 开始工作生涯', effectClass: 'neutral',
      apply: (s) => { s.passion -= 5; },
      tip: '进入工作后，时间禀赋T永久性下降。Q23显示51.2%的创作者因"现实太忙"退坑。工作后的同人创作者是真正的幸存者。',
    },
  },
];

function getScheduledEvent(state) {
  for (const se of SCHEDULED_EVENTS) {
    const key = `${se.event.id}_${state.turn}`;
    if (state.scheduledFired[key]) continue;

    let shouldFire = false;
    if (se.turns && se.turns.includes(state.turn)) shouldFire = true;
    if (se.condition && se.condition(state.turn)) shouldFire = true;

    if (shouldFire) {
      state.scheduledFired[key] = true;
      return se.event;
    }
  }
  return null;
}

// --- Random events with frequency caps ---
const RANDOM_EVENTS = [
  {
    id: 'boom', emoji: '🔥', title: '圈内大佬出圈了！',
    desc: '一位知名创作者的作品在社交媒体上爆火，整个圈子的关注度都上升了。',
    effect: '声誉+0.3 热情+10', effectClass: 'positive',
    apply: (s) => { s.reputation += 0.3; s.passion = Math.min(100, s.passion + 10); },
    tip: '在无干预的同人市场中，任何创作者的出圈都是正外部性——别人把盘子做大了，你不花任何成本就能享受流量红利。',
    weight: 12, when: () => true, maxTotal: Infinity,
  },
  {
    id: 'collapse', emoji: '💥', title: '塌方事件！',
    desc: '圈内爆发争吵，有创作者被挂，社群气氛紧张...',
    effect: '热情-15 声誉-20%', effectClass: 'negative',
    apply: (s) => { s.passion -= 15; s.reputation *= 0.8; },
    tip: '声誉是风险资产：积累越多，塌方损失的绝对值越大。20.7%的创作者因"圈内风气差"退坑。',
    weight: 8, when: () => true, maxTotal: Infinity,
  },
  // --- 家人生病：整个游戏最多1-2次 ---
  {
    id: 'family_emergency', emoji: '🏥', title: '家人生病了',
    desc: '家里突然有人生病需要照顾，接下来几个月你的空闲时间会大幅减少...',
    effect: '时间-3h（持续3回合）', effectClass: 'negative',
    apply: (s) => { s.timeDebuffs.push({ id: 'family', reason: '照顾家人', turnsLeft: 3, delta: -3 }); s.time = computeEffectiveTime(s.turn, s.timeDebuffs); },
    tip: '外生冲击可以让时间降到0。51.2%的创作者退出是因为"现实太忙"——时间约束独立于热情预算，是最硬的硬约束。',
    weight: 4, when: () => true, maxTotal: 2,
  },
  // --- 加班/赶DDL ---
  {
    id: 'overtime', emoji: '⏰', title: '连续加班/赶论文',
    desc: '这段时间完全被工作或学业占满，几乎没有私人时间...',
    effect: '时间-4h（持续2回合）', effectClass: 'negative',
    apply: (s) => { s.timeDebuffs.push({ id: 'overtime', reason: '加班/赶DDL', turnsLeft: 2, delta: -4 }); s.time = computeEffectiveTime(s.turn, s.timeDebuffs); },
    tip: '当时间T降到0时，什么创作也做不了，只能选择休息等待忙碌过去。这就是Producer模型中的"外生退出"压力。',
    weight: 7, when: () => true, maxTotal: Infinity,
  },
  // --- 假期 ---
  {
    id: 'holiday', emoji: '🌴', title: '一段悠闲时光',
    desc: '难得的闲暇，可以专心创作。',
    effect: '时间+2h(2回合) 热情+8', effectClass: 'positive',
    apply: (s) => { s.timeDebuffs.push({ id: 'holiday', reason: '悠闲时光', turnsLeft: 2, delta: 2 }); s.time = computeEffectiveTime(s.turn, s.timeDebuffs); s.passion = Math.min(100, s.passion + 8); },
    tip: 'HVP创作需要"成块的连续时间"。17.6%的创作者表示"有连续充裕的空闲时间就会做"。',
    weight: 10, when: () => true, maxTotal: Infinity,
  },
  // --- 同人展 ---
  {
    id: 'doujin_event', emoji: '🎪', title: '同人展开催！',
    desc: '本地同人展即将举办！面对面贩售，信息披露自动拉满。',
    effect: '声誉+0.2 资金+200 信息↑', effectClass: 'positive',
    apply: (s) => { s.reputation += 0.2; s.money += 200; s.infoDisclosure = Math.min(1, s.infoDisclosure + 0.3); },
    tip: '同人展是信息密集的面对面交易——消费者直接翻阅实物(I→1)。Stigler理论中"搜寻成本→0"的场景，声誉的代理作用被削弱。',
    weight: 8, when: () => true, maxTotal: Infinity,
  },
  // --- 经济下行：长期影响2-3年，整个游戏最多1-2次 ---
  {
    id: 'recession', emoji: '📉', title: '经济下行',
    desc: '宏观经济进入下行周期，消费者的可支配休闲资金持续减少。这不是一时的困难，而是持续数年的寒冬...',
    effect: '销量-30%（持续2~3年！）', effectClass: 'negative',
    apply: (s) => {
      const duration = 24 + Math.floor(Math.random() * 12); // 24-36个月
      s.recessionTurnsLeft = duration;
    },
    tip: '经济下行不是一次性冲击。A类制品是弱奢侈品(收入弹性≈1.06)，超量消费被持续压缩。承诺消费γ提供底线保护，但上限被大幅削减。持续衰退可能使管道可达性条件翻转。',
    weight: 3,
    when: (s) => s.recessionTurnsLeft <= 0 && s.turn > 12 && activeCrisisCount(s) < 2,
    maxTotal: 2,
  },
  // --- AI冲击 ---
  {
    id: 'ai', emoji: '🤖', title: 'AI冲击波',
    desc: '大量AI生成的内容涌入市场，竞争加剧...',
    effect: '声誉-0.15', effectClass: 'neutral',
    apply: (s) => { s.reputation = Math.max(0, s.reputation - 0.15); },
    tip: 'AI把"执行劳动"无限贬值，但无法取代企业家的敏锐度——发现未被满足需求的能力。人创的不完美性反而成了稀缺品。',
    weight: 5, when: (s) => s.turn > 18, maxTotal: Infinity,
  },
  // --- 收到长评 ---
  {
    id: 'fanmail', emoji: '💌', title: '收到热情长评！',
    desc: '一位读者写了很长的感想，详细描述了你的作品给TA带来的感动...',
    effect: '热情+15', effectClass: 'positive',
    apply: (s) => { s.passion = Math.min(100, s.passion + 15); },
    tip: '社群反馈B是热情预算W的重要补充来源。一封走心的长评可以抵消很多现实消耗。70.7%的创作者对数据低迷有高韧性——内在动机是核心驱动力。',
    weight: 10, when: (s) => s.reputation > 1, maxTotal: Infinity,
  },
  // --- 印刷成本上涨 ---
  {
    id: 'inflation', emoji: '💸', title: '印刷成本上涨',
    desc: '原材料涨价，印刷和制作成本提高了...',
    effect: '资金-400', effectClass: 'negative',
    apply: (s) => { s.money -= 400; },
    tip: '通胀从两个方向夹击多样性：降低LVP声誉稳态θ*，同时抬高HVP准入门槛。',
    weight: 5, when: () => true, maxTotal: Infinity,
  },
  // --- 感情变动：大学期间最多2次 ---
  {
    id: 'uni_breakup', emoji: '💔', title: '感情变动',
    desc: '一段感情的开始或结束占据了你大量的心理能量...',
    effect: '热情-12', effectClass: 'negative',
    apply: (s) => { s.passion -= 12; },
    tip: '热情预算W不仅被创作消耗，还被生活中的情绪事件消耗。这是Producer模型中精力消耗E(k,t)的外生部分。',
    weight: 4, when: (s) => getLifeStage(s.turn) === 'university', maxTotal: 2,
  },
  // --- 工作：升职加薪 ---
  {
    id: 'work_raise', emoji: '📈', title: '升职加薪！',
    desc: '工作表现不错，获得了加薪。但责任更重，时间更少...',
    effect: '资金+1000 时间-1h（永久）', effectClass: 'neutral',
    apply: (s) => { s.money += 1000; s.timeDebuffs.push({ id: 'promotion', reason: '升职加责', turnsLeft: 999, delta: -1 }); s.time = computeEffectiveTime(s.turn, s.timeDebuffs); },
    tip: '高收入者的时间机会成本更高。Stigler理论：收入越高→搜寻机会成本越高→更依赖声誉做决策。',
    weight: 4, when: (s) => getLifeStage(s.turn) === 'work', maxTotal: 3,
  },
  // --- 工作：996 ---
  {
    id: 'work_996', emoji: '🏢', title: '996加班季',
    desc: '项目紧急，公司要求全员加班。几乎没有私人时间...',
    effect: '时间-4h(3回合) 资金+500', effectClass: 'negative',
    apply: (s) => { s.timeDebuffs.push({ id: '996', reason: '996加班', turnsLeft: 3, delta: -4 }); s.time = computeEffectiveTime(s.turn, s.timeDebuffs); s.money += 500; },
    tip: '滞胀特征：需要更多工作时间维持生活→T减少。直接打击HVP准入条件中的时间约束。',
    weight: 7, when: (s) => getLifeStage(s.turn) === 'work', maxTotal: Infinity,
  },
];

// === Roll Events ===
export function rollEvent(state) {
  // 1. Check scheduled events first (always fire)
  const scheduled = getScheduledEvent(state);
  if (scheduled) return { ...scheduled, isScheduled: true };

  // 2. Random events: 35% chance after turn 1
  if (state.turn < 1 || Math.random() > 0.35) return null;

  // Filter by condition and frequency cap
  const allEvents = [...RANDOM_EVENTS, ...ADVANCED_EVENTS];
  const eligible = allEvents.filter(e => {
    if (!e.when(state)) return false;
    const count = state.eventCounts[e.id] || 0;
    if (count >= e.maxTotal) return false;
    return true;
  });
  if (eligible.length === 0) return null;

  const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const event of eligible) {
    roll -= event.weight;
    if (roll <= 0) return event;
  }
  return eligible[0];
}

export function applyEvent(state, event) {
  event.apply(state);
  // Track frequency
  if (event.id) state.eventCounts[event.id] = (state.eventCounts[event.id] || 0) + 1;
  state.reputation = Math.max(0, state.reputation);
  state.passion = Math.max(0, Math.min(100, state.passion));
  if (state.passion <= 0) {
    state.phase = 'gameover';
    state.gameOverReason = '一系列打击让你的创作热情消磨殆尽...';
  }
}

// === Execute Turn ===
export function executeTurn(state, actionId) {
  const action = ACTIONS[actionId];
  const result = { action: actionId, actionName: action.name, actionEmoji: action.emoji, deltas: [], salesInfo: null, supplyDemand: null, feedback: 0, tip: null, partnerDrama: null };

  // --- Process action ---
  if (action.type === 'rest') {
    // Rest effectiveness decays with years in the hobby
    const yearsIn = state.turn / 12;
    const basRestore = 15 + Math.floor(Math.random() * 10); // 15~25
    const fatigueMult = Math.max(0.3, 1 - yearsIn * 0.1);   // Y0=100%, Y2=80%, Y5=50%, Y7+=30%
    const restore = Math.max(3, Math.round(basRestore * fatigueMult));
    state.passion = Math.min(100, state.passion + restore);
    result.deltas.push({ icon: '❤️', label: '热情恢复', value: `+${restore}`, positive: true });
    if (fatigueMult < 0.8) {
      result.deltas.push({ icon: '😮‍💨', label: '长期疲惫', value: `恢复效率${Math.round(fatigueMult * 100)}%`, positive: false });
    }
    const decay = state.reputation * 0.02;
    state.reputation = Math.max(0, state.reputation - decay);
    if (decay > 0.01) result.deltas.push({ icon: '⭐', label: '声誉自然衰减', value: `-${decay.toFixed(2)}`, positive: false });
    result.tip = TIPS.rest;

  } else if (action.type === 'promote') {
    const intensity = action.promoteIntensity || 'light';
    const passionCost = intensity === 'heavy' ? 12 : 3;
    state.passion -= passionCost;
    // Base gain by intensity
    const rawGain = intensity === 'heavy'
      ? 0.35 + Math.random() * 0.15   // heavy: 35%~50% base
      : 0.12 + Math.random() * 0.08;  // light: 12%~20% base
    // Signal inflation (Spence): diminishes gain but never below a floor
    const sigCost = state.advanced ? getSignalCost(state.advanced) : 1.0;
    const scaledGain = rawGain / sigCost;
    // Guaranteed minimum: even in max signal inflation, you always get SOME visibility
    const minGain = intensity === 'heavy' ? 0.08 : 0.03;
    const gain = Math.max(minGain, scaledGain);
    state.infoDisclosure = Math.min(1, state.infoDisclosure + gain);
    result.deltas.push({ icon: '❤️', label: '精力消耗', value: `-${passionCost}`, positive: false });
    result.deltas.push({ icon: '📢', label: '信息透明度', value: `+${(gain * 100).toFixed(0)}% → ${(state.infoDisclosure * 100).toFixed(0)}%`, positive: true });
    if (sigCost > 1.2) result.deltas.push({ icon: '📣', label: '信号通胀', value: `效果${Math.round(gain / rawGain * 100)}%（保底${Math.round(minGain * 100)}%）`, positive: false });
    result.tip = intensity === 'heavy' ? TIPS.promoteHeavy : TIPS.promoteLight;

  } else if (action.type === 'social') {
    state.passion -= 3;
    result.deltas.push({ icon: '❤️', label: '精力消耗', value: '-3', positive: false });
    const prob = Math.min(0.8, state.reputation / (state.reputation + 3));
    if (Math.random() < prob) {
      const pType = rollPartnerType();
      const pt = PARTNER_TYPES[pType];
      state.hasPartner = true;
      state.partnerType = pType;
      state.partnerTurns = pType === 'unreliable' ? (1 + Math.floor(Math.random() * 3)) : (3 + Math.floor(Math.random() * 4));
      // Partner fee: 15% chance free (人好), otherwise roll from range
      const isFree = Math.random() < 0.15;
      if (isFree) {
        state.partnerFee = 0;
        result.deltas.push({ icon: pt.emoji, label: `找到了${pt.name}！`, value: `${state.partnerTurns}回合`, positive: true });
        result.deltas.push({ icon: '💝', label: '人好！不要稿费', value: '免费合作', positive: true });
      } else {
        const [fmin, fmax] = pt.feeRange;
        state.partnerFee = fmin + Math.floor(Math.random() * (fmax - fmin));
        result.deltas.push({ icon: pt.emoji, label: `找到了${pt.name}！`, value: `${state.partnerTurns}回合`, positive: pType === 'supportive' });
        result.deltas.push({ icon: '💰', label: '搭档稿费', value: `¥${state.partnerFee}/本`, positive: false });
      }
      result.deltas.push({ icon: '📝', label: pt.desc, value: '', positive: false });
      result.tip = pType === 'toxic' ? TIPS.partnerToxic : pType === 'supportive' ? TIPS.partnerFound : TIPS.partnerRisk;
    } else {
      result.deltas.push({ icon: '🤝', label: '没找到合适搭档', value: '', positive: false });
      result.tip = TIPS.partnerFail;
    }

  } else if (action.type === 'work') {
    state.passion -= 8;
    const baseWage = 300 + Math.floor(Math.random() * 200);
    const recessionCut = state.recessionTurnsLeft > 0 ? 0.6 : 1.0; // recession: jobs pay less
    const wage = Math.floor(baseWage * recessionCut);
    state.money += wage;
    result.deltas.push({ icon: '❤️', label: '打工消耗', value: '-8', positive: false });
    result.deltas.push({ icon: '💰', label: '打工收入', value: `+¥${wage}`, positive: true });
    if (recessionCut < 1) result.deltas.push({ icon: '📉', label: '经济下行压低工资', value: '-40%', positive: false });
    result.tip = TIPS.partTimeJob;

  } else if (action.type === 'freelance') {
    state.passion -= 12;
    const base = 200, repBonus = Math.floor(state.reputation * 150);
    const rawIncome = base + repBonus + Math.floor(Math.random() * 150);
    const recessionCut = state.recessionTurnsLeft > 0 ? 0.5 : 1.0; // recession: fewer commissions
    const income = Math.floor(rawIncome * recessionCut);
    state.money += income;
    const repGain = 0.02 + state.reputation * 0.01;
    state.reputation += repGain;
    result.deltas.push({ icon: '❤️', label: '接稿消耗', value: '-12', positive: false });
    result.deltas.push({ icon: '💰', label: '接稿收入', value: `+¥${income}`, positive: true });
    if (recessionCut < 1) result.deltas.push({ icon: '📉', label: '经济下行需求萎缩', value: '-50%', positive: false });
    result.deltas.push({ icon: '⭐', label: '商业声誉', value: `+${repGain.toFixed(2)}`, positive: true });
    result.tip = state.reputation >= 3 ? TIPS.freelanceHigh : TIPS.freelanceLow;

  } else if (action.type === 'attendEvent') {
    // === ATTEND DOUJIN EVENT ===
    const evt = state.attendingEvent || (state.availableEvents && state.availableEvents[0]);
    if (evt) {
      const mg = state._minigameResult; // from mini-game, or null if skipped

      if (mg) {
        // Mini-game played → use mini-game results
        state.passion -= 5;
        state.money -= evt.travelCost + mg.moneySpent;
        state.passion = Math.min(100, state.passion + mg.passionDelta);
        state.reputation += mg.reputationDelta;
        state.maxReputation = Math.max(state.maxReputation, state.reputation);
        state.attendingEvent = { ...evt, salesBoost: mg.salesMultiplier };

        result.deltas.push({ icon: '🎪', label: `${evt.name}@${evt.city}`, value: `表现${mg.performance}分`, positive: mg.performance >= 50 });
        result.deltas.push({ icon: '💰', label: '路费' + (mg.moneySpent > 0 ? '+无料费' : ''), value: `-¥${evt.travelCost + mg.moneySpent}`, positive: false });
        result.deltas.push({ icon: '👥', label: `招呼${mg.greeted}次 售出${mg.sold}份`, value: '', positive: mg.sold > 0 });
        result.deltas.push({ icon: '📈', label: '展会售卖加成', value: `×${mg.salesMultiplier}`, positive: mg.salesMultiplier >= 1.0 });
        result.deltas.push({ icon: '❤️', label: '展会热情', value: `${mg.passionDelta > 0 ? '+' : ''}${mg.passionDelta}`, positive: mg.passionDelta > 0 });
        result.deltas.push({ icon: '⭐', label: '声誉', value: `+${mg.reputationDelta.toFixed(2)}`, positive: true });
        state._minigameResult = null;
      } else {
        // Skipped mini-game → instant resolve (original behavior)
        state.passion -= 5;
        state.money -= evt.travelCost;
        state.passion = Math.min(100, state.passion + evt.passionBoost);
        state.reputation += evt.reputationBoost;
        state.maxReputation = Math.max(state.maxReputation, state.reputation);
        state.attendingEvent = evt;
        result.deltas.push({ icon: '🎪', label: `参加${evt.name}@${evt.city}`, value: '(快速结算)', positive: true });
        result.deltas.push({ icon: '💰', label: '路费', value: `-¥${evt.travelCost}`, positive: false });
        result.deltas.push({ icon: '📈', label: '下次售卖加成', value: `销量×${evt.salesBoost}`, positive: true });
      }
      result.tip = TIPS.doujinEvent;
    }

  } else if (action.type === 'jobSearch') {
    // === UNEMPLOYMENT: looking for work ===
    state.passion -= 10;
    state.jobSearchTurns++;
    result.deltas.push({ icon: '❤️', label: '面试奔波消耗', value: '-10', positive: false });
    // Base find probability: 30%, +10% per month searching, recession halves it
    const baseProb = 0.3 + state.jobSearchTurns * 0.1;
    const findProb = Math.min(0.85, state.recessionTurnsLeft > 0 ? baseProb * 0.5 : baseProb);
    if (Math.random() < findProb) {
      state.unemployed = false;
      state.jobSearchTurns = 0;
      result.deltas.push({ icon: '🎉', label: '找到工作了！', value: '恢复正常生活', positive: true });
      result.tip = TIPS.jobFound;
    } else {
      result.deltas.push({ icon: '😰', label: '还没找到工作...', value: `已找${state.jobSearchTurns}个月`, positive: false });
      if (state.recessionTurnsLeft > 0) {
        result.deltas.push({ icon: '📉', label: '经济下行增加求职难度', value: `成功率${Math.round(findProb * 100)}%`, positive: false });
      }
      result.tip = TIPS.jobSearching;
    }

  } else if (action.type === 'hvp') {
    // === MULTI-TURN HVP PROJECT ===
    state.passion -= 15; // monthly passion cost for working on book
    result.deltas.push({ icon: '❤️', label: '本月创作消耗', value: '-15', positive: false });

    if (!state.hvpProject) {
      // Start new project
      const needed = state.hasPartner ? 2 : 3;
      const printCost = 2500 + Math.floor(Math.random() * 500); // ¥2500-3000
      state.hvpProject = { progress: 1, needed, printCost };
      result.deltas.push({ icon: '📖', label: `开始创作同人本！`, value: `进度 1/${needed}`, positive: true });
      if (state.hasPartner) {
        result.deltas.push({ icon: '🤝', label: '搭档协作', value: `${needed}个月完成（省1个月）`, positive: true });
        if (state.partnerFee > 0) result.deltas.push({ icon: '💰', label: '预计搭档稿费', value: `¥${state.partnerFee}（完成时付）`, positive: false });
      }
      result.tip = TIPS.hvpStart;
    } else {
      // Continue project
      state.hvpProject.progress++;
      const p = state.hvpProject;
      if (p.progress >= p.needed) {
        // === HVP COMPLETE! ===
        const costMult = (state.recessionTurnsLeft > 0 ? 1.2 : 1.0) * getAdvancedCostMod(state.advanced);
        const printCost = Math.round(p.printCost * costMult);
        const partnerCost = state.hasPartner ? state.partnerFee : 0;
        const totalCost = printCost + partnerCost;
        state.money -= totalCost;

        result.deltas.push({ icon: '🎉', label: '同人本完成！', value: '', positive: true });
        result.deltas.push({ icon: '🖨️', label: `印刷成本${costMult > 1 ? '(经济下行+20%)' : ''}`, value: `-¥${printCost}`, positive: false });
        if (partnerCost > 0) result.deltas.push({ icon: '🤝', label: '搭档稿费', value: `-¥${partnerCost}`, positive: false });

        // Sales
        const sales = calculateSales('hvp', state);
        // Bundling bonus: if player made LVP within last 3 turns
        if (state.recentLVP > 0 && state.recentLVP <= 3) {
          const bundleLVP = Math.floor(sales.hvpSales * 1.4);
          const bundlePrice = 12 + Math.floor(Math.random() * 8);
          const bundleRev = bundleLVP * bundlePrice;
          sales.lvpSales = bundleLVP;
          sales.lvpPrice = bundlePrice;
          sales.totalRevenue += bundleRev;
          result.deltas.push({ icon: '🎯', label: `配套谷子联动售出 ${bundleLVP}个`, value: `+¥${bundleRev}`, positive: true });
        }

        result.salesInfo = sales;
        result.supplyDemand = getSupplyDemandData(state, sales);
        state.money += sales.totalRevenue;
        state.totalRevenue += sales.totalRevenue;
        state.totalHVP++;
        const profit = sales.totalRevenue - totalCost;

        result.deltas.push({ icon: '👥', label: `社群${sales.communitySize}人 → 关注${sales.awareness}人`, value: `转化率${sales.conversion}%`, positive: true });
        if (sales.infoBonus > 0) result.deltas.push({ icon: '📢', label: '信息透明度加成', value: `+${sales.infoBonus}%转化`, positive: true });
        if (sales.compMod && sales.compMod !== 100) result.deltas.push({ icon: '🏪', label: '市场竞争', value: `${sales.compMod}%`, positive: sales.compMod > 100 });
        if (sales.shModPct && sales.shModPct < 95) result.deltas.push({ icon: '📦', label: '二手市场冲击', value: `${sales.shModPct}%`, positive: false });
        if (sales.recessionActive) result.deltas.push({ icon: '📉', label: '经济下行影响', value: '销量-30%', positive: false });
        state.totalSales += sales.hvpSales;
        result.deltas.push({ icon: '📖', label: `同人本售出 ${sales.hvpSales}本`, value: `+¥${sales.hvpSales * sales.hvpPrice}`, positive: true });
        result.deltas.push({ icon: '💰', label: '本期利润', value: profit >= 0 ? `+¥${profit}` : `-¥${Math.abs(profit)}`, positive: profit >= 0 });

        const repGain = 0.35 * state.infoDisclosure * sales.hvpSales * 0.1;
        state.reputation += repGain;
        state.maxReputation = Math.max(state.maxReputation, state.reputation);
        result.deltas.push({ icon: '⭐', label: '声誉提升', value: `+${repGain.toFixed(2)}`, positive: true });

        const feedback = calculateFeedback(state);
        state.passion = Math.min(100, state.passion + feedback);
        result.deltas.push({ icon: '💬', label: '社群反馈', value: `热情+${feedback.toFixed(1)}`, positive: feedback > 0 });

        // === Event amplification: selling at a doujin event amplifies emotional response ===
        if (state.attendingEvent) {
          const expectedSales = Math.round(marketDemand * playerShare * conversion * 0.95); // expected without event
          const actualVsExpected = sales.hvpSales / Math.max(1, expectedSales);
          if (actualVsExpected >= 1.5) {
            // Great event sales! Huge passion boost
            const eventPassionBoost = Math.round(8 + (actualVsExpected - 1) * 5);
            state.passion = Math.min(100, state.passion + eventPassionBoost);
            result.deltas.push({ icon: '🎉', label: '展会大卖！情绪高涨', value: `热情+${eventPassionBoost}`, positive: true });
          } else if (sales.hvpSales <= 3) {
            // Terrible event sales — devastating for morale
            const eventPassionHit = -15 - Math.round(state.attendingEvent.travelCost / 100);
            state.passion = Math.max(0, state.passion + eventPassionHit);
            result.deltas.push({ icon: '😞', label: '展会惨淡...花了路费却没卖几本', value: `热情${eventPassionHit}`, positive: false });
          }
        }

        state.hvpProject = null;
        if (state.official) recordPlayerWork(state.official, 'hvp', state.turn, state.reputation, sales.hvpSales);
        result.tip = TIPS.hvpComplete;
        if (state.passion < 30) result.tip = TIPS.burnout;
      } else {
        result.deltas.push({ icon: '📖', label: '继续创作中...', value: `进度 ${p.progress}/${p.needed}`, positive: true });
        result.tip = TIPS.hvpContinue;
      }
    }

  } else if (action.type === 'lvp') {
    // === LVP: single-turn, complete immediately ===
    state.passion -= 8;
    const lvpCost = 200;
    const costMult = state.recessionTurnsLeft > 0 ? 1.2 : 1.0;
    const actualCost = Math.round(lvpCost * costMult);
    state.money -= actualCost;
    result.deltas.push({ icon: '❤️', label: '创作消耗', value: '-8', positive: false });
    result.deltas.push({ icon: '💰', label: `制作成本${costMult > 1 ? '(下行+20%)' : ''}`, value: `-¥${actualCost}`, positive: false });

    const sales = calculateSales('lvp', state);
    result.salesInfo = sales;
    result.supplyDemand = getSupplyDemandData(state, sales);
    state.money += sales.totalRevenue;
    state.totalRevenue += sales.totalRevenue;
    state.totalLVP++;
    state.totalSales += sales.lvpSales;
    state.recentLVP = 1;
    if (state.official) recordPlayerWork(state.official, 'lvp', state.turn, state.reputation, sales.lvpSales);
    const profit = sales.totalRevenue - actualCost;

    result.deltas.push({ icon: '👁️', label: `潜在关注 ${sales.awareness}人`, value: `转化率${sales.conversion}%`, positive: true });
    if (sales.infoBonus > 0) result.deltas.push({ icon: '📢', label: '信息透明度加成', value: `+${sales.infoBonus}%转化`, positive: true });
    if (sales.compMod && sales.compMod !== 100) result.deltas.push({ icon: '🏪', label: '市场竞争', value: `${sales.compMod}%`, positive: sales.compMod > 100 });
    if (sales.recessionActive) result.deltas.push({ icon: '📉', label: '经济下行影响', value: '销量-30%', positive: false });
    result.deltas.push({ icon: '🔑', label: `谷子售出 ${sales.lvpSales}个`, value: `+¥${sales.lvpSales * sales.lvpPrice}`, positive: true });
    result.deltas.push({ icon: '💰', label: '本期利润', value: profit >= 0 ? `+¥${profit}` : `-¥${Math.abs(profit)}`, positive: profit >= 0 });

    const repGain = 0.04 * state.infoDisclosure * sales.lvpSales * 0.1;
    state.reputation += repGain;
    state.maxReputation = Math.max(state.maxReputation, state.reputation);
    result.deltas.push({ icon: '⭐', label: '声誉提升', value: `+${repGain.toFixed(2)}`, positive: true });

    const feedback = calculateFeedback(state);
    state.passion = Math.min(100, state.passion + feedback);
    result.deltas.push({ icon: '💬', label: '社群反馈', value: `热情+${feedback.toFixed(1)}`, positive: feedback > 0 });

    // === Event amplification for LVP ===
    if (state.attendingEvent) {
      if (sales > 15) {
        const boost = Math.round(5 + sales * 0.3);
        state.passion = Math.min(100, state.passion + boost);
        result.deltas.push({ icon: '🎉', label: '展会谷子大卖！', value: `热情+${boost}`, positive: true });
      } else if (sales <= 3) {
        const hit = -10 - Math.round(state.attendingEvent.travelCost / 150);
        state.passion = Math.max(0, state.passion + hit);
        result.deltas.push({ icon: '😞', label: '展会谷子无人问津...', value: `热情${hit}`, positive: false });
      }
    }
    result.tip = TIPS.lvp;
  }

  // --- Partner effects ---
  if (state.hasPartner && state.partnerType) {
    const pt = PARTNER_TYPES[state.partnerType];
    if (pt.passionPerTurn !== 0) {
      state.passion = Math.min(100, state.passion + pt.passionPerTurn);
      result.deltas.push({ icon: '🤝', label: pt.passionPerTurn > 0 ? '搭档正面影响' : '搭档带来压力', value: `热情${pt.passionPerTurn > 0 ? '+' : ''}${pt.passionPerTurn}`, positive: pt.passionPerTurn > 0 });
    }
    if (pt.dramaChance > 0 && Math.random() < pt.dramaChance) {
      const drama = rollPartnerDrama(state.partnerType);
      state.passion = Math.max(0, state.passion + drama.passionDelta);
      state.reputation = Math.max(0, state.reputation + drama.reputationDelta);
      result.deltas.push({ icon: '⚠️', label: drama.desc, value: drama.summary, positive: false });
    }
    state.partnerTurns--;
    if (state.partnerTurns <= 0) {
      const wasType = state.partnerType;
      state.hasPartner = false; state.partnerType = null;
      result.deltas.push({ icon: '🤝', label: wasType === 'toxic' ? '终于摆脱了有毒搭档...' : '搭档合作期结束', value: '', positive: wasType === 'toxic' });
    }
  }

  // --- Track creative activity (resets inactivity counter) ---
  // Creating, attending events, finding partners, heavy promotion all count as "active in the scene"
  const isActive = ['hvp', 'lvp', 'promote_heavy', 'attendEvent'].includes(actionId)
    || (actionId === 'findPartner' && state.hasPartner); // only if actually found one
  if (isActive) state.lastCreativeTurn = state.turn;

  // --- Reality drain ---
  const drain = getRealityDrain(state.turn);
  if (drain > 0) {
    state.passion = Math.max(0, state.passion - drain);
    result.deltas.push({ icon: '🌍', label: '现实消耗', value: `热情-${drain.toFixed(1)}`, positive: false });
  }

  // --- Inactivity drain: the longer you stop creating, the faster passion fades ---
  const idleMonths = state.turn - state.lastCreativeTurn;
  if (idleMonths >= 3) {
    const idleDrain = Math.min(8, Math.floor((idleMonths - 2) * 1.5));
    state.passion = Math.max(0, state.passion - idleDrain);
    result.deltas.push({ icon: '🕸️', label: '活动停滞', value: `热情-${idleDrain}（已${idleMonths}月未活动）`, positive: false });
  }

  // --- Debt anxiety: negative money → passion drain (worry, not fun anymore) ---
  if (state.money < 0) {
    const debtLevel = Math.abs(state.money);
    // Every ¥500 in debt → 2 extra passion drain
    const debtDrain = Math.min(10, Math.floor(debtLevel / 500) * 2);
    if (debtDrain > 0) {
      state.passion = Math.max(0, state.passion - debtDrain);
      result.deltas.push({ icon: '💸', label: '亏损焦虑', value: `热情-${debtDrain}`, positive: false });
    }
  }

  // --- Passive income ---
  const stage = getLifeStage(state.turn);
  if (stage === 'university') {
    const allowance = 150 + Math.floor(Math.random() * 100); // always comes, recession doesn't touch it
    state.money += allowance;
    result.deltas.push({ icon: '🏠', label: '生活费结余', value: `+¥${allowance}`, positive: true });
  } else if (stage === 'work') {
    if (state.unemployed) {
      // No salary, massive passion drain from anxiety & uncertainty
      const anxietyDrain = 8 + state.jobSearchTurns * 2; // gets worse the longer unemployed
      state.passion = Math.max(0, state.passion - anxietyDrain);
      result.deltas.push({ icon: '😰', label: '失业焦虑', value: `热情-${anxietyDrain}`, positive: false });
      result.deltas.push({ icon: '💼', label: '无工资收入', value: '¥0', positive: false });
    } else {
      const baseSalary = 800 + Math.floor((state.turn - 50) / 12) * 200;
      const salary = state.recessionTurnsLeft > 0 ? Math.floor(baseSalary * 0.8) : baseSalary; // recession cuts salary
      state.money += salary;
      state.monthlyIncome = salary;
      result.deltas.push({ icon: '💼', label: `工资${state.recessionTurnsLeft > 0 ? '(下行-20%)' : ''}`, value: `+¥${salary}`, positive: true });

      // Recession: risk of losing job each month
      if (state.recessionTurnsLeft > 0 && Math.random() < 0.06) {
        // ~6% chance per month during recession = ~50% over 2 years
        state.unemployed = true;
        state.jobSearchTurns = 0;
        state.time = 2; // minimal free time (all spent on survival)
        result.deltas.push({ icon: '🚨', label: '被裁员了！', value: '失业', positive: false });
        result.deltas.push({ icon: '📝', label: '只能"找工作"或"休息"', value: '', positive: false });
      }
    }
  }

  // --- Info disclosure: fast decay ---
  state.infoDisclosure = Math.max(0.08, state.infoDisclosure - 0.10);

  // --- Tick recentLVP (for bundling bonus) ---
  if (state.recentLVP > 0) state.recentLVP++;

  // --- Tick time debuffs ---
  state.timeDebuffs = state.timeDebuffs.filter(d => { d.turnsLeft--; return d.turnsLeft > 0; });

  // --- Tick recession ---
  if (state.recessionTurnsLeft > 0) {
    state.recessionTurnsLeft--;
    if (state.recessionTurnsLeft === 0) {
      result.deltas.push({ icon: '📈', label: '经济复苏', value: '下行周期结束', positive: true });
    }
  }

  // --- Tick market ecosystem (Phase 2) ---
  if (state.market) tickMarket(state.market, state);

  // --- Tick official IP & secondhand (Phase 3) ---
  let officialEvents = [];
  if (state.official && state.market) {
    officialEvents = tickOfficial(state.official, state.market, state);
  }
  result.officialEvents = officialEvents;

  // --- Tick advanced systems (Phase 4+5) ---
  let advEvents = [];
  if (state.advanced && state.market) {
    advEvents = tickAdvanced(state.advanced, state.market, state);
  }
  result.advancedMsgs = advEvents;

  // --- Reset player price choices and event boost ---
  state.playerPrice = { hvp: null, lvp: null };
  // Event boost consumed after producing
  if (action.type === 'hvp' || action.type === 'lvp') state.attendingEvent = null;

  // --- Advance turn ---
  state.turn++;
  state.time = computeEffectiveTime(state.turn, state.timeDebuffs);

  // --- Generate available doujin events for next turn ---
  state.availableEvents = generateEvents(state);

  // --- Achievements ---
  checkAchievements(state);

  // --- Game over check ---
  if (state.passion <= 0) {
    state.passion = 0; state.phase = 'gameover';
    state.gameOverReason = getLifeStage(state.turn) === 'work'
      ? '工作和生活的压力逐渐磨灭了你对同人创作的热情。也许这就是大多数人的故事...'
      : '热情耗尽——用爱发电的电量归零了...';
  } else {
    state.phase = 'result';
  }

  state.lastResult = result;
  return result;
}

// === Partner Drama ===
function rollPartnerDrama(type) {
  const pool = {
    demanding: [{ desc: '搭档嫌弃你的画稿质量，要求推翻重来', summary: '热情-8', passionDelta: -8, reputationDelta: 0 }],
    unreliable: [
      { desc: '搭档突然消失不回消息，进度全部拖延', summary: '热情-5', passionDelta: -5, reputationDelta: 0 },
      { desc: '搭档交付的部分质量很差，只能你来返工', summary: '热情-8', passionDelta: -8, reputationDelta: 0 },
    ],
    toxic: [
      { desc: '搭档在社交媒体上公开吐槽你', summary: '热情-12 声誉-0.5', passionDelta: -12, reputationDelta: -0.5 },
      { desc: '搭档挑起粉丝之间的对立', summary: '热情-10 声誉-0.3', passionDelta: -10, reputationDelta: -0.3 },
      { desc: '搭档把未完成草稿泄露出去', summary: '热情-15 声誉-0.4', passionDelta: -15, reputationDelta: -0.4 },
    ],
  };
  const options = pool[type] || [];
  return options.length > 0 ? options[Math.floor(Math.random() * options.length)] : { desc: '', summary: '', passionDelta: 0, reputationDelta: 0 };
}

// === Achievements ===
function checkAchievements(state) {
  const checks = [
    { id: 'first_hvp', cond: state.totalHVP >= 1 }, { id: 'first_lvp', cond: state.totalLVP >= 1 },
    { id: 'rep3', cond: state.reputation >= 3 }, { id: 'rep5', cond: state.reputation >= 5 }, { id: 'rep8', cond: state.reputation >= 8 },
    { id: 'survive12', cond: state.turn >= 12 }, { id: 'survive24', cond: state.turn >= 24 },
    { id: 'survive_work', cond: getLifeStage(state.turn) === 'work' && state.passion > 0 },
    { id: 'rich', cond: state.money >= 10000 }, { id: 'hvp5', cond: state.totalHVP >= 5 },
    { id: 'recession_survivor', cond: (state.eventCounts['recession'] || 0) > 0 && state.recessionTurnsLeft === 0 && state.passion > 0 },
    { id: 'diversity_savior', cond: state.market && state.market.nHVP === 0 && state.hvpProject && state.hvpProject.progress > 0 },
    { id: 'market_veteran', cond: state.market && state.market.diversityHealth < 0.3 && state.passion > 20 },
    { id: 'niche_hunter', cond: state.advanced && state.advanced.nichesFound >= 3 },
    { id: 'ai_survivor', cond: state.advanced && state.advanced.aiRevolution && state.totalHVP > 0 && state.passion > 20 },
    { id: 'stagflation_survivor', cond: state.advanced && (state.eventCounts['stagflation'] || 0) > 0 && state.advanced.stagflationTurnsLeft === 0 && state.passion > 0 },
    { id: 'veblen', cond: (state.eventCounts['veblen_hype'] || 0) > 0 },
  ];
  for (const c of checks) if (c.cond && !state.achievements.includes(c.id)) state.achievements.push(c.id);
  if (state.partnerType === 'toxic' && !state.achievements.includes('toxic_encounter')) state.achievements.push('toxic_encounter');
}

export function getAchievementInfo(id) {
  const map = {
    first_hvp: { name: '初出茅庐', desc: '完成第一本同人志', emoji: '📖' },
    first_lvp: { name: '小试牛刀', desc: '制作了第一批谷子', emoji: '🔑' },
    rep3: { name: '小有名气', desc: '声誉达到3', emoji: '⭐' },
    rep5: { name: '圈内知名', desc: '声誉达到5', emoji: '🌟' },
    rep8: { name: '传说大手', desc: '声誉达到8', emoji: '👑' },
    survive12: { name: '一年坚持', desc: '持续创作满一年', emoji: '📅' },
    survive24: { name: '两年老兵', desc: '持续创作满两年', emoji: '🏆' },
    survive_work: { name: '社畜创作者', desc: '进入工作后仍在创作', emoji: '💼' },
    rich: { name: '同人致富', desc: '资金超过10000元', emoji: '💰' },
    hvp5: { name: '高产创作者', desc: '完成5本同人志', emoji: '📚' },
    toxic_encounter: { name: '遇人不淑', desc: '遭遇了有毒搭档', emoji: '😈' },
    recession_survivor: { name: '穿越周期', desc: '经历经济下行后仍在创作', emoji: '📈' },
    diversity_savior: { name: '多样性守护者', desc: '在市场HVP为零时开始创作同人本', emoji: '🌟' },
    market_veteran: { name: '寒冬幸存者', desc: '在市场多样性极低时仍保持热情', emoji: '🏔️' },
    niche_hunter: { name: '需求猎人', desc: '发现3个以上细分需求缺口', emoji: '🔍' },
    ai_survivor: { name: 'AI时代的人类', desc: '在AI革命后仍坚持人工创作', emoji: '🤖' },
    stagflation_survivor: { name: '滞胀幸存者', desc: '经历滞胀后仍在创作', emoji: '🔥' },
    veblen: { name: '圣遗物制造者', desc: '作品成为韦伯仑商品', emoji: '💎' },
  };
  return map[id] || { name: id, desc: '', emoji: '🎖️' };
}

// === Tips ===
const TIPS = {
  hvpStart: { label: '长期项目', text: '同人本是多月项目——独自需要3个月，有搭档可缩短到2个月。印刷成本¥800-1000在完成时支付。搭档有稿费成本，但可以加速进度。这就是HVP的"资本准入壁垒"(Q29: 23.5%认为成本太高)。' },
  hvpContinue: { label: '坚持创作', text: '同人本创作需要持续投入。每个月都在消耗热情，但完成后的声誉积累远高于谷子(γ_H=0.35 vs γ_L=0.04)。中途放弃意味着前期投入全部沉没。' },
  hvpComplete: { label: '🎉 作品完成', text: 'HVP完成！如果最近也做了谷子，会自动触发"互补效应"(Q13, d=0.47)——买了本子的人会顺手买配套谷子。先做谷子再出本是好策略。' },
  lvp: { label: '经济学原理', text: 'LVP一个月就能完成，低门槛、低风险。信息透明度对销量关键——宣发后立刻制作，抓住窗口。如果接下来要出同人本，先做谷子可以触发互补效应。' },
  rest: { label: '热情预算理论', text: '休息恢复热情的效率随入坑年限递减——第1年恢复100%，第5年只剩50%。长期疲惫是不可逆的。同时注意：停滞创作超过3个月后，热情会加速衰减——"不用就会生锈"。' },
  doujinEvent: { label: '同人展经济学 (Stigler)', text: '同人展是"搜寻成本→0"的极端场景：消费者直接翻阅实物(I→1)，面对面交易消除信息不对称。声誉的"下位替代"属性在展会上最弱——产品质量直接说话。路费是参展的机会成本，大社群有更多展会选择（规模经济）。' },
  promoteLight: { label: '轻度宣发', text: '低成本维持曝光。信号通胀越严重效果越差，但始终有保底(+3%)。适合资源紧张时维持存在感。信息透明度每月-10%快速衰减，注意节奏。' },
  promoteHeavy: { label: '全力宣发 (Stigler)', text: '大规模宣发：发试阅、打样返图、详细介绍。82.7%的消费者选择"信息充分的新人"而非"信息不足的名家"。即使信号通胀严重也保底+8%。宣发后立刻制作售卖，抓住窗口！' },
  partnerFound: { label: '协作约束', text: '47.1%的创作者表示"找到合拍搭档就会做HVP"——协作可得性是HVP创作的第一大触发条件。默契搭档在热情和销量上都有正面加成。' },
  partnerFail: { label: '声誉与协作', text: '协作概率随声誉递增。声誉越高越容易找到搭档——这是声誉的隐性收益。' },
  partnerRisk: { label: '⚠️ 搭档风险', text: '搭档类型是随机的。严格搭档虽然出品好但压力大，不靠谱搭档可能临时消失。协作引入了额外的不确定性。' },
  partnerToxic: { label: '⚠️ 有毒协作', text: '有毒搭档持续消耗热情，甚至公开引发争端损害声誉。对应Producer模型中的"塌方事件"S(t)。一旦卷入，只能等合作期结束...' },
  burnout: { label: '⚠️ 倦怠风险 (F1)', text: '每日投入3小时以上的创作者中，31.9%因热情耗竭退坑。创作行为本身消耗热情预算W——这是"用爱发电"的真实成本。' },
  jobSearching: { label: '失业与外生退出', text: '失业期间无法创作，只能"找工作"或"休息"。经济下行让求职更难，失业时间越长焦虑越重——这就是Producer模型中最残酷的外生退出压力。51.2%的退出因"现实太忙"。' },
  jobFound: { label: '重返岗位', text: '找到工作了！收入恢复，但失业期间流失的热情和声誉需要时间重建。如果经济仍在下行，要警惕再次失业的风险。' },
  partTimeJob: { label: '时间-金钱权衡', text: '打工赚的钱稳定但不多(¥300~500)，且占用了本可以创作的时间。这就是经济学中的机会成本——打工的每一小时，都是放弃创作的一小时。' },
  freelanceLow: { label: '接稿与声誉', text: '声誉低时接稿收入有限。但接稿本身也是一种技能锻炼。注意：接稿消耗的热情比普通打工更大——因为你在用创作能力换钱，精神消耗更高。' },
  freelanceHigh: { label: '声誉的商业溢出', text: '声誉高的创作者接稿收入远高于普通打工——这是声誉资本的商业变现。但要小心：把太多时间花在接稿上，就没时间做自己真正想做的同人了。' },
};
