/**
 * Social Feed Generator — 同人社团物语
 * Generates SNS-style feed items for the Nyaner app
 * Decoupled from market.js for maintainability
 */

import { ic } from './icons.js';

const r = () => Math.random();

// === Feed item types: npc, trend, fan, market, flavor, drama ===

function npcDailyPosts(market) {
  const names = market.npcNames || [];
  const pick = () => names.length > 0 ? names[Math.floor(r() * names.length)] : '某创作者';
  const trend = market.currentTrend;

  const pool = [
    // 创作日常
    () => `${pick()} 发布了新刊预告！${trend ? `看起来是${trend.tag}风格` : ''}`,
    () => `${pick()} 宣布参加下个月的展会，正在备货中`,
    () => `${pick()} 的新谷子开始通贩了，销量不错的样子`,
    () => `${pick()} 发了创作过程的直播回放，好多人围观`,
    () => `${pick()} 和 ${pick()} 宣布合作出本！`,
    () => `${pick()} 晒出了参展战利品，满满一袋子`,
    () => `${pick()} 抱怨印刷厂又涨价了...`,
    () => `${pick()} 的旧作在二手市场上被炒了高价`,
    () => `${pick()} 宣布暂时停更，说需要充电`,
    () => `${pick()} 深夜发了一条"终于画完了"`,
    () => `${pick()} 发了返图，质量看起来很不错`,
    () => `${pick()} 在征集封面意见，评论区吵起来了`,
    () => `${pick()} 晒出了这个月的销售数据，引发围观`,
    () => `${pick()} 说最近接稿太多快画不动了`,
    () => `${pick()} 开了一个新坑，粉丝们表示期待`,
    // 新增：更多日常
    () => `${pick()} 发了新作的草稿预览，线条好绝`,
    () => `${pick()} 刚和印刷厂确认了排期，下月出货`,
    () => `${pick()} 在做读者问卷，想知道大家喜欢什么类型`,
    () => `${pick()} 说手绘板坏了，正在用鼠标硬撑...`,
    () => `${pick()} 今天画了12小时，发了一张工位照`,
    () => `${pick()} 收到了读者寄来的手写感谢信，感动发博`,
    () => `${pick()} 试着用新软件排版，觉得比之前好用多了`,
    () => `${pick()} 在纠结是出A5还是B5，评论区各执一词`,
    () => `${pick()} 发了展位布置的效果图，看起来很用心`,
    () => `${pick()} 说被催更催到不敢上线了`,
    () => `${pick()} 分享了一个免费字体资源，好多人转发`,
    () => `${pick()} 在研究怎么开通海外通贩`,
    () => `${pick()} 发了最近的画力对比图，进步好大`,
    () => `${pick()} 的限定特典设计曝光了，好想要`,
    () => `${pick()} 做了一个创作收支表格模板分享给大家`,
  ];
  return pool;
}

function dramaPosts(market, playerState) {
  const names = market.npcNames || [];
  const pick = () => names.length > 0 ? names[Math.floor(r() * names.length)] : '某创作者';

  const pool = [
    () => `${pick()} 和 ${pick()} 闹掰了，双方粉丝在时间线上互撕`,
    () => `有人爆料某创作者描图，圈子里炸了锅`,
    () => `关于"同人该不该收费"的老话题又吵起来了...`,
    () => `${pick()} 被质疑拖稿跑路，出来发了长文澄清`,
    () => `有人在拉黑名单，说某些创作者态度恶劣`,
    () => `圈内出现了挂人bot，好多人人心惶惶`,
    () => `为了CP解释权，两派粉丝吵了整整一晚上`,
    // 新增
    () => `${pick()} 被发现作品和某商业作品高度相似，争议不断`,
    () => `有人质疑某展会主办方跑路了，群里一片混乱`,
    () => `谷子定价太高被挂了，评论区几百条在讨论"合理价格"`,
    () => `${pick()} 公开了和前搭档的聊天记录，吃瓜群众疯狂截图`,
    () => `二手平台上出现了盗印本，原作者很崩溃`,
    () => `有人在展会上偷拍别人的摊位设计，被当场抓到`,
    () => `某个约稿群突然解散了，好多人的稿费还没结...`,
  ];
  return pool;
}

