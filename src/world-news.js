/**
 * World News — 宏观经济新闻与社会热点
 * Used in Nyaner's "世界动态" tab (replacing old market-focused world data)
 */

// === Macro Economy News ===
const MACRO_NEWS = [
  // 经济周期
  '央行宣布降息，市场流动性充裕，消费信心回升中',
  '通胀数据超预期，日常消费品价格普遍上涨',
  '就业市场报告：应届毕业生就业率创新低',
  '房价连续三个月下跌，年轻人消费结构悄然变化',
  'GDP增速放缓，经济学家：消费降级趋势明显',
  '股市震荡：散户情绪低迷，避险资产走强',
  '新一轮消费券发放，覆盖文化娱乐领域',
  '外贸顺差扩大，但内需依然疲软',
  '数字经济规模突破新高，线上消费占比持续提升',
  '社会消费品零售总额回暖，文化娱乐支出增长显著',

  // 就业&职场
  '互联网大厂裁员潮持续，转行做自由职业的人越来越多',
  '灵活就业人数突破2亿，"斜杠青年"成为常态',
  '"躺平"话题再上热搜，年轻人消费观引发热议',
  '远程办公政策放宽，通勤压力缓解利好创作者',
  '996工作制再度引发争议，劳动者权益话题升温',
  '考公热潮不减，"铁饭碗"仍是多数人的首选',
  '副业经济火爆：超四成上班族有第二收入来源',

  // 政策&社会
  '版权法修订草案公开征求意见，同人创作边界再引讨论',
  '文化产业扶持政策出台，小型创作者也能申请补贴',
  '网络实名制进一步收紧，匿名发布内容门槛提高',
  '未成年人网络消费限额新规实施',
  '平台经济反垄断持续推进，中小创作者获得更多流量',
  '个人所得税起征点调整方案引发热议',
  '知识产权保护力度加大，盗版打击行动见效',
];

// === Life & Culture News ===
const LIFE_NEWS = [
  // 文化现象
  '某热门IP电影票房破40亿，二创热度暴涨',
  '今年最火的番剧完结，粉丝创作井喷',
  '国产游戏出海大获成功，文化自信提升',
  '虚拟主播行业洗牌，头部效应愈发明显',
  'AI绘画争议再起：是工具还是替代？创作者圈炸锅',
  '短视频平台推出创作者激励计划，流量向原创倾斜',
  '纸质书销量逆势增长：年轻人重新发现实体的魅力',
  '独立书店复兴潮：小众文化空间成为年轻人新据点',
  '某知名画师宣布休息一年，引发"创作者倦怠"讨论',

  // 科技&互联网
  '新社交平台「看山问答」上线，主打"慢内容"概念',
  '电商平台大促：文创品类销量同比增长200%',
  'AR技术突破：未来展会可能变成虚拟空间',
  '某平台算法调整，创作者有机曝光率下降30%',
  '数字藏品市场降温，实体创作反而更受追捧',
  '大语言模型更新迭代，创作辅助工具越来越强',

  // 社会热点
  '全国多地举办动漫文化节，二次元出圈加速',
  '"为爱发电"入选年度热词，同人经济受到关注',
  '年度消费报告：Z世代在兴趣消费上花费最高',
  '春节档电影大战：IP改编作品占据半壁江山',
  '某城市推出"创意城市"计划，创作者聚集区免租金',
  '国际漫展首次落地内地，门票秒罄',
  '环保话题升温：可持续印刷工艺受到创作者青睐',
  '高铁网络再扩展，跨城参展变得更方便了',
  '台风/暴雨预警：部分地区展会可能受影响',
  '暑假经济火爆，文化消费成为主要增长点',
];

