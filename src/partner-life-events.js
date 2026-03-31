/**
 * Partner Life Events — NPC lifecycle events (退圈/危机/淡出)
 * Generates pending events during tickContacts; resolved via UI choice.
 */

import { addContact } from './partner.js';

// === Exit chance curve ===
// NPC monthly exit probability increases over time; relationship depth reduces it.
export function getExitChance(contact, state) {
  const monthsSinceMet = state.turn - contact.metTurn;

  // First 24 months: no exit
  if (monthsSinceMet < 24) return 0;

  // Base: grows linearly after 2 years
  let base = (monthsSinceMet - 24) * 0.004; // 3y=0.048, 5y=0.144

  // Relationship depth reduces exit chance
  if (contact.affinity >= 4) base *= 0.4;
  else if (contact.affinity >= 2) base *= 0.7;

  // pType modifiers
  if (contact.pType === 'unreliable') base *= 1.5;
  if (contact.pType === 'supportive') base *= 0.7;

  return Math.min(0.15, base);
}

// === Life event types ===
const LIFE_EVENTS = {
  financial: {
    id: 'financial',
    emoji: 'coins',
    title: (name) => `${name}遇到了经济困难`,
    desc: (name) => `${name}犹豫了很久，还是开口了："最近真的周转不开……能不能借我点钱？"`,
    condition: (contact) => contact.affinity >= 2,
    options: (contact, state) => {
      const amount = Math.min(
        Math.max(500, Math.round(state.money * 0.05)),
        2000
      );
      return [
        {
          id: 'lend', label: `借钱（¥${amount}）`,
          desc: '好朋友嘛，能帮就帮',
          available: state.money >= amount,
          unavailableReason: '资金不足',
        },
        {
          id: 'decline', label: '婉拒',
          desc: '不好意思，我自己也不宽裕……',
          available: true,
        },
      ];
    },
    resolve: (contact, choiceId, state) => {
      const amount = Math.min(
        Math.max(500, Math.round(state.money * 0.05)),
        2000
      );
      if (choiceId === 'lend') {
        state.money -= amount;
        // 70% chance of repayment in 3-6 months
        if (Math.random() < 0.7) {
          const repayTurn = state.turn + 3 + Math.floor(Math.random() * 4);
          state._pendingRepayments = state._pendingRepayments || [];
          state._pendingRepayments.push({ contactId: contact.id, contactName: contact.name, amount, repayTurn });
        }
        return {
          affinityDelta: 1.5,
          removeContact: false,
          deltas: [
            { icon: 'coins', label: `借给${contact.name}`, value: `-¥${amount}`, positive: false },
            { icon: 'heart', label: '好感上升', value: `+1.5`, positive: true },
          ],
        };
      }
      return {
        affinityDelta: -0.5,
        removeContact: false,
        deltas: [
          { icon: 'chat-circle', label: `婉拒了${contact.name}`, value: '好感-0.5', positive: false },
        ],
      };
    },
  },

  jobless: {
    id: 'jobless',
    emoji: 'briefcase',
    title: (name) => `${name}失业了`,
    desc: (name) => `${name}发来消息："工作没了……你那边认不认识什么门路？"`,
    condition: (contact) =>
      contact.affinity >= 2 &&
      (contact.pType === 'supportive' || contact.pType === 'demanding'),
    options: (contact, state) => {
      // Check if player has resources to help
      const hasPublisher = state.reputation >= 6;
      const hasEventNetwork = (state.eventLog?.length || 0) >= 5;
      const canRefer = hasPublisher || hasEventNetwork;
      const social = state.endowments?.social || 0;

      const referDesc = hasPublisher
        ? '介绍出版社/编辑方向的工作'
        : '介绍展会/社区相关的工作';

      return [
        {
          id: 'refer', label: '帮忙介绍工作',
          desc: referDesc + (social >= 3 ? '（社交加成+20%）' : ''),
          available: canRefer,
          unavailableReason: '你目前没有足够的人脉资源',
        },
        {
          id: 'comfort', label: '安慰但帮不上忙',
          desc: '表示理解，但实在没有门路……',
          available: true,
        },
      ];
    },
    resolve: (contact, choiceId, state) => {
      if (choiceId === 'refer') {
        const social = state.endowments?.social || 0;
        const success = Math.random() < (0.7 + (social >= 3 ? 0.2 : 0));
        if (success) {
          return {
            affinityDelta: 2,
            removeContact: false,
            deltas: [
              { icon: 'handshake', label: `帮${contact.name}找到了工作`, value: '好感+2', positive: true },
            ],
          };
        }
        return {
          affinityDelta: 0.5,
          removeContact: false,
          deltas: [
            { icon: 'handshake', label: `介绍没成，但对方记住了你的好意`, value: '好感+0.5', positive: true },
          ],
        };
      }
      // comfort: 50% NPC exits
      const exits = Math.random() < 0.5;
      return {
        affinityDelta: -0.3,
        removeContact: exits,
        deltas: exits
          ? [{ icon: 'user-minus', label: `${contact.name}退圈了`, value: '失联', positive: false }]
          : [{ icon: 'chat-circle', label: `${contact.name}暂时还在坚持`, value: '好感-0.3', positive: false }],
      };
    },
  },

  burnout: {
    id: 'burnout',
    emoji: 'moon',
    title: (name) => `${name}想退圈`,
    desc: (name) => `${name}发了条动态："累了，不想干了，感觉失去了当初的热情。"`,
    condition: (contact) => contact.affinity >= 2,
    options: (contact, state) => [
      {
        id: 'recommend', label: '请对方推荐个人再走',
        desc: '至少留个联系方式吧',
        available: true,
      },
      {
        id: 'retain', label: '挽留（热情-5）',
        desc: '不要走啊，我们还可以一起做很多事',
        available: state.passion >= 5,
        unavailableReason: '热情不足',
      },
      {
        id: 'farewell', label: '说声保重',
        desc: '尊重对方的选择',
        available: true,
      },
    ],
    resolve: (contact, choiceId, state) => {
      if (choiceId === 'recommend') {
        // NPC leaves but introduces a replacement
        const newContact = addContact(state, { source: 'friend_intro', affinity: 1.5 });
        const deltas = [
          { icon: 'user-minus', label: `${contact.name}退圈了`, value: '告别', positive: false },
        ];
        if (newContact) {
          deltas.push({ icon: 'address-book', label: `${contact.name}推荐了${newContact.name}`, value: '新人脉+1', positive: true });
        }
        return { affinityDelta: 0, removeContact: true, deltas };
      }
      if (choiceId === 'retain') {
        state.passion -= 5;
        const success = Math.random() < 0.3;
        if (success) {
          return {
            affinityDelta: 2,
            removeContact: false,
            deltas: [
              { icon: 'heart', label: `${contact.name}`, value: '"……好吧，再试试看"', positive: true },
              { icon: 'heart', label: '精力消耗', value: '-5', positive: false },
            ],
          };
        }
        return {
          affinityDelta: 0.5,
          removeContact: true,
          deltas: [
            { icon: 'user-minus', label: `${contact.name}`, value: '"谢谢你，但我真的累了"', positive: false },
            { icon: 'heart', label: '精力消耗', value: '-5', positive: false },
          ],
        };
      }
      // farewell
      return {
        affinityDelta: 0,
        removeContact: true,
        deltas: [
          { icon: 'user-minus', label: `${contact.name}退圈了`, value: '保重', positive: false },
        ],
      };
    },
  },

  family: {
    id: 'family',
    emoji: 'house',
    title: (name) => `${name}家里出事了`,
    desc: (name) => `${name}发来消息："家里出了些事，可能要消失一段时间……"`,
    condition: (contact) => contact.affinity >= 4, // trusted only
    options: (contact, state) => {
      const giftCost = 200 + Math.floor(Math.random() * 300);
      return [
        {
          id: 'gift', label: `送点东西关心一下（¥${giftCost}）`,
          desc: '虽然帮不上大忙，但至少让对方知道有人在意',
          available: state.money >= giftCost,
          unavailableReason: '资金不足',
          _giftCost: giftCost,
        },
        {
          id: 'words', label: '说声保重',
          desc: '表达关心',
          available: true,
        },
      ];
    },
    resolve: (contact, choiceId, state, option) => {
      if (choiceId === 'gift') {
        const cost = option?._giftCost || 300;
        state.money -= cost;
        // Mark unavailable 3-6 months, will return
        contact._unavailableUntil = state.turn + 3 + Math.floor(Math.random() * 4);
        return {
          affinityDelta: 1,
          removeContact: false,
          deltas: [
            { icon: 'gift', label: `送了东西给${contact.name}`, value: `-¥${cost}`, positive: false },
            { icon: 'heart', label: '好感上升', value: '+1', positive: true },
            { icon: 'hourglass', label: `${contact.name}暂时不可用`, value: '等待回归', positive: false },
          ],
        };
      }
      // words: 50% chance they don't come back
      const willReturn = Math.random() < 0.5;
      contact._unavailableUntil = willReturn
        ? state.turn + 3 + Math.floor(Math.random() * 4)
        : Infinity; // will be cleaned up by tickContacts as affinity decays
      return {
        affinityDelta: 0,
        removeContact: false,
        deltas: [
          { icon: 'chat-circle', label: `对${contact.name}说了保重`, value: willReturn ? '等待回归' : '可能不会回来了', positive: false },
        ],
      };
    },
  },
};