function trendPosts(market) {
  const names = market.npcNames || [];
  const pick = () => names.length > 0 ? names[Math.floor(r() * names.length)] : '某创作者';
  const TREND_TAGS = ['甜文', '虐心', '热血', '日常', '奇幻'];

  if (market.currentTrend) {
    const tag = market.currentTrend.tag;
    if (market.currentTrend.turnsLeft === 1) {
      return [{ text: `「${tag}」话题热度开始回落，下一波流行会是什么？`, type: 'trend' }];
    }
    const pool = [
      `最近「${tag}」类作品讨论度很高！好多人在安利`,
      `刷了一晚上全是「${tag}」相关，这波真的火了`,
      `${pick()} 也开始画「${tag}」了，跟风还是真心？`,
      `「${tag}」类新作井喷，质量参差不齐，但热度是真的`,
      `有人统计了最近的通贩排行榜，「${tag}」类占了大半`,
    ];
    return [{ text: pool[Math.floor(r() * pool.length)], type: 'trend' }];
  }
  const hint = TREND_TAGS[Math.floor(r() * TREND_TAGS.length)];
  return [{ text: `圈内风向好像在变...「${hint}」类作品开始被越来越多人提起`, type: 'trend' }];
}

function fanPosts(playerState) {
  const items = [];
  if (playerState.totalHVP === 0 && playerState.totalLVP === 0) return items;

  const pool = [];
  if (playerState.reputation > 5) pool.push(
    '你的新作被好几个大号转发了，评论区全是夸',
    '"必入的一位太太" ——看到有人这么推荐你',
    '有人做了你作品的安利长图，传播得很广',
    '有粉丝说为了买你的本子专门去了外地的展会',
  );
  if (playerState.reputation > 3) pool.push(
    '有人画了你作品的二创同人图！在小圈子里传开了',
    '一位读者在时间线上安利了你的作品，转发量还不错',
    '"这位太太的本子质量很稳" ——看到有人这么评价你',
    '你的作品被某个安利bot转发了！',
    '有新粉在问你的旧作还有没有库存',
  );
  if (playerState.reputation > 1) pool.push(
    '有人在问你下一本什么时候出',
    '看到有人在帖子里@你，说很喜欢你的作品',
    '有读者说你的作品治愈了她的加班疲惫',
  );
  if (playerState.reputation <= 1 && playerState.totalHVP > 0) pool.push(
    '有人默默收藏了你的作品页面',
    '你的作品被一个小号转发了...虽然只有个位数互动',
    '有人在某个推荐帖里提到了你的名字',
  );
  if (pool.length > 0 && r() < 0.4) {
    items.push({ text: pool[Math.floor(r() * pool.length)], type: 'fan' });
  }
  return items;
}

function marketObservationPosts(market, official, playerState) {
  const pool = [];
  if (official?.secondHandPressure?.lvp > 0.3) pool.push('二手谷子泛滥了，新品越来越难卖...');
  else if (official?.secondHandPressure?.lvp > 0.15) pool.push('好多人在出二手谷子，是要换坑了吗');
  if (official?.secondHandPressure?.hvp > 0.1) pool.push('二手本子市场挺活跃的，有人在收绝版');
  if (market.communitySize > 18000) pool.push('圈子越来越热闹了，新人好多！');
  else if (market.communitySize < 3000) pool.push('时间线好安静...大家是不是都去忙别的了');
  if (market.nHVP <= 2) pool.push('出本的人越来越少了，市场上几乎没有新的同人本');
  if (market.nLVP > 70) pool.push('谷子摊太多了，竞争好激烈');
  if (playerState.recessionTurnsLeft > 0) pool.push('经济不好，大家都在缩减预算，愁...');
  // 新增
  if (market.nHVP > 10) pool.push('最近新本扎堆出，钱包要撑不住了');
  if (market.communitySize > 10000 && market.communitySize < 15000) pool.push('圈子规模刚刚好，不大不小，氛围很舒服');
  if (market.diversityHealth < 0.3) pool.push('市场上品类太单一了，消费者都审美疲劳了');
  if (market.marketConfidence > 0.9) pool.push('大家消费欲望挺强的，新品基本都卖得动');
  return pool.length > 0 ? [{ text: pool[Math.floor(r() * pool.length)], type: 'market' }] : [];
}

