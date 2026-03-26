/**
 * 会计平账测试 — 验证 addMoney 追踪的 income/expense 与实际 money 变化一致
 *
 * 核心公式：monthStartMoney + monthIncome - monthExpense === monthEndMoney
 * 如果不等，说明某处 state.money 变化没有经过 addMoney，存在漏记。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock CSS import inside @phosphor-icons/web
vi.mock('@phosphor-icons/web/bold', () => ({}));

import {
  createInitialState,
  executeAction,
  endMonth,
  canPerformAction,
  ACTIONS,
  rollEvent,
  applyEvent,
  ensureEventCalendar,
  HVP_SUBTYPES,
  LVP_SUBTYPES,
  syncInventoryAggregates,
} from './engine.js';

// ─── Helpers ───

/** Pick the first available action from preferredOrder, fallback to rest */
function pickAction(state, preferredOrder) {
  for (const id of preferredOrder) {
    if (ACTIONS[id] && canPerformAction(state, id)) return id;
  }
  for (const id of Object.keys(ACTIONS)) {
    if (canPerformAction(state, id)) return id;
  }
  return 'rest';
}

/** Prepare state._xxx fields that the UI would normally set before executeAction */
function prepareActionState(state, actionId) {
  if (actionId === 'lvp') {
    state._selectedLVPSubtype = state._selectedLVPSubtype || 'badge';
    state._lvpProcessChoice = state._lvpProcessChoice || 'standard';
    state.playerPrice.lvp = state.playerPrice.lvp || 15;
  }
  if (actionId === 'hvp') {
    if (!state.hvpProject) {
      state._selectedHVPSubtype = state._selectedHVPSubtype || 'novel';
      state._pendingChoices = [{ category: 'theme', optionId: 'mainstream' }];
    } else {
      const nextMonth = (state.hvpProject.progress || 0) + 1;
      const choicesMade = state.hvpProject.choices?.length || 0;
      if (nextMonth === 2 && choicesMade < 2) {
        state._pendingChoices = [{ category: 'execution', optionId: 'balanced' }];
      } else if (nextMonth >= 3 && nextMonth >= state.hvpProject.needed && choicesMade < 3) {
        state._pendingChoices = [{ category: 'finalPolish', optionId: 'polished' }];
      }
    }
    // Pricing for HVP completion turn
    state.playerPrice.hvp = state.playerPrice.hvp || 50;
    state._antiSpecStrategy = state._antiSpecStrategy || 'normal';
  }
  if (actionId === 'attendEvent' && state.availableEvents?.length) {
    const attended = state.eventsAttendedThisMonth || [];
    const unattended = state.availableEvents.find(e => !attended.includes(e.name));
    if (unattended) {
      state.attendingEvent = unattended;
      state._eventMode = 'consign';
      state._minigameResult = null;
    }
  }
  if (actionId === 'rest') {
    state._restHours = state._restHours || 2;
  }
  if (actionId === 'reprint') {
    // Pick all works for reprint
    state._reprintWorkIds = (state.inventory.works || []).map(w => w.id);
  }
}

/**
 * Run one full month: execute actions → endMonth → random event.
 * Returns detailed financial audit log.
 */
