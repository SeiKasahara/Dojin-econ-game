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

// === Creative Skill: Learning by Doing (Arrow 1962) ===
// Skill grows logarithmically with cumulative output: HVP counts 3× more than LVP
// Effects: cost↓, reputation↑, speed↑ at mastery, breakthrough chance
export function getCreativeSkill(state) {
  const raw = Math.log2(1 + (state.totalHVP || 0) * 3 + (state.totalLVP || 0));
  return Math.round(raw * 10) / 10; // 1 decimal
}
export function getSkillEffects(skill) {
  return {
    costReduction: Math.min(0.20, skill * 0.03),          // -3%/level, cap -20%
    repBonus:      1 + Math.min(0.5, skill * 0.08),        // +8%/level, cap +50%
    soloHVPMonths: skill >= 4 ? 2 : 3,                     // mastery: solo HVP in 2 months
    breakthroughChance: Math.min(0.25, skill * 0.025),     // 2.5%/level, cap 25%
  };
}
// Skill level labels
export function getSkillLabel(skill) {
  if (skill < 1) return '入门';
  if (skill < 2) return '初学';
  if (skill < 3) return '熟练';
  if (skill < 4) return '精通';
  return '大师';
}

function getRealityDrain(turn) {
  const stage = getLifeStage(turn);
  if (stage === 'summer') return 0;
  if (stage === 'university') return 0.8 + Math.floor((turn - 2) / 12) * 0.25;
  return 2.5 + ((turn - 50) / 12) * 0.4;
}

// === Partner Types ===
// feeRange: [min, max] — cost to hire. 15% chance of fee=0 (人好)
export const PARTNER_TYPES = {
  supportive: { id: 'supportive', name: '默契搭档', emoji: '😊', desc: '合作愉快，效率提升', salesBonus: 1.3, passionPerTurn: 2, dramaChance: 0, feeRange: [600, 1000] },
  demanding:  { id: 'demanding',  name: '严格搭档', emoji: '😤', desc: '要求极高，出品精良但压力大', salesBonus: 1.5, passionPerTurn: -3, dramaChance: 0.12, feeRange: [1000, 1500] },
  unreliable: { id: 'unreliable', name: '不靠谱搭档', emoji: '😅', desc: '有时很给力，有时完全消失', salesBonus: 0.9, passionPerTurn: -1, dramaChance: 0.25, feeRange: [400, 800] },
  toxic:      { id: 'toxic',      name: '有毒搭档', emoji: '😈', desc: '经常制造矛盾，但就是甩不掉...', salesBonus: 1.1, passionPerTurn: -6, dramaChance: 0.35, feeRange: [800, 1200] },
};

function rollPartnerType(social = 0) {
  const r = Math.random();
  // social charm shifts probability toward supportive, away from toxic
  const supportiveThresh = 0.50 + social * 0.05;
  const toxicThresh = Math.max(0.95, 0.92 + social * 0.02);
  if (r < supportiveThresh) return 'supportive';
  if (r < 0.75 + social * 0.02) return 'demanding';
  if (r < toxicThresh) return 'unreliable';
  return 'toxic';
}

// === Work Subtypes ===
export const HVP_SUBTYPES = {
  manga:    { id: 'manga',    name: '漫画本',       emoji: '📕', monthsSolo: 3, monthsPartner: 2, costRange: [2500, 3000], repMult: 1.0,  audienceMult: 1.0,  requiredRep: 0, desc: '标准同人本' },
  novel:    { id: 'novel',    name: '小说本',       emoji: '📗', monthsSolo: 2, monthsPartner: 1, costRange: [1500, 2000], repMult: 0.8,  audienceMult: 0.75, requiredRep: 0, desc: '成本低周期短，受众略小' },
  artbook:  { id: 'artbook',  name: '创意绘本',     emoji: '🎨', monthsSolo: 3, monthsPartner: 2, costRange: [3500, 4500], repMult: 1.5,  audienceMult: 0.85, requiredRep: 0, desc: '声誉加成高但投入大' },
  lorebook: { id: 'lorebook', name: '设定集',       emoji: '📜', monthsSolo: 2, monthsPartner: 1, costRange: [2000, 2800], repMult: 1.2,  audienceMult: 0.6,  requiredRep: 2, desc: '小众高价值，需声誉≥2' },
  music:    { id: 'music',    name: '同人音乐专辑', emoji: '🎵', monthsSolo: 4, monthsPartner: 3, costRange: [4000, 5000], repMult: 1.3,  audienceMult: 0.7,  requiredRep: 0, desc: '独特受众，周期长' },
};
export const LVP_SUBTYPES = {
  acrylic:  { id: 'acrylic',  name: '亚克力',     emoji: '💠', cost: 200, batchSize: 28, marginMult: 1.0, desc: '标准谷子' },
  badge:    { id: 'badge',    name: '吧唧',       emoji: '🔘', cost: 100, batchSize: 40, marginMult: 0.7, desc: '便宜量大走量型' },
  shikishi: { id: 'shikishi', name: '色纸',       emoji: '🖼️', cost: 150, batchSize: 25, marginMult: 1.1, desc: '利润率较高' },
  postcard: { id: 'postcard', name: '明信片套组', emoji: '💌', cost: 120, batchSize: 50, marginMult: 0.8, desc: '成本低量大' },
};

// === Creative Choices ===
export const CREATIVE_CHOICES = {
  theme: {
    title: '选择创作方向', desc: '这部作品的基调是什么？',
    options: [
      { id: 'sweet',     name: '甜文日常', emoji: '🍰', desc: '温暖治愈的日常故事', tag: '甜文' },
      { id: 'angst',     name: '刀子虐心', emoji: '🗡️', desc: '虐心催泪的情感冲击', tag: '虐心' },
      { id: 'adventure', name: '热血冒险', emoji: '⚔️', desc: '热血沸腾的冒险故事', tag: '热血' },
    ],
  },
  execution: {
    title: '创作进度决策', desc: '目前进展如何？接下来要怎么做？',
    options: [
      { id: 'rush',   name: '赶工加速', emoji: '⚡', desc: '压缩工期，省一个月但可能影响品质' },
      { id: 'normal', name: '正常进度', emoji: '📝', desc: '按部就班，稳扎稳打' },
      { id: 'polish', name: '精雕细琢', emoji: '✨', desc: '花更多心思打磨，额外消耗一些精力' },
    ],
  },
  finalPolish: {
    title: '最后冲刺', desc: '作品即将完成，最后阶段如何处理？',
    options: [
      { id: 'safe',       name: '保守完成',     emoji: '📦', desc: '安全收尾，稳定输出' },
      { id: 'overhaul',   name: '大改封面/曲目', emoji: '🔄', desc: '推翻重做，可能翻车也可能惊艳' },
      { id: 'experiment', name: '加入实验性元素', emoji: '🧪', desc: '大胆尝试，也许会成为cult经典' },
    ],
  },
  lvpProcess: {
    title: '制作工艺', desc: '选择这批谷子的制作方式',
    options: [
      { id: 'standard', name: '标准工艺', emoji: '📦', desc: '正常制作，品质适中' },
      { id: 'premium',  name: '精装工艺', emoji: '💎', desc: '更好的材料和做工，成本更高' },
      { id: 'budget',   name: '简装快出', emoji: '📋', desc: '压低成本快速出货，量大但品质一般' },
    ],
  },
};

// === Creative Choice Effects (hidden from player) ===
const CHOICE_EFFECTS = {
  // Theme choices
  sweet:     { qualityMod: 0,     audienceMod: 0.15,  uniqueMod: -0.1 },
  angst:     { qualityMod: 0.05,  audienceMod: -0.05, uniqueMod: 0.15 },
  adventure: { qualityMod: 0,     audienceMod: -0.1,  uniqueMod: 0.1 },
  // Execution choices
  rush:      { qualityMod: -0.15, speedMod: -1, passionExtra: 0 },
  normal:    { qualityMod: 0,     speedMod: 0,  passionExtra: 0 },
  polish:    { qualityMod: 0.15,  speedMod: 0,  passionExtra: 5 },
  // Final polish choices
  safe:      { qualityMod: 0,     riskMod: 0,   cultChance: 0 },
  overhaul:  { qualityMod: 0,     riskMod: 0.3, cultChance: 0 },
  experiment:{ qualityMod: 0.05,  riskMod: 0,   cultChance: 0.15 },
  // LVP process choices
  standard:  { qualityMod: 0,     costMod: 1.0, batchMod: 1.0 },
  premium:   { qualityMod: 0.2,   costMod: 1.5, batchMod: 0.8 },
  budget:    { qualityMod: -0.15, costMod: 0.7, batchMod: 1.3 },
};

// Apply a creative choice to an HVP project, returns flavor text for display
export function applyCreativeChoice(project, choiceCategory, optionId) {
  const fx = CHOICE_EFFECTS[optionId];
  if (!fx) return '';
  if (choiceCategory === 'theme') {
    const opt = CREATIVE_CHOICES.theme.options.find(o => o.id === optionId);
    project.styleTag = opt?.tag || null;
    project.workQuality += fx.qualityMod;
  } else if (choiceCategory === 'execution') {
    project.workQuality += fx.qualityMod;
    if (fx.speedMod) project.needed = Math.max(1, project.needed + fx.speedMod);
    if (fx.passionExtra) project._extraPassionCost = fx.passionExtra;
  } else if (choiceCategory === 'finalPolish') {
    project.workQuality += fx.qualityMod;
    if (fx.riskMod && Math.random() < fx.riskMod) {
      // Overhaul gamble: 50/50 great or terrible
      project.workQuality += Math.random() < 0.5 ? 0.2 : -0.2;
    }
    if (fx.cultChance && Math.random() < fx.cultChance) {
      project.isCultHit = true;
    }
  }
  project.workQuality = Math.max(0.5, Math.min(1.8, project.workQuality));
  project.choices.push(optionId);
}

// Work quality effects on sales/reputation (hidden multipliers)
export function getWorkQualityEffects(quality) {
  return {
    salesMult: 0.4 + quality * 0.6,          // quality 0.5→0.7, 1.0→1.0, 1.5→1.3, 1.8→1.48
    repMult: 0.5 + quality * 0.5,             // quality 0.5→0.75, 1.0→1.0, 1.5→1.25
    breakthroughMod: (quality - 1.0) * 0.1,   // quality 0.5→-0.05, 1.0→0, 1.5→+0.05
  };
}

