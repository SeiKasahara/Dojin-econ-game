import { getLifeStage, getAge, getRealityDrain, computeEffectiveTime, addMoney, addReputation, getCreativeSkill, applyPassionDecay } from './core.js';
import { PARTNER_TYPES, HVP_SUBTYPES, LVP_SUBTYPES, getWorkQualityEffects, syncInventoryAggregates } from './definitions.js';
import { BACKGROUNDS } from './state.js';
import { sellFromWorks } from './sales.js';
import { ensureEventCalendar, generateEvents } from './event-calendar.js';
import { tickMarket } from '../market.js';
import { tickOfficial, getSecondHandModifier, recordPlayerWork } from '../official.js';
import { tickAdvanced } from '../advanced.js';
import { rollPartnerDrama } from '../partner-drama.js';
import { tickContacts } from '../partner.js';
import { chainDigest } from '../hash.js';
import { resolveContract } from '../prediction-contracts.js';
import { checkAchievements } from '../achievements.js';
import { generateEnding, generateCommercialEnding, generateCheatEnding, generateOpenEnding } from '../endings.js';
import { ic } from '../icons.js';
import { getMarketAvgPrice } from '../market.js';
import { updateContactAffinity } from '../partner.js';
import { PARTNER_NUDGE_MESSAGES } from '../partner-dialogs.js';

