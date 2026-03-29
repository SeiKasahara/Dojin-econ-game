import { getLifeStage, getAge, getCreativeSkill, getSkillEffects, getSkillLabel, addMoney, addReputation, getRealityDrain, applyPassionDecay, computeEffectiveTime } from './core.js';
import { HVP_SUBTYPES, LVP_SUBTYPES, PARTNER_TYPES, CHOICE_EFFECTS, applyCreativeChoice, getQualityStars, getWorkQualityEffects, syncInventoryAggregates, addContact } from './definitions.js';
import { ACTIONS, getTimeCost, getFreelanceTimeCost, getSponsorTiers } from './actions.js';
import { calculateSales, getSupplyDemandData, sellFromWorks, calculateFeedback } from './sales.js';
import { TIPS } from './tips.js';
import { BACKGROUNDS } from './state.js';
import { getCompetitionModifier, getMarketAvgPrice } from '../market.js';
import { getSecondHandModifier, recordPlayerWork } from '../official.js';
import { getAdvancedCostMod, getAdvancedSalesMod, getSignalCost } from '../advanced.js';
import { rollPartnerType, updateContactAffinity, getContactBio, getContactTier, getVisibleType } from '../partner.js';
import { getJournalMilestone, getCreativeJournal } from '../creative-journal.js';
import { resolveContract } from '../prediction-contracts.js';
import { endMonth } from './end-month.js';
import { ic, escapeHtml } from '../icons.js';
import { checkAchievements } from '../achievements.js';
import { generateCommercialEnding } from '../endings.js';

