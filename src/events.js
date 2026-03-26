/**
 * Game Events — 同人社団物語
 * Scheduled and random events, decoupled for maintainability
 */

import { getLifeStage, getCreativeSkill, addMoney } from './engine.js';

// Internal helper — calendar month from turn
function getCalendarMonth(turn) { return ((turn + 6) % 12) + 1; }

// Find an HVP work eligible to become a "rare work" (海景房):
// sold out 12+ months, quality >= 1.0 or cult hit, not already marked
function findRareWork(s) {
  return (s.inventory?.works || []).find(w =>
    w.type === 'hvp' && w.qty === 0 && !w.isRareWork &&
    w.soldOutSinceTurn && (s.turn - w.soldOutSinceTurn) >= 12 &&
    (w.workQuality >= 1.0 || w.isCultHit)
  );
}

// Internal helper — count active crises
function activeCrisisCount(s) {
  let c = 0;
  if (s.recessionTurnsLeft > 0) c++;
  if (s.advanced?.stagflationTurnsLeft > 0) c++;
  if (s.advanced?.debtCrisisActive) c++;
  return c;
}

// computeEffectiveTime needs to be passed in since it's internal to engine.js
let _computeEffectiveTime = null;
export function setComputeEffectiveTime(fn) { _computeEffectiveTime = fn; }
function computeTime(turn, debuffs) {
  if (_computeEffectiveTime) return _computeEffectiveTime(turn, debuffs);
  return 5; // fallback
}

// === Scheduled Events ===
export const SCHEDULED_EVENTS = [
  // 社团招新: September of Y1 and Y2
  {
    turns: [2, 14],
    event: {
      id: 'uni_club', emoji: 'mask-happy', title: '社团招新',
      desc: '大学社团招新季！你加入了创作相关社团，认识了很多同好。',
      effect: '声誉+0.2 热情+5', effectClass: 'positive',
      apply: (s) => { s.reputation += 0.2; s.passion = Math.min(100, s.passion + 5); },
      tip: '社群网络扩展降低了协作搜寻成本。认识的人越多，越容易找到搭档。',
    },
  },
  // 期末考试: every December and June during university
  {
    condition: (turn) => getLifeStage(turn) === 'university' && (getCalendarMonth(turn) === 12 || getCalendarMonth(turn) === 6),
    event: {
      id: 'uni_exam', emoji: 'note-pencil', title: '期末考试周',
      desc: '期末考试来了！接下来要全力复习，创作只能暂停...',
      effect: '时间-3天（持续2回合）', effectClass: 'negative',
      apply: (s) => { s.timeDebuffs.push({ id: 'exam', reason: '期末考试', turnsLeft: 2, delta: -3 }); s.time = computeTime(s.turn, s.timeDebuffs); },
      tip: '考试是周期性的外生时间冲击。大学生创作者的产出呈明显的学期周期——寒暑假是同人产出的高峰期，考试月是低谷。',
    },
  },
  // 毕业
  {
    turns: [49],
    event: {
      id: 'graduation', emoji: 'graduation-cap', title: '毕业了',
      desc: '四年大学生活结束了。从此以后，同人创作变成了"业余爱好"。工作会给你收入，但空闲时间将大幅减少...',
      effect: '热情-5 开始工作生涯', effectClass: 'neutral',
      apply: (s) => { s.passion -= 5; },
      tip: '进入工作后，时间禀赋永久性下降。工作后的同人创作者是真正的幸存者。',
    },
  },
];

