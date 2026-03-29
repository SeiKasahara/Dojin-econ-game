// === Doujin Event Generation (同人展) ===
const EVENT_CITIES = ['本市', '邻市', '省会', '一线城市', '异地'];
const EVENT_TRAVEL_COST = { '本市': 50, '邻市': 200, '省会': 500, '一线城市': 800, '异地': 1200 };
const EVENT_NAMES_BIG = ['CP大展', '同人祭', '创作者之夜', '超级同人嘉年华'];
const EVENT_NAMES_SMALL = ['同好交流会', '小型贩售会', '创作者市集', '主题Only'];

function generateEventsForMonth(cs, month) {
  const events = [];

  // Big events: ~3/year for small communities, more for large
  // Typically in Jan(寒假), May(五一), Aug(暑假), Oct(国庆)
  const isBigMonth = [1, 5, 8, 10].includes(month);
  if (isBigMonth) {
    const city = cs > 15000 ? EVENT_CITIES[3] : cs > 5000 ? EVENT_CITIES[2] : EVENT_CITIES[1];
    events.push({
      name: EVENT_NAMES_BIG[Math.floor(Math.random() * EVENT_NAMES_BIG.length)],
      city,
      travelCost: EVENT_TRAVEL_COST[city],
      salesBoost: 3.0,  // face-to-face: I→1, huge conversion boost
      reputationBoost: 0.25,
      passionBoost: 8,
      size: 'big',
    });
  }

  // Small events: frequency scales with community size
  // Small community: ~1/quarter, Large: nearly monthly
  const smallEventChance = cs > 15000 ? 0.7 : cs > 8000 ? 0.5 : cs > 3000 ? 0.3 : 0.1;
  if (Math.random() < smallEventChance) {
    const city = Math.random() < 0.6 ? '本市' : '邻市';
    events.push({
      name: EVENT_NAMES_SMALL[Math.floor(Math.random() * EVENT_NAMES_SMALL.length)],
      city,
      travelCost: EVENT_TRAVEL_COST[city],
      salesBoost: 1.8,
      reputationBoost: 0.12,
      passionBoost: 3,
      size: 'small',
    });
  }

  // Occasionally: distant but high-value event
  if (cs > 10000 && Math.random() < 0.08) {
    events.push({
      name: '全国同人盛典',
      city: '异地',
      travelCost: EVENT_TRAVEL_COST['异地'],
      salesBoost: 5.0,
      reputationBoost: 0.40,
      passionBoost: 12,
      size: 'mega',
    });
  }

  return events;
}

export function generateEvents(state) {
  const cs = state.market ? state.market.communitySize : 10000;
  const month = ((state.turn + 6) % 12) + 1;
  return generateEventsForMonth(cs, month);
}

/**
 * Generate a 12-month event calendar starting from startTurn.
 * Each event gets a unique calendarId for attendance tracking.
 */
export function generateEventCalendar(state, startTurn) {
  const cs = state.market ? state.market.communitySize : 10000;
  const calendar = [];
  let nextId = 0;
  for (let i = 0; i < 12; i++) {
    const turn = startTurn + i;
    const month = ((turn + 6) % 12) + 1;
    const events = generateEventsForMonth(cs, month);
    events.forEach(e => { e.calendarId = nextId++; });
    calendar.push({ turn, month, events });
  }
  return calendar;
}

/**
 * Ensure event calendar exists and covers the current turn.
 * Called from endMonth and can be called from UI for lazy init.
 */
export function ensureEventCalendar(state) {
  if (!state.eventCalendar || state.turn >= state.eventCalendarStart + 12) {
    state.eventCalendar = generateEventCalendar(state, state.turn);
    state.eventCalendarStart = state.turn;
    state.calendarEventsAttended = [];
    // Sync current turn's events so availableEvents matches the calendar
    const curEntry = state.eventCalendar.find(e => e.turn === state.turn);
    if (curEntry) state.availableEvents = curEntry.events;
  }
}
