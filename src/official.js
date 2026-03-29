/**
 * Official IP & Second-Hand Market — Phase 3
 * bilateral market, asset depreciation, Hotelling positioning
 * durable goods, secondhand pricing, resale value
 */

import { ic } from './icons.js';
import { addMoney, addReputation } from './engine/core.js';

// === IP Heat System (hsls.md: dK/dt = I_official + θ·N_D - λ·K) ===
export function createOfficialState(ipType = 'normal') {
  return {
    ipHeat: ipType === 'cold' ? 35 : ipType === 'hot' ? 95 : 80,
    officialActive: ipType !== 'cold', // cold IP: official is dormant from start
    dormancyTurns: ipType === 'cold' ? 24 : 0, // cold: already 2 years without update
    shadowPrice: 0,         // P_D: negative=subsidy, positive=restriction
    lastReleaseType: null,  // 'major'|'minor'|null

    // IP Lifecycle Phase (derived from initial ipHeat)
    ipPhase: ipType === 'cold' ? 'decline' : 'growth',
    phaseTransitionTurn: 0,      // turn when last phase transition occurred
    revivalTurnsLeft: 0,         // countdown for revival phase (6 turns)

    // Second-hand market
    secondHandPool: { hvp: 0, lvp: 0 },  // aggregate available secondhand items
    secondHandPressure: 0,                 // 0-1, how much secondhand is eating into new sales
    playerInventory: [],                    // player's past works: [{ type, turn, reputation, qty }]
  };
}

// === IP Lifecycle Phase computation ===
export function computeIPPhase(official) {
  if (official.revivalTurnsLeft > 0) return 'revival';
  const h = official.ipHeat;
  if (h >= 70) return 'growth';
  if (h >= 50) return 'peak';
  if (h >= 20) return 'decline';
  if (h >= 5) return 'twilight';
  return 'death';
}

const IP_PHASE_NAMES = {
  growth: '上升期', peak: '鼎盛期', decline: '衰退期',
  twilight: '黄昏期', death: '消亡期', revival: '复兴期',
};