// Trend bonus on sales/reputation
export function getTrendBonus(styleTag, currentTrend) {
  if (!currentTrend || !styleTag) return { salesMult: 1.0, repMult: 1.0 };
  if (styleTag === currentTrend.tag) return { salesMult: currentTrend.strength, repMult: 0.85 };
  return { salesMult: 0.8, repMult: 1.0 }; // off-trend slight penalty
}

// Sync inventory aggregates from works array (backward compat)
export function syncInventoryAggregates(state) {
  state.inventory.hvpStock = state.inventory.works.filter(w => w.type === 'hvp').reduce((s, w) => s + w.qty, 0);
  state.inventory.lvpStock = state.inventory.works.filter(w => w.type === 'lvp').reduce((s, w) => s + w.qty, 0);
}

// === Initial State ===
// === Endowment definitions ===
export const ENDOWMENTS = {
  talent:     { name: '创作天赋', emoji: '🎨', desc: '作品质量与声誉积累速度', effects: ['声誉积累+15%/级', '印刷成本-5%/级'] },
  stamina:    { name: '体力精力', emoji: '💪', desc: '热情恢复力与创作消耗', effects: ['休息恢复+3/级', '制作同人本时间月耗-1/级'] },
  social:     { name: '社交魅力', emoji: '🤝', desc: '搭档质量与展会表现', effects: ['找搭档+8%/级', '毒搭档率-2%/级'] },
  marketing:  { name: '营销直觉', emoji: '📢', desc: '宣发效果与信息衰减', effects: ['宣发效果+12%/级', '信息衰减-1%/级'] },
  resilience: { name: '心理韧性', emoji: '🛡️', desc: '抵抗现实消耗与负面事件', effects: ['现实消耗-0.5/级', '负债焦虑阈+200/级'] },
};
export const ENDOWMENT_TOTAL_POINTS = 7;
export const ENDOWMENT_MAX_PER_TRAIT = 3;

// === Background (家庭背景) ===
export const BACKGROUNDS = {
  poor:     { name: '困难家庭', emoji: '🏚️', weight: 5,  money: 800,  allowanceMult: 0.6, salaryMult: 0.85, fireResist: 0, desc: '拮据但坚韧，逆境出发' },
  ordinary: { name: '普通家庭', emoji: '🏠', weight: 70, money: 2000, allowanceMult: 1.0, salaryMult: 1.0,  fireResist: 0, desc: '标准起点' },
  comfort:  { name: '小康家庭', emoji: '🏡', weight: 12, money: 3500, allowanceMult: 1.3, salaryMult: 1.1,  fireResist: 0.02, desc: '稍有余裕，更多试错空间' },
  educated: { name: '书香门第', emoji: '📚', weight: 8,  money: 2500, allowanceMult: 1.15, salaryMult: 1.05, fireResist: 0.01, desc: '文化氛围好，创作更容易被理解' },
  wealthy:  { name: '富裕家庭', emoji: '💎', weight: 3,  money: 8000, allowanceMult: 2.0, salaryMult: 1.4,  fireResist: 0.04, desc: '资金充裕，几乎不用担心钱' },
  tycoon:   { name: '超级富哥', emoji: '👑', weight: 2,  money: 20000, allowanceMult: 3.0, salaryMult: 2.0, fireResist: 0.05, desc: '钱不是问题，热情才是' },
};

export function rollBackground() {
  const total = Object.values(BACKGROUNDS).reduce((s, b) => s + b.weight, 0);
  let r = Math.random() * total;
  for (const [id, bg] of Object.entries(BACKGROUNDS)) {
    r -= bg.weight;
    if (r <= 0) return id;
  }
  return 'ordinary';
}