function ipFlavorPosts(official) {
  if (!official) return [];
  const pool = [];
  if (official.ipHeat > 80) pool.push(
    '官方刚出的内容太棒了，满屏都在讨论！',
    '官方这波是懂粉丝的，好多人入坑了',
    '感觉最近圈子因为官方的新内容又活过来了',
  );
  else if (official.ipHeat > 50) pool.push(
    '官方还在更新，虽然不温不火但至少没烂尾',
    '官方最近的内容中规中矩，同人还是得靠自己',
  );
  else if (official.ipHeat > 20) pool.push(
    '官方好久没动静了，有人说是不是要完结了...',
    '只靠同人在续命的感觉，心疼这个IP',
    '官方再不更新，这个坑真的要凉了',
  );
  else pool.push(
    '这个IP基本被官方放弃了...只有最死忠的粉丝还在',
    '圈子快要散了，大家都在找新坑',
    '有人写了一篇"为什么我还留在这个坑"的长文，看哭了',
  );
  if (official.dormancyTurns > 18) pool.push(`官方已经${official.dormancyTurns}个月没更新了，都快忘了还有官方这回事`);
  if (official.shadowPrice > 0.1) pool.push('听说官方在抓同人，好多人吓得删了作品...');
  if (official.shadowPrice < -0.1) pool.push('官方居然发了素材包！这是鼓励同人创作吗？太感动了');
  return pool.length > 0 && r() < 0.45 ? [{ text: pool[Math.floor(r() * pool.length)], type: 'flavor' }] : [];
}

function generalChatter() {
  const pool = [
    '又到周末了，打开画板却不知道画什么...',
    '刚收到快递，拆谷子的快乐谁懂啊',
    '展会快到了，有人一起拼车吗？',
    '今天居然在书店看到了同人本，时代变了',
    '修罗场赶稿中，头发掉了好多根',
    '有人推荐好用的排版软件吗？',
    '存了三个月的零花钱，终于可以去展会扫货了',
    '发现一个宝藏太太，作品质量好高但粉丝好少',
    '刚入坑的萌新问：做同人是不是很花钱？回复：是的',
    '每次看到别人晒图就想画画，但打开板子就想摸鱼',
    // 新增
    '半夜两点还在改稿，室友已经睡了三个小时了',
    '今天试了新的上色方法，感觉打开了新世界的大门',
    '咖啡喝完了但稿子还没画完，人生好难',
    '被问"你画的这些能赚钱吗"的时候真的不知道怎么回答',
    '把自己的作品翻出来看，感觉比记忆中画得好？',
    '逛展逛到脚快断了但是很快乐',
    '邮费又涨了...通贩的利润全被吃了',
    '在犹豫要不要开预售，怕翻车但又想提前收资金',
    '看到有人说"同人创作是这个时代最浪漫的事"，有点感动',
    '整理了一下这几年做的所有作品，居然有这么多了',
    '有人教我怎么算印刷成本，终于搞明白了',
    '投稿被拒了，虽然知道是正常的但还是有点沮丧',
    '今天画了一整天但全部推翻重来了，明天继续',
    '展会摊位费又涨了，小社团越来越难了',
    '有人在做同人圈的纪录片，征集受访者',
  ];
  return r() < 0.35 ? [{ text: pool[Math.floor(r() * pool.length)], type: 'flavor' }] : [];
}

// === Context-aware comment generator ===
// Each post carries its own comment pool for relevance
const GENERIC_REACTIONS = ['哈哈哈', '真的吗', '+1', '同感', '绝了', '收藏了', '转发了', '太真实了', '笑死'];

function pickFrom(pool, count) {
  const result = [];
  const used = new Set();
  const n = Math.min(count, pool.length);
  while (result.length < n) {
    const idx = Math.floor(r() * pool.length);
    if (!used.has(idx)) { used.add(idx); result.push(pool[idx]); }
  }
  return result;
}

