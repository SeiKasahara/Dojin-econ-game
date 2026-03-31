import { getLifeStage, getAge } from './core.js';
import { HVP_SUBTYPES } from './definitions.js';
import { getSignalCost } from '../advanced.js';
import { ic } from '../icons.js';

// === Actions ===
// Time is monthly leisure: 0-10 scale (10=entire month free, 0=no free time)
// HVP is multi-turn: solo 3 months, with partner 2 months
export const ACTIONS = {
  hvp:         { id: 'hvp',         name: '创作同人本', emoji: 'book-open-text', type: 'hvp',
                 costLabel: '热情-15/月 印刷¥2500~3000 需闲暇≥4天(有搭档≥2天)', requires: { passion: 15, time: 4 } },
  lvp:         { id: 'lvp',         name: '制作谷子',   emoji: 'key', type: 'lvp',
                 costLabel: '热情-8 资金-200 需闲暇≥2天', requires: { passion: 10, time: 2 } },
  rest:        { id: 'rest',        name: '休息充电',   emoji: 'coffee', type: 'rest',
                 costLabel: '热情+15~25', requires: {} },
  promote_light: { id: 'promote_light', name: '轻度宣发', emoji: 'megaphone', type: 'promote',
                   costLabel: '热情-3 小幅提升信息', requires: { passion: 3, time: 1 }, promoteIntensity: 'light' },
  promote_heavy: { id: 'promote_heavy', name: '全力宣发', emoji: 'megaphone-simple', type: 'promote',
                   costLabel: '热情-8 大幅提升信息 需闲暇≥3天', requires: { passion: 8, time: 3 }, promoteIntensity: 'heavy' },
  findPartner: { id: 'findPartner', name: '招募搭档',   emoji: 'handshake', type: 'social',
                 costLabel: '热情-3 从人脉池选搭档', requires: { passion: 3, time: 2 } },
  partTimeJob: { id: 'partTimeJob', name: '普通打工',   emoji: 'storefront', type: 'work',
                 costLabel: '赚¥300~500 下月闲暇-1天 仅学生/失业', requires: { passion: 2, time: 3 } },
  freelance:   { id: 'freelance',   name: '接稿赚钱',   emoji: 'paint-brush', type: 'freelance',
                 costLabel: '热情-4 下月闲暇-2天 收入看声誉', requires: { passion: 4, time: 2 } },
  attendEvent: { id: 'attendEvent', name: '参加同人展', emoji: 'tent', type: 'attendEvent',
                 costLabel: '需有同人展·路费·亲参≥3天/寄售≥1天', requires: { passion: 5, time: 1 } },
  jobSearch:   { id: 'jobSearch',   name: '找工作',     emoji: 'briefcase', type: 'jobSearch',
                 costLabel: '热情-10 面试奔波', requires: { passion: 5 } },
  quitForDoujin: { id: 'quitForDoujin', name: '辞职全职同人', emoji: 'sparkle', type: 'quitForDoujin',
                 costLabel: '辞掉工作，全身心投入同人创作', requires: {} },
  reprint:     { id: 'reprint',     name: '追加印刷',   emoji: 'printer', type: 'reprint',
                 costLabel: '补印库存 需有旧作', requires: { passion: 3 } },
  buyGoods:    { id: 'buyGoods',    name: '购买同人制品',   emoji: 'shopping-bag', type: 'buyGoods',
                 costLabel: '¥200 热情上升', requires: {} },
  sellGoods:   { id: 'sellGoods',   name: '出售闲置',   emoji: 'export', type: 'sellGoods',
                 costLabel: '卖掉收藏品换钱 需有收藏', requires: { time: 1 } },
  goCommercial: { id: 'goCommercial', name: '商业出道',  emoji: 'star', type: 'goCommercial',
                 costLabel: '接受出版社邀约，告别同人时代', requires: {} },
  hireAssistant: { id: 'hireAssistant', name: '外包助手', emoji: 'user', type: 'hireAssistant',
                 costLabel: '¥800~1500 加速当前同人本进度', requires: { time: 1 } },
  upgradeEquipment: { id: 'upgradeEquipment', name: '升级设备', emoji: 'desktop', type: 'upgradeEquipment',
                 costLabel: '一次性大额投入 永久提升创作质量', requires: {} },
  sponsorCommunity: { id: 'sponsorCommunity', name: '投资社群', emoji: 'hand-heart', type: 'sponsorCommunity',
                 costLabel: '花钱回馈社群 声誉↑热情↑ 冷却3月', requires: {} },
  surfOnline: { id: 'surfOnline', name: '网络冲浪', emoji: 'globe', type: 'surfOnline',
                 costLabel: '热情-2 拓展线上人脉 每月1次', requires: { passion: 2, time: 1 } },
  anthology: { id: 'anthology', name: '合集企划', emoji: 'books', type: 'anthology',
                 costLabel: '多人协作大型项目 需声誉≥4', requires: { passion: 10, time: 2 } },
};

