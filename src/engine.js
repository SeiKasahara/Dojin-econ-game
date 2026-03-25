/**
 * Game Engine — 同人社团物语 v4
 *
 */

import { ic } from './icons.js';
import { createMarketState, tickMarket, getCompetitionModifier } from './market.js';
import { createOfficialState, tickOfficial, getSecondHandModifier, recordPlayerWork } from './official.js';
import { createAdvancedState, tickAdvanced, getAdvancedCostMod, getAdvancedSalesMod, getSignalCost, ADVANCED_EVENTS } from './advanced.js';
import { SCHEDULED_EVENTS, RANDOM_EVENTS, setComputeEffectiveTime } from './events.js';
import { generateEnding, generateCommercialEnding } from './endings.js';
import { rollPartnerDrama } from './partner-drama.js';
import { checkAchievements, getAchievementInfo as _getAchievementInfo } from './achievements.js';

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
setComputeEffectiveTime(computeEffectiveTime);

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
  if (stage === 'university') return 0.6 + Math.floor((turn - 2) / 12) * 0.2;
  return 2.0 + ((turn - 50) / 12) * 0.3;
}

// === Partner Types ===
// feeRange: [min, max] — cost to hire. 15% chance of fee=0 (人好)
export const PARTNER_TYPES = {
  supportive: { id: 'supportive', name: '默契搭档', emoji: 'smiley', desc: '合作愉快，效率提升', salesBonus: 1.3, passionPerTurn: 2, dramaChance: 0, feeRange: [600, 1000] },
  demanding:  { id: 'demanding',  name: '严格搭档', emoji: 'smiley-angry', desc: '要求极高，出品精良但压力大', salesBonus: 1.5, passionPerTurn: -3, dramaChance: 0.12, feeRange: [1000, 1500] },
  unreliable: { id: 'unreliable', name: '不靠谱搭档', emoji: 'smiley-nervous', desc: '有时很给力，有时完全消失', salesBonus: 0.9, passionPerTurn: -1, dramaChance: 0.25, feeRange: [400, 800] },
  toxic:      { id: 'toxic',      name: '有毒搭档', emoji: 'skull', desc: '经常制造矛盾，但就是甩不掉...', salesBonus: 1.1, passionPerTurn: -6, dramaChance: 0.35, feeRange: [800, 1200] },
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

// === Partner Candidate Generation ===
const PARTNER_NAMES = [
  '星野碧', '墨染', '月见里', '七色的猫窝', '画不完的鱼',
  '雪代薰', '桃乐丝', '玻璃鞋', '黑猫', '夕颜',
  '柚子茶', '蓝莓酱', '小透明', '大触本触', '咸鱼太太',
  '红茶很甜', '修罗场', '二次元住民', '深夜作画人', '社恐画师',
];
const PARTNER_BIOS = {
  supportive: ['画风很稳的太太，合作过的人都说好', '效率很高，沟通也很顺畅', '人超好的！据说从来不催稿'],
  demanding: ['据说出品质量极高但非常严格', '是个完美主义者，对细节要求很苛刻', '作品质量没话说，就是脾气有点大'],
  unreliable: ['很有才华但好像不太靠谱', '上次展会临时消失过...但画真的好看', '回复消息时快时慢，令人捉摸不透'],
  toxic: ['很健谈很热情，主动找你合作', '在圈里认识很多人，交际很广', '说话很直接，看起来是个有想法的人'],
};

export function generatePartnerCandidates(state) {
  const social = state.endowments.social || 0;
  let prob = Math.min(0.9, state.reputation / (state.reputation + 3) + social * 0.08);
  if (getLifeStage(state.turn) === 'work') prob *= 0.6;
  const workYears = (state.turn - 50) / 12;
  if (getLifeStage(state.turn) === 'work' && workYears > 3 && (state.turn - state.lastCreativeTurn) <= 6) prob += 0.1;

  // Roll overall success first
  if (Math.random() >= prob) return null; // no candidates this month

  // Generate 2-3 candidates
  const count = 2 + (Math.random() < 0.4 ? 1 : 0);
  const usedNames = new Set();
  const candidates = [];
  for (let i = 0; i < count; i++) {
    const type = rollPartnerType(social);
    let name;
    do { name = PARTNER_NAMES[Math.floor(Math.random() * PARTNER_NAMES.length)]; } while (usedNames.has(name));
    usedNames.add(name);
    const bios = PARTNER_BIOS[type];
    const bio = bios[Math.floor(Math.random() * bios.length)];
    candidates.push({ name, bio, _type: type }); // _type hidden from UI
  }
  return candidates;
}

// === Work Subtypes ===
export const HVP_SUBTYPES = {
  manga:    { id: 'manga',    name: '漫画本',       emoji: 'book-open', monthsSolo: 3, monthsPartner: 2, costRange: [3500, 5000], repMult: 1.0,  audienceMult: 1.0,  requiredRep: 0, desc: '标准同人本，全彩小批量印刷贵' },
  novel:    { id: 'novel',    name: '小说本',       emoji: 'book', monthsSolo: 2, monthsPartner: 1, costRange: [1500, 2500], repMult: 0.8,  audienceMult: 0.75, requiredRep: 0, desc: '成本低周期短，受众略小' },
  artbook:  { id: 'artbook',  name: '创意绘本',     emoji: 'palette', monthsSolo: 3, monthsPartner: 2, costRange: [4500, 6000], repMult: 1.5,  audienceMult: 0.85, requiredRep: 0, desc: '声誉加成高但投入大' },
  lorebook: { id: 'lorebook', name: '设定集',       emoji: 'scroll', monthsSolo: 2, monthsPartner: 1, costRange: [2500, 3500], repMult: 1.2,  audienceMult: 0.6,  requiredRep: 2, desc: '小众高价值，需声誉≥2' },
  music:    { id: 'music',    name: '同人音乐专辑', emoji: 'music-notes', monthsSolo: 4, monthsPartner: 3, costRange: [4000, 5000], repMult: 1.3,  audienceMult: 0.7,  requiredRep: 0, desc: '独特受众，周期长' },
};
export const LVP_SUBTYPES = {
  acrylic:  { id: 'acrylic',  name: '亚克力',     emoji: 'diamond', cost: 400, batchSize: 28, marginMult: 1.0, desc: '标准谷子，开模费较贵' },
  badge:    { id: 'badge',    name: '吧唧',       emoji: 'tag', cost: 100, batchSize: 40, marginMult: 0.7, desc: '便宜量大走量型' },
  shikishi: { id: 'shikishi', name: '色纸',       emoji: 'image', cost: 250, batchSize: 25, marginMult: 1.1, desc: '利润率较高' },
  postcard: { id: 'postcard', name: '明信片套组', emoji: 'envelope', cost: 120, batchSize: 50, marginMult: 0.8, desc: '成本低量大' },
};

// === Creative Choices ===
export const CREATIVE_CHOICES = {
  theme: {
    title: '选择创作方向', desc: '这部作品的基调是什么？',
    options: [
      { id: 'sweet',     name: '甜文日常', emoji: 'flower', desc: '温暖治愈的日常故事', tag: '甜文' },
      { id: 'angst',     name: '刀子虐心', emoji: 'sword', desc: '虐心催泪的情感冲击', tag: '虐心' },
      { id: 'adventure', name: '热血冒险', emoji: 'shield-chevron', desc: '热血沸腾的冒险故事', tag: '热血' },
    ],
  },
  execution: {
    title: '创作进度决策', desc: '目前进展如何？接下来要怎么做？',
    options: [
      { id: 'rush',   name: '赶工加速', emoji: 'lightning', desc: '压缩工期，省一个月但可能影响品质' },
      { id: 'normal', name: '正常进度', emoji: 'note-pencil', desc: '按部就班，稳扎稳打' },
      { id: 'polish', name: '精雕细琢', emoji: 'sparkle', desc: '花更多心思打磨，额外消耗一些精力' },
    ],
  },
  finalPolish: {
    title: '最后冲刺', desc: '作品即将完成，最后阶段如何处理？',
    options: [
      { id: 'safe',       name: '保守完成',     emoji: 'package', desc: '安全收尾，稳定输出' },
      { id: 'overhaul',   name: '大改封面/曲目', emoji: 'arrows-clockwise', desc: '推翻重做，可能翻车也可能惊艳' },
      { id: 'experiment', name: '加入实验性元素', emoji: 'flask', desc: '大胆尝试，也许会成为cult经典' },
    ],
  },
  lvpProcess: {
    title: '制作工艺', desc: '选择这批谷子的制作方式',
    options: [
      { id: 'standard', name: '标准工艺', emoji: 'package', desc: '正常制作，品质适中' },
      { id: 'premium',  name: '精装工艺', emoji: 'diamond', desc: '更好的材料和做工，成本更高' },
      { id: 'budget',   name: '简装快出', emoji: 'clipboard', desc: '压低成本快速出货，量大但品质一般' },
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

// Sync inventory aggregates from works array
export function syncInventoryAggregates(state) {
  state.inventory.hvpStock = state.inventory.works.filter(w => w.type === 'hvp').reduce((s, w) => s + w.qty, 0);
  state.inventory.lvpStock = state.inventory.works.filter(w => w.type === 'lvp').reduce((s, w) => s + w.qty, 0);
}

// Sell N items of a type from works array (FIFO: oldest first), returns { sold, revenue, details[] }
function sellFromWorks(state, type, count) {
  const works = state.inventory.works.filter(w => w.type === type && w.qty > 0);
  let remaining = count;
  let totalRev = 0;
  const details = []; // { work, sold, rev }
  for (const w of works) {
    if (remaining <= 0) break;
    const sell = Math.min(remaining, w.qty);
    const rev = sell * w.price;
    w.qty -= sell;
    remaining -= sell;
    totalRev += rev;
    details.push({ work: w, sold: sell, rev });
  }
  // Keep sold-out works in array (qty=0) so they can be reprinted
  syncInventoryAggregates(state);
  return { sold: count - remaining, revenue: totalRev, details };
}

// === Initial State ===
// === Endowment definitions ===
export const ENDOWMENTS = {
  talent:     { name: '创作天赋', emoji: 'palette', desc: '作品质量与声誉积累速度', effects: ['声誉积累+15%/级', '印刷成本-5%/级'] },
  stamina:    { name: '体力精力', emoji: 'barbell', desc: '热情恢复力与创作消耗', effects: ['休息恢复+3/级', '制作同人本时间月耗-1/级'] },
  social:     { name: '社交魅力', emoji: 'handshake', desc: '搭档质量与展会表现', effects: ['找搭档+8%/级', '毒搭档率-2%/级'] },
  marketing:  { name: '营销直觉', emoji: 'megaphone', desc: '宣发效果与信息衰减', effects: ['宣发效果+12%/级', '信息衰减-1%/级'] },
  resilience: { name: '心理韧性', emoji: 'shield', desc: '抵抗现实消耗与负面事件', effects: ['现实消耗-0.5/级', '负债焦虑阈+200/级'] },
};
export const ENDOWMENT_TOTAL_POINTS = 7;
export const ENDOWMENT_MAX_PER_TRAIT = 3;

// === Background (家庭背景) ===
export const BACKGROUNDS = {
  poor:     { name: '困难家庭', emoji: 'house-simple', weight: 5,  money: 800,  allowanceMult: 0.6, salaryMult: 0.85, fireResist: 0, desc: '拮据但坚韧，逆境出发' },
  ordinary: { name: '普通家庭', emoji: 'house', weight: 70, money: 2000, allowanceMult: 1.0, salaryMult: 1.0,  fireResist: 0, desc: '标准起点' },
  comfort:  { name: '小康家庭', emoji: 'house-line', weight: 12, money: 3500, allowanceMult: 1.3, salaryMult: 1.1,  fireResist: 0.02, desc: '稍有余裕，更多试错空间' },
  educated: { name: '书香门第', emoji: 'books', weight: 8,  money: 2500, allowanceMult: 1.15, salaryMult: 1.05, fireResist: 0.01, desc: '文化氛围好，创作更容易被理解' },
  wealthy:  { name: '富裕家庭', emoji: 'diamond', weight: 3,  money: 8000, allowanceMult: 2.0, salaryMult: 1.4,  fireResist: 0.04, desc: '资金充裕，几乎不用担心钱' },
  tycoon:   { name: '超级富哥', emoji: 'crown', weight: 2,  money: 20000, allowanceMult: 3.0, salaryMult: 2.0, fireResist: 0.05, desc: '钱不是问题，热情才是' },
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
    commercialOfferReceived: false, // true after publisher scouts you
    commercialTransition: false,    // true if player chose to go commercial (positive ending)
    consecutiveConsigns: 0,         // tracks consecutive consignment events (resets on 亲参)
    creativeFatigue: 0,             // cumulative creative exhaustion (decays naturally, amplified by consecutive creation)
    equipmentLevel: 0,              // 0/1/2/3 — upgraded equipment improves quality & reduces passion cost
    lastSponsorTurn: -12,           // turn of last community sponsorship (cooldown)
    lastSalary: 0,                  // last salary received (for unemployment spending inertia)
    // Achievement tracking counters
    _debtPassionStreak: 0,          // consecutive months with money<0 and passion>=60
    _lowPassionHit: false,          // ever had passion<=15
    _passionRecovered: false,       // recovered from <=15 to >=80
    fullTimeDoujin: false,          // quit job to go full-time doujin creator
    doujinMonths: 0,                // months spent as full-time doujin creator
    doujinWorkYearReset: 0,         // turn at which work years reset (for salary calc after returning)
  };
}

// === Actions ===
// Time is monthly leisure: 0-10 scale (10=entire month free, 0=no free time)
// HVP is multi-turn: solo 3 months, with partner 2 months
export const ACTIONS = {
  hvp:         { id: 'hvp',         name: '创作同人本', emoji: 'book-open-text', type: 'hvp',
                 costLabel: '热情-15/月 印刷¥2500~3000 需闲暇≥4(有搭档≥2)', requires: { passion: 15, time: 4 } },
  lvp:         { id: 'lvp',         name: '制作谷子',   emoji: 'key', type: 'lvp',
                 costLabel: '热情-8 资金-200 需闲暇≥2', requires: { passion: 10, time: 2 } },
  rest:        { id: 'rest',        name: '休息充电',   emoji: 'coffee', type: 'rest',
                 costLabel: '热情+15~25', requires: {} },
  promote_light: { id: 'promote_light', name: '轻度宣发', emoji: 'megaphone', type: 'promote',
                   costLabel: '热情-3 小幅提升信息', requires: { passion: 3, time: 1 }, promoteIntensity: 'light' },
  promote_heavy: { id: 'promote_heavy', name: '全力宣发', emoji: 'megaphone-simple', type: 'promote',
                   costLabel: '热情-12 大幅提升信息 需闲暇≥3', requires: { passion: 10, time: 3 }, promoteIntensity: 'heavy' },
  findPartner: { id: 'findPartner', name: '寻找搭档',   emoji: 'handshake', type: 'social',
                 costLabel: '热情-3 搭档有稿费成本', requires: { passion: 3, time: 2 } },
  partTimeJob: { id: 'partTimeJob', name: '普通打工',   emoji: 'storefront', type: 'work',
                 costLabel: '赚¥300~500 下月闲暇-1h 仅学生/失业', requires: { passion: 2, time: 3 } },
  freelance:   { id: 'freelance',   name: '接稿赚钱',   emoji: 'paint-brush', type: 'freelance',
                 costLabel: '热情-4 下月闲暇-2h 收入看声誉', requires: { passion: 4, time: 2 } },
  attendEvent: { id: 'attendEvent', name: '参加同人展', emoji: 'tent', type: 'attendEvent',
                 costLabel: '需有同人展·路费·亲参≥3h/寄售≥1h', requires: { passion: 5, time: 1 } },
  jobSearch:   { id: 'jobSearch',   name: '找工作',     emoji: 'briefcase', type: 'jobSearch',
                 costLabel: '热情-10 面试奔波', requires: { passion: 5 } },
  quitForDoujin: { id: 'quitForDoujin', name: '辞职全职同人', emoji: 'sparkle', type: 'quitForDoujin',
                 costLabel: '辞掉工作，全身心投入同人创作', requires: {} },
  reprint:     { id: 'reprint',     name: '追加印刷',   emoji: 'printer', type: 'reprint',
                 costLabel: '补印库存 需有旧作', requires: { passion: 3 } },
  buyGoods:    { id: 'buyGoods',    name: '购买谷子',   emoji: 'shopping-bag', type: 'buyGoods',
                 costLabel: '¥200 热情↑(效果逐年递减)', requires: {} },
  sellGoods:   { id: 'sellGoods',   name: '出售闲置',   emoji: 'export', type: 'sellGoods',
                 costLabel: '卖掉收藏品换钱 需有收藏', requires: { time: 1 } },
  goCommercial: { id: 'goCommercial', name: '商业出道',  emoji: 'star', type: 'goCommercial',
                 costLabel: '接受出版社邀约，告别同人时代', requires: {} },
  hireAssistant: { id: 'hireAssistant', name: '外包助手', emoji: 'user', type: 'hireAssistant',
                 costLabel: '¥800~1500 加速当前同人本进度', requires: { time: 1 } },
  upgradeEquipment: { id: 'upgradeEquipment', name: '升级设备', emoji: 'desktop', type: 'upgradeEquipment',
                 costLabel: '一次性大额投入 永久提升创作质量', requires: {} },
  sponsorCommunity: { id: 'sponsorCommunity', name: '赞助社区', emoji: 'hand-heart', type: 'sponsorCommunity',
                 costLabel: '¥1500~3000 声誉↑热情↑ 冷却6月', requires: {} },
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
    if (idle >= 3) extra = ` ${ic('warning')}已${idle}月未活动`;
    return { ...base, costLabel: `恢复效率${eff}%${extra}` };
  }
  if (actionId === 'jobSearch') {
    return { ...base, costLabel: `已找${state.jobSearchTurns}月 成功率${Math.round(Math.min(85, (30 + state.jobSearchTurns * 10) * (state.recessionTurnsLeft > 0 ? 0.5 : 1)))}%` };
  }
  if (actionId === 'freelance') {
    const tc = getFreelanceTimeCost(state);
    const label = state.unemployed ? '失业接稿' : getLifeStage(state.turn) === 'university' ? '课余接稿' : '下班接稿';
    const recTag = state.recessionTurnsLeft > 0 ? ` ${ic('trend-down')}-50%` : '';
    return { ...base, costLabel: `热情-4 下月闲暇-2h 需≥${tc}h ${label}${recTag}` };
  }
  if (actionId === 'partTimeJob') {
    const stage = getLifeStage(state.turn);
    if (stage === 'work' && !state.unemployed) return { ...base, costLabel: '仅学生/失业可用' };
    const recTag = state.recessionTurnsLeft > 0 ? ` ${ic('trend-down')}` : '';
    return { ...base, costLabel: `赚¥300~500 下月闲暇-1h${recTag}` };
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
    const stockInfo = `${ic('package')}本${state.inventory.hvpStock}·谷${state.inventory.lvpStock}`;
    return { ...base, costLabel: `${best.name}@${best.city} 路费¥${best.travelCost} ${stockInfo}` };
  }
  if (actionId === 'promote_light' || actionId === 'promote_heavy') {
    const sigCost = state.advanced ? getSignalCost(state.advanced) : 1.0;
    const sigLabel = sigCost > 1.2 ? ` 通胀×${sigCost.toFixed(1)}` : '';
    return { ...base, costLabel: base.costLabel + sigLabel };
  }
  if (actionId === 'hvp') {
    const recTag = state.recessionTurnsLeft > 0 ? ` ${ic('trend-down')}` : '';
    const staCost = Math.max(8, 15 - (state.endowments?.stamina || 0));
    if (state.hvpProject) {
      const p = state.hvpProject;
      const sub = HVP_SUBTYPES[p.subtype] || HVP_SUBTYPES.manga;
      return { ...base, name: `继续创作${sub.name}`, emoji: sub.emoji, costLabel: `进度 ${p.progress}/${p.needed} · 热情-${staCost}${recTag}` };
    }
    return { ...base, costLabel: `选择类型后开始创作${recTag}` };
  }
  if (actionId === 'lvp') {
    const recTag = state.recessionTurnsLeft > 0 ? ` ${ic('trend-down')}` : '';
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
    return { ...base, costLabel: `¥200 热情+${Math.round(12 * eff / 100)} 效率${eff}%${state.money < 200 ? ` ${ic('warning')}资金不足` : ''}` };
  }
  if (actionId === 'sellGoods') {
    if (state.goodsCollection <= 0) return { ...base, costLabel: '没有收藏品可出' };
    const sellPrice = Math.round(120 + (state.official?.secondHandPressure?.lvp || 0) * -80);
    return { ...base, costLabel: `收藏${state.goodsCollection}件 预估¥${Math.max(50, sellPrice)}/件 热情-3` };
  }
  if (actionId === 'hireAssistant') {
    if (!state.hvpProject) return { ...base, costLabel: '需要正在进行的同人本项目' };
    const used = state.hvpProject._assistantCount || 0;
    return { ...base, costLabel: `¥800~1500 进度+0.5 疲劳-1 (已用${used}/2次)` };
  }
  if (actionId === 'upgradeEquipment') {
    const costs = [3000, 5000, 8000];
    if (state.equipmentLevel >= 3) return { ...base, costLabel: '已满级 Lv3' };
    return { ...base, costLabel: `¥${costs[state.equipmentLevel]} → Lv${state.equipmentLevel + 1} 质量↑ 消耗↓` };
  }
  if (actionId === 'sponsorCommunity') {
    const cd = 6 - (state.turn - state.lastSponsorTurn);
    if (cd > 0) return { ...base, costLabel: `冷却中（还剩${cd}月）` };
    const cs = state.market ? state.market.communitySize : 10000;
    const cost = Math.round(1500 + cs / 10000 * 1500);
    return { ...base, costLabel: `¥${cost} 声誉↑ 热情+8 曝光↑` };
  }
  return base;
}

// Freelance time cost depends on life situation
export function getFreelanceTimeCost(state) {
  if (state.unemployed || state.fullTimeDoujin) return 2;  // 失业/全职同人：时间多
  if (getLifeStage(state.turn) === 'university') return 3; // 学生：中等
  return 5;                                               // 在职：下班后还要接稿，消耗大
}

export function canPerformAction(state, actionId) {
  const r = ACTIONS[actionId]?.requires;
  if (!r) return false;
  // Unemployed: time is plentiful but anxiety drains passion fast — all actions allowed
  // (the real constraint is passion budget, not action locks)
  // jobSearch: when unemployed OR full-time doujin (wanting to go back)
  if (actionId === 'jobSearch' && !state.unemployed && !state.fullTimeDoujin) return false;
  // quitForDoujin: work stage, employed, rep≥3, money≥25000, 5+ events
  if (actionId === 'quitForDoujin') {
    if (getLifeStage(state.turn) !== 'work' || state.unemployed || state.fullTimeDoujin) return false;
    if (state.reputation < 3 || state.money < 25000 || (state.eventLog?.length || 0) < 5) return false;
  }
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
  // goCommercial: only after receiving the offer
  if (actionId === 'goCommercial') {
    if (!state.commercialOfferReceived) return false;
  }
  // hireAssistant: need active HVP project, money, max 2 per project
  if (actionId === 'hireAssistant') {
    if (!state.hvpProject) return false;
    if (state.money < 800) return false;
    if ((state.hvpProject._assistantCount || 0) >= 2) return false;
  }
  // upgradeEquipment: need money and not maxed
  if (actionId === 'upgradeEquipment') {
    const costs = [3000, 5000, 8000];
    if (state.equipmentLevel >= 3) return false;
    if (state.money < costs[state.equipmentLevel]) return false;
  }
  // sponsorCommunity: need money and cooldown
  if (actionId === 'sponsorCommunity') {
    if (state.money < 1500) return false;
    if (state.turn - state.lastSponsorTurn < 6) return false;
  }
  if (r.passion && state.passion < r.passion) return false;
  // HVP: with partner, time requirement relaxed to 2h (partner shares workload)
  if (actionId === 'hvp' && state.hasPartner) {
    if (state.time < 2) return false;
    return true;
  }
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
      reputationBoost: 0.25,
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
      reputationBoost: 0.12,
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
      reputationBoost: 0.40,
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

  // --- High info bonus: word-of-mouth effect when awareness ≥ 80% ---
  const infoHighBonus = state.infoDisclosure >= 0.6 ? 1.12 : 1.0;

  // --- Calculate final sales ---
  const rawSales = marketDemand * playerShare * conversion * partnerMult * shMod * advMod * eventBoost * noise * wqFx.salesMult * trendFx.salesMult * infoHighBonus;
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
    infoHighBonus: Math.round(infoHighBonus * 100),
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
// SCHEDULED_EVENTS — see events.js

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

// RANDOM_EVENTS — see events.js

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

// Event urgency tiers for savings dip
const EVENT_URGENCY = {
  family_emergency: 'high', unexpected_expense: 'high', tax_season: 'high',
  health_issue: 'mid', work_burnout: 'mid', social_obligation: 'mid', life_admin: 'mid', rent_increase: 'mid',
  overtime: 'low', harsh_review: 'low', commute_hell: 'low', old_friend_reunion: 'low',
  inflation: 'low', creative_block: 'low', uni_breakup: 'mid',
};
const DIP_CONFIG = {
  high: { chance: 0.55, rateMin: 0.03, rateMax: 0.06 },
  mid:  { chance: 0.35, rateMin: 0.02, rateMax: 0.04 },
  low:  { chance: 0.15, rateMin: 0.01, rateMax: 0.02 },
};

export function applyEvent(state, event) {
  event.apply(state);
  // Track frequency
  if (event.id) state.eventCounts[event.id] = (state.eventCounts[event.id] || 0) + 1;

  // Negative events may cause savings dip (random — "surplus depleted, dip into doujin fund")
  if (event.effectClass === 'negative' && state.money > 300) {
    const urgency = EVENT_URGENCY[event.id] || 'low';
    const cfg = DIP_CONFIG[urgency];
    if (Math.random() < cfg.chance) {
      const rate = cfg.rateMin + Math.random() * (cfg.rateMax - cfg.rateMin);
      const dip = Math.round(state.money * rate);
      if (dip > 0) {
        state.money -= dip;
        state._pendingEventDip = { label: event.title, amount: dip }; // picked up by next executeTurn
      }
    }
  }

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

  // --- Show savings dip from last turn's event (if any) ---
  if (state._pendingEventDip) {
    const d = state._pendingEventDip;
    result.deltas.push({ icon: 'money', label: `上月"${d.label}"导致挪用同人存款`, value: `-¥${d.amount}`, positive: false });
    state._pendingEventDip = null;
  }

  // --- Process action ---
  if (action.type === 'rest') {
    // Rest effectiveness decays with years in the hobby
    const yearsIn = state.turn / 12;
    const basRestore = 15 + Math.floor(Math.random() * 10) + (state.endowments.stamina || 0) * 3; // stamina bonus
    const fatigueMult = Math.max(0.35, 1 - yearsIn * 0.06);   // Y0=100%, Y3=82%, Y5=70%, Y10+=35%
    const restore = Math.max(3, Math.round(basRestore * fatigueMult));
    state.passion = Math.min(100, state.passion + restore);
    result.deltas.push({ icon: 'heart', label: '热情恢复', value: `+${restore}`, positive: true });
    if (fatigueMult < 0.8) {
      result.deltas.push({ icon: 'smiley-sad', label: '长期疲惫', value: `恢复效率${Math.round(fatigueMult * 100)}%`, positive: false });
    }
    // Estimate total passion drain this turn to warn player
    let estDrain = getRealityDrain(state.turn);
    const idleM = state.turn - state.lastCreativeTurn;
    if (idleM >= 3) estDrain += Math.min(8, Math.floor((idleM - 2) * 1.5));
    if (state.money < 0) estDrain += Math.min(10, Math.floor(Math.abs(state.money) / 500) * 2);
    if (restore < estDrain) {
      result.deltas.push({ icon: 'warning', label: '休息无法抵消消耗', value: `恢复${restore} < 预计消耗${Math.round(estDrain)}`, positive: false });
      result.deltas.push({ icon: 'lightbulb', label: '如果还有空的话...试试接稿、买谷子、参展?', value: '', positive: false });
    }
    const decay = state.reputation * 0.02;
    state.reputation = Math.max(0, state.reputation - decay);
    if (decay > 0.01) result.deltas.push({ icon: 'star', label: '声誉自然衰减', value: `-${decay.toFixed(2)}`, positive: false });
    result.tip = TIPS.rest;

  } else if (action.type === 'promote') {
    const intensity = action.promoteIntensity || 'light';
    const passionCost = intensity === 'heavy' ? 12 : 3;
    state.passion -= passionCost;
    // Base gain by intensity
    const rawGain = intensity === 'heavy'
      ? 0.45 + Math.random() * 0.20   // heavy: 45%~65% base (boosted to match faster decay)
      : 0.18 + Math.random() * 0.12;  // light: 18%~30% base
    // Signal inflation (Spence): diminishes gain but never below a floor
    const sigCost = state.advanced ? getSignalCost(state.advanced) : 1.0;
    const mktBonus = 1 + (state.endowments.marketing || 0) * 0.12; // marketing endowment
    const scaledGain = rawGain * mktBonus / sigCost;
    // Guaranteed minimum: even in max signal inflation, you always get SOME visibility
    const minGain = intensity === 'heavy' ? 0.12 : 0.05;
    const gain = Math.max(minGain, scaledGain);
    state.infoDisclosure = Math.min(1, state.infoDisclosure + gain);
    result.deltas.push({ icon: 'heart', label: '精力消耗', value: `-${passionCost}`, positive: false });
    result.deltas.push({ icon: 'megaphone', label: '信息透明度', value: `+${(gain * 100).toFixed(0)}% → ${(state.infoDisclosure * 100).toFixed(0)}%`, positive: true });
    if (sigCost > 1.2) result.deltas.push({ icon: 'megaphone-simple', label: '信号通胀', value: `效果${Math.round(gain / rawGain * 100)}%（保底${Math.round(minGain * 100)}%）`, positive: false });
    result.tip = intensity === 'heavy' ? TIPS.promoteHeavy : TIPS.promoteLight;

  } else if (action.type === 'social') {
    state.passion -= 3;
    result.deltas.push({ icon: 'heart', label: '精力消耗', value: '-3', positive: false });
    let prob = Math.min(0.9, state.reputation / (state.reputation + 3) + (state.endowments.social || 0) * 0.08);
    // Work stage: smaller social circle → harder to find partners
    if (getLifeStage(state.turn) === 'work') {
      prob *= 0.6;
      // 老炮加成: long-time active workers get a bonus
      const workYears = (state.turn - 50) / 12;
      if (workYears > 3 && (state.turn - state.lastCreativeTurn) <= 6) {
        prob += 0.1;
        result.deltas.push({ icon: 'medal', label: '老炮加成', value: '长期活跃+10%', positive: true });
      }
    }
    // Check if candidate was selected via UI or if search failed
    const candidate = state._selectedPartnerCandidate;
    state._selectedPartnerCandidate = null;
    const searchFailed = state._partnerSearchFailed;
    state._partnerSearchFailed = false;

    if (candidate) {
      // Candidate selected — reveal true type
      const pType = candidate._type;
      const pt = PARTNER_TYPES[pType];
      state.hasPartner = true;
      state.partnerType = pType;
      state.partnerTurns = pType === 'unreliable' ? (1 + Math.floor(Math.random() * 3)) : (3 + Math.floor(Math.random() * 4));
      const isFree = Math.random() < 0.15;
      if (isFree) {
        state.partnerFee = 0;
        result.deltas.push({ icon: pt.emoji, label: `"${candidate.name}"原来是${pt.name}！`, value: `${state.partnerTurns}回合`, positive: true });
        result.deltas.push({ icon: 'hand-heart', label: '人好！不要稿费', value: '免费合作', positive: true });
      } else {
        const [fmin, fmax] = pt.feeRange;
        state.partnerFee = fmin + Math.floor(Math.random() * (fmax - fmin));
        result.deltas.push({ icon: pt.emoji, label: `"${candidate.name}"原来是${pt.name}！`, value: `${state.partnerTurns}回合`, positive: pType === 'supportive' });
        result.deltas.push({ icon: 'coins', label: '搭档稿费', value: `¥${state.partnerFee}/本`, positive: false });
      }
      result.deltas.push({ icon: 'note-pencil', label: pt.desc, value: '', positive: false });
      result.tip = pType === 'toxic' ? TIPS.partnerToxic : pType === 'supportive' ? TIPS.partnerFound : TIPS.partnerRisk;
    } else {
      // No candidates or search failed
      result.deltas.push({ icon: 'handshake', label: '本月没找到合适的搭档', value: '', positive: false });
      if (getLifeStage(state.turn) === 'work') {
        result.deltas.push({ icon: 'briefcase', label: '工作后同人圈子变小，找搭档更难了', value: '', positive: false });
      }
      result.tip = TIPS.partnerFail;
    }

  } else if (action.type === 'work') {
    // Part-time job: drains ENERGY (→ time debuff), not passion
    state.passion -= 2; // minimal passion cost (opportunity cost feeling)
    const baseWage = 300 + Math.floor(Math.random() * 200);
    const recessionCut = state.recessionTurnsLeft > 0 ? 0.6 : 1.0;
    const wage = Math.floor(baseWage * recessionCut);
    state.money += wage;
    state.timeDebuffs.push({ id: 'tired_work', reason: '打工疲惫', turnsLeft: 1, delta: -1 });
    result.deltas.push({ icon: 'barbell', label: '体力消耗', value: '下月闲暇-1h', positive: false });
    result.deltas.push({ icon: 'coins', label: '打工收入', value: `+¥${wage}`, positive: true });
    if (recessionCut < 1) result.deltas.push({ icon: 'trend-down', label: '经济下行压低工资', value: '-40%', positive: false });
    result.tip = TIPS.partTimeJob;

  } else if (action.type === 'freelance') {
    // Freelance: creative labor → some passion drain + energy (time debuff)
    state.passion -= 4; // uses creative energy, but less than original creation
    const base = 200, repBonus = Math.floor(state.reputation * 150);
    const rawIncome = base + repBonus + Math.floor(Math.random() * 150);
    const recessionCut = state.recessionTurnsLeft > 0 ? 0.5 : 1.0;
    const income = Math.floor(rawIncome * recessionCut);
    state.money += income;
    const repGain = 0.02 + state.reputation * 0.005;
    state.reputation += repGain;
    state.timeDebuffs.push({ id: 'tired_freelance', reason: '接稿疲惫', turnsLeft: 1, delta: -2 });
    result.deltas.push({ icon: 'heart', label: '创作精力', value: '-4', positive: false });
    result.deltas.push({ icon: 'barbell', label: '体力消耗', value: '下月闲暇-2h', positive: false });
    result.deltas.push({ icon: 'coins', label: '接稿收入', value: `+¥${income}`, positive: true });
    if (recessionCut < 1) result.deltas.push({ icon: 'trend-down', label: '经济下行需求萎缩', value: '-50%', positive: false });
    result.deltas.push({ icon: 'star', label: '商业声誉', value: `+${repGain.toFixed(2)}`, positive: true });
    result.tip = state.reputation >= 3 ? TIPS.freelanceHigh : TIPS.freelanceLow;

  } else if (action.type === 'attendEvent') {
    // === ATTEND DOUJIN EVENT — now sells directly from inventory ===
    const evt = state.attendingEvent || (state.availableEvents && state.availableEvents[0]);
    if (evt) {

      // --- Event cancelled (流展) ---
      if (evt.condition === 'cancelled') {
        if (isAttend) {
          const cancelLodging = Math.round(evt.travelCost * 1.2 + 200);
          state.money -= evt.travelCost + cancelLodging;
          state.passion = Math.max(0, state.passion - 5);
          result.deltas.push({ icon: 'smiley-x-eyes', label: `${evt.name}@${evt.city} 流展！`, value: '白跑一趟', positive: false });
          result.deltas.push({ icon: 'coins', label: '路费+住宿（沉没成本）', value: `-¥${evt.travelCost + cancelLodging}`, positive: false });
          result.deltas.push({ icon: 'heart', label: '白忙一场的沮丧', value: '-5', positive: false });
        } else {
          // 寄售流展：货还在手里，只损失邮费
          const shipCost = Math.round(evt.travelCost * 0.3);
          state.money -= shipCost;
          state.passion = Math.max(0, state.passion - 1);
          result.deltas.push({ icon: 'package', label: `${evt.name}@${evt.city} 流展！`, value: '寄售取消，货物退回', positive: false });
          result.deltas.push({ icon: 'coins', label: '邮费（沉没成本）', value: `-¥${shipCost}`, positive: false });
          result.deltas.push({ icon: 'heart', label: '小遗憾', value: '-1', positive: false });
        }
        state.attendingEvent = null;
        result.tip = { label: '流展风险', text: '展会因故取消是同人创作者面临的真实风险。路费变成沉没成本，无法追回。经济学告诉我们：不要因为已经花了路费就做出非理性决策——关键是接下来怎么安排。' };
        // Skip all selling logic below
      } else {

      const mode = state._eventMode || 'attend'; // 'attend' = 亲参, 'consign' = 寄售
      state._eventMode = null;
      const isAttend = mode === 'attend';
      const mg = isAttend ? state._minigameResult : null;
      state._minigameResult = null;

      // Lodging + meals + booth fee for 亲参 (scales with travel distance)
      // Local: minimal, distant: 2 nights hotel + meals + booth
      const lodgingCost = isAttend ? Math.round(evt.travelCost * 1.2 + 200) : 0; // ~¥260(本市) to ~¥1640(异地)

      // Fatigue only applies to 亲参 — consecutive attending drains harder
      let eventFatigue = 1.0;
      let fatigueDrain = 0;
      if (isAttend) {
        state.recentEventTurns.push(state.turn);
        const recentCount = state.recentEventTurns.filter(t => state.turn - t < 6).length;
        eventFatigue = recentCount <= 1 ? 1.0 : Math.max(0.25, 1.0 - (recentCount - 1) * 0.25);
        // Extra passion drain for frequent attending
        if (recentCount >= 3) fatigueDrain = (recentCount - 2) * 5; // 3rd→-5, 4th→-10, 5th→-15
      }

      if (isAttend && mg) {
        // === 亲参 with minigame ===
        state.consecutiveConsigns = 0; // reset on attend
        state.passion -= 5;
        state.money -= evt.travelCost + lodgingCost + mg.moneySpent;
        const fatiguePassion = Math.round(mg.passionDelta * eventFatigue);
        state.passion = Math.min(100, state.passion + fatiguePassion);
        state.reputation += mg.reputationDelta;
        state.maxReputation = Math.max(state.maxReputation, state.reputation);
        state.attendingEvent = { ...evt, salesBoost: mg.salesMultiplier };

        result.deltas.push({ icon: 'storefront', label: `亲参 ${evt.name}@${evt.city}`, value: `表现${mg.performance}分`, positive: mg.performance >= 50 });
        result.deltas.push({ icon: 'coins', label: '路费+住宿餐饮+摊位' + (mg.moneySpent > 0 ? '+无料' : ''), value: `-¥${evt.travelCost + lodgingCost + mg.moneySpent}`, positive: false });
        result.deltas.push({ icon: 'heart', label: '展会热情', value: `${fatiguePassion > 0 ? '+' : ''}${fatiguePassion}`, positive: fatiguePassion > 0 });
        if (fatigueDrain > 0) {
          state.passion -= fatigueDrain;
          result.deltas.push({ icon: 'battery-medium', label: '连续参展身心俱疲', value: `热情-${fatigueDrain}`, positive: false });
        }
        if (eventFatigue < 1) {
          const rc = state.recentEventTurns.filter(t => state.turn - t < 6).length;
          result.deltas.push({ icon: 'smiley-sad', label: `连续亲参疲劳(近6月第${rc}次)`, value: `热情效率${Math.round(eventFatigue * 100)}%`, positive: false });
        }
        if (evt.condition === 'popular') {
          result.deltas.push({ icon: 'fire', label: '人气爆棚！人流超出预期', value: '', positive: true });
        }
      } else if (isAttend) {
        // === 亲参 but skipped minigame ===
        state.consecutiveConsigns = 0; // reset on attend
        state.passion -= 5;
        state.money -= evt.travelCost + lodgingCost;
        const fatigueBoost = Math.round(evt.passionBoost * eventFatigue);
        state.passion = Math.min(100, state.passion + fatigueBoost);
        state.reputation += evt.reputationBoost;
        state.maxReputation = Math.max(state.maxReputation, state.reputation);
        state.attendingEvent = evt;
        result.deltas.push({ icon: 'storefront', label: `亲参 ${evt.name}@${evt.city}`, value: '(快速结算)', positive: true });
        result.deltas.push({ icon: 'coins', label: '路费+住宿餐饮+摊位', value: `-¥${evt.travelCost + lodgingCost}`, positive: false });
        if (fatigueDrain > 0) {
          state.passion -= fatigueDrain;
          result.deltas.push({ icon: 'battery-medium', label: '连续参展身心俱疲', value: `热情-${fatigueDrain}`, positive: false });
        }
      } else {
        // === 寄售 (consignment) ===
        if (state._leaveDenied) {
          result.deltas.push({ icon: 'building-office', label: '请假被拒！无法亲自参展', value: '降级为寄售', positive: false });
          state._leaveDenied = null;
        }
        state.consecutiveConsigns++;
        const shipCost = Math.round(evt.travelCost * 0.3);
        state.passion -= 2;
        state.money -= shipCost;
        state.attendingEvent = evt; // for calculateSales event boost
        result.deltas.push({ icon: 'package', label: `寄售 ${evt.name}@${evt.city}`, value: '委托代售', positive: true });
        result.deltas.push({ icon: 'coins', label: '邮寄费用', value: `-¥${shipCost}`, positive: false });

        // --- Consignment agent mishap: risk scales with consecutive consigns ---
        const mishapChance = Math.min(0.7, (state.consecutiveConsigns - 1) * 0.15); // 0% first, 15% second, 30% third...
        if (mishapChance > 0 && Math.random() < mishapChance) {
          const roll = Math.random();
          // Low resilience amplifies interpersonal mishap pain
          const _r = state.endowments.resilience || 0;
          const _im = _r <= 1 ? 2.3 - _r * 0.5 : Math.max(0.7, 1.0 - (_r - 2) * 0.15);
          if (roll < 0.35) {
            // 代理不靠谱：丢失部分库存
            const lostHVP = Math.min(state.inventory.hvpStock, Math.ceil(Math.random() * 2));
            const lostLVP = Math.min(state.inventory.lvpStock, Math.ceil(Math.random() * 3));
            state.inventory.hvpStock -= lostHVP;
            state.inventory.lvpStock -= lostLVP;
            const lostPassion = Math.round(5 * _im);
            result.deltas.push({ icon: 'smiley-x-eyes', label: '代理弄丢了部分库存！', value: `本-${lostHVP} 谷-${lostLVP}`, positive: false });
            state.passion = Math.max(0, state.passion - lostPassion);
            result.deltas.push({ icon: 'heart', label: '货都丢了...', value: `热情-${lostPassion}`, positive: false });
          } else if (roll < 0.65) {
            // 代理私吞货款：扣掉部分收入（通过降低event salesBoost）
            const skimRate = 0.15 + Math.random() * 0.15; // 15-30%
            state.attendingEvent = { ...evt, salesBoost: (evt.salesBoost || 1) * (1 - skimRate) };
            const skimPassion = Math.round(3 * _im);
            result.deltas.push({ icon: 'money', label: '代理疑似私吞部分货款', value: `预计损失${Math.round(skimRate * 100)}%收入`, positive: false });
            state.passion = Math.max(0, state.passion - skimPassion);
          } else {
            // 和代理吵架：热情大幅下降 + 声誉损失
            const fightPassion = Math.round(8 * _im);
            const repLoss = Math.min(0.5, state.reputation * 0.05 * _im);
            state.passion = Math.max(0, state.passion - fightPassion);
            state.reputation = Math.max(0, state.reputation - repLoss);
            result.deltas.push({ icon: 'smiley-angry', label: '和寄售代理大吵一架！', value: `热情-${fightPassion} 声誉受损`, positive: false });
            result.deltas.push({ icon: 'star', label: '争吵传出去了...', value: `-${repLoss.toFixed(2)}`, positive: false });
          }
          if (_im > 1.1) result.deltas.push({ icon: 'shield', label: '心理韧性低，人际冲突打击更大', value: `×${_im.toFixed(1)}`, positive: false });
        }
        if (state.consecutiveConsigns >= 3) {
          result.deltas.push({ icon: 'warning', label: `已连续寄售${state.consecutiveConsigns}次`, value: '代理风险上升中', positive: false });
        }
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
            const hvpResult = sellFromWorks(state, 'hvp', hvpSold);
            eventRevenue += hvpResult.revenue;
            totalEventSold += hvpResult.sold;
            state.totalSales += hvpResult.sold;
            result.deltas.push({ icon: 'book-open-text', label: `同人本售出 ${hvpResult.sold}本`, value: `+¥${hvpResult.revenue}`, positive: true });
            const repGain = 0.08 * state.infoDisclosure * hvpResult.sold * 0.05;
            state.reputation += repGain;
            state.maxReputation = Math.max(state.maxReputation, state.reputation);
            if (state.official) recordPlayerWork(state.official, 'hvp', state.turn, state.reputation, hvpResult.sold);
          }
          if (lvpSold > 0) {
            const lvpResult = sellFromWorks(state, 'lvp', lvpSold);
            eventRevenue += lvpResult.revenue;
            totalEventSold += lvpResult.sold;
            state.totalSales += lvpResult.sold;
            result.deltas.push({ icon: 'key', label: `谷子售出 ${lvpResult.sold}个`, value: `+¥${lvpResult.revenue}`, positive: true });
            const repGain = 0.01 * state.infoDisclosure * lvpResult.sold * 0.05;
            state.reputation += repGain;
            state.maxReputation = Math.max(state.maxReputation, state.reputation);
            if (state.official) recordPlayerWork(state.official, 'lvp', state.turn, state.reputation, lvpResult.sold);
          }
        }
      } else {
        // 寄售 or 亲参快速结算: use CES model
        if (state.inventory.hvpStock > 0) {
          state.playerPrice.hvp = state.inventory.hvpPrice;
          const sales = calculateSales('hvp', state);
          const hvpSold = Math.min(sales.hvpSales, state.inventory.hvpStock);
          const hvpResult = sellFromWorks(state, 'hvp', hvpSold);
          eventRevenue += hvpResult.revenue;
          totalEventSold += hvpResult.sold;
          state.totalSales += hvpResult.sold;
          result.salesInfo = sales;
          result.supplyDemand = getSupplyDemandData(state, sales);
          result.deltas.push({ icon: 'book-open-text', label: `同人本售出 ${hvpResult.sold}本`, value: `+¥${hvpResult.revenue}`, positive: true });
          if (sales.hvpSales > hvpResult.sold) result.deltas.push({ icon: 'fire', label: '同人本售罄！', value: `需求${sales.hvpSales}·库存仅${hvpResult.sold}`, positive: false });
          const repGain = 0.08 * state.infoDisclosure * hvpResult.sold * 0.05;
          state.reputation += repGain;
          state.maxReputation = Math.max(state.maxReputation, state.reputation);
          if (state.official) recordPlayerWork(state.official, 'hvp', state.turn, state.reputation, hvpResult.sold);
        }
        if (state.inventory.lvpStock > 0) {
          state.playerPrice.lvp = state.inventory.lvpPrice;
          const sales = calculateSales('lvp', state);
          const lvpSold = Math.min(sales.lvpSales, state.inventory.lvpStock);
          const lvpResult = sellFromWorks(state, 'lvp', lvpSold);
          eventRevenue += lvpResult.revenue;
          totalEventSold += lvpResult.sold;
          state.totalSales += lvpResult.sold;
          if (!result.salesInfo) { result.salesInfo = sales; result.supplyDemand = getSupplyDemandData(state, sales); }
          result.deltas.push({ icon: 'key', label: `谷子售出 ${lvpResult.sold}个`, value: `+¥${lvpResult.revenue}`, positive: true });
          if (sales.lvpSales > lvpResult.sold) result.deltas.push({ icon: 'fire', label: '谷子售罄！', value: `需求${sales.lvpSales}·库存仅${lvpResult.sold}`, positive: false });
          const repGain = 0.01 * state.infoDisclosure * lvpResult.sold * 0.05;
          state.reputation += repGain;
          state.maxReputation = Math.max(state.maxReputation, state.reputation);
          if (state.official) recordPlayerWork(state.official, 'lvp', state.turn, state.reputation, lvpResult.sold);
        }
      }

      // Show secondhand market impact on event sales
      const eventShMod = Math.min(getSecondHandModifier(state.official, 'hvp'), getSecondHandModifier(state.official, 'lvp'));
      if (eventShMod < 0.9) {
        result.deltas.push({ icon: 'package', label: '二手市场挤压新品销量', value: `-${Math.round((1 - eventShMod) * 100)}%`, positive: false });
      }

      // Bundling bonus: selling both HVP and LVP at same event
      if (state.inventory.hvpStock >= 0 && state.inventory.lvpStock >= 0 && totalEventSold > 0 && state.totalHVP > 0 && state.totalLVP > 0) {
        const bundleBonus = Math.round(eventRevenue * 0.1);
        if (bundleBonus > 0) {
          eventRevenue += bundleBonus;
          result.deltas.push({ icon: 'target', label: '本+谷联动加成', value: `+¥${bundleBonus}`, positive: true });
        }
      }

      state.money += eventRevenue;
      state.totalRevenue += eventRevenue;

      if (eventRevenue > 0) {
        const totalEventCost = evt.travelCost + lodgingCost + (mg ? mg.moneySpent : 0);
        const profit = eventRevenue - totalEventCost;
        result.deltas.push({ icon: 'coins', label: '展会利润', value: profit >= 0 ? `+¥${profit}` : `-¥${Math.abs(profit)}`, positive: profit >= 0 });
      }
      // Log event for dashboard
      state.eventLog.push({ turn: state.turn, name: evt.name, city: evt.city, revenue: eventRevenue, sold: totalEventSold, condition: evt.condition || 'normal' });

      // Event emotional amplification
      if (totalEventSold >= 15) {
        const boost = Math.round(5 + totalEventSold * 0.3);
        state.passion = Math.min(100, state.passion + boost);
        result.deltas.push({ icon: 'confetti', label: '展会大卖！情绪高涨', value: `热情+${boost}`, positive: true });
      } else if (totalEventSold <= 2 && (state.inventory.hvpStock > 0 || state.inventory.lvpStock > 0)) {
        const costRef = isAttend ? evt.travelCost : Math.round(evt.travelCost * 0.3);
        const hit = -10 - Math.round(costRef / 150);
        state.passion = Math.max(0, state.passion + hit);
        result.deltas.push({ icon: 'smiley-meh', label: isAttend ? '展会惨淡...花了路费却卖不出去' : '寄售惨淡...邮费白花了', value: `热情${hit}`, positive: false });
      }

      // Show remaining inventory
      result.deltas.push({ icon: 'package', label: '剩余库存', value: `本${state.inventory.hvpStock} 谷${state.inventory.lvpStock}`, positive: state.inventory.hvpStock > 0 || state.inventory.lvpStock > 0 });

      // Community feedback
      if (isAttend) {
        // 亲参: face-to-face interaction
        const feedback = calculateFeedback(state);
        state.passion = Math.min(100, state.passion + feedback);
        if (feedback > 0.5) result.deltas.push({ icon: 'chat-circle', label: '现场交流反馈', value: `热情+${feedback.toFixed(1)}`, positive: true });
      } else {
        // 寄售: online feedback — smaller but reliable
        if (totalEventSold > 0) {
          const onlineFeedback = Math.min(5, Math.round(totalEventSold * 0.3));
          state.passion = Math.min(100, state.passion + onlineFeedback);
          result.deltas.push({ icon: 'phone', label: '线上反馈', value: `热情+${onlineFeedback}`, positive: true });
        }
        // 买家晒图 chance (scaled by reputation)
        const shareChance = Math.min(0.5, 0.15 + state.reputation * 0.05);
        if (totalEventSold > 0 && Math.random() < shareChance) {
          const sharePassion = 3 + Math.min(5, Math.round(state.reputation));
          state.passion = Math.min(100, state.passion + sharePassion);
          result.deltas.push({ icon: 'camera', label: '买家晒图！', value: `热情+${sharePassion}`, positive: true });
        }
      }

      // Clear event (selling happens immediately at the event)
      state.attendingEvent = null;
      result.tip = TIPS.doujinEvent;

      // Clean up old event turn records (keep last 12 months)
      state.recentEventTurns = state.recentEventTurns.filter(t => state.turn - t < 12);
      } // end non-cancelled branch
    }

  } else if (action.type === 'jobSearch') {
    // If full-time doujin, first transition to job-seeking
    if (state.fullTimeDoujin && !state.unemployed) {
      state.fullTimeDoujin = false;
      state.unemployed = true;
      state.jobSearchTurns = 0;
      state.doujinWorkYearReset = state.turn; // remember for salary reset
      result.deltas.push({ icon: 'briefcase', label: '决定回去找工作', value: '全职同人→求职中', positive: false });
      result.deltas.push({ icon: 'warning', label: '重返职场后薪资从头开始', value: '基础¥800/月', positive: false });
      result.tip = { label: '回归职场', text: '放弃全职同人回去上班——这不是失败，是务实的选择。但离开职场这段时间不计入工龄，薪资要从基础水平重新开始。' };
    } else {
    // === UNEMPLOYMENT: looking for work ===
    state.passion -= 10;
    state.jobSearchTurns++;
    result.deltas.push({ icon: 'heart', label: '面试奔波消耗', value: '-10', positive: false });
    // Base find probability: 30%, +10% per month searching, recession halves it
    const baseProb = 0.3 + state.jobSearchTurns * 0.1;
    const findProb = Math.min(0.85, state.recessionTurnsLeft > 0 ? baseProb * 0.5 : baseProb);
    if (Math.random() < findProb) {
      state.unemployed = false;
      state.jobSearchTurns = 0;
      // Salary reset if returning from full-time doujin
      if (state.doujinWorkYearReset > 0) state.doujinWorkYearReset = state.turn; // reset work year reference
      result.deltas.push({ icon: 'confetti', label: '找到工作了！', value: '恢复正常生活', positive: true });
      result.tip = TIPS.jobFound;
    } else {
      result.deltas.push({ icon: 'smiley-nervous', label: '还没找到工作...', value: `已找${state.jobSearchTurns}个月`, positive: false });
      if (state.recessionTurnsLeft > 0) {
        result.deltas.push({ icon: 'trend-down', label: '经济下行增加求职难度', value: `成功率${Math.round(findProb * 100)}%`, positive: false });
      }
      result.tip = TIPS.jobSearching;
    }
    } // end else (not fullTimeDoujin transition)

  } else if (action.type === 'hvp') {
    // === MULTI-TURN HVP PROJECT ===
    const hvpBaseCost = Math.max(8, 15 - (state.endowments.stamina || 0) - state.equipmentLevel);
    const fatigueCost = state.creativeFatigue >= 2 ? (state.creativeFatigue - 1) * 3 : 0;
    state.passion -= hvpBaseCost + fatigueCost;
    result.deltas.push({ icon: 'heart', label: '本月创作消耗', value: `-${hvpBaseCost + fatigueCost}`, positive: false });
    if (fatigueCost > 0) result.deltas.push({ icon: 'battery-medium', label: '创作疲劳加重消耗', value: `额外-${fatigueCost}`, positive: false });

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
      if (state.hvpProject.styleTag) result.deltas.push({ icon: 'mask-happy', label: `风格：${state.hvpProject.styleTag}`, value: '', positive: true });
      if (state.hasPartner) {
        result.deltas.push({ icon: 'handshake', label: '搭档协作', value: `${needed}个月完成`, positive: true });
        if (state.partnerFee > 0) result.deltas.push({ icon: 'coins', label: '预计搭档稿费', value: `¥${state.partnerFee}（完成时付）`, positive: false });
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
          result.deltas.push({ icon: 'sparkle', label: '精雕细琢的额外消耗', value: `-${state.hvpProject._extraPassionCost}`, positive: false });
          state.hvpProject._extraPassionCost = 0;
        }
        state._pendingChoices = null;
      }
      // Work stage: creative efficiency reduced (fatigue after day job)
      let progressEff = getLifeStage(state.turn) === 'work' && !state.unemployed && !state.fullTimeDoujin ? 0.7 : 1.0;
      // Creative fatigue efficiency penalty
      if (state.creativeFatigue >= 3) {
        progressEff *= 0.85;
        result.deltas.push({ icon: 'battery-medium', label: '创作疲劳拖慢进度', value: `效率×0.85`, positive: false });
      }
      state.hvpProject.progress += progressEff;
      if (getLifeStage(state.turn) === 'work' && !state.unemployed) {
        result.deltas.push({ icon: 'smiley-sad', label: '下班后创作效率降低', value: '进度×0.7', positive: false });
      }
      const p = state.hvpProject;
      if (p.progress >= p.needed) {
        // === HVP COMPLETE → ADD TO INVENTORY ===
        // Creative fatigue: completing a full work is exhausting
        state.creativeFatigue += 2;
        // Quality penalty from fatigue
        if (state.creativeFatigue >= 5) {
          p.workQuality *= 0.85;
          result.deltas.push({ icon: 'battery-medium', label: '创作疲劳影响作品质量', value: '质量×0.85', positive: false });
        }
        // Equipment quality bonus
        if (state.equipmentLevel > 0) {
          p.workQuality += state.equipmentLevel * 0.08;
        }
        // Time debuff from fatigue
        if (state.creativeFatigue >= 4) {
          state.timeDebuffs.push({ id: 'creative_exhaust_' + state.turn, reason: '创作透支', turnsLeft: 2, delta: -1 });
          result.deltas.push({ icon: 'battery-medium', label: '连续创作身体吃不消', value: '时间-1h(2回合)', positive: false });
        }
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
        result.deltas.push({ icon: 'printer', label: `印刷成本${costLabels.length ? '(' + costLabels.join(' ') + ')' : ''}`, value: `-¥${printCost}`, positive: false });
        if (partnerCost > 0) result.deltas.push({ icon: 'handshake', label: '搭档稿费', value: `-¥${partnerCost}`, positive: false });
        result.deltas.push({ icon: 'package', label: `印刷${batchQty}本入库`, value: `库存${state.inventory.hvpStock}本 定价¥${state.inventory.hvpPrice}`, positive: true });

        // Anti-speculator strategy (frmn.md: creator countermeasures)
        const strategy = state._antiSpecStrategy || 'normal';
        state._antiSpecStrategy = null;
        if (strategy === 'unlimited') {
          // 不限量：投机客无法预估存量，泡沫项趋近于零
          if (state.official) state.official.secondHandPool.hvp = Math.floor(state.official.secondHandPool.hvp * 0.7);
          result.deltas.push({ icon: 'infinity', label: '不限量发售·抑制投机', value: '同人本二手市场压力下降', positive: true });
        } else if (strategy === 'signed') {
          // To签定制：流通因子降低，二手转售价值断崖
          if (state.official) state.official.secondHandPool.hvp = Math.max(0, state.official.secondHandPool.hvp - 3);
          result.deltas.push({ icon: 'pencil', label: 'To签限定·切断二手流通', value: '同人本二手市场压力下降 声誉+', positive: true });
          state.reputation += 0.1;
        } else if (strategy === 'digital') {
          // 同时发电子版：内容效用被低成本满足，投机买家减少
          if (state.official) state.official.secondHandPool.hvp = Math.floor(state.official.secondHandPool.hvp * 0.8);
          const digiRev = Math.round(batchQty * state.inventory.hvpPrice * 0.3);
          state.money += digiRev;
          result.deltas.push({ icon: 'phone', label: '同步电子版', value: `电子版收入+¥${digiRev}`, positive: true });
        }

        // Reputation gain — base floor + info-scaled + skill
        const repGain = (0.04 + 0.08 * state.infoDisclosure) * (1 + (state.endowments.talent || 0) * 0.10) * fx.repBonus;
        state.reputation += repGain;
        state.maxReputation = Math.max(state.maxReputation, state.reputation);
        result.deltas.push({ icon: 'star', label: '新作声誉', value: `+${repGain.toFixed(2)}`, positive: true });

        // Community feedback (people know you released something new)
        const feedback = calculateFeedback(state);
        state.passion = Math.min(100, state.passion + feedback);
        result.deltas.push({ icon: 'chat-circle', label: '社群反馈', value: `热情+${feedback.toFixed(1)}`, positive: feedback > 0 });

        state.totalHVP++;

        // Breakthrough chance — skill makes occasional masterpieces possible
        if (Math.random() < fx.breakthroughChance) {
          const bkRep = 0.3 + skill * 0.1;
          const bkPassion = 10 + Math.round(skill * 2);
          state.reputation += bkRep;
          state.maxReputation = Math.max(state.maxReputation, state.reputation);
          state.passion = Math.min(100, state.passion + bkPassion);
          result.deltas.push({ icon: 'sparkle', label: '突破之作！质量超出预期', value: `声誉+${bkRep.toFixed(1)} 热情+${bkPassion}`, positive: true });
          result.tip = { label: `${ic('sparkle')} 学习曲线突破`, text: `累计创作${state.totalHVP}本同人志，你的技艺已达到${getSkillLabel(skill)}级（${skill.toFixed(1)}）。学习曲线理论预测：累计产出越多，生产效率越高、品质越稳定。偶尔的突破之作是量变引发质变的证明——这就是为什么"坚持创作"比"等灵感来"更靠谱。` };
        } else {
          result.tip = TIPS.hvpComplete;
        }
        if (state.passion < 30) result.tip = TIPS.burnout;
      } else {
        result.deltas.push({ icon: 'book-open-text', label: '继续创作中...', value: `进度 ${Math.floor(p.progress)}/${p.needed}`, positive: true });
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
    let lvpQuality = Math.max(0.5, Math.min(1.8, 1.0 + (pfx.qualityMod || 0)));

    const skill = getCreativeSkill(state);
    const fx = getSkillEffects(skill);

    // Creative fatigue: LVP adds +1
    state.creativeFatigue += 1;
    const lvpFatigueCost = state.creativeFatigue >= 2 ? (state.creativeFatigue - 1) * 3 : 0;
    state.passion -= Math.max(3, 8 - state.equipmentLevel) + lvpFatigueCost;
    if (lvpFatigueCost > 0) result.deltas.push({ icon: 'battery-medium', label: '创作疲劳加重消耗', value: `额外-${lvpFatigueCost}`, positive: false });
    // Fatigue quality penalty
    if (state.creativeFatigue >= 5) {
      lvpQuality *= 0.85;
      result.deltas.push({ icon: 'battery-medium', label: '疲劳影响谷子质量', value: '质量×0.85', positive: false });
    }
    // Equipment quality bonus
    if (state.equipmentLevel > 0) lvpQuality += state.equipmentLevel * 0.08;
    const costMult = state.recessionTurnsLeft > 0 ? 1.2 : 1.0;
    const skillDiscount = 1 - fx.costReduction;
    const actualCost = Math.round(sub.cost * (pfx.costMod || 1.0) * costMult * skillDiscount);
    state.money -= actualCost;
    result.deltas.push({ icon: 'heart', label: '创作消耗', value: '-8', positive: false });
    const lvpCostLabels = [];
    if (costMult > 1) lvpCostLabels.push('下行+20%');
    if (fx.costReduction > 0.01) lvpCostLabels.push(`熟练-${Math.round(fx.costReduction * 100)}%`);
    if ((pfx.costMod || 1) !== 1) lvpCostLabels.push(pfx.costMod > 1 ? '精装' : '简装');
    result.deltas.push({ icon: 'coins', label: `制作成本${lvpCostLabels.length ? '(' + lvpCostLabels.join(' ') + ')' : ''}`, value: `-¥${actualCost}`, positive: false });

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

    // Reputation gain — base floor + info-scaled + skill
    const repGain = (0.01 + 0.02 * state.infoDisclosure) * (1 + (state.endowments.talent || 0) * 0.10) * fx.repBonus;
    state.reputation += repGain;
    state.maxReputation = Math.max(state.maxReputation, state.reputation);
    result.deltas.push({ icon: 'star', label: '新品声誉', value: `+${repGain.toFixed(2)}`, positive: true });

    // Community feedback
    const feedback = calculateFeedback(state);
    state.passion = Math.min(100, state.passion + feedback);
    result.deltas.push({ icon: 'chat-circle', label: '社群反馈', value: `热情+${feedback.toFixed(1)}`, positive: feedback > 0 });

    // LVP breakthrough (rarer than HVP, half chance)
    if (Math.random() < fx.breakthroughChance * 0.5) {
      const bkRep = 0.15 + skill * 0.05;
      const bkPassion = 6 + Math.round(skill);
      state.reputation += bkRep;
      state.maxReputation = Math.max(state.maxReputation, state.reputation);
      state.passion = Math.min(100, state.passion + bkPassion);
      result.deltas.push({ icon: 'sparkle', label: '精品谷子！超出预期的品质', value: `声誉+${bkRep.toFixed(1)} 热情+${bkPassion}`, positive: true });
    }
    result.tip = TIPS.lvp;

  } else if (action.type === 'reprint') {
    // === REPRINT: add more copies to a specific work ===
    state.passion -= 3;
    result.deltas.push({ icon: 'heart', label: '安排印刷', value: '-3', positive: false });

    const workId = state._reprintWorkId;
    state._reprintWorkId = null;

    // Find the work — it might have qty=0 (sold out) or still have stock
    let work = state.inventory.works.find(w => w.id === workId);
    if (!work && workId != null) {
      // Work was cleaned up (qty=0 and removed), recreate it from history
      // Fallback: just do nothing
    }
    if (work) {
      const isHVP = work.type === 'hvp';
      const sub = isHVP ? (HVP_SUBTYPES[work.subtype] || HVP_SUBTYPES.manga) : (LVP_SUBTYPES[work.subtype] || LVP_SUBTYPES.acrylic);
      const qty = isHVP ? 30 : 20;
      const unitCost = isHVP ? 40 : 6;
      const cost = qty * unitCost;
      state.money -= cost;
      work.qty += qty;
      syncInventoryAggregates(state);
      result.deltas.push({ icon: 'printer', label: `追印${sub.name} ${qty}${isHVP ? '本' : '个'}`, value: `-¥${cost}`, positive: false });
      result.deltas.push({ icon: 'package', label: '库存更新', value: `${sub.name}×${work.qty} 定价¥${work.price}`, positive: true });
    } else {
      result.deltas.push({ icon: 'warning', label: '没有找到可追印的作品', value: '', positive: false });
    }
    result.tip = { label: '库存管理', text: '追加印刷的单价比首印便宜（印版/模具已有）。关键是预判展会需求——印太多积压资金，印太少展会上售罄错失收入。' };

  } else if (action.type === 'buyGoods') {
    // === BUY GOODS AS CONSUMER: cost scales with wealth, passion stays constant ===
    const m = Math.max(0, state.money);
    const cost = m < 3000 ? 200 : m < 6000 ? 600 : m < 9000 ? 1500 : m < 15000 ? 3000 : 5000;
    state.money -= cost;
    result.deltas.push({ icon: 'coins', label: `购买谷子${cost > 200 ? '(眼光变高了)' : ''}`, value: `-¥${cost}`, positive: false });

    // Fixed passion gain — buying goods always feels good
    const passionGain = 12;
    state.passion = Math.min(100, state.passion + passionGain);
    result.deltas.push({ icon: 'heart', label: '买到心仪的谷子！', value: `热情+${passionGain}`, positive: true });

    if (cost > 200) {
      result.deltas.push({ icon: 'sparkle', label: '钱多了品味也上来了', value: `花费¥${cost}`, positive: false });
    }

    // Small info disclosure gain (you're engaging with the community)
    state.infoDisclosure = Math.min(1, state.infoDisclosure + 0.05);
    result.deltas.push({ icon: 'megaphone', label: '社群参与', value: `信息+5%`, positive: true });

    // Add to personal collection
    state.goodsCollection++;
    result.deltas.push({ icon: 'package', label: '加入收藏', value: `收藏品${state.goodsCollection}件`, positive: true });

    result.tip = { label: '消费者身份 (双重角色)', text: '同人创作者同时也是消费者——买别人的谷子是维持热情的重要方式。钱多了之后眼光也会变高，花费也随之增加。购入的谷子日后可以在二手市场出售回血。' };

  } else if (action.type === 'sellGoods') {
    // === SELL COLLECTION TO SECONDHAND MARKET ===
    if (state.goodsCollection <= 0) {
      result.deltas.push({ icon: 'export', label: '没有收藏品可出', value: '', positive: false });
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

      result.deltas.push({ icon: 'export', label: `出售${sellQty}件收藏品`, value: `+¥${revenue}（¥${unitPrice}/件）`, positive: true });
      result.deltas.push({ icon: 'heart', label: '割爱之痛', value: '-3', positive: false });
      if (state.goodsCollection > 0) {
        result.deltas.push({ icon: 'package', label: '剩余收藏', value: `${state.goodsCollection}件`, positive: true });
      }
      result.tip = { label: '二手回血 (frmn.md)', text: `二手市场是跨期预算调节器。大部分会转化为对A类新作的购买力。二手价格受市场压力影响：当前同人谷二手压力${Math.round(shPressure * 100)}%，压力越大价格越低。` };
    }
  }

  // --- Hire assistant (outsource for current HVP project) ---
  if (action.type === 'hireAssistant' && state.hvpProject) {
    const assistCost = 800 + Math.floor(Math.random() * 700);
    state.money -= assistCost;
    state.hvpProject.progress += 0.5;
    state.hvpProject._assistantCount = (state.hvpProject._assistantCount || 0) + 1;
    state.creativeFatigue = Math.max(0, state.creativeFatigue - 1);
    result.deltas.push({ icon: 'user', label: '外包助手加速创作', value: `-¥${assistCost}`, positive: false });
    result.deltas.push({ icon: 'book-open-text', label: '同人本进度推进', value: `+0.5 → ${Math.floor(state.hvpProject.progress)}/${state.hvpProject.needed}`, positive: true });
    result.deltas.push({ icon: 'battery-medium', label: '创作疲劳缓解', value: '-1', positive: true });
    result.tip = { label: '外包协作', text: '外包上色、排版、贴网点等工作可以加速项目进度，同时减轻创作疲劳。但费用不低，且同一项目最多请2次。' };
  }

  // --- Upgrade equipment ---
  if (action.type === 'upgradeEquipment') {
    const costs = [3000, 5000, 8000];
    const cost = costs[state.equipmentLevel];
    state.money -= cost;
    state.equipmentLevel++;
    result.deltas.push({ icon: 'desktop', label: `设备升级到Lv${state.equipmentLevel}！`, value: `-¥${cost}`, positive: false });
    result.deltas.push({ icon: 'sparkle', label: '作品质量永久提升', value: `+${(state.equipmentLevel * 0.08 * 100).toFixed(0)}%`, positive: true });
    result.deltas.push({ icon: 'heart', label: '创作消耗永久降低', value: `-${state.equipmentLevel}/月`, positive: true });
    result.tip = { label: '设备投资', text: `更好的设备意味着更高的作品质量和更低的创作消耗。当前Lv${state.equipmentLevel}，最高Lv3。` };
  }

  // --- Sponsor community ---
  if (action.type === 'sponsorCommunity') {
    const cs = state.market ? state.market.communitySize : 10000;
    const cost = Math.round(1500 + cs / 10000 * 1500);
    state.money -= cost;
    state.lastSponsorTurn = state.turn;
    const repGain = 0.12 + Math.min(0.08, state.reputation * 0.01);
    state.reputation += repGain;
    state.maxReputation = Math.max(state.maxReputation, state.reputation);
    state.passion = Math.min(100, state.passion + 8);
    state.infoDisclosure = Math.min(1, state.infoDisclosure + 0.15);
    result.deltas.push({ icon: 'hand-heart', label: '赞助社区活动', value: `-¥${cost}`, positive: false });
    result.deltas.push({ icon: 'star', label: '社区好感', value: `声誉+${repGain.toFixed(2)}`, positive: true });
    result.deltas.push({ icon: 'heart', label: '回馈的满足感', value: '热情+8', positive: true });
    result.deltas.push({ icon: 'megaphone', label: '曝光度提升', value: '+15%', positive: true });
    result.tip = { label: '社区赞助', text: '赞助同人展或社区活动是建立口碑的有效方式。不仅提升声誉和曝光度，回馈圈子本身也会带来热情回复。冷却6个月。' };
  }

  // --- Commercial transition: player accepts publisher offer ---
  // === Quit job for full-time doujin ===
  if (action.type === 'quitForDoujin') {
    state.fullTimeDoujin = true;
    state.doujinMonths = 0;
    state.monthlyIncome = 0;
    state.doujinWorkYearReset = state.turn; // mark for salary reset if returning
    // Clear work-related debuffs (promotion, commute, 996 etc.)
    state.timeDebuffs = state.timeDebuffs.filter(d => !['promotion', '996'].includes(d.id) && !d.id.startsWith('commute_') && !d.id.startsWith('social_') && !d.id.startsWith('burnout_'));
    state.time = Math.max(0, Math.min(10, 7 + state.timeDebuffs.reduce((s, d) => s + d.delta, 0)));
    state.passion = Math.min(100, state.passion + 10);
    result.deltas.push({ icon: 'sparkle', label: '辞职了！全身心投入同人创作！', value: '闲暇→7h 月收入→0', positive: true });
    result.deltas.push({ icon: 'heart', label: '自由的感觉真好', value: '热情+10', positive: true });
    result.deltas.push({ icon: 'warning', label: '每月生活费¥800自动扣除', value: '没有固定收入了', positive: false });
    result.tip = { label: '全职同人创作者', text: '你选择了最勇敢的道路——辞掉工作，全身心投入同人创作。时间自由了，但收入完全靠自己。存款就是你的安全线，低于¥5000时焦虑会开始侵蚀热情。如果撑不住，随时可以回去找工作——但薪资要从头开始。' };
  }

  if (action.type === 'goCommercial') {
    state.commercialTransition = true;
    checkAchievements(state); // ensure commercial_debut achievement is recorded
    state.passion = 0;
    state.phase = 'gameover';
    state.gameOverReason = generateCommercialEnding(state);
    result.deltas.push({ icon: 'star', label: '商业出道！', value: '告别同人，踏入商业创作', positive: true });
    result.tip = { label: '从同人到商业', text: '许多传奇创作者都走过这条路——从Comiket的小摊位到出版社的签约作者。同人创作培养的技能、积累的粉丝、锻炼的市场嗅觉，都是商业化最好的基础。你不是在"离开"同人圈，而是在"毕业"。' };
    state.lastResult = result;
    return result;
  }

  // --- Partner effects (low resilience amplifies negative interpersonal impact) ---
  const resil = state.endowments.resilience || 0;
  // Low resilience: 0→1.8x, 1→1.4x, 2→1.0x, 3→0.85x (people-related pain hits harder)
  const interpersonalMult = resil <= 1 ? 2.3 - resil * 0.5 : Math.max(0.7, 1.0 - (resil - 2) * 0.15);
  if (state.hasPartner && state.partnerType) {
    const pt = PARTNER_TYPES[state.partnerType];
    if (pt.passionPerTurn !== 0) {
      const ppt = pt.passionPerTurn < 0 ? Math.round(pt.passionPerTurn * interpersonalMult) : pt.passionPerTurn;
      state.passion = Math.min(100, state.passion + ppt);
      result.deltas.push({ icon: 'handshake', label: ppt > 0 ? '搭档正面影响' : '搭档带来压力', value: `热情${ppt > 0 ? '+' : ''}${ppt}`, positive: ppt > 0 });
      if (ppt < pt.passionPerTurn && interpersonalMult > 1.1) {
        result.deltas.push({ icon: 'shield', label: '心理韧性不足，人际冲突更伤人', value: `×${interpersonalMult.toFixed(1)}`, positive: false });
      }
    }
    // Drama chance also higher for low resilience
    const dramaCh = pt.dramaChance * (interpersonalMult > 1 ? 1 + (interpersonalMult - 1) * 0.5 : 1);
    if (dramaCh > 0 && Math.random() < dramaCh) {
      const drama = rollPartnerDrama(state.partnerType);
      const ampPassion = Math.round(drama.passionDelta * interpersonalMult);
      const ampRep = drama.reputationDelta * (interpersonalMult > 1 ? interpersonalMult : 1);
      state.passion = Math.max(0, state.passion + ampPassion);
      state.reputation = Math.max(0, state.reputation + ampRep);
      result.deltas.push({ icon: 'warning', label: drama.desc, value: `热情${ampPassion} 声誉${ampRep < 0 ? ampRep.toFixed(1) : ''}`, positive: false });
    }
    state.partnerTurns--;
    if (state.partnerTurns <= 0) {
      const wasType = state.partnerType;
      state.hasPartner = false; state.partnerType = null;
      result.deltas.push({ icon: 'handshake', label: wasType === 'toxic' ? '终于摆脱了有毒搭档...' : '搭档合作期结束', value: '', positive: wasType === 'toxic' });
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

  // --- Reality drain (with income/savings buffer during work stage) ---
  const rawDrain = getRealityDrain(state.turn);
  let drain = Math.max(0, rawDrain - (state.endowments.resilience || 0) * 0.5); // resilience reduces drain
  if (drain > 0 && getLifeStage(state.turn) === 'work') {
    const incomeBuffer = state.monthlyIncome > 0 ? Math.min(0.4, state.monthlyIncome / 5000) : 0;
    const savingsBuffer = state.money > 3000 ? Math.min(0.2, (state.money - 3000) / 30000) : 0;
    const totalBuffer = Math.min(0.5, incomeBuffer + savingsBuffer);
    drain = drain * (1 - totalBuffer);
    if (totalBuffer > 0.05) {
      result.deltas.push({ icon: 'coins', label: '经济稳定缓冲现实压力', value: `-${Math.round(totalBuffer * 100)}%`, positive: true });
    }
  }
  if (drain > 0) {
    state.passion = Math.max(0, state.passion - drain);
    result.deltas.push({ icon: 'globe', label: '现实消耗', value: `热情-${drain.toFixed(1)}`, positive: false });
  }

  // --- Inactivity drain: the longer you stop creating, the faster passion fades ---
  const idleMonths = state.turn - state.lastCreativeTurn;
  if (idleMonths >= 3) {
    const idleDrain = Math.min(8, Math.floor((idleMonths - 2) * 1.5));
    state.passion = Math.max(0, state.passion - idleDrain);
    result.deltas.push({ icon: 'hourglass', label: '活动停滞', value: `热情-${idleDrain}（已${idleMonths}月未活动）`, positive: false });
  }

  // --- Secondhand market frustration: seeing your works sold cheap ---
  const shLvpPressure = state.official?.secondHandPressure?.lvp || 0;
  if (shLvpPressure > 0.3 && (state.totalHVP > 0 || state.totalLVP > 0)) {
    const shPassionHit = Math.min(4, Math.round((shLvpPressure - 0.3) * 8));
    if (shPassionHit > 0) {
      state.passion = Math.max(0, state.passion - shPassionHit);
      result.deltas.push({ icon: 'package', label: '二手泛滥挫败感', value: `热情-${shPassionHit}`, positive: false });
    }
  }

  // --- Debt anxiety: negative money → passion drain (worry, not fun anymore) ---
  const debtThreshold = (state.endowments.resilience || 0) * 200; // resilience delays anxiety
  if (state.money < -debtThreshold) {
    const debtLevel = Math.abs(state.money) - debtThreshold;
    // Every ¥500 in debt → 2 extra passion drain
    const debtDrain = Math.min(10, Math.floor(debtLevel / 500) * 2);
    if (debtDrain > 0) {
      state.passion = Math.max(0, state.passion - debtDrain);
      result.deltas.push({ icon: 'money', label: '亏损焦虑', value: `热情-${debtDrain}`, positive: false });
    }
  }

  // --- Passive income ---
  const stage = getLifeStage(state.turn);
  if (stage === 'university') {
    const bgMult = BACKGROUNDS[state.background]?.allowanceMult || 1.0;
    const baseAllowance = Math.round((150 + Math.floor(Math.random() * 100)) * bgMult);
    // Random spending that eats into allowance + may dip into doujin savings
    // Each event type has: probability, allowance consumption ratio, savings dip ratio (urgency-based)
    const spendRoll = Math.random();
    let spending = 0;
    let dip = 0; // amount taken from doujin savings
    let spendLabel = '';
    const savingsDipBase = state.money > 200 ? state.money : 0; // only dip if there's something to take

    if (spendRoll < 0.15) {
      // 15%: 聚餐/社交 — 紧急社交，花超+挪用多
      spending = Math.round(baseAllowance * (0.7 + Math.random() * 0.3));
      dip = savingsDipBase > 0 ? Math.round(savingsDipBase * (0.04 + Math.random() * 0.03)) : 0; // 4-7%
      spendLabel = '聚餐社交花超了';
    } else if (spendRoll < 0.25) {
      // 10%: 换季买衣服/日用品 — 半紧急
      spending = Math.round(baseAllowance * (0.5 + Math.random() * 0.3));
      dip = savingsDipBase > 0 ? Math.round(savingsDipBase * (0.02 + Math.random() * 0.02)) : 0; // 2-4%
      spendLabel = '换季添置/日用品';
    } else if (spendRoll < 0.35) {
      // 10%: 冲动消费 — "反正有存款"心态，挪用较多
      spending = Math.round(baseAllowance * (0.4 + Math.random() * 0.4));
      dip = savingsDipBase > 0 ? Math.round(savingsDipBase * (0.05 + Math.random() * 0.04)) : 0; // 5-9%
      spendLabel = '冲动消费';
    } else if (spendRoll < 0.50) {
      // 15%: 零碎支出 — 不紧急，小额挪用
      spending = Math.round(baseAllowance * (0.2 + Math.random() * 0.2));
      dip = savingsDipBase > 0 ? Math.round(savingsDipBase * (0.01 + Math.random() * 0.01)) : 0; // 1-2%
      spendLabel = '零碎支出';
    }
    // else 50%: no extra spending

    const allowance = Math.max(0, baseAllowance - spending);
    state.money += allowance;
    if (dip > 0) state.money -= dip;

    if (spending > 0 || dip > 0) {
      result.deltas.push({ icon: 'house', label: '生活费结余', value: `+¥${baseAllowance}`, positive: true });
      if (spending > 0) result.deltas.push({ icon: 'shopping-cart', label: spendLabel, value: `-¥${spending}`, positive: false });
      if (dip > 0) result.deltas.push({ icon: 'money', label: '顺手挪用了同人存款', value: `-¥${dip}`, positive: false });
    } else {
      result.deltas.push({ icon: 'house', label: '生活费结余', value: `+¥${allowance}`, positive: true });
    }
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
      result.deltas.push({ icon: 'smiley-nervous', label: '失业焦虑', value: `热情-${anxietyDrain}`, positive: false });
      if (moneyMod > 0.1) {
        result.deltas.push({ icon: 'coins', label: `存款¥${state.money.toLocaleString()}缓冲焦虑`, value: `-${Math.round(moneyMod * 100)}%`, positive: true });
      } else if (moneyMod < -0.1) {
        result.deltas.push({ icon: 'money', label: `负债¥${Math.abs(state.money).toLocaleString()}加剧焦虑`, value: `+${Math.round(-moneyMod * 100)}%`, positive: false });
      }
      result.deltas.push({ icon: 'briefcase', label: '无工资收入', value: '¥0', positive: false });
      // Unemployment living cost erosion: general savings cover most, but pressure leaks into doujin fund
      const impliedLiving = (state.lastSalary || 800) * 2; // implied full living cost ≈ surplus × 2
      const erosionRate = Math.min(0.6, 0.15 + state.jobSearchTurns * 0.08); // 15%→60% over months
      const unemployedExpense = Math.round(impliedLiving * erosionRate);
      state.money -= unemployedExpense;
      result.deltas.push({ icon: 'house', label: `生活费侵蚀同人资金(${Math.round(erosionRate * 100)}%)`, value: `-¥${unemployedExpense}`, positive: false });
    } else if (state.fullTimeDoujin) {
      // Full-time doujin: no salary, fixed living cost, anxiety based on savings
      state.doujinMonths = (state.doujinMonths || 0) + 1;
      state.monthlyIncome = 0;
      const livingCost = 800;
      state.money -= livingCost;
      result.deltas.push({ icon: 'house', label: '生活费', value: `-¥${livingCost}`, positive: false });

      // Anxiety based on savings level
      let doujinAnxiety = 0;
      if (state.money < 0) { doujinAnxiety = 10; result.deltas.push({ icon: 'smiley-nervous', label: '负债焦虑：全职同人撑不下去了', value: `热情-${doujinAnxiety}`, positive: false }); }
      else if (state.money < 5000) { doujinAnxiety = 5; result.deltas.push({ icon: 'smiley-nervous', label: '存款吃紧，有点慌', value: `热情-${doujinAnxiety}`, positive: false }); }
      else if (state.money < 10000) { doujinAnxiety = 2; result.deltas.push({ icon: 'smiley-meh', label: '存款在减少...', value: `热情-${doujinAnxiety}`, positive: false }); }
      state.passion = Math.max(0, state.passion - doujinAnxiety);
    } else {
      const bgSalaryMult = BACKGROUNDS[state.background]?.salaryMult || 1.0;
      const workStart = state.doujinWorkYearReset > 0 ? state.doujinWorkYearReset : 50; // reset if returned from doujin
      const baseSalary = Math.round((800 + Math.max(0, Math.floor((state.turn - workStart) / 12)) * 200) * bgSalaryMult);
      const salary = state.recessionTurnsLeft > 0 ? Math.floor(baseSalary * 0.8) : baseSalary; // recession cuts salary
      state.money += salary;
      state.monthlyIncome = salary;
      result.deltas.push({ icon: 'briefcase', label: `工资${state.recessionTurnsLeft > 0 ? '(下行-20%)' : ''}`, value: `+¥${salary}`, positive: true });

      // Recession: risk of losing job each month
      const fireChance = Math.max(0.005, 0.06 - (BACKGROUNDS[state.background]?.fireResist || 0));
      if (state.recessionTurnsLeft > 0 && Math.random() < fireChance) {
        state.unemployed = true;
        state.jobSearchTurns = 0;
        state.monthlyIncome = 0;
        state.time = 7; // lots of free time (no job) but anxiety drains passion
        result.deltas.push({ icon: 'warning-circle', label: '被裁员了！', value: '失业', positive: false });
        result.deltas.push({ icon: 'note-pencil', label: '失业后时间充裕，但焦虑会快速消耗热情', value: '', positive: false });
      }
    }
  }

  // --- Lifestyle spending escalation (消费升级: surplus income eroded by lifestyle creep) ---
  if (getLifeStage(state.turn) === 'work') {
    const workYears = (state.turn - 50) / 12;
    const salaryRef = state.unemployed ? state.lastSalary : state.monthlyIncome;
    if (!state.unemployed) state.lastSalary = state.monthlyIncome;
    if (salaryRef > 0) {
      const spendRate = Math.min(0.5, 0.1 + workYears * 0.04);
      const lifestyleCost = state.unemployed
        ? Math.round(state.lastSalary * 0.3) // 失业: 消费降级有延迟，仍按30%扣
        : Math.round(salaryRef * spendRate);
      if (lifestyleCost > 0) {
        state.money -= lifestyleCost;
        result.deltas.push({ icon: 'shopping-cart', label: `消费升级${state.unemployed ? '(惯性)' : ''}`, value: `-¥${lifestyleCost}`, positive: false });
      }
    }
  }

  // --- Creative fatigue decay ---
  const isCreativeAction = ['hvp', 'lvp'].includes(actionId);
  if (!isCreativeAction && state.creativeFatigue > 0) {
    state.creativeFatigue = Math.max(0, state.creativeFatigue - 0.5);
  }
  if (actionId === 'rest' && state.creativeFatigue > 0) {
    state.creativeFatigue = Math.max(0, state.creativeFatigue - 1); // extra recovery on rest
    result.deltas.push({ icon: 'battery-medium', label: '创作疲劳缓解', value: `疲劳${state.creativeFatigue.toFixed(1)}`, positive: true });
  }

  // --- Info disclosure: rapid decay (information flood drowns everything fast) ---
  const infoDecay = 0.12 - (state.endowments.marketing || 0) * 0.015; // base 12%/month, marketing slows
  state.infoDisclosure = Math.max(0.05, state.infoDisclosure - infoDecay);

  // --- Passive online sales (trickle from inventory each turn, affected by secondhand) ---
  if ((state.inventory.hvpStock > 0 || state.inventory.lvpStock > 0) && action.type !== 'attendEvent') {
    const cs = state.market ? state.market.communitySize : 10000;
    const nHVP = state.market?.nHVP || 9;
    const nLVP = state.market?.nLVP || 55;
    const baseConv = Math.min(0.95, 0.20 + state.infoDisclosure * 0.50);
    const onlineFactor = 0.12; // online sales are ~12% of full market demand
    const onlineShModHVP = getSecondHandModifier(state.official, 'hvp');
    const onlineShModLVP = getSecondHandModifier(state.official, 'lvp');

    if (state.inventory.hvpStock > 0) {
      const totalAlpha = nHVP * 2.0 + state.reputation;
      const share = totalAlpha > 0 ? state.reputation / totalAlpha : 0.1;
      const rawDemand = cs / 1000 * 5 * share * baseConv * onlineFactor * onlineShModHVP;
      // Guarantee at least 1 sale if reputation > 0 and info > 0 (long tail online)
      const demand = Math.max(state.reputation > 0.1 && state.infoDisclosure > 0.08 ? 1 : 0, Math.round(rawDemand));
      const sold = Math.min(demand, state.inventory.hvpStock);
      if (sold > 0) {
        const hvpResult = sellFromWorks(state, 'hvp', sold);
        state.money += hvpResult.revenue;
        state.totalRevenue += hvpResult.revenue;
        state.totalSales += hvpResult.sold;
        const repGain = (0.02 + 0.06 * state.infoDisclosure) * hvpResult.sold * 0.03;
        state.reputation += repGain;
        result.deltas.push({ icon: 'globe-simple', label: `网上售出同人本×${hvpResult.sold}`, value: `+¥${hvpResult.revenue}`, positive: true });
      }
    }

    if (state.inventory.lvpStock > 0) {
      const totalAlpha = nLVP * 0.5 + state.reputation;
      const share = totalAlpha > 0 ? state.reputation / totalAlpha : 0.1;
      const rawDemand = cs / 1000 * 15 * share * baseConv * onlineFactor * onlineShModLVP;
      const demand = Math.max(state.reputation > 0.1 && state.infoDisclosure > 0.08 ? 1 : 0, Math.round(rawDemand));
      const sold = Math.min(demand, state.inventory.lvpStock);
      if (sold > 0) {
        const lvpResult = sellFromWorks(state, 'lvp', sold);
        state.money += lvpResult.revenue;
        state.totalRevenue += lvpResult.revenue;
        state.totalSales += lvpResult.sold;
        result.deltas.push({ icon: 'globe-simple', label: `网上售出谷子×${lvpResult.sold}`, value: `+¥${lvpResult.revenue}`, positive: true });
      }
    }

    // Show secondhand impact on online sales
    const worstShMod = Math.min(onlineShModHVP, onlineShModLVP);
    if (worstShMod < 0.9) {
      result.deltas.push({ icon: 'package', label: '二手市场挤压网上销量', value: `-${Math.round((1 - worstShMod) * 100)}%`, positive: false });
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
      result.deltas.push({ icon: 'trend-up', label: '经济复苏', value: '下行周期结束', positive: true });
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
  state.time = (state.unemployed || state.fullTimeDoujin)
    ? Math.max(0, Math.min(10, 7 + state.timeDebuffs.reduce((s, d) => s + d.delta, 0)))
    : computeEffectiveTime(state.turn, state.timeDebuffs);

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
// generateEnding, generateCommercialEnding — see endings.js
// rollPartnerDrama — see partner-drama.js
// checkAchievements, getAchievementInfo — see achievements.js
export { _getAchievementInfo as getAchievementInfo };

// === Tips ===
const TIPS = {
  hvpStart: { label: '长期项目', text: '同人本是多月项目——独自需要3个月，有搭档可缩短到2个月。印刷成本¥800-1000在完成时支付。搭档有稿费成本，但可以加速进度。' },
  hvpContinue: { label: '坚持创作', text: '同人本创作需要持续投入。每个月都在消耗热情，但完成后的声誉积累远高于谷子。中途放弃意味着前期投入全部沉没。' },
  hvpComplete: { label: `${ic('confetti')} 作品完成·入库`, text: '同人本完成并入库！现在去参加同人展售卖，或等待网上零售慢慢出货。同时携带同人本和谷子参展会触发联动加成。记得关注库存——卖光了要追加印刷！' },
  lvp: { label: '谷子入库', text: '同人谷一个月就能完成并入库，低门槛低风险。去同人展售卖可以一次卖出大量库存。网上也会有少量零售。注意库存管理——制作太多会积压资金，太少则展会上供不应求。' },
  rest: { label: '热情预算理论', text: '休息恢复热情的效率随入坑年限递减。长期疲惫是不可逆的。同时注意：停滞创作超过3个月后，热情会加速衰减——"不用就会生锈"。' },
  doujinEvent: { label: '同人展经济学 (Stigler)', text: '同人展是"搜寻成本→0"的极端场景：消费者直接翻阅实物，面对面交易消除信息不对称。路费是参展的机会成本，大社群有更多展会选择（规模经济）。' },
  promoteLight: { label: '轻度宣发', text: '低成本维持曝光。信号通胀越严重效果越差。适合资源紧张时维持存在感。信息透明度每月快速衰减，注意节奏。' },
  promoteHeavy: { label: '全力宣发 (Stigler)', text: '大规模宣发：发试阅、打样返图、详细介绍。宣发后立刻制作售卖，抓住窗口！' },
  partnerFound: { label: '协作约束', text: '协作可得性是本子创作的第一大触发条件。默契搭档在热情和销量上都有正面加成。' },
  partnerFail: { label: '声誉与协作', text: '协作概率随声誉递增。声誉越高越容易找到搭档——这是声誉的隐性收益。' },
  partnerRisk: { label: '搭档风险', text: '搭档类型是随机的。严格搭档虽然出品好但压力大，不靠谱搭档可能临时消失。协作引入了额外的不确定性。' },
  partnerToxic: { label: '有毒协作', text: '有毒搭档持续消耗热情，甚至公开引发争端损害声誉。一旦卷入，只能等合作期结束...' },
  burnout: { label: '倦怠风险 ', text: '创作行为本身消耗热情预算，这是"用爱发电"的真实成本。' },
  jobSearching: { label: '失业与外生退出', text: '失业后有更多空闲时间，可以继续创作。但无收入的焦虑会快速侵蚀热情——存款越少，焦虑越重。找工作和创作之间需要权衡。' },
  jobFound: { label: '重返岗位', text: '找到工作了！收入恢复，但失业期间流失的热情和声誉需要时间重建。如果经济仍在下行，要警惕再次失业的风险。' },
  partTimeJob: { label: '时间-金钱权衡', text: '打工赚的钱稳定但不多(¥300~500)，且占用了本可以创作的时间。这就是经济学中的机会成本——打工的每一小时，都是放弃创作的一小时。' },
  freelanceLow: { label: '接稿与声誉', text: '声誉低时接稿收入有限。但接稿本身也是一种技能锻炼。注意：接稿消耗的热情比普通打工更大——因为你在用创作能力换钱，精神消耗更高。' },
  freelanceHigh: { label: '声誉的商业溢出', text: '声誉高的创作者接稿收入远高于普通打工——这是声誉资本的商业变现。但要小心：把太多时间花在接稿上，就没时间做自己真正想做的同人了。' },
};