function generateComments(text, type) {
  const count = 1 + Math.floor(r() * 3);
  // Build a context-specific pool based on keywords in the post text
  const pool = [...GENERIC_REACTIONS];

  // NPC creator posts
  if (text.includes('预告') || text.includes('新刊')) pool.push('期待！', '什么时候出', '已预定！', '封面好好看', '求通贩', '冲了冲了');
  if (text.includes('展会') || text.includes('备货')) pool.push('哪个展', '几号摊', '去现场蹲', '帮我带一份', '展会见！');
  if (text.includes('通贩') || text.includes('销量')) pool.push('链接在哪', '秒了', '手慢无', '已下单', '求补货');
  if (text.includes('直播') || text.includes('过程')) pool.push('画得好快', '学到了', '手太稳了', '求教程', '看了两小时');
  if (text.includes('合作') || text.includes('出本')) pool.push('强强联合！', '期待合作本', '这个组合绝了', '双厨狂喜');
  if (text.includes('战利品') || text.includes('一袋子')) pool.push('羡慕', '花了多少', '好多好东西', '分享清单吧');
  if (text.includes('涨价') || text.includes('印刷')) pool.push('真的涨了好多', '成本太高了', '同感', '小社团撑不住了', '换家试试');
  if (text.includes('二手') || text.includes('炒')) pool.push('黄牛走开', '溢价太离谱', '当初怎么不多印点', '求原价出');
  if (text.includes('停更') || text.includes('充电')) pool.push('好好休息', '不急慢慢来', '身体重要', '等你回来');
  if (text.includes('终于画完') || text.includes('画完了')) pool.push('辛苦了！', '求看！', '速度好快', '熬夜了吧', '注意身体');
  if (text.includes('返图')) pool.push('质量好好', '印刷不错', '颜色正吗', '好想要');
  if (text.includes('封面') || text.includes('意见')) pool.push('A方案好看', 'B好！', '都好看选不了', '听你的', '个人偏好A');
  if (text.includes('销售数据')) pool.push('太厉害了', '求分享经验', '羡慕', '销量好好', '什么类型的');
  if (text.includes('接稿') || text.includes('画不动')) pool.push('注意休息', '别太拼了', '约稿排到什么时候了', '身体第一');
  if (text.includes('新坑')) pool.push('什么坑！', '入了入了', '求安利', '终于等到了');
  if (text.includes('草稿')) pool.push('线条好绝', '已经很好看了', '成品肯定更棒', '求上色版');
  if (text.includes('排期') || text.includes('出货')) pool.push('终于定了', '等不及了', '印刷厂效率怎样', '什么时候发');
  if (text.includes('手绘板坏') || text.includes('鼠标')) pool.push('心疼', '赶紧买新的', '鼠标画画太猛了', '先用手机凑合吧');
  if (text.includes('感谢信')) pool.push('好暖', '有粉丝太幸福了', '感动', '继续加油');
  if (text.includes('催更')) pool.push('催更大军+1', '不急不急', '慢慢来', '太太别有压力');
  if (text.includes('画力对比') || text.includes('进步')) pool.push('进步好大！', '天赋型选手', '坚持就是胜利', '太太好厉害');

  // Drama posts
  if (text.includes('挂') || text.includes('吵架')) pool.push('吃瓜.jpg', '前因后果呢', '又吵了', '心累', '不想掺和');
  if (text.includes('描图')) pool.push('有实锤吗', '对比图呢', '等官方回应', '如果是真的太过分了');
  if (text.includes('收费') || text.includes('定价')) pool.push('每个人情况不同', '创作有成本的', '看质量', '自由定价吧');
  if (text.includes('拖稿') || text.includes('跑路')) pool.push('还好我没约', '建议维权', '有截图吗', '以后先看口碑');
  if (text.includes('CP') || text.includes('解释权')) pool.push('拉踩没意思', '各玩各的', 'CP是自由的', '别搞饭圈那套');
  if (text.includes('盗印')) pool.push('太过分了', '举报了', '支持正版', '原作者加油');

  // Trend posts
  if (text.includes('话题') || text.includes('热度')) pool.push('跟了跟了', '这波确实火', '已经在画了', '但愿能持续');
  if (text.includes('讨论度') || text.includes('安利')) pool.push('确实到处都是', '我也被安利了', '真的好看', '不愧是热门');
  if (text.includes('风向') || text.includes('流行')) pool.push('嗅到商机了', '该入坑了', '观望中', '感觉要火');

  // Fan posts
  if (text.includes('二创') || text.includes('同人图')) pool.push('太可爱了', '大佬画大佬', '双向奔赴');
  if (text.includes('安利') || text.includes('推荐')) pool.push('确实好看', '已入坑', '谢谢安利', '去看了真的好');
  if (text.includes('收藏')) pool.push('默默关注', '有眼光', '宝藏要被发现了');

  // Market posts
  if (text.includes('二手') && text.includes('难卖')) pool.push('新品更有价值', '供大于求了', '换个思路试试');
  if (text.includes('热闹') || text.includes('新人')) pool.push('圈子在壮大', '欢迎新朋友', '竞争也更激烈了');
  if (text.includes('安静') || text.includes('萎缩')) pool.push('冷了', '大家都去哪了', '坚持就是胜利');
  if (text.includes('经济不好') || text.includes('预算')) pool.push('确实要省省', '理性消费', '等打折再买');

  // General chatter
  if (text.includes('画板') || text.includes('不知道画')) pool.push('打开就是进步', '先画个圆', '摸鱼也是创作的一部分');
  if (text.includes('快递') || text.includes('谷子')) pool.push('快乐！', '什么谷', '求开箱', '羡慕');
  if (text.includes('赶稿') || text.includes('头发')) pool.push('同在赶稿', '头发还好吗', '保重', '一起加油');
  if (text.includes('排版') || text.includes('软件')) pool.push('用的什么软件', '推荐Clip', '试试Affinity', '求教程链接');
  if (text.includes('零花钱') || text.includes('扫货')) pool.push('存了多少', '理性消费', '钱包哭泣', '冲就完了');
  if (text.includes('摸鱼')) pool.push('被说中了', '摸鱼人集合', '摸完就画', '明天再说');
  if (text.includes('咖啡') || text.includes('稿子')) pool.push('再来一杯', '没有咖啡不行', '肝帝', '注意身体');
  if (text.includes('逛展') || text.includes('脚')) pool.push('穿舒服的鞋！', '坐下休息会', '值得', '腿已废');
  if (text.includes('邮费')) pool.push('邮费刺客', '包邮不香吗', '成本都在邮费上了');
  if (text.includes('预售')) pool.push('先预售比较稳', '设个目标量', '支持', '已蹲');
  if (text.includes('浪漫') || text.includes('感动')) pool.push('破防了', '说得太好了', '是这样的', '热泪盈眶');

  return pickFrom(pool, count);
}

