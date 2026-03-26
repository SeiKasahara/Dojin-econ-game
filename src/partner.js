/**
 * Partner & Contacts Pool System (搭档与人脉池)
 * Manages partner types, contacts pool, candidate generation, affinity tracking
 */

// Inline life stage check to avoid circular import with engine.js
function getLifeStage(turn) {
  if (turn <= 1) return 'summer';
  if (turn <= 49) return 'university';
  return 'work';
}

// === Partner Types ===
// feeRange: [min, max] — cost to hire. 15% chance of fee=0 (人好)
export const PARTNER_TYPES = {
  supportive: { id: 'supportive', name: '默契搭档', emoji: 'smiley', desc: '合作愉快，效率提升', salesBonus: 1.3, passionPerTurn: 2, dramaChance: 0, feeRange: [600, 1000] },
  demanding:  { id: 'demanding',  name: '严格搭档', emoji: 'smiley-angry', desc: '要求极高，出品精良但压力大', salesBonus: 1.5, passionPerTurn: -3, dramaChance: 0.12, feeRange: [1000, 1500] },
  unreliable: { id: 'unreliable', name: '不靠谱搭档', emoji: 'smiley-nervous', desc: '有时很给力，有时完全消失', salesBonus: 0.9, passionPerTurn: -1, dramaChance: 0.25, feeRange: [400, 800] },
  toxic:      { id: 'toxic',      name: '有毒搭档', emoji: 'skull', desc: '经常制造矛盾，但就是甩不掉...', salesBonus: 1.1, passionPerTurn: -6, dramaChance: 0.35, feeRange: [800, 1200] },
};

export function rollPartnerType(social = 0) {
  const r = Math.random();
  const supportiveThresh = 0.50 + social * 0.05;
  const toxicThresh = Math.max(0.95, 0.92 + social * 0.02);
  if (r < supportiveThresh) return 'supportive';
  if (r < 0.75 + social * 0.02) return 'demanding';
  if (r < toxicThresh) return 'unreliable';
  return 'toxic';
}

// === Contacts Pool (人脉池) ===
const PARTNER_NAMES = [
  '星野碧', '墨染', '月见里', '七色的猫窝', 'Mio',
  '雪代薰', '桃乐丝', '取名真的好难', '波奇不是一里', '祝福姬',
  '顾长卿', '芒果慕斯小蛋糕', '久保莉香', '合意唯', '风的嘶吼',
  '红茶很甜', '无光之海', '漪', 'chuchu', '静音零',
];
const CONTACT_AVATAR_COUNT = 15; // partner/1.webp ~ 15.webp

// Tiered bio system: acquaintance → vague, familiar → hints, trusted → clear
// Toxic disguised as normal at acquaintance/familiar tiers
const CONTACT_BIOS = {
  acquaintance: {
    supportive: ['加过好友，偶尔点赞', '在展会上打过招呼', '群里见过几次，印象不错'],
    demanding:  ['加过好友，偶尔点赞', '看过TA的作品，质量很高', '群里见过几次，似乎很认真'],
    unreliable: ['加过好友，偶尔点赞', '在展会上打过招呼', '群里见过几次，感觉挺随性'],
    toxic:      ['加过好友，偶尔点赞', '很健谈很热情的样子', '主动加的好友，看起来交际很广'],
  },
  familiar: {
    supportive: ['合作过的人都说好，效率高沟通顺畅', '画风很稳，约定的事从不失约', '人超好的，据说从来不催稿'],
    demanding:  ['据说出品质量极高但要求严格', '完美主义者，细节要求苛刻', '作品质量没话说，就是要求很高'],
    unreliable: ['有才华但好像不太靠谱', '回复消息时快时慢', '有时很给力，有时人间蒸发'],
    toxic:      ['在圈里认识很多人，人脉很广', '说话很直接，看起来有想法', '很会来事，但总感觉哪里不对…'],
  },
  trusted: {
    supportive: ['你最信任的搭档，合作默契无间', '可靠到不需要多说，彼此心里有数', '一起经历了很多，信任满满'],
    demanding:  ['严格但你知道TA是为了更好的作品', '要求高但效果确实好，磨合出了默契', '虽然苛刻但你知道这是专业'],
    unreliable: ['你很了解TA——有灵感时惊人，没灵感时消失', '靠谱不靠谱五五开，但你接受了', '知道TA的毛病了，但也知道TA的天花板'],
    toxic:      ['有毒搭档 — 经常制造矛盾', '小心！但价格便宜，偶尔也能用', '你已经看清了TA的真面目'],
  },
};

