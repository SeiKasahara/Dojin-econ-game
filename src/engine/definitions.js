import { getCreativeSkill, getSkillEffects } from './core.js';
import { PARTNER_TYPES, addContact, generatePartnerCandidates } from '../partner.js';
import { ic } from '../icons.js';

// === Re-export from partner.js ===
export { PARTNER_TYPES, addContact, generatePartnerCandidates };

// === Work Subtypes ===
export const HVP_SUBTYPES = {
  manga:    { id: 'manga',    name: '漫画本',       emoji: 'book-open', monthsSolo: 3, monthsPartner: 2, costRange: [3500, 5000], repMult: 1.0,  audienceMult: 1.0,  requiredRep: 0, desc: '标准同人本，全彩小批量印刷贵' },
  novel:    { id: 'novel',    name: '小说本',       emoji: 'book', monthsSolo: 2, monthsPartner: 1, costRange: [1500, 2500], repMult: 0.8,  audienceMult: 0.75, requiredRep: 0, desc: '成本低周期短，受众略小' },
  artbook:  { id: 'artbook',  name: '加厚创意绘本',     emoji: 'palette', monthsSolo: 3, monthsPartner: 2, costRange: [4500, 6000], repMult: 1.5,  audienceMult: 0.85, requiredRep: 0, desc: '声誉加成高但投入大' },
  lorebook: { id: 'lorebook', name: '设定集',       emoji: 'scroll', monthsSolo: 2, monthsPartner: 1, costRange: [2500, 3500], repMult: 1.2,  audienceMult: 0.6,  requiredRep: 2, desc: '小众高价值，需声誉≥2' },
  music:    { id: 'music',    name: '同人音乐专辑', emoji: 'music-notes', monthsSolo: 4, monthsPartner: 3, costRange: [4000, 5000], repMult: 1.3,  audienceMult: 0.7,  requiredRep: 0, desc: '独特受众，周期长' },
};
export const LVP_SUBTYPES = {
  acrylic:  { id: 'acrylic',  name: '亚克力',     emoji: 'diamond', cost: 400, batchSize: 28, marginMult: 1.0, desc: '标准谷子，开模费较贵' },
  badge:    { id: 'badge',    name: '吧唧',       emoji: 'tag', cost: 100, batchSize: 40, marginMult: 0.7, desc: '便宜量大走量型' },
  shikishi: { id: 'shikishi', name: '色纸',       emoji: 'image', cost: 250, batchSize: 25, marginMult: 1.1, desc: '利润率较高' },
  postcard: { id: 'postcard', name: '明信片套组', emoji: 'envelope', cost: 120, batchSize: 50, marginMult: 0.8, desc: '成本低量大' },
};

// === Creative Choices ===
export const CREATIVE_CHOICES = {
  theme: {
    title: '选择创作方向', desc: '这部作品的基调是什么？',
    options: [
      { id: 'sweet',     name: '甜文日常', emoji: 'flower', desc: '温暖治愈的日常故事', tag: '甜文' },
      { id: 'angst',     name: '刀子虐心', emoji: 'sword', desc: '虐心催泪的情感冲击', tag: '虐心' },
      { id: 'adventure', name: '热血冒险', emoji: 'shield-chevron', desc: '热血沸腾的冒险故事', tag: '热血' },
    ],
  },
  execution: {
    title: '创作进度决策', desc: '想要做什么样的质量？',
    options: [
      { id: 'rush',   name: '赶工加速', emoji: 'lightning', desc: '压缩工期，省一个月但可能影响品质' },
      { id: 'normal', name: '正常进度', emoji: 'note-pencil', desc: '按部就班，稳扎稳打' },
      { id: 'polish', name: '精雕细琢', emoji: 'sparkle', desc: '花更多心思打磨，额外消耗一些精力' },
    ],
  },
  finalPolish: {
    title: '最后冲刺', desc: '作品最后阶段如何处理？',
    options: [
      { id: 'safe',       name: '保守完成',     emoji: 'package', desc: '安全收尾，稳定输出' },
      { id: 'overhaul',   name: '大改封面/曲目', emoji: 'arrows-clockwise', desc: '推翻重做，可能翻车也可能惊艳' },
      { id: 'experiment', name: '加入实验性元素', emoji: 'flask', desc: '大胆尝试，也许会成为cult经典' },
    ],
  },
  lvpProcess: {
    title: '制作工艺', desc: '选择这批谷子的制作方式',
    options: [
      { id: 'standard', name: '标准工艺', emoji: 'package', desc: '正常制作，品质适中' },
      { id: 'premium',  name: '精装工艺', emoji: 'diamond', desc: '更好的材料和做工，成本更高' },
      { id: 'budget',   name: '简装快出', emoji: 'clipboard', desc: '压低成本快速出货，量大但品质一般' },
    ],
  },
};