// Dynamic action info (for UI)
export function getActionDisplay(actionId, state) {
  const base = ACTIONS[actionId];
  if (!base) return null;
  if (actionId === 'rest') {
    const yearsIn = state.turn / 12;
    const eff = Math.max(45, Math.round((1 - yearsIn * 0.03) * 100));
    const remaining = Math.max(0, state.time - (state.monthTimeSpent || 0));
    const idle = state.turn - state.lastCreativeTurn;
    let extra = '';
    if (idle >= 3) extra = ` ${ic('warning')}已${idle}月未活动`;
    return { ...base, costLabel: `自选时长(1-${remaining}天) 效率${eff}%${extra}` };
  }
  if (actionId === 'jobSearch') {
    const switchMalus = Math.min(30, ((state.doujinQuitCount || 0) - 1) * 10);
    const recMod = state.recessionTurnsLeft > 0 ? 0.5 : 1;
    const normalProb = Math.round(Math.min(85, (Math.max(5, 30 - switchMalus) + state.jobSearchTurns * 10) * recMod));
    const eliteProb = Math.round(Math.min(12, (Math.max(1, 3 + (state.reputation >= 5 ? 2 : 0) + (state.reputation >= 8 ? 3 : 0))) * recMod * (1 - switchMalus / 100)));
    const tag = switchMalus > 0 ? ` 跳槽-${switchMalus}%` : '';
    return { ...base, costLabel: `已找${state.jobSearchTurns}月 普通${normalProb}% 大厂${eliteProb}%${tag}` };
  }
  if (actionId === 'freelance') {
    const tc = getFreelanceTimeCost(state);
    const label = state.unemployed ? '失业接稿' : getLifeStage(state.turn) === 'university' ? '课余接稿' : '下班接稿';
    const recTag = state.recessionTurnsLeft > 0 ? ` ${ic('trend-down')}-50%` : '';
    const premiumTag = state.reputation >= 4 ? ' 含高端约稿' : '';
    // Show why time cost is high
    const tierReason = state.jobTier === 'elite' ? '(大厂加班多)' : state.jobTier === 'labor' ? '(体力活后疲劳)' : '';
    const hopDebuff = (state.timeDebuffs || []).find(d => d.id === 'job_hop_penalty');
    const hopTag = hopDebuff ? ` 跳槽观察期闲暇${hopDebuff.delta}天` : '';
    return { ...base, costLabel: `需≥${tc}天 ${label}${tierReason}${hopTag}${recTag}${premiumTag}` };
  }
  if (actionId === 'partTimeJob') {
    const stage = getLifeStage(state.turn);
    if (stage === 'work' && !state.unemployed && !state.fullTimeDoujin) return { ...base, costLabel: '仅学生/失业/全职同人可用' };
    const recTag = state.recessionTurnsLeft > 0 ? ` ${ic('trend-down')}` : '';
    return { ...base, costLabel: `赚¥300~500 下月闲暇-1天${recTag}` };
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
      return { ...base, name: `继续创作${sub.name}${p.name ? '·' + p.name : ''}`, emoji: sub.emoji, costLabel: `进度 ${p.progress}/${p.needed} · 热情-${staCost}${recTag}` };
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
    if (state.totalHVP > 0) parts.push(`本60本¥1200`);
    if (state.totalLVP > 0) parts.push(`谷20个¥120`);
    return { ...base, costLabel: `${parts.join(' / ')} 库存:本${state.inventory.hvpStock}·谷${state.inventory.lvpStock}` };
  }
  if (actionId === 'buyGoods') {
    const m = Math.max(0, state.money);
    const cost = m < 3000 ? 200 : m < 6000 ? 600 : m < 9000 ? 1500 : m < 15000 ? 3000 : 5000;
    const yearsIn = state.turn / 12;
    const eff = Math.max(30, Math.round((1 - yearsIn * 0.08) * 100));
    const passionGain = Math.round(12 * eff / 100);
    return { ...base, costLabel: `¥${cost} 热情+${passionGain}${eff < 100 ? ` 效率${eff}%` : ''}${state.money < cost ? ` ${ic('warning')}资金不足` : ''}` };
  }
  if (actionId === 'sellGoods') {
    if (state.goodsCollection <= 0) return { ...base, costLabel: '没有收藏品可出' };
    const shPressure = state.official?.secondHandPressure?.lvp || 0;
    const unitPrice = Math.max(50, Math.round(120 * (1 - shPressure * 0.5)));
    return { ...base, costLabel: `收藏${state.goodsCollection}件 预估¥${unitPrice}/件` };
  }
  if (actionId === 'quitForDoujin') {
    if (state.unemployed) {
      const qc = state.doujinQuitCount || 0;
      const warn = qc >= 1 ? ` (第${qc + 1}次·惩罚↑)` : '';
      return { ...base, name: '全职搞同人', costLabel: `不找工作了，把失业变成机遇！${warn}` };
    }
    // Cooldown check display
    if (state.lastReturnToWorkTurn > 0 && state.turn - state.lastReturnToWorkTurn < 12) {
      const left = 12 - (state.turn - state.lastReturnToWorkTurn);
      return { ...base, costLabel: `需要先稳定工作${left}个月才能再辞职` };
    }
    const qc = state.doujinQuitCount || 0;
    if (qc >= 1) {
      return { ...base, costLabel: `辞掉工作，全身心投入同人创作 (第${qc + 1}次·求职更难)` };
    }
    return base;
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
    const tiers = getSponsorTiers(state);
    const available = tiers.filter(t => t.unlocked);
    if (available.length === 0) return { ...base, costLabel: '资金不足' };
    const best = available[available.length - 1];
    return { ...base, costLabel: `${available.length}种方案可选 · ¥${available[0].cost}~¥${best.cost}` };
  }
  if (actionId === 'anthology') {
    if (state.anthologyProject) {
      const ap = state.anthologyProject;
      return { ...base, name: `推进合集企划「${ap.name || '合集'}」`, costLabel: `进度 ${ap.progress}/${ap.needed} · ${ap.members.length}人参与 · 热情-10` };
    }
    const familiarCount = (state.contacts || []).filter(c => c.affinity >= 2).length;
    if (state.reputation < 4) return { ...base, costLabel: `需要声誉≥4（当前${state.reputation.toFixed(1)}）` };
    if (familiarCount < 3) return { ...base, costLabel: `需要≥3位熟悉的联系人（当前${familiarCount}位）` };
    return { ...base, costLabel: `热情-10 选2-3人合作 工期4-6月 高风险高回报` };
  }
  if (actionId === 'findPartner') {
    if (state.hasPartner) return { ...base, costLabel: '已有搭档' };
    if (!state.contacts?.length) return { ...base, costLabel: '没有认识的人——先去冲浪或参加展会吧' };
    return { ...base, costLabel: `热情-3 从${state.contacts.length}位联系人中选` };
  }
  if (actionId === 'surfOnline') {
    if (state.surfedThisMonth) return { ...base, costLabel: '本月已冲浪过' };
    const disc = state.infoDisclosure || 0.2;
    const social = state.endowments?.social || 0;
    const chance = Math.round(Math.min(0.85, disc * 0.6 + social * 0.05) * 100);
    return { ...base, costLabel: `热情-2 发现概率${chance}% 透明度${Math.round(disc * 100)}%` };
  }
  return base;
}

