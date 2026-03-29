import { getLifeStage, getCreativeSkill, getSkillEffects, addReputation } from './core.js';
import { getWorkQualityEffects, getTrendBonus, syncInventoryAggregates } from './definitions.js';
import { getMarketAvgPrice, getCompetitionModifier } from '../market.js';
import { getSecondHandModifier, computeIPPhase } from '../official.js';
import { getAdvancedSalesMod } from '../advanced.js';
import { PARTNER_TYPES } from '../partner.js';

// === Per-Work Demand Parameters ===
const NOVELTY_BONUS_NEW    = 1.5;   // 本月创建的作品 (新刊)
const NOVELTY_BONUS_RECENT = 1.2;   // 1-2月内 (近期)
const NOVELTY_THRESHOLD    = 2;     // 新刊窗口期(月)
const SAT_COEFF_HVP  = 0.008;      // HVP饱和系数 (社群的0.8%拥有后开始饱和)
const SAT_COEFF_LVP  = 0.012;      // LVP饱和系数 (谷子饱和更慢)
const SAT_FLOOR      = 0;          // 完全饱和=0需求，不保底
const AGE_RAMP       = 8;          // 年龄惩罚爬满月数
const BASE_AGE_DECAY = 0.15;       // 无二手压力时的基础年龄衰减

// === IP Phase sales modifier ===
function getIPPhaseModifier(official, communitySize) {
  if (!official) return { hvp: 1.0, lvp: 1.0 };
  const phase = computeIPPhase(official);
  // Small community loyalty bonus during twilight/death:
  // Fewer than 5000 people = tight-knit circle, fans are devoted repeat buyers.
  // HVP gets stronger premium (collectors), LVP penalty softened (fans buy everything from creators they know).
  const isSmall = (communitySize || 10000) < 5000;
  switch (phase) {
    case 'growth':   return { hvp: 1.15, lvp: 1.15 };
    case 'peak':     return { hvp: 1.0,  lvp: 1.0  };
    case 'decline':  return { hvp: 0.85, lvp: 0.75 };
    case 'twilight': return isSmall
      ? { hvp: 1.30, lvp: 0.80 }  // small circle: loyal fans pay premium for HVP, still buy some LVP
      : { hvp: 1.10, lvp: 0.50 }; // large circle: moderate HVP premium, LVP collapses
    case 'death':    return isSmall
      ? { hvp: 0.60, lvp: 0.25 }  // small circle: even in death, a handful of diehards remain
      : { hvp: 0.30, lvp: 0.10 }; // large circle: almost no one left
    case 'revival':  return { hvp: 1.30, lvp: 1.20 };
    default:         return { hvp: 1.0,  lvp: 1.0  };
  }
}

