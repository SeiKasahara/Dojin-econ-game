/**
 * Achievement System — 同人社団物語
 * Check conditions and award achievements
 */

import { getLifeStage, getAge } from './engine.js';

export function checkAchievements(state) {
  // --- Update tracking counters ---
  if (state.money < 0 && state.passion >= 60) {
    state._debtPassionStreak = (state._debtPassionStreak || 0) + 1;
  } else {
    state._debtPassionStreak = 0;
  }
  if (state.passion <= 15) state._lowPassionHit = true;
  if (state._lowPassionHit && state.passion >= 80) state._passionRecovered = true;

  const age = getAge(state.turn);
  const checks = [
    { id: 'first_hvp', cond: state.totalHVP >= 1 }, { id: 'first_lvp', cond: state.totalLVP >= 1 },
    { id: 'rep3', cond: state.reputation >= 3 }, { id: 'rep5', cond: state.reputation >= 5 }, { id: 'rep8', cond: state.reputation >= 8 },
    { id: 'survive12', cond: state.turn >= 12 }, { id: 'survive24', cond: state.turn >= 24 }, { id: 'survive120', cond: state.turn >= 120 },
    { id: 'survive_work', cond: getLifeStage(state.turn) === 'work' && state.passion > 0 },
    { id: 'rich', cond: state.money >= 10000 && state.totalRevenue >= 5000 }, { id: 'hvp5', cond: state.totalHVP >= 5 },
    { id: 'recession_survivor', cond: (state.eventCounts['recession'] || 0) > 0 && state.recessionTurnsLeft === 0 && state.passion > 0 },
    { id: 'diversity_savior', cond: state.market && state.market.nHVP === 0 && state.hvpProject && state.hvpProject.progress > 0 },
    { id: 'market_veteran', cond: state.market && state.market.diversityHealth < 0.3 && state.passion > 20 },
    { id: 'niche_hunter', cond: state.advanced && state.advanced.nichesFound >= 3 },
    { id: 'ai_survivor', cond: state.advanced && state.advanced.aiRevolution && state.totalHVP > 0 && state.passion > 20 },
    { id: 'stagflation_survivor', cond: state.advanced && (state.eventCounts['stagflation'] || 0) > 0 && state.advanced.stagflationTurnsLeft === 0 && state.passion > 0 },
    { id: 'veblen', cond: (state.eventCounts['veblen_hype'] || 0) > 0 },
    { id: 'collector', cond: state.goodsCollection >= 10 && state.totalHVP === 0 && state.totalLVP === 0 },
    { id: 'commercial_debut', cond: state.commercialTransition },
    // --- Hard achievements ---
    { id: 'survive180', cond: state.turn >= 180 },
    { id: 'survive240', cond: state.turn >= 240 },
    { id: 'survive360', cond: state.turn >= 360 },
    { id: 'rep10', cond: state.reputation >= 10 },
    { id: 'hvp10', cond: state.totalHVP >= 10 },
    { id: 'hvp20', cond: state.totalHVP >= 20 },
    { id: 'debt_warrior', cond: (state._debtPassionStreak || 0) >= 6 },
    { id: 'debt_abyss', cond: state.money <= -10000 && state.passion > 0 },
    { id: 'phoenix', cond: state._passionRecovered },
    { id: 'elder_creator', cond: age >= 35 && state.totalHVP > 0 && state.passion > 0 },
    { id: 'rich_mogul', cond: state.money >= 30000 },
    { id: 'triple_threat', cond: (state.eventCounts['recession'] || 0) >= 2 && state.passion > 20 },
  ];
  for (const c of checks) if (c.cond && !state.achievements.includes(c.id)) state.achievements.push(c.id);
  if (state.partnerType === 'toxic' && !state.achievements.includes('toxic_encounter')) state.achievements.push('toxic_encounter');
}

