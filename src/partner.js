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

// === NPC Attributes ===
export function rollSpecialty() {
  const r = Math.random();
  if (r < 0.12) return 'music';    // 12% musicians
  if (r < 0.25) return 'writing';  // 13% writers
  return 'art';                     // 75% artists
}

export function rollNpcTier() {
  return Math.random() < 0.2 ? 'big' : 'small';
}

export function rollNpcReputation(tier) {
  return tier === 'big'
    ? 4 + Math.random() * 4        // big: 4-8
    : 0.5 + Math.random() * 3.5;   // small: 0.5-4
}

// Icebreaker: whether NPC is willing to connect with player
export function getIcebreakerChance(state, npc) {
  let base = 0.3;
  const playerRep = state.reputation || 0;
  const social = state.obsessiveTrait === 'talent' ? 0 : (state.endowments?.social || 0);

  // Social attribute global bonus
  base += social * 0.08;

  if (npc.npcTier === 'small') {
    // Small circle: senior NPCs are more willing to mentor newcomers
    base += Math.min(0.15, (npc.npcReputation || 0) * 0.02);
  } else {
    // Big circle: prefer peers or higher reputation
    const repGap = playerRep - (npc.npcReputation || 0);
    base += Math.max(-0.3, Math.min(0.2, repGap * 0.1));
  }

  return Math.max(0.05, Math.min(0.95, base));
}

// Check if player can create music (has a familiar+ music contact)
export function canCreateMusic(state) {
  return (state.contacts || []).some(c =>
    c.specialty === 'music' &&
    c.affinity >= 2 &&
    (c.revealed || c.tier !== 'acquaintance')
  );
}

// === Contacts Pool (人脉池) ===
const CONTACT_AVATAR_COUNT = 25; // partner/1.webp ~ 25.webp

// Priority name pool — used first before falling back to procedural generation
const PRIORITY_NAMES = [
  '星野碧', '墨染', '月见里', '七色的猫窝', 'Mio',
  '雪代薰', '桃乐丝', '取名真的好难', '波奇不是一里', '祝福姬',
  '顾长卿', '芒果慕斯小蛋糕', '久保莉香', '合意唯', '风的嘶吼',
  '红茶很甜', '无光之海', '漪', 'chuchu', '静音零',
  '白鸟瑠璃', '半糖奶绿', 'sakanaction', '深海信号', '枕边的猫',
];

// --- Procedural name generator (doujin circle handle style) ---
// Combines components to produce ~2000+ unique names
const _JP_FAMILY = ['星野','月見','雪代','久保','白鸟','藤原','神崎','高梨','橘','水無','早乙女','天城','如月','朝日','夕霧','桐生','風間','御影','一之瀬','柏木'];
const _JP_GIVEN = ['碧','薰','莉香','瑠璃','遥','凛','蓮','葵','紬','柚希','千早','深雪','真白','沙耶','暁','翼','零','泉','朔','鈴音'];
const _CN_FAMILY = ['顾','林','沈','苏','江','秦','陆','叶','萧','温','裴','霍','楚','季','卫','谢','容','宋','颜','白'];
const _CN_GIVEN = ['长卿','清寒','听雨','念安','知归','怀瑾','映雪','拾光','初晴','暮云','临渊','浮生','无忧','若水','行舟','予安','辞镜','栖迟','望舒','扶摇'];
const _NET_A = ['半糖','无光','深海','枕边','七色','芒果','红茶','焦糖','薄荷','冰凉','暴风','午夜','暮色','晨雾','星尘','月光','极光','银河','流萤','琥珀'];
const _NET_B = ['奶绿','之海','信号','的猫','猫窝','小蛋糕','很甜','拿铁','巧克力','柠檬水','暴击','电台','工坊','实验室','研究所','制造局','档案馆','观测站','发射塔','收容所'];
const _PHRASE = ['取名真的好难','波奇不是一里','今天也在摸鱼','明天再画吧','又是赶稿的一天','为什么还没画完',
  '摆烂的第N天','灵感去哪了','还差亿点点','不想上班只想画','热情值归零了','下次一定认真',
  '废稿堆成山','通宵冠军','催稿勿扰','画到天亮','存稿为零','社恐创作者','快逃这是坑',
  '一笔入魂','不鸽不舒服','永远在起稿','告别拖延症','效率max','鸽王本鸽'];