// Sell items from works array, weighted by per-work attractiveness
// Each work's demand share is determined by: quality, trend, novelty, saturation, age
// Returns { sold, revenue, details[] } where details contains per-work breakdown
export function sellFromWorks(state, type, baseDemand) {
  const shPressure = state.official?.secondHandPressure?.[type] || 0;
  const communitySize = state.market ? state.market.communitySize : 10000;
  const currentTrend = state.market?.currentTrend || null;
  const works = state.inventory.works.filter(w => w.type === type && w.qty > 0);
  if (works.length === 0 || baseDemand <= 0) {
    return { sold: 0, revenue: 0, details: [] };
  }

  // Phase 1: compute per-work attractiveness weight
  const satCoeff = type === 'hvp' ? SAT_COEFF_HVP : SAT_COEFF_LVP;
  const phaseMod = getIPPhaseModifier(state.official, communitySize);
  const phaseModForType = type === 'hvp' ? phaseMod.hvp : phaseMod.lvp;
  const workData = works.map(w => {
    const age = Math.max(0, state.turn - (w.turn || state.turn));
    // Quality multiplier (per-work, was previously global)
    const qualityMult = getWorkQualityEffects(w.workQuality || 1.0).salesMult;
    // Trend multiplier (per-work)
    const trendMult = getTrendBonus(w.styleTag, currentTrend).salesMult;
    // Cult hit: niche but devoted fanbase — slower saturation, longer novelty, slower age decay
    const isCult = w.isCultHit || false;
    // Novelty bonus: new releases attract disproportionate attention
    // Cult hits enjoy extended novelty (word-of-mouth spreads slowly but persistently)
    const cultNoveltyThreshold = NOVELTY_THRESHOLD * 2; // 4 months instead of 2
    const noveltyBonus = age <= 0 ? NOVELTY_BONUS_NEW
      : age <= NOVELTY_THRESHOLD ? NOVELTY_BONUS_RECENT
      : (isCult && age <= cultNoveltyThreshold) ? 1.1
      : 1.0;
    // Saturation: cumulative sales reduce remaining potential buyers
    // effectiveSold decays with community churn (buyers leave, new people join)
    // ~2% monthly churn → after 12 months, ~78% of original buyers still around
    const rawSold = w.totalSold || 0;
    const soldAge = Math.max(0, state.turn - (w.turn || state.turn));
    const churnDecay = Math.pow(0.98, soldAge); // 2%/month turnover
    const effectiveSold = rawSold * churnDecay;
    // Cult hits saturate 40% slower (devoted fans seek it out regardless)
    const effectiveSatCoeff = isCult ? satCoeff * 1.4 : satCoeff;
    // Small communities: minimum saturation cap prevents tiny circles from being instantly saturated
    const satCap = Math.max(30, communitySize * effectiveSatCoeff);
    const saturationFactor = Math.max(SAT_FLOOR, 1 - effectiveSold / satCap);
    // Age decay: older works lose appeal (strengthened from original)
    // Cult hits age 50% slower (timeless appeal within niche)
    const ageFactor = Math.min(1, age / (isCult ? AGE_RAMP * 1.5 : AGE_RAMP));
    const ageDecay = Math.max(0.05, 1 - (shPressure + BASE_AGE_DECAY) * ageFactor);
    // Price commitment: absurd pricing kills demand, extreme cheap triggers suspicion
    const mktAvg = state.market ? getMarketAvgPrice(state.market, state, type) : (type === 'hvp' ? 50 : 15);
    const pr = w.price / Math.max(1, mktAvg);
    let priceMult = 1.0;
    if (pr > 2.5) priceMult = 0;
    else if (pr > 1.8) priceMult = 0.3;
    else if (pr > 1.4) priceMult = 0.7;
    else if (pr < 0.15) priceMult = 0.2;
    else if (pr < 0.3) priceMult = 0.5;
    // Combined attractiveness (includes IP phase modifier)
    const workMult = qualityMult * trendMult * noveltyBonus * saturationFactor * ageDecay * priceMult * phaseModForType;
    return { work: w, workMult, qualityMult, trendMult, noveltyBonus, saturationFactor, ageDecay, priceMult, phaseMod: phaseModForType };
  });

  // Phase 2: sort by attractiveness (best first)
  workData.sort((a, b) => b.workMult - a.workMult);

  // Phase 3: allocate baseDemand weighted by workMult²
  // Squared weights concentrate demand on top works (consumer browsing behavior:
  // attractive items get disproportionate attention, long tail gets very little)
  const totalWeight = workData.reduce((s, d) => s + d.workMult * d.workMult, 0);
  let remaining = Math.round(baseDemand);
  let totalRev = 0;
  const details = [];
  const soldMap = new Map(); // workId → detail index

  for (const d of workData) {
    if (remaining <= 0) break;
    if (d.workMult <= 0) continue; // fully saturated — no demand
    const sqW = d.workMult * d.workMult;
    const share = totalWeight > 0 ? sqW / totalWeight : 1 / workData.length;
    const workDemand = Math.max(0, Math.round(baseDemand * share));
    const sell = Math.min(remaining, Math.min(workDemand, d.work.qty));
    if (sell > 0) {
      d.work.qty -= sell;
      d.work.totalSold = (d.work.totalSold || 0) + sell;
      const rev = sell * d.work.price;
      totalRev += rev;
      remaining -= sell;
      details.push({ work: d.work, sold: sell, rev,
        noveltyBonus: d.noveltyBonus, saturationFactor: d.saturationFactor,
        qualityMult: d.qualityMult, trendMult: d.trendMult, ageDecay: d.ageDecay, workMult: d.workMult });
      soldMap.set(d.work.id, details.length - 1);
    }
  }

  // Phase 4: redistribute leftover demand (if attractive works were qty-limited)
  if (remaining > 0) {
    for (const d of workData) {
      if (remaining <= 0) break;
      if (d.work.qty <= 0 || d.workMult <= 0) continue; // skip sold-out and saturated
      const sell = Math.min(remaining, d.work.qty);
      if (sell > 0) {
        d.work.qty -= sell;
        d.work.totalSold = (d.work.totalSold || 0) + sell;
        const rev = sell * d.work.price;
        totalRev += rev;
        remaining -= sell;
        if (soldMap.has(d.work.id)) {
          const idx = soldMap.get(d.work.id);
          details[idx].sold += sell;
          details[idx].rev += rev;
        } else {
          details.push({ work: d.work, sold: sell, rev,
            noveltyBonus: d.noveltyBonus, saturationFactor: d.saturationFactor,
            qualityMult: d.qualityMult, trendMult: d.trendMult, ageDecay: d.ageDecay, workMult: d.workMult });
        }
      }
    }
  }

  // Stamp sold-out turn on newly emptied works
  for (const d of details) {
    if (d.work.qty === 0 && !d.work.soldOutSinceTurn) {
      d.work.soldOutSinceTurn = state.turn;
    }
  }
  // Keep sold-out works in array (qty=0) so they can be reprinted
  syncInventoryAggregates(state);

  // Word-of-mouth: high quality works sold → organic info disclosure boost
  // Buyers of great works talk about them, slowly building awareness
  for (const d of details) {
    if (d.sold > 0 && (d.work.workQuality || 1.0) >= 1.2) {
      const wom = d.sold * 0.003 * ((d.work.workQuality || 1.0) - 1.0); // Q1.5, sold 10 → +0.015
      state.infoDisclosure = Math.min(1, state.infoDisclosure + wom);
    }
  }

  return { sold: Math.round(baseDemand) - remaining, revenue: totalRev, details };
}