const ACHIEVEMENT_MAP = {
  first_hvp: { name: '初出茅庐', desc: '完成第一本同人志', emoji: 'book-open-text' },
  first_lvp: { name: '小试牛刀', desc: '制作了第一批谷子', emoji: 'key' },
  rep3: { name: '小有名气', desc: '声誉达到3', emoji: 'star' },
  rep5: { name: '圈内知名', desc: '声誉达到5', emoji: 'star-four' },
  rep8: { name: '传说大手', desc: '声誉达到8', emoji: 'crown' },
  survive12: { name: '一年坚持', desc: '持续创作满一年', emoji: 'calendar' },
  survive24: { name: '两年老兵', desc: '持续创作满两年', emoji: 'trophy' },
  survive_work: { name: '社畜创作者', desc: '进入工作后仍在创作', emoji: 'briefcase' },
  rich: { name: '同人致富', desc: '资金超过10000元', emoji: 'coins' },
  hvp5: { name: '高产创作者', desc: '完成5本同人志', emoji: 'books' },
  toxic_encounter: { name: '遇人不淑', desc: '遭遇了有毒搭档', emoji: 'skull' },
  recession_survivor: { name: '穿越周期', desc: '经历经济下行后仍在创作', emoji: 'trend-up' },
  diversity_savior: { name: '多样性守护者', desc: '在市场同人本数量为零时开始创作同人本', emoji: 'star-four' },
  market_veteran: { name: '寒冬幸存者', desc: '在市场多样性极低时仍保持热情', emoji: 'mountains' },
  niche_hunter: { name: '需求猎人', desc: '发现3个以上细分需求缺口', emoji: 'magnifying-glass' },
  ai_survivor: { name: 'AI时代的人类', desc: '在AI革命后仍坚持人工创作', emoji: 'robot' },
  stagflation_survivor: { name: '滞胀幸存者', desc: '经历滞胀后仍在创作', emoji: 'fire' },
  veblen: { name: '圣遗物制造者', desc: '作品成为二手奢侈品', emoji: 'diamond' },
  collector: { name: '纯粹的消费者', desc: '收藏了10件谷子却从未创作过', emoji: 'shopping-cart' },
  survive120: { name: '十年老兵', desc: '在同人创作之路上坚持了十年', emoji: 'medal' },
  survive180: { name: '十五年传奇', desc: '同人之路走了十五年，热情犹在', emoji: 'medal-military' },
  survive240: { name: '二十年不灭', desc: '二十年如一日，你就是同人圈的活化石', emoji: 'flame' },
  survive360: { name: '永恒之火', desc: '三十年...从少年到中年，热情从未熄灭', emoji: 'seal' },
  rep10: { name: '活着的传说', desc: '声誉达到10，你的名字就是品牌', emoji: 'crown' },
  hvp10: { name: '十本成就', desc: '完成10本同人志，量变引起质变', emoji: 'books' },
  hvp20: { name: '创作机器', desc: '完成20本同人志，前无古人', emoji: 'building-office' },
  debt_warrior: { name: '用爱发电', desc: '连续6个月负债但热情始终高涨', emoji: 'fire' },
  debt_abyss: { name: '深渊行者', desc: '负债超过¥10000仍在坚持创作', emoji: 'arrow-circle-down' },
  phoenix: { name: '涅槃重生', desc: '热情跌到谷底后重新燃起', emoji: 'bird' },
  elder_creator: { name: '老骥伏枥', desc: '35岁之后仍在创作同人本', emoji: 'sun-horizon' },
  rich_mogul: { name: '同人大亨', desc: '资金超过¥30000，富可敌国', emoji: 'diamond' },
  triple_threat: { name: '经济周期收割者', desc: '经历两次以上经济下行仍保持热情', emoji: 'waves' },
  commercial_debut: { name: '商业出道', desc: '从同人创作者成功转型为商业创作者', emoji: 'star-four' },
};

export function getAchievementInfo(id) {
  return ACHIEVEMENT_MAP[id] || { name: id, desc: '', emoji: 'medal' };
}