export function createInitialState(communityPreset = 'mid', endowments = null, backgroundId = null, ipType = 'normal') {
  const e = endowments || { talent: 1, stamina: 1, social: 2, marketing: 1, resilience: 2 };
  const bgId = backgroundId || 'ordinary';
  const bg = BACKGROUNDS[bgId];
  return {
    turn: 0, phase: 'action',
    endowments: e,
    background: bgId,
    passion: 90, reputation: 0.3, time: 9, money: bg.money,
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
    // Inventory system (库存管理)
    inventory: { hvpStock: 0, lvpStock: 0, hvpPrice: 50, lvpPrice: 15, works: [], nextWorkId: 1 },
    // Personal goods collection (as consumer)
    goodsCollection: 0,   // purchased goods owned, can sell to secondhand market
    // Market ecosystem (Phase 2)
    market: createMarketState(communityPreset, ipType),
    // Official IP & secondhand (Phase 3)
    official: createOfficialState(ipType),
    // Advanced: stagflation, AI, network, Kirzner (Phase 4+5)
    advanced: createAdvancedState(),
    // Event frequency tracking
    eventCounts: {},
    scheduledFired: {},
    // Cumulative
    totalHVP: 0, totalLVP: 0, totalRevenue: 0, totalSales: 0, maxReputation: 0.3,
    recentEventTurns: [],  // turns when events were attended (for fatigue tracking)
    // History for dashboard
    history: [],       // [{ turn, money, reputation, passion, revenue, sales, action }]
    eventLog: [],      // [{ turn, name, city, revenue, sold }]
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
  reprint:     { id: 'reprint',     name: '追加印刷',   emoji: '🖨️', type: 'reprint',
                 costLabel: '补印库存 需有旧作', requires: { passion: 3, time: 2 } },
  buyGoods:    { id: 'buyGoods',    name: '购买谷子',   emoji: '🛍️', type: 'buyGoods',
                 costLabel: '¥200 热情↑(效果逐年递减)', requires: { time: 1 } },
  sellGoods:   { id: 'sellGoods',   name: '出售闲置',   emoji: '📤', type: 'sellGoods',
                 costLabel: '卖掉收藏品换钱 需有收藏', requires: { time: 1 } },
};

// Dynamic action info (for UI)
export function getActionDisplay(actionId, state) {
  const base = ACTIONS[actionId];
  if (!base) return null;
  if (actionId === 'rest') {
    const yearsIn = state.turn / 12;
    const eff = Math.max(35, Math.round((1 - yearsIn * 0.06) * 100));
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
    const recTag = state.recessionTurnsLeft > 0 ? ' 📉-50%' : '';
    return { ...base, costLabel: `热情-12 需闲暇≥${tc} ${label}${recTag}` };
  }
  if (actionId === 'partTimeJob') {
    const stage = getLifeStage(state.turn);
    if (stage === 'work' && !state.unemployed) return { ...base, costLabel: '仅学生/失业可用' };
    const recTag = state.recessionTurnsLeft > 0 ? ' 📉-40%' : '';
    return { ...base, costLabel: `热情-8 赚¥300~500${recTag}` };
  }
  if (actionId === 'attendEvent') {
    if (state.inventory.hvpStock === 0 && state.inventory.lvpStock === 0) {
      return { ...base, costLabel: '没有库存可卖！先创作或追印' };
    }
    if (!state.availableEvents || state.availableEvents.length === 0) {
      return { ...base, costLabel: '本月无同人展' };
    }
    const evts = state.availableEvents;
    const best = evts[0];
    const stockInfo = `📦本${state.inventory.hvpStock}·谷${state.inventory.lvpStock}`;
    return { ...base, costLabel: `${best.name}@${best.city} 路费¥${best.travelCost} ${stockInfo}` };
  }
  if (actionId === 'promote_light' || actionId === 'promote_heavy') {
    const sigCost = state.advanced ? getSignalCost(state.advanced) : 1.0;
    const sigLabel = sigCost > 1.2 ? ` 通胀×${sigCost.toFixed(1)}` : '';
    return { ...base, costLabel: base.costLabel + sigLabel };
  }
  if (actionId === 'hvp') {
    const recTag = state.recessionTurnsLeft > 0 ? ' 📉' : '';
    const staCost = Math.max(8, 15 - (state.endowments?.stamina || 0));
    if (state.hvpProject) {
      const p = state.hvpProject;
      const sub = HVP_SUBTYPES[p.subtype] || HVP_SUBTYPES.manga;
      return { ...base, name: `继续创作${sub.name}`, emoji: sub.emoji, costLabel: `进度 ${p.progress}/${p.needed} · 热情-${staCost}${recTag}` };
    }
    return { ...base, costLabel: `选择类型后开始创作${recTag}` };
  }
  if (actionId === 'lvp') {
    const recTag = state.recessionTurnsLeft > 0 ? ' 📉' : '';
    return { ...base, costLabel: `选择类型和工艺${recTag}` };
  }
  if (actionId === 'reprint') {
    if (state.totalHVP === 0 && state.totalLVP === 0) {
      return { ...base, costLabel: '还没有作品可以追印！' };
    }
    const parts = [];
    if (state.totalHVP > 0) parts.push(`本30本¥1200`);
    if (state.totalLVP > 0) parts.push(`谷20个¥120`);
    return { ...base, costLabel: `${parts.join(' / ')} 库存:本${state.inventory.hvpStock}·谷${state.inventory.lvpStock}` };
  }
  if (actionId === 'buyGoods') {
    const yearsIn = state.turn / 12;
    const eff = Math.max(30, Math.round((1 - yearsIn * 0.08) * 100));
    return { ...base, costLabel: `¥200 热情+${Math.round(12 * eff / 100)} 效率${eff}%${state.money < 200 ? ' ⚠️资金不足' : ''}` };
  }
  if (actionId === 'sellGoods') {
    if (state.goodsCollection <= 0) return { ...base, costLabel: '没有收藏品可出' };
    const sellPrice = Math.round(120 + (state.official?.secondHandPressure?.lvp || 0) * -80);
    return { ...base, costLabel: `收藏${state.goodsCollection}件 预估¥${Math.max(50, sellPrice)}/件 热情-3` };
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
  // Unemployed: can only rest, find job, freelance, or buy goods
  if (state.unemployed) {
    if (!['rest', 'jobSearch', 'freelance', 'buyGoods', 'sellGoods'].includes(actionId)) return false;
  }
  // jobSearch: only when unemployed
  if (actionId === 'jobSearch' && !state.unemployed) return false;
  // partTimeJob: only students or unemployed
  if (actionId === 'partTimeJob') {
    const stage = getLifeStage(state.turn);
    if (stage === 'work' && !state.unemployed) return false;
  }
  // attendEvent: need events available AND have inventory to sell
  if (actionId === 'attendEvent') {
    if (!state.availableEvents || state.availableEvents.length === 0) return false;
    if (state.inventory.hvpStock === 0 && state.inventory.lvpStock === 0) return false;
  }
  // reprint: need at least one work ever created
  if (actionId === 'reprint') {
    if (state.totalHVP === 0 && state.totalLVP === 0) return false;
  }
  // buyGoods: need money
  if (actionId === 'buyGoods') {
    if (state.money < 200) return false;
  }
  // sellGoods: need collection
  if (actionId === 'sellGoods') {
    if (state.goodsCollection <= 0) return false;
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

  // --- Work quality & trend modifiers ---
  const recentWork = state.inventory?.works?.filter(w => w.type === type).slice(-1)[0];
  const wqFx = recentWork ? getWorkQualityEffects(recentWork.workQuality) : { salesMult: 1, repMult: 1, breakthroughMod: 0 };
  const trendFx = recentWork ? getTrendBonus(recentWork.styleTag, state.market?.currentTrend) : { salesMult: 1, repMult: 1 };

  // --- Calculate final sales ---
  const rawSales = marketDemand * playerShare * conversion * partnerMult * shMod * advMod * eventBoost * noise * wqFx.salesMult * trendFx.salesMult;
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
      tip: '社群网络扩展降低了协作搜寻成本。认识的人越多，越容易找到搭档。',
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
      tip: '进入工作后，时间禀赋永久性下降。工作后的同人创作者是真正的幸存者。',
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
    tip: '声誉是风险资产：积累越多，塌方损失的绝对值越大。',
    weight: 8, when: (s) => s.reputation > 0.3, maxTotal: Infinity,
  },
  // --- 家人生病：整个游戏最多1-2次 ---
  {
    id: 'family_emergency', emoji: '🏥', title: '家人生病了',
    desc: '家里突然有人生病需要照顾，接下来几个月你的空闲时间会大幅减少...',
    effect: '时间-3h（持续3回合）', effectClass: 'negative',
    apply: (s) => { s.timeDebuffs.push({ id: 'family', reason: '照顾家人', turnsLeft: 3, delta: -3 }); s.time = computeEffectiveTime(s.turn, s.timeDebuffs); },
    tip: '外生冲击可以让时间降到0。一半创作者退出是因为"现实太忙"——时间约束独立于热情预算，是最硬的硬约束。',
    weight: 4, when: () => true, maxTotal: 2,
  },
  // --- 加班/赶DDL ---
  {
    id: 'overtime', emoji: '⏰', title: '连续加班/赶论文',
    desc: '这段时间完全被工作或学业占满，几乎没有私人时间...',
    effect: '时间-4h（持续2回合）', effectClass: 'negative',
    apply: (s) => { s.timeDebuffs.push({ id: 'overtime', reason: '加班/赶DDL', turnsLeft: 2, delta: -4 }); s.time = computeEffectiveTime(s.turn, s.timeDebuffs); },
    tip: '当时间降到0时，什么创作也做不了，只能选择休息等待忙碌过去。',
    weight: 7, when: (s) => s.turn > 1, maxTotal: Infinity,
  },
  // --- 假期 ---
  {
    id: 'holiday', emoji: '🌴', title: '一段悠闲时光',
    desc: '难得的闲暇，可以专心创作。',
    effect: '时间+2h(2回合) 热情+8', effectClass: 'positive',
    apply: (s) => { s.timeDebuffs.push({ id: 'holiday', reason: '悠闲时光', turnsLeft: 2, delta: 2 }); s.time = computeEffectiveTime(s.turn, s.timeDebuffs); s.passion = Math.min(100, s.passion + 8); },
    tip: '同人本创作需要"成块的连续时间"。',
    weight: 10, when: () => true, maxTotal: Infinity,
  },
  // --- 同人展 ---
  {
    id: 'doujin_event', emoji: '🎪', title: '同人展开催！',
    desc: '本地同人展即将举办！面对面贩售，信息披露自动拉满。',
    effect: '声誉+0.2 资金+200 信息↑', effectClass: 'positive',
    apply: (s) => { s.reputation += 0.2; s.money += 200; s.infoDisclosure = Math.min(1, s.infoDisclosure + 0.3); },
    tip: '同人展是信息密集的面对面交易——消费者直接翻阅实物',
    weight: 8, when: (s) => s.totalHVP > 0 || s.totalLVP > 0, maxTotal: Infinity,
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
    tip: '经济下行不是一次性冲击。同人本是弱奢侈品(收入弹性≈1.06)，超量消费被持续压缩。承诺消费提供底线保护，但上限被大幅削减。',
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
    weight: 5, when: (s) => s.turn > 18 && (s.totalHVP > 0 || s.totalLVP > 0), maxTotal: Infinity,
  },
  // --- 收到长评 ---
  {
    id: 'fanmail', emoji: '💌', title: '收到热情长评！',
    desc: '一位读者写了很长的感想，详细描述了你的作品给TA带来的感动...',
    effect: '热情+15', effectClass: 'positive',
    apply: (s) => { s.passion = Math.min(100, s.passion + 15); },
    tip: '社群反馈是热情预算的重要补充来源。一封走心的长评可以抵消很多现实消耗。',
    weight: 10, when: (s) => s.reputation > 1 && (s.totalHVP > 0 || s.totalLVP > 0), maxTotal: Infinity,
  },
  // --- 印刷成本上涨 ---
  {
    id: 'inflation', emoji: '💸', title: '印刷成本上涨',
    desc: '原材料涨价，印刷和制作成本提高了...',
    effect: '资金-400', effectClass: 'negative',
    apply: (s) => { s.money -= 400; },
    tip: '通胀从两个方向夹击多样性：降低同人谷声誉稳态，同时抬高同人本准入门槛。',
    weight: 5, when: (s) => s.totalHVP > 0 || s.totalLVP > 0, maxTotal: Infinity,
  },
  // --- 感情变动：大学期间最多2次 ---
  {
    id: 'uni_breakup', emoji: '💔', title: '感情变动',
    desc: '一段感情的开始或结束占据了你大量的心理能量...',
    effect: '热情-12', effectClass: 'negative',
    apply: (s) => { s.passion -= 12; },
    tip: '热情预算不仅被创作消耗，还被生活中的情绪事件消耗。',
    weight: 4, when: (s) => getLifeStage(s.turn) === 'university', maxTotal: 2,
  },
  // --- 工作：升职加薪 ---
  {
    id: 'work_raise', emoji: '📈', title: '升职加薪！',
    desc: '工作表现不错，获得了加薪。但责任更重，时间更少...',
    effect: '资金+1000 时间-1h（永久）', effectClass: 'neutral',
    apply: (s) => { s.money += 1000; s.timeDebuffs.push({ id: 'promotion', reason: '升职加责', turnsLeft: 999, delta: -1 }); s.time = computeEffectiveTime(s.turn, s.timeDebuffs); },
    tip: '高收入者的时间机会成本更高。',
    weight: 4, when: (s) => getLifeStage(s.turn) === 'work' && !s.unemployed, maxTotal: 3,
  },
  // --- 工作：996 ---
  {
    id: 'work_996', emoji: '🏢', title: '996加班季',
    desc: '项目紧急，公司要求全员加班。几乎没有私人时间...',
    effect: '时间-4h(3回合) 资金+500', effectClass: 'negative',
    apply: (s) => { s.timeDebuffs.push({ id: '996', reason: '996加班', turnsLeft: 3, delta: -4 }); s.time = computeEffectiveTime(s.turn, s.timeDebuffs); s.money += 500; },
    tip: '滞胀特征：需要更多工作时间维持生活',
    weight: 7, when: (s) => getLifeStage(s.turn) === 'work' && !s.unemployed, maxTotal: Infinity,
  },
  // === Endowment-gated events ===
  {
    id: 'inspiration_burst', emoji: '✨', title: '灵感爆发！',
    desc: '你的创作天赋在某个瞬间被点燃，脑海中涌现出绝妙的创意！',
    effect: '热情+8 声誉+0.2', effectClass: 'positive',
    apply: (s) => { s.passion = Math.min(100, s.passion + 8); s.reputation += 0.2; },
    tip: '创作天赋高的创作者更容易进入"心流"状态。这种突发灵感是内在动机的体现',
    weight: 4, when: (s) => (s.endowments.talent || 0) >= 2 && (s.totalHVP > 0 || s.totalLVP > 0), maxTotal: Infinity,
  },
  {
    id: 'creative_block', emoji: '🧱', title: '创作瓶颈',
    desc: '怎么画都不满意，反复推翻重来...感觉自己江郎才尽了。',
    effect: '热情-6', effectClass: 'negative',
    apply: (s) => { s.passion = Math.max(0, s.passion - 6); },
    tip: '创作天赋低的创作者更容易遭遇瓶颈。',
    weight: 5, when: (s) => (s.endowments.talent || 0) <= 1 && s.totalHVP > 0, maxTotal: Infinity,
  },
  {
    id: 'health_issue', emoji: '🤒', title: '身体不适',
    desc: '最近免疫力下降，生了一场病，需要好好休息...',
    effect: '热情-5 时间-2h(2回合)', effectClass: 'negative',
    apply: (s) => { s.passion = Math.max(0, s.passion - 5); s.timeDebuffs.push({ id: 'sick', reason: '身体不适', turnsLeft: 2, delta: -2 }); s.time = computeEffectiveTime(s.turn, s.timeDebuffs); },
    tip: '体力精力低的创作者更容易生病。身体是革命的本钱。',
    weight: 4, when: (s) => (s.endowments.stamina || 0) <= 1, maxTotal: 3,
  },
  {
    id: 'energy_surge', emoji: '🔥', title: '精力充沛！',
    desc: '最近状态特别好，精力旺盛，感觉什么都能做！',
    effect: '热情+6', effectClass: 'positive',
    apply: (s) => { s.passion = Math.min(100, s.passion + 6); },
    tip: '体力禀赋高的人恢复速度快、消耗低。同样的创作行为，不同人的精力消耗截然不同。',
    weight: 3, when: (s) => (s.endowments.stamina || 0) >= 2, maxTotal: Infinity,
  },
  {
    id: 'friend_intro', emoji: '💬', title: '朋友介绍了靠谱搭档',
    desc: '你的社交圈帮你找到了一位口碑很好的创作者，TA愿意合作！',
    effect: '自动获得优质搭档(3个月·免稿费)', effectClass: 'positive',
    apply: (s) => { if (!s.hasPartner) { s.hasPartner = true; s.partnerType = 'supportive'; s.partnerTurns = 3; s.partnerFee = 0; } },
    tip: '社交魅力高→搜寻成本低。协作可得性随社交网络递增。',
    weight: 3, when: (s) => (s.endowments.social || 0) >= 2 && !s.hasPartner, maxTotal: 2,
  },
  {
    id: 'viral_post', emoji: '📱', title: '帖子意外火了！',
    desc: '你随手发的一条动态获得了大量转发，信息扩散到了意想不到的范围！',
    effect: '信息+30% 声誉+0.15', effectClass: 'positive',
    apply: (s) => { s.infoDisclosure = Math.min(1, s.infoDisclosure + 0.3); s.reputation += 0.15; },
    tip: '营销直觉高的创作者更善于制造传播点。信息披露是比声誉更直接的转化驱动力。',
    weight: 3, when: (s) => (s.endowments.marketing || 0) >= 2 && (s.totalHVP > 0 || s.totalLVP > 0), maxTotal: Infinity,
  },
  {
    id: 'promo_fail', emoji: '🙈', title: '宣传翻车...',
    desc: '发了一条宣传但措辞不当，引发了一些争议...',
    effect: '声誉-0.1 信息+10%(黑红也是红)', effectClass: 'negative',
    apply: (s) => { s.reputation = Math.max(0, s.reputation - 0.1); s.infoDisclosure = Math.min(1, s.infoDisclosure + 0.1); },
    tip: '营销直觉低的人更容易踩雷。信息披露是双刃剑——不当宣传会带来负面注意力，但"黑红也是红"确实会提升曝光度。',
    weight: 4, when: (s) => (s.endowments.marketing || 0) <= 1 && s.infoDisclosure > 0.3 && (s.totalHVP > 0 || s.totalLVP > 0), maxTotal: Infinity,
  },
  {
    id: 'harsh_review', emoji: '😤', title: '遭遇恶评',
    desc: '有人公开发了一篇针对你的尖锐批评，言辞很伤人...',
    effect: '热情-10', effectClass: 'negative',
    apply: (s) => { s.passion = Math.max(0, s.passion - (10 - (s.endowments.resilience || 0) * 2)); },
    tip: '心理韧性低的人对负面反馈更敏感。',
    weight: 5, when: (s) => s.reputation > 0.5 && (s.totalHVP > 0 || s.totalLVP > 0), maxTotal: Infinity,
  },
  // === Speculator & secondhand market events (frmn.md) ===
  {
    id: 'speculator_rush', emoji: '📈', title: '投机客涌入二手市场！',
    desc: '有人发现圈内某些旧作价格在涨，大量投机客开始囤货。二手市场价格被推高，普通消费者被挤出...',
    effect: '二手压力暂降 收藏品增值', effectClass: 'neutral',
    apply: (s) => {
      if (s.official) {
        s.official.secondHandPool.lvp = Math.floor(s.official.secondHandPool.lvp * 0.5);
        s.official.secondHandPool.hvp = Math.floor(s.official.secondHandPool.hvp * 0.6);
      }
    },
    tip: '投机客买的不是内容，而是押注稀缺性溢价。当他们涌入时，二手池被清空（压力降低），但普通消费者被挤出。',
    weight: 3, when: (s) => s.turn > 12 && s.official && (s.official.secondHandPool.lvp > 10 || s.official.secondHandPool.hvp > 5), maxTotal: Infinity,
  },
  {
    id: 'bubble_burst', emoji: '💥', title: '二手泡沫破裂！',
    desc: '投机客集体抛售，大量二手商品涌入市场，价格暴跌！新品销量也受到冲击...',
    effect: '二手压力大幅上升 同人谷销量受挫', effectClass: 'negative',
    apply: (s) => {
      if (s.official) {
        s.official.secondHandPool.lvp += Math.floor((s.market?.communitySize || 10000) * 0.01);
        s.official.secondHandPool.hvp += Math.floor((s.market?.communitySize || 10000) * 0.003);
      }
    },
    tip: '泡沫破裂时，投机客理性泡沫B归零，价格回落到基础价值F。大量抛售使二手池膨胀，同人谷受冲击最大。',
    weight: 2, when: (s) => s.turn > 18 && (s.eventCounts['speculator_rush'] || 0) > 0, maxTotal: 3,
  },
  {
    id: 'rare_work_found', emoji: '💎', title: '你的旧作成了海景房！',
    desc: '你早期的一件作品因为绝版和声誉加持，在二手市场上被炒到了高价。有人愿意出高价向你求购签名版...',
    effect: '资金+声誉加成 声誉+0.3', effectClass: 'positive',
    apply: (s) => {
      const bonus = 500 + Math.round(s.maxReputation * 200);
      s.money += bonus;
      s.reputation += 0.3;
    },
    tip: '当一手市场关闭（绝版），无套利上限被打破，商品从消费品相变为金融资产。声誉越高，基础定价F越高。这就是"富有声誉的创作者退坑被视作看涨期权"——你的旧作因稀缺性而升值。',
    weight: 2, when: (s) => s.maxReputation >= 2 && s.totalHVP >= 2 && s.turn > 24, maxTotal: 3,
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
    const basRestore = 15 + Math.floor(Math.random() * 10) + (state.endowments.stamina || 0) * 3; // stamina bonus
    const fatigueMult = Math.max(0.35, 1 - yearsIn * 0.06);   // Y0=100%, Y3=82%, Y5=70%, Y10+=35%
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
    const mktBonus = 1 + (state.endowments.marketing || 0) * 0.12; // marketing endowment
    const scaledGain = rawGain * mktBonus / sigCost;
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
    const prob = Math.min(0.9, state.reputation / (state.reputation + 3) + (state.endowments.social || 0) * 0.08);
    if (Math.random() < prob) {
      const pType = rollPartnerType(state.endowments.social || 0);
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
    // === ATTEND DOUJIN EVENT — now sells directly from inventory ===
    const evt = state.attendingEvent || (state.availableEvents && state.availableEvents[0]);
    if (evt) {

      // --- Event cancelled (流展) ---
      if (evt.condition === 'cancelled') {
        state.money -= evt.travelCost;
        state.passion = Math.max(0, state.passion - 5);
        result.deltas.push({ icon: '😱', label: `${evt.name}@${evt.city} 流展！`, value: '白跑一趟', positive: false });
        result.deltas.push({ icon: '💰', label: '路费（沉没成本）', value: `-¥${evt.travelCost}`, positive: false });
        result.deltas.push({ icon: '❤️', label: '白忙一场的沮丧', value: '-5', positive: false });
        state.attendingEvent = null;
        result.tip = { label: '流展风险', text: '展会因故取消是同人创作者面临的真实风险。路费变成沉没成本，无法追回。经济学告诉我们：不要因为已经花了路费就做出非理性决策——关键是接下来怎么安排。' };
        // Skip all selling logic below
      } else {

      const mode = state._eventMode || 'attend'; // 'attend' = 亲参, 'consign' = 寄售
      state._eventMode = null;
      const isAttend = mode === 'attend';
      const mg = isAttend ? state._minigameResult : null;
      state._minigameResult = null;

      // Fatigue only applies to 亲参
      let eventFatigue = 1.0;
      if (isAttend) {
        state.recentEventTurns.push(state.turn);
        const recentCount = state.recentEventTurns.filter(t => state.turn - t < 6).length;
        eventFatigue = recentCount <= 2 ? 1.0 : Math.max(0.4, 1.0 - (recentCount - 2) * 0.2);
      }

      if (isAttend && mg) {
        // === 亲参 with minigame ===
        state.passion -= 5;
        state.money -= evt.travelCost + mg.moneySpent;
        const fatiguePassion = Math.round(mg.passionDelta * eventFatigue);
        state.passion = Math.min(100, state.passion + fatiguePassion);
        state.reputation += mg.reputationDelta;
        state.maxReputation = Math.max(state.maxReputation, state.reputation);
        state.attendingEvent = { ...evt, salesBoost: mg.salesMultiplier };

        result.deltas.push({ icon: '🏪', label: `亲参 ${evt.name}@${evt.city}`, value: `表现${mg.performance}分`, positive: mg.performance >= 50 });
        result.deltas.push({ icon: '💰', label: '路费' + (mg.moneySpent > 0 ? '+无料费' : ''), value: `-¥${evt.travelCost + mg.moneySpent}`, positive: false });
        result.deltas.push({ icon: '❤️', label: '展会热情', value: `${fatiguePassion > 0 ? '+' : ''}${fatiguePassion}`, positive: fatiguePassion > 0 });
        if (eventFatigue < 1) {
          const rc = state.recentEventTurns.filter(t => state.turn - t < 6).length;
          result.deltas.push({ icon: '😮‍💨', label: `连续亲参疲劳(近6月第${rc}次)`, value: `热情效率${Math.round(eventFatigue * 100)}%`, positive: false });
        }
        if (evt.condition === 'popular') {
          result.deltas.push({ icon: '🔥', label: '人气爆棚！人流超出预期', value: '', positive: true });
        }
      } else if (isAttend) {
        // === 亲参 but skipped minigame ===
        state.passion -= 5;
        state.money -= evt.travelCost;
        const fatigueBoost = Math.round(evt.passionBoost * eventFatigue);
        state.passion = Math.min(100, state.passion + fatigueBoost);
        state.reputation += evt.reputationBoost;
        state.maxReputation = Math.max(state.maxReputation, state.reputation);
        state.attendingEvent = evt;
        result.deltas.push({ icon: '🏪', label: `亲参 ${evt.name}@${evt.city}`, value: '(快速结算)', positive: true });
        result.deltas.push({ icon: '💰', label: '路费', value: `-¥${evt.travelCost}`, positive: false });
      } else {
        // === 寄售 (consignment) ===
        const shipCost = Math.round(evt.travelCost * 0.3);
        state.passion -= 2;
        state.money -= shipCost;
        state.attendingEvent = evt; // for calculateSales event boost
        result.deltas.push({ icon: '📦', label: `寄售 ${evt.name}@${evt.city}`, value: '委托代售', positive: true });
        result.deltas.push({ icon: '💰', label: '邮寄费用', value: `-¥${shipCost}`, positive: false });
      }

      // === SELL FROM INVENTORY AT EVENT ===
      let eventRevenue = 0;
      let totalEventSold = 0;

      if (isAttend && mg && mg.sold > 0) {
        // 亲参: minigame sold count is the actual sales (player saw it happen)
        const mgSold = mg.sold;
        const totalStock = state.inventory.hvpStock + state.inventory.lvpStock;
        const actualSold = Math.min(mgSold, totalStock);

        // Distribute sales proportionally between HVP and LVP stock
        if (actualSold > 0 && totalStock > 0) {
          const hvpRatio = state.inventory.hvpStock / totalStock;
          const hvpSold = Math.min(Math.round(actualSold * hvpRatio), state.inventory.hvpStock);
          const lvpSold = Math.min(actualSold - hvpSold, state.inventory.lvpStock);

          if (hvpSold > 0) {
            state.inventory.hvpStock -= hvpSold;
            const hvpRev = hvpSold * state.inventory.hvpPrice;
            eventRevenue += hvpRev;
            totalEventSold += hvpSold;
            state.totalSales += hvpSold;
            result.deltas.push({ icon: '📖', label: `同人本售出 ${hvpSold}本`, value: `+¥${hvpRev}`, positive: true });
            const repGain = 0.35 * state.infoDisclosure * hvpSold * 0.1;
            state.reputation += repGain;
            state.maxReputation = Math.max(state.maxReputation, state.reputation);
            if (state.official) recordPlayerWork(state.official, 'hvp', state.turn, state.reputation, hvpSold);
          }
          if (lvpSold > 0) {
            state.inventory.lvpStock -= lvpSold;
            const lvpRev = lvpSold * state.inventory.lvpPrice;
            eventRevenue += lvpRev;
            totalEventSold += lvpSold;
            state.totalSales += lvpSold;
            result.deltas.push({ icon: '🔑', label: `谷子售出 ${lvpSold}个`, value: `+¥${lvpRev}`, positive: true });
            const repGain = 0.04 * state.infoDisclosure * lvpSold * 0.1;
            state.reputation += repGain;
            state.maxReputation = Math.max(state.maxReputation, state.reputation);
            if (state.official) recordPlayerWork(state.official, 'lvp', state.turn, state.reputation, lvpSold);
          }
        }
      } else {
        // 寄售 or 亲参快速结算: use CES model
        if (state.inventory.hvpStock > 0) {
          state.playerPrice.hvp = state.inventory.hvpPrice;
          const sales = calculateSales('hvp', state);
          const hvpSold = Math.min(sales.hvpSales, state.inventory.hvpStock);
          state.inventory.hvpStock -= hvpSold;
          const hvpRev = hvpSold * state.inventory.hvpPrice;
          eventRevenue += hvpRev;
          totalEventSold += hvpSold;
          state.totalSales += hvpSold;
          result.salesInfo = sales;
          result.supplyDemand = getSupplyDemandData(state, sales);
          result.deltas.push({ icon: '📖', label: `同人本售出 ${hvpSold}本`, value: `+¥${hvpRev}`, positive: true });
          if (sales.hvpSales > hvpSold) result.deltas.push({ icon: '🔥', label: '同人本售罄！', value: `需求${sales.hvpSales}·库存仅${hvpSold}`, positive: false });
          const repGain = 0.35 * state.infoDisclosure * hvpSold * 0.1;
          state.reputation += repGain;
          state.maxReputation = Math.max(state.maxReputation, state.reputation);
          if (state.official) recordPlayerWork(state.official, 'hvp', state.turn, state.reputation, hvpSold);
        }
        if (state.inventory.lvpStock > 0) {
          state.playerPrice.lvp = state.inventory.lvpPrice;
          const sales = calculateSales('lvp', state);
          const lvpSold = Math.min(sales.lvpSales, state.inventory.lvpStock);
          state.inventory.lvpStock -= lvpSold;
          const lvpRev = lvpSold * state.inventory.lvpPrice;
          eventRevenue += lvpRev;
          totalEventSold += lvpSold;
          state.totalSales += lvpSold;
          if (!result.salesInfo) { result.salesInfo = sales; result.supplyDemand = getSupplyDemandData(state, sales); }
          result.deltas.push({ icon: '🔑', label: `谷子售出 ${lvpSold}个`, value: `+¥${lvpRev}`, positive: true });
          if (sales.lvpSales > lvpSold) result.deltas.push({ icon: '🔥', label: '谷子售罄！', value: `需求${sales.lvpSales}·库存仅${lvpSold}`, positive: false });
          const repGain = 0.04 * state.infoDisclosure * lvpSold * 0.1;
          state.reputation += repGain;
          state.maxReputation = Math.max(state.maxReputation, state.reputation);
          if (state.official) recordPlayerWork(state.official, 'lvp', state.turn, state.reputation, lvpSold);
        }
      }

      // Bundling bonus: selling both HVP and LVP at same event
      if (state.inventory.hvpStock >= 0 && state.inventory.lvpStock >= 0 && totalEventSold > 0 && state.totalHVP > 0 && state.totalLVP > 0) {
        const bundleBonus = Math.round(eventRevenue * 0.1);
        if (bundleBonus > 0) {
          eventRevenue += bundleBonus;
          result.deltas.push({ icon: '🎯', label: '本+谷联动加成', value: `+¥${bundleBonus}`, positive: true });
        }
      }

      state.money += eventRevenue;
      state.totalRevenue += eventRevenue;

      if (eventRevenue > 0) {
        const travelCost = evt.travelCost + (mg ? mg.moneySpent : 0);
        const profit = eventRevenue - travelCost;
        result.deltas.push({ icon: '💰', label: '展会利润', value: profit >= 0 ? `+¥${profit}` : `-¥${Math.abs(profit)}`, positive: profit >= 0 });
      }
      // Log event for dashboard
      state.eventLog.push({ turn: state.turn, name: evt.name, city: evt.city, revenue: eventRevenue, sold: totalEventSold, condition: evt.condition || 'normal' });

      // Event emotional amplification
      if (totalEventSold >= 15) {
        const boost = Math.round(5 + totalEventSold * 0.3);
        state.passion = Math.min(100, state.passion + boost);
        result.deltas.push({ icon: '🎉', label: '展会大卖！情绪高涨', value: `热情+${boost}`, positive: true });
      } else if (totalEventSold <= 2 && (state.inventory.hvpStock > 0 || state.inventory.lvpStock > 0)) {
        const hit = -10 - Math.round(evt.travelCost / 150);
        state.passion = Math.max(0, state.passion + hit);
        result.deltas.push({ icon: '😞', label: '展会惨淡...花了路费却卖不出去', value: `热情${hit}`, positive: false });
      }

      // Show remaining inventory
      result.deltas.push({ icon: '📦', label: '剩余库存', value: `本${state.inventory.hvpStock} 谷${state.inventory.lvpStock}`, positive: state.inventory.hvpStock > 0 || state.inventory.lvpStock > 0 });

      // Community feedback from face-to-face interaction
      const feedback = calculateFeedback(state);
      state.passion = Math.min(100, state.passion + feedback);
      if (feedback > 0.5) result.deltas.push({ icon: '💬', label: '现场交流反馈', value: `热情+${feedback.toFixed(1)}`, positive: true });

      // Clear event (selling happens immediately at the event)
      state.attendingEvent = null;
      result.tip = TIPS.doujinEvent;

      // Clean up old event turn records (keep last 12 months)
      state.recentEventTurns = state.recentEventTurns.filter(t => state.turn - t < 12);
      } // end non-cancelled branch
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
    state.passion -= Math.max(8, 15 - (state.endowments.stamina || 0)); // stamina reduces HVP cost
    result.deltas.push({ icon: '❤️', label: '本月创作消耗', value: '-15', positive: false });

    if (!state.hvpProject) {
      // Start new project with subtype
      const subtypeId = state._selectedHVPSubtype || 'manga';
      state._selectedHVPSubtype = null;
      const sub = HVP_SUBTYPES[subtypeId] || HVP_SUBTYPES.manga;
      const skill = getCreativeSkill(state);
      const fx = getSkillEffects(skill);
      let soloNeeded = sub.monthsSolo;
      if (fx.soloHVPMonths < 3 && soloNeeded >= 3) soloNeeded--; // mastery -1 month
      const needed = state.hasPartner ? sub.monthsPartner : soloNeeded;
      const [costMin, costMax] = sub.costRange;
      const printCost = costMin + Math.floor(Math.random() * (costMax - costMin));
      state.hvpProject = { progress: 1, needed, printCost, subtype: subtypeId, workQuality: 1.0, styleTag: null, choices: [], isCultHit: false };

      // Apply pending creative choices (theme from UI flow)
      if (state._pendingChoices) {
        for (const c of state._pendingChoices) applyCreativeChoice(state.hvpProject, c.category, c.optionId);
        state._pendingChoices = null;
      }

      result.deltas.push({ icon: sub.emoji, label: `开始创作${sub.name}！`, value: `进度 1/${needed}`, positive: true });
      if (state.hvpProject.styleTag) result.deltas.push({ icon: '🎭', label: `风格：${state.hvpProject.styleTag}`, value: '', positive: true });
      if (state.hasPartner) {
        result.deltas.push({ icon: '🤝', label: '搭档协作', value: `${needed}个月完成`, positive: true });
        if (state.partnerFee > 0) result.deltas.push({ icon: '💰', label: '预计搭档稿费', value: `¥${state.partnerFee}（完成时付）`, positive: false });
      }
      result.tip = TIPS.hvpStart;
    } else {
      // Continue project
      // Apply any pending creative choices from UI flow
      if (state._pendingChoices) {
        for (const c of state._pendingChoices) applyCreativeChoice(state.hvpProject, c.category, c.optionId);
        // Extra passion cost from "polish" choice
        if (state.hvpProject._extraPassionCost) {
          state.passion -= state.hvpProject._extraPassionCost;
          result.deltas.push({ icon: '✨', label: '精雕细琢的额外消耗', value: `-${state.hvpProject._extraPassionCost}`, positive: false });
          state.hvpProject._extraPassionCost = 0;
        }
        state._pendingChoices = null;
      }
      state.hvpProject.progress++;
      const p = state.hvpProject;
      if (p.progress >= p.needed) {
        // === HVP COMPLETE → ADD TO INVENTORY ===
        // Clear project FIRST to prevent stuck state if anything below errors
        const savedProject = { ...p };
        state.hvpProject = null;

        // Skill-based learning curve (Arrow 1962)
        const skill = getCreativeSkill(state);
        const fx = getSkillEffects(skill);

        const costMult = (state.recessionTurnsLeft > 0 ? 1.2 : 1.0) * getAdvancedCostMod(state.advanced);
        const talentDiscount = 1 - (state.endowments.talent || 0) * 0.05;
        const skillDiscount = 1 - fx.costReduction; // learning curve reduces cost
        const printCost = Math.round(savedProject.printCost * costMult * talentDiscount * skillDiscount);
        const partnerCost = state.hasPartner ? state.partnerFee : 0;
        const totalCost = printCost + partnerCost;
        state.money -= totalCost;

        // Calculate batch size and add to inventory
        const batchQty = Math.max(20, Math.round(printCost / 50));
        const hvpPrice = state.playerPrice.hvp || 50;
        state.inventory.hvpPrice = hvpPrice;
        // Add to works array
        const subInfo = HVP_SUBTYPES[savedProject.subtype] || HVP_SUBTYPES.manga;
        state.inventory.works.push({
          id: state.inventory.nextWorkId++,
          type: 'hvp', subtype: savedProject.subtype || 'manga',
          qty: batchQty, price: hvpPrice,
          workQuality: savedProject.workQuality || 1.0,
          styleTag: savedProject.styleTag || null,
          isCultHit: savedProject.isCultHit || false,
          turn: state.turn,
        });
        state.inventory.hvpStock += batchQty;
        syncInventoryAggregates(state);

        result.deltas.push({ icon: subInfo.emoji, label: `${subInfo.name}完成！`, value: '', positive: true });
        const costLabels = [];
        if (costMult > 1) costLabels.push('下行+20%');
        if (fx.costReduction > 0.01) costLabels.push(`熟练-${Math.round(fx.costReduction * 100)}%`);
        result.deltas.push({ icon: '🖨️', label: `印刷成本${costLabels.length ? '(' + costLabels.join(' ') + ')' : ''}`, value: `-¥${printCost}`, positive: false });
        if (partnerCost > 0) result.deltas.push({ icon: '🤝', label: '搭档稿费', value: `-¥${partnerCost}`, positive: false });
        result.deltas.push({ icon: '📦', label: `印刷${batchQty}本入库`, value: `库存${state.inventory.hvpStock}本 定价¥${state.inventory.hvpPrice}`, positive: true });

        // Anti-speculator strategy (frmn.md: creator countermeasures)
        const strategy = state._antiSpecStrategy || 'normal';
        state._antiSpecStrategy = null;
        if (strategy === 'unlimited') {
          // 不限量：投机客无法预估存量，泡沫项趋近于零
          if (state.official) state.official.secondHandPool.hvp = Math.floor(state.official.secondHandPool.hvp * 0.7);
          result.deltas.push({ icon: '♾️', label: '不限量发售·抑制投机', value: '同人本二手市场压力下降', positive: true });
        } else if (strategy === 'signed') {
          // To签定制：流通因子降低，二手转售价值断崖
          if (state.official) state.official.secondHandPool.hvp = Math.max(0, state.official.secondHandPool.hvp - 3);
          result.deltas.push({ icon: '✍️', label: 'To签限定·切断二手流通', value: '同人本二手市场压力下降 声誉+', positive: true });
          state.reputation += 0.1;
        } else if (strategy === 'digital') {
          // 同时发电子版：内容效用被低成本满足，投机买家减少
          if (state.official) state.official.secondHandPool.hvp = Math.floor(state.official.secondHandPool.hvp * 0.8);
          const digiRev = Math.round(batchQty * state.inventory.hvpPrice * 0.3);
          state.money += digiRev;
          result.deltas.push({ icon: '📱', label: '同步电子版', value: `电子版收入+¥${digiRev}`, positive: true });
        }

        // Reputation gain — skill boosts quality → more reputation
        const repGain = 0.15 * state.infoDisclosure * (1 + (state.endowments.talent || 0) * 0.15) * fx.repBonus;
        state.reputation += repGain;
        state.maxReputation = Math.max(state.maxReputation, state.reputation);
        result.deltas.push({ icon: '⭐', label: '新作声誉', value: `+${repGain.toFixed(2)}`, positive: true });

        // Community feedback (people know you released something new)
        const feedback = calculateFeedback(state);
        state.passion = Math.min(100, state.passion + feedback);
        result.deltas.push({ icon: '💬', label: '社群反馈', value: `热情+${feedback.toFixed(1)}`, positive: feedback > 0 });

        state.totalHVP++;

        // Breakthrough chance — skill makes occasional masterpieces possible
        if (Math.random() < fx.breakthroughChance) {
          const bkRep = 0.3 + skill * 0.1;
          const bkPassion = 10 + Math.round(skill * 2);
          state.reputation += bkRep;
          state.maxReputation = Math.max(state.maxReputation, state.reputation);
          state.passion = Math.min(100, state.passion + bkPassion);
          result.deltas.push({ icon: '✨', label: '突破之作！质量超出预期', value: `声誉+${bkRep.toFixed(1)} 热情+${bkPassion}`, positive: true });
          result.tip = { label: '✨ 学习曲线突破', text: `累计创作${state.totalHVP}本同人志，你的技艺已达到${getSkillLabel(skill)}级（${skill.toFixed(1)}）。学习曲线理论预测：累计产出越多，生产效率越高、品质越稳定。偶尔的突破之作是量变引发质变的证明——这就是为什么"坚持创作"比"等灵感来"更靠谱。` };
        } else {
          result.tip = TIPS.hvpComplete;
        }
        if (state.passion < 30) result.tip = TIPS.burnout;
      } else {
        result.deltas.push({ icon: '📖', label: '继续创作中...', value: `进度 ${p.progress}/${p.needed}`, positive: true });
        result.tip = TIPS.hvpContinue;
      }
    }

  } else if (action.type === 'lvp') {
    // === LVP: single-turn → ADD TO INVENTORY (with subtype + process choice) ===
    const subtypeId = state._selectedLVPSubtype || 'acrylic';
    state._selectedLVPSubtype = null;
    const sub = LVP_SUBTYPES[subtypeId] || LVP_SUBTYPES.acrylic;
    const processChoice = state._lvpProcessChoice || 'standard';
    state._lvpProcessChoice = null;
    const pfx = CHOICE_EFFECTS[processChoice] || CHOICE_EFFECTS.standard;
    const lvpQuality = Math.max(0.5, Math.min(1.8, 1.0 + (pfx.qualityMod || 0)));

    const skill = getCreativeSkill(state);
    const fx = getSkillEffects(skill);

    state.passion -= 8;
    const costMult = state.recessionTurnsLeft > 0 ? 1.2 : 1.0;
    const skillDiscount = 1 - fx.costReduction;
    const actualCost = Math.round(sub.cost * (pfx.costMod || 1.0) * costMult * skillDiscount);
    state.money -= actualCost;
    result.deltas.push({ icon: '❤️', label: '创作消耗', value: '-8', positive: false });
    const lvpCostLabels = [];
    if (costMult > 1) lvpCostLabels.push('下行+20%');
    if (fx.costReduction > 0.01) lvpCostLabels.push(`熟练-${Math.round(fx.costReduction * 100)}%`);
    if ((pfx.costMod || 1) !== 1) lvpCostLabels.push(pfx.costMod > 1 ? '精装' : '简装');
    result.deltas.push({ icon: '💰', label: `制作成本${lvpCostLabels.length ? '(' + lvpCostLabels.join(' ') + ')' : ''}`, value: `-¥${actualCost}`, positive: false });

    // Calculate batch size with subtype + process modifier
    const batchQty = Math.max(5, Math.round(sub.batchSize * (pfx.batchMod || 1.0)));
    const lvpPrice = state.playerPrice.lvp || Math.round(15 * sub.marginMult);
    state.inventory.lvpPrice = lvpPrice;
    // Add to works array
    state.inventory.works.push({
      id: state.inventory.nextWorkId++,
      type: 'lvp', subtype: subtypeId,
      qty: batchQty, price: lvpPrice,
      workQuality: lvpQuality,
      styleTag: null, isCultHit: false,
      turn: state.turn,
    });
    state.inventory.lvpStock += batchQty;
    syncInventoryAggregates(state);

    result.deltas.push({ icon: sub.emoji, label: `${sub.name}×${batchQty}入库`, value: `库存${state.inventory.lvpStock}个 定价¥${lvpPrice}`, positive: true });

    state.totalLVP++;
    state.recentLVP = 1;

    // Reputation gain — skill boosts quality
    const repGain = 0.04 * state.infoDisclosure * (1 + (state.endowments.talent || 0) * 0.15) * fx.repBonus;
    state.reputation += repGain;
    state.maxReputation = Math.max(state.maxReputation, state.reputation);
    result.deltas.push({ icon: '⭐', label: '新品声誉', value: `+${repGain.toFixed(2)}`, positive: true });

    // Community feedback
    const feedback = calculateFeedback(state);
    state.passion = Math.min(100, state.passion + feedback);
    result.deltas.push({ icon: '💬', label: '社群反馈', value: `热情+${feedback.toFixed(1)}`, positive: feedback > 0 });

    // LVP breakthrough (rarer than HVP, half chance)
    if (Math.random() < fx.breakthroughChance * 0.5) {
      const bkRep = 0.15 + skill * 0.05;
      const bkPassion = 6 + Math.round(skill);
      state.reputation += bkRep;
      state.maxReputation = Math.max(state.maxReputation, state.reputation);
      state.passion = Math.min(100, state.passion + bkPassion);
      result.deltas.push({ icon: '✨', label: '精品谷子！超出预期的品质', value: `声誉+${bkRep.toFixed(1)} 热情+${bkPassion}`, positive: true });
    }
    result.tip = TIPS.lvp;

  } else if (action.type === 'reprint') {
    // === REPRINT: add more copies to inventory ===
    state.passion -= 3;
    result.deltas.push({ icon: '❤️', label: '安排印刷', value: '-3', positive: false });

    const reprintType = state._reprintType || (state.totalHVP > 0 ? 'hvp' : 'lvp');
    state._reprintType = null;

    if (reprintType === 'hvp' && state.totalHVP > 0) {
      const qty = 30;
      const unitCost = 40; // cheaper than first print (plates already made)
      const cost = qty * unitCost;
      state.money -= cost;
      state.inventory.hvpStock += qty;
      result.deltas.push({ icon: '🖨️', label: `追印同人本${qty}本`, value: `-¥${cost}`, positive: false });
      result.deltas.push({ icon: '📦', label: '库存更新', value: `同人本×${state.inventory.hvpStock} 定价¥${state.inventory.hvpPrice}`, positive: true });
    } else if (reprintType === 'lvp' && state.totalLVP > 0) {
      const qty = 20;
      const unitCost = 6;
      const cost = qty * unitCost;
      state.money -= cost;
      state.inventory.lvpStock += qty;
      result.deltas.push({ icon: '🖨️', label: `追加制作谷子${qty}个`, value: `-¥${cost}`, positive: false });
      result.deltas.push({ icon: '📦', label: '库存更新', value: `谷子×${state.inventory.lvpStock} 定价¥${state.inventory.lvpPrice}`, positive: true });
    }
    result.tip = { label: '库存管理', text: '追加印刷的单价比首印便宜（印版/模具已有）。关键是预判展会需求——印太多积压资金，印太少展会上售罄错失收入。真正的同人创作者都在学习的供应链管理。' };

  } else if (action.type === 'buyGoods') {
    // === BUY GOODS AS CONSUMER: spend money for passion ===
    const cost = 200;
    state.money -= cost;
    result.deltas.push({ icon: '💰', label: '购买谷子', value: `-¥${cost}`, positive: false });

    // Passion gain diminishes with: years in hobby + idle months without creating
    const yearsIn = state.turn / 12;
    const yearDecay = Math.max(0.3, 1 - yearsIn * 0.08);
    // If not creating, buying gives less joy — "只买不做" fatigue
    const idleMonths = state.turn - state.lastCreativeTurn;
    const idleDecay = idleMonths >= 3 ? Math.max(0.3, 1 - (idleMonths - 2) * 0.1) : 1.0;
    const efficiency = yearDecay * idleDecay;
    const passionGain = Math.max(2, Math.round(12 * efficiency));
    state.passion = Math.min(100, state.passion + passionGain);
    result.deltas.push({ icon: '❤️', label: '买到心仪的谷子！', value: `热情+${passionGain}`, positive: true });

    if (yearDecay < 0.8 || idleDecay < 1) {
      const reasons = [];
      if (yearDecay < 0.8) reasons.push('年限递减');
      if (idleDecay < 1) reasons.push(`已${idleMonths}月未创作`);
      result.deltas.push({ icon: '📉', label: reasons.join('+'), value: `效率${Math.round(efficiency * 100)}%`, positive: false });
    }

    // Small info disclosure gain (you're engaging with the community)
    state.infoDisclosure = Math.min(1, state.infoDisclosure + 0.05);
    result.deltas.push({ icon: '📢', label: '社群参与', value: `信息+5%`, positive: true });

    // Add to personal collection
    state.goodsCollection++;
    result.deltas.push({ icon: '📦', label: '加入收藏', value: `收藏品${state.goodsCollection}件`, positive: true });

    result.tip = { label: '消费者身份 (双重角色)', text: '同人创作者同时也是消费者——买别人的谷子是维持热情的重要方式。但随着入坑年限增加，新鲜感递减(边际效用递减)。购入的谷子日后也可以在二手市场出售回血。' };

  } else if (action.type === 'sellGoods') {
    // === SELL COLLECTION TO SECONDHAND MARKET ===
    if (state.goodsCollection <= 0) {
      result.deltas.push({ icon: '📤', label: '没有收藏品可出', value: '', positive: false });
    } else {
      // Sell up to 3 items per turn
      const sellQty = Math.min(3, state.goodsCollection);
      // Price depends on secondhand market pressure (low pressure = better price)
      const shPressure = state.official?.secondHandPressure?.lvp || 0;
      const unitPrice = Math.max(50, Math.round(120 * (1 - shPressure * 0.5)));
      const revenue = sellQty * unitPrice;
      state.goodsCollection -= sellQty;
      state.money += revenue;
      state.passion = Math.max(0, state.passion - 3); // slight emotional cost of letting go

      // Feeds secondhand pool
      if (state.official) state.official.secondHandPool.lvp += sellQty;

      result.deltas.push({ icon: '📤', label: `出售${sellQty}件收藏品`, value: `+¥${revenue}（¥${unitPrice}/件）`, positive: true });
      result.deltas.push({ icon: '❤️', label: '割爱之痛', value: '-3', positive: false });
      if (state.goodsCollection > 0) {
        result.deltas.push({ icon: '📦', label: '剩余收藏', value: `${state.goodsCollection}件`, positive: true });
      }
      result.tip = { label: '二手回血 (frmn.md)', text: `二手市场是跨期预算调节器。大部分会转化为对A类新作的购买力。二手价格受市场压力影响：当前同人谷二手压力${Math.round(shPressure * 100)}%，压力越大价格越低。` };
    }
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
  // Only actual creative/community actions reset the inactivity counter
  // buyGoods/reprint/sellGoods are NOT creative activity — buying stuff doesn't count as creating
  const isCreative = ['hvp', 'lvp', 'attendEvent'].includes(actionId)
    || (actionId === 'promote_heavy') // heavy promotion shows creative intent
    || (actionId === 'findPartner' && state.hasPartner);
  if (isCreative) state.lastCreativeTurn = state.turn;

  // --- Reality drain ---
  const rawDrain = getRealityDrain(state.turn);
  const drain = Math.max(0, rawDrain - (state.endowments.resilience || 0) * 0.5); // resilience reduces drain
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
  const debtThreshold = (state.endowments.resilience || 0) * 200; // resilience delays anxiety
  if (state.money < -debtThreshold) {
    const debtLevel = Math.abs(state.money) - debtThreshold;
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
    const bgMult = BACKGROUNDS[state.background]?.allowanceMult || 1.0;
    const allowance = Math.round((150 + Math.floor(Math.random() * 100)) * bgMult);
    state.money += allowance;
    result.deltas.push({ icon: '🏠', label: '生活费结余', value: `+¥${allowance}`, positive: true });
  } else if (stage === 'work') {
    if (state.unemployed) {
      // No salary — anxiety scales with search duration but savings provide buffer
      const baseAnxiety = 8 + state.jobSearchTurns * 2;
      // Savings buffer or debt amplifier
      let moneyMod; // <0 = amplify, >0 = buffer
      if (state.money > 0) {
        moneyMod = Math.min(0.6, state.money / 20000); // up to -60% anxiety
      } else {
        moneyMod = -Math.min(0.8, Math.abs(state.money) / 5000); // up to +80% anxiety
      }
      const anxietyDrain = Math.max(2, Math.round(baseAnxiety * (1 - moneyMod)));
      state.passion = Math.max(0, state.passion - anxietyDrain);
      result.deltas.push({ icon: '😰', label: '失业焦虑', value: `热情-${anxietyDrain}`, positive: false });
      if (moneyMod > 0.1) {
        result.deltas.push({ icon: '💰', label: `存款¥${state.money.toLocaleString()}缓冲焦虑`, value: `-${Math.round(moneyMod * 100)}%`, positive: true });
      } else if (moneyMod < -0.1) {
        result.deltas.push({ icon: '💸', label: `负债¥${Math.abs(state.money).toLocaleString()}加剧焦虑`, value: `+${Math.round(-moneyMod * 100)}%`, positive: false });
      }
      result.deltas.push({ icon: '💼', label: '无工资收入', value: '¥0', positive: false });
    } else {
      const bgSalaryMult = BACKGROUNDS[state.background]?.salaryMult || 1.0;
      const baseSalary = Math.round((800 + Math.floor((state.turn - 50) / 12) * 200) * bgSalaryMult);
      const salary = state.recessionTurnsLeft > 0 ? Math.floor(baseSalary * 0.8) : baseSalary; // recession cuts salary
      state.money += salary;
      state.monthlyIncome = salary;
      result.deltas.push({ icon: '💼', label: `工资${state.recessionTurnsLeft > 0 ? '(下行-20%)' : ''}`, value: `+¥${salary}`, positive: true });

      // Recession: risk of losing job each month
      const fireChance = Math.max(0.005, 0.06 - (BACKGROUNDS[state.background]?.fireResist || 0));
      if (state.recessionTurnsLeft > 0 && Math.random() < fireChance) {
        state.unemployed = true;
        state.jobSearchTurns = 0;
        state.time = 2; // minimal free time (all spent on survival)
        result.deltas.push({ icon: '🚨', label: '被裁员了！', value: '失业', positive: false });
        result.deltas.push({ icon: '📝', label: '只能"找工作"或"休息"', value: '', positive: false });
      }
    }
  }

  // --- Info disclosure: fast decay ---
  const infoDecay = 0.07 - (state.endowments.marketing || 0) * 0.01; // marketing slows decay
  state.infoDisclosure = Math.max(0.08, state.infoDisclosure - infoDecay);

  // --- Passive online sales (trickle from inventory each turn) ---
  if ((state.inventory.hvpStock > 0 || state.inventory.lvpStock > 0) && action.type !== 'attendEvent') {
    const cs = state.market ? state.market.communitySize : 10000;
    const nHVP = state.market?.nHVP || 9;
    const nLVP = state.market?.nLVP || 55;
    const baseConv = Math.min(0.95, 0.20 + state.infoDisclosure * 0.50);
    const onlineFactor = 0.12; // online sales are ~12% of full market demand

    if (state.inventory.hvpStock > 0) {
      const totalAlpha = nHVP * 2.0 + state.reputation;
      const share = totalAlpha > 0 ? state.reputation / totalAlpha : 0.1;
      const rawDemand = cs / 1000 * 5 * share * baseConv * onlineFactor;
      // Guarantee at least 1 sale if reputation > 0 and info > 0 (long tail online)
      const demand = Math.max(state.reputation > 0.1 && state.infoDisclosure > 0.08 ? 1 : 0, Math.round(rawDemand));
      const sold = Math.min(demand, state.inventory.hvpStock);
      if (sold > 0) {
        state.inventory.hvpStock -= sold;
        const rev = sold * state.inventory.hvpPrice;
        state.money += rev;
        state.totalRevenue += rev;
        state.totalSales += sold;
        const repGain = 0.35 * state.infoDisclosure * sold * 0.05;
        state.reputation += repGain;
        result.deltas.push({ icon: '🌐', label: `网上售出同人本×${sold}`, value: `+¥${rev}`, positive: true });
      }
    }

    if (state.inventory.lvpStock > 0) {
      const totalAlpha = nLVP * 0.5 + state.reputation;
      const share = totalAlpha > 0 ? state.reputation / totalAlpha : 0.1;
      const rawDemand = cs / 1000 * 15 * share * baseConv * onlineFactor;
      const demand = Math.max(state.reputation > 0.1 && state.infoDisclosure > 0.08 ? 1 : 0, Math.round(rawDemand));
      const sold = Math.min(demand, state.inventory.lvpStock);
      if (sold > 0) {
        state.inventory.lvpStock -= sold;
        const rev = sold * state.inventory.lvpPrice;
        state.money += rev;
        state.totalRevenue += rev;
        state.totalSales += sold;
        result.deltas.push({ icon: '🌐', label: `网上售出谷子×${sold}`, value: `+¥${rev}`, positive: true });
      }
    }
  }

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

  // --- Reset player price choices ---
  state.playerPrice = { hvp: null, lvp: null };
  // attendingEvent is cleared in the attendEvent handler itself

  // --- Record history snapshot ---
  const prevRev = state.history.length > 0 ? state.history[state.history.length - 1].cumRevenue : 0;
  state.history.push({
    turn: state.turn, money: state.money,
    reputation: Math.round(state.reputation * 100) / 100,
    passion: Math.round(state.passion),
    turnRevenue: state.totalRevenue - prevRev,
    cumRevenue: state.totalRevenue,
    action: actionId,
    hvpStock: state.inventory.hvpStock, lvpStock: state.inventory.lvpStock,
  });

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
    state.gameOverReason = generateEnding(state);
  } else {
    state.phase = 'result';
  }

  state.lastResult = result;
  return result;
}

// === Partner Drama ===
// === Personalized Ending Generator ===
function generateEnding(state) {
  const stage = getLifeStage(state.turn);
  const rep = state.maxReputation;
  const hvp = state.totalHVP;
  const rev = state.totalRevenue;
  const events = state.eventLog?.length || 0;
  const unemployed = state.unemployed;

  // Pick the most fitting ending based on player's journey
  if (unemployed && state.money < -500) {
    return '失业和债务的双重压力让你再也无法提起画笔。同人创作从生活的支柱变成了无法承受的奢侈……但那些作品里倾注的心血，读者不会忘记。';
  }
  if (stage === 'university' && hvp === 0 && state.totalLVP <= 1) {
    return '大学生活的丰富多彩最终让创作计划搁浅了。也许这只是一个"以后再说"的梦想——但谁知道呢，很多传奇创作者都是毕业后才真正开始的。';
  }
  if (rep >= 5 && hvp >= 3) {
    return `从声誉${rep.toFixed(1)}的高峰缓缓走下，你在圈内留下了${hvp}本同人志的印记。虽然热情最终还是燃尽了，但你的作品已经成为了这个圈子历史的一部分。有人会记得你的名字。`;
  }
  if (rev >= 10000 && events >= 5) {
    return `累计¥${rev.toLocaleString()}的销售额和${events}次展会经历，你已经不是"用爱发电"那么简单了。这是一段真正的创业故事——只不过主角最终选择了转身。也许未来某天，你会以不同的身份回到这个圈子。`;
  }
  if (hvp >= 5) {
    return `${hvp}本同人志，每一本都是无数个深夜的结晶。你证明了自己能够持续产出高质量的作品。热情会消退，但创作能力不会——它已经刻进了你的骨子里。`;
  }
  if (events >= 8) {
    return `跑了${events}场展会，从紧张地守着空荡荡的摊位到熟练地招呼来客……展会上认识的人、交换的名片、听到的故事，这些才是最珍贵的收获。同人展的热闹会想你的。`;
  }
  if (state.totalLVP >= 8 && hvp <= 1) {
    return '你是谷子界的多产选手，用小而精的周边温暖了很多人的日常。虽然始终没能跨过同人本的门槛，但这又有什么关系呢？创作的形式不重要，重要的是你表达过。';
  }
  if (stage === 'work' && rep < 1) {
    return '工作和生活的压力逐渐磨灭了你对同人创作的热情。这不是失败——51.2%的创作者都因为"现实太忙"而离开。你只是选择了另一种生活方式。';
  }
  if (state.turn < 12) {
    return '同人创作之路刚刚开始就戛然而止。也许时机不对，也许准备不足——但至少你迈出了第一步。很多人连试都不敢试。';
  }
  if (state.money >= 5000) {
    return '虽然热情燃尽了，但你至少攒下了一笔积蓄。这段创作经历教会你的不只是画画和排版——还有成本控制、市场判断和自我管理。这些能力会跟着你一辈子。';
  }
  return stage === 'work'
    ? '工作的齿轮不会为任何人的梦想停转。你的同人创作之路在现实的重压下缓缓落幕——但每一个曾经熬过的夜晚，都是真实存在过的热爱。'
    : '热情耗尽——用爱发电的电量归零了。但请记住：退坑不等于失败，只是人生的优先级发生了变化。那些作品会替你记住，你曾经为热爱全力以赴过。';
}

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
    { id: 'survive12', cond: state.turn >= 12 }, { id: 'survive24', cond: state.turn >= 24 }, { id: 'survive120', cond: state.turn >= 120 },
    { id: 'survive_work', cond: getLifeStage(state.turn) === 'work' && state.passion > 0 },
    { id: 'rich', cond: state.money >= 10000 && state.totalRevenue >= 5000 }, { id: 'hvp5', cond: state.totalHVP >= 5 },
    { id: 'recession_survivor', cond: (state.eventCounts['recession'] || 0) > 0 && state.recessionTurnsLeft === 0 && state.passion > 0 },
    { id: 'diversity_savior', cond: state.market && state.market.nHVP === 0 && state.hvpProject && state.hvpProject.progress > 0 },
    { id: 'market_veteran', cond: state.market && state.market.diversityHealth < 0.3 && state.passion > 20 },
    { id: 'niche_hunter', cond: state.advanced && state.advanced.nichesFound >= 3 },
    { id: 'ai_survivor', cond: state.advanced && state.advanced.aiRevolution && state.totalHVP > 0 && state.passion > 20 },
    { id: 'stagflation_survivor', cond: state.advanced && (state.eventCounts['stagflation'] || 0) > 0 && state.advanced.stagflationTurnsLeft === 0 && state.passion > 0 },
    { id: 'veblen', cond: (state.eventCounts['veblen_hype'] || 0) > 0 },
    { id: 'collector', cond: state.goodsCollection >= 10 && state.totalHVP === 0 && state.totalLVP === 0 },
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
    collector: { name: '纯粹的消费者', desc: '收藏了10件谷子却从未创作过', emoji: '🛒' },
    survive120: { name: '十年老兵', desc: '在同人创作之路上坚持了十年', emoji: '🎖️' },
  };
  return map[id] || { name: id, desc: '', emoji: '🎖️' };
}

// === Tips ===
const TIPS = {
  hvpStart: { label: '长期项目', text: '同人本是多月项目——独自需要3个月，有搭档可缩短到2个月。印刷成本¥800-1000在完成时支付。搭档有稿费成本，但可以加速进度。' },
  hvpContinue: { label: '坚持创作', text: '同人本创作需要持续投入。每个月都在消耗热情，但完成后的声誉积累远高于谷子。中途放弃意味着前期投入全部沉没。' },
  hvpComplete: { label: '🎉 作品完成·入库', text: '同人本完成并入库！现在去参加同人展售卖，或等待网上零售慢慢出货。同时携带同人本和谷子参展会触发联动加成。记得关注库存——卖光了要追加印刷！' },
  lvp: { label: '谷子入库', text: 'LVP一个月就能完成并入库，低门槛低风险。去同人展售卖可以一次卖出大量库存。网上也会有少量零售。注意库存管理——制作太多会积压资金，太少则展会上供不应求。' },
  rest: { label: '热情预算理论', text: '休息恢复热情的效率随入坑年限递减。长期疲惫是不可逆的。同时注意：停滞创作超过3个月后，热情会加速衰减——"不用就会生锈"。' },
  doujinEvent: { label: '同人展经济学 (Stigler)', text: '同人展是"搜寻成本→0"的极端场景：消费者直接翻阅实物，面对面交易消除信息不对称。路费是参展的机会成本，大社群有更多展会选择（规模经济）。' },
  promoteLight: { label: '轻度宣发', text: '低成本维持曝光。信号通胀越严重效果越差。适合资源紧张时维持存在感。信息透明度每月快速衰减，注意节奏。' },
  promoteHeavy: { label: '全力宣发 (Stigler)', text: '大规模宣发：发试阅、打样返图、详细介绍。宣发后立刻制作售卖，抓住窗口！' },
  partnerFound: { label: '协作约束', text: '协作可得性是本子创作的第一大触发条件。默契搭档在热情和销量上都有正面加成。' },
  partnerFail: { label: '声誉与协作', text: '协作概率随声誉递增。声誉越高越容易找到搭档——这是声誉的隐性收益。' },
  partnerRisk: { label: '搭档风险', text: '搭档类型是随机的。严格搭档虽然出品好但压力大，不靠谱搭档可能临时消失。协作引入了额外的不确定性。' },
  partnerToxic: { label: '有毒协作', text: '有毒搭档持续消耗热情，甚至公开引发争端损害声誉。一旦卷入，只能等合作期结束...' },
  burnout: { label: '倦怠风险 ', text: '创作行为本身消耗热情预算，这是"用爱发电"的真实成本。' },
  jobSearching: { label: '失业与外生退出', text: '失业期间无法创作，只能"找工作"或"休息"。经济下行让求职更难，失业时间越长焦虑越重' },
  jobFound: { label: '重返岗位', text: '找到工作了！收入恢复，但失业期间流失的热情和声誉需要时间重建。如果经济仍在下行，要警惕再次失业的风险。' },
  partTimeJob: { label: '时间-金钱权衡', text: '打工赚的钱稳定但不多(¥300~500)，且占用了本可以创作的时间。这就是经济学中的机会成本——打工的每一小时，都是放弃创作的一小时。' },
  freelanceLow: { label: '接稿与声誉', text: '声誉低时接稿收入有限。但接稿本身也是一种技能锻炼。注意：接稿消耗的热情比普通打工更大——因为你在用创作能力换钱，精神消耗更高。' },
  freelanceHigh: { label: '声誉的商业溢出', text: '声誉高的创作者接稿收入远高于普通打工——这是声誉资本的商业变现。但要小心：把太多时间花在接稿上，就没时间做自己真正想做的同人了。' },
};
