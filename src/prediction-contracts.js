/**
 * 织梦交易 — 合约定义
 * 每个合约工厂函数接收 state，返回 { id, question, icon, odds, resolveTurn, resolveCheck, resolveType, resolveParams, category } 或 null（不可用）
 *
 * resolveCheck: runtime function (lost on JSON serialize)
 * resolveType + resolveParams: serializable descriptor (survives save/load)
 */

// === 辅助 ===
function rng(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// === Serializable resolve check registry ===
const RESOLVE_REGISTRY = {
  trend_tag_eq:    (s, p) => s.market?.currentTrend?.tag === p.tag,
  community_gt:    (s, p) => s.market && s.market.communitySize > p.threshold,
  community_gte:   (s, p) => s.market && s.market.communitySize >= p.threshold,
  community_lt:    (s, p) => s.market && s.market.communitySize < p.threshold,
  community_range: (s, p) => s.market && s.market.communitySize >= p.lo && s.market.communitySize <= p.hi,
  nhvp_gt:         (s, p) => s.market && s.market.nHVP > p.threshold,
  nhvp_lt:         (s, p) => s.market && s.market.nHVP < p.threshold,
  nhvp_lte:        (s, p) => s.market && s.market.nHVP <= p.threshold,
  nlvp_gt:         (s, p) => s.market && s.market.nLVP > p.threshold,
  recession_active:(s) => s.recessionTurnsLeft > 0,
  sh_pressure_gt:  (s, p) => { const sp = s.official?.secondHandPressure; return sp && (sp.hvp > p.threshold || sp.lvp > p.threshold); },
  cum_hvp_gte:     (s, p) => s.market && s.market.cumHVPProduced >= p.target,
  event_count_gt:  (s, p) => { const keys = p.keys || [p.key]; return keys.reduce((sum, k) => sum + (s.eventCounts?.[k] || 0), 0) > p.count; },
  ip_heat_gt:      (s, p) => (s.official?.ipHeat || 0) > p.threshold,
  ip_heat_lt:      (s, p) => (s.official?.ipHeat || 0) < p.threshold,
  player_hvp_gt:   (s, p) => (s.totalHVP || 0) > p.baseline,
};

/** Rebuild resolveCheck function from resolveType + resolveParams (used after loading save) */
export function rebuildResolveCheck(contract) {
  if (typeof contract.resolveCheck === 'function') return; // already has it
  const fn = RESOLVE_REGISTRY[contract.resolveType];
  if (fn) {
    contract.resolveCheck = (s) => fn(s, contract.resolveParams || {});
  }
}

/** Resolve a contract using either resolveCheck or resolveType+resolveParams */
export function resolveContract(contract, state) {
  if (typeof contract.resolveCheck === 'function') return contract.resolveCheck(state);
  const fn = RESOLVE_REGISTRY[contract.resolveType];
  return fn ? fn(state, contract.resolveParams || {}) : false;
}

// === 潮流类 ===
function trendExact(state) {
  const m = state.market;
  if (!m?.currentTrend) return null;
  const tags = ['甜文', '虐心', '热血', '日常', '奇幻'];
  const target = pick(tags);
  return {
    id: `trend_exact_${state.turn}`,
    question: `下一轮潮流会是「${target}」吗？`,
    icon: 'fire',
    odds: 5.0,
    resolveTurn: state.turn + m.currentTrend.turnsLeft + 1,
    resolveCheck: (s) => s.market?.currentTrend?.tag === target,
    resolveType: 'trend_tag_eq', resolveParams: { tag: target },
    category: '潮流',
  };
}

function trendRepeat(state) {
  const m = state.market;
  if (!m?.currentTrend || !m.trendHistory?.length) return null;
  const lastTag = m.trendHistory[m.trendHistory.length - 1];
  // Game explicitly avoids repeating last trend, so this is almost always NO
  return {
    id: `trend_repeat_${state.turn}`,
    question: `下一轮潮流会再次是「${lastTag}」吗？`,
    icon: 'arrows-clockwise',
    odds: 15.0,
    resolveTurn: state.turn + m.currentTrend.turnsLeft + 1,
    resolveCheck: (s) => s.market?.currentTrend?.tag === lastTag,
    resolveType: 'trend_tag_eq', resolveParams: { tag: lastTag },
    category: '潮流',
  };
}

// === 社群类 ===
function communityGrowth(state) {
  const m = state.market;
  if (!m) return null;
  const cs = m.communitySize;
  // Threshold: will it grow by MORE than 3%?
  const threshold = Math.round(cs * 1.03);
  return {
    id: `cs_boom_${state.turn}`,
    question: `3个月后社群人数会突破${threshold.toLocaleString()}吗？`,
    icon: 'users',
    odds: 4.0,
    resolveTurn: state.turn + 3,
    resolveCheck: (s) => s.market && s.market.communitySize > threshold,
    resolveType: 'community_gt', resolveParams: { threshold },
    category: '社群',
  };
}

function communityDecline(state) {
  const m = state.market;
  if (!m || m.communitySize < 3000) return null;
  const cs = m.communitySize;
  const threshold = Math.round(cs * 0.95);
  return {
    id: `cs_decline_${state.turn}`,
    question: `3个月后社群人数会跌破${threshold.toLocaleString()}吗？`,
    icon: 'arrow-circle-down',
    odds: 5.0,
    resolveTurn: state.turn + 3,
    resolveCheck: (s) => s.market && s.market.communitySize < threshold,
    resolveType: 'community_lt', resolveParams: { threshold },
    category: '社群',
  };
}

// === 竞争类 ===
function hvpCreatorSwing(state) {
  const m = state.market;
  if (!m) return null;
  const now = m.nHVP;
  const delta = rng(2, 4);
  const direction = Math.random() < 0.5 ? 'up' : 'down';
  const target = direction === 'up' ? now + delta : Math.max(1, now - delta);
  const question = direction === 'up'
    ? `2个月后同人本创作者会超过${target}人吗？`
    : `2个月后同人本创作者会少于${target}人吗？`;
  return {
    id: `hvp_swing_${state.turn}`,
    question,
    icon: 'book-open',
    odds: direction === 'up' ? 3.5 : 4.5,
    resolveTurn: state.turn + 2,
    resolveCheck: direction === 'up'
      ? (s) => s.market && s.market.nHVP > target
      : (s) => s.market && s.market.nHVP < target,
    resolveType: direction === 'up' ? 'nhvp_gt' : 'nhvp_lt',
    resolveParams: { threshold: target },
    category: '竞争',
  };
}

function lvpFlood(state) {
  const m = state.market;
  if (!m) return null;
  const threshold = m.nLVP + 10;
  return {
    id: `lvp_flood_${state.turn}`,
    question: `6个月后谷子创作者会突破${threshold}人吗？`,
    icon: 'key',
    odds: 6.0,
    resolveTurn: state.turn + 6,
    resolveCheck: (s) => s.market && s.market.nLVP > threshold,
    resolveType: 'nlvp_gt', resolveParams: { threshold },
    category: '竞争',
  };
}

// === 宏观类 ===
function recessionBet(state) {
  if (state.recessionTurnsLeft > 0 || state.turn <= 12) return null;
  return {
    id: `recession_${state.turn}`,
    question: '半年内会发生经济下行吗？',
    icon: 'trend-down',
    odds: 7.0,
    resolveTurn: state.turn + 6,
    resolveCheck: (s) => s.recessionTurnsLeft > 0,
    resolveType: 'recession_active', resolveParams: {},
    category: '宏观',
  };
}

function doubleRecession(state) {
  // Only available the month right after a recession ends
  if (state._recessionEndTurn == null || state.turn !== state._recessionEndTurn + 1) return null;
  return {
    id: `double_rec_${state.turn}`,
    question: '本轮经济下行结束后6个月内会再次衰退吗？',
    icon: 'arrows-clockwise',
    odds: 10.0,
    resolveTurn: state.turn + 6,
    resolveCheck: (s) => s.recessionTurnsLeft > 0,
    resolveType: 'recession_active', resolveParams: {},
    category: '宏观',
  };
}


// === 二手市场类 ===
function secondHandSpike(state) {
  const sh = state.official?.secondHandPressure;
  if (!sh) return null;
  const current = Math.max(sh.hvp || 0, sh.lvp || 0);
  const threshold = Math.min(0.7, current + 0.15);
  return {
    id: `sh_spike_${state.turn}`,
    question: `3个月后二手市场压力会超过${Math.round(threshold * 100)}%吗？`,
    icon: 'package',
    odds: 4.0,
    resolveTurn: state.turn + 3,
    resolveCheck: (s) => {
      const p = s.official?.secondHandPressure;
      return p && (p.hvp > threshold || p.lvp > threshold);
    },
    resolveType: 'sh_pressure_gt', resolveParams: { threshold },
    category: '二手',
  };
}

// === 叙事类（圈内传闻/不确定事件，难以从数据推断）===

function npcCollabRumor(state) {
  // "听说有两位创作者要合作出本，能成吗？"
  // Resolves by checking if nHVP went up (proxy for new creative activity)
  const m = state.market;
  if (!m || m.nHVP < 3) return null;
  const names = m.npcNames || [];
  if (names.length < 2) return null;
  const a = names[Math.floor(Math.random() * names.length)];
  let b; do { b = names[Math.floor(Math.random() * names.length)]; } while (b === a && names.length > 1);
  const target = m.cumHVPProduced + 2;
  return {
    id: `collab_rumor_${state.turn}`,
    question: `传闻「${a}」和「${b}」要合作出本，3个月内圈子会有新本诞生吗？`,
    icon: 'handshake',
    odds: 3.5,
    resolveTurn: state.turn + 3,
    resolveCheck: (s) => s.market && s.market.cumHVPProduced >= target,
    resolveType: 'cum_hvp_gte', resolveParams: { target },
    category: '传闻',
  };
}

function npcRetirementRumor(state) {
  // "某位创作者说最近很累想退坑，TA真的会退吗？"
  const m = state.market;
  if (!m || m.nHVP < 5) return null;
  const names = m.npcNames || [];
  const name = names.length > 0 ? names[Math.floor(Math.random() * names.length)] : '某位老创作者';
  const threshold = m.nHVP - 2;
  return {
    id: `retire_rumor_${state.turn}`,
    question: `「${name}」说想退坑了…4个月后同人本创作者会减少2人以上吗？`,
    icon: 'smiley-sad',
    odds: 4.0,
    resolveTurn: state.turn + 4,
    resolveCheck: (s) => s.market && s.market.nHVP <= threshold,
    resolveType: 'nhvp_lte', resolveParams: { threshold },
    category: '传闻',
  };
}

function officialAnnouncementBet(state) {
  // "官方最近有新动作的迹象，会不会带动一波社群增长？"
  const m = state.market;
  if (!m || !state.official) return null;
  const csNow = m.communitySize;
  const boom = Math.round(csNow * 1.08); // 8% growth = significant
  return {
    id: `official_boom_${state.turn}`,
    question: `有人说官方要搞大动作，4个月后社群能突破${boom.toLocaleString()}人吗？`,
    icon: 'megaphone',
    odds: 5.0,
    resolveTurn: state.turn + 4,
    resolveCheck: (s) => s.market && s.market.communitySize >= boom,
    resolveType: 'community_gte', resolveParams: { threshold: boom },
    category: '传闻',
  };
}

function printingCrisisRumor(state) {
  // "听说印刷厂在涨价/产能紧张，下次出本成本会暴涨吗？"
  // Resolves by checking if inflation event fires (eventCounts.inflation increases)
  if (state.turn < 12) return null;
  const currentInflationCount = state.eventCounts?.inflation || 0;
  return {
    id: `print_crisis_${state.turn}`,
    question: '圈内传言印刷厂要涨价，半年内会出现印刷成本上涨事件吗？',
    icon: 'printer',
    odds: 5.5,
    resolveTurn: state.turn + 6,
    resolveCheck: (s) => (s.eventCounts?.inflation || 0) > currentInflationCount,
    resolveType: 'event_count_gt', resolveParams: { key: 'inflation', count: currentInflationCount },
    category: '传闻',
  };
}

function fandomWarRumor(state) {
  // "CP论战越来越激烈，圈子会不会塌？"
  if (state.turn < 6) return null;
  const collapseCount = state.eventCounts?.collapse || 0;
  return {
    id: `fandom_war_${state.turn}`,
    question: '最近CP论战越来越激烈，3个月内会爆发塌方事件吗？',
    icon: 'warning-circle',
    odds: 4.5,
    resolveTurn: state.turn + 3,
    resolveCheck: (s) => (s.eventCounts?.collapse || 0) > collapseCount,
    resolveType: 'event_count_gt', resolveParams: { key: 'collapse', count: collapseCount },
    category: '八卦',
  };
}

function viralPrediction(state) {
  // "最近圈子有点沉寂，会不会突然出个爆款帖子带一波？"
  if (state.turn < 6) return null;
  const viralCount = (state.eventCounts?.boom || 0) + (state.eventCounts?.viral_post || 0);
  return {
    id: `viral_${state.turn}`,
    question: '圈子最近有点沉寂，4个月内会有人/作品突然出圈吗？',
    icon: 'lightning',
    odds: 3.5,
    resolveTurn: state.turn + 4,
    resolveCheck: (s) => ((s.eventCounts?.boom || 0) + (s.eventCounts?.viral_post || 0)) > viralCount,
    resolveType: 'event_count_gt', resolveParams: { keys: ['boom', 'viral_post'], count: viralCount },
    category: '八卦',
  };
}

function speculatorCrash(state) {
  // "二手市场最近很热，投机泡沫会破吗？"
  const sh = state.official?.secondHandPressure;
  if (!sh || (sh.hvp || 0) < 0.1) return null;
  const burstCount = state.eventCounts?.bubble_burst || 0;
  const rushCount = state.eventCounts?.speculator_rush || 0;
  return {
    id: `spec_crash_${state.turn}`,
    question: '二手市场传出有人大量囤货，半年内会发生泡沫破裂吗？',
    icon: 'trend-down',
    odds: 6.0,
    resolveTurn: state.turn + 6,
    resolveCheck: (s) => (s.eventCounts?.bubble_burst || 0) > burstCount,
    resolveType: 'event_count_gt', resolveParams: { key: 'bubble_burst', count: burstCount },
    category: '二手',
  };
}

// === 复合/奇葩类（真正难以预测）===



function exactCommunitySize(state) {
  const m = state.market;
  if (!m) return null;
  const cs = m.communitySize;
  // Will community land in a narrow ±2% band?
  const center = Math.round(cs * (0.97 + Math.random() * 0.06));
  const lo = Math.round(center * 0.99);
  const hi = Math.round(center * 1.01);
  return {
    id: `cs_exact_${state.turn}`,
    question: `2个月后社群人数会在${lo.toLocaleString()}~${hi.toLocaleString()}之间吗？`,
    icon: 'crosshair',
    odds: 15.0,
    resolveTurn: state.turn + 2,
    resolveCheck: (s) => s.market && s.market.communitySize >= lo && s.market.communitySize <= hi,
    resolveType: 'community_range', resolveParams: { lo, hi },
    category: '精准',
  };
}

function ipHeatShift(state) {
  const heat = state.official?.ipHeat;
  if (heat == null) return null;
  const direction = Math.random() < 0.5;
  const threshold = direction ? Math.round(heat + 15) : Math.round(Math.max(10, heat - 15));
  return {
    id: `ip_heat_${state.turn}`,
    question: direction
      ? `3个月后IP热度会飙升到${threshold}以上吗？`
      : `3个月后IP热度会冷却到${threshold}以下吗？`,
    icon: 'film-strip',
    odds: direction ? 5.0 : 4.5,
    resolveTurn: state.turn + 3,
    resolveCheck: direction
      ? (s) => (s.official?.ipHeat || 0) > threshold
      : (s) => (s.official?.ipHeat || 0) < threshold,
    resolveType: direction ? 'ip_heat_gt' : 'ip_heat_lt',
    resolveParams: { threshold },
    category: 'IP',
  };
}

// === 玩家社团合约（操纵市场）===
function playerClubContract(state) {
  // Only when rep 6-7, once per game, club name exists
  if (!state.clubName || state.reputation < 6 || state.reputation >= 8) return null;
  if (state._clubContractFired) return null;
  // Record baseline so resolution checks delta
  const baseHVP = state.totalHVP || 0;
  state._clubContractFired = true;
  return {
    id: `club_hvp_${state.turn}`,
    question: `「${state.clubName}」会在3个月内出新本吗？`,
    icon: 'flag-banner',
    odds: 2.5,
    resolveTurn: state.turn + 3,
    resolveCheck: (s) => (s.totalHVP || 0) > baseHVP,
    resolveType: 'player_hvp_gt', resolveParams: { baseline: baseHVP },
    category: '社团',
    _isClubContract: true, // flag for achievement detection
  };
}

// === 全部合约池 ===
const ALL_CONTRACTS = [
  // 潮流
  trendExact,
  trendRepeat,
  // 社群
  communityGrowth,
  communityDecline,
  // 竞争
  hvpCreatorSwing,
  lvpFlood,
  // 宏观
  recessionBet,
  doubleRecession,
  // 二手
  secondHandSpike,
  speculatorCrash,
  // 传闻/八卦
  npcCollabRumor,
  npcRetirementRumor,
  officialAnnouncementBet,
  printingCrisisRumor,
  fandomWarRumor,
  viralPrediction,
  // 高难度
  exactCommunitySize,
  ipHeatShift,
  // 玩家社团
  playerClubContract,
];

/**
 * 从合约池中生成 count 个可用合约
 */
export function generatePredictions(state, count = 2) {
  const available = [];
  for (const factory of ALL_CONTRACTS) {
    const pred = factory(state);
    if (pred) available.push(pred);
  }
  // Shuffle and pick
  const shuffled = available.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
