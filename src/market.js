/**
 * Market Ecosystem Simulation — 同人社团物语 Phase 2
 * Aggregate NPC creator population dynamics 
 * Translated CES demand model from consumer.md
 */

import { getLifeStage } from './engine.js';

// === Parameters calibrated from diversity.md §7 ===
const EQ_HVP = 9;         // equilibrium HVP count
const EQ_LVP = 55;        // equilibrium LVP count
const ENTRY_RATE = 4;     // new LVP entrants per period
const P_UP = 0.023;       // LVP→HVP per period (2.3% survival through pipeline)
const P_DOWN = 0.052;     // HVP exit rate (exo 0.025 + endo 0.015 + collapse 0.012)
const P_LVP_EXIT = 0.025; // LVP exit rate
const ALPHA_DECAY = 0.95; // consumer α decay per turn when N_HVP=0 (faster for gameplay)
const GAMMA_H = 15;       // committed consumption (vacuum profit base)

// === NPC Circle Names ===
const NPC_CIRCLE_NAMES = [
  // 日系古典风
  '「星屑」', '「月光工房」', '「赤い鍵」', '「深夜茶会」', '「黒猫堂」',
  '「虹色書房」', '「蒼穹社」', '「雪兎工坊」', '「焔の翼」', '「白鴉」',
  '「花火亭」', '「琥珀色」', '「夢幻回廊」', '「朧月」', '「紫苑」',
  '「碧の庭」', '「流星群」', '「曙光」', '「銀の鈴」', '「夕暮れ堂」',
  // 中文风
  '「竹海楼」', '「子夜星界」', '「水晶幻境」', '「蔷薇前线」',
  '「萤火虫之森」', '「墨染工房」', '「青鸟小筑」', '「浮光掠影」',
  '「桃源绘社」', '「织梦亭」', '「拾光社」', '「鹿鸣馆」',
  // 英文/洋风
  '「Comet」', '「Blaze」', '「Palette」', '「Stardust」',
  '「Reverie」', '「Prism」', '「Nocturne」', '「Afterglow」',
  // 可爱/趣味系
  '「猫耳朵制作组」', '「凌晨三点半」', '「咸鱼翻身社」', '「修罗场工坊」',
  '「来一杯拿铁」', '「通宵画稿同盟」', '「救救孩子」', '「就差一笔」',
];

