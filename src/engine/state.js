import { createMarketState } from '../market.js';
import { createOfficialState } from '../official.js';
import { createAdvancedState } from '../advanced.js';

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

// === Obsessive specialization: push one trait to 4 (free) with a thematic debuff ===
export const OBSESSIVE_TRAITS = {
  talent: {
    name: '偏执·天才', emoji: 'fire',
    desc: '对创作品质近乎疯狂的执着',
    buff: '声誉积累额外+25%，经验获取+50%',
    debuff: '社交能力归零——找搭档成功率-20%，毒搭档概率翻倍',
    // Applied in code: social endowment treated as 0 for partner search; toxic chance ×2
  },
  stamina: {
    name: '偏执·铁人', emoji: 'lightning',
    desc: '无穷的体力，停不下来的创作机器',
    buff: '休息恢复额外+5，创作月耗再-1',
    debuff: '只会埋头苦干——创作经验获取-40%，作品缺乏灵气质量上限-0.15',
    // Applied in code: skillExp gain ×0.6; workQuality capped at -0.15
  },
  social: {
    name: '偏执·社牛', emoji: 'chat-circle',
    desc: '天生的社交达人，人脉就是一切',
    buff: '找搭档+20%，毒搭档率-5%，联系人上限+4',
    debuff: '沉迷社交荒废创作——每月额外热情消耗+3，休息恢复效率-30%',
    // Applied in code: monthly passion drain +3; rest restore ×0.7
  },
  marketing: {
    name: '偏执·话题王', emoji: 'trend-up',
    desc: '营销鬼才，任何东西都能炒热',
    buff: '宣发效果额外+25%，信息衰减再-2%',
    debuff: '重营销轻内容——作品质量-0.1，声誉积累-20%',
    // Applied in code: workQuality -0.1 at creation; reputation gain ×0.8
  },
  resilience: {
    name: '偏执·钝感', emoji: 'wall',
    desc: '刀枪不入的心理防线，什么都伤不到你',
    buff: '现实消耗再-1，负债焦虑阈再+400',
    debuff: '对市场反馈迟钝——宣发效果-30%，信息衰减+3%',
    // Applied in code: promote gain ×0.7; info decay +0.03
  },
};

// === Background (家庭背景) ===
export const BACKGROUNDS = {
  poor:     { name: '困难家庭', emoji: 'house-simple', weight: 5,  money: 800,  allowanceMult: 0.6, salaryMult: 0.85, fireResist: 0, desc: '拮据但坚韧，逆境出发' },
  ordinary: { name: '普通家庭', emoji: 'house', weight: 70, money: 2000, allowanceMult: 1.0, salaryMult: 1.0,  fireResist: 0, desc: '标准起点' },
  comfort:  { name: '小康家庭', emoji: 'house-line', weight: 12, money: 3500, allowanceMult: 1.3, salaryMult: 1.1,  fireResist: 0.02, desc: '稍有余裕，更多试错空间' },
  educated: { name: '书香门第', emoji: 'books', weight: 8,  money: 2500, allowanceMult: 1.15, salaryMult: 1.05, fireResist: 0.01, desc: '文化氛围好，创作更容易被理解' },
  wealthy:  { name: '富裕家庭', emoji: 'diamond', weight: 3,  money: 8000, allowanceMult: 2.0, salaryMult: 1.4,  fireResist: 0.04, desc: '资金充裕，几乎不用担心钱' },
  tycoon:   { name: '超级富哥', emoji: 'crown', weight: 0.1, money: 20000, allowanceMult: 3.0, salaryMult: 2.0, fireResist: 0.05, desc: '钱不是问题，热情才是' },
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
    clubName: null,         // player's doujin circle name (set at game start)
    endowments: e,
    obsessiveTrait: null,   // null or trait key ('talent','stamina',...) — free +1 to 4 with debuff
    background: bgId,
    passion: 90, reputation: 0.3, time: 9, money: bg.money,
    infoDisclosure: 0.2,
    hasPartner: false, partnerType: null, partnerTurns: 0,
    partnerFee: 0,      // ¥ per HVP project, 0 = free
    contacts: [],        // 人脉池
    contactNextId: 1,    // contact auto-increment ID
    activeContactId: null, // ID of contact currently serving as partner (null = stranger)
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
    eventCalendar: null,      // 12-month pre-generated calendar [{turn, month, events}]
    eventCalendarStart: -1,   // first turn of current calendar cycle
    calendarEventsAttended: [], // calendarIds of attended events (for calendar gray-out)
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
    totalHVP: 0, totalLVP: 0, skillExp: 0, totalRevenue: 0, totalSales: 0, maxReputation: 0.3,
    recentEventTurns: [],  // turns when events were attended (for fatigue tracking)
    // History for dashboard
    history: [],       // [{ turn, money, reputation, passion, revenue, sales, action }]
    eventLog: [],      // [{ turn, name, city, revenue, sold }]
    idleMonthStreak: 0,  // consecutive months with leisure but no actions taken
    lastResult: null, lastEvent: null,
    achievements: [], gameOverReason: '',
    commercialOfferReceived: false, // true after publisher scouts you
    commercialTransition: false,    // true if player chose to go commercial (positive ending)
    monthTimeSpent: 0,              // leisure hours consumed this month
    monthActions: [],               // [{actionId, timeCost}] actions taken this month
    hvpWorkedThisMonth: false,      // HVP limited to once per month
    eventsAttendedThisMonth: [],    // event names attended this month (prevent repeat)
    lvpWorkedThisMonth: false,      // LVP limited to once per month
    monthHadCreativeAction: false,  // for lastCreativeTurn tracking
    consecutiveConsigns: 0,         // tracks consecutive consignment events (resets on 亲参)
    creativeFatigue: 0,             // cumulative creative exhaustion (decays naturally, amplified by consecutive creation)
    bestieAffinity: 10,             // hidden bestie affinity (0-100), grows with chat interactions
    equipmentLevel: 0,              // 0/1/2/3 — upgraded equipment improves quality & reduces passion cost
    lastSponsorTurn: -12,           // turn of last community sponsorship (cooldown)
    lastSalary: 0,                  // last salary received (for unemployment spending inertia)
    // Achievement tracking counters
    _debtBailoutDone: false,        // family debt bailout triggered this cycle
    _debtBailedOnce: false,         // permanent flag: first bailout used (non-tycoon = no second chance)
    _debtPassionStreak: 0,          // consecutive months with money<0 and passion>=60
    _lowPassionHit: false,          // ever had passion<=15
    _passionRecovered: false,       // recovered from <=15 to >=80
    fullTimeDoujin: false,          // quit job to go full-time doujin creator
    doujinMonths: 0,                // months spent as full-time doujin creator
    doujinWorkYearReset: 0,         // turn at which work years reset (for salary calc after returning)
    doujinQuitCount: 0,             // times player has quit for full-time doujin (penalizes frequent switching)
    lastReturnToWorkTurn: 0,        // turn when player last returned to employment (cooldown gate)
    // Anti-cheat: chained digest + action log for leaderboard verification
    _digestChain: [],   // [digestHash, ...] — one per month, each links to previous
    _actionLog: [],     // [{ t, acts, m, r, p, rev, s }] — compact per-month action summary
  };
}
