/**
 * Advanced Systems — Phase 4 & 5
 * 
 * 
 */

import { getLifeStage, activeCrisisCount, addMoney, addReputation } from './engine.js';
import { ic } from './icons.js';

// =============================================
// PHASE 4: Macro Shocks + Entrepreneurial Spirit
// =============================================

// === Stagflation State ===
export function createAdvancedState() {
  return {
    // Stagflation (macro_shocks.md §1): m↓ AND p↑ simultaneously
    stagflationTurnsLeft: 0,
    costInflation: 0,          // extra cost multiplier from inflation component

    // Debt crisis (macro_shocks.md §2): D_t permanent income deduction
    consumerDebt: 0,           // aggregate consumer debt level (affects market demand)
    debtCrisisActive: false,

    // AI structural shift (lksj.md): permanent market change
    aiRevolution: false,       // once triggered, permanent
    aiLvpPenalty: 0,           // permanent LVP demand reduction (0-0.5)
    aiHvpBonus: 0,             // permanent HVP scarcity premium (0-0.3)

    // Entrepreneurial alertness (lksj.md Kirzner)
    nicheDiscovered: null,     // current niche: { name, bonusMult, turnsLeft }
    nichesFound: 0,            // total niches discovered

    // Network evolution (pk45.md + posp.md)
    networkPhase: 'small',     // 'small' | 'growing' | 'mature' | 'fragmented'
    cliques: 3,                // number of distinct taste clusters
    playerClique: null,        // which clique player belongs to
    signalInflation: 1.0,      // Spence: signal cost multiplier (rises over time)
    networkGini: 0.5,          // inequality of attention distribution

    // Cross-border (pk45.md)
    foreignContentPressure: 0, // 0-1: how much foreign content competes
    isContentBridge: false,    // player acts as cultural bridge
  };
}

// === Tick Advanced Systems ===
export function tickAdvanced(adv, market, playerState) {
  const events = [];

  // --- Stagflation tick ---
  if (adv.stagflationTurnsLeft > 0) {
    adv.stagflationTurnsLeft--;
    if (adv.stagflationTurnsLeft === 0) {
      adv.costInflation = 0;
      events.push({ msg: `${ic('trend-up')} 滞胀结束，成本压力缓解` });
    }
  }

  // --- Debt crisis: consumer debt slowly recovers ---
  if (adv.consumerDebt > 0) {
    adv.consumerDebt = Math.max(0, adv.consumerDebt - 0.5);
    if (adv.consumerDebt <= 0) {
      adv.debtCrisisActive = false;
      events.push({ msg: `${ic('cardholder')} 消费者债务危机结束` });
    }
  }

  // --- Network evolution: driven by community size ---
  const cs = market.communitySize;
  if (cs < 2000) {
    adv.networkPhase = 'small';
    adv.cliques = Math.max(1, Math.floor(cs / 500));
    adv.networkGini = 0.3;
    adv.signalInflation = 1.0;
  } else if (cs < 8000) {
    adv.networkPhase = 'growing';
    adv.cliques = 3 + Math.floor((cs - 2000) / 1500);
    adv.networkGini = 0.5 + (cs - 2000) / 20000;
    adv.signalInflation = 1.0 + (cs - 2000) / 15000;
  } else if (cs < 20000) {
    adv.networkPhase = 'mature';
    adv.cliques = Math.min(12, 5 + Math.floor((cs - 8000) / 2000));
    adv.networkGini = 0.7 + (cs - 8000) / 60000;
    adv.signalInflation = 1.3 + (cs - 8000) / 30000;
  } else {
    adv.networkPhase = 'fragmented';
    adv.cliques = Math.min(20, 10 + Math.floor((cs - 20000) / 5000));
    adv.networkGini = Math.min(0.95, 0.85 + (cs - 20000) / 100000);
    adv.signalInflation = Math.min(3.0, 1.8 + (cs - 20000) / 20000);
  }

  // --- Niche discovery countdown ---
  if (adv.nicheDiscovered) {
    adv.nicheDiscovered.turnsLeft--;
    if (adv.nicheDiscovered.turnsLeft <= 0) {
      events.push({ msg: `${ic('magnifying-glass')} 细分需求"${adv.nicheDiscovered.name}"的窗口期结束了` });
      adv.nicheDiscovered = null;
    }
  }

  // --- Foreign content pressure varies ---
  if (Math.random() < 0.03) {
    adv.foreignContentPressure = Math.min(0.5, adv.foreignContentPressure + 0.1);
    events.push({ msg: `${ic('globe-simple')} 海外优质同人内容涌入，竞争加剧` });
  }
  adv.foreignContentPressure = Math.max(0, adv.foreignContentPressure - 0.01);

  return events;
}