const _EN = ['Mio','chuchu','Ruri','Noel','Petit','Luca','Rin','Coco','Maple','Hana',
  'Sora','Kuro','Shiro','Neko','Yuki','Aoi','Tomo','Kaze','Suzu','Nana',
  'Lyra','Iris','Aria','Luna','Vega','Nori','Tama','Miku','Saki','Yua'];
const _SUFFIX = ['制作组','工房','堂','亭','屋','社','局','的窝','的店','小馆'];

function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateName(usedNames) {
  // Priority: pick from curated names first
  const availPriority = PRIORITY_NAMES.filter(n => !usedNames.has(n));
  if (availPriority.length > 0) return availPriority[Math.floor(Math.random() * availPriority.length)];

  // Fallback: procedural generation — try up to 30 times to get a unique name
  for (let attempt = 0; attempt < 30; attempt++) {
    let name;
    const style = Math.random();
    if (style < 0.20) {
      // Japanese style: family + given
      name = _pick(_JP_FAMILY) + _pick(_JP_GIVEN);
    } else if (style < 0.35) {
      // Chinese style: family + given
      name = _pick(_CN_FAMILY) + _pick(_CN_GIVEN);
    } else if (style < 0.55) {
      // Internet handle: A + B
      name = _pick(_NET_A) + _pick(_NET_B);
    } else if (style < 0.70) {
      // Phrase style (sentence-like handle)
      name = _pick(_PHRASE);
    } else if (style < 0.82) {
      // English name
      name = _pick(_EN);
    } else if (style < 0.92) {
      // Circle name: NET_A/EN + suffix
      name = (Math.random() < 0.5 ? _pick(_NET_A) : _pick(_EN)) + _pick(_SUFFIX);
    } else {
      // Mixed: CN given or JP given solo
      name = Math.random() < 0.5 ? _pick(_CN_GIVEN) : _pick(_JP_GIVEN);
    }
    if (!usedNames.has(name)) return name;
  }
  // Fallback: append random number
  return _pick(_NET_A) + _pick(_NET_B) + Math.floor(Math.random() * 100);
}

// Tiered bio system: acquaintance → vague, familiar → hints, trusted → clear
// Toxic disguised as normal at acquaintance/familiar tiers
// Source-specific bios ensure causal consistency (e.g. 展会认识的不会出现"网上互关")
const SOURCE_BIOS = {
  acquaintance: {
    event_card: {
      supportive: ['展会上交换过名片，人很温和', '漫展上聊过几句，感觉很好相处', '展会上见过，很有亲和力'],
      demanding:  ['展会上见过TA的摊位，作品很专业', '漫展上交换过名片，感觉很认真', '展会上聊过，对创作要求很高的样子'],
      unreliable: ['展会上打过招呼，感觉挺随性', '漫展上碰到过，很开朗但有点散漫', '展会上交换过名片，不知道还记不记得'],
      toxic:      ['展会上认识的，很健谈很热情', '漫展上主动来搭话，看起来人脉很广', '展会上结识的，看起来交际很广'],
    },
    online: {
      supportive: ['在网上互关了，偶尔互动', '转发过TA的作品，感觉不错', '网上认识的，聊过几次印象挺好'],
      demanding:  ['网上关注了TA，作品质量很高', '看过TA发的作品，很专业', '网上认识的，对创作似乎很认真'],
      unreliable: ['在网上互关了，偶尔点赞', '网上聊过几次，回复时快时慢', '关注了TA，更新频率不太稳定'],
      toxic:      ['网上主动加的好友，看起来交际很广', '在网上很活跃，经常发动态', '网上认识的，很健谈很热情的样子'],
    },
    sponsor: {
      supportive: ['社区活动上认识的，人很随和', '赞助活动时聊过，感觉很好相处', '线下活动上见过，印象不错'],
      demanding:  ['社区活动上认识的，感觉很专业', '赞助活动时见过TA的作品，质量很高', '线下活动聊过，对创作很有追求'],
      unreliable: ['社区活动上认识的，感觉挺随性', '赞助活动时打过招呼，有点大大咧咧', '线下活动碰到过，挺随意的'],
      toxic:      ['社区活动上认识的，很健谈很热情', '赞助活动时主动来搭话的', '线下活动结识的，看起来人脉很广'],
    },
  },
  familiar: {
    friend_intro: {
      supportive: ['朋友介绍的靠谱搭档，合作过的人都说好', '朋友推荐的，画风很稳从不失约', '经朋友介绍认识的，人超好据说从来不催稿'],
    },
    event_card: {
      supportive: ['展会上认识的，合作过的人都说好', '展会上结识的老朋友，效率高沟通顺畅', '漫展上认识的，约定的事从不失约'],
      demanding:  ['展会上认识的，据说出品质量极高但要求严格', '漫展结识的完美主义者，细节要求苛刻', '展会上认识的，作品质量没话说'],
      unreliable: ['展会上认识的，有才华但好像不太靠谱', '漫展结识的，回复消息时快时慢', '展会上认识的，有时很给力有时人间蒸发'],
      toxic:      ['展会上认识的，在圈里人脉很广', '漫展结识的，说话很直接有想法', '展会上认识的，很会来事但总感觉哪里不对…'],
    },
    online: {
      supportive: ['网上认识的，合作过的人都说好', '网上结识的创作者，效率高沟通顺畅', '网上认识的，画风很稳从不失约'],
      demanding:  ['网上认识的，据说出品质量极高但要求严格', '网上结识的完美主义者，细节要求苛刻', '网上认识的，作品质量没话说'],
      unreliable: ['网上认识的，有才华但好像不太靠谱', '网上结识的，回复消息时快时慢', '网上认识的，有时很给力有时人间蒸发'],
      toxic:      ['网上认识的，在圈里人脉很广', '网上结识的，说话很直接有想法', '网上认识的，很会来事但总感觉哪里不对…'],
    },
    sponsor: {
      supportive: ['社区活动认识的，合作过的人都说好', '赞助活动结识的，效率高沟通顺畅', '线下活动认识的，画风很稳从不失约'],
      demanding:  ['社区活动认识的，据说出品质量极高但要求严格', '赞助活动结识的完美主义者，细节要求苛刻', '线下活动认识的，作品质量没话说'],
      unreliable: ['社区活动认识的，有才华但好像不太靠谱', '赞助活动结识的，回复消息时快时慢', '线下活动认识的，有时很给力有时人间蒸发'],
      toxic:      ['社区活动认识的，在圈里人脉很广', '赞助活动结识的，说话很直接有想法', '线下活动认识的，很会来事但总感觉哪里不对…'],
    },
  },
};