// === Execute Action (action-only, no month-end processing) ===
export function executeAction(state, actionId) {
  const action = ACTIONS[actionId];
  const result = { action: actionId, actionName: action.name, actionEmoji: action.emoji, deltas: [], salesInfo: null, supplyDemand: null, feedback: 0, tip: null, partnerDrama: null };

  // Cache timeCost BEFORE action logic (some actions consume _restHours etc.)
  let _cachedTimeCost = getTimeCost(state, actionId);

  // --- Show savings dip from last turn's event (only on first action of month) ---
  if (state.monthActions.length === 0 && state._pendingEventDip) {
    const d = state._pendingEventDip;
    result.deltas.push({ icon: 'money', label: `上月"${d.label}"导致挪用同人存款`, value: `-¥${d.amount}`, positive: false });
    state._pendingEventDip = null;
  }

  // --- Process action ---
  if (action.type === 'rest') {
    // Rest scales with hours invested (1h = minimal, full day = maximum)
    const restHours = state._restHours || 2;
    state._restHours = null; // consume
    const hourScale = restHours / 5; // 5h = 100% base, 1h = 20%, 10h = 200%
    // Rest effectiveness decays with years in the hobby
    const yearsIn = state.turn / 12;
    const basRestore = (15 + Math.floor(Math.random() * 10) + (state.endowments.stamina || 0) * 3) * hourScale;
    const fatigueMult = Math.max(0.45, 1 - yearsIn * 0.03);   // Y0=100%, Y3=91%, Y5=85%, Y10=70%, Y20=45%
    const restore = Math.max(2, Math.round(basRestore * fatigueMult));
    state.passion = Math.min(100, state.passion + restore);
    result.deltas.push({ icon: 'heart', label: `休息${restHours}天`, value: `热情+${restore}`, positive: true });
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
      result.deltas.push({ icon: 'lightbulb', label: '如果还有空的话...试试接稿、买制品、参展?', value: '', positive: false });
    }
    // Decay scales with √rep: high rep decays slowly (matches √ growth curve)
    const decay = 0.02 * Math.sqrt(state.reputation);
    state.reputation = Math.max(0, state.reputation - decay);
    if (decay > 0.01) result.deltas.push({ icon: 'star', label: '声誉自然衰减', value: `-${decay.toFixed(2)}`, positive: false });
    result.tip = TIPS.rest;

  } else if (action.type === 'promote') {
    const intensity = action.promoteIntensity || 'light';
    const passionCost = intensity === 'heavy' ? 8 : 3;
    state.passion -= passionCost;

    // Check for minigame result (heavy promote only)
    const mgResult = state._promoteMinigameResult;
    state._promoteMinigameResult = null;

    let rawGain, repBonus = 0;
    if (mgResult && intensity === 'heavy') {
      // Use minigame score (0.30-0.90 based on performance)
      rawGain = mgResult.infoGain;
      repBonus = mgResult.repBonus || 0;
    } else {
      // Default formula (light promote, or skipped heavy minigame)
      rawGain = intensity === 'heavy'
        ? 0.25 + Math.random() * 0.10   // skipped: 25-35%, below minigame average (~50-60%)
        : 0.12 + Math.random() * 0.12;  // light: 12-24%, always below heavy minigame floor (30%)
    }

    // Signal inflation (Spence): diminishes gain but never below a floor
    const sigCost = state.advanced ? getSignalCost(state.advanced) : 1.0;
    // Marketing bonus: skip if minigame played (already factored into cooldown reduction)
    const mktBonus = mgResult ? 1 : (1 + (state.endowments.marketing || 0) * 0.12);
    const scaledGain = rawGain * mktBonus / sigCost;
    const minGain = intensity === 'heavy' ? 0.12 : 0.05;
    const gain = Math.max(minGain, scaledGain);
    state.infoDisclosure = Math.min(1, state.infoDisclosure + gain);

    result.deltas.push({ icon: 'heart', label: '精力消耗', value: `-${passionCost}`, positive: false });
    result.deltas.push({ icon: 'megaphone', label: '信息透明度', value: `+${(gain * 100).toFixed(0)}% → ${(state.infoDisclosure * 100).toFixed(0)}%`, positive: true });

    if (mgResult) {
      result.deltas.push({ icon: 'chart-line-up', label: '宣发表现', value: `${mgResult.performance}分`, positive: mgResult.performance >= 50 });
      if (mgResult.trendHits > 0) result.deltas.push({ icon: 'fire', label: '热点命中', value: `×${mgResult.trendHits}`, positive: true });
      if (mgResult.trendMisses > 0) result.deltas.push({ icon: 'warning', label: '热点翻车', value: `×${mgResult.trendMisses}`, positive: false });
      if (mgResult.spamPenalties > 0) result.deltas.push({ icon: 'prohibit', label: '刷屏掉粉', value: `×${mgResult.spamPenalties}`, positive: false });
    }

    // Reputation bonus from engagement
    if (repBonus > 0) {
      const actualRep = addReputation(state, repBonus);
      result.deltas.push({ icon: 'star', label: '互动声誉', value: `+${actualRep.toFixed(2)}`, positive: true });
    }

    // 20% chance to gain a contact from online promotion
    if (mgResult && Math.random() < 0.2) {
      const c = addContact(state, { source: 'online', affinity: 0.5 });
      if (c) result.deltas.push({ icon: 'address-book', label: `${c.name}关注了你`, value: '网络人脉+1', positive: true });
    }

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
    // Mark as tried this month (one attempt per month)
    state.findPartnerTriedThisMonth = true;
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
      state.activeContactId = candidate.contactId || null;

      // If there's an ongoing HVP project, recalculate needed months with partner
      if (state.hvpProject) {
        const sub = HVP_SUBTYPES[state.hvpProject.subtype] || HVP_SUBTYPES.manga;
        const partnerNeeded = sub.monthsPartner;
        if (partnerNeeded < state.hvpProject.needed) {
          const oldNeeded = state.hvpProject.needed;
          // Don't reduce below current progress (already done work counts)
          state.hvpProject.needed = Math.max(Math.ceil(state.hvpProject.progress), partnerNeeded);
          if (state.hvpProject.needed < oldNeeded) {
            result.deltas.push({ icon: 'handshake', label: '搭档加入加速创作！', value: `工期 ${oldNeeded}月→${state.hvpProject.needed}月`, positive: true });
          }
        }
      }

      // Duration: trusted contacts get longer collaboration
      if (candidate.tier === 'trusted') {
        state.partnerTurns = pType === 'unreliable' ? (2 + Math.floor(Math.random() * 3)) : (4 + Math.floor(Math.random() * 4));
      } else {
        state.partnerTurns = pType === 'unreliable' ? (1 + Math.floor(Math.random() * 3)) : (3 + Math.floor(Math.random() * 4));
      }

      // Fee: trusted + supportive = 50% discount
      const isFree = Math.random() < 0.15;
      if (isFree) {
        state.partnerFee = 0;
      } else {
        const [fmin, fmax] = pt.feeRange;
        let fee = fmin + Math.floor(Math.random() * (fmax - fmin));
        if (candidate.tier === 'trusted' && pType === 'supportive') fee = Math.round(fee * 0.5);
        state.partnerFee = fee;
      }

      // Type reveal depends on visibility
      if (candidate.visibleType) {
        result.deltas.push({ icon: pt.emoji, label: `"${candidate.name}"是${pt.name}`, value: `${state.partnerTurns}回合`, positive: pType === 'supportive' });
      } else {
        result.deltas.push({ icon: pt.emoji, label: `"${candidate.name}"原来是${pt.name}！`, value: `${state.partnerTurns}回合`, positive: pType === 'supportive' });
        // Toxic revealed for first time → force contact to trusted tier
        if (pType === 'toxic' && candidate.contactId) {
          const c = (state.contacts || []).find(x => x.id === candidate.contactId);
          if (c && c.tier !== 'trusted') { c.tier = 'trusted'; c.affinity = Math.max(c.affinity, 4); c.bio = getContactBio('toxic', 'trusted', c.source); }
        }
      }
      if (isFree) {
        result.deltas.push({ icon: 'hand-heart', label: '人好！不要稿费', value: '免费合作', positive: true });
      } else {
        result.deltas.push({ icon: 'coins', label: '搭档稿费', value: `¥${state.partnerFee}/本`, positive: false });
      }
      if (candidate.tier === 'trusted') {
        result.deltas.push({ icon: 'users', label: '老朋友加成', value: `合作期${state.partnerTurns}月${pType === 'supportive' ? ' 稿费优惠' : ''}`, positive: true });
      }
      result.deltas.push({ icon: 'note-pencil', label: pt.desc, value: '', positive: false });
      result.tip = pType === 'toxic' ? TIPS.partnerToxic : pType === 'supportive' ? TIPS.partnerFound : TIPS.partnerRisk;
    } else {
      // No candidates or search failed
      result.deltas.push({ icon: 'handshake', label: '本次没找到合适的搭档', value: '', positive: false });
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
    addMoney(state, wage);
    state.timeDebuffs.push({ id: 'tired_work', reason: '打工疲惫', turnsLeft: 1, delta: -1 });
    result.deltas.push({ icon: 'barbell', label: '体力消耗', value: '下月闲暇-1天', positive: false });
    result.deltas.push({ icon: 'coins', label: '打工收入', value: `+¥${wage}`, positive: true });
    if (recessionCut < 1) result.deltas.push({ icon: 'trend-down', label: '经济下行压低工资', value: '-40%', positive: false });
    result.tip = TIPS.partTimeJob;

  } else if (action.type === 'freelance') {
    // Freelance with type selection: quick / standard / premium
    const fType = state._freelanceType || 'standard';
    state._freelanceType = null;

    // Type parameters: { incomeMult, passionCost, timeDelta, repRaw, skillExp, fatigue, label }
    const FREELANCE_TYPES = {
      quick:    { incomeMult: 0.40, passionCost: 2, timeDelta: -1, repRaw: 0,    skillExp: 0, fatigue: 0,   label: '快速小单' },
      standard: { incomeMult: 0.80, passionCost: 4, timeDelta: -2, repRaw: 0.02, skillExp: 0, fatigue: 0,   label: '标准同人稿' },
      premium:  { incomeMult: 1.20, passionCost: 7, timeDelta: -3, repRaw: 0.05, skillExp: 5, fatigue: 0.5, label: '高端约稿' },
    };
    const ft = FREELANCE_TYPES[fType] || FREELANCE_TYPES.standard;

    state.passion -= ft.passionCost;
    // Base income with √rep scaling, then apply type multiplier
    const base = 200, repBonus = Math.floor(Math.sqrt(state.reputation) * 600);
    const rawIncome = Math.min(3500, Math.floor((base + repBonus + Math.floor(Math.random() * 150)) * ft.incomeMult));
    const recessionCut = state.recessionTurnsLeft > 0 ? 0.5 : 1.0;
    const income = Math.floor(rawIncome * recessionCut);
    addMoney(state, income);
    const repGain = ft.repRaw > 0 ? addReputation(state, ft.repRaw) : 0;
    state.timeDebuffs.push({ id: 'tired_freelance', reason: '接稿疲惫', turnsLeft: 1, delta: ft.timeDelta });
    if (ft.skillExp > 0) {
      const talentMult = 1 + (state.endowments.talent || 0) * 0.35;
      state.skillExp = (state.skillExp || 0) + Math.round(ft.skillExp * talentMult);
    }
    if (ft.fatigue > 0) state.creativeFatigue = (state.creativeFatigue || 0) + ft.fatigue;

    result.deltas.push({ icon: 'paint-brush', label: ft.label, value: '', positive: true });
    result.deltas.push({ icon: 'heart', label: '创作精力', value: `-${ft.passionCost}`, positive: false });
    result.deltas.push({ icon: 'barbell', label: '体力消耗', value: `下月闲暇${ft.timeDelta}天`, positive: false });
    result.deltas.push({ icon: 'coins', label: '接稿收入', value: `+¥${income}`, positive: true });
    if (recessionCut < 1) result.deltas.push({ icon: 'trend-down', label: '经济下行需求萎缩', value: '-50%', positive: false });
    if (repGain > 0) result.deltas.push({ icon: 'star', label: '商业声誉', value: `+${repGain.toFixed(2)}`, positive: true });
    if (ft.skillExp > 0) result.deltas.push({ icon: 'palette', label: '商业锻炼', value: `技艺经验+${ft.skillExp}`, positive: true });
    if (ft.fatigue > 0) result.deltas.push({ icon: 'smiley-sad', label: '高强度消耗', value: `创作疲劳+${ft.fatigue}`, positive: false });
    result.tip = fType === 'premium' ? { label: '高端约稿', text: '高端商业企划报酬丰厚，但会消耗大量创作精力。获得的技艺经验和声誉是对"跨界锻炼"的回报——商业嗅觉和同人创作是相通的。' }
      : state.reputation >= 3 ? TIPS.freelanceHigh : TIPS.freelanceLow;

  } else if (action.type === 'attendEvent') {
    // === ATTEND DOUJIN EVENT — now sells directly from inventory ===
    const evt = state.attendingEvent || (state.availableEvents && state.availableEvents[0]);
    if (evt) {

      // Track attendance immediately (before handler nullifies state.attendingEvent)
      if (!state.eventsAttendedThisMonth) state.eventsAttendedThisMonth = [];
      if (!state.eventsAttendedThisMonth.includes(evt.name)) {
        state.eventsAttendedThisMonth.push(evt.name);
      }
      // Track in calendar for year-view gray-out
      if (evt.calendarId != null) {
        if (!state.calendarEventsAttended) state.calendarEventsAttended = [];
        if (!state.calendarEventsAttended.includes(evt.calendarId)) {
          state.calendarEventsAttended.push(evt.calendarId);
        }
      }

      // Read and consume mode/minigame state BEFORE branching (shared by cancelled + normal paths)
      const mode = state._eventMode || 'attend';
      state._eventMode = null;

      const isAttend = mode === 'attend';
      const mg = isAttend ? state._minigameResult : null;
      state._minigameResult = null;

      // --- Event cancelled (流展) ---
      if (evt.condition === 'cancelled') {
        if (isAttend) {
          const cancelLodging = Math.round(evt.travelCost * 1.2 + 200);
          addMoney(state, -(evt.travelCost + cancelLodging));
          state.passion = Math.max(0, state.passion - 5);
          result.deltas.push({ icon: 'smiley-x-eyes', label: `${evt.name}@${evt.city} 流展！`, value: '白跑一趟', positive: false });
          result.deltas.push({ icon: 'coins', label: '路费+住宿（沉没成本）', value: `-¥${evt.travelCost + cancelLodging}`, positive: false });
          result.deltas.push({ icon: 'heart', label: '白忙一场的沮丧', value: '-5', positive: false });
        } else {
          // 寄售流展：货还在手里，只损失邮费（含货物运费，来回双程）
          const shipWeightKg = state.inventory.hvpStock * 0.2 + state.inventory.lvpStock * 0.08;
          const shipPerKg = evt.city === '本市' ? 2 : evt.city === '邻市' ? 5 : evt.city === '异地' ? 18 : 10;
          const shipFirstFee = evt.city === '本市' ? 10 : evt.city === '邻市' ? 15 : evt.city === '异地' ? 22 : 20;
          const shipCost = Math.round(shipFirstFee + shipWeightKg * shipPerKg);
          addMoney(state, -shipCost);
          state.passion = Math.max(0, state.passion - 1);
          result.deltas.push({ icon: 'package', label: `${evt.name}@${evt.city} 流展！`, value: '寄售取消，货物退回', positive: false });
          result.deltas.push({ icon: 'coins', label: '邮费（沉没成本）', value: `-¥${shipCost}`, positive: false });
          result.deltas.push({ icon: 'heart', label: '小遗憾', value: '-1', positive: false });
        }
        state.attendingEvent = null;
        _cachedTimeCost = 0; // 流展不消耗闲暇时间
        result.tip = { label: '流展风险', text: '展会因故取消是同人创作者面临的真实风险。路费变成沉没成本，无法追回。经济学告诉我们：不要因为已经花了路费就做出非理性决策——关键是接下来怎么安排。' };
        // Skip all selling logic below
      } else {

      // Lodging + meals + booth fee for 亲参 (scales with travel distance)
      // Local: minimal, distant: 2 nights hotel + meals + booth
      const lodgingCost = isAttend ? Math.round(evt.travelCost * 1.2 + 200) : 0; // ~¥260(本市) to ~¥1640(异地)

      // Fatigue only applies to 亲参 — consecutive attending drains harder
      let eventFatigue = 1.0;
      let fatigueDrain = 0;
      if (isAttend) {
        state.recentEventTurns.push(state.turn);
        const recentCount = state.recentEventTurns.filter(t => state.turn - t < 6).length;
        // High resilience reduces fatigue buildup: each point widens the curve
        const res = state.endowments.resilience || 0;
        const fatigueRate = Math.max(0.08, 0.15 - res * 0.02); // res0=0.15, res1=0.13, res3=0.09
        const fatigueFloor = Math.max(0.25, 0.40 - res * 0.05); // res0=0.40, res1=0.35, res3=0.25
        eventFatigue = recentCount <= 1 ? 1.0 : Math.max(fatigueFloor, 1.0 - (recentCount - 1) * fatigueRate);
        // Extra passion drain: resilience delays onset and reduces amount
        const drainStart = 4 + Math.floor(res / 2); // res0→4th, res2→5th, res3→5th
        if (recentCount >= drainStart) fatigueDrain = Math.max(1, (recentCount - drainStart + 1) * Math.max(1, 4 - res)); // res0: 4/8, res3: 1/2
      }

      // Logistics cost: personally carrying to the venue
      // Estimate weight: HVP ~0.2kg/item, LVP ~0.08kg/item
      // First ~15kg free (fits in suitcase, ~60 HVP or ~180 LVP)
      // Excess shipped separately: tiered by distance (based on SF Express rates)
      const carryWeightKg = state.inventory.hvpStock * 0.2 + state.inventory.lvpStock * 0.08;
      const freeCarryKg = 15; // one suitcase worth
      let cargoCost = 0;
      if (carryWeightKg > freeCarryKg) {
        const excessKg = carryWeightKg - freeCarryKg;
        // Tiered rate: 同城2/kg, 邻市5/kg, 省会~一线8/kg, 异地14/kg (approximating SF Express)
        const perKg = evt.city === '本市' ? 2 : evt.city === '邻市' ? 5 : evt.city === '异地' ? 14 : 8;
        const firstWeightFee = evt.city === '本市' ? 10 : evt.city === '邻市' ? 12 : evt.city === '异地' ? 22 : 18;
        cargoCost = Math.round(firstWeightFee + excessKg * perKg);
      }

      if (isAttend && mg) {
        // === 亲参 with minigame ===
        state.consecutiveConsigns = 0; // reset on attend
        state.passion -= 5;
        addMoney(state, -(evt.travelCost + lodgingCost + cargoCost + mg.moneySpent));
        const fatiguePassion = Math.round(mg.passionDelta * eventFatigue);
        state.passion = Math.min(100, state.passion + fatiguePassion);
        addReputation(state, mg.reputationDelta);
        state.maxReputation = Math.max(state.maxReputation, state.reputation);
        const attendBoost = Math.round(evt.salesBoost * mg.salesMultiplier * 10) / 10;
        state.attendingEvent = { ...evt, salesBoost: attendBoost };

        result.deltas.push({ icon: 'storefront', label: `亲参 ${evt.name}@${evt.city}`, value: `表现${mg.performance}分 销量×${attendBoost}`, positive: mg.performance >= 50 });
        result.deltas.push({ icon: 'coins', label: '路费+住宿餐饮+摊位' + (cargoCost > 0 ? '+搬运' : '') + (mg.moneySpent > 0 ? '+无料' : ''), value: `-¥${evt.travelCost + lodgingCost + cargoCost + mg.moneySpent}`, positive: false });
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
        addMoney(state, -(evt.travelCost + lodgingCost + cargoCost));
        const fatigueBoost = Math.round(evt.passionBoost * eventFatigue);
        state.passion = Math.min(100, state.passion + fatigueBoost);
        addReputation(state, evt.reputationBoost);
        state.maxReputation = Math.max(state.maxReputation, state.reputation);
        state.attendingEvent = evt;
        result.deltas.push({ icon: 'storefront', label: `亲参 ${evt.name}@${evt.city}`, value: '(快速结算)', positive: true });
        result.deltas.push({ icon: 'coins', label: '路费+住宿餐饮+摊位' + (cargoCost > 0 ? '+搬运' : ''), value: `-¥${evt.travelCost + lodgingCost + cargoCost}`, positive: false });
        if (fatigueDrain > 0) {
          state.passion -= fatigueDrain;
          result.deltas.push({ icon: 'battery-medium', label: '连续参展身心俱疲', value: `热情-${fatigueDrain}`, positive: false });
        }
      } else {
        // === 寄售 (consignment) ===
        state.consecutiveConsigns++;
        // Shipping cost: realistic courier rates (no free tier — everything must be shipped)
        // Weight: HVP ~0.2kg, LVP ~0.08kg. SF Express-style tiered pricing.
        const shipWeightKg = state.inventory.hvpStock * 0.2 + state.inventory.lvpStock * 0.08;
        const shipPerKg = evt.city === '本市' ? 2 : evt.city === '邻市' ? 5 : evt.city === '异地' ? 18 : 10;
        const shipFirstFee = evt.city === '本市' ? 10 : evt.city === '邻市' ? 15 : evt.city === '异地' ? 22 : 20;
        const shipCost = Math.round(shipFirstFee + shipWeightKg * shipPerKg);
        state.passion -= 2;
        addMoney(state, -shipCost);
        const consignDiscount = 0.55; // consignment agent takes a cut + less engagement
        // Random variance: not being there means less control (0.7~0.95)
        const consignRNG = 0.7 + Math.random() * 0.25;
        const consignBoost = Math.round(evt.salesBoost * consignDiscount * consignRNG * 10) / 10;
        state.attendingEvent = { ...evt, salesBoost: consignBoost };
        const rngPct = Math.round(consignRNG * 100);
        result.deltas.push({ icon: 'package', label: `寄售 ${evt.name}@${evt.city}`, value: `委托代售 销量×${consignBoost}`, positive: true });
        if (rngPct < 85) result.deltas.push({ icon: 'shuffle', label: '代理摆摊状态一般', value: `发挥${rngPct}%`, positive: false });
        result.deltas.push({ icon: 'coins', label: '邮寄费用', value: `-¥${shipCost}`, positive: false });

        // --- Consignment agent mishap: flat 12% each time (normal probability event) ---
        if (Math.random() < 0.12) {
          const roll = Math.random();
          if (roll < 0.45) {
            // 代理粗心：丢失少量库存
            const lostHVP = Math.min(state.inventory.hvpStock, Math.ceil(Math.random() * 1));
            const lostLVP = Math.min(state.inventory.lvpStock, Math.ceil(Math.random() * 2));
            state.inventory.hvpStock -= lostHVP;
            state.inventory.lvpStock -= lostLVP;
            state.passion = Math.max(0, state.passion - 3);
            result.deltas.push({ icon: 'smiley-x-eyes', label: '代理弄丢了部分库存', value: `本-${lostHVP} 谷-${lostLVP} 热情-3`, positive: false });
          } else if (roll < 0.80) {
            // 代理漏算：少收了一些钱
            const skimRate = 0.10 + Math.random() * 0.10; // 10-20%
            state.attendingEvent = { ...evt, salesBoost: consignBoost * (1 - skimRate) };
            state.passion = Math.max(0, state.passion - 2);
            result.deltas.push({ icon: 'money', label: '代理漏算了部分货款', value: `收入-${Math.round(skimRate * 100)}% 热情-2`, positive: false });
          } else {
            // 代理态度差引发纠纷，传出去影响口碑
            const repLoss = Math.min(0.3, state.reputation * 0.03);
            state.passion = Math.max(0, state.passion - 4);
            state.reputation = Math.max(0, state.reputation - repLoss);
            result.deltas.push({ icon: 'chat-circle', label: '和代理发生纠纷', value: `热情-4 声誉-${repLoss.toFixed(2)}`, positive: false });
          }
        }
      }

      // === SELL FROM INVENTORY AT EVENT ===
      let eventRevenue = 0;
      let totalEventSold = 0;

      if (isAttend && mg && mg.sold > 0) {
        // 亲参: minigame sold count (CES floor already baked into per-customer baseBuyQty)
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
            result.salesDetails = (result.salesDetails || []).concat(hvpResult.details);
            result.deltas.push({ icon: 'book-open-text', label: `同人本售出 ${hvpResult.sold}本`, value: `+¥${hvpResult.revenue}`, positive: true });
            addReputation(state, 0.08 * state.infoDisclosure * hvpResult.sold * 0.05);
            state.maxReputation = Math.max(state.maxReputation, state.reputation);
            if (state.official) recordPlayerWork(state.official, 'hvp', state.turn, state.reputation, hvpResult.sold);
          }
          if (lvpSold > 0) {
            const lvpResult = sellFromWorks(state, 'lvp', lvpSold);
            eventRevenue += lvpResult.revenue;
            totalEventSold += lvpResult.sold;
            state.totalSales += lvpResult.sold;
            result.salesDetails = (result.salesDetails || []).concat(lvpResult.details);
            result.deltas.push({ icon: 'key', label: `同人制品售出 ${lvpResult.sold}个`, value: `+¥${lvpResult.revenue}`, positive: true });
            addReputation(state, 0.01 * state.infoDisclosure * lvpResult.sold * 0.05);
            state.maxReputation = Math.max(state.maxReputation, state.reputation);
            if (state.official) recordPlayerWork(state.official, 'lvp', state.turn, state.reputation, lvpResult.sold);
          }
        }
      } else {
        // 寄售 or 亲参快速结算: use CES model
        if (state.inventory.hvpStock > 0) {
          state.playerPrice.hvp = state.inventory.hvpPrice;
          const sales = calculateSales('hvp', state);
          const hvpResult = sellFromWorks(state, 'hvp', sales.hvpSales);
          eventRevenue += hvpResult.revenue;
          totalEventSold += hvpResult.sold;
          state.totalSales += hvpResult.sold;
          result.salesInfo = sales;
          result.salesDetails = (result.salesDetails || []).concat(hvpResult.details);
          result.supplyDemand = getSupplyDemandData(state, sales);
          result.deltas.push({ icon: 'book-open-text', label: `同人本售出 ${hvpResult.sold}本`, value: `+¥${hvpResult.revenue}`, positive: true });
          if (sales.hvpSales > hvpResult.sold) result.deltas.push({ icon: 'fire', label: '同人本售罄！', value: `需求${sales.hvpSales}·库存仅${hvpResult.sold}`, positive: false });
          addReputation(state, 0.08 * state.infoDisclosure * hvpResult.sold * 0.05);
          state.maxReputation = Math.max(state.maxReputation, state.reputation);
          if (state.official) recordPlayerWork(state.official, 'hvp', state.turn, state.reputation, hvpResult.sold);
        }
        if (state.inventory.lvpStock > 0) {
          state.playerPrice.lvp = state.inventory.lvpPrice;
          const sales = calculateSales('lvp', state);
          const lvpResult = sellFromWorks(state, 'lvp', sales.lvpSales);
          eventRevenue += lvpResult.revenue;
          totalEventSold += lvpResult.sold;
          state.totalSales += lvpResult.sold;
          if (!result.salesInfo) { result.salesInfo = sales; result.supplyDemand = getSupplyDemandData(state, sales); }
          result.salesDetails = (result.salesDetails || []).concat(lvpResult.details);
          result.deltas.push({ icon: 'key', label: `同人制品售出 ${lvpResult.sold}个`, value: `+¥${lvpResult.revenue}`, positive: true });
          if (sales.lvpSales > lvpResult.sold) result.deltas.push({ icon: 'fire', label: '同人制品售罄！', value: `需求${sales.lvpSales}·库存仅${lvpResult.sold}`, positive: false });
          addReputation(state, 0.01 * state.infoDisclosure * lvpResult.sold * 0.05);
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

      addMoney(state, eventRevenue);
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

      // Convert minigame card exchanges to contacts
      if (isAttend && mg && mg.cardsExchanged > 0) {
        const newContacts = Math.min(mg.cardsExchanged, 3);
        for (let i = 0; i < newContacts; i++) {
          const c = addContact(state, { source: 'event_card', affinity: 1.0 });
          if (c) result.deltas.push({ icon: 'address-book', label: `认识了${c.name}`, value: '加入人脉池', positive: true });
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
    // Frequent doujin switchers have harder time finding jobs (HR dislikes job-hopping)
    const switchMalus = Math.min(0.3, ((state.doujinQuitCount || 0) - 1) * 0.1); // 0, 0.1, 0.2, 0.3
    const baseProb = Math.max(0.05, 0.3 - switchMalus) + state.jobSearchTurns * 0.1;
    const findProb = Math.min(0.85, state.recessionTurnsLeft > 0 ? baseProb * 0.5 : baseProb);
    if (Math.random() < findProb) {
      state.unemployed = false;
      state.jobSearchTurns = 0;
      state.lastReturnToWorkTurn = state.turn; // record for cooldown gate
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
      const hvpWorkName = state._hvpWorkName || null;
      state._hvpWorkName = null;
      state.hvpProject = { progress: 1, needed, printCost, subtype: subtypeId, workQuality: 1.0, styleTag: null, choices: [], isCultHit: false, _qualityLog: [], name: hvpWorkName };

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
      // Continue project (all creative choices already made at start)
      // Legacy support: apply any pending choices from old saves
      if (state._pendingChoices) {
        for (const c of state._pendingChoices) applyCreativeChoice(state.hvpProject, c.category, c.optionId);
        if (state.hvpProject._extraPassionCost) {
          state.passion -= state.hvpProject._extraPassionCost;
          state.hvpProject._extraPassionCost = 0;
        }
        state._pendingChoices = null;
      }

      // Creative journal: flavor text each month
      const ratio = state.hvpProject.progress / state.hvpProject.needed;
      if (ratio >= 0.45 && ratio < 0.6 && state.hvpProject.progress > 1) {
        result.deltas.push({ icon: 'flag-pennant', label: '创作手记', value: getJournalMilestone(state.hvpProject), positive: true });
      } else {
        const entries = getCreativeJournal(state.hvpProject, state.hasPartner);
        for (const e of entries) {
          result.deltas.push({ icon: 'note-pencil', label: '创作手记', value: e, positive: true });
        }
      }
      result.deltas.push({ icon: 'star', label: '当前质量', value: getQualityStars(state.hvpProject.workQuality), positive: state.hvpProject.workQuality >= 1.0 });

      // Work stage: creative efficiency reduced (fatigue after day job)
      let progressEff = getLifeStage(state.turn) === 'work' && !state.unemployed && !state.fullTimeDoujin ? 0.7 : 1.0;
      // Creative fatigue efficiency penalty
      if (state.creativeFatigue >= 3) {
        progressEff *= 0.85;
        result.deltas.push({ icon: 'battery-medium', label: '创作疲劳拖慢进度', value: `效率×0.85`, positive: false });
      }
      state.hvpProject.progress = Math.round((state.hvpProject.progress + progressEff) * 100) / 100;
      if (getLifeStage(state.turn) === 'work' && !state.unemployed && !state.fullTimeDoujin) {
        result.deltas.push({ icon: 'smiley-sad', label: '下班后创作效率降低', value: '进度×0.7', positive: false });
      }
      const p = state.hvpProject;
      if (p.progress >= p.needed) {
        // === HVP COMPLETE → ADD TO INVENTORY ===
        if (!p._qualityLog) p._qualityLog = [];
        // Creative fatigue: completing a full work is exhausting
        state.creativeFatigue += 2;
        // Quality penalty from fatigue
        if (state.creativeFatigue >= 5) {
          const fatiguePenalty = p.workQuality * 0.15;
          p.workQuality *= 0.85;
          p._qualityLog.push({ label: '创作疲劳', delta: -fatiguePenalty });
        }
        // Equipment quality bonus
        if (state.equipmentLevel > 0) {
          const eqBonus = state.equipmentLevel * 0.08;
          p.workQuality += eqBonus;
          p._qualityLog.push({ label: '设备加成', delta: eqBonus });
        }
        // Time debuff from fatigue
        if (state.creativeFatigue >= 4) {
          state.timeDebuffs.push({ id: 'creative_exhaust_' + state.turn, reason: '创作透支', turnsLeft: 2, delta: -1 });
          result.deltas.push({ icon: 'battery-medium', label: '连续创作身体吃不消', value: '时间-1天(2回合)', positive: false });
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
        addMoney(state, -totalCost);

        // Calculate batch size and add to inventory
        const batchQty = Math.max(20, Math.round(printCost / 50));
        const hvpPrice = state.playerPrice.hvp || 50;
        state.inventory.hvpPrice = hvpPrice;
        // Add to works array
        const subInfo = HVP_SUBTYPES[savedProject.subtype] || HVP_SUBTYPES.manga;
        state.inventory.works.push({
          id: state.inventory.nextWorkId++,
          type: 'hvp', subtype: savedProject.subtype || 'manga',
          name: savedProject.name || null,
          qty: batchQty, price: hvpPrice,
          workQuality: savedProject.workQuality || 1.0,
          styleTag: savedProject.styleTag || null,
          isCultHit: savedProject.isCultHit || false,
          turn: state.turn,
          totalSold: 0,
        });
        state.inventory.hvpStock += batchQty;
        syncInventoryAggregates(state);

        result.deltas.push({ icon: subInfo.emoji, label: `${subInfo.name}完成！`, value: '', positive: true });

        // Quality breakdown
        const finalQ = savedProject.workQuality;
        result.deltas.push({ icon: 'star', label: `作品质量 ${getQualityStars(finalQ)}`, value: `${finalQ.toFixed(2)}`, positive: finalQ >= 1.0 });
        if (savedProject._qualityLog?.length) {
          const breakdown = savedProject._qualityLog
            .filter(l => Math.abs(l.delta) > 0.001 || l.special)
            .map(l => {
              if (l.special) return `  ${l.label}`;
              const sign = l.delta > 0 ? '+' : '';
              return `  ${l.label} ${sign}${l.delta.toFixed(2)}`;
            }).join('\n');
          if (breakdown) result.deltas.push({ icon: 'list-dashes', label: '质量拆解', value: breakdown, positive: true });
        }
        if (savedProject.isCultHit) {
          result.deltas.push({ icon: 'shooting-star', label: 'Cult经典！', value: '小众但狂热的粉丝群体', positive: true });
        }

        const costLabels = [];
        if (costMult > 1) costLabels.push('下行+20%');
        if (fx.costReduction > 0.01) costLabels.push(`熟练-${Math.round(fx.costReduction * 100)}%`);
        result.deltas.push({ icon: 'printer', label: `印刷成本${costLabels.length ? '(' + costLabels.join(' ') + ')' : ''}`, value: `-¥${printCost}`, positive: false });
        if (partnerCost > 0) result.deltas.push({ icon: 'handshake', label: '搭档稿费', value: `-¥${partnerCost}`, positive: false });
        result.deltas.push({ icon: 'package', label: `${subInfo.name}${savedProject.name ? '·' + savedProject.name : ''} ×${batchQty}入库`, value: `库存${state.inventory.hvpStock}本 定价¥${state.inventory.hvpPrice}`, positive: true });

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
          addReputation(state, 0.1);
        } else if (strategy === 'digital') {
          // 同时发电子版：内容效用被低成本满足，投机买家减少
          // 标记该作品有电子版，每月产生被动收入
          if (state.official) state.official.secondHandPool.hvp = Math.floor(state.official.secondHandPool.hvp * 0.8);
          const newWork = state.inventory.works[state.inventory.works.length - 1];
          if (newWork) newWork.hasDigital = true;
          const digiPrice = Math.round(state.inventory.hvpPrice * 0.35); // 电子版定价约实体的35%
          result.deltas.push({ icon: 'phone', label: '同步电子版上架', value: `电子版定价¥${digiPrice} 每月产生被动收入`, positive: true });
        }

        // Reputation gain — base floor + info-scaled + skill
        // Absurd pricing penalty: gouging damages reputation
        const mktAvg = state.market ? getMarketAvgPrice(state.market, state, 'hvp') : 50;
        const priceRatio = hvpPrice / Math.max(1, mktAvg);
        let pricingRepMod = 1.0;
        if (priceRatio > 2.0) {
          // Overpriced: reputation hit instead of gain
          const penalty = Math.min(0.3, (priceRatio - 2.0) * 0.1);
          addReputation(state, -penalty);
          result.deltas.push({ icon: 'trend-down', label: '定价过高引发争议', value: `声誉-${penalty.toFixed(2)}`, positive: false });
          pricingRepMod = 0;
        } else if (priceRatio > 1.5) {
          pricingRepMod = 0.5; // reduced rep gain
          result.deltas.push({ icon: 'smiley-meh', label: '定价偏高，口碑打了折扣', value: '', positive: false });
        }
        const repGain = addReputation(state, (0.04 + 0.08 * state.infoDisclosure) * (1 + (state.endowments.talent || 0) * 0.10) * fx.repBonus * pricingRepMod);
        state.maxReputation = Math.max(state.maxReputation, state.reputation);
        result.deltas.push({ icon: 'star', label: '新作声誉', value: `+${repGain.toFixed(2)}`, positive: repGain > 0 });

        // Community feedback (people know you released something new)
        const feedback = calculateFeedback(state);
        state.passion = Math.min(100, state.passion + feedback);
        result.deltas.push({ icon: 'chat-circle', label: '社群反馈', value: `热情+${feedback.toFixed(1)}`, positive: feedback > 0 });

        state.totalHVP++;

        // Breakthrough chance — skill makes occasional masterpieces possible
        let wasBreakthrough = false;
        if (Math.random() < fx.breakthroughChance) {
          wasBreakthrough = true;
          const bkRepRaw = 0.3 + skill * 0.1;
          const bkRep = addReputation(state, bkRepRaw);
          const bkPassion = 10 + Math.round(skill * 2);
          state.maxReputation = Math.max(state.maxReputation, state.reputation);
          state.passion = Math.min(100, state.passion + bkPassion);
          result.deltas.push({ icon: 'sparkle', label: '突破之作！质量超出预期', value: `声誉+${bkRep.toFixed(2)} 热情+${bkPassion}`, positive: true });
          result.tip = { label: `${ic('sparkle')} 学习曲线突破`, text: `累计创作${state.totalHVP}本同人志，你的技艺已达到${getSkillLabel(skill)}级（${skill.toFixed(1)}）。学习曲线理论预测：累计产出越多，生产效率越高、品质越稳定。偶尔的突破之作是量变引发质变的证明——这就是为什么"坚持创作"比"等灵感来"更靠谱。` };
        } else {
          result.tip = TIPS.hvpComplete;
        }

        // Skill experience: quality-weighted, talent-scaled
        const hvpExpBase = 10 * Math.pow(savedProject.workQuality || 1, 1.5);
        const hvpExpTalent = 1 + (state.endowments.talent || 0) * 0.35;
        state.skillExp = (state.skillExp || 0) + (hvpExpBase + (wasBreakthrough ? 15 : 0)) * hvpExpTalent;
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
    addMoney(state, -actualCost);
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
    const lvpWorkName = state._lvpWorkName || null;
    state._lvpWorkName = null;
    state.inventory.works.push({
      id: state.inventory.nextWorkId++,
      type: 'lvp', subtype: subtypeId,
      name: lvpWorkName,
      qty: batchQty, price: lvpPrice,
      workQuality: lvpQuality,
      styleTag: null, isCultHit: false,
      turn: state.turn,
      totalSold: 0,
    });
    state.inventory.lvpStock += batchQty;
    syncInventoryAggregates(state);

    result.deltas.push({ icon: sub.emoji, label: `${sub.name}${lvpWorkName ? '·' + lvpWorkName : ''} ×${batchQty}入库`, value: `库存${state.inventory.lvpStock}个 定价¥${lvpPrice}`, positive: true });

    state.totalLVP++;
    state.recentLVP = 1;

    // Reputation gain — with pricing penalty for absurd prices
    const lvpMktAvg = state.market ? getMarketAvgPrice(state.market, state, 'lvp') : 15;
    const lvpPriceRatio = lvpPrice / Math.max(1, lvpMktAvg);
    let lvpPricingMod = 1.0;
    if (lvpPriceRatio > 2.0) {
      const penalty = Math.min(0.15, (lvpPriceRatio - 2.0) * 0.05);
      addReputation(state, -penalty);
      result.deltas.push({ icon: 'trend-down', label: '定价过高引发争议', value: `声誉-${penalty.toFixed(2)}`, positive: false });
      lvpPricingMod = 0;
    } else if (lvpPriceRatio > 1.5) {
      lvpPricingMod = 0.5;
      result.deltas.push({ icon: 'smiley-meh', label: '定价偏高，口碑打了折扣', value: '', positive: false });
    }
    const repGain = addReputation(state, (0.01 + 0.02 * state.infoDisclosure) * (1 + (state.endowments.talent || 0) * 0.10) * fx.repBonus * lvpPricingMod);
    state.maxReputation = Math.max(state.maxReputation, state.reputation);
    result.deltas.push({ icon: 'star', label: '新品声誉', value: `+${repGain.toFixed(2)}`, positive: repGain > 0 });

    // Community feedback
    const feedback = calculateFeedback(state);
    state.passion = Math.min(100, state.passion + feedback);
    result.deltas.push({ icon: 'chat-circle', label: '社群反馈', value: `热情+${feedback.toFixed(1)}`, positive: feedback > 0 });

    // LVP breakthrough (rarer than HVP, half chance)
    let lvpBreakthrough = false;
    if (Math.random() < fx.breakthroughChance * 0.5) {
      lvpBreakthrough = true;
      const bkRep = addReputation(state, 0.15 + skill * 0.05);
      const bkPassion = 6 + Math.round(skill);
      state.maxReputation = Math.max(state.maxReputation, state.reputation);
      state.passion = Math.min(100, state.passion + bkPassion);
      result.deltas.push({ icon: 'sparkle', label: '精品谷子！超出预期的品质', value: `声誉+${bkRep.toFixed(1)} 热情+${bkPassion}`, positive: true });
    }

    // Skill experience: quality-weighted, talent-scaled
    const lvpExpBase = 3 * Math.pow(lvpQuality || 1, 1.5);
    const lvpExpTalent = 1 + (state.endowments.talent || 0) * 0.35;
    state.skillExp = (state.skillExp || 0) + (lvpExpBase + (lvpBreakthrough ? 5 : 0)) * lvpExpTalent;

    result.tip = TIPS.lvp;

  } else if (action.type === 'reprint') {
    // === REPRINT: multi-work with per-work custom quantity ===
    const orders = state._reprintOrders || [];
    state._reprintOrders = null;

    if (orders.length === 0) {
      result.deltas.push({ icon: 'warning', label: '没有选择追印的作品', value: '', positive: false });
    } else {
      state.passion -= 3;
      result.deltas.push({ icon: 'heart', label: '安排印刷', value: '-3', positive: false });

      let totalReprintCost = 0;
      for (const order of orders) {
        const work = state.inventory.works.find(w => w.id === order.id);
        if (!work) continue;
        const qty = order.qty;
        const isHVP = work.type === 'hvp';
        const sub = isHVP ? (HVP_SUBTYPES[work.subtype] || HVP_SUBTYPES.manga) : (LVP_SUBTYPES[work.subtype] || LVP_SUBTYPES.acrylic);
        const unitCost = isHVP ? 20 : 6;
        const cost = qty * unitCost;
        addMoney(state, -cost);
        totalReprintCost += cost;
        if (work.isRareWork) {
          work.isRareWork = false;
          state.reprintCrashTurn = state.turn + 2 + Math.floor(Math.random() * 3);
          state.reprintCrashWorkName = sub.name + (work.name ? '·' + escapeHtml(work.name) : '');
        }
        work.qty += qty;
        work.soldOutSinceTurn = null;
        work.reprintCount = (work.reprintCount || 0) + 1;
        result.deltas.push({ icon: 'printer', label: `追印${sub.name}${work.name ? '·' + escapeHtml(work.name) : ''} +${qty}`, value: `-¥${cost}`, positive: false });
      }
      syncInventoryAggregates(state);
      if (totalReprintCost > 0) {
        result.deltas.push({ icon: 'package', label: '追印完成', value: `总计-¥${totalReprintCost}`, positive: true });
      }
    }
    result.tip = { label: '库存管理', text: '追加印刷的单价比首印便宜（印版/模具已有）。关键是预判展会需求——印太多积压资金，印太少展会上售罄错失收入。' };

  } else if (action.type === 'buyGoods') {
    // === BUY GOODS AS CONSUMER: cost scales with wealth, passion diminishes over years ===
    const m = Math.max(0, state.money);
    const cost = m < 3000 ? 200 : m < 6000 ? 600 : m < 9000 ? 1500 : m < 15000 ? 3000 : 5000;
    addMoney(state, -cost);
    result.deltas.push({ icon: 'coins', label: `购买谷子${cost > 200 ? '(眼光变高了)' : ''}`, value: `-¥${cost}`, positive: false });

    // Passion gain diminishes over years (novelty wears off)
    const yearsIn = state.turn / 12;
    const eff = Math.max(30, Math.round((1 - yearsIn * 0.08) * 100));
    const passionGain = Math.max(3, Math.round(12 * eff / 100));
    state.passion = Math.min(100, state.passion + passionGain);
    result.deltas.push({ icon: 'heart', label: '买到心仪的同人制品！', value: `热情+${passionGain}${eff < 100 ? ` (效率${eff}%)` : ''}`, positive: true });

    if (cost > 200) {
      result.deltas.push({ icon: 'sparkle', label: '钱多了品味也上来了', value: `花费¥${cost}`, positive: false });
    }

    // Small info disclosure gain (you're engaging with the community)
    state.infoDisclosure = Math.min(1, state.infoDisclosure + 0.05);
    result.deltas.push({ icon: 'megaphone', label: '社群参与', value: `信息+5%`, positive: true });

    // Add to personal collection
    state.goodsCollection++;
    result.deltas.push({ icon: 'package', label: '加入收藏', value: `收藏品${state.goodsCollection}件`, positive: true });

    result.tip = { label: '消费者身份 (双重角色)', text: '同人创作者同时也是消费者——买别人的制品是维持热情的重要方式。钱多了之后眼光也会变高，花费也随之增加。购入的制品日后可以在二手市场出售回血。' };

  } else if (action.type === 'sellGoods') {
    // === SELL COLLECTION TO SECONDHAND MARKET ===
    if (state.goodsCollection <= 0) {
      result.deltas.push({ icon: 'export', label: '没有收藏品可出', value: '', positive: false });
    } else {
      // Sell player-selected quantity (from slider), default 1
      const sellQty = Math.min(state._sellQty || 1, state.goodsCollection);
      state._sellQty = null;
      // Price depends on secondhand market pressure (low pressure = better price)
      const shPressure = state.official?.secondHandPressure?.lvp || 0;
      const unitPrice = Math.max(50, Math.round(120 * (1 - shPressure * 0.5)));
      const revenue = sellQty * unitPrice;
      state.goodsCollection -= sellQty;
      addMoney(state, revenue);
      // Emotional cost scales with quantity (1→-1, 3→-3, 10→-6)
      const passionCost = Math.min(8, Math.ceil(sellQty * 0.8));
      state.passion = Math.max(0, state.passion - passionCost);

      // Feeds secondhand pool
      if (state.official) state.official.secondHandPool.lvp += sellQty;

      result.deltas.push({ icon: 'export', label: `出售${sellQty}件收藏品`, value: `+¥${revenue}（¥${unitPrice}/件）`, positive: true });
      result.deltas.push({ icon: 'heart', label: '割爱之痛', value: `-${passionCost}`, positive: false });
      if (state.goodsCollection > 0) {
        result.deltas.push({ icon: 'package', label: '剩余收藏', value: `${state.goodsCollection}件`, positive: true });
      }
      result.tip = { label: '二手回血', text: `二手市场是跨期预算调节器。大部分会转化为对本子新作的购买力。二手价格受市场压力影响：当前同人谷二手压力${Math.round(shPressure * 100)}%，压力越大价格越低。` };
    }
  }

  // --- Hire assistant (outsource for current HVP project) ---
  if (action.type === 'hireAssistant' && state.hvpProject) {
    const assistCost = 800 + Math.floor(Math.random() * 700);
    addMoney(state, -assistCost);
    state.hvpProject.progress = Math.round((state.hvpProject.progress + 0.5) * 100) / 100;
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
    addMoney(state, -cost);
    state.equipmentLevel++;
    result.deltas.push({ icon: 'desktop', label: `设备升级到Lv${state.equipmentLevel}！`, value: `-¥${cost}`, positive: false });
    result.deltas.push({ icon: 'sparkle', label: '作品质量永久提升', value: `+${(state.equipmentLevel * 0.08 * 100).toFixed(0)}%`, positive: true });
    result.deltas.push({ icon: 'heart', label: '创作消耗永久降低', value: `-${state.equipmentLevel}/月`, positive: true });
    result.tip = { label: '设备投资', text: `更好的设备意味着更高的作品质量和更低的创作消耗。当前Lv${state.equipmentLevel}，最高Lv3。` };
  }

  // --- Sponsor community ---
  if (action.type === 'sponsorCommunity') {
    const tiers = getSponsorTiers(state);
    const tierId = state._sponsorTier || 'basic';
    state._sponsorTier = null;
    const tier = tiers.find(t => t.id === tierId) || tiers[0];

    addMoney(state, -tier.cost);
    state.lastSponsorTurn = state.turn;
    const repGain = addReputation(state, tier.repGain);
    state.maxReputation = Math.max(state.maxReputation, state.reputation);
    state.passion = Math.min(100, state.passion + tier.passionGain);
    state.infoDisclosure = Math.min(1, state.infoDisclosure + tier.infoGain);

    result.deltas.push({ icon: tier.emoji || 'hand-heart', label: tier.name, value: `-¥${tier.cost}`, positive: false });
    result.deltas.push({ icon: 'star', label: '社区好感', value: `声誉+${repGain.toFixed(2)}`, positive: true });
    result.deltas.push({ icon: 'heart', label: '回馈的满足感', value: `热情+${tier.passionGain}`, positive: true });
    result.deltas.push({ icon: 'megaphone', label: '曝光度提升', value: `+${Math.round(tier.infoGain * 100)}%`, positive: true });

    // Community growth effect for top tier (new people join the fandom)
    if (tier.communityGrowth && state.market) {
      const growth = Math.round(state.market.communitySize * 0.03);
      state.market.communitySize += growth;
      result.deltas.push({ icon: 'users', label: '基金吸引新人入圈', value: `社群+${growth}`, positive: true });
      // Permanent time cost: running a fund takes ongoing effort (-1 day/month forever)
      if (!state._fundEstablished) {
        state._fundEstablished = true;
        state.timeDebuffs.push({ id: 'fund_admin', reason: '新人基金运营', turnsLeft: 9999, delta: -1 });
        state.time = computeEffectiveTime(state.turn, state.timeDebuffs);
        result.deltas.push({ icon: 'hourglass', label: '基金运营占用时间', value: '每月闲暇永久-1天', positive: false });
      }
    }

    // Add contacts from community sponsorship
    const contactCount = tier.contacts + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < contactCount; i++) {
      const affinityBase = tierId === 'fund' ? 2.5 : tierId === 'festival' ? 2.0 : 1.5;
      const c = addContact(state, { source: 'sponsor', affinity: affinityBase });
      if (c) result.deltas.push({ icon: 'address-book', label: `认识了${c.name}`, value: '活动结识', positive: true });
    }

    result.tip = tier.tip ? { label: '社群投资', text: tier.tip }
      : { label: '社群投资', text: '赞助同人社区活动是建立口碑的有效方式。不仅提升声誉和曝光度，还能认识新朋友扩展人脉。冷却6个月。' };
  }

  // --- Commercial transition: player accepts publisher offer ---
  // === Quit job for full-time doujin ===
  if (action.type === 'quitForDoujin') {
    const wasUnemployed = state.unemployed;
    state.doujinQuitCount = (state.doujinQuitCount || 0) + 1;
    state.fullTimeDoujin = true;
    state.unemployed = false;
    state.doujinMonths = 0;
    state.monthlyIncome = 0;
    state.jobSearchTurns = 0;
    state.doujinWorkYearReset = state.turn; // mark for salary reset if returning
    // Clear work-related debuffs (promotion, commute, 996 etc.)
    state.timeDebuffs = state.timeDebuffs.filter(d => !['promotion', '996'].includes(d.id) && !d.id.startsWith('commute_') && !d.id.startsWith('social_') && !d.id.startsWith('burnout_'));
    state.time = Math.max(0, Math.min(10, 7 + state.timeDebuffs.reduce((s, d) => s + d.delta, 0)));
    // Passion boost diminishes with each switch: 1st=full, 2nd=half, 3rd+=0
    const basePBoost = wasUnemployed ? 15 : 10;
    const switchPenalty = Math.min(state.doujinQuitCount - 1, 2); // 0, 1, 2
    const passionBoost = Math.max(0, basePBoost - switchPenalty * 5);
    state.passion = Math.min(100, state.passion + passionBoost);
    if (wasUnemployed) {
      result.deltas.push({ icon: 'sparkle', label: '不找工作了！全职搞同人！', value: '闲暇拉满', positive: true });
      result.deltas.push({ icon: 'heart', label: '把失业变成机遇', value: `热情+${passionBoost}`, positive: passionBoost > 0 });
    } else {
      result.deltas.push({ icon: 'sparkle', label: '辞职了！全身心投入同人创作！', value: '闲暇拉满 月收入→0', positive: true });
      result.deltas.push({ icon: 'heart', label: '自由的感觉真好', value: `热情+${passionBoost}`, positive: passionBoost > 0 });
    }
    if (state.doujinQuitCount >= 2 && passionBoost < basePBoost) {
      result.deltas.push({ icon: 'smiley-nervous', label: '反复折腾的新鲜感消退了', value: `热情加成减少`, positive: false });
    }

    // --- Inject accumulated general savings (first time only, not from unemployment) ---
    if (state.doujinQuitCount === 1 && !wasUnemployed) {
      const workStart = state.doujinWorkYearReset > 0 ? state.doujinWorkYearReset : 50;
      const workMonths = Math.max(0, state.turn - workStart);
      const bgSalaryMult = BACKGROUNDS[state.background]?.salaryMult || 1.0;
      const startSalary = Math.round(800 * bgSalaryMult);
      const endSalary = Math.round((800 + Math.max(0, Math.floor(workMonths / 12)) * 200) * bgSalaryMult);
      const avgSalary = Math.round((startSalary + endSalary) / 2);
      // 隐含储蓄 = 工作月数 × 平均月薪 × 0.8(储蓄率) × 0.6(投入同人比例)
      const savingsInjection = Math.min(35000, Math.round(workMonths * avgSalary * 0.8 * 0.6));
      if (savingsInjection > 0) {
        addMoney(state, savingsInjection);
        result.deltas.push({ icon: 'wallet', label: '取出多年积蓄', value: `+¥${savingsInjection.toLocaleString()}`, positive: true });
        result.savingsInjection = savingsInjection; // flag for UI popup
      }
    }

    result.deltas.push({ icon: 'warning', label: '每月生活费¥1300自动扣除', value: '没有固定收入了', positive: false });
    // Quitting consumes the rest of the month (resignation paperwork, handover, etc.)
    state.monthTimeSpent = state.time;
    result.tip = wasUnemployed
      ? { label: '化危为机', text: '失业不是问题，我们还有另一条路，全职同人创作，时间完全自由，但一切靠自己。存款低于¥5000时焦虑会严重侵蚀热情。撑不住随时可以重新找工作。' }
      : state.doujinQuitCount >= 2
        ? { label: '再次全职同人', text: `这是你第${state.doujinQuitCount}次辞职搞全职同人。频繁在职场和全职同人之间切换会让回去找工作越来越难。想清楚了再走这条路。` }
        : { label: '全部身家', text: `你这些年攒下的积蓄已经全部取出，加上同人资金，右上角的¥${state.money.toLocaleString()}就是你的全部家当。每月固定生活费¥1,300，没有工资兜底了。存款低于¥5000时焦虑会侵蚀热情，归零就真的撑不下去了。` };
  }

  if (action.type === 'goCommercial') {
    state.commercialTransition = true;
    checkAchievements(state); // ensure commercial_debut achievement is recorded
    state.passion = 0;
    state.phase = 'gameover';
    state.gameOverReason = generateCommercialEnding(state);
    result.deltas.push({ icon: 'star', label: '商业出道！', value: '告别同人，踏入商业创作', positive: true });
    result.tip = { label: '从同人到商业', text: '许多传奇创作者都走过这条路——从Comiket的小摊位到出版社的签约作者。同人创作培养的技能、积累的粉丝、锻炼的市场嗅觉，都是商业化最好的基础。你不是在"离开"同人圈，而是在"毕业"。' };
  }

  // --- Track action in month ---
  const timeCost = _cachedTimeCost;
  const isAllTime = !isFinite(timeCost);
  const remaining = state.time - state.monthTimeSpent;
  const actualCost = isAllTime ? remaining : Math.min(timeCost, remaining);
  state.monthTimeSpent += actualCost;
  state.monthActions.push({ actionId, timeCost: actualCost });

  if (actionId === 'hvp') state.hvpWorkedThisMonth = true;
  if (actionId === 'lvp') state.lvpWorkedThisMonth = true;
  // attendEvent tracking moved into the handler (before state.attendingEvent is cleared)
  if (['hvp', 'lvp', 'attendEvent', 'promote_heavy'].includes(actionId) ||
      (actionId === 'findPartner' && state.hasPartner)) {
    state.monthHadCreativeAction = true;
  }

  const monthOver = (state.time - state.monthTimeSpent) <= 0 || isAllTime || state.phase === 'gameover' || state.passion <= 0;

  state.lastResult = result;
  return { result, monthOver };
}

export function executeTurn(state, actionId) {
  const { result } = executeAction(state, actionId);
  const monthResult = endMonth(state);
  // Merge action deltas into month result
  result.deltas.push(...monthResult.deltas);
  result.officialEvents = monthResult.officialEvents;
  result.advancedMsgs = monthResult.advancedMsgs;
  return result;
}