// === End Month (all month-end processing) ===
export function endMonth(state) {
  const result = { deltas: [], officialEvents: [], advancedMsgs: [] };

  // Passive rest at month end
  const remainingDays = Math.max(0, state.time - (state.monthTimeSpent || 0));
  const yearsIn = state.turn / 12;
  const fatigueMult = Math.max(0.45, 1 - yearsIn * 0.03);

  if (remainingDays > 0) {
    // Player ended month early with leisure left → convert remaining days to rest
    const hourScale = remainingDays / 5;
    let basRestore = (15 + Math.floor(Math.random() * 10) + (state.endowments.stamina || 0) * 3) * hourScale;
    if (state.obsessiveTrait === 'stamina') basRestore += 5 * hourScale;
    if (state.obsessiveTrait === 'social') basRestore *= 0.7;
    const restore = Math.max(2, Math.round(basRestore * fatigueMult));
    state.passion = Math.min(100, state.passion + restore);
    result.deltas.push({ icon: 'coffee', label: `剩余${remainingDays}天自动休息`, value: `热情+${restore}`, positive: true });
  } else if (state.time <= 0 || (state.monthActions || []).length === 0) {
    // 0 leisure month or no actions → full passive rest (equivalent to old per-turn rest)
    let basRestore = 15 + Math.floor(Math.random() * 10) + (state.endowments.stamina || 0) * 3;
    if (state.obsessiveTrait === 'stamina') basRestore += 5;
    if (state.obsessiveTrait === 'social') basRestore *= 0.7;
    const restore = Math.max(3, Math.round(basRestore * fatigueMult));
    state.passion = Math.min(100, state.passion + restore);
    result.deltas.push({ icon: 'coffee', label: state.time <= 0 ? '忙碌中偷闲' : '悠闲的一个月', value: `热情+${restore}`, positive: true });
    if (fatigueMult < 0.8) {
      result.deltas.push({ icon: 'smiley-sad', label: '长期疲惫', value: `恢复效率${Math.round(fatigueMult * 100)}%`, positive: false });
    }
  }

  // --- Idle month streak: had leisure but wasted it (did nothing OR only rested) → eventually quit ---
  const hadLeisure = state.time > 0;
  const actions = state.monthActions || [];
  const didNothing = actions.length === 0;
  const onlyRested = actions.length > 0 && actions.every(a => a.actionId === 'rest');
  if (hadLeisure && (didNothing || onlyRested)) {
    state.idleMonthStreak = (state.idleMonthStreak || 0) + 1;
    if (state.idleMonthStreak >= 8) {
      result.deltas.push({ icon: 'warning', label: '连续摆烂中', value: `已${state.idleMonthStreak}个月只在休息`, positive: false });
    }
    if (state.idleMonthStreak >= 12) {
      state.passion = 0;
      state.phase = 'gameover';
      state.gameOverReason = '连续一整年有时间却只是在休息……你渐渐忘记了当初为什么要搞同人。热情在无所事事中悄悄熄灭了。';
      return result;
    }
  } else {
    state.idleMonthStreak = 0;
  }

  // --- Partner effects (low resilience amplifies negative interpersonal impact) ---
  const resil = state.endowments.resilience || 0;
  // Low resilience: 0→1.8x, 1→1.4x, 2→1.0x, 3→0.85x (people-related pain hits harder)
  const interpersonalMult = resil <= 1 ? 2.3 - resil * 0.5 : Math.max(0.7, 1.0 - (resil - 2) * 0.15);
  if (state.hasPartner && state.partnerType) {
    const pt = PARTNER_TYPES[state.partnerType];
    if (pt.passionPerTurn !== 0) {
      const ppt = pt.passionPerTurn < 0 ? Math.round(pt.passionPerTurn * interpersonalMult) : pt.passionPerTurn;
      state.passion = Math.min(100, state.passion + ppt);
      result.deltas.push({ icon: 'handshake', label: ppt > 0 ? '搭档正面影响' : '搭档带来压力', value: `热情${ppt > 0 ? '+' : ''}${ppt}`, positive: ppt > 0 });
      if (ppt < pt.passionPerTurn && interpersonalMult > 1.1) {
        result.deltas.push({ icon: 'shield', label: '心理韧性不足，人际冲突更伤人', value: `×${interpersonalMult.toFixed(1)}`, positive: false });
      }
    }
    // Drama chance also higher for low resilience
    const dramaCh = pt.dramaChance * (interpersonalMult > 1 ? 1 + (interpersonalMult - 1) * 0.5 : 1);
    if (dramaCh > 0 && Math.random() < dramaCh) {
      const drama = rollPartnerDrama(state.partnerType);
      const ampPassion = Math.round(drama.passionDelta * interpersonalMult);
      const ampRep = drama.reputationDelta * (interpersonalMult > 1 ? interpersonalMult : 1);
      state.passion = Math.max(0, state.passion + ampPassion);
      addReputation(state, ampRep);
      result.deltas.push({ icon: 'warning', label: drama.desc, value: `热情${ampPassion} 声誉${ampRep < 0 ? ampRep.toFixed(1) : ''}`, positive: false });
    }
    state.partnerTurns--;
    if (state.partnerTurns <= 0) {
      const wasType = state.partnerType;

      // Update contact affinity based on collaboration outcome
      if (state.activeContactId) {
        const affinityDelta = wasType === 'toxic' ? -1 : 2;
        updateContactAffinity(state, state.activeContactId, affinityDelta);

        // Trusted + non-toxic: offer renewal next turn
        const contact = (state.contacts || []).find(c => c.id === state.activeContactId);
        if (contact && contact.tier === 'trusted' && wasType !== 'toxic') {
          state._partnerRenewalOffer = state.activeContactId;
          result.deltas.push({ icon: 'arrows-clockwise', label: `${contact.name}愿意继续合作`, value: '下月可续约', positive: true });
        }
      }

      state.hasPartner = false; state.partnerType = null; state.activeContactId = null;
      result.deltas.push({ icon: 'handshake', label: wasType === 'toxic' ? '终于摆脱了有毒搭档...' : '搭档合作期结束', value: '', positive: wasType === 'toxic' });
    }
  }

  // --- Contacts pool maintenance: cap + natural decay ---
  tickContacts(state, result);

  // --- Partner chat: nudge message if long time no chat ---
  if (!state._partnerChatNudgeSent && state.contacts?.length > 0) {
    const lastChat = state._partnerChatLastTurn || -99;
    if (state.turn - lastChat >= 3) {
      const trustedContact = state.contacts.find(c => c.affinity >= 3.95 && c.id !== state.activeContactId);
      if (trustedContact) {
        const msgs = PARTNER_NUDGE_MESSAGES[trustedContact.pType] || PARTNER_NUDGE_MESSAGES.supportive;
        const nudge = msgs[Math.floor(Math.random() * msgs.length)];
        if (!state._chatHistory) state._chatHistory = {};
        const histKey = `partner_${trustedContact.id}`;
        if (!state._chatHistory[histKey]) state._chatHistory[histKey] = [];
        state._chatHistory[histKey].push({ role: 'assistant', content: nudge });
        state._partnerChatNudgeSent = true;
      }
    }
  }

  // --- Track creative activity (resets inactivity counter) ---
  if (state.monthHadCreativeAction) state.lastCreativeTurn = state.turn;

  // --- Reality drain (with income/savings buffer during work stage) ---
  const rawDrain = getRealityDrain(state.turn);
  let drain = Math.max(0, rawDrain - (state.endowments.resilience || 0) * 0.5); // resilience reduces drain
  if (state.obsessiveTrait === 'resilience') drain = Math.max(0, drain - 1); // resilience-obsessive: extra -1
  if (state.obsessiveTrait === 'social') drain += 3; // social-obsessive: too much socializing drains creative energy
  if (drain > 0 && getLifeStage(state.turn) === 'work') {
    const incomeBuffer = state.monthlyIncome > 0 ? Math.min(0.4, state.monthlyIncome / 5000) : 0;
    const savingsBuffer = state.money > 3000 ? Math.min(0.2, (state.money - 3000) / 30000) : 0;
    const totalBuffer = Math.min(0.5, incomeBuffer + savingsBuffer);
    drain = drain * (1 - totalBuffer);
    if (totalBuffer > 0.05) {
      result.deltas.push({ icon: 'coins', label: '经济稳定缓冲现实压力', value: `-${Math.round(totalBuffer * 100)}%`, positive: true });
    }
  }
  if (drain > 0) {
    state.passion = Math.max(0, state.passion - drain);
    result.deltas.push({ icon: 'globe', label: '现实消耗', value: `热情-${drain.toFixed(1)}`, positive: false });
  }

  // --- Inactivity drain: the longer you stop creating, the faster passion fades ---
  const idleMonths = state.turn - state.lastCreativeTurn;
  if (idleMonths >= 3) {
    const idleDrain = Math.min(8, Math.floor((idleMonths - 2) * 1.5));
    state.passion = Math.max(0, state.passion - idleDrain);
    result.deltas.push({ icon: 'hourglass', label: '活动停滞', value: `热情-${idleDrain}（已${idleMonths}月未活动）`, positive: false });
  }

  // --- Secondhand market frustration: seeing your works sold cheap ---
  const shLvpPressure = state.official?.secondHandPressure?.lvp || 0;
  if (shLvpPressure > 0.3 && (state.totalHVP > 0 || state.totalLVP > 0)) {
    const shPassionHit = Math.min(4, Math.round((shLvpPressure - 0.3) * 8));
    if (shPassionHit > 0) {
      state.passion = Math.max(0, state.passion - shPassionHit);
      result.deltas.push({ icon: 'package', label: '二手泛滥挫败感', value: `热情-${shPassionHit}`, positive: false });
    }
  }

  // --- Debt anxiety: negative money → passion drain (worry, not fun anymore) ---
  let debtThreshold = (state.endowments.resilience || 0) * 200; // resilience delays anxiety
  if (state.obsessiveTrait === 'resilience') debtThreshold += 400;
  if (state.money < -debtThreshold) {
    const debtLevel = Math.abs(state.money) - debtThreshold;
    // Every ¥500 in debt → 2 extra passion drain
    const debtDrain = Math.min(10, Math.floor(debtLevel / 500) * 2);
    if (debtDrain > 0) {
      state.passion = Math.max(0, state.passion - debtDrain);
      result.deltas.push({ icon: 'money', label: '亏损焦虑', value: `热情-${debtDrain}`, positive: false });
    }
  }

  // --- Student debt bailout: family intervenes at -¥10000 ---
  // Tycoon: unlimited bailouts. Everyone else: first time help, second time game over.
  if (getLifeStage(state.turn) === 'university' && state.money <= -10000 && !state._debtBailoutDone) {
    state._debtBailoutDone = true;
    const bg = state.background;
    const debt = Math.abs(state.money);

    if (bg === 'tycoon') {
      // 超级富哥：无限兜底
      state.money = 0;
      addMoney(state, 8000);
      result.deltas.push({ icon: 'crown', label: '家里帮你还清了欠款', value: `¥${debt}`, positive: false });
      result.deltas.push({ icon: 'diamond', label: '"想做就做，钱不是问题"', value: '额外给了¥8000', positive: true });
      // Tycoon resets flag — can bail out again
      state._debtBailoutDone = false;
    } else if (state._debtBailedOnce) {
      // Second bailout for non-tycoon: game over
      state.passion = 0;
      state.phase = 'gameover';
      const reasons = {
        poor: '家里已经借遍了亲戚，再也拿不出一分钱了。你不得不放弃同人创作，打工还债……',
        ordinary: '父母说上次已经是最后一次了。"我们没有那么多钱给你挥霍，把心思放在学业上。"',
        comfort: '家里虽然还能承受，但父母对你彻底失望了。"既然管不好钱，就别再搞这些了。"',
        educated: '"我们支持你创作，但不支持你这样挥霍。"父母取消了所有经济支持。',
        wealthy: '即使家里不缺钱，父母也对你的财务能力完全失去了信心。"先学会管钱再说别的。"',
      };
      state.gameOverReason = reasons[bg] || reasons.ordinary;
      return result;
    } else {
      // First bailout for non-tycoon
      state._debtBailedOnce = true;
      if (bg === 'poor') {
        addMoney(state, 3000);
        state.passion = Math.max(0, state.passion - 20);
        result.deltas.push({ icon: 'house-simple', label: '家里来电话了…', value: '东拼西凑帮你还了¥3000', positive: false });
        result.deltas.push({ icon: 'smiley-sad', label: '"家里实在拿不出更多了"', value: '热情-20', positive: false });
      } else if (bg === 'ordinary' || bg === 'comfort') {
        state.money = 0;
        state.passion = Math.max(0, state.passion - 15);
        result.deltas.push({ icon: 'house', label: '父母帮你还清了欠款', value: `¥${debt}`, positive: false });
        result.deltas.push({ icon: 'smiley-sad', label: '"以后花钱悠着点"', value: '热情-15', positive: false });
      } else {
        // educated / wealthy: 兜底 + 支持
        state.money = 0;
        const support = bg === 'wealthy' ? 3000 : 1500;
        addMoney(state, support);
        result.deltas.push({ icon: BACKGROUNDS[bg].emoji, label: '家里帮你还清了欠款', value: `¥${debt}`, positive: false });
        result.deltas.push({ icon: bg === 'educated' ? 'books' : 'diamond', label: '"这是最后一次了"', value: `额外给了¥${support}`, positive: true });
        state.passion = Math.max(0, state.passion - 10);
      }
      result.deltas.push({ icon: 'warning', label: '下次不会再有人帮你了', value: '', positive: false });
    }
  }
  // Only tycoon resets bailout flag (handled above); others keep it permanently

  // --- Passive income ---
  const stage = getLifeStage(state.turn);
  if (stage === 'university') {
    const bgMult = BACKGROUNDS[state.background]?.allowanceMult || 1.0;
    const baseAllowance = Math.round((150 + Math.floor(Math.random() * 100)) * bgMult);
    // Random spending that eats into allowance + may dip into doujin savings
    // Each event type has: probability, allowance consumption ratio, savings dip ratio (urgency-based)
    const spendRoll = Math.random();
    let spending = 0;
    let dip = 0; // amount taken from doujin savings
    let spendLabel = '';
    const savingsDipBase = state.money > 200 ? state.money : 0; // only dip if there's something to take

    if (spendRoll < 0.15) {
      // 15%: 聚餐/社交 — 紧急社交，花超+挪用多
      spending = Math.round(baseAllowance * (0.7 + Math.random() * 0.3));
      dip = savingsDipBase > 0 ? Math.round(savingsDipBase * (0.04 + Math.random() * 0.03)) : 0; // 4-7%
      spendLabel = '聚餐社交花超了';
    } else if (spendRoll < 0.25) {
      // 10%: 换季买衣服/日用品 — 半紧急
      spending = Math.round(baseAllowance * (0.5 + Math.random() * 0.3));
      dip = savingsDipBase > 0 ? Math.round(savingsDipBase * (0.02 + Math.random() * 0.02)) : 0; // 2-4%
      spendLabel = '换季添置/日用品';
    } else if (spendRoll < 0.35) {
      // 10%: 冲动消费 — "反正有存款"心态，挪用较多
      spending = Math.round(baseAllowance * (0.4 + Math.random() * 0.4));
      dip = savingsDipBase > 0 ? Math.round(savingsDipBase * (0.05 + Math.random() * 0.04)) : 0; // 5-9%
      spendLabel = '冲动消费';
    } else if (spendRoll < 0.50) {
      // 15%: 零碎支出 — 不紧急，小额挪用
      spending = Math.round(baseAllowance * (0.2 + Math.random() * 0.2));
      dip = savingsDipBase > 0 ? Math.round(savingsDipBase * (0.01 + Math.random() * 0.01)) : 0; // 1-2%
      spendLabel = '零碎支出';
    }
    // else 50%: no extra spending

    const allowance = Math.max(0, baseAllowance - spending);
    addMoney(state, allowance);
    if (dip > 0) addMoney(state, -dip);

    if (spending > 0 || dip > 0) {
      result.deltas.push({ icon: 'house', label: '生活费结余', value: `+¥${baseAllowance}`, positive: true });
      if (spending > 0) result.deltas.push({ icon: 'shopping-cart', label: spendLabel, value: `-¥${spending}`, positive: false });
      if (dip > 0) result.deltas.push({ icon: 'money', label: '顺手挪用了同人存款', value: `-¥${dip}`, positive: false });
    } else {
      result.deltas.push({ icon: 'house', label: '生活费结余', value: `+¥${allowance}`, positive: true });
    }
  } else if (stage === 'work') {
    if (state.unemployed) {
      // No salary — anxiety scales with search duration but savings provide buffer
      const baseAnxiety = 8 + state.jobSearchTurns * 2;
      // Savings buffer or debt amplifier
      let moneyMod; // <0 = amplify, >0 = buffer
      if (state.money > 0) {
        moneyMod = Math.min(0.6, state.money / 20000); // up to -60% anxiety
      } else {
        moneyMod = -Math.min(0.8, Math.abs(state.money) / 5000); // up to +80% anxiety
      }
      const anxietyDrain = Math.max(2, Math.round(baseAnxiety * (1 - moneyMod)));
      state.passion = Math.max(0, state.passion - anxietyDrain);
      result.deltas.push({ icon: 'smiley-nervous', label: '失业焦虑', value: `热情-${anxietyDrain}`, positive: false });
      if (moneyMod > 0.1) {
        result.deltas.push({ icon: 'coins', label: `存款¥${state.money.toLocaleString()}缓冲焦虑`, value: `-${Math.round(moneyMod * 100)}%`, positive: true });
      } else if (moneyMod < -0.1) {
        result.deltas.push({ icon: 'money', label: `负债¥${Math.abs(state.money).toLocaleString()}加剧焦虑`, value: `+${Math.round(-moneyMod * 100)}%`, positive: false });
      }
      result.deltas.push({ icon: 'briefcase', label: '无工资收入', value: '¥0', positive: false });
      // Unemployment living cost erosion: general savings cover most, but pressure leaks into doujin fund
      const impliedLiving = (state.lastSalary || 800) * 2; // implied full living cost ≈ surplus × 2
      const erosionRate = Math.min(0.6, 0.15 + state.jobSearchTurns * 0.08); // 15%→60% over months
      const unemployedExpense = Math.round(impliedLiving * erosionRate);
      addMoney(state, -unemployedExpense);
      result.deltas.push({ icon: 'house', label: `生活费侵蚀同人资金(${Math.round(erosionRate * 100)}%)`, value: `-¥${unemployedExpense}`, positive: false });
    } else if (state.fullTimeDoujin) {
      // Full-time doujin: no salary, fixed living cost, anxiety based on savings
      state.doujinMonths = (state.doujinMonths || 0) + 1;
      state.monthlyIncome = 0;
      const livingCost = 1300;
      addMoney(state, -livingCost);
      result.deltas.push({ icon: 'house', label: '生活费', value: `-¥${livingCost}`, positive: false });

      // Anxiety based on savings level
      let doujinAnxiety = 0;
      if (state.money < 0) { doujinAnxiety = 10; result.deltas.push({ icon: 'smiley-nervous', label: '负债焦虑：全职同人撑不下去了', value: `热情-${doujinAnxiety}`, positive: false }); }
      else if (state.money < 5000) { doujinAnxiety = 5; result.deltas.push({ icon: 'smiley-nervous', label: '存款吃紧，有点慌', value: `热情-${doujinAnxiety}`, positive: false }); }
      else if (state.money < 10000) { doujinAnxiety = 2; result.deltas.push({ icon: 'smiley-meh', label: '存款在减少...', value: `热情-${doujinAnxiety}`, positive: false }); }
      state.passion = Math.max(0, state.passion - doujinAnxiety);
    } else {
      const bgSalaryMult = BACKGROUNDS[state.background]?.salaryMult || 1.0;
      const workStart = state.doujinWorkYearReset > 0 ? state.doujinWorkYearReset : 50; // reset if returned from doujin
      const tierMult = state.jobTier === 'elite' ? 1.8 : state.jobTier === 'labor' ? 0.6 : 1.0;
      const tierLabel = state.jobTier === 'elite' ? '设计师' : state.jobTier === 'labor' ? '基层' : '';
      const baseSalary = Math.round((800 + Math.max(0, Math.floor((state.turn - workStart) / 12)) * 200) * bgSalaryMult * tierMult);
      const salary = state.recessionTurnsLeft > 0 ? Math.floor(baseSalary * 0.8) : baseSalary; // recession cuts salary
      addMoney(state, salary);
      state.monthlyIncome = salary;
      const salaryLabel = `工资${tierLabel ? '(' + tierLabel + ')' : ''}${state.recessionTurnsLeft > 0 ? '(下行-20%)' : ''}`;
      result.deltas.push({ icon: 'briefcase', label: salaryLabel, value: `+¥${salary}`, positive: true });

      // Elite job: monthly reputation bonus from industry connections
      if (state.jobTier === 'elite') {
        addReputation(state, 0.05);
        result.deltas.push({ icon: 'star', label: '业界人脉加成', value: '声誉+0.05', positive: true });
      }
      // Labor job: passion drain from monotonous work
      if (state.jobTier === 'labor') {
        const laborDrain = 3;
        state.passion = Math.max(0, state.passion - laborDrain);
        result.deltas.push({ icon: 'smiley-sad', label: '基层劳动消磨热情', value: `热情-${laborDrain}`, positive: false });
      }

      // Recession: risk of losing job each month
      const fireChance = Math.max(0.005, 0.06 - (BACKGROUNDS[state.background]?.fireResist || 0));
      if (state.recessionTurnsLeft > 0 && Math.random() < fireChance) {
        state.unemployed = true;
        state.jobSearchTurns = 0;
        state.monthlyIncome = 0;
        state.jobTier = null;
        // Clear work-related debuffs (no longer employed)
        state.timeDebuffs = state.timeDebuffs.filter(d =>
          !['promotion', '996', 'elite_job', 'labor_drain', 'job_hop_penalty'].includes(d.id) &&
          !d.id.startsWith('commute_') &&
          !d.id.startsWith('social_') &&
          !d.id.startsWith('burnout_')
        );
        state.time = Math.max(0, Math.min(10, 7 + state.timeDebuffs.reduce((s, d) => s + d.delta, 0)));
        result.deltas.push({ icon: 'warning-circle', label: '被裁员了！', value: '失业', positive: false });
        result.deltas.push({ icon: 'note-pencil', label: '失业后时间充裕，但焦虑会快速消耗热情', value: '', positive: false });
      }
    }
  }

  // --- Lifestyle spending escalation (消费升级: surplus income eroded by lifestyle creep) ---
  if (getLifeStage(state.turn) === 'work') {
    const workYears = (state.turn - 50) / 12;
    const salaryRef = state.unemployed ? state.lastSalary : state.monthlyIncome;
    if (!state.unemployed) state.lastSalary = state.monthlyIncome;
    if (salaryRef > 0) {
      const spendRate = Math.min(0.5, 0.1 + workYears * 0.04);
      const lifestyleCost = state.unemployed
        ? Math.round(state.lastSalary * 0.3) // 失业: 消费降级有延迟，仍按30%扣
        : Math.round(salaryRef * spendRate);
      if (lifestyleCost > 0) {
        addMoney(state, -lifestyleCost);
        result.deltas.push({ icon: 'shopping-cart', label: `消费升级${state.unemployed ? '(惯性)' : ''}`, value: `-¥${lifestyleCost}`, positive: false });
      }
    }
  }

  // --- New creator fund upkeep (permanent monthly cost) ---
  if (state._fundEstablished) {
    const cs = state.market ? state.market.communitySize : 10000;
    const fundCost = Math.round(300 + cs / 10000 * 200); // ¥300~500/month depending on community size
    addMoney(state, -fundCost);
    result.deltas.push({ icon: 'hand-coins', label: '新人基金运营', value: `-¥${fundCost}`, positive: false });
  }

  // --- Creative fatigue decay ---
  if (state.creativeFatigue > 0) {
    state.creativeFatigue = Math.max(0, state.creativeFatigue - 0.5);
  }
  if (state.monthActions.some(a => a.actionId === 'rest') && state.creativeFatigue > 0) {
    state.creativeFatigue = Math.max(0, state.creativeFatigue - 1); // extra recovery on rest
    result.deltas.push({ icon: 'battery-medium', label: '创作疲劳缓解', value: `疲劳${state.creativeFatigue.toFixed(1)}`, positive: true });
  }

  // --- Bestie affinity decay (friendships need maintenance) ---
  // Decay only if player didn't chat with bestie this month
  const chattedBestieThisMonth = (state._chatUsage?.bestie || 0) > 0 || (state._bestieLastChatTurn === state.turn - 1);
  if (!chattedBestieThisMonth && (state.bestieAffinity || 0) > 5) {
    state.bestieAffinity = Math.max(5, (state.bestieAffinity || 10) - 2);
  }

  // --- Info disclosure: rapid decay (information flood drowns everything fast) ---
  let infoDecay = 0.12 - (state.endowments.marketing || 0) * 0.015; // base 12%/month, marketing slows
  if (state.obsessiveTrait === 'marketing') infoDecay -= 0.02;    // marketing-obsessive: slower decay
  if (state.obsessiveTrait === 'resilience') infoDecay += 0.03;   // resilience-obsessive: tone-deaf to market
  state.infoDisclosure = Math.max(0.05, state.infoDisclosure - infoDecay);

  // --- Passive online sales (trickle from inventory each turn, affected by secondhand) ---
  if ((state.inventory.hvpStock > 0 || state.inventory.lvpStock > 0) && !state.monthActions.some(a => a.actionId === 'attendEvent')) {
    const cs = state.market ? state.market.communitySize : 10000;
    const nHVP = state.market?.nHVP || 9;
    const nLVP = state.market?.nLVP || 55;
    const baseConv = Math.min(0.95, 0.20 + state.infoDisclosure * 0.50);
    // High info bonus: 60%+ info → online sales boost (well-known creators sell more online)
    const infoBonus = state.infoDisclosure >= 0.6 ? 1 + (state.infoDisclosure - 0.6) * 1.5 : 1; // 60%→1x, 80%→1.3x, 100%→1.6x
    const onlineFactor = 0.12 * infoBonus;
    const onlineShModHVP = getSecondHandModifier(state.official, 'hvp');
    const onlineShModLVP = getSecondHandModifier(state.official, 'lvp');

    if (state.inventory.hvpStock > 0) {
      const totalAlpha = nHVP * 1.0 + state.reputation;
      const share = totalAlpha > 0 ? state.reputation / totalAlpha : 0.1;
      // Price elasticity: player's pricing vs market avg affects online demand
      const hvpMktAvg = state.market ? getMarketAvgPrice(state.market, state, 'hvp') : 50;
      const hvpPlayerPrice = state.inventory.hvpPrice || 50;
      const hvpPricePenalty = Math.pow(Math.max(0.01, hvpPlayerPrice / hvpMktAvg), -1.06);
      const rawDemand = cs / 1000 * 5 * share * baseConv * onlineFactor * onlineShModHVP * hvpPricePenalty;
      // No guarantee — market decides, absurd prices get zero sales
      const demand = Math.max(0, Math.round(rawDemand));
      if (demand > 0) {
        const hvpResult = sellFromWorks(state, 'hvp', demand);
        if (hvpResult.sold > 0) {
          addMoney(state, hvpResult.revenue);
          state.totalRevenue += hvpResult.revenue;
          state.totalSales += hvpResult.sold;
          addReputation(state, (0.02 + 0.06 * state.infoDisclosure) * hvpResult.sold * 0.03);
          result.deltas.push({ icon: 'globe-simple', label: `网上售出同人本×${hvpResult.sold}`, value: `+¥${hvpResult.revenue}`, positive: true });
        }
      }
    }

    if (state.inventory.lvpStock > 0) {
      const totalAlpha = nLVP * 0.2 + state.reputation;
      const share = totalAlpha > 0 ? state.reputation / totalAlpha : 0.1;
      // Price elasticity for LVP
      const lvpMktAvg = state.market ? getMarketAvgPrice(state.market, state, 'lvp') : 15;
      const lvpPlayerPrice = state.inventory.lvpPrice || 15;
      const lvpPricePenalty = Math.pow(Math.max(0.01, lvpPlayerPrice / lvpMktAvg), -0.92);
      const rawDemand = cs / 1000 * 15 * share * baseConv * onlineFactor * onlineShModLVP * lvpPricePenalty;
      const demand = Math.max(0, Math.round(rawDemand));
      if (demand > 0) {
        const lvpResult = sellFromWorks(state, 'lvp', demand);
        if (lvpResult.sold > 0) {
          addMoney(state, lvpResult.revenue);
          state.totalRevenue += lvpResult.revenue;
          state.totalSales += lvpResult.sold;
          result.deltas.push({ icon: 'globe-simple', label: `网上售出谷子×${lvpResult.sold}`, value: `+¥${lvpResult.revenue}`, positive: true });
        }
      }
    }

    // Show info bonus on online sales
    if (infoBonus > 1) {
      result.deltas.push({ icon: 'megaphone', label: '高曝光通贩加成', value: `+${Math.round((infoBonus - 1) * 100)}%`, positive: true });
    }
    // Show secondhand impact on online sales
    const worstShMod = Math.min(onlineShModHVP, onlineShModLVP);
    if (worstShMod < 0.9) {
      result.deltas.push({ icon: 'package', label: '二手市场挤压网上销量', value: `-${Math.round((1 - worstShMod) * 100)}%`, positive: false });
    }
  }

  // --- Passive digital sales (电子版被动收入) ---
  const digitalWorks = (state.inventory?.works || []).filter(w => w.hasDigital && w.type === 'hvp');
  if (digitalWorks.length > 0 && state.market) {
    const cs = state.market.communitySize;
    const nHVP = state.market.nHVP || 9;
    const share = state.reputation / (nHVP * 1.0 + state.reputation);
    // Digital sales heavily depend on info disclosure: low visibility ≈ no buyers
    // info 0.05→0.003, 0.2→0.04, 0.5→0.25, 0.8→0.64, 1.0→1.0
    const infoMod = Math.pow(state.infoDisclosure, 2);
    let totalDigiRev = 0;
    const digiDetails = [];
    for (const w of digitalWorks) {
      const sub = w.type === 'hvp' ? (HVP_SUBTYPES[w.subtype] || HVP_SUBTYPES.manga) : null;
      const digiPrice = Math.round(w.price * 0.35);
      const age = Math.max(0, state.turn - (w.turn || state.turn));
      const ageMod = Math.max(0.2, 1 - age * 0.04);
      const qualityMod = Math.pow(w.workQuality || 1.0, 2.0);
      const rawSales = Math.max(0, Math.round(cs / 1000 * 2 * share * infoMod * ageMod * qualityMod * (0.8 + Math.random() * 0.4)));
      const rev = rawSales * digiPrice;
      totalDigiRev += rev;
      if (rawSales > 0) digiDetails.push({ name: (sub ? sub.name : '作品') + (w.name ? '·' + w.name : ''), sales: rawSales, price: digiPrice, rev });
    }
    if (totalDigiRev > 0) {
      addMoney(state, totalDigiRev);
      state.totalRevenue += totalDigiRev;
      result.digitalSalesDetails = digiDetails;
      result.digitalSalesTotal = totalDigiRev;
    }
  }

  // --- Resolve prediction market contracts (Polymarket-style shares) ---
  if (state._predictions) {
    const pm = state._predictions;
    if (!pm.contracts) pm.contracts = [];
    if (!pm.holdings) pm.holdings = [];
    if (!pm.resolved) pm.resolved = [];
    // Tick prices + generate daily candles for active contracts
    for (const c of pm.contracts) {
      if (state.turn < c.resolveTurn && c._lastTickTurn !== state.turn) {
        if (!c.priceHistory) c.priceHistory = [c.price || 50];
        if (!c.candles) c.candles = [];
        const prevPrice = c.price;
        const noise = (Math.random() - 0.5) * 12;
        const turnsLeft = Math.max(1, c.resolveTurn - state.turn);
        const drift = ((Math.random() < 0.5 ? c.price + (Math.random() - 0.4) * 10 : c.price) - c.price) * Math.min(0.3, 1 / turnsLeft);
        c.price = Math.max(5, Math.min(95, Math.round(c.price + noise + drift)));
        c.priceHistory.push(c.price);
        // Generate daily ticks via Brownian bridge and append candles
        const a = prevPrice, b = c.price;
        const vol = Math.abs(b - a) * 0.4 + 1.5;
        const dailyTicks = [a];
        for (let s = 1; s < 30; s++) {
          const t = s / 30;
          dailyTicks.push(a + t * (b - a) + (Math.random() - 0.5) * 2 * vol * Math.sqrt(t * (1 - t)));
        }
        dailyTicks.push(b);
        for (let di = 0; di < dailyTicks.length - 1; di += 2) {
          const slice = dailyTicks.slice(di, Math.min(di + 3, dailyTicks.length));
          if (slice.length < 2) break;
          c.candles.push({ open: slice[0], close: slice[slice.length - 1], high: Math.max(...slice), low: Math.min(...slice) });
        }
        c._lastTickTurn = state.turn;
      }
    }
    // Resolve matured contracts
    const predSettlements = [];
    pm.contracts = pm.contracts.filter(c => {
      if (state.turn >= c.resolveTurn) {
        const outcome = resolveContract(c, state);
        const related = pm.holdings.filter(h => h.contractId === c.id);
        for (const h of related) {
          const won = (h.side === 'yes' && outcome) || (h.side === 'no' && !outcome);
          const payout = won ? h.shares * 100 : 0;
          const profit = payout - h.cost;
          pm.totalProfit = (pm.totalProfit || 0) + profit;
          if (payout > 0) addMoney(state, payout);
          // Detect market manipulation: player won a club contract they could influence
          if (won && c._isClubContract) state._marketManipulated = true;
          pm.resolved.push({ question: c.question, side: h.side, won, payout, profit, cost: h.cost, resolvedAt: state.turn });
          predSettlements.push({ question: c.question, side: h.side, shares: h.shares, cost: h.cost, won, payout, profit, outcome: outcome ? 'YES' : 'NO' });
        }
        pm.holdings = pm.holdings.filter(h => h.contractId !== c.id);
        if (pm.resolved.length > 15) pm.resolved = pm.resolved.slice(-15);
        return false;
      }
      return true;
    });
    if (predSettlements.length > 0) {
      result.predictionSettlements = predSettlements;
      // Display actual cash flow at settlement: winners receive payout, losers get nothing
      // (cost was already deducted at purchase time)
      const totalPayout = predSettlements.reduce((s, p) => s + p.payout, 0);
      const wonCount = predSettlements.filter(p => p.won).length;
      const lostCount = predSettlements.filter(p => !p.won).length;
      const label = wonCount > 0 && lostCount > 0
        ? `织梦交易结算 (${wonCount}赢${lostCount}输)`
        : wonCount > 0
          ? `织梦交易结算 (${wonCount}笔赢)`
          : `织梦交易结算 (${lostCount}笔归零)`;
      result.deltas.push({
        icon: totalPayout > 0 ? 'chart-line-up' : 'chart-line-down',
        label,
        value: totalPayout > 0 ? `+¥${totalPayout}` : '血本无归',
        positive: totalPayout > 0,
      });
    }
  }

  // --- Tick recentLVP (for bundling bonus) ---
  if (state.recentLVP > 0) state.recentLVP++;

  // --- Tick time debuffs ---
  state.timeDebuffs = state.timeDebuffs.filter(d => { d.turnsLeft--; return d.turnsLeft > 0; });

  // --- Tick recession ---
  if (state.recessionTurnsLeft > 0) {
    state.recessionTurnsLeft--;
    if (state.recessionTurnsLeft === 0) {
      state._recessionEndTurn = state.turn;
      result.deltas.push({ icon: 'trend-up', label: '经济复苏', value: '下行周期结束', positive: true });
    }
  }

  // --- Tick market ecosystem (Phase 2) ---
  if (state.market) tickMarket(state.market, state);

  // --- Tick official IP & secondhand (Phase 3) ---
  let officialEvents = [];
  if (state.official && state.market) {
    officialEvents = tickOfficial(state.official, state.market, state);
  }
  result.officialEvents = officialEvents;

  // --- Tick advanced systems (Phase 4+5) ---
  let advEvents = [];
  if (state.advanced && state.market) {
    advEvents = tickAdvanced(state.advanced, state.market, state);
  }
  result.advancedMsgs = advEvents;

  // --- Reset player price choices ---
  state.playerPrice = { hvp: null, lvp: null };
  // attendingEvent is cleared in the attendEvent handler itself

  // --- Record history snapshot ---
  const prevRev = state.history.length > 0 ? state.history[state.history.length - 1].cumRevenue : 0;
  const lastActionId = state.monthActions.length > 0 ? state.monthActions[state.monthActions.length - 1].actionId : 'rest';
  state.history.push({
    turn: state.turn, money: state.money,
    reputation: Math.round(state.reputation * 100) / 100,
    passion: Math.round(state.passion),
    turnRevenue: state.totalRevenue - prevRev,
    cumRevenue: state.totalRevenue,
    action: lastActionId,
    hvpStock: state.inventory.hvpStock, lvpStock: state.inventory.lvpStock,
  });

  // --- Track reputation change rate (for backlash event detection) ---
  const repHistoryWindow = 3; // look back 3 months
  if (state.history.length >= repHistoryWindow + 1) {
    const pastRep = state.history[state.history.length - 1 - repHistoryWindow].reputation;
    state._repDelta3m = state.reputation - pastRep; // negative = dropping
  }

  // Capture month financial summary BEFORE reset
  result.monthFinancial = { income: state._monthIncome || 0, expense: state._monthExpense || 0 };

  // --- Anti-cheat: record chained digest + action log (BEFORE turn++) ---
  {
    const acts = (state.monthActions || []).map(a => a.actionId);
    const prevDigest = state._digestChain.length > 0
      ? state._digestChain[state._digestChain.length - 1]
      : '';
    const snapshot = {
      t: state.turn,
      m: Math.round(state.money),
      r: Math.round(state.reputation * 100),
      p: Math.round(state.passion),
      rv: state.totalRevenue,
      ts: state.totalSales,
      hv: state.totalHVP,
      lv: state.totalLVP,
      hs: state.inventory.hvpStock,
      ls: state.inventory.lvpStock,
      a: acts.join(','),
    };
    const digest = chainDigest(prevDigest, snapshot);
    state._digestChain.push(digest);
    state._actionLog.push({
      t: snapshot.t,
      a: acts,
      m: snapshot.m,
      r: snapshot.r,
      p: snapshot.p,
      rv: snapshot.rv,
      s: snapshot.ts,
      hv: snapshot.hv,
      lv: snapshot.lv,
      hs: snapshot.hs,
      ls: snapshot.ls,
    });
  }

  // --- Advance turn ---
  state.turn++;
  state.time = (state.unemployed || state.fullTimeDoujin)
    ? Math.max(0, Math.min(10, 7 + state.timeDebuffs.reduce((s, d) => s + d.delta, 0)))
    : computeEffectiveTime(state.turn, state.timeDebuffs);

  // --- Small-circle big-reputation milestone ---
  const _cs = state.market?.communitySize || 10000;
  if (_cs < 5000 && !state._smallCircleBigRepShown && state.reputation >= 5) {
    state._smallCircleBigRepShown = true;
    result.deltas.push({ icon: 'crown', label: '小圈子的大人物', value: '圈内几乎人尽皆知', positive: true });
    result.tip = { label: '大鱼与小池塘', text: `社群只有${_cs.toLocaleString()}人，但你的声誉已达到${state.reputation.toFixed(1)}——在这个小世界里，你就是标杆。小圈子的好处是归属感极强、粉丝忠诚度高；坏处是市场天花板低，收入增长会很快触顶。这是很多冷门圈创作者的真实写照：不是不够好，只是舞台太小。` };
  }
  if (_cs < 5000 && !state._smallCircleLegendShown && state.reputation >= 8) {
    state._smallCircleLegendShown = true;
    result.deltas.push({ icon: 'crown', label: '镇圈之宝', value: '你定义了这个圈子', positive: true });
    result.tip = { label: '一个人撑起一个圈', text: `在不到${_cs.toLocaleString()}人的社群里达到声誉${state.reputation.toFixed(1)}，你已经不只是"有名的创作者"——你的作品就是这个圈子的文化符号。新人因为你入坑，老人因为你留下。但这也意味着，如果你停下来，这个小世界可能会跟着安静下去。` };
  }

  // --- Reset month state ---
  state.monthTimeSpent = 0;
  state.monthActions = [];
  state.hvpWorkedThisMonth = false;
  state.lvpWorkedThisMonth = false;
  state.eventsAttendedThisMonth = [];
  state.monthHadCreativeAction = false;
  state.findPartnerTriedThisMonth = false;
  if (state._chatUsage) state._chatUsage.partnerChat = 0;
  state._partnerChatNudgeSent = false;
  state._monthIncome = 0;
  state._monthExpense = 0;
  // Reset chat usage (monthly cooldowns)
  if (state._chatUsage) state._chatUsage.bestie = 0; // reset bestie round count (cooldown checked separately)
  // Don't reset goddess usage — it persists per event until new event triggers

  // Bestie history: clear after 3 months from last chat
  if (state._chatHistory?.bestie && state._bestieLastChatTurn && state.turn - state._bestieLastChatTurn >= 3) {
    delete state._chatHistory.bestie;
  }
  // Goddess history: never cleared (persists until game end)

  // --- Generate available doujin events for next turn (from calendar) ---
  ensureEventCalendar(state);
  const calEntry = state.eventCalendar.find(e => e.turn === state.turn);
  state.availableEvents = calEntry ? calEntry.events : generateEvents(state);

  // --- Achievements ---
  checkAchievements(state);

  // --- Tamper detection (delayed) ---
  if (state.tampered) {
    if (state._tamperCountdown == null) {
      // First detection: start countdown (1-2 months)
      state._tamperCountdown = 1 + Math.floor(Math.random() * 2);
    } else {
      state._tamperCountdown--;
    }
    if (state._tamperCountdown <= 0) {
      state.passion = 0;
      state.phase = 'gameover';
      state.gameOverReason = generateCheatEnding(state);
      state.lastResult = result;
      return result;
    }
  }

  // --- Age 42: open ending (story continues beyond the game) ---
  if (getAge(state.turn) >= 42) {
    state.phase = 'gameover';
    state.openEnding = true;
    state.gameOverReason = generateOpenEnding(state);
    state.lastResult = result;
    return result;
  }

  // --- Game over check ---
  if (state.passion <= 0) {
    state.passion = 0; state.phase = 'gameover';
    state.gameOverReason = generateEnding(state);
  } else {
    state.phase = 'result';
  }

  state.lastResult = result;
  return result;
}