// === Roll a life event for this tick ===
// Returns null or { event, contact } — at most one per month.
export function rollLifeEvent(state) {
  if (!state.contacts || state.contacts.length === 0) return null;

  // Filter eligible contacts (familiar+, not current partner, not recently evented, not unavailable)
  const eligible = state.contacts.filter(c => {
    if (c.id === state.activeContactId) return false;
    if (c.affinity < 2) return false;
    if (c._lastLifeEventTurn && state.turn - c._lastLifeEventTurn < 6) return false;
    if (c._unavailableUntil && state.turn < c._unavailableUntil) return false;
    return true;
  });
  if (eligible.length === 0) return null;

  // Check each eligible contact for exit chance → event trigger
  for (const contact of eligible) {
    const exitChance = getExitChance(contact, state);
    if (exitChance <= 0 || Math.random() >= exitChance) continue;

    // Pick a suitable event type
    const eventTypes = Object.values(LIFE_EVENTS).filter(e => e.condition(contact));
    if (eventTypes.length === 0) continue;

    const event = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    contact._lastLifeEventTurn = state.turn;

    return { event, contact };
  }

  return null;
}

// === Process repayments ===
export function processRepayments(state, result) {
  if (!state._pendingRepayments || state._pendingRepayments.length === 0) return;
  const due = state._pendingRepayments.filter(r => state.turn >= r.repayTurn);
  if (due.length === 0) return;

  for (const r of due) {
    state.money += r.amount;
    result.deltas.push({
      icon: 'coins',
      label: `${r.contactName}还钱了`,
      value: `+¥${r.amount}`,
      positive: true,
    });
  }
  state._pendingRepayments = state._pendingRepayments.filter(r => state.turn < r.repayTurn);
}

// === Process unavailable contacts returning ===
export function processUnavailableReturns(state, result) {
  if (!state.contacts) return;
  for (const c of state.contacts) {
    if (c._unavailableUntil && c._unavailableUntil !== Infinity && state.turn >= c._unavailableUntil) {
      c._unavailableUntil = null;
      result.deltas.push({
        icon: 'user-plus',
        label: `${c.name}回来了`,
        value: '恢复可用',
        positive: true,
      });
    }
  }
}

// === Resolve a life event choice (called from UI) ===
export function resolveLifeEvent(state, eventId, contactId, choiceId, option) {
  const eventDef = LIFE_EVENTS[eventId];
  if (!eventDef) return null;
  const contact = (state.contacts || []).find(c => c.id === contactId);
  if (!contact) return null;

  const result = eventDef.resolve(contact, choiceId, state, option);

  // Apply affinity change
  if (result.affinityDelta) {
    contact.affinity = Math.min(5, Math.max(0, contact.affinity + result.affinityDelta));
  }

  // Remove contact if needed
  if (result.removeContact) {
    state.contacts = state.contacts.filter(c => c.id !== contactId);
  }

  return result;
}

export { LIFE_EVENTS };