// === Get cost multiplier from stagflation + AI ===
export function getAdvancedCostMod(adv) {
  return 1 + (adv.costInflation || 0);
}

// === Get sales modifier from advanced systems ===
export function getAdvancedSalesMod(adv, productType) {
  let mod = 1.0;

  // Stagflation demand compression
  if (adv.stagflationTurnsLeft > 0) mod *= 0.6;

  // Consumer debt crisis: permanent demand reduction
  if (adv.consumerDebt > 0) mod *= Math.max(0.5, 1 - adv.consumerDebt / 30);

  // AI shift: LVP penalty, HVP bonus
  if (adv.aiRevolution) {
    if (productType === 'lvp') mod *= (1 - adv.aiLvpPenalty);
    if (productType === 'hvp') mod *= (1 + adv.aiHvpBonus);
  }

  // Niche bonus
  if (adv.nicheDiscovered) mod *= adv.nicheDiscovered.bonusMult;

  // Foreign content pressure
  mod *= (1 - adv.foreignContentPressure * 0.3);

  // Network phase: mature networks have more competition but bigger audience
  if (adv.networkPhase === 'fragmented') mod *= 0.9; // harder to reach everyone

  return mod;
}

// === Signal cost for info disclosure (Spence model, posp.md) ===
export function getSignalCost(adv) {
  // As network grows, the cost to stand out increases
  // signalInflation: 1.0 (small) → 3.0 (fragmented)
  return adv.signalInflation;
}

// === Network narratives for UI ===
export function getAdvancedNarratives(adv) {
  const phrases = [];
  const networkDesc = {
    small: '圈子还很小，大家互相都认识，消息传得很快',
    growing: '圈子在扩大，开始出现几个不太重叠的小群体',
    mature: '圈子已经很大了，形成了几个核心大V主导的圈层，普通人的声音很难传到其他圈层',
    fragmented: '圈子分裂成互不来往的小团体，跨圈传播几乎不可能',
  };
  phrases.push(`${ic('globe-simple')} ${networkDesc[adv.networkPhase] || '社群网络运转中'}`);

  if (adv.networkPhase === 'mature' || adv.networkPhase === 'fragmented') {
    phrases.push(`${ic('megaphone-simple')} 宣传越来越难被注意到了——圈子太大，信息洪流把你的声音淹没了`);
  }

  if (adv.stagflationTurnsLeft > 0) {
    phrases.push(`${ic('warning')} 滞胀中（${adv.stagflationTurnsLeft}月）：收入下降成本上升同时发生，无避风港`);
  }
  if (adv.debtCrisisActive) {
    phrases.push(`${ic('cardholder')} 消费者债务危机：市场需求被永久性压缩(debt=${adv.consumerDebt.toFixed(0)})`);
  }
  if (adv.aiRevolution) {
    phrases.push(`${ic('robot')} AI时代：同人谷需求-${Math.round(adv.aiLvpPenalty * 100)}% · 同人本稀缺溢价+${Math.round(adv.aiHvpBonus * 100)}%`);
  }
  if (adv.nicheDiscovered) {
    phrases.push(`${ic('magnifying-glass')} 发现细分需求"${adv.nicheDiscovered.name}"！制作相关内容销量×${adv.nicheDiscovered.bonusMult}（剩${adv.nicheDiscovered.turnsLeft}月）`);
  }
  if (adv.foreignContentPressure > 0.15) {
    phrases.push(`${ic('globe')} 海外内容竞争压力: ${Math.round(adv.foreignContentPressure * 100)}%`);
  }

  return phrases;
}

// =============================================
// EVENTS for Phase 4 & 5
// =============================================