// === Sponsor Community Tiers ===
// Higher reputation + age unlocks bigger (more expensive) sponsorship options
export function getSponsorTiers(state) {
  const cs = state.market ? state.market.communitySize : 10000;
  const rep = state.reputation;
  const age = getAge(state.turn);
  const remaining = state.time - (state.monthTimeSpent || 0);
  const baseCost = Math.round(1500 + cs / 10000 * 1500);
  return [
    {
      id: 'basic', name: '赞助茶歇', emoji: 'coffee',
      desc: '为社区线下聚会提供茶歇和场地费',
      cost: baseCost, timeCost: 0, repGain: 0.15, passionGain: 8, infoGain: 0.15, contacts: 2,
      unlocked: state.money >= baseCost,
    },
    {
      id: 'workshop', name: '举办创作工坊', emoji: 'chalkboard-teacher',
      desc: '组织创作经验分享会，你是主讲人',
      cost: Math.round(baseCost * 2.5), timeCost: 2, repGain: 0.30, passionGain: 12, infoGain: 0.25, contacts: 3,
      unlocked: rep >= 5 && age >= 20 && remaining >= 2 && state.money >= Math.round(baseCost * 2.5),
      tip: '分享经验不仅帮助新人，也是巩固自身地位的社交投资。教学相长——整理思路本身就是创作力的来源。',
    },
    {
      id: 'festival', name: '冠名社区祭', emoji: 'confetti',
      desc: '出资冠名一场小型同人交流祭',
      cost: Math.round(baseCost * 5), timeCost: 3, repGain: 0.50, passionGain: 15, infoGain: 0.35, contacts: 5,
      unlocked: rep >= 7 && age >= 22 && remaining >= 3 && state.money >= Math.round(baseCost * 5),
      tip: '冠名活动是"社区领袖"的标志性行为——你不只是参与者，而是生态的塑造者。但花费巨大，量力而行。',
    },
    {
      id: 'fund', name: '设立新人基金', emoji: 'hand-coins',
      desc: `设立以你的社团名义命名的新人扶持基金${state._fundEstablished ? '（已设立）' : '（永久占用每月1天闲暇）'}`,
      cost: Math.round(baseCost * 10), timeCost: 4, repGain: 0.80, passionGain: 20, infoGain: 0.50, contacts: 4,
      unlocked: rep >= 9 && age >= 28 && remaining >= 4 && state.money >= Math.round(baseCost * 10) && !state._fundEstablished,
      communityGrowth: true,
      tip: '新人基金是最高级别的社区投资——用金钱换取"圈子建设者"的永久标签。基金会持续吸引新创作者加入社群，但运营需要持续投入精力（每月闲暇永久-1天）。',
    },
  ];
}

