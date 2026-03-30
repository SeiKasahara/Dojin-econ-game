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
  trend_tag_neq:   (s, p) => s.market?.currentTrend?.tag !== p.tag,
  confidence_gte:  (s, p) => s.market && s.market.marketConfidence >= p.threshold,
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

function trendNotRepeat(state) {
  const m = state.market;
  if (!m?.currentTrend) return null;
  const tag = m.currentTrend.tag;
  // Game avoids repeating the last trend → nearly guaranteed YES
  // Low odds but free money for players who understand trend rotation
  return {
    id: `trend_norepeat_${state.turn}`,
    question: `下一轮潮流会换成「${tag}」以外的类型吗？`,
    icon: 'arrows-split',
    odds: 1.5,
    resolveTurn: state.turn + m.currentTrend.turnsLeft + 1,
    resolveCheck: (s) => s.market?.currentTrend?.tag !== tag,
    resolveType: 'trend_tag_neq', resolveParams: { tag },
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

function hvpEquilibrium(state) {
  const m = state.market;
  if (!m) return null;
  const nHVP = m.nHVP;
  const EQ = 9;
  if (Math.abs(nHVP - EQ) < 3) return null;
  // Mean reversion: HVP population tends toward equilibrium (~9)
  // Players who understand entry/exit rates can predict direction
  if (nHVP > EQ + 2) {
    const threshold = nHVP - 2;
    return {
      id: `hvp_eq_${state.turn}`,
      question: '同人本创作者多得互相挤压，4个月后竞争会缓和吗？',
      icon: 'scales',
      odds: 2.5,
      resolveTurn: state.turn + 4,
      resolveCheck: (s) => s.market && s.market.nHVP < threshold,
      resolveType: 'nhvp_lt', resolveParams: { threshold },
      category: '竞争',
    };
  } else {
    const threshold = nHVP + 2;
    return {
      id: `hvp_eq_${state.turn}`,
      question: '同人本创作者寥寥无几，4个月后会有新人入场吗？',
      icon: 'scales',
      odds: 2.5,
      resolveTurn: state.turn + 4,
      resolveCheck: (s) => s.market && s.market.nHVP > threshold,
      resolveType: 'nhvp_gt', resolveParams: { threshold },
      category: '竞争',
    };
  }
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


function recessionExodus(state) {
  // During recession, HVP exit rate is 1.5× normal
  // Players who know this can predict creator losses with confidence
  if (state.recessionTurnsLeft <= 0) return null;
  const m = state.market;
  if (!m || m.nHVP <= 3) return null;
  const threshold = m.nHVP - 2;
  return {
    id: `rec_exodus_${state.turn}`,
    question: '经济下行中创作者加速退坑，4个月后创作者群体会明显缩水吗？',
    icon: 'user-minus',
    odds: 2.5,
    resolveTurn: state.turn + 4,
    resolveCheck: (s) => s.market && s.market.nHVP < threshold,
    resolveType: 'nhvp_lt', resolveParams: { threshold },
    category: '竞争',
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

function diversityCrisis(state) {
  // When nHVP=0: community loses 3%/month (diversityPenalty) + normal churn
  // Players who understand this penalty can predict steep community decline
  const m = state.market;
  if (!m || m.nHVP > 0 || m.communitySize < 2000) return null;
  const threshold = Math.round(m.communitySize * 0.85);
  return {
    id: `diversity_crisis_${state.turn}`,
    question: '市场已无同人本创作者，半年后社群会严重萎缩吗？',
    icon: 'warning-circle',
    odds: 2.0,
    resolveTurn: state.turn + 6,
    resolveCheck: (s) => s.market && s.market.communitySize < threshold,
    resolveType: 'community_lt', resolveParams: { threshold },
    category: '社群',
  };
}

function phaseTransitionBet(state) {
  // Test knowledge of IP heat phase boundaries (70/50/20)
  // Player who knows decay rate λ = baseLambda + ipAge×0.003 can calculate trajectory
  const heat = state.official?.ipHeat;
  if (heat == null || heat < 25 || heat > 75) return null;
  const threshold = heat >= 55 ? 50 : 20;
  const phaseName = threshold === 50 ? '衰退期' : '黄昏期';
  return {
    id: `phase_${state.turn}`,
    question: `IP势头在走下坡路，4个月后会跌入${phaseName}吗？`,
    icon: 'thermometer',
    odds: 3.0,
    resolveTurn: state.turn + 4,
    resolveCheck: (s) => (s.official?.ipHeat || 0) < threshold,
    resolveType: 'ip_heat_lt', resolveParams: { threshold },
    category: 'IP',
  };
}

function confidenceForecast(state) {
  // Market confidence is an EMA toward 1.0 (or 0.6 during recession)
  // Player who understands: no recession → confidence recovers ~20%/turn toward 1.0
  // During recession → confidence drops toward 0.6 (betting YES here is a trap)
  const m = state.market;
  if (!m || m.marketConfidence == null || m.marketConfidence > 0.9) return null;
  const conf = m.marketConfidence;
  const target = Math.round((conf + 0.12) * 100) / 100;
  const mood = conf >= 0.65 ? '平稳' : conf >= 0.45 ? '悲观' : '恐慌';
  return {
    id: `conf_${state.turn}`,
    question: `市场情绪「${mood}」，3个月后能好转吗？`,
    icon: 'chart-line-up',
    odds: 2.5,
    resolveTurn: state.turn + 3,
    resolveCheck: (s) => s.market && s.market.marketConfidence >= target,
    resolveType: 'confidence_gte', resolveParams: { threshold: target },
    category: '宏观',
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

function bubbleChainBet(state) {
  // bubble_burst can only fire AFTER speculator_rush has happened
  // Players who understand event chains: rush → burst is a learnable pattern
  if (!(state.eventCounts?.speculator_rush > 0) || state.turn < 18) return null;
  const burstCount = state.eventCounts?.bubble_burst || 0;
  return {
    id: `bubble_chain_${state.turn}`,
    question: '投机客已入场扫货，半年内泡沫会破裂吗？',
    icon: 'trend-down',
    odds: 3.5,
    resolveTurn: state.turn + 6,
    resolveCheck: (s) => (s.eventCounts?.bubble_burst || 0) > burstCount,
    resolveType: 'event_count_gt', resolveParams: { key: 'bubble_burst', count: burstCount },
    category: '二手',
  };
}

// === 复合/奇葩类（真正难以预测）===



function saturationStall(state) {
  // Near carrying capacity, logistic growth slows drastically
  // Player who notices growth slowing can infer saturation and avoid this bet
  const m = state.market;
  if (!m || m.communitySize < 8000) return null;
  const cs = m.communitySize;
  const target = Math.round(cs * 1.08);
  return {
    id: `sat_stall_${state.turn}`,
    question: '社群增长似乎到了瓶颈，4个月后还能大幅扩张吗？',
    icon: 'chart-line-up',
    odds: 3.5,
    resolveTurn: state.turn + 4,
    resolveCheck: (s) => s.market && s.market.communitySize > target,
    resolveType: 'community_gt', resolveParams: { threshold: target },
    category: '社群',
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

function npcRetirementRumor(state) {
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
  const m = state.market;
  if (!m || !state.official) return null;
  const csNow = m.communitySize;
  const boom = Math.round(csNow * 1.08);
  return {
    id: `official_boom_${state.turn}`,
    question: '有人说官方要搞大动作，4个月后社群能大幅增长吗？',
    icon: 'megaphone',
    odds: 5.0,
    resolveTurn: state.turn + 4,
    resolveCheck: (s) => s.market && s.market.communitySize >= boom,
    resolveType: 'community_gte', resolveParams: { threshold: boom },
    category: '传闻',
  };
}

function printingCrisisRumor(state) {
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

// === 全部合约池 ===
const ALL_CONTRACTS = [
  // 潮流
  trendExact,
  trendNotRepeat,       // 知识：潮流轮换规则
  // 社群
  communityGrowth,
  communityDecline,
  saturationStall,      // 知识：承载力饱和
  diversityCrisis,      // 知识：多样性惩罚
  // 竞争
  hvpCreatorSwing,
  hvpEquilibrium,       // 知识：均衡回归
  recessionExodus,      // 知识：衰退期流失加速
  // 宏观
  recessionBet,
  doubleRecession,
  confidenceForecast,   // 知识：市场信心EMA
  // 二手
  secondHandSpike,
  bubbleChainBet,       // 知识：事件因果链
  // 传闻/八卦
  npcCollabRumor,
  npcRetirementRumor,
  officialAnnouncementBet,
  printingCrisisRumor,
  fandomWarRumor,
  viralPrediction,
  // IP
  ipHeatShift,
  phaseTransitionBet,   // 知识：IP热度相变
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