export const ADVANCED_EVENTS = [
  // --- STAGFLATION (macro_shocks.md §1) ---
  {
    id: 'stagflation', emoji: 'fire', title: '滞胀来了！',
    desc: '经济停滞和通货膨胀同时发生——收入下降的同时物价上涨。这是最残酷的宏观冲击：你无法"买便宜的"（因为物价涨了），也无法"提价转嫁"（因为需求降了）。没有任何避风港...',
    effect: '销量-40% 成本+30%（持续18~30月）', effectClass: 'negative',
    apply: (s) => {
      const dur = 18 + Math.floor(Math.random() * 12);
      s.advanced.stagflationTurnsLeft = dur;
      s.advanced.costInflation = 0.3;
      s.recessionTurnsLeft = Math.max(s.recessionTurnsLeft, dur); // recession overlaps
    },
    tip: '滞胀 = 衰退+ 通胀同时。超量收入被交叉压缩。消除了所有缓冲策略。可能使多样性条件翻转，导致不可逆的市场结构损害。',
    weight: 2, when: (s) => s.turn > 36 && !s.advanced?.stagflationTurnsLeft && s.recessionTurnsLeft <= 0 && activeCrisisCount(s) < 2, maxTotal: 1,
  },

  // --- DEBT CRISIS (macro_shocks.md §2) ---
  {
    id: 'debt_crisis', emoji: 'cardholder', title: '消费者债务危机',
    desc: '大量消费者背负学贷和消费贷，有效可支配收入被永久扣减。更糟的是，消费者开始抛售收藏品来还债——二手市场涌入大量廉价商品...',
    effect: '市场需求永久下降， 二手品存量倾泻 同人谷利润崩溃...', effectClass: 'negative',
    apply: (s) => {
      s.advanced.consumerDebt = 15 + Math.floor(Math.random() * 10);
      s.advanced.debtCrisisActive = true;
      // Secondhand flooding (frmn.md)
      if (s.official) {
        s.official.secondHandPool.lvp += Math.round(s.market.communitySize * 0.05);
        s.official.secondHandPool.hvp += Math.round(s.market.communitySize * 0.01);
      }
      s.market.communitySize = Math.round(s.market.communitySize * 0.85);
    },
    tip: '债务危机与纯衰退的关键区别：债务是"存量负担"，不会随经济复苏自行消失。消费者的有效收入被永久扣减。',
    weight: 1, when: (s) => s.turn > 48 && !s.advanced?.debtCrisisActive && activeCrisisCount(s) < 2, maxTotal: 1,
  },

  // --- AI STRUCTURAL SHIFT (lksj.md) ---
  {
    id: 'ai_revolution', emoji: 'robot', title: 'AI革命：市场结构永久改变',
    desc: '生成式AI全面成熟。执行劳动被无限贬值。这不是一次冲击，而是永久的结构变化。',
    effect: '同人谷需求永久-30% 同人本获得稀缺溢价+15%', effectClass: 'neutral',
    apply: (s) => {
      s.advanced.aiRevolution = true;
      s.advanced.aiLvpPenalty = 0.3;
      s.advanced.aiHvpBonus = 0.15;
      s.market.nLVP += 30; // AI "creators" flood LVP market
    },
    tip: 'AI把"执行劳动"贬值为零，但无法取代柯兹纳式的企业家敏锐度——发现未被满足的需求。AI没有欲望、不会意难平、不会深夜辗转反侧。人创的不完美性成为新稀缺品。同人经济的核心是基于共同热爱的人际交换，这不可AI化。',
    weight: 2, when: (s) => s.turn > 24 && !s.advanced?.aiRevolution, maxTotal: 1,
  },

  // --- ENTREPRENEURIAL ALERTNESS / NICHE DISCOVERY (lksj.md Kirzner) ---
  {
    id: 'niche_discovery', emoji: 'magnifying-glass', title: '发现细分需求缺口！',
    desc: '你敏锐地察觉到一个未被满足的市场需求——也许是一个冷门CP，一个独特的世界观设定，或者一种新的表达形式。这个发现只属于你！',
    effect: '接下来4~6个月制作的作品销量×1.8', effectClass: 'positive',
    apply: (s) => {
      const niches = ['冷门CP的全新解读', '跨作品联动设定', '独特的叙事实验', '被遗忘的角色再发掘', '新兴审美风格', '社群热议话题的深度切入'];
      const name = niches[Math.floor(Math.random() * niches.length)];
      const dur = 4 + Math.floor(Math.random() * 3);
      s.advanced.nicheDiscovered = { name, bonusMult: 1.8, turnsLeft: dur };
      s.advanced.nichesFound++;
    },
    tip: '柯兹纳定义企业家精神的核心为"敏锐度/警觉性"——发现市场中未被满足的需求并采取行动。同人创作者在阅读原作时嗅到"读者想要但官方没给的情感缺口"，这就是企业家精神。AI永远无法主动发现这些缺口。',
    weight: 5, when: (s) => s.reputation > 1.5 && !s.advanced?.nicheDiscovered, maxTotal: Infinity,
  },

  // --- NETWORK PHASE TRANSITION (pk45.md) ---
  {
    id: 'network_transition', emoji: 'globe-simple', title: '社群网络发生相变！',
    desc: '随着社群规模扩大，网络结构发生了根本性变化。你的作品现在更难触达所有人——但在自己的圈层内更有影响力。',
    effect: '宣发成本↑ 圈层内声誉更集中', effectClass: 'neutral',
    apply: (s) => {
      s.passion += 3; // excitement of community growth
    },
    tip: '齐美尔的三元闭包：如果A认识B和C，B和C建立连接的概率远高于随机。网络从全连接崩溃后形成团块群而非随机稀疏。消费者的粘性巨大——一旦加入某个圈层形成路径依赖就很难脱离。信号通胀意味着新人的"自证清白"成本越来越高。',
    weight: 3,
    when: (s) => {
      const phase = s.advanced?.networkPhase;
      const prev = s.eventCounts?.network_transition || 0;
      if (prev === 0 && phase === 'growing') return true;
      if (prev === 1 && phase === 'mature') return true;
      if (prev === 2 && phase === 'fragmented') return true;
      return false;
    },
    maxTotal: 3,
  },

  // --- FOREIGN CONTENT WAVE (pk45.md cross-border) ---
  {
    id: 'foreign_wave', emoji: 'waves', title: '海外神作涌入！',
    desc: '一批极高质量的海外同人作品被搬运进来。消费者惊叹之余，本土创作者感受到了强烈的竞争压力。但同时，这些作品也激发了新的创作灵感...',
    effect: '海外竞争↑ 同人本创作者+2 热情+5（灵感激发）', effectClass: 'neutral',
    apply: (s) => {
      s.advanced.foreignContentPressure = Math.min(0.5, (s.advanced.foreignContentPressure || 0) + 0.2);
      if (s.market) s.market.nHVP += 2;
      s.passion = Math.min(100, s.passion + 5);
    },
    tip: '海外创作者的涌入不会降低你的个人声誉——你的口碑是自己积累的。但市场份额会被稀释，竞争加剧意味着同样的声誉能分到的需求更少了。',
    weight: 4, when: (s) => s.turn > 6 && s.market?.communitySize > 3000, maxTotal: Infinity,
  },

  // --- VEBLEN GOOD EVENT (pk45.md) ---
  {
    id: 'veblen_hype', emoji: 'diamond', title: '你的旧作品成了"圣遗物"',
    desc: '你早期的一部作品因为绝版而被炒出高价。圈内开始有人把它当作"正统粉丝"的身份象征，价格越高反而越多人想要...',
    effect: '资金+800 声誉+0.3', effectClass: 'positive',
    apply: (s) => { addMoney(s, 800); addReputation(s, 0.3); },
    tip: '韦伯仑效应：价格越高需求越大。绝版同人制品从消费品相变为金融资产。购买者消费的不再是内容本身，而是"克服高昂交易成本的证明"和"文化正统性"。',
    weight: 2, when: (s) => s.reputation > 4 && s.totalHVP > 2 && s.turn > 24, maxTotal: 3,
  },

  // --- SIGNAL INFLATION (posp.md Spence) ---
  {
    id: 'signal_inflation', emoji: 'megaphone', title: '宣发成本通胀',
    desc: '市场上的信号噪声越来越大——AI量产的精美宣发、狂热新人的用力过猛，使得消费者越来越难辨别真实质量。你需要投入更多才能让别人注意到你。',
    effect: '宣发恢复的信息透明度↓', effectClass: 'negative',
    apply: (s) => {
      s.advanced.signalInflation = Math.min(3.0, (s.advanced.signalInflation || 1) + 0.3);
    },
    tip: '高质量创作者需要发送可信信号来自证。但当情绪补偿使低质量者的边际信号成本趋向零时，信号丧失区分力。消费者更依赖声誉这个"劣等品"——信息越不完全，声誉越重要。',
    weight: 3, when: (s) => s.advanced?.networkPhase === 'mature' || s.advanced?.networkPhase === 'fragmented', maxTotal: Infinity,
  },
];