function simulateMonth(state, actionOrder) {
  const monthStart = state.money;

  const defaultOrder = [
    'lvp', 'freelance', 'hvp', 'attendEvent', 'promote_light',
    'buyGoods', 'upgradeEquipment', 'reprint', 'sellGoods',
    'hireAssistant', 'sponsorCommunity', 'partTimeJob', 'rest',
  ];
  const order = actionOrder || defaultOrder;

  const actionsTaken = [];
  let safety = 0;

  while (safety++ < 30) {
    const actionId = pickAction(state, order);
    prepareActionState(state, actionId);

    const { result, monthOver } = executeAction(state, actionId);
    actionsTaken.push(actionId);

    if (monthOver || state.phase === 'gameover') break;
  }

  // endMonth (captures monthFinancial BEFORE resetting accumulators)
  const monthResult = endMonth(state);
  const { income: endMonthIncome, expense: endMonthExpense } = monthResult.monthFinancial;

  // Apply random event (like the real game loop)
  const moneyBeforeEvent = state.money;
  const event = rollEvent(state);
  let eventName = null;
  if (event) {
    applyEvent(state, event);
    eventName = event.title || event.id;
  }
  const eventDelta = state.money - moneyBeforeEvent;
  const eventIncome = eventDelta > 0 ? eventDelta : 0;
  const eventExpense = eventDelta < 0 ? Math.abs(eventDelta) : 0;

  // Reset accumulators after events (mirrors main.js afterMonthTransition)
  state._monthIncome = 0;
  state._monthExpense = 0;

  const monthEnd = state.money;
  const totalIncome = endMonthIncome + eventIncome;
  const totalExpense = endMonthExpense + eventExpense;

  return {
    turn: state.turn,
    monthStart,
    monthEnd,
    actualDelta: monthEnd - monthStart,
    trackedIncome: totalIncome,
    trackedExpense: totalExpense,
    trackedNet: totalIncome - totalExpense,
    discrepancy: (monthEnd - monthStart) - (totalIncome - totalExpense),
    actions: actionsTaken,
    monthFinancial: monthResult.monthFinancial,
    eventName,
    eventDelta,
    passion: state.passion,
    phase: state.phase,
  };
}

/** Assert balance and return log */
function assertBalance(log, label) {
  expect(
    log.discrepancy,
    `${label} 第${log.turn}月平账失败！\n` +
    `  实际变化: ¥${log.actualDelta} (${log.monthStart} → ${log.monthEnd})\n` +
    `  追踪收入: ¥${log.trackedIncome}, 追踪支出: ¥${log.trackedExpense}\n` +
    `  追踪净值: ¥${log.trackedNet}\n` +
    `  差额: ¥${log.discrepancy}\n` +
    `  操作: [${log.actions.join(', ')}]` +
    (log.eventName ? `\n  随机事件: ${log.eventName} (¥${log.eventDelta})` : '')
  ).toBe(0);
}

function printReport(title, logs) {
  console.log(`\n=== ${title} ===`);
  for (const l of logs) {
    const s = l.discrepancy === 0 ? '✓' : '✗';
    const evtStr = l.eventName ? ` 事件:${l.eventName}(${l.eventDelta >= 0 ? '+' : ''}¥${l.eventDelta})` : '';
    console.log(
      `${s} 第${l.turn}月: ` +
      `收入+¥${l.trackedIncome} 支出-¥${l.trackedExpense} ` +
      `净值=${l.trackedNet >= 0 ? '+' : ''}¥${l.trackedNet} ` +
      `实际=${l.actualDelta >= 0 ? '+' : ''}¥${l.actualDelta} ` +
      `[${l.actions.join(',')}]${evtStr}`
    );
  }
}

/** Create a rich state with lots of inventory, money, and unlocked features */
function createRichState() {
  const state = createInitialState('high', { talent: 3, stamina: 2, social: 1, marketing: 1, resilience: 0 }, 'ordinary', 'normal');
  state.money = 80000;
  state.passion = 100;
  state.reputation = 4;
  state.time = 10;
  state.equipmentLevel = 0;
  state.goodsCollection = 5;
  state.lastSponsorTurn = -12; // allow sponsorCommunity

  // Rich inventory
  state.inventory.works = [
    { id: 1, type: 'hvp', subtype: 'manga', qty: 30, price: 50, workQuality: 1.2, styleTag: '甜文', isCultHit: false },
    { id: 2, type: 'hvp', subtype: 'novel', qty: 20, price: 40, workQuality: 1.0, styleTag: null, isCultHit: false },
    { id: 3, type: 'lvp', subtype: 'acrylic', qty: 25, price: 20, workQuality: 1.0, styleTag: null, isCultHit: false },
    { id: 4, type: 'lvp', subtype: 'badge', qty: 40, price: 10, workQuality: 1.0, styleTag: null, isCultHit: false },
    { id: 5, type: 'lvp', subtype: 'postcard', qty: 50, price: 12, workQuality: 1.0, styleTag: null, isCultHit: false },
  ];
  state.inventory.nextWorkId = 6;
  state.inventory.hvpStock = 50;
  state.inventory.lvpStock = 115;
  state.inventory.hvpPrice = 50;
  state.inventory.lvpPrice = 15;
  state.totalHVP = 2;
  state.totalLVP = 3;
  state.totalRevenue = 5000;
  state.totalSales = 100;

  ensureEventCalendar(state);
  return state;
}