export function getContactBio(type, tier) {
  const pool = CONTACT_BIOS[tier]?.[type] || CONTACT_BIOS.acquaintance.supportive;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getContactTier(affinity) {
  if (affinity >= 4) return 'trusted';
  if (affinity >= 2) return 'familiar';
  return 'acquaintance';
}

export function getVisibleType(contact) {
  if (contact.tier === 'trusted') return contact.pType;
  if (contact.tier === 'familiar' && contact.pType !== 'toxic') return contact.pType;
  return null;
}

export function getMaxContacts(state) {
  return 8 + (state.endowments?.social || 0) * 2;
}

export function addContact(state, { source, affinity = 1.0, forceType = null }) {
  if (!state.contacts) state.contacts = [];
  if (state.contacts.length >= getMaxContacts(state)) return null;

  const usedNames = new Set(state.contacts.map(c => c.name));
  const available = PARTNER_NAMES.filter(n => !usedNames.has(n));
  const name = available.length > 0
    ? available[Math.floor(Math.random() * available.length)]
    : PARTNER_NAMES[Math.floor(Math.random() * PARTNER_NAMES.length)] + '²';

  const usedAvatars = new Set(state.contacts.map(c => c.avatarIdx));
  const freeAvatars = Array.from({ length: CONTACT_AVATAR_COUNT }, (_, i) => i + 1).filter(i => !usedAvatars.has(i));
  const avatarIdx = freeAvatars.length > 0
    ? freeAvatars[Math.floor(Math.random() * freeAvatars.length)]
    : 1 + Math.floor(Math.random() * CONTACT_AVATAR_COUNT);

  const pType = forceType || rollPartnerType(state.endowments?.social || 0);
  const clampedAffinity = Math.min(5, Math.max(0, affinity));
  const tier = getContactTier(clampedAffinity);

  const contact = {
    id: state.contactNextId++,
    name, avatarIdx, pType, tier,
    affinity: clampedAffinity,
    bio: getContactBio(pType, tier),
    source,
    metTurn: state.turn,
  };
  state.contacts.push(contact);
  return contact;
}

export function updateContactAffinity(state, contactId, delta) {
  const c = (state.contacts || []).find(x => x.id === contactId);
  if (!c) return;
  c.affinity = Math.min(5, Math.max(0, c.affinity + delta));
  const newTier = getContactTier(c.affinity);
  if (newTier !== c.tier) {
    c.tier = newTier;
    c.bio = getContactBio(c.pType, newTier);
  }
}

// === Partner Candidate Generation (draws from contacts pool, fallback to strangers) ===
export function generatePartnerCandidates(state) {
  if (state.contacts && state.contacts.length > 0) {
    return [...state.contacts]
      .sort((a, b) => b.affinity - a.affinity)
      .map(c => ({
        name: c.name,
        bio: c.bio,
        _type: c.pType,
        contactId: c.id,
        avatarIdx: c.avatarIdx,
        tier: c.tier,
        affinity: c.affinity,
        visibleType: getVisibleType(c),
      }));
  }

  // Fallback: random stranger generation
  const social = state.endowments.social || 0;
  let prob = Math.min(0.9, state.reputation / (state.reputation + 3) + social * 0.08);
  if (getLifeStage(state.turn) === 'work') prob *= 0.6;
  const workYears = (state.turn - 50) / 12;
  if (getLifeStage(state.turn) === 'work' && workYears > 3 && (state.turn - state.lastCreativeTurn) <= 6) prob += 0.1;
  if (Math.random() >= prob) return null;

  const count = 2 + (Math.random() < 0.4 ? 1 : 0);
  const usedNames = new Set();
  const candidates = [];
  for (let i = 0; i < count; i++) {
    const type = rollPartnerType(social);
    let name;
    do { name = PARTNER_NAMES[Math.floor(Math.random() * PARTNER_NAMES.length)]; } while (usedNames.has(name));
    usedNames.add(name);
    const bio = getContactBio(type, 'acquaintance');
    candidates.push({ name, bio, _type: type, contactId: null, avatarIdx: null, tier: null, affinity: null, visibleType: null });
  }
  return candidates;
}

// === Contacts Pool Maintenance (called each turn) ===
export function tickContacts(state, result) {
  if (!state.contacts || state.contacts.length === 0) return;
  const maxContacts = getMaxContacts(state);

  // Monthly affinity decay for inactive contacts (not current partner)
  for (const c of state.contacts) {
    if (c.id === state.activeContactId) continue;
    c.affinity = Math.max(0, c.affinity - 0.05);
    const newTier = getContactTier(c.affinity);
    if (newTier !== c.tier) { c.tier = newTier; c.bio = getContactBio(c.pType, newTier); }
  }

  // Remove contacts that drifted to 0 affinity (lost touch)
  const lost = state.contacts.filter(c => c.affinity <= 0 && c.id !== state.activeContactId);
  if (lost.length > 0) {
    state.contacts = state.contacts.filter(c => c.affinity > 0 || c.id === state.activeContactId);
    result.deltas.push({ icon: 'user-minus', label: `${lost.map(c => c.name).join('、')}渐渐失联了`, value: `人脉-${lost.length}`, positive: false });
  }

  // Over cap: lowest affinity contacts drift away
  if (state.contacts.length > maxContacts) {
    const sorted = [...state.contacts]
      .filter(c => c.id !== state.activeContactId)
      .sort((a, b) => a.affinity - b.affinity);
    const excess = state.contacts.length - maxContacts;
    const toRemove = sorted.slice(0, excess);
    if (toRemove.length > 0) {
      const removeIds = new Set(toRemove.map(c => c.id));
      state.contacts = state.contacts.filter(c => !removeIds.has(c.id));
      result.deltas.push({ icon: 'user-minus', label: '人脉圈维护不过来', value: `${toRemove.map(c => c.name).join('、')}淡出了`, positive: false });
    }
  }
}