// === App-linked News (虚拟APP联动) ===
const APP_NEWS = [
  // 嗯造
  '「嗯造」App更新：新增创作进度分享功能，朋友圈被刷屏了',
  '「嗯造」年度创作报告出炉：人均完成2.3部作品，你拖后腿了吗？',
  '「嗯造」联合印刷厂推出限时折扣，用户量暴涨',

  // 次元宣发机
  '「次元宣发机」算法大更新：优质内容获得更多推荐',
  '「次元宣发机」被曝存在流量造假问题，官方紧急回应',
  '「次元宣发机」推出"新人扶持计划"，首月免费推广',
  '「次元宣发机」与多平台打通，一键同步宣发成为现实',

  // 喵画师
  '「喵画师」接稿平台月活突破百万，自由画师收入水涨船高',
  '「喵画师」发布行业薪资报告：插画师平均时薪上涨15%',
  '「喵画师」推出"技能认证"体系，认证画师接单率翻倍',
  '「喵画师」年度最佳约稿评选开始，奖金池高达10万',

  // 喵丝职聘
  '「喵丝职聘」数据：文创行业招聘需求同比增长40%',
  '「喵丝职聘」推出"创作者友好企业"认证标签',
  '「喵丝职聘」发布报告：弹性工作制成求职者首要考虑因素',

  // 漫展通
  '「漫展通」统计：今年全国同人展数量突破800场',
  '「漫展通」新功能上线：一键比较各展会摊费和预估人流',
  '「漫展通」联合多家展会推出"新人摊主免摊费"活动',
  '「漫展通」发布安全提醒：注意辨别虚假展会信息',

  // 打破次元墙
  '「打破次元墙」社区月度活跃搭档数创新高',
  '「打破次元墙」推出"搭档信用评分"系统，减少合作纠纷',
  '「打破次元墙」联合法律平台推出免费合作协议模板',

  // Nyaner
  '「Nyaner」日活用户突破500万，成为同人圈最大社交平台',
  '「Nyaner」推出创作者专属主页功能，个人品牌更好打造',
  '「Nyaner」整治水军刷评行为，虚假好评将被标记',

  // Memu
  '「Memu」数码设备年度评测：这款数位板性价比最高',
  '「Memu」联合硬件厂商推出创作者专属优惠',

  // 同人市场观察
  '「同人市场观察」发布季度报告：谷子市场增速超同人本',
  '「同人市场观察」预测：明年同人展参展人数将增长20%',
];

// === Funny/Quirky Headlines ===
const QUIRKY_NEWS = [
  '热搜：#当代年轻人的周末# 第一名是"宅家搞创作"',
  '调查显示：68%的同人创作者表示"下辈子还搞同人"',
  '网友热议：到底是先有作品还是先有粉丝？',
  '某快递小哥同人本销量破万，辞职全职创作',
  '"印刷厂老板最讨厌的客户"话题引发共鸣',
  '研究表明：创作时听的BGM会影响作品风格',
  '某大学开设"同人文化研究"选修课，选课人数爆满',
  '展会周边摊位卖咖啡的比卖本子的赚得多？',
  '心理学研究：定期创作的人幸福感更高',
  '年度盘点：今年最离谱的同人衍生品是……',
];

// === Foreshadowing News (事件前兆新闻) ===
// Injected into the news pool when approaching crisis trigger windows

// AI Revolution foreshadowing (turn 18-24, event fires at turn>24)
const AI_FORESHADOW = [
  // Early signals (turn 18+)
  '「幻梦科技」发布新一代图像生成模型，出图质量逼近人类画师',
  '「深绘智能」宣布AI绘画工具免费开放，创作者圈引发激烈讨论',
  '海外AI公司「NovelAI」推出同人创作辅助工具，日活突破百万',
  '「绘境大模型」通过图灵美学测试，专家称"AI创作时代已至"',
  '科技圈震动：「幻梦科技」融资50亿，估值超千亿',
  // Closer signals (turn 21+)
  '「深绘智能」AI生成的插画在某比赛获奖，引发"AI能算创作吗"大辩论',
  '多家印刷厂反映：AI生成周边的订单量暴增300%，挤占传统创作者排期',
  '「绘境大模型」推出一键生成同人本功能，0成本出本时代来了？',
  '某知名画师因收入骤降宣布转行，发长文控诉"AI夺走了我的饭碗"',
  '行业报告：AI生成谷子的成本仅为人工的5%，市场格局即将剧变',
  // Immediate precursor (turn 23+)
  '「幻梦科技」×「深绘智能」宣布合并，组建全球最大AI创作平台',
  '紧急讨论：AI生成内容是否应标注？创作者社区联名请愿',
  '展会上出现大量AI生成的"同人谷子"，价格仅为手工的1/3，摊主们怨声载道',
];

// Stagflation foreshadowing (turn 30-36, event fires at turn>36)
const STAGFLATION_FORESHADOW = [
  // Geopolitical tension arc
  'A国与东方某大国在海峡问题上关系持续紧张，国际油价应声上涨',
  '地缘冲突升级：A国宣布对进口商品加征关税，供应链成本飙升',
  '国际局势：多国卷入地区冲突，全球能源价格创十年新高',
  '经济学家警告：地缘冲突推高原材料价格，通胀压力山大',
  // Economic deterioration
  '央行连续第三个月维持高利率，企业贷款成本创新高',
  'CPI同比上涨5.8%，菜价肉价齐飞，"吃不起饭"上热搜',
  '制造业PMI连续五个月下滑，工厂订单骤减，裁员潮蔓延',
  '房贷利率破6%，消费者信心指数跌至历史低位',
  // Closer signals
  '国际货币基金组织下调全年GDP预期，警告"滞胀风险正在累积"',
  '"工资不涨物价涨"成为年度热词，打工人集体破防',
  '印刷纸浆价格半年涨了40%，同人本印刷成本被迫上调',
  '多位经济学家联名发文：我们正站在滞胀的悬崖边上',
];