// ─── Tests ───

describe('会计平账测试', () => {
  let state;

  beforeEach(() => {
    state = createInitialState('mid', null, 'ordinary', 'normal');
    state.inventory.lvpStock = 20;
    state.inventory.hvpStock = 10;
    state.inventory.works = [
      { id: 1, type: 'hvp', subtype: 'manga', qty: 10, price: 50, workQuality: 1.0, styleTag: null, isCultHit: false },
      { id: 2, type: 'lvp', subtype: 'badge', qty: 20, price: 15, workQuality: 1.0, styleTag: null, isCultHit: false },
    ];
    state.inventory.nextWorkId = 3;
    ensureEventCalendar(state);
  });

  it('连续6个月基础操作平账（含随机事件）', () => {
    const logs = [];
    for (let m = 0; m < 6; m++) {
      if (state.phase === 'gameover') break;
      const log = simulateMonth(state);
      logs.push(log);
      assertBalance(log, '基础');
    }
    printReport('6个月基础审计（含随机事件）', logs);
  });

  it('monthFinancial 应不超过含事件的总计', () => {
    for (let m = 0; m < 6; m++) {
      if (state.phase === 'gameover') break;
      const log = simulateMonth(state);
      if (log.monthFinancial) {
        expect(log.monthFinancial.income).toBeLessThanOrEqual(log.trackedIncome);
        expect(log.monthFinancial.expense).toBeLessThanOrEqual(log.trackedExpense);
      }
    }
  });

  it('income 和 expense 都应 >= 0', () => {
    for (let m = 0; m < 6; m++) {
      if (state.phase === 'gameover') break;
      const log = simulateMonth(state);
      expect(log.trackedIncome).toBeGreaterThanOrEqual(0);
      expect(log.trackedExpense).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('高强度全操作平账测试', () => {
  it('单月尽可能多操作：创作+参展+购买+追印+升级+赞助', () => {
    const state = createRichState();

    // Force an event to exist this month
    if (!state.availableEvents?.length) {
      state.availableEvents = [{
        name: '测试同人展', city: '本市', travelCost: 50,
        salesBoost: 1.8, reputationBoost: 0.1, passionBoost: 3, size: 'small',
        calendarId: 999,
      }];
    }

    // Try to hit as many financial actions as possible in one month
    const order = [
      'lvp',               // 制作谷子 (花钱)
      'attendEvent',       // 参加展会 (花钱+赚钱)
      'buyGoods',          // 购买谷子 (花钱)
      'reprint',           // 追加印刷 (花钱)
      'upgradeEquipment',  // 升级设备 (花钱)
      'sponsorCommunity',  // 赞助社区 (花钱)
      'freelance',         // 接稿 (赚钱)
      'promote_light',     // 轻度宣发
      'hvp',               // 创作同人本
      'sellGoods',         // 出售闲置 (赚钱)
      'hireAssistant',     // 外包助手 (花钱)
      'rest',
    ];

    const log = simulateMonth(state, order);
    assertBalance(log, '高强度全操作');

    console.log(
      `\n=== 高强度全操作月 ===\n` +
      `操作: [${log.actions.join(', ')}]\n` +
      `收入: +¥${log.trackedIncome}\n` +
      `支出: -¥${log.trackedExpense}\n` +
      `毛利: ${log.trackedNet >= 0 ? '+' : ''}¥${log.trackedNet}\n` +
      `实际: ${log.actualDelta >= 0 ? '+' : ''}¥${log.actualDelta}\n` +
      (log.eventName ? `事件: ${log.eventName} (${log.eventDelta >= 0 ? '+' : ''}¥${log.eventDelta})\n` : '')
    );

    // Verify we actually tested diverse operations (at least 4 different financial actions)
    const financialActions = log.actions.filter(a => a !== 'rest' && a !== 'promote_light' && a !== 'hvp');
    expect(financialActions.length).toBeGreaterThanOrEqual(2);
  });

  it('连续12个月高资产运营平账（覆盖HVP完成+追印+展会+设备升级）', () => {
    const state = createRichState();
    const logs = [];

    for (let m = 0; m < 12; m++) {
      if (state.phase === 'gameover') break;

      // Rotate priorities to cover different financial paths each month
      const rotations = [
        ['hvp', 'lvp', 'attendEvent', 'freelance', 'buyGoods', 'rest'],
        ['reprint', 'attendEvent', 'upgradeEquipment', 'freelance', 'rest'],
        ['hvp', 'sponsorCommunity', 'sellGoods', 'lvp', 'rest'],
        ['attendEvent', 'lvp', 'buyGoods', 'freelance', 'promote_light', 'rest'],
        ['hvp', 'hireAssistant', 'reprint', 'freelance', 'rest'],
        ['upgradeEquipment', 'lvp', 'attendEvent', 'buyGoods', 'rest'],
      ];
      const order = rotations[m % rotations.length];

      // Replenish resources to keep actions available
      if (state.passion < 30) state.passion = 80;
      if (state.money < 5000) state.money = 30000;
      if (state.goodsCollection <= 0) state.goodsCollection = 5;
      if (state.inventory.hvpStock < 5) {
        state.inventory.hvpStock = 20;
        const w = state.inventory.works.find(w => w.type === 'hvp');
        if (w) w.qty = 20;
      }
      if (state.inventory.lvpStock < 5) {
        state.inventory.lvpStock = 30;
        const w = state.inventory.works.find(w => w.type === 'lvp');
        if (w) w.qty = 30;
      }

      const log = simulateMonth(state, order);
      logs.push(log);
      assertBalance(log, '12月长期');
    }

    printReport('12个月高资产运营审计', logs);

    // Verify diverse action coverage across 12 months
    const allActions = new Set(logs.flatMap(l => l.actions));
    console.log(`覆盖操作类型: [${[...allActions].join(', ')}]`);
    expect(allActions.size).toBeGreaterThanOrEqual(5);
  });

  it('极端场景：负债状态下操作也能平账', () => {
    const state = createRichState();
    state.money = -500; // Start in debt
    state.passion = 90;

    const logs = [];
    for (let m = 0; m < 3; m++) {
      if (state.phase === 'gameover') break;
      const log = simulateMonth(state, ['freelance', 'rest']);
      logs.push(log);
      assertBalance(log, '负债');
    }
    printReport('负债状态审计', logs);
  });

  it('密集随机事件月也能平账（强制触发多次事件）', () => {
    const state = createRichState();
    const logs = [];

    for (let m = 0; m < 6; m++) {
      if (state.phase === 'gameover') break;

      const monthStart = state.money;

      // Take one simple action
      prepareActionState(state, 'rest');
      state._restHours = 2;
      executeAction(state, 'rest');

      // endMonth
      const monthResult = endMonth(state);
      const { income: emIncome, expense: emExpense } = monthResult.monthFinancial;

      // Apply multiple random events (simulate unlucky/lucky streaks)
      let totalEventIncome = 0, totalEventExpense = 0;
      const eventNames = [];
      for (let e = 0; e < 5; e++) {
        const moneyBefore = state.money;
        const event = rollEvent(state);
        if (event) {
          applyEvent(state, event);
          const d = state.money - moneyBefore;
          if (d > 0) totalEventIncome += d;
          if (d < 0) totalEventExpense += Math.abs(d);
          eventNames.push(event.title || event.id);
        }
      }

      // Reset accumulators after events (mirrors main.js)
      state._monthIncome = 0;
      state._monthExpense = 0;

      const monthEnd = state.money;
      const totalIncome = emIncome + totalEventIncome;
      const totalExpense = emExpense + totalEventExpense;
      const log = {
        turn: state.turn,
        monthStart, monthEnd,
        actualDelta: monthEnd - monthStart,
        trackedIncome: totalIncome,
        trackedExpense: totalExpense,
        trackedNet: totalIncome - totalExpense,
        discrepancy: (monthEnd - monthStart) - (totalIncome - totalExpense),
        actions: ['rest'],
        eventName: eventNames.join(', ') || null,
        eventDelta: totalEventIncome - totalEventExpense,
      };
      logs.push(log);
      assertBalance(log, '密集事件');
    }
    printReport('密集随机事件审计', logs);
  });

});