// === Main export ===
export function generateSocialFeed(market, official, playerState) {
  const feed = [];
  const names = market.npcNames || [];
  const pick = () => names.length > 0 ? names[Math.floor(r() * names.length)] : '某创作者';

  // 1. NPC daily (1-2)
  const npcPool = npcDailyPosts(market);
  if (r() < 0.75 && names.length > 0) feed.push({ text: npcPool[Math.floor(r() * npcPool.length)](), type: 'npc' });
  if (r() < 0.45 && names.length > 1) feed.push({ text: npcPool[Math.floor(r() * npcPool.length)](), type: 'npc' });

  // 2. Drama
  const lastEvt = playerState.lastEvent;
  if (lastEvt?.id === 'collapse') {
    feed.push({ text: `${ic('warning')} 圈内大瓜！${pick()}被挂了，时间线上全在吵架...好多人表示心累想退圈`, type: 'drama' });
  } else if (lastEvt?.id === 'harsh_review') {
    feed.push({ text: `有人发了一篇长文批评某位创作者的作品，评论区两极分化`, type: 'drama' });
  } else if (lastEvt?.id === 'promo_fail') {
    feed.push({ text: `某条宣传动态引发了争议，转发里骂声一片...`, type: 'drama' });
  } else if (r() < 0.12) {
    const dramaPool = dramaPosts(market, playerState);
    feed.push({ text: dramaPool[Math.floor(r() * dramaPool.length)](), type: 'drama' });
  }

  // 3. Trend
  feed.push(...trendPosts(market));

  // 4. Fan reactions
  feed.push(...fanPosts(playerState));

  // 5. Market observations
  feed.push(...marketObservationPosts(market, official, playerState));

  // 6. IP flavor
  feed.push(...ipFlavorPosts(official));

  // 7. General chatter
  feed.push(...generalChatter());

  // Assign authors and metadata
  const ANON_AUTHORS = ['路人甲', '吃瓜群众', '匿名用户', '时间线观察者', '某围观网友'];
  const authorPool = [...names, ...ANON_AUTHORS];
  const usedAuthors = new Set();
  for (const item of feed) {
    if (!item.author) {
      let a;
      do { a = authorPool[Math.floor(r() * authorPool.length)]; } while (usedAuthors.has(a) && usedAuthors.size < authorPool.length);
      usedAuthors.add(a);
      item.author = a;
    }
    if (item.type === 'drama') item.hot = true;
    // Fake engagement numbers
    item.likes = Math.floor(r() * 50) + (item.type === 'drama' ? 30 : item.type === 'trend' ? 15 : 1);
    item.retweets = Math.floor(r() * 15) + (item.hot ? 10 : 0);
    // Generate context-aware comment texts (1-3 per post)
    item.commentTexts = generateComments(item.text, item.type);
    item.comments = item.commentTexts.length + Math.floor(r() * 8);
  }

  // Shuffle and cap
  return feed.sort(() => r() - 0.5).slice(0, 8);
}