// Generic bios (fallback for contacts with unknown sources)
const CONTACT_BIOS = {
  acquaintance: {
    supportive: ['加过好友，偶尔点赞', '见过几次，印象不错', '互相认识，感觉挺好相处'],
    demanding:  ['加过好友，偶尔点赞', '看过TA的作品，质量很高', '见过几次，似乎很认真'],
    unreliable: ['加过好友，偶尔点赞', '见过几次，感觉挺随性', '互相认识，但不太了解'],
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

const SPECIALTY_HINTS = {
  acquaintance: { music: '', writing: '', art: '' }, // unknown at this stage
  familiar:    { music: '（擅长编曲/音乐制作）', writing: '（擅长写作）', art: '' },
  trusted:     { music: '（音乐搭档）', writing: '（文手搭档）', art: '' },
};

export function getContactBio(type, tier, source = null, specialty = null) {
  let bio;
  // Try source-specific bio first for causal consistency
  if (source) {
    const sourcePool = SOURCE_BIOS[tier]?.[source]?.[type];
    if (sourcePool && sourcePool.length > 0) {
      bio = sourcePool[Math.floor(Math.random() * sourcePool.length)];
    }
  }
  if (!bio) {
    // Fallback to generic tier/type bios
    const pool = CONTACT_BIOS[tier]?.[type] || CONTACT_BIOS.acquaintance.supportive;
    bio = pool[Math.floor(Math.random() * pool.length)];
  }
  // Append specialty hint for familiar+ contacts
  const hint = SPECIALTY_HINTS[tier]?.[specialty] || '';
  return bio + hint;
}

export function getContactTier(affinity) {
  if (affinity >= 4) return 'trusted';
  if (affinity >= 2) return 'familiar';
  return 'acquaintance';
}

export function getVisibleType(contact) {
  if (contact.revealed) return contact.pType;
  if (contact.tier === 'trusted') return contact.pType;
  if (contact.tier === 'familiar' && contact.pType !== 'toxic') return contact.pType;
  return null;
}

// Check if interactions reveal contact's true type
export function checkReveal(contact, playerSocial) {
  if (contact.revealed) return false; // already revealed, no change
  if (contact.affinity < 2) return false;

  const required = contact.pType === 'toxic' ? 4 : 3;
  if ((contact.interactions || 0) >= required) {
    contact.revealed = true;
    return true;
  }
  // Social attribute accelerates reveal
  if ((contact.interactions || 0) >= 2 && Math.random() < playerSocial * 0.1) {
    contact.revealed = true;
    return true;
  }
  return false;
}

// Add interaction count to a contact
export function addInteraction(state, contactId, amount) {
  const c = (state.contacts || []).find(x => x.id === contactId);
  if (!c) return null;
  c.interactions = (c.interactions || 0) + amount;
  const social = state.obsessiveTrait === 'talent' ? 0 : (state.endowments?.social || 0);
  const justRevealed = checkReveal(c, social);
  return justRevealed ? c : null;
}

export function getMaxContacts(state) {
  let max = 8 + (state.endowments?.social || 0) * 2;
  if (state.obsessiveTrait === 'social') max += 4;
  return max;
}

export function addContact(state, { source, affinity = 1.0, forceType = null }) {
  if (!state.contacts) state.contacts = [];
  if (state.contacts.length >= getMaxContacts(state)) return null;

  const usedNames = new Set(state.contacts.map(c => c.name));
  const name = generateName(usedNames);

  // Random avatar from pool, prefer unused avatars among current contacts
  const usedAvatars = new Set(state.contacts.map(c => c.avatarIdx));
  const freeAvatars = Array.from({ length: CONTACT_AVATAR_COUNT }, (_, i) => i + 1).filter(i => !usedAvatars.has(i));
  const avatarIdx = freeAvatars.length > 0
    ? freeAvatars[Math.floor(Math.random() * freeAvatars.length)]
    : 1 + Math.floor(Math.random() * CONTACT_AVATAR_COUNT);

  const pType = forceType || rollPartnerType(state.endowments?.social || 0);
  const clampedAffinity = Math.min(5, Math.max(0, affinity));
  const tier = getContactTier(clampedAffinity);
  const npcTier = rollNpcTier();
  const npcReputation = rollNpcReputation(npcTier);
  const specialty = rollSpecialty();

  const contact = {
    id: state.contactNextId++,
    name, avatarIdx, pType, tier,
    affinity: clampedAffinity,
    bio: getContactBio(pType, tier, source, specialty),
    source,
    metTurn: state.turn,
    interactions: 0,
    revealed: false,
    npcTier,
    npcReputation: Math.round(npcReputation * 10) / 10,
    specialty,
  };
  state.contacts.push(contact);
  return contact;
}

// Returns { milestone } if tier upgraded, null otherwise
export function updateContactAffinity(state, contactId, delta) {
  const c = (state.contacts || []).find(x => x.id === contactId);
  if (!c) return null;
  const oldTier = c.tier;
  // Social attribute boosts positive affinity gains
  let adjustedDelta = delta;
  if (delta > 0) {
    const social = state.obsessiveTrait === 'talent' ? 0 : (state.endowments?.social || 0);
    adjustedDelta = delta * (1 + social * 0.15);
  }
  c.affinity = Math.min(5, Math.max(0, c.affinity + adjustedDelta));
  const newTier = getContactTier(c.affinity);
  if (newTier !== oldTier) {
    c.tier = newTier;
    c.bio = getContactBio(c.pType, newTier, c.source, c.specialty);
    // Tier upgrade → milestone
    const TIER_ORDER = ['acquaintance', 'familiar', 'trusted'];
    if (TIER_ORDER.indexOf(newTier) > TIER_ORDER.indexOf(oldTier)) {
      return { milestone: newTier, contact: c };
    }
  }
  return null;
}

// === Affinity-based passive benefits (called each turn in tickContacts) ===
export function rollAffinityBonuses(state, result) {
  if (!state.contacts || state.contacts.length === 0) return;

  const trustedFriends = state.contacts.filter(c =>
    c.affinity >= 4 && c.id !== state.activeContactId &&
    !(c._unavailableUntil && state.turn < c._unavailableUntil)
  );
  if (trustedFriends.length === 0) return;

  // Each trusted friend has a small chance per month to trigger a positive event
  // Max 1 bonus per month to avoid spam
  for (const c of trustedFriends) {
    const chance = 0.08 + (c.affinity - 4) * 0.04; // 8-12% at affinity 4-5
    if (Math.random() >= chance) continue;

    // Pick a random bonus type
    const roll = Math.random();
    if (roll < 0.30) {
      // Share your work — info disclosure boost
      const gain = 0.05;
      state.infoDisclosure = Math.min(1, state.infoDisclosure + gain);
      result.deltas.push({ icon: 'megaphone', label: `${c.name}转发了你的作品`, value: `曝光+${Math.round(gain * 100)}%`, positive: true });
    } else if (roll < 0.55) {
      // Emotional support — passion boost
      const gain = 3 + Math.floor(Math.random() * 3);
      state.passion = Math.min(100, state.passion + gain);
      result.deltas.push({ icon: 'chat-circle', label: `${c.name}发来鼓励消息`, value: `热情+${gain}`, positive: true });
    } else if (roll < 0.75) {
      // Material gift — small money
      const gift = 100 + Math.floor(Math.random() * 200);
      state.money += gift;
      result.deltas.push({ icon: 'gift', label: `${c.name}送了你创作素材`, value: `+¥${gift}`, positive: true });
    } else if (roll < 0.90) {
      // Defend reputation — small rep gain
      const raw = 0.08;
      const actual = raw / Math.pow(1 + state.reputation, 0.7);
      state.reputation += actual;
      state.maxReputation = Math.max(state.maxReputation, state.reputation);
      result.deltas.push({ icon: 'shield', label: `${c.name}在圈里帮你说话`, value: `声誉+${actual.toFixed(3)}`, positive: true });
    } else {
      // Introduce new contact
      const newC = addContact(state, { source: 'friend_intro', affinity: 1.5 });
      if (newC) {
        result.deltas.push({ icon: 'address-book', label: `${c.name}给你介绍了${newC.name}`, value: '新人脉+1', positive: true });
      } else {
        // Pool full, fallback to passion
        state.passion = Math.min(100, state.passion + 2);
        result.deltas.push({ icon: 'heart', label: `${c.name}约你出去玩`, value: '热情+2', positive: true });
      }
    }
    return; // max 1 bonus per month
  }
}

// === Partner Candidate Generation (contacts pool only, no stranger fallback) ===
export function generatePartnerCandidates(state) {
  if (!state.contacts || state.contacts.length === 0) return null;

  const available = state.contacts.filter(c => !(c._unavailableUntil && state.turn < c._unavailableUntil));
  if (available.length === 0) return null;

  return available
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
      npcTier: c.npcTier || 'small',
      specialty: c.specialty || 'art',
    }));
}