// === Tick Official IP each turn ===
export function tickOfficial(official, market, playerState) {
  const events = [];
  const ipType = market.ipType || 'normal';

  // --- 1. IP Heat decay: dK/dt = I_official + θ·N_D - λ·K ---
  // Lambda increases with IP age (older IPs decay faster)
  const ipAge = playerState.turn / 12; // years since game start
  const baseLambda = ipType === 'cold' ? 0.05 : ipType === 'hot' ? 0.02 : 0.03;
  const lambda = baseLambda + ipAge * 0.003; // +0.003/year: Y5=+0.015, Y10=+0.03
  const totalCreators = market.nHVP + market.nLVP + 1;
  const doujinContrib = totalCreators * 0.03; // doujin can slow decay but not prevent it
  let officialInput = 0;

  // Official release cycle — IP type determines how often official bothers
  const majorChance = ipType === 'cold' ? 0.03 : ipType === 'hot' ? 0.18 : 0.12;
  const minorChance = ipType === 'cold' ? 0.02 : ipType === 'hot' ? 0.15 : 0.10;
  official.dormancyTurns++;
  if (official.officialActive) {
    if (official.dormancyTurns >= 8 && Math.random() < majorChance) {
      // Major release
      officialInput = 30;
      official.dormancyTurns = 0;
      official.lastReleaseType = 'major';
      events.push({ type: 'official_release', emoji: 'film-strip', title: '官方出新作了！',
        desc: 'IP官方发布了重大新内容！整个圈子沸腾了，社群人数激增，创作热情高涨。',
        effect: 'IP热度大幅↑ 社群+20% 热情+10', effectClass: 'positive',
        tip: '官方新作是IP热度的资本注入。官方出新作时搭顺风车创作，声誉收益最大。',
        apply: (s) => {
          s.official.ipHeat = Math.min(100, s.official.ipHeat + 30);
          s.market.communitySize = Math.round(s.market.communitySize * 1.2);
          s.passion = Math.min(100, s.passion + 10);
        },
      });
    } else if (official.dormancyTurns >= 4 && Math.random() < minorChance) {
      // Minor update
      officialInput = 10;
      official.dormancyTurns = Math.max(0, official.dormancyTurns - 4);
      official.lastReleaseType = 'minor';
      events.push({ type: 'official_minor', emoji: 'newspaper', title: '官方小更新',
        desc: '官方发布了一些新情报/活动/联动，圈子热度小幅回升。',
        effect: 'IP热度+10 社群+5%', effectClass: 'positive',
        tip: '官方的持续运营维持IP热度不跌破死亡阈值。即使是小更新也能重置信息半衰期，延长IP的社交货币寿命。',
        apply: (s) => {
          s.official.ipHeat = Math.min(100, s.official.ipHeat + 10);
          s.market.communitySize = Math.round(s.market.communitySize * 1.05);
        },
      });
    }

    // Official crackdown (rare) — shadow price goes positive
    if (Math.random() < 0.02) {
      events.push({ type: 'official_crackdown', emoji: 'scales', title: '官方版权收紧',
        desc: '官方发布了更严格的二创指引，部分创作者被警告。创作成本和心理压力上升...',
        effect: '官方对同人的管制上升 NPC创作者减少 热情-8', effectClass: 'negative',
        tip: '创作者是高敏人群，哪怕小幅限制也会导致大批人退出。跨边外部性会放大效应：创作者减少→消费者也跟着流失。',
        apply: (s) => {
          s.official.shadowPrice = 0.3;
          s.passion -= 8;
          s.market.nLVP = Math.max(10, s.market.nLVP - Math.floor(s.market.nLVP * 0.15));
          s.market.nHVP = Math.max(0, s.market.nHVP - 1);
        },
      });
    }

    // Official subsidy (rare) — shadow price goes negative
    if (official.shadowPrice <= 0 && Math.random() < 0.03) {
      events.push({ type: 'official_subsidy', emoji: 'gift', title: '官方发布素材包/征稿',
        desc: '官方公开了创作素材库，并发起同人征集活动。相当于对创作者的隐性补贴！',
        effect: '制作成本↓ 新创作者涌入 声誉+0.2', effectClass: 'positive',
        tip: '官方对同人的影子价格变为补贴。官方主业赚钱时，补贴同人是理性的——每多一个创作者都能转化新的付费粉丝。',
        apply: (s) => {
          s.official.shadowPrice = -0.2;
          addReputation(s, 0.2);
          s.market.nLVP += 5;
          addMoney(s, 300); // subsidy equivalent
        },
      });
    }
  }

  // IP Heat update
  const prevHeat = official.ipHeat;
  const prevPhase = official.ipPhase || computeIPPhase(official);
  // Phase-specific decay modifier: decline phase accelerates decay
  const phaseDecayMult = prevPhase === 'decline' ? 1.2 : 1.0;
  const heatDelta = officialInput + doujinContrib - (lambda * phaseDecayMult) * official.ipHeat;
  official.ipHeat = Math.max(0, Math.min(100, official.ipHeat + heatDelta));

  // --- IP Phase transition logic ---
  const heatJump = official.ipHeat - prevHeat;
  // Check revival trigger: ipHeat jumped >= 20 from twilight/death
  if ((prevPhase === 'twilight' || prevPhase === 'death') && heatJump >= 20) {
    official.revivalTurnsLeft = 6;
  }
  // Decrement revival countdown
  if (official.revivalTurnsLeft > 0) {
    official.revivalTurnsLeft--;
  }
  const newPhase = computeIPPhase(official);
  if (newPhase !== prevPhase) {
    official.ipPhase = newPhase;
    official.phaseTransitionTurn = playerState.turn;
    const phaseName = IP_PHASE_NAMES[newPhase];
    const phaseEventMap = {
      growth:   { emoji: 'fire',      effectClass: 'positive', desc: 'IP进入上升期！官方势头强劲，整个圈子充满活力。', effect: 'IP进入上升期' },
      peak:     { emoji: 'star',      effectClass: 'positive', desc: 'IP进入鼎盛期，热度稳定在高位，创作和消费都很活跃。', effect: 'IP进入鼎盛期' },
      decline:  { emoji: 'warning',   effectClass: 'negative', desc: 'IP开始走下坡路了...官方内容减少，热度逐渐流失。衰退期的热度衰减会加速。', effect: 'IP进入衰退期 热度衰减加速' },
      twilight: { emoji: 'hourglass', effectClass: 'negative', desc: 'IP进入黄昏期。只有最忠实的粉丝还在，高价值创作反而稀缺溢价，但低价值品几乎卖不动。', effect: 'IP进入黄昏期 谷子销量大幅下降' },
      death:    { emoji: 'snowflake', effectClass: 'negative', desc: 'IP几乎消亡了...社群所剩无几，只有极少数人还记得这个作品。', effect: 'IP进入消亡期' },
      revival:  { emoji: 'sparkles',  effectClass: 'positive', desc: 'IP奇迹般地复兴了！沉寂已久的作品重新成为话题，大量新老粉丝涌入，创作迎来第二春。', effect: 'IP复兴！销量大幅提升（持续6个月）' },
    };
    const pe = phaseEventMap[newPhase];
    events.push({
      type: 'ip_phase_transition', emoji: pe.emoji,
      title: `IP生命周期：${phaseName}`,
      desc: pe.desc, effect: pe.effect, effectClass: pe.effectClass,
      tip: newPhase === 'revival' ? '复兴期是难得的窗口——抓紧创作，复兴只持续6个月。'
        : newPhase === 'twilight' ? '黄昏期的高价值创作（同人本）反而有溢价——稀缺性让真爱粉愿意付更多。但谷子已经没人买了。'
        : newPhase === 'decline' ? '衰退期要做好转型准备。可以考虑转向其他IP，或者深耕核心粉丝。'
        : newPhase === 'death' ? '消亡期的IP几乎没有商业价值。除非官方奇迹般复活，否则建议尽早转型。'
        : 'IP处于良好状态，正是创作的好时机。',
    });
  } else {
    official.ipPhase = newPhase;
  }

  // --- IP Breakthrough: cold IP sleeper hit (only for initially cold IPs) ---
  // When a cold IP's heat stays in growth/revival (>=70) for 6+ consecutive months, it upgrades.
  // This only applies to IPs that started as cold — hot/normal IPs cycling through
  // decline→revival is a natural fluctuation, not a "breakthrough".
  // Only cold IPs can break through (one-time: cold → normal).
  // Normal/hot IPs grow via the lifecycle phase system, not ipType changes.
  if (market._initialIpType === 'cold' && market.ipType === 'cold') {
    if (newPhase === 'growth' || newPhase === 'revival') {
      official._growthStreak = (official._growthStreak || 0) + 1;
    } else {
      official._growthStreak = 0;
    }
    if (official._growthStreak >= 6) {
      market.ipType = 'normal';
      market.carryingCapacity = 25000;
      official._growthStreak = 0;
      events.push({
        type: 'ip_breakthrough', emoji: 'rocket',
        title: '冷门逆袭！IP被发掘了',
        desc: '曾经无人问津的冷门作品，在持续的创作热潮和官方关注下终于迎来了爆发！社群天花板大幅提升，更多创作者和粉丝涌入。这就是同人力量创造的奇迹——你们的热爱让官方都重新重视起了这个IP。',
        effect: '社群上限→25,000 官方活动频率↑ 衰减速度↓',
        effectClass: 'positive',
        tip: '冷门IP逆袭成功！这就是"小众变主流"——当累积的创作质量突破临界点，网络效应会让增长变成指数级的。但更大的市场也意味着更多竞争者涌入和更高的信号通胀。',
      });
    }
  }

  // Twilight phase: suppress official events (official has given up)
  if (newPhase === 'twilight' || newPhase === 'death') {
    official.officialActive = false;
  } else if (!official.officialActive && (newPhase === 'growth' || newPhase === 'peak' || newPhase === 'revival')) {
    official.officialActive = true;
  }

  // Shadow price decays back to 0 over time
  official.shadowPrice *= 0.9;

  // IP Heat affects community: lower heat = faster fan exodus
  if (official.ipHeat < 10) {
    // IP effectively dead — community collapses toward ~1000
    const collapseRate = market.communitySize > 1500 ? 0.08 : 0.02;
    market.communitySize = Math.max(500, Math.round(market.communitySize * (1 - collapseRate)));
  } else if (official.ipHeat < 20) {
    market.communitySize = Math.round(market.communitySize * 0.95); // 5% churn
  } else if (official.ipHeat < 40) {
    market.communitySize = Math.round(market.communitySize * 0.98); // 2% churn
  }

  // --- 2. Second-Hand Market (frmn.md) ---

  // Natural secondhand supply: consumers who exit/change fandoms sell their stuff
  const churnRate = playerState.recessionTurnsLeft > 0 ? 0.05 : 0.02;
  official.secondHandPool.lvp += Math.floor(market.communitySize * 0.001 * churnRate * 50);
  official.secondHandPool.hvp += Math.floor(market.communitySize * 0.001 * churnRate * 10);

  // Debt crisis flooding: during recession, consumers dump collections
  if (playerState.recessionTurnsLeft > 0) {
    official.secondHandPool.lvp += Math.floor(market.communitySize * 0.003);
    official.secondHandPool.hvp += Math.floor(market.communitySize * 0.001);
  }

  // Secondhand items decay (get sold or become unsellable) — slower decay = items linger longer
  official.secondHandPool.lvp = Math.floor(official.secondHandPool.lvp * 0.90);
  official.secondHandPool.hvp = Math.floor(official.secondHandPool.hvp * 0.93);

  // Secondhand pressure on new sales
  // LVP: high substitutability (ρ→1), secondhand crushes new — up to 70%
  // HVP: partial protection (differentiated product) — up to 40%
  const lvpPressure = Math.min(0.7, official.secondHandPool.lvp / (market.communitySize * 0.05));
  const hvpPressure = Math.min(0.4, official.secondHandPool.hvp / (market.communitySize * 0.1));
  official.secondHandPressure = { lvp: lvpPressure, hvp: hvpPressure };

  return events;
}