// === Community Feedback B (Inverted-U) ===
export function calculateFeedback(state) {
  const theta = state.reputation, t = state.turn;
  const num = Math.pow(theta, 1.5);
  const den = 1 + 0.5 * Math.pow(theta, 2.5);
  return Math.round(0.5 * 30 * Math.pow(0.997, t) * num / den * 10) / 10;
}

// === Sales (Translated CES model from consumer.md) ===
// Q_H* = γ_H + β_H^σ · p_H^(-σ) / Σ · m^s
// Simplified: total market demand split among N_HVP creators by reputation share
export function calculateSales(actionId, state) {
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
  // NOTE: price commitment penalty is applied per-work in sellFromWorks, not globally here
  const totalDemand = isHVP
    ? gamma_H + beta_H * m_s / 50
    : gamma_L + (1 - beta_H) * m_s / 15;

  // Scale by community size (per 1000 consumers)
  const marketDemand = totalDemand * (communitySize / 1000) * alphaMod;

  // --- Player's share: depends on reputation vs competition ---
  // Player's share = α_player / Σα_all (sub-level CES share)
  const nCompetitors = isHVP ? (state.market?.nHVP || 9) : (state.market?.nLVP || 55);
  // Average NPC reputation calibrated for √rep curve (player rep ~3-6 mid-late game)
  const npcAvgRep = isHVP ? 1.0 : 0.2;
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

  // --- Catalog display bonus: inverted-U curve ---
  // 1-4 types: more variety attracts browsers (bonus rises)
  // 5+: booth gets cluttered, each work gets less prominent display (bonus falls)
  // Sweet spot at 3-4 types. Applies across ALL types at the booth, not per-type.
  const totalUniqueWorks = (state.inventory?.works?.filter(w => w.qty > 0).length) || 0;
  const uniqueWorks = state.inventory?.works?.filter(w => w.type === type && w.qty > 0).length || 0;
  let catalogBonus;
  if (totalUniqueWorks <= 4) {
    catalogBonus = 1 + Math.min(0.3, Math.max(0, uniqueWorks - 1) * 0.1);
    // 1=1.0, 2=1.1, 3=1.2, 4=1.3
  } else {
    // Clutter penalty: each extra type beyond 4 reduces display quality
    // 5=-5%, 6=-10%, 8=-20%, 10+=-30% (floor 0.7)
    const clutter = Math.max(0.7, 1.0 - (totalUniqueWorks - 4) * 0.05);
    catalogBonus = 1.3 * clutter;
    // 5=1.24, 6=1.17, 8=1.04, 10+=0.91
  }

  // --- High info bonus: word-of-mouth effect when awareness ≥ 80% ---
  const infoHighBonus = state.infoDisclosure >= 0.6 ? 1.12 : 1.0;

  // --- Best work quality bonus: great works attract demand on their own ---
  // Uses best quality in stock — even low-rep creators sell more if work is exceptional
  const bestQuality = Math.max(1.0, ...(state.inventory?.works?.filter(w => w.type === type && w.qty > 0).map(w => w.workQuality || 1.0) || [1.0]));
  const qualityDemandBonus = Math.pow(bestQuality, 1.5); // Q1.0→1.0, Q1.25→1.40, Q1.5→1.84, Q1.8→2.41

  // --- Calculate base demand ---
  const rawSales = marketDemand * playerShare * conversion * partnerMult * shMod * advMod * eventBoost * noise * catalogBonus * infoHighBonus * qualityDemandBonus;
  const sales = Math.max(0, Math.round(rawSales));

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
    catalogBonus: Math.round(catalogBonus * 100),
    qualityDemandBonus: Math.round(qualityDemandBonus * 100),
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
  const Pmax = 20 + Math.sqrt(state.reputation) * 60;
  const slope = 0.8 - state.infoDisclosure * 0.4;
  const Qsupply = sales?.hvpSales || sales?.lvpSales || 5;
  return { Pmax, slope, Qsupply, Peq: Math.max(5, Pmax - slope * Qsupply), Qmax: Math.ceil(Pmax / slope) + 5, reputation: state.reputation, infoDisclosure: state.infoDisclosure, recessionActive: state.recessionTurnsLeft > 0 };
}