// Whether an action needs the pricing flow before executing
export function needsPricing(state, actionId) {
  if (actionId === 'hvp' && state.hvpProject && state.hvpProject.progress + 1 >= state.hvpProject.needed) return true;
  return false;
}

// Roll event condition (cancelled / popular / normal) for a doujin event
export function rollEventCondition(event, isRecession) {
  const baseCancelChance = event.size === 'mega' ? 0.01 : event.size === 'big' ? 0.03 : 0.05;
  const cancelChance = isRecession ? baseCancelChance * 3 : baseCancelChance;
  const roll = Math.random();
  if (roll < cancelChance) return 'cancelled';
  return roll < 0.30 ? 'popular' : 'normal';
}

// Roll whether a partner candidate is busy this month
export function rollPartnerBusy(candidate) {
  const busyChance = candidate.tier === 'trusted' ? 0.05 : candidate.tier === 'familiar' ? 0.15 : 0.25;
  return Math.random() < busyChance;
}

// Freelance time cost depends on life situation and job tier
export function getFreelanceTimeCost(state) {
  if (state.unemployed || state.fullTimeDoujin) return 2;  // 失业/全职同人：时间多
  if (getLifeStage(state.turn) === 'university') return 3; // 学生：中等
  // 在职：按工种分化
  if (state.jobTier === 'elite') return 6;                 // 大厂加班多，几乎没时间接稿
  if (state.jobTier === 'labor') return 4;                 // 基层体力活，但时间相对固定
  return 5;                                               // 普通职员：下班后接稿
}

export function getTimeCost(state, actionId) {
  if (actionId === 'hvp') return state.hasPartner ? 2 : 4;
  if (actionId === 'lvp') return 4;
  if (actionId === 'rest') return state._restHours || 2; // player-selected, default 2
  if (actionId === 'promote_light') return 1;
  if (actionId === 'promote_heavy') return 3;
  if (actionId === 'findPartner') return 2;
  if (actionId === 'partTimeJob') return 3;
  if (actionId === 'freelance') {
    const baseTC = getFreelanceTimeCost(state);
    const ft = state._freelanceType || 'standard';
    return ft === 'quick' ? Math.max(1, baseTC - 1) : ft === 'premium' ? baseTC + 1 : baseTC;
  }
  if (actionId === 'attendEvent') return state._eventMode === 'consign' ? 0 : 3; // 亲参3天，寄售0天
  if (actionId === 'jobSearch') return Infinity;
  if (actionId === 'reprint') return 1;
  if (actionId === 'buyGoods') return 1;
  if (actionId === 'sellGoods') return 1;
  if (actionId === 'surfOnline') return 1;
  if (actionId === 'anthology') return 2;
  if (actionId === 'hireAssistant') return 1;
  // sponsorCommunity: time cost depends on selected tier
  if (actionId === 'sponsorCommunity') {
    const tierId = state._sponsorTier || 'basic';
    const tierTimeCosts = { basic: 0, workshop: 2, festival: 3, fund: 4 };
    return tierTimeCosts[tierId] || 0;
  }
  // 0-cost decisions: upgradeEquipment, quitForDoujin, goCommercial
  return 0;
}

