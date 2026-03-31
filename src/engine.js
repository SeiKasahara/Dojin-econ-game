/**
 * Game Engine — 同人社团物语 v4
 * Re-export orchestrator: all engine modules live under ./engine/
 */

export { addMoney, activeCrisisCount, getAge, getLifeStage, getLifeStageLabel, getTimeLabel,
         getCreativeSkill, getSkillEffects, getSkillLabel, addReputation,
         computeEffectiveTime, getCalendarMonth, getBaseTime, getRealityDrain, applyPassionDecay } from './engine/core.js';
export { HVP_SUBTYPES, LVP_SUBTYPES, CREATIVE_CHOICES, CHOICE_EFFECTS, getQualityStars, applyCreativeChoice,
         getWorkQualityEffects, getTrendBonus, syncInventoryAggregates,
         PARTNER_TYPES, addContact, generatePartnerCandidates, canCreateMusic } from './engine/definitions.js';
export { ENDOWMENTS, ENDOWMENT_TOTAL_POINTS, ENDOWMENT_MAX_PER_TRAIT, OBSESSIVE_TRAITS,
         BACKGROUNDS, rollBackground, createInitialState } from './engine/state.js';
export { ACTIONS, getActionDisplay, getFreelanceTimeCost, getTimeCost,
         canPerformAction, needsPricing, rollEventCondition, rollPartnerBusy, getSponsorTiers } from './engine/actions.js';
export { calculateSales, getSupplyDemandData, sellFromWorks, calculateFeedback } from './engine/sales.js';
export { generateEvents, generateEventCalendar, ensureEventCalendar } from './engine/event-calendar.js';
export { rollEvent, applyEvent } from './engine/event-roll.js';
export { executeAction, executeTurn } from './engine/execute-action.js';
export { endMonth } from './engine/end-month.js';
export { getAchievementInfo } from './achievements.js';