// Debt Crisis foreshadowing (turn 42-48, event fires at turn>48)
const DEBT_CRISIS_FORESHADOW = [
  // Consumer debt accumulation
  '消费贷数据：90后人均负债12.7万，"花呗自由"成了新讽刺',
  '信用卡逾期率创历史新高，银行开始大规模催收',
  '大学生贷款总额突破万亿，"毕业即负债"成常态',
  '某消费分期平台暴雷，数十万用户资金被冻结',
  // Secondhand market signals
  '"断舍离"话题热度暴涨，二手交易平台月活翻倍',
  '咸鱼上大量低价抛售收藏品，卖家留言："还不起花呗了"',
  '二手谷子价格集体腰斩，圈内人士直呼"跳楼甩卖"',
  '某知名收藏家清空全部藏品："再不卖就要吃土了"',
  // Systemic crisis signals
  '央行紧急注入流动性，市场恐慌情绪蔓延',
  '社会消费品零售总额连续三个月负增长，消费降级加速',
  '经济观察：消费者资产负债表衰退，这比普通衰退可怕得多',
  '某经济学家警告："债务泡沫即将破裂，每个人都该做好准备"',
];

// Simple seeded PRNG (mulberry32)
function seededRng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate news items for this turn (deterministic per month)
 * @param {object} state - game state
 * @returns {Array<{text: string, category: string}>}
 */
export function generateWorldNews(state) {
  const news = [];
  const rng = seededRng(state.turn * 7919 + 1337);

  // Pick 2-4 random news items
  const count = 2 + Math.floor(rng() * 3);

  // Weight categories based on game state
  const pool = [];

  // Macro news — more likely during recession
  const macroWeight = state.recessionTurnsLeft > 0 ? 3 : 1;
  for (let i = 0; i < macroWeight; i++) pool.push(...MACRO_NEWS.map(t => ({ text: t, category: 'macro' })));

  // Life news — always present
  pool.push(...LIFE_NEWS.map(t => ({ text: t, category: 'life' })));

  // App-linked news — always present
  pool.push(...APP_NEWS.map(t => ({ text: t, category: 'app' })));

  // Quirky — sprinkle in
  pool.push(...QUIRKY_NEWS.map(t => ({ text: t, category: 'quirky' })));

  // === Foreshadowing injection (crisis precursors) ===
  const adv = state.advanced;
  const turn = state.turn;

  // AI Revolution: foreshadow turns 18-24 (fires at >24, only if not yet triggered)
  if (!adv?.aiRevolution && turn >= 18 && turn <= 26) {
    const intensity = turn >= 23 ? 4 : turn >= 21 ? 3 : 2;
    const aiPool = turn >= 23 ? AI_FORESHADOW.slice(10) : turn >= 21 ? AI_FORESHADOW.slice(5, 10) : AI_FORESHADOW.slice(0, 5);
    for (let i = 0; i < intensity; i++) pool.push(...aiPool.map(t => ({ text: t, category: 'life' })));
  }

  // Stagflation: foreshadow turns 30-36 (fires at >36, only if not yet triggered)
  if (!adv?.stagflationTurnsLeft && state.recessionTurnsLeft <= 0 && turn >= 30 && turn <= 38) {
    const intensity = turn >= 34 ? 4 : turn >= 32 ? 3 : 2;
    const stPool = turn >= 34 ? STAGFLATION_FORESHADOW.slice(8) : turn >= 32 ? STAGFLATION_FORESHADOW.slice(4, 8) : STAGFLATION_FORESHADOW.slice(0, 4);
    for (let i = 0; i < intensity; i++) pool.push(...stPool.map(t => ({ text: t, category: 'macro' })));
  }

  // Debt Crisis: foreshadow turns 42-48 (fires at >48, only if not yet triggered)
  if (!adv?.debtCrisisActive && turn >= 42 && turn <= 50) {
    const intensity = turn >= 46 ? 4 : turn >= 44 ? 3 : 2;
    const dcPool = turn >= 46 ? DEBT_CRISIS_FORESHADOW.slice(8) : turn >= 44 ? DEBT_CRISIS_FORESHADOW.slice(4, 8) : DEBT_CRISIS_FORESHADOW.slice(0, 4);
    for (let i = 0; i < intensity; i++) pool.push(...dcPool.map(t => ({ text: t, category: 'macro' })));
  }

  // Shuffle and pick
  const shuffled = pool.sort(() => rng() - 0.5);
  const seen = new Set();
  for (const item of shuffled) {
    if (news.length >= count) break;
    if (seen.has(item.text)) continue;
    seen.add(item.text);
    news.push(item);
  }

  return news;
}