// === Secondhand modifier for player sales ===
export function getSecondHandModifier(official, productType) {
  if (!official) return 1.0;
  const p = productType === 'hvp' ? official.secondHandPressure.hvp : official.secondHandPressure.lvp;
  return Math.max(0.3, 1 - (p || 0));
}

// === Record player's sold work for future resale value ===
export function recordPlayerWork(official, type, turn, reputation, qty) {
  official.playerInventory.push({ type, turn, reputation, qty, remaining: qty });
}

// === Player can sell old inventory on secondhand market ===
export function getResaleValue(work, currentTurn) {
  const age = currentTurn - work.turn;
  const delta = 0.95; // time discount per month
  const basePrice = work.type === 'hvp' ? 50 : 15;
  // Older + higher reputation at creation = higher resale
  const reputationBonus = 1 + work.reputation * 0.1;
  const price = Math.round(basePrice * Math.pow(delta, age) * reputationBonus);
  return Math.max(5, price);
}

// === IP Heat narratives (phase-aware) ===
export function getOfficialNarratives(official) {
  const phrases = [];
  const phase = official.ipPhase || computeIPPhase(official);
  const phaseName = IP_PHASE_NAMES[phase] || phase;

  switch (phase) {
    case 'growth':
      phrases.push(`${ic('fire')} IP正处于【${phaseName}】，热度高涨，创作正当时！`);
      break;
    case 'peak':
      phrases.push(`${ic('star')} IP处于【${phaseName}】，热度稳定，官方和同人共同维持着繁荣。`);
      break;
    case 'decline':
      phrases.push(`${ic('warning')} IP进入【${phaseName}】。热度在加速流失，官方更新变少了...`);
      break;
    case 'twilight':
      phrases.push(`${ic('hourglass')} IP已步入【${phaseName}】。只有最忠实的粉丝还在坚持，同人本反而成了稀缺品。`);
      break;
    case 'death':
      phrases.push(`${ic('snowflake')} IP进入【${phaseName}】。几乎被遗忘了，社群所剩无几...`);
      break;
    case 'revival':
      phrases.push(`${ic('sparkles')} IP正在【${phaseName}】！沉寂的作品重获新生，创作迎来黄金窗口！（剩余${official.revivalTurnsLeft}个月）`);
      break;
  }

  if (official.dormancyTurns > 12) phrases.push('官方已经' + official.dormancyTurns + '个月没有任何动静了...');

  const shp = official.secondHandPressure;
  if (shp && shp.lvp > 0.3) phrases.push(`${ic('package')} 二手谷子大量涌入，新品谷子销量被严重挤压。`);
  if (shp && shp.hvp > 0.1) phrases.push(`${ic('books')} 二手同人本市场活跃，对新品有一定冲击。`);

  return phrases;
}