// === Creative Choice Effects (hidden from player) ===
export const CHOICE_EFFECTS = {
  // Theme choices
  sweet:     { qualityMod: 0,     audienceMod: 0.15,  uniqueMod: -0.1 },
  angst:     { qualityMod: 0.05,  audienceMod: -0.05, uniqueMod: 0.15 },
  adventure: { qualityMod: 0,     audienceMod: -0.1,  uniqueMod: 0.1 },
  // Execution choices
  rush:      { qualityMod: -0.15, speedMod: -1, passionExtra: 0 },
  normal:    { qualityMod: 0,     speedMod: 0,  passionExtra: 0 },
  polish:    { qualityMod: 0.15,  speedMod: 0,  passionExtra: 5 },
  // Final polish choices
  safe:      { qualityMod: 0,     riskMod: 0,   cultChance: 0 },
  overhaul:  { qualityMod: 0,     riskMod: 0.3, cultChance: 0 },
  experiment:{ qualityMod: 0.05,  riskMod: 0,   cultChance: 0.15 },
  // LVP process choices
  standard:  { qualityMod: 0,     costMod: 1.0, batchMod: 1.0 },
  premium:   { qualityMod: 0.2,   costMod: 1.5, batchMod: 0.8 },
  budget:    { qualityMod: -0.15, costMod: 0.7, batchMod: 1.3 },
};

// Quality star rating (0.5-1.8 → ★☆ display)
export function getQualityStars(quality) {
  const stars = Math.max(1, Math.min(5, Math.round((quality - 0.5) / 0.26)));
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

// Apply a creative choice to an HVP project, returns quality delta
export function applyCreativeChoice(project, choiceCategory, optionId) {
  const fx = CHOICE_EFFECTS[optionId];
  if (!fx) return '';
  if (!project._qualityLog) project._qualityLog = [];
  const qBefore = project.workQuality;

  if (choiceCategory === 'theme') {
    const opt = CREATIVE_CHOICES.theme.options.find(o => o.id === optionId);
    project.styleTag = opt?.tag || null;
    project.workQuality += fx.qualityMod;
    if (fx.qualityMod) project._qualityLog.push({ label: opt?.name || optionId, delta: fx.qualityMod });
  } else if (choiceCategory === 'execution') {
    project.workQuality += fx.qualityMod;
    if (fx.speedMod) project.needed = Math.max(1, project.needed + fx.speedMod);
    if (fx.passionExtra) project._extraPassionCost = fx.passionExtra;
    const choiceName = CREATIVE_CHOICES.execution.options.find(o => o.id === optionId)?.name || optionId;
    if (fx.qualityMod) project._qualityLog.push({ label: choiceName, delta: fx.qualityMod });
  } else if (choiceCategory === 'finalPolish') {
    project.workQuality += fx.qualityMod;
    if (fx.qualityMod) project._qualityLog.push({ label: '最终打磨', delta: fx.qualityMod });
    if (fx.riskMod && Math.random() < fx.riskMod) {
      const overhaulResult = Math.random() < 0.5 ? 0.2 : -0.2;
      project.workQuality += overhaulResult;
      project._qualityLog.push({ label: overhaulResult > 0 ? '大改赌赢！' : '大改翻车…', delta: overhaulResult });
    }
    if (fx.cultChance && Math.random() < fx.cultChance) {
      project.isCultHit = true;
      project._qualityLog.push({ label: 'Cult经典诞生！', delta: 0, special: true });
    }
  }
  project.workQuality = Math.max(0.5, Math.min(1.8, project.workQuality));
  project.choices.push(optionId);

  // Return quality delta for UI feedback
  return project.workQuality - qBefore;
}

// Work quality effects on sales/reputation (hidden multipliers)
export function getWorkQualityEffects(quality) {
  return {
    salesMult: Math.pow(quality, 2.0),         // quality 0.5→0.25, 0.85→0.72, 1.0→1.0, 1.25→1.56, 1.5→2.25, 1.8→3.24
    repMult: Math.pow(quality, 1.5),           // quality 0.5→0.35, 1.0→1.0, 1.5→1.84
    breakthroughMod: (quality - 1.0) * 0.15,  // quality 0.5→-0.075, 1.0→0, 1.5→+0.075
  };
}

// Trend bonus on sales/reputation
export function getTrendBonus(styleTag, currentTrend) {
  if (!currentTrend || !styleTag) return { salesMult: 1.0, repMult: 1.0 };
  if (styleTag === currentTrend.tag) return { salesMult: currentTrend.strength, repMult: 0.85 };
  return { salesMult: 0.8, repMult: 1.0 }; // off-trend slight penalty
}

// Sync inventory aggregates from works array
export function syncInventoryAggregates(state) {
  state.inventory.hvpStock = state.inventory.works.filter(w => w.type === 'hvp').reduce((s, w) => s + w.qty, 0);
  state.inventory.lvpStock = state.inventory.works.filter(w => w.type === 'lvp').reduce((s, w) => s + w.qty, 0);
}
