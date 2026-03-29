/**
 * Market Ecosystem Simulation — 同人社团物语 Phase 2
 * Aggregate NPC creator population dynamics 
 * Translated CES demand model from consumer.md
 */

import { getLifeStage } from './engine/core.js';
import { ic } from './icons.js';
import { generateSocialFeed } from './social-feed.js';

// === Parameters calibrated from diversity.md §7 ===
const EQ_HVP = 9;         // equilibrium HVP count
const EQ_LVP = 55;        // equilibrium LVP count
const ENTRY_RATE = 4;     // new LVP entrants per period
const P_UP = 0.023;       // LVP→HVP per period (2.3% survival through pipeline)
const P_DOWN = 0.052;     // HVP exit rate (exo 0.025 + endo 0.015 + collapse 0.012)
const P_LVP_EXIT = 0.025; // LVP exit rate
const ALPHA_DECAY = 0.95; // consumer α decay per turn when N_HVP=0 (faster for gameplay)
const GAMMA_H = 15;       // committed consumption (vacuum profit base)

import { NPC_CIRCLE_NAMES } from './npc-names.js';

function generateNPCNames(count) {
  const shuffled = [...NPC_CIRCLE_NAMES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// === Trend Tags ===
const TREND_TAGS = ['甜文', '虐心', '热血', '日常', '奇幻'];

export function generateTrend(market) {
  const avoid = market.trendHistory.length > 0 ? market.trendHistory[market.trendHistory.length - 1] : null;
  const pool = TREND_TAGS.filter(t => t !== avoid);
  const tag = pool[Math.floor(Math.random() * pool.length)];
  market.currentTrend = { tag, turnsLeft: 3, strength: 1.3 + Math.random() * 0.2 };
}

export function tickTrend(market) {
  if (!market.currentTrend) {
    // Start a new trend every 3 turns (check by turn counter mod or if null)
    generateTrend(market);
    return;
  }
  market.currentTrend.turnsLeft--;
  if (market.currentTrend.turnsLeft <= 0) {
    market.trendHistory.push(market.currentTrend.tag);
    if (market.trendHistory.length > 5) market.trendHistory.shift();
    market.currentTrend = null;
    // Next trend will generate on next tick
  }
}

// Social feed generator: see social-feed.js (imported at top)

// === IP Type definitions ===
export const IP_TYPES = {
  cold:   { name: '冷门IP', emoji: 'snowflake', carryingCapacity: 5000,  officialActiveChance: 0.03, officialMinorChance: 0.02, desc: '官方几乎不管，社群天花板低，但竞争也少' },
  normal: { name: '潜力IP', emoji: 'star-four', carryingCapacity: 25000, officialActiveChance: 0.12, officialMinorChance: 0.10, desc: '官方偶尔更新，社群有成长空间' },
  hot:    { name: '热门IP', emoji: 'fire', carryingCapacity: 50000, officialActiveChance: 0.18, officialMinorChance: 0.15, desc: '官方频繁更新，社群庞大但竞争激烈' },
};

// === Create Market State ===
export function createMarketState(communityPreset = 'mid', ipType = 'normal') {
  const presets = {
    early: { nHVP: 3, nLVP: 15, communitySize: 1500 },
    mid:   { nHVP: 9, nLVP: 55, communitySize: 10000 },
    late:  { nHVP: 12, nLVP: 80, communitySize: 20000 },
  };
  const p = presets[communityPreset] || presets.mid;
  const ip = IP_TYPES[ipType] || IP_TYPES.normal;
  // Cold IP: cap community to its ceiling, fewer creators
  const cappedSize = Math.min(p.communitySize, ip.carryingCapacity);
  const creatorScale = cappedSize / p.communitySize;
  return {
    nHVP: Math.max(1, Math.round(p.nHVP * creatorScale)),
    nLVP: Math.max(5, Math.round(p.nLVP * creatorScale)),
    communitySize: cappedSize,
    ipType,
    carryingCapacity: ip.carryingCapacity,
    hvpZeroStreak: 0,
    consumerAlpha: 1.0,
    diversityHealth: 1.0,
    marketConfidence: 1.0,
    npcEvents: [],
    cumHVPProduced: 0,
    cumHVPExited: 0,
    // Trend system
    currentTrend: null,
    trendHistory: [],
    trendTickCounter: 0,
    // Social feed
    npcNames: generateNPCNames(8),
    socialFeed: [],
  };
}

// === Tick Market: run once per game turn ===
export function tickMarket(market, playerState) {
  const events = [];
  const isRecession = playerState.recessionTurnsLeft > 0;

  // --- 1. LVP entry (new creators join) ---
  const entryMod = isRecession ? 0.5 : 1.0;
  const newLVP = Math.max(1, poissonSample(ENTRY_RATE * entryMod));
  market.nLVP += newLVP;

  // --- 2. LVP → HVP pipeline ---
  const upgrades = binomialCount(market.nLVP, P_UP * (isRecession ? 0.5 : 1.0));
  if (upgrades > 0) {
    market.nLVP -= upgrades;
    market.nHVP += upgrades;
    market.cumHVPProduced += upgrades;
    events.push(`${ic('book-open-text')} ${upgrades}位同人谷创作者官宣成为同人本创作者！`);
  }

  // --- 3. HVP exits ---
  const hvpExitRate = P_DOWN * (isRecession ? 1.5 : 1.0);
  const hvpExits = binomialCount(market.nHVP, hvpExitRate);
  if (hvpExits > 0) {
    market.nHVP = Math.max(0, market.nHVP - hvpExits);
    market.cumHVPExited += hvpExits;
    events.push(`${ic('smiley-sad')} ${hvpExits}位同人本创作者退坑了`);
  }

  // --- 4. LVP exits ---
  const lvpExitRate = P_LVP_EXIT * (isRecession ? 1.3 : 1.0);
  const lvpExits = binomialCount(market.nLVP, lvpExitRate);
  market.nLVP = Math.max(5, market.nLVP - lvpExits); // floor at 5

  // --- 5. Diversity trap: consumer preference decay ---
  if (market.nHVP === 0) {
    market.hvpZeroStreak++;
    market.consumerAlpha *= ALPHA_DECAY;
    if (market.hvpZeroStreak === 3) {
      events.push(`${ic('warning')} 市场已3个月没有同人本创作者，消费者对同人本的期待正在衰退...`);
    }
    if (market.hvpZeroStreak === 8) {
      events.push(`${ic('arrow-circle-down')} 多样性陷阱形成中！没有人制作同人本...`);
    }
    // Vacuum profit recovery: small chance someone brave enters
    if (market.hvpZeroStreak > 5 && Math.random() < 0.04) {
      market.nHVP = 1;
      market.nLVP = Math.max(0, market.nLVP - 1);
      events.push(`${ic('star-four')} 一位勇敢的创作者独占真空利润，重新进入同人本市场！`);
    }
  } else {
    market.hvpZeroStreak = 0;
    // Slow recovery of consumerAlpha when HVP exists
    market.consumerAlpha = Math.min(1, market.consumerAlpha + 0.02);
  }

  // --- 6. Market confidence ---
  const basConf = isRecession ? 0.6 : 1.0;
  const divConf = market.nHVP > 0 ? 1.0 : 0.7;
  market.marketConfidence += (basConf * divConf - market.marketConfidence) * 0.2; // smooth

  // --- 7. Community size dynamics (logistic growth with carrying capacity) ---
  const CARRYING_CAPACITY = market.carryingCapacity || 25000;
  const saturationFactor = 1 - market.communitySize / CARRYING_CAPACITY; // approaches 0 at cap
  const hvpPull = market.nHVP * 40 * Math.max(0, saturationFactor);
  const lvpPull = market.nLVP * 4 * Math.max(0, saturationFactor);
  // Natural churn accelerates as community ages (people move on)
  const ipAge = playerState.turn / 12; // years since game start
  const baseChurn = 0.012 + ipAge * 0.002; // 1.2% at start → 2.2% after 5 years → 3.2% after 10
  const churn = market.communitySize * baseChurn;
  const recessionDrain = isRecession ? market.communitySize * 0.015 : 0;
  const diversityPenalty = market.nHVP === 0 ? market.communitySize * 0.03 : 0;
  const netGrowth = hvpPull + lvpPull - churn - recessionDrain - diversityPenalty;
  market.communitySize = Math.max(500, Math.round(market.communitySize + netGrowth));

  // --- 8. Diversity health ---
  market.diversityHealth = Math.min(1, market.nHVP / EQ_HVP);

  // --- 9. Keep recent events (max 3) ---
  market.npcEvents = [...events, ...market.npcEvents].slice(0, 3);

  // --- 10. Trend system: tick every turn, generate every 3 turns ---
  market.trendTickCounter = (market.trendTickCounter || 0) + 1;
  if (market.trendTickCounter % 3 === 0 || !market.currentTrend) {
    tickTrend(market);
  }

  // --- 11. Social feed ---
  const officialState = playerState.official || null;
  market.socialFeed = generateSocialFeed(market, officialState, playerState);
}

// === Competition Modifier: how NPC market affects player sales ===
export function getCompetitionModifier(market, productType) {
  if (productType === 'hvp') {
    // Less HVP competition → player sells more (vacuum profit)
    // More HVP → player faces split demand
    const ratio = market.nHVP / EQ_HVP; // 1.0 = equilibrium
    // At 0 HVP: 1.5x bonus. At equilibrium: 1.0x. At 2x equilibrium: 0.7x
    const mod = 1.5 - 0.5 * ratio;
    // Also apply consumerAlpha decay (if consumers forgot about HVP, even vacuum is smaller)
    return Math.max(0.3, mod * market.consumerAlpha);
  }
  // LVP: gentle competition effect
  const ratio = market.nLVP / EQ_LVP;
  return Math.max(0.5, 1.1 - 0.1 * ratio);
}

// === Price-Demand Curve (consumer.md Translated CES) ===
// Player picks a price, demand responds via elasticity
export function calculatePricedSales(baseSales, basePrice, playerPrice, productType) {
  const elasticity = productType === 'hvp' ? 1.06 : 0.92;
  const priceFactor = Math.pow(playerPrice / basePrice, -elasticity);
  const adjustedSales = Math.max(1, Math.round(baseSales * priceFactor));
  return { sales: adjustedSales, price: playerPrice, revenue: adjustedSales * playerPrice };
}

// === Dynamic Market Average Price ===
// Derives from supply-demand balance, confidence, recession, competition density
export function getMarketAvgPrice(market, playerState, productType) {
  const isHVP = productType === 'hvp';
  const baseRef = isHVP ? 50 : 15; // reference equilibrium price

  // Supply pressure: more competitors → price pushed down
  const eqCount = isHVP ? EQ_HVP : EQ_LVP;
  const actual = isHVP ? market.nHVP : market.nLVP;
  const supplyRatio = actual / Math.max(1, eqCount); // >1 = oversupply, <1 = undersupply
  const supplyMod = 1.15 - 0.15 * supplyRatio; // undersupply: prices up; oversupply: prices down

  // Demand pressure: community size relative to reference
  const demandMod = Math.sqrt(market.communitySize / 10000); // larger community = higher willingness

  // Confidence: mild effect on price (mainly affects volume, not price)
  const confMod = 1 - (1 - market.marketConfidence) * 0.15; // confidence 0.6→0.94, 1.0→1.0

  // Recession: moderate price pressure
  const recMod = playerState.recessionTurnsLeft > 0 ? 0.90 : 1.0;

  // Consumer preference decay: only kicks in at extreme levels (α<0.5)
  const alphaMod = isHVP && market.consumerAlpha < 0.5
    ? 0.7 + market.consumerAlpha * 0.6  // α=0→0.7, α=0.5→1.0
    : 1.0;

  const rawPrice = baseRef * supplyMod * demandMod * confMod * recMod * alphaMod;
  return Math.max(isHVP ? 25 : 8, Math.round(rawPrice));
}

// === Price Tiers for UI ===
export function getPriceTiers(basePrice, productType) {
  return [
    { id: 'budget',  label: '低价冲量', price: Math.max(1, Math.round(basePrice * 0.6)), desc: '薄利多销' },
    { id: 'low',     label: '亲民价',   price: Math.max(1, Math.round(basePrice * 0.8)), desc: '略低于均价' },
    { id: 'normal',  label: '市场均价', price: basePrice,                                  desc: '跟随市场' },
    { id: 'high',    label: '品质溢价', price: Math.round(basePrice * 1.3),                desc: '高于均价' },
    { id: 'premium', label: '高端定位', price: Math.round(basePrice * 1.6),                desc: '少量精品' },
  ];
}

// === Market Narratives for UI ===
export function getMarketNarratives(market) {
  const phrases = [];
  if (market.nHVP >= 12) phrases.push('同人本创作者很多，市场竞争激烈。');
  else if (market.nHVP <= 3 && market.nHVP > 0) phrases.push('同人本创作者寥寥无几，你的同人本几乎没有竞争对手。');
  else if (market.nHVP === 0) phrases.push(`${ic('warning')} 市场上已经没有同人本创作者了！这是你独占市场的机会——但消费者的期待也在衰退。`);

  if (market.diversityHealth < 0.3) phrases.push(`${ic('arrow-circle-down')} 市场多样性极低。也许你可以做那个打破僵局的人？`);
  if (market.consumerAlpha < 0.5) phrases.push('消费者对同人本的兴趣已经大幅衰退(α=' + market.consumerAlpha.toFixed(2) + ')...');
  if (market.marketConfidence < 0.7) phrases.push('消费者信心不足，整体市场需求低迷。');

  if (market.communitySize > 15000) phrases.push(`${ic('fire')} 社群人数火爆，销售潜力巨大！`);
  else if (market.communitySize < 3000) phrases.push('社群人数萎缩，整体需求疲软...');

  return phrases;
}

// === Utility: approximate random distributions ===
function poissonSample(lambda) {
  // Simple Poisson via Knuth for small lambda
  let L = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

function binomialCount(n, p) {
  // For small expected values, just count successes
  if (n <= 0 || p <= 0) return 0;
  const expected = n * p;
  if (expected > 20) {
    // Normal approximation with noise
    const std = Math.sqrt(n * p * (1 - p));
    return Math.max(0, Math.round(expected + (Math.random() - 0.5) * 2 * std));
  }
  let count = 0;
  for (let i = 0; i < Math.min(n, 100); i++) {
    if (Math.random() < p) count++;
  }
  return count;
}
