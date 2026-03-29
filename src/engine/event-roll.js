import { getLifeStage, getAge, getCreativeSkill, addMoney, addReputation, computeEffectiveTime } from './core.js';
import { SCHEDULED_EVENTS, RANDOM_EVENTS } from '../events.js';
import { ADVANCED_EVENTS } from '../advanced.js';
import { addContact } from '../partner.js';
import { ic } from '../icons.js';

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

  // 1.5. Dynamic scheduled: reprint crash (fires guaranteed)
  if (state.reprintCrashTurn && state.turn >= state.reprintCrashTurn) {
    const workName = state.reprintCrashWorkName || '旧作';
    state.reprintCrashTurn = null;
    state.reprintCrashWorkName = null;
    return {
      id: 'reprint_crash', emoji: 'trend-down', title: '海景房崩盘！',
      desc: `你加印「${workName}」的消息传开了。投机客们发现"绝版"不再绝版，恐慌性抛售开始——二手市场上大量低价涌出，投机泡沫瞬间破裂。不过对真正喜欢你作品的读者来说，终于能以合理价格买到了。`,
      effect: '二手压力大降 声誉+0.2', effectClass: 'positive',
      apply: (s) => {
        if (s.official) {
          s.official.secondHandPool.hvp = Math.floor(s.official.secondHandPool.hvp * 0.3);
          s.official.secondHandPool.lvp = Math.floor(s.official.secondHandPool.lvp * 0.7);
          if (s.official.secondHandPressure) {
            s.official.secondHandPressure.hvp = Math.max(0, (s.official.secondHandPressure.hvp || 0) - 0.2);
          }
        }
        addReputation(s, 0.2);
      },
      tip: '加印打破了"绝版溢价"：投机客押注的稀缺性归零。这是创作者对抗投机的核武器，真正的读者会感谢你。',
    };
  }

  // 1.8. Reputation freefall → backlash event (恶评风波)
  // Triggers when reputation drops significantly over 3 months (relative to current level)
  // Cooldown: 6 months after last backlash to prevent snowball spiral
  const repDelta = state._repDelta3m || 0;
  const repDropRate = state.reputation > 0.5 ? -repDelta / state.reputation : 0;
  const backlashCooldown = state._lastBacklashTurn ? state.turn - state._lastBacklashTurn : Infinity;
  if (repDropRate > 0.20 && -repDelta > 0.5 && state.reputation > 1 && backlashCooldown >= 6 && Math.random() < Math.min(0.5, repDropRate * 0.7)) {
    const severity = -repDelta > 1.5 ? 'severe' : -repDelta > 0.8 ? 'moderate' : 'mild';
    const extraDrop = severity === 'severe' ? 0.4 : severity === 'moderate' ? 0.2 : 0.1;
    const passionHit = severity === 'severe' ? 23 : severity === 'moderate' ? 12 : 6;
    const titles = {
      mild: '风评开始变差…',
      moderate: '恶评扩散中！',
      severe: '声誉崩塌引发连锁恶评！',
    };
    const descs = {
      mild: '有人在社交媒体上提到你最近的"下坡路"，评论区开始出现微妙的冷嘲热讽。',
      moderate: '你的声誉快速下滑引起了圈内关注。"xxx是不是不行了？"的讨论开始蔓延，部分粉丝开始动摇。',
      severe: '声誉的急剧下滑像推倒了多米诺骨牌。曾经追捧你的人开始翻旧账，"早就觉得不过如此"的马后炮铺天盖地。',
    };
    return {
      id: 'rep_backlash', emoji: 'megaphone', title: titles[severity],
      desc: descs[severity],
      effect: `声誉-${extraDrop.toFixed(1)} 热情-${passionHit}`, effectClass: 'negative',
      apply: (s) => {
        s.reputation = Math.max(0, s.reputation - extraDrop);
        s.passion = Math.max(0, s.passion - passionHit);
        s._lastBacklashTurn = s.turn;
        s._lastBacklashSeverity = severity;
      },
      tip: '声誉的下滑不只是数字减少——它会引发"恶评螺旋"。人们对"正在下坡"的创作者格外苛刻，因为批评不再有反噬风险。维护声誉的最好方式是保持稳定的创作产出。',
    };
  }

  // 1.9. Commercial offer — independent 30% check when conditions met (bypasses event pool competition)
  if (!state.commercialOfferReceived && state.reputation >= 6 && state.totalRevenue >= 50000 &&
      state.totalHVP >= 8 && getCreativeSkill(state) >= 4 && state.turn >= 24 && Math.random() < 0.30) {
    const evt = RANDOM_EVENTS.find(e => e.id === 'commercial_offer');
    if (evt) return evt;
  }

  // 2. Random events: 35% chance after turn 1
  if (state.turn < 1 || Math.random() > 0.35) return null;

  // Money-loss events: reduced/removed for wealthy backgrounds
  const MONEY_LOSS_EVENTS = new Set([
    'family_emergency', 'inflation', 'health_issue', 'work_burnout',
    'social_obligation', 'life_admin', 'unexpected_expense', 'rent_increase', 'tax_season',
  ]);
  const bg = state.background;
  // 书香门第 0.6x, 富裕家庭 0.3x, 超级富哥 0x
  const moneyLossWeightMult = bg === 'tycoon' ? 0 : bg === 'wealthy' ? 0.3 : bg === 'educated' ? 0.6 : 1;

  // Filter by condition and frequency cap
  const allEvents = [...RANDOM_EVENTS, ...ADVANCED_EVENTS];
  const eligible = allEvents.filter(e => {
    if (!e.when(state)) return false;
    const count = state.eventCounts[e.id] || 0;
    if (count >= e.maxTotal) return false;
    // 超级富哥: skip money-loss events entirely
    if (moneyLossWeightMult === 0 && MONEY_LOSS_EVENTS.has(e.id)) return false;
    return true;
  });
  if (eligible.length === 0) return null;

  // Apply weight reduction for money-loss events based on background
  // weight can be a number or a function(state)
  const getWeight = (e) => typeof e.weight === 'function' ? e.weight(state) : e.weight;
  const totalWeight = eligible.reduce((sum, e) => {
    const w = MONEY_LOSS_EVENTS.has(e.id) ? getWeight(e) * moneyLossWeightMult : getWeight(e);
    return sum + w;
  }, 0);
  let roll = Math.random() * totalWeight;
  for (const event of eligible) {
    const w = MONEY_LOSS_EVENTS.has(event.id) ? getWeight(event) * moneyLossWeightMult : getWeight(event);
    roll -= w;
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
  // 书香门第以上家庭: dip chance reduced; 超级富哥: no dip
  const bgDip = state.background;
  const dipMult = bgDip === 'tycoon' ? 0 : bgDip === 'wealthy' ? 0.3 : bgDip === 'educated' ? 0.6 : 1;
  const resolvedEffectClass = typeof event.effectClass === 'function' ? event.effectClass(state) : event.effectClass;
  if (dipMult > 0 && resolvedEffectClass === 'negative' && state.money > 300) {
    const urgency = EVENT_URGENCY[event.id] || 'low';
    const cfg = DIP_CONFIG[urgency];
    if (Math.random() < cfg.chance * dipMult) {
      const rate = cfg.rateMin + Math.random() * (cfg.rateMax - cfg.rateMin);
      const dip = Math.round(state.money * rate);
      if (dip > 0) {
        addMoney(state, -dip);
        state._pendingEventDip = { label: event.title, amount: dip }; // picked up by next executeTurn
      }
    }
  }

  // Handle friend_intro flag → add contact to pool
  if (state._pendingFriendIntro) {
    state._pendingFriendIntro = false;
    addContact(state, { source: 'friend_intro', affinity: 2.0, forceType: 'supportive' });
  }

  state.reputation = Math.max(0, state.reputation);
  state.passion = Math.max(0, Math.min(100, state.passion));
  if (state.passion <= 0) {
    state.phase = 'gameover';
    state.gameOverReason = '一系列打击让你的创作热情消磨殆尽...';
  }
}