function generateNPCNames(count) {
  const shuffled = [...NPC_CIRCLE_NAMES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// === Trend Tags ===
const TREND_TAGS = ['甜文', '虐心', '热血', '日常', '奇幻'];

export function generateTrend(market) {
  const avoid = market.trendHistory.length > 0 ? market.trendHistory[market.trendHistory.length - 1] : null;
  const pool = TREND_TAGS.filter(t => t !== avoid);
  const tag = pool[Math.floor(Math.random() * pool.length)];
  market.currentTrend = { tag, turnsLeft: 3, strength: 1.3 + Math.random() * 0.2 };
}

export function tickTrend(market) {
  if (!market.currentTrend) {
    // Start a new trend every 3 turns (check by turn counter mod or if null)
    generateTrend(market);
    return;
  }
  market.currentTrend.turnsLeft--;
  if (market.currentTrend.turnsLeft <= 0) {
    market.trendHistory.push(market.currentTrend.tag);
    if (market.trendHistory.length > 5) market.trendHistory.shift();
    market.currentTrend = null;
    // Next trend will generate on next tick
  }
}

// === Social Feed Generator ===
export function generateSocialFeed(market, official, playerState) {
  const feed = [];
  const names = market.npcNames || [];
  const pick = () => names.length > 0 ? names[Math.floor(Math.random() * names.length)] : '某创作者';
  const r = () => Math.random();

  // === 1. NPC creator daily life (pick 1-2) ===
  const npcDaily = [
    () => `${pick()} 发布了新刊预告！${market.currentTrend ? `看起来是${market.currentTrend.tag}风格` : ''}`,
    () => `${pick()} 宣布参加下个月的展会，正在备货中`,
    () => `${pick()} 的新谷子开始通贩了，销量不错的样子`,
    () => `${pick()} 发了创作过程的直播回放，好多人围观`,
    () => `${pick()} 和 ${pick()} 宣布合作出本！`,
    () => `${pick()} 晒出了参展战利品，满满一袋子`,
    () => `${pick()} 抱怨印刷厂又涨价了...`,
    () => `${pick()} 的旧作在二手市场上被炒了高价`,
    () => `${pick()} 宣布暂时停更，说需要充电`,
    () => `${pick()} 深夜发了一条"终于画完了😭"`,
    () => `${pick()} 发了返图，质量看起来很不错`,
    () => `${pick()} 在征集封面意见，评论区吵起来了`,
    () => `${pick()} 晒出了这个月的销售数据，引发围观`,
    () => `${pick()} 说最近接稿太多快画不动了`,
    () => `${pick()} 开了一个新坑，粉丝们表示期待`,
  ];
  if (r() < 0.75 && names.length > 0) feed.push({ text: npcDaily[Math.floor(r() * npcDaily.length)](), type: 'npc' });
  if (r() < 0.45 && names.length > 1) feed.push({ text: npcDaily[Math.floor(r() * npcDaily.length)](), type: 'npc' });

  // === 2. Drama / conflict events (reflects game events) ===
  const lastEvt = playerState.lastEvent;
  if (lastEvt?.id === 'collapse') {
    feed.push({ text: `⚠️ 圈内大瓜！${pick()}被挂了，时间线上全在吵架...好多人表示心累想退圈`, type: 'drama' });
  } else if (lastEvt?.id === 'harsh_review') {
    feed.push({ text: `有人发了一篇长文批评某位创作者的作品，评论区两极分化`, type: 'drama' });
  } else if (lastEvt?.id === 'promo_fail') {
    feed.push({ text: `某条宣传动态引发了争议，转发里骂声一片...`, type: 'drama' });
  } else if (r() < 0.12) {
    // Random drama even without player event
    const dramas = [
      () => `${pick()} 和 ${pick()} 闹掰了，双方粉丝在时间线上互撕`,
      () => `有人爆料某创作者描图，圈子里炸了锅`,
      () => `关于"同人该不该收费"的老话题又吵起来了...`,
      () => `${pick()} 被质疑拖稿跑路，出来发了长文澄清`,
      () => `有人在拉黑名单，说某些创作者态度恶劣`,
      () => `圈内出现了挂人bot，好多人人心惶惶`,
      () => `为了CP解释权，两派粉丝吵了整整一晚上`,
    ];
    feed.push({ text: dramas[Math.floor(r() * dramas.length)](), type: 'drama' });
  }

  // === 3. Trend signal ===
  if (market.currentTrend) {
    if (market.currentTrend.turnsLeft === 1) {
      feed.push({ text: `「${market.currentTrend.tag}」话题热度开始回落，下一波流行会是什么？`, type: 'trend' });
    } else {
      const trendPosts = [
        `最近「${market.currentTrend.tag}」类作品讨论度很高！好多人在安利`,
        `刷了一晚上全是「${market.currentTrend.tag}」相关，这波真的火了`,
        `${pick()} 也开始画「${market.currentTrend.tag}」了，跟风还是真心？`,
      ];
      feed.push({ text: trendPosts[Math.floor(r() * trendPosts.length)], type: 'trend' });
    }
  } else {
    const hint = TREND_TAGS[Math.floor(r() * TREND_TAGS.length)];
    feed.push({ text: `圈内风向好像在变...「${hint}」类作品开始被越来越多人提起`, type: 'trend' });
  }

  // === 4. Fan reactions to player ===
  if (playerState.totalHVP > 0 || playerState.totalLVP > 0) {
    const fanPosts = [];
    if (playerState.reputation > 3) fanPosts.push(
      '有人画了你作品的二创同人图！在小圈子里传开了',
      '一位读者在时间线上安利了你的作品，转发量还不错',
      '"这位太太的本子质量很稳" ——看到有人这么评价你',
      '你的作品被某个安利bot转发了！',
      '有新粉在问你的旧作还有没有库存',
    );
    if (playerState.reputation > 1) fanPosts.push(
      '有人在问你下一本什么时候出',
      '看到有人在帖子里@你，说很喜欢你的作品',
    );
    if (playerState.reputation <= 1 && playerState.totalHVP > 0) fanPosts.push(
      '有人默默收藏了你的作品页面',
      '你的作品被一个小号转发了...虽然只有个位数互动',
    );
    if (fanPosts.length > 0 && r() < 0.35) {
      feed.push({ text: fanPosts[Math.floor(r() * fanPosts.length)], type: 'fan' });
    }
  }

  // === 5. Market observations ===
  const marketPosts = [];
  if (official?.secondHandPressure?.lvp > 0.3) marketPosts.push('二手谷子泛滥了，新品越来越难卖...');
  else if (official?.secondHandPressure?.lvp > 0.15) marketPosts.push('好多人在出二手谷子，是要换坑了吗');
  if (official?.secondHandPressure?.hvp > 0.1) marketPosts.push('二手本子市场挺活跃的，有人在收绝版');
  if (market.communitySize > 18000) marketPosts.push('圈子越来越热闹了，新人好多！');
  else if (market.communitySize < 3000) marketPosts.push('时间线好安静...大家是不是都去忙别的了');
  if (market.nHVP <= 2) marketPosts.push('出本的人越来越少了，市场上几乎没有新的同人本');
  if (market.nLVP > 70) marketPosts.push('谷子摊太多了，竞争好激烈');
  if (playerState.recessionTurnsLeft > 0) marketPosts.push('经济不好，大家都在缩减预算，愁...');
  if (marketPosts.length > 0) feed.push({ text: marketPosts[Math.floor(r() * marketPosts.length)], type: 'market' });

  // === 6. IP / official flavor ===
  if (official) {
    const ipPosts = [];
    if (official.ipHeat > 80) ipPosts.push('官方刚出的内容太棒了，满屏都在讨论！', '官方这波是懂粉丝的，好多人入坑了');
    else if (official.ipHeat > 50) ipPosts.push('官方还在更新，虽然不温不火但至少没烂尾');
    else if (official.ipHeat > 20) ipPosts.push('官方好久没动静了，有人说是不是要完结了...', '只靠同人在续命的感觉，心疼这个IP');
    else ipPosts.push('这个IP基本被官方放弃了...只有最死忠的粉丝还在', '圈子快要散了，大家都在找新坑');
    if (official.dormancyTurns > 18) ipPosts.push(`官方已经${official.dormancyTurns}个月没更新了，都快忘了还有官方这回事`);
    if (official.shadowPrice > 0.1) ipPosts.push('听说官方在抓同人，好多人吓得删了作品...');
    if (official.shadowPrice < -0.1) ipPosts.push('官方居然发了素材包！这是鼓励同人创作吗？太感动了');
    if (ipPosts.length > 0 && r() < 0.4) feed.push({ text: ipPosts[Math.floor(r() * ipPosts.length)], type: 'flavor' });
  }

  // === 7. General community chatter ===
  if (r() < 0.3) {
    const chatter = [
      '又到周末了，打开画板却不知道画什么...',
      '刚收到快递，拆谷子的快乐谁懂啊',
      '展会快到了，有人一起拼车吗？',
      '今天居然在书店看到了同人本，时代变了',
      '修罗场赶稿中，头发掉了好多根',
      '有人推荐好用的排版软件吗？',
      '存了三个月的零花钱，终于可以去展会扫货了',
      '发现一个宝藏太太，作品质量好高但粉丝好少',
      '刚入坑的萌新问：做同人是不是很花钱？ 回复：是的',
      '每次看到别人晒图就想画画，但打开板子就想摸鱼',
    ];
    feed.push({ text: chatter[Math.floor(r() * chatter.length)], type: 'flavor' });
  }

  // Shuffle slightly and cap at 5
  return feed.sort(() => r() - 0.5).slice(0, 5);
}

// === IP Type definitions ===
export const IP_TYPES = {
  cold:   { name: '冷门IP', emoji: '🧊', carryingCapacity: 5000,  officialActiveChance: 0.03, officialMinorChance: 0.02, desc: '官方几乎不管，社群天花板低，但竞争也少' },
  normal: { name: '潜力IP', emoji: '🌟', carryingCapacity: 25000, officialActiveChance: 0.12, officialMinorChance: 0.10, desc: '官方偶尔更新，社群有成长空间' },
  hot:    { name: '热门IP', emoji: '🔥', carryingCapacity: 50000, officialActiveChance: 0.18, officialMinorChance: 0.15, desc: '官方频繁更新，社群庞大但竞争激烈' },
};

// === Create Market State ===
export function createMarketState(communityPreset = 'mid', ipType = 'normal') {
  const presets = {
    early: { nHVP: 3, nLVP: 15, communitySize: 1500 },
    mid:   { nHVP: 9, nLVP: 55, communitySize: 10000 },
    late:  { nHVP: 12, nLVP: 80, communitySize: 20000 },
  };
  const p = presets[communityPreset] || presets.mid;
  const ip = IP_TYPES[ipType] || IP_TYPES.normal;
  // Cold IP: cap community to its ceiling, fewer creators
  const cappedSize = Math.min(p.communitySize, ip.carryingCapacity);
  const creatorScale = cappedSize / p.communitySize;
  return {
    nHVP: Math.max(1, Math.round(p.nHVP * creatorScale)),
    nLVP: Math.max(5, Math.round(p.nLVP * creatorScale)),
    communitySize: cappedSize,
    ipType,
    carryingCapacity: ip.carryingCapacity,
    hvpZeroStreak: 0,
    consumerAlpha: 1.0,
    diversityHealth: 1.0,
    marketConfidence: 1.0,
    npcEvents: [],
    cumHVPProduced: 0,
    cumHVPExited: 0,
    // Trend system
    currentTrend: null,
    trendHistory: [],
    trendTickCounter: 0,
    // Social feed
    npcNames: generateNPCNames(8),
    socialFeed: [],
  };
}

// === Tick Market: run once per game turn ===
export function tickMarket(market, playerState) {
  const events = [];
  const isRecession = playerState.recessionTurnsLeft > 0;

  // --- 1. LVP entry (new creators join) ---
  const entryMod = isRecession ? 0.5 : 1.0;
  const newLVP = Math.max(1, poissonSample(ENTRY_RATE * entryMod));
  market.nLVP += newLVP;

  // --- 2. LVP → HVP pipeline ---
  const upgrades = binomialCount(market.nLVP, P_UP * (isRecession ? 0.5 : 1.0));
  if (upgrades > 0) {
    market.nLVP -= upgrades;
    market.nHVP += upgrades;
    market.cumHVPProduced += upgrades;
    events.push(`📖 ${upgrades}位同人谷创作者转化为同人本创作者！`);
  }

  // --- 3. HVP exits ---
  const hvpExitRate = P_DOWN * (isRecession ? 1.5 : 1.0);
  const hvpExits = binomialCount(market.nHVP, hvpExitRate);
  if (hvpExits > 0) {
    market.nHVP = Math.max(0, market.nHVP - hvpExits);
    market.cumHVPExited += hvpExits;
    events.push(`😢 ${hvpExits}位同人本创作者退出了市场`);
  }

  // --- 4. LVP exits ---
  const lvpExitRate = P_LVP_EXIT * (isRecession ? 1.3 : 1.0);
  const lvpExits = binomialCount(market.nLVP, lvpExitRate);
  market.nLVP = Math.max(5, market.nLVP - lvpExits); // floor at 5

  // --- 5. Diversity trap: consumer preference decay ---
  if (market.nHVP === 0) {
    market.hvpZeroStreak++;
    market.consumerAlpha *= ALPHA_DECAY;
    if (market.hvpZeroStreak === 3) {
      events.push('⚠️ 市场已3个月没有同人本创作者，消费者对同人本的期待正在衰退...');
    }
    if (market.hvpZeroStreak === 8) {
      events.push('🕳️ 多样性陷阱形成中！没有人制作同人本，消费者偏好正在被遗忘...');
    }
    // Vacuum profit recovery: small chance someone brave enters
    if (market.hvpZeroStreak > 5 && Math.random() < 0.04) {
      market.nHVP = 1;
      market.nLVP = Math.max(0, market.nLVP - 1);
      events.push('🌟 一位勇敢的创作者独占真空利润，重新进入同人本市场！');
    }
  } else {
    market.hvpZeroStreak = 0;
    // Slow recovery of consumerAlpha when HVP exists
    market.consumerAlpha = Math.min(1, market.consumerAlpha + 0.02);
  }

  // --- 6. Market confidence ---
  const basConf = isRecession ? 0.6 : 1.0;
  const divConf = market.nHVP > 0 ? 1.0 : 0.7;
  market.marketConfidence += (basConf * divConf - market.marketConfidence) * 0.2; // smooth

  // --- 7. Community size dynamics (logistic growth with carrying capacity) ---
  const CARRYING_CAPACITY = market.carryingCapacity || 25000;
  const saturationFactor = 1 - market.communitySize / CARRYING_CAPACITY; // approaches 0 at cap
  const hvpPull = market.nHVP * 40 * Math.max(0, saturationFactor);
  const lvpPull = market.nLVP * 4 * Math.max(0, saturationFactor);
  // Natural churn accelerates as community ages (people move on)
  const ipAge = playerState.turn / 12; // years since game start
  const baseChurn = 0.012 + ipAge * 0.002; // 1.2% at start → 2.2% after 5 years → 3.2% after 10
  const churn = market.communitySize * baseChurn;
  const recessionDrain = isRecession ? market.communitySize * 0.015 : 0;
  const diversityPenalty = market.nHVP === 0 ? market.communitySize * 0.03 : 0;
  const netGrowth = hvpPull + lvpPull - churn - recessionDrain - diversityPenalty;
  market.communitySize = Math.max(200, Math.round(market.communitySize + netGrowth));

  // --- 8. Diversity health ---
  market.diversityHealth = Math.min(1, market.nHVP / EQ_HVP);

  // --- 9. Keep recent events (max 3) ---
  market.npcEvents = [...events, ...market.npcEvents].slice(0, 3);

  // --- 10. Trend system: tick every turn, generate every 3 turns ---
  market.trendTickCounter = (market.trendTickCounter || 0) + 1;
  if (market.trendTickCounter % 3 === 0 || !market.currentTrend) {
    tickTrend(market);
  }

  // --- 11. Social feed ---
  const officialState = playerState.official || null;
  market.socialFeed = generateSocialFeed(market, officialState, playerState);
}

// === Competition Modifier: how NPC market affects player sales ===
export function getCompetitionModifier(market, productType) {
  if (productType === 'hvp') {
    // Less HVP competition → player sells more (vacuum profit)
    // More HVP → player faces split demand
    const ratio = market.nHVP / EQ_HVP; // 1.0 = equilibrium
    // At 0 HVP: 1.5x bonus. At equilibrium: 1.0x. At 2x equilibrium: 0.7x
    const mod = 1.5 - 0.5 * ratio;
    // Also apply consumerAlpha decay (if consumers forgot about HVP, even vacuum is smaller)
    return Math.max(0.3, mod * market.consumerAlpha);
  }
  // LVP: gentle competition effect
  const ratio = market.nLVP / EQ_LVP;
  return Math.max(0.5, 1.1 - 0.1 * ratio);
}

// === Price-Demand Curve (consumer.md Translated CES) ===
// Player picks a price, demand responds via elasticity
export function calculatePricedSales(baseSales, basePrice, playerPrice, productType) {
  const elasticity = productType === 'hvp' ? 1.06 : 0.92;
  const priceFactor = Math.pow(playerPrice / basePrice, -elasticity);
  const adjustedSales = Math.max(1, Math.round(baseSales * priceFactor));
  return { sales: adjustedSales, price: playerPrice, revenue: adjustedSales * playerPrice };
}

// === Dynamic Market Average Price ===
// Derives from supply-demand balance, confidence, recession, competition density
export function getMarketAvgPrice(market, playerState, productType) {
  const isHVP = productType === 'hvp';
  const baseRef = isHVP ? 50 : 15; // reference equilibrium price

  // Supply pressure: more competitors → price pushed down
  const eqCount = isHVP ? EQ_HVP : EQ_LVP;
  const actual = isHVP ? market.nHVP : market.nLVP;
  const supplyRatio = actual / Math.max(1, eqCount); // >1 = oversupply, <1 = undersupply
  const supplyMod = 1.15 - 0.15 * supplyRatio; // undersupply: prices up; oversupply: prices down

  // Demand pressure: community size relative to reference
  const demandMod = Math.sqrt(market.communitySize / 10000); // larger community = higher willingness

  // Confidence: mild effect on price (mainly affects volume, not price)
  const confMod = 1 - (1 - market.marketConfidence) * 0.15; // confidence 0.6→0.94, 1.0→1.0

  // Recession: moderate price pressure
  const recMod = playerState.recessionTurnsLeft > 0 ? 0.90 : 1.0;

  // Consumer preference decay: only kicks in at extreme levels (α<0.5)
  const alphaMod = isHVP && market.consumerAlpha < 0.5
    ? 0.7 + market.consumerAlpha * 0.6  // α=0→0.7, α=0.5→1.0
    : 1.0;

  const rawPrice = baseRef * supplyMod * demandMod * confMod * recMod * alphaMod;
  return Math.max(isHVP ? 25 : 8, Math.round(rawPrice));
}

// === Price Tiers for UI ===
export function getPriceTiers(basePrice, productType) {
  return [
    { id: 'budget',  label: '低价冲量', price: Math.max(1, Math.round(basePrice * 0.6)), desc: '薄利多销' },
    { id: 'low',     label: '亲民价',   price: Math.max(1, Math.round(basePrice * 0.8)), desc: '略低于均价' },
    { id: 'normal',  label: '市场均价', price: basePrice,                                  desc: '跟随市场' },
    { id: 'high',    label: '品质溢价', price: Math.round(basePrice * 1.3),                desc: '高于均价' },
    { id: 'premium', label: '高端定位', price: Math.round(basePrice * 1.6),                desc: '少量精品' },
  ];
}

// === Market Narratives for UI ===
export function getMarketNarratives(market) {
  const phrases = [];
  if (market.nHVP >= 12) phrases.push('同人本创作者很多，市场竞争激烈。');
  else if (market.nHVP <= 3 && market.nHVP > 0) phrases.push('同人本创作者寥寥无几，你的同人本几乎没有竞争对手。');
  else if (market.nHVP === 0) phrases.push('⚠️ 市场上已经没有同人本创作者了！这是你独占市场的机会——但消费者的期待也在衰退。');

  if (market.diversityHealth < 0.3) phrases.push('🕳️ 市场多样性极低。也许你可以做那个打破僵局的人？');
  if (market.consumerAlpha < 0.5) phrases.push('消费者对同人本的兴趣已经大幅衰退(α=' + market.consumerAlpha.toFixed(2) + ')...');
  if (market.marketConfidence < 0.7) phrases.push('消费者信心不足，整体市场需求低迷。');

  if (market.communitySize > 15000) phrases.push('🔥 社群人数火爆，销售潜力巨大！');
  else if (market.communitySize < 3000) phrases.push('社群人数萎缩，整体需求疲软...');

  return phrases;
}

// === Utility: approximate random distributions ===
function poissonSample(lambda) {
  // Simple Poisson via Knuth for small lambda
  let L = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

function binomialCount(n, p) {
  // For small expected values, just count successes
  if (n <= 0 || p <= 0) return 0;
  const expected = n * p;
  if (expected > 20) {
    // Normal approximation with noise
    const std = Math.sqrt(n * p * (1 - p));
    return Math.max(0, Math.round(expected + (Math.random() - 0.5) * 2 * std));
  }
  let count = 0;
  for (let i = 0; i < Math.min(n, 100); i++) {
    if (Math.random() < p) count++;
  }
  return count;
}