// === Contacts Pool Maintenance (called each turn) ===
export function tickContacts(state, result) {
  if (!state.contacts || state.contacts.length === 0) return;
  const maxContacts = getMaxContacts(state);

  // Monthly affinity decay for inactive contacts (not current partner)
  // Social attribute reduces decay rate
  const social = state.obsessiveTrait === 'talent' ? 0 : (state.endowments?.social || 0);
  const decayMult = Math.max(0.5, 1 - social * 0.1);
  const lastPartnerChat = state._partnerChatLastTurn || -99;
  const chatNeglected = state.turn - lastPartnerChat >= 4; // 4+ months no chat
  for (const c of state.contacts) {
    if (c.id === state.activeContactId) continue;
    if (c._unavailableUntil && state.turn < c._unavailableUntil) continue; // skip unavailable contacts
    // Familiar+ contacts who haven't been chatted with decay faster
    const isFamiliarPlus = c.affinity >= 2.0;
    const decay = ((isFamiliarPlus && chatNeglected) ? 0.12 : 0.05) * decayMult;
    c.affinity = Math.max(0, c.affinity - decay);
    if (isFamiliarPlus && chatNeglected && c.affinity >= 1.5) {
      result.deltas.push({ icon: 'chat-circle', label: `你和${c.name}的联系在变少…`, value: '好感加速衰减中', positive: false });
    }
    const newTier = getContactTier(c.affinity);
    if (newTier !== c.tier) { c.tier = newTier; c.bio = getContactBio(c.pType, newTier, c.source, c.specialty); }
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

  // --- Large network maintenance cost: >15 contacts drains extra passion ---
  const NETWORK_DRAIN_THRESHOLD = 15;
  const activeCount = state.contacts.length;
  if (activeCount > NETWORK_DRAIN_THRESHOLD) {
    const excess = activeCount - NETWORK_DRAIN_THRESHOLD;
    const drain = Math.round(excess * 0.8); // ~1 passion per extra contact beyond 15
    state.passion = Math.max(1, state.passion - drain);
    result.deltas.push({ icon: 'users', label: `维护${activeCount}人的社交圈很累`, value: `热情-${drain}`, positive: false });
  }

  // --- Trusted friend passive bonuses ---
  rollAffinityBonuses(state, result);
}