export function canPerformAction(state, actionId) {
  const r = ACTIONS[actionId]?.requires;
  if (!r) return false;
  const remaining = state.time - (state.monthTimeSpent || 0);
  // No leisure left → all actions blocked (player must end month)
  if (remaining <= 0) return false;
  // Unemployed: time is plentiful but anxiety drains passion fast — all actions allowed
  // (the real constraint is passion budget, not action locks)
  // jobSearch: when unemployed OR full-time doujin (wanting to go back)
  if (actionId === 'jobSearch' && !state.unemployed && !state.fullTimeDoujin) return false;
  // quitForDoujin: work stage, not already full-time doujin, some experience
  // No rep/money gates — player bears the risk themselves
  if (actionId === 'quitForDoujin') {
    if (getLifeStage(state.turn) !== 'work' || state.fullTimeDoujin) return false;
    if (state.unemployed) {
      if ((state.eventLog?.length || 0) < 3) return false;
    } else {
      if ((state.eventLog?.length || 0) < 5) return false;
      // Cooldown: must work at least 12 months before quitting again (prevents frequent switching)
      if (state.lastReturnToWorkTurn > 0 && state.turn - state.lastReturnToWorkTurn < 12) return false;
    }
  }
  // partTimeJob: only students, unemployed, or full-time doujin
  if (actionId === 'partTimeJob') {
    const stage = getLifeStage(state.turn);
    if (stage === 'work' && !state.unemployed && !state.fullTimeDoujin) return false;
  }
  // attendEvent: need events available AND have inventory AND not all events attended this month
  if (actionId === 'attendEvent') {
    if (!state.availableEvents || state.availableEvents.length === 0) return false;
    if (state.inventory.hvpStock === 0 && state.inventory.lvpStock === 0) return false;
    const attended = state.eventsAttendedThisMonth || [];
    if (state.availableEvents.every(e => attended.includes(e.name))) return false;
  }
  // reprint: need at least one work in inventory (including sold-out qty=0)
  if (actionId === 'reprint') {
    if (!state.inventory.works || state.inventory.works.length === 0) return false;
  }
  // buyGoods: need money (minimum cost is ¥200)
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
  // findPartner: can't find a new partner if you already have one, or already tried this month
  // anthology: need rep>=4, >=3 familiar contacts, no existing anthology, and not already working HVP
  if (actionId === 'anthology') {
    if (state.reputation < 4) return false;
    if (state.hvpProject) return false; // can't run anthology + solo HVP simultaneously
    if (!state.anthologyProject) {
      const familiarCount = (state.contacts || []).filter(c => c.affinity >= 2).length;
      if (familiarCount < 3) return false;
    }
  }
  if (actionId === 'findPartner' && (state.hasPartner || state.findPartnerTriedThisMonth || !state.contacts?.length)) return false;
  if (actionId === 'surfOnline' && state.surfedThisMonth) return false;
  if (actionId === 'hvp' && state.hvpWorkedThisMonth) return false;
  if (actionId === 'lvp' && state.lvpWorkedThisMonth) return false;
  // Promote: only one promotion action per month (light OR heavy, not both)
  if ((actionId === 'promote_light' || actionId === 'promote_heavy') &&
      (state.monthActions || []).some(a => a.actionId === 'promote_light' || a.actionId === 'promote_heavy')) return false;
  // hireAssistant: need active HVP project, money, max 2 per project
  if (actionId === 'hireAssistant') {
    if (!state.hvpProject) return false;
    if (state.money < 800) return false;
    if ((state.hvpProject._assistantCount || 0) >= 2) return false;
  }
  // upgradeEquipment: not maxed (player bears financial risk)
  if (actionId === 'upgradeEquipment') {
    if (state.equipmentLevel >= 3) return false;
  }
  // sponsorCommunity: need money and cooldown (6 months)
  if (actionId === 'sponsorCommunity') {
    if (state.money < 1500) return false;
    if (state.turn - state.lastSponsorTurn < 6) return false;
  }
  if (r.passion && state.passion < r.passion) return false;
  // HVP: with partner, time requirement relaxed to 2h (partner shares workload)
  if (actionId === 'hvp' && state.hasPartner) {
    if (remaining < 2) return false;
    return true;
  }
  // Freelance: dynamic time requirement
  if (actionId === 'freelance') {
    if (remaining < getFreelanceTimeCost(state)) return false;
  } else if (actionId === 'attendEvent') {
    // Mode not yet chosen: allow if consign (0 days) is possible, i.e. remaining >= 1
    if (remaining < 1) return false;
  } else {
    if (r.time) {
      const tc = getTimeCost(state, actionId);
      if (!isFinite(tc)) {
        if (remaining < 1) return false;
      } else if (remaining < tc) return false;
    }
  }
  return true;
}