// === Random Events ===
export const RANDOM_EVENTS = [
  {
    id: 'boom', emoji: 'fire', title: '圈内大佬出圈了！',
    desc: (s) => { const big = s.advanced?.networkPhase === 'mature' || s.advanced?.networkPhase === 'fragmented'; return big ? '一位知名创作者的作品在社交媒体上爆火，但无标度网络中流量集中在头部，你很难分到红利。' : '一位知名创作者的作品在社交媒体上爆火，整个圈子的关注度都上升了。'; },
    effect: (s) => { const big = s.advanced?.networkPhase === 'mature' || s.advanced?.networkPhase === 'fragmented'; return big ? '热情+10' : '声誉+0.3 热情+10'; }, effectClass: 'positive',
    apply: (s) => { const big = s.advanced?.networkPhase === 'mature' || s.advanced?.networkPhase === 'fragmented'; if (!big) s.reputation += 0.3; s.passion = Math.min(100, s.passion + 10); },
    tip: (s) => { const big = s.advanced?.networkPhase === 'mature' || s.advanced?.networkPhase === 'fragmented'; return big ? '无标度网络中度分布服从幂律——少数超级节点占据绝大多数连接。普通创作者几乎分不到热度红利。' : '在无干预的同人市场中，任何创作者的出圈都是正外部性——别人把盘子做大了，你不花任何成本就能享受流量红利。'; },
    weight: 12, when: () => true, maxTotal: Infinity,
  },
  {
    id: 'collapse', emoji: 'warning-circle', title: '塌方事件！',
    desc: '圈内爆发争吵，有创作者被挂，社群气氛紧张...',
    effect: (s) => { const r = s.endowments.resilience || 0; const m = r <= 1 ? 2.3 - r * 0.5 : 1; return `热情-${Math.round(15 * m)}`; }, effectClass: 'negative',
    apply: (s) => { const r = s.endowments.resilience || 0; const m = r <= 1 ? 2.3 - r * 0.5 : 1; s.passion -= Math.round(15 * m); },
    tip: '塌方影响的是社群氛围和你的心态，但你的作品和口碑还在。保持冷静，风波总会过去。',
    weight: 8, when: (s) => s.reputation > 0.3, maxTotal: Infinity,
  },
  {
    id: 'family_emergency', emoji: 'first-aid', title: '家人生病了',
    desc: '家里突然有人生病需要照顾，接下来几个月你的空闲时间会大幅减少，医疗费也是一大笔...',
    effect: (s) => { const cost = Math.round((s.monthlyIncome || 800) * (0.8 + Math.random() * 0.7)); return `时间-3天(3回合) 资金-¥${cost}`; }, effectClass: 'negative',
    apply: (s) => { s.timeDebuffs.push({ id: 'family', reason: '照顾家人', turnsLeft: 3, delta: -3 }); s.time = computeTime(s.turn, s.timeDebuffs); const cost = Math.round((s.monthlyIncome || 800) * (0.8 + Math.random() * 0.7)); addMoney(s, -cost); },
    tip: '外生冲击可以让时间降到0。一半创作者退出是因为"现实太忙"——时间约束独立于热情预算，是最硬的硬约束。',
    weight: 4, when: () => true, maxTotal: 2,
  },
  {
    id: 'overtime', emoji: 'clock', title: '连续加班/赶论文',
    desc: '这段时间完全被工作或学业占满，几乎没有私人时间...',
    effect: '时间-4天（持续2回合）', effectClass: 'negative',
    apply: (s) => { s.timeDebuffs.push({ id: 'overtime', reason: '加班/赶DDL', turnsLeft: 2, delta: -4 }); s.time = computeTime(s.turn, s.timeDebuffs); },
    tip: '当时间降到0时，什么创作也做不了，只能选择休息等待忙碌过去。',
    weight: 7, when: (s) => s.turn > 1, maxTotal: Infinity,
  },
  {
    id: 'holiday', emoji: 'tree-palm', title: '一段悠闲时光',
    desc: '难得的闲暇，可以专心创作。',
    effect: '时间+2天(2回合) 热情+8', effectClass: 'positive',
    apply: (s) => { s.timeDebuffs.push({ id: 'holiday', reason: '悠闲时光', turnsLeft: 2, delta: 2 }); s.time = computeTime(s.turn, s.timeDebuffs); s.passion = Math.min(100, s.passion + 8); },
    tip: '同人本创作需要"成块的连续时间"。',
    weight: 10, when: () => true, maxTotal: Infinity,
  },
  {
    id: 'doujin_event', emoji: 'tent', title: '同人展开催！',
    desc: '本地同人展即将举办！面对面贩售，信息披露自动拉满。',
    effect: '声誉+0.2 资金+200 信息↑', effectClass: 'positive',
    apply: (s) => { s.reputation += 0.2; addMoney(s, 200); s.infoDisclosure = Math.min(1, s.infoDisclosure + 0.3); },
    tip: '同人展是信息密集的面对面交易——消费者直接翻阅实物',
    weight: 8, when: (s) => s.totalHVP > 0 || s.totalLVP > 0, maxTotal: Infinity,
  },
  {
    id: 'recession', emoji: 'trend-down', title: '经济下行',
    desc: '宏观经济进入下行周期，消费者的可支配休闲资金持续减少。这不是一时的困难，而是持续数年的寒冬...',
    effect: '销量-30%（持续2~3年！）', effectClass: 'negative',
    apply: (s) => { s.recessionTurnsLeft = 24 + Math.floor(Math.random() * 12); },
    tip: '经济下行不是一次性冲击。同人本是弱奢侈品(收入弹性≈1.06)，超量消费被持续压缩。承诺消费提供底线保护，但上限被大幅削减。',
    weight: 3, when: (s) => s.recessionTurnsLeft <= 0 && s.turn > 12 && activeCrisisCount(s) < 2, maxTotal: 2,
  },
  {
    id: 'ai', emoji: 'robot', title: 'AI冲击波',
    desc: '大量AI生成的内容涌入市场，竞争加剧...',
    effect: '声誉-0.15', effectClass: 'neutral',
    apply: (s) => { s.reputation = Math.max(0, s.reputation - 0.15); },
    tip: 'AI把"执行劳动"无限贬值，但无法取代企业家的敏锐度——发现未被满足需求的能力。人创的不完美性反而成了稀缺品。',
    weight: 5, when: (s) => s.turn > 18 && (s.totalHVP > 0 || s.totalLVP > 0), maxTotal: Infinity,
  },
  {
    id: 'fanmail', emoji: 'envelope', title: '收到热情长评！',
    desc: '一位读者写了很长的感想，详细描述了你的作品给TA带来的感动...',
    effect: '热情+15', effectClass: 'positive',
    apply: (s) => { s.passion = Math.min(100, s.passion + 15); },
    tip: '社群反馈是热情预算的重要补充来源。一封走心的长评可以抵消很多现实消耗。',
    weight: 10, when: (s) => s.reputation > 1 && (s.totalHVP > 0 || s.totalLVP > 0), maxTotal: Infinity,
  },
  {
    id: 'inflation', emoji: 'money', title: '印刷成本上涨',
    desc: '原材料涨价，印刷和制作成本提高了...',
    effect: '资金-400', effectClass: 'negative',
    apply: (s) => { addMoney(s, -400); },
    tip: '通胀从两个方向夹击多样性：降低同人谷声誉稳态，同时抬高同人本准入门槛。',
    weight: 5, when: (s) => s.totalHVP > 0 || s.totalLVP > 0, maxTotal: Infinity,
  },
  {
    id: 'uni_breakup', emoji: 'heart-break', title: '感情变动',
    desc: '一段感情的开始或结束占据了你大量的心理能量...',
    effect: (s) => { const r = s.endowments.resilience || 0; const m = r <= 1 ? 2.3 - r * 0.5 : 1; return `热情-${Math.round(12 * m)}`; }, effectClass: 'negative',
    apply: (s) => { const r = s.endowments.resilience || 0; const m = r <= 1 ? 2.3 - r * 0.5 : 1; s.passion -= Math.round(12 * m); },
    tip: '热情预算不仅被创作消耗，还被生活中的情绪事件消耗。',
    weight: 4, when: (s) => getLifeStage(s.turn) === 'university', maxTotal: 2,
  },
  {
    id: 'work_raise', emoji: 'trend-up', title: '升职加薪！',
    desc: '工作表现不错，获得了加薪。但责任更重，时间更少...',
    effect: '资金+1000 时间-1天（12~18月）', effectClass: 'neutral',
    apply: (s) => { addMoney(s, 1000); s.timeDebuffs.push({ id: 'promotion', reason: '升职加责', turnsLeft: 12 + Math.floor(Math.random() * 6), delta: -1 }); s.time = computeTime(s.turn, s.timeDebuffs); },
    tip: '高收入者的时间机会成本更高。',
    weight: 4, when: (s) => getLifeStage(s.turn) === 'work' && !s.unemployed, maxTotal: 3,
  },
  {
    id: 'work_996', emoji: 'building-office', title: '996加班季',
    desc: '项目紧急，公司要求全员加班。几乎没有私人时间...',
    effect: '时间-4天(3回合) 资金+500', effectClass: 'negative',
    apply: (s) => { s.timeDebuffs.push({ id: '996', reason: '996加班', turnsLeft: 3, delta: -4 }); s.time = computeTime(s.turn, s.timeDebuffs); addMoney(s, 500); },
    tip: '滞胀特征：需要更多工作时间维持生活',
    weight: 7, when: (s) => {
      if (getLifeStage(s.turn) !== 'work' || s.unemployed) return false;
      // Not during remote work, flexible hours, or dept transfer
      return !s.timeDebuffs.some(d => d.id.startsWith('remote_') || d.id.startsWith('flex_') || d.id.startsWith('transfer_'));
    }, maxTotal: Infinity,
  },
  {
    id: 'inspiration_burst', emoji: 'sparkle', title: '灵感爆发！',
    desc: '你的创作天赋在某个瞬间被点燃，脑海中涌现出绝妙的创意！',
    effect: '热情+8 声誉+0.2', effectClass: 'positive',
    apply: (s) => { s.passion = Math.min(100, s.passion + 8); s.reputation += 0.2; },
    tip: '创作天赋高的创作者更容易进入"心流"状态。这种突发灵感是内在动机的体现',
    weight: 4, when: (s) => (s.endowments.talent || 0) >= 2 && (s.totalHVP > 0 || s.totalLVP > 0), maxTotal: Infinity,
  },
  {
    id: 'creative_block', emoji: 'wall', title: '创作瓶颈',
    desc: '怎么画都不满意，反复推翻重来...感觉自己江郎才尽了。',
    effect: '热情-6', effectClass: 'negative',
    apply: (s) => { s.passion = Math.max(0, s.passion - 6); },
    tip: '创作天赋低的创作者更容易遭遇瓶颈。',
    weight: 5, when: (s) => (s.endowments.talent || 0) <= 1 && s.totalHVP > 0, maxTotal: Infinity,
  },
  {
    id: 'health_issue', emoji: 'thermometer', title: '身体不适',
    desc: '最近免疫力下降，生了一场病，看病买药花了不少...',
    effect: '热情-5 时间-2天(2回合) 资金-¥500~800', effectClass: 'negative',
    apply: (s) => { s.passion = Math.max(0, s.passion - 5); s.timeDebuffs.push({ id: 'sick', reason: '身体不适', turnsLeft: 2, delta: -2 }); s.time = computeTime(s.turn, s.timeDebuffs); addMoney(s, -(500 + Math.floor(Math.random() * 300))); },
    tip: '体力精力低的创作者更容易生病。身体是革命的本钱。',
    weight: 4, when: (s) => (s.endowments.stamina || 0) <= 1, maxTotal: 3,
  },
  {
    id: 'energy_surge', emoji: 'fire', title: '精力充沛！',
    desc: '最近状态特别好，精力旺盛，感觉什么都能做！',
    effect: '热情+6', effectClass: 'positive',
    apply: (s) => { s.passion = Math.min(100, s.passion + 6); },
    tip: '体力禀赋高的人恢复速度快、消耗低。同样的创作行为，不同人的精力消耗截然不同。',
    weight: 3, when: (s) => (s.endowments.stamina || 0) >= 2, maxTotal: Infinity,
  },
  {
    id: 'friend_intro', emoji: 'chat-circle', title: '朋友介绍了靠谱搭档',
    desc: '你的社交圈帮你找到了一位口碑很好的创作者——加个好友先！',
    effect: '人脉+1（高亲密度·默契搭档）', effectClass: 'positive',
    apply: (s) => { s._pendingFriendIntro = true; },
    tip: '社交魅力高→搜寻成本低。通过朋友介绍认识的人通常更可靠，初始亲密度也更高。',
    weight: 3, when: (s) => (s.endowments.social || 0) >= 2, maxTotal: 2,
  },
  {
    id: 'viral_post', emoji: 'phone', title: '帖子意外火了！',
    desc: '你随手发的一条动态获得了大量转发，信息扩散到了意想不到的范围！',
    effect: '信息+30% 声誉+0.15', effectClass: 'positive',
    apply: (s) => { s.infoDisclosure = Math.min(1, s.infoDisclosure + 0.3); s.reputation += 0.15; },
    tip: '营销直觉高的创作者更善于制造传播点。信息披露是比声誉更直接的转化驱动力。',
    weight: 3, when: (s) => (s.endowments.marketing || 0) >= 2 && (s.totalHVP > 0 || s.totalLVP > 0), maxTotal: Infinity,
  },
  {
    id: 'promo_fail', emoji: 'eye-closed', title: '宣传翻车...',
    desc: '发了一条宣传但措辞不当，引发了一些争议...',
    effect: '声誉-0.1 信息+10%(黑红也是红)', effectClass: 'negative',
    apply: (s) => { s.reputation = Math.max(0, s.reputation - 0.1); s.infoDisclosure = Math.min(1, s.infoDisclosure + 0.1); },
    tip: '营销直觉低的人更容易踩雷。信息披露是双刃剑——不当宣传会带来负面注意力，但"黑红也是红"确实会提升曝光度。',
    weight: 4, when: (s) => (s.endowments.marketing || 0) <= 1 && s.infoDisclosure > 0.3 && (s.totalHVP > 0 || s.totalLVP > 0), maxTotal: Infinity,
  },
  {
    id: 'harsh_review', emoji: 'smiley-angry', title: '遭遇恶评',
    desc: '你通过一些渠道知道了针对你的黑屁，言辞很伤人...',
    effect: (s) => { const r = s.endowments.resilience || 0; const m = r <= 1 ? 2.3 - r * 0.5 : Math.max(0.7, 1.0 - (r - 2) * 0.15); return `热情-${Math.round(10 * m)} 声誉-${Math.round(15 * m)}%`; }, effectClass: 'negative',
    apply: (s) => { const r = s.endowments.resilience || 0; const m = r <= 1 ? 2.3 - r * 0.5 : Math.max(0.7, 1.0 - (r - 2) * 0.15); s.passion = Math.max(0, s.passion - Math.round(10 * m)); s.reputation *= (1 - 0.15 * m); },
    tip: '恶评针对的是你个人，会直接损害声誉。心理韧性低的人受影响更大。和圈内塌方不同——塌方只伤心态，恶评伤口碑。',
    weight: 5, when: (s) => s.reputation > 0.5 && (s.totalHVP > 0 || s.totalLVP > 0), maxTotal: Infinity,
  },
  {
    id: 'speculator_rush', emoji: 'trend-up', title: '投机客涌入二手市场！',
    desc: '有人发现圈内某些旧作价格在涨，大量投机客开始囤货。二手市场价格被推高，普通消费者被挤出...',
    effect: '二手压力暂降 收藏品增值', effectClass: 'neutral',
    apply: (s) => { if (s.official) { s.official.secondHandPool.lvp = Math.floor(s.official.secondHandPool.lvp * 0.5); s.official.secondHandPool.hvp = Math.floor(s.official.secondHandPool.hvp * 0.6); } },
    tip: '投机客买的不是内容，而是押注稀缺性溢价。当他们涌入时，二手池被清空（压力降低），但普通消费者被挤出。',
    weight: 3, when: (s) => s.turn > 12 && s.official && (s.official.secondHandPool.lvp > 10 || s.official.secondHandPool.hvp > 5), maxTotal: Infinity,
  },
  {
    id: 'bubble_burst', emoji: 'warning-circle', title: '二手泡沫破裂！',
    desc: '投机客集体抛售，大量二手商品涌入市场，价格暴跌！新品销量也受到冲击...',
    effect: '二手压力大幅上升 同人谷销量受挫', effectClass: 'negative',
    apply: (s) => { if (s.official) { s.official.secondHandPool.lvp += Math.floor((s.market?.communitySize || 10000) * 0.01); s.official.secondHandPool.hvp += Math.floor((s.market?.communitySize || 10000) * 0.003); } },
    tip: '泡沫破裂时，投机客理性泡沫B归零，价格回落到基础价值F。大量抛售使二手池膨胀，同人谷受冲击最大。',
    weight: 2, when: (s) => s.turn > 18 && (s.eventCounts['speculator_rush'] || 0) > 0, maxTotal: 3,
  },
  {
    id: 'rare_work_found', emoji: 'diamond', title: '你的旧作成了海景房！',
    desc: (s) => {
      const w = findRareWork(s);
      return `你的「${w?.name || '早期作品'}」因为绝版和声誉加持，在二手市场上被炒到了高价。有人愿意出高价向你求购签名版……要不要考虑加印？`;
    },
    effect: '资金+声誉加成 声誉+0.3', effectClass: 'positive',
    apply: (s) => {
      addMoney(s, 500 + Math.round(s.maxReputation * 200)); s.reputation += 0.3;
      const w = findRareWork(s);
      if (w) w.isRareWork = true;
    },
    tip: '当一手市场绝版，无套利上限被打破，商品从消费品突变为金融资产。声誉越高，基础定价越高。如果你选择加印，投机客手中的"绝版品"将失去稀缺溢价……',
    weight: 2,
    when: (s) => s.maxReputation >= 2 && s.totalHVP >= 2 && s.turn > 24 && !!findRareWork(s),
    maxTotal: 3,
  },
  {
    id: 'rent_increase', emoji: 'house', title: '房租上涨',
    desc: '房东通知下个月开始涨租。在这个城市，住房成本是越来越重的负担...',
    effect: '资金-300~500 热情-3', effectClass: 'negative',
    apply: (s) => { addMoney(s, -(300 + Math.floor(Math.random() * 200))); s.passion = Math.max(0, s.passion - 3); },
    tip: '住房成本是都市创作者的隐性杀手。房租挤占的不是时间，是"心理安全感"——当生存成本上升，创作变成一种奢侈。',
    weight: 5, when: (s) => getLifeStage(s.turn) === 'work', maxTotal: 3,
  },
  {
    id: 'work_burnout', emoji: 'smiley-sad', title: '职业倦怠',
    desc: '每天重复的工作内容让你感到麻木，回到家只想瘫着什么都不做，还忍不住冲动消费...',
    effect: '热情-8 时间-2天(3回合) 资金-¥300~600', effectClass: 'negative',
    apply: (s) => { s.passion = Math.max(0, s.passion - 8); addMoney(s, -(300 + Math.floor(Math.random() * 300))); s.timeDebuffs.push({ id: 'burnout_' + s.turn, reason: '职业倦怠', turnsLeft: 3, delta: -2 }); s.time = computeTime(s.turn, s.timeDebuffs); },
    tip: '职业倦怠不是懒——是长期高强度低回报工作的心理防御机制。',
    weight: 6, when: (s) => {
      if (getLifeStage(s.turn) !== 'work' || s.unemployed) return false;
      // Not during transfer to easy dept or partner support
      return !s.timeDebuffs.some(d => d.id.startsWith('transfer_') || d.id.startsWith('bestie_support_') || d.id.startsWith('bestie_save_'));
    }, maxTotal: Infinity,
  },
  {
    id: 'social_obligation', emoji: 'beer-stein', title: '社交应酬',
    desc: '公司团建、同事聚餐、客户应酬……这些"不得不去"的社交活动占据了你的创作时间。',
    effect: '时间-2天(2回合) 资金-200 热情-2', effectClass: 'negative',
    apply: (s) => { s.timeDebuffs.push({ id: 'social_' + s.turn, reason: '社交应酬', turnsLeft: 2, delta: -2 }); s.time = computeTime(s.turn, s.timeDebuffs); addMoney(s, -200); s.passion = Math.max(0, s.passion - 2); },
    tip: '职场社交是一种"强制消费"——你用时间和金钱购买的不是快乐，而是职场关系的维护成本。',
    weight: 6, when: (s) => getLifeStage(s.turn) === 'work' && !s.unemployed, maxTotal: Infinity,
  },
  {
    id: 'commute_hell', emoji: 'train', title: '通勤地狱',
    desc: '公司搬了办公地点，或者你不得不搬到更远的地方住。每天通勤时间大幅增加...',
    effect: '时间-1天（6~12月）', effectClass: 'negative',
    apply: (s) => { s.timeDebuffs.push({ id: 'commute_' + s.turn, reason: '通勤时间增加', turnsLeft: 6 + Math.floor(Math.random() * 6), delta: -1 }); s.time = computeTime(s.turn, s.timeDebuffs); },
    tip: '通勤是城市生活最大的时间黑洞。',
    weight: 3, when: (s) => {
      if (getLifeStage(s.turn) !== 'work' || s.unemployed) return false;
      // Not during remote work
      return !s.timeDebuffs.some(d => d.id.startsWith('remote_'));
    }, maxTotal: 2,
  },
  {
    id: 'life_admin', emoji: 'clipboard', title: '生活琐事',
    desc: '交费、修电器、跑手续……生活充满了琐碎但不得不做的事情，还得花钱。',
    effect: (s) => { const cost = getLifeStage(s.turn) === 'work' ? '200~500' : '50~150'; return `时间-2天(2回合) 热情-3 资金-¥${cost}`; }, effectClass: 'negative',
    apply: (s) => { s.timeDebuffs.push({ id: 'admin_' + s.turn, reason: '生活琐事', turnsLeft: 2, delta: -2 }); s.time = computeTime(s.turn, s.timeDebuffs); const cost = getLifeStage(s.turn) === 'work' ? 200 + Math.floor(Math.random() * 300) : 50 + Math.floor(Math.random() * 100); addMoney(s, -cost); s.passion = Math.max(0, s.passion - 3); },
    tip: '生活管理成本是成年后的隐性税。',
    weight: 7, when: () => true, maxTotal: Infinity,
  },
  {
    id: 'old_friend_reunion', emoji: 'beer-bottle', title: '老友重聚',
    desc: '大学时一起搞同人的朋友约你出来聚聚。几年不见，大家的生活都变了很多...',
    effect: (s) => { const r = s.endowments.resilience || 0; const m = r <= 1 ? 2.3 - r * 0.5 : 1; return `热情+5 或 -${Math.round(5 * m)}（看情况）`; }, effectClass: 'neutral',
    apply: (s) => { if (Math.random() < 0.5) { s.passion = Math.min(100, s.passion + 5); } else { const r = s.endowments.resilience || 0; const m = r <= 1 ? 2.3 - r * 0.5 : 1; s.passion = Math.max(0, s.passion - Math.round(5 * m)); } },
    tip: '同人圈的社交关系随时间自然衰减。重聚可能带来温暖，也可能让你意识到"只有自己还在坚持"的孤独感。',
    weight: 4, when: (s) => getLifeStage(s.turn) === 'work' && (s.turn - 50) / 12 > 2, maxTotal: 3,
  },
  {
    id: 'commercial_offer', emoji: 'envelope', title: '出版社的邀约',
    desc: '你的作品在业界引起了关注。一位出版社编辑在展会后找到你，递来了名片——"我们很看好你的创作实力，有兴趣聊聊商业出版吗？"',
    effect: '解锁「商业出道」行动', effectClass: 'positive',
    apply: (s) => { s.commercialOfferReceived = true; s.passion = Math.min(100, s.passion + 10); },
    tip: '从同人到商业是许多创作者的自然进化路径。',
    weight: 15,
    when: (s) => {
      if (s.commercialOfferReceived || s.reputation < 16 || s.totalRevenue < 50000 || s.totalHVP < 8 || getCreativeSkill(s) < 4 || s.turn < 24) return false;
      if (s.recessionTurnsLeft > 0 || (s.advanced && (s.advanced.stagflationTurnsLeft > 0 || s.advanced.debtCrisisActive))) return Math.random() < 0.3;
      return true;
    },
    maxTotal: 1,
  },
  {
    id: 'secondhand_crackdown', emoji: 'shield', title: '平台整治二手倒卖',
    desc: '交易平台开始打击无授权二手倒卖行为，大量违规商品被下架。正规新品的竞争环境暂时好转了。',
    effect: '二手压力大幅下降 新品销量回升', effectClass: 'positive',
    apply: (s) => { if (s.official) { s.official.secondHandPool.lvp = Math.floor(s.official.secondHandPool.lvp * 0.6); s.official.secondHandPool.hvp = Math.floor(s.official.secondHandPool.hvp * 0.6); } s.passion = Math.min(100, s.passion + 3); },
    tip: '平台整治是外部力量对二手市场的周期性干预。',
    weight: 3, when: (s) => s.official && (s.official.secondHandPressure.lvp > 0.3 || s.official.secondHandPressure.hvp > 0.2), maxTotal: 2,
  },
  {
    id: 'unexpected_expense', emoji: 'cardholder', title: '意外大额支出',
    desc: '手机摔碎了/电脑出问题/朋友随礼……生活总会给你一些"惊喜"。',
    effect: (s) => { const isWork = getLifeStage(s.turn) === 'work'; const cost = isWork ? 1500 + Math.round(Math.random() * 1500) : 300 + Math.round(Math.random() * 400); return `资金-¥${cost} 热情-3`; }, effectClass: 'negative',
    apply: (s) => { const isWork = getLifeStage(s.turn) === 'work'; const cost = isWork ? 1500 + Math.floor(Math.random() * 1500) : 300 + Math.floor(Math.random() * 400); addMoney(s, -cost); s.passion = Math.max(0, s.passion - 3); },
    tip: '意外支出是生活的常态。没有备用金，一次意外就可能吃掉你几个月的同人预算。',
    weight: 5, when: (s) => s.turn > 3, maxTotal: Infinity,
  },
  {
    id: 'tax_season', emoji: 'receipt', title: '年度税费清算',
    desc: '工作满一年，个税汇算、社保补缴、各种年度账单一起到……钱包大出血。',
    effect: (s) => { const cost = Math.round((s.monthlyIncome || 800) * (0.5 + Math.random() * 0.5)); return `资金-¥${cost}`; }, effectClass: 'negative',
    apply: (s) => { const cost = Math.round((s.monthlyIncome || 800) * (0.5 + Math.random() * 0.5)); addMoney(s, -cost); },
    tip: '年度税费是不可避免的制度性支出。',
    weight: 20, when: (s) => getLifeStage(s.turn) === 'work' && (s.turn - 50) > 0 && (s.turn - 50) % 12 === 0, maxTotal: Infinity,
  },
  // === Work 5+ years: positive time recovery events ===
  {
    id: 'remote_work', emoji: 'desktop', title: '公司开始推行居家办公',
    desc: '公司调整了办公政策，每周有几天可以在家工作。省去通勤时间，创作时间多了不少！',
    effect: '时间+2天（6~12月）热情+5', effectClass: 'positive',
    apply: (s) => { s.timeDebuffs.push({ id: 'remote_' + s.turn, reason: '居家办公', turnsLeft: 6 + Math.floor(Math.random() * 6), delta: 2 }); s.time = computeTime(s.turn, s.timeDebuffs); s.passion = Math.min(100, s.passion + 5); },
    tip: '远程办公是职场创作者最大的福音——每天省下的通勤时间足够画一张草稿。',
    weight: 8, when: (s) => {
      if (getLifeStage(s.turn) !== 'work' || s.unemployed || (s.turn - 50) / 12 < 3) return false;
      // Not during 996 or commute hell
      return !s.timeDebuffs.some(d => d.id === '996' || d.id.startsWith('commute_'));
    }, maxTotal: 3,
  },
  {
    id: 'work_efficiency', emoji: 'rocket', title: '工作越来越熟练了',
    desc: '在公司待了几年，业务流程已经烂熟于心。同样的工作量用更少的时间就能完成，摸出来的空闲时间用来构思创作。',
    effect: '时间+1天（12~18月）', effectClass: 'positive',
    apply: (s) => { s.timeDebuffs.push({ id: 'efficient_' + s.turn, reason: '高效摸鱼', turnsLeft: 12 + Math.floor(Math.random() * 6), delta: 1 }); s.time = computeTime(s.turn, s.timeDebuffs); },
    tip: '工作熟练度是时间的朋友——入职初期忙得焦头烂额，几年后同样的活半天就做完了。省下的时间就是你的创作本钱。',
    weight: 10, when: (s) => {
      if (getLifeStage(s.turn) !== 'work' || s.unemployed || (s.turn - 50) / 12 < 2) return false;
      // Not during burnout
      return !s.timeDebuffs.some(d => d.id.startsWith('burnout_'));
    }, maxTotal: Infinity,
  },
  {
    id: 'annual_leave', emoji: 'sun-horizon', title: '年假攒够了！',
    desc: '工龄越长年假越多，你决定把假期集中起来，给自己一段专注创作的时光。',
    effect: '时间+3天（3回合）热情+8', effectClass: 'positive',
    apply: (s) => { s.timeDebuffs.push({ id: 'annual_leave_' + s.turn, reason: '年假创作', turnsLeft: 3, delta: 3 }); s.time = computeTime(s.turn, s.timeDebuffs); s.passion = Math.min(100, s.passion + 8); },
    tip: '年假是打工人最宝贵的时间资产。有经验的创作者会把年假攒到展会前集中使用——备货、赶稿、参展一气呵成。',
    weight: 12, when: (s) => {
      if (getLifeStage(s.turn) !== 'work' || s.unemployed || (s.turn - 50) / 12 < 1) return false;
      // Can't take leave during 996
      return !s.timeDebuffs.some(d => d.id === '996');
    }, maxTotal: Infinity,
  },
  {
    id: 'dept_transfer', emoji: 'arrows-clockwise', title: '调岗到清闲部门',
    desc: '公司内部调整，你被调到了一个相对清闲的部门。虽然薪资不变，但工作压力小了很多，下班后终于有精力画画了。',
    effect: '时间+2天（12~18月）热情+5', effectClass: 'positive',
    apply: (s) => { s.timeDebuffs.push({ id: 'transfer_' + s.turn, reason: '清闲部门', turnsLeft: 12 + Math.floor(Math.random() * 6), delta: 2 }); s.time = computeTime(s.turn, s.timeDebuffs); s.passion = Math.min(100, s.passion + 5); },
    tip: '不是所有职场变动都是坏事。有时候"被边缘化"反而是创作者的隐性福利——你要的不是升职加薪，是下班后的精力。',
    weight: 5, when: (s) => {
      if (getLifeStage(s.turn) !== 'work' || s.unemployed || (s.turn - 50) / 12 < 4) return false;
      // Not if recently promoted (promotion debuff active)
      return !s.timeDebuffs.some(d => d.id === 'promotion');
    }, maxTotal: 2,
  },
  {
    id: 'flexible_hours', emoji: 'clock', title: '弹性工作制',
    desc: '公司开始试行弹性工时，不用再朝九晚六了。你把工作时间调到早上，下午和晚上都可以用来创作。',
    effect: '时间+1天（6~12月）', effectClass: 'positive',
    apply: (s) => { s.timeDebuffs.push({ id: 'flex_' + s.turn, reason: '弹性工时', turnsLeft: 6 + Math.floor(Math.random() * 6), delta: 1 }); s.time = computeTime(s.turn, s.timeDebuffs); },
    tip: '弹性工时让创作者能按自己的生物钟安排创作。有人是夜猫子型，有人是早起型——找到自己的节奏比加班更重要。',
    weight: 8, when: (s) => {
      if (getLifeStage(s.turn) !== 'work' || s.unemployed || (s.turn - 50) / 12 < 2) return false;
      // Not during 996 or commute hell
      return !s.timeDebuffs.some(d => d.id === '996' || d.id.startsWith('commute_'));
    }, maxTotal: Infinity,
  },
  // === 闺蜜好感度事件（bestieAffinity 越高越容易触发，效果越强）===
  {
    id: 'bestie_support', emoji: 'heart', title: '小柚：我帮你分担点吧！',
    desc: '闺蜜看你最近太忙了，主动帮你跑腿寄快递、整理素材，让你多了一天创作时间。',
    effect: '闲暇+1天（6月）热情+8', effectClass: 'positive',
    apply: (s) => { s.timeDebuffs.push({ id: 'bestie_support_' + s.turn, reason: '闺蜜帮忙', turnsLeft: 6, delta: 1 }); s.time = computeTime(s.turn, s.timeDebuffs); s.passion = Math.min(100, s.passion + 8); },
    tip: '友情是同人创作者最被低估的资源。一个愿意帮你跑腿的朋友，价值不亚于一个靠谱的搭档。',
    weight: 3, when: (s) => (s.bestieAffinity || 0) >= 30, maxTotal: Infinity,
  },
  {
    id: 'bestie_promo', emoji: 'megaphone', title: '小柚帮你在朋友圈疯狂安利',
    desc: '闺蜜在各种群和社交媒体帮你转发作品，一波自来水带来了不少新关注。',
    effect: '声誉+0.3 信息+15%', effectClass: 'positive',
    apply: (s) => { s.reputation += 0.3; s.infoDisclosure = Math.min(1, s.infoDisclosure + 0.15); },
    tip: '口碑营销的本质是信任传递——朋友推荐的可信度远高于自卖自夸。这是社交资本最直接的变现方式。',
    weight: 3, when: (s) => (s.bestieAffinity || 0) >= 40 && s.totalHVP + s.totalLVP > 0, maxTotal: Infinity,
  },
  {
    id: 'bestie_cheer', emoji: 'confetti', title: '小柚给你寄了一箱零食',
    desc: '"最近辛苦了！吃点好的补补脑～" 收到快递的你心里暖暖的，感觉又能画一整天了。',
    effect: '热情+15', effectClass: 'positive',
    apply: (s) => { s.passion = Math.min(100, s.passion + 15); },
    tip: '创作是孤独的长跑，但有人在终点等你，或者在半路递水，就能多撑很远。',
    weight: 4, when: (s) => (s.bestieAffinity || 0) >= 25 && s.passion < 50, maxTotal: Infinity,
  },
  {
    id: 'bestie_collab', emoji: 'handshake', title: '小柚提议一起做个小企划',
    desc: '闺蜜突然发来消息："我们一起做个联名谷子吧！我出文案你出图！" 合作过程充满欢笑。',
    effect: '热情+12 声誉+0.2 资金+500', effectClass: 'positive',
    apply: (s) => { s.passion = Math.min(100, s.passion + 12); s.reputation += 0.2; addMoney(s, 500); },
    tip: '朋友间的非正式合作往往能产出最有灵气的作品——因为没有KPI的压力，只有纯粹的创作快乐。',
    weight: 2, when: (s) => (s.bestieAffinity || 0) >= 55 && s.turn > 12, maxTotal: 3,
  },
  {
    id: 'bestie_save', emoji: 'lifebuoy', title: '小柚紧急驰援',
    desc: '你快崩溃的时候，闺蜜二话不说请了假飞过来陪你。"先别想那些了，我带你去吃好吃的。"',
    effect: '热情+25 闲暇+2天（3月）', effectClass: 'positive',
    apply: (s) => { s.passion = Math.min(100, s.passion + 25); s.timeDebuffs.push({ id: 'bestie_save_' + s.turn, reason: '闺蜜驰援', turnsLeft: 3, delta: 2 }); s.time = computeTime(s.turn, s.timeDebuffs); },
    tip: '真正的友谊在你最低谷的时候才会显现。这种"不问原因直接来"的行动力，是任何物质都换不来的。',
    weight: 3, when: (s) => (s.bestieAffinity || 0) >= 60 && s.passion < 25, maxTotal: 2,
  },
  {
    id: 'bestie_network', emoji: 'users', title: '小柚介绍了一个圈内朋友给你',
    desc: '"我有个朋友也搞同人的，你们肯定聊得来！" 新认识的人给了你很多灵感和市场信息。',
    effect: '声誉+0.15 信息+10%', effectClass: 'positive',
    apply: (s) => { s.reputation += 0.15; s.infoDisclosure = Math.min(1, s.infoDisclosure + 0.1); },
    tip: '弱关系理论：你的闺蜜认识的人，跟你的社交圈重叠度低，因此能带来更多新信息和新机会。',
    weight: 3, when: (s) => (s.bestieAffinity || 0) >= 35, maxTotal: Infinity,
  },
  {
    id: 'bestie_booth', emoji: 'tent', title: '小柚要来展会帮你看摊！',
    desc: '"下个展我请假陪你去！你专心招待客人，后勤交给我！" 有人帮忙的展会轻松多了。',
    effect: '热情+10 下次展会精力充沛', effectClass: 'positive',
    apply: (s) => { s.passion = Math.min(100, s.passion + 10); s.timeDebuffs.push({ id: 'bestie_booth_' + s.turn, reason: '闺蜜助阵', turnsLeft: 3, delta: 1 }); s.time = computeTime(s.turn, s.timeDebuffs); },
    tip: '展会上有个信任的人帮忙看摊，你才能放心去逛别的摊位、交换名片。这就是社交资本在实际场景中的价值。',
    weight: 2, when: (s) => (s.bestieAffinity || 0) >= 45 && (s.availableEvents?.length || 0) > 0, maxTotal: Infinity,
  },
];
