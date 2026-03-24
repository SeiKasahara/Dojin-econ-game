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

// === Comment pools by feed type ===
const COMMENTS = {
  npc: [
    '加油！期待新作！', '什么时候出通贩啊', '大大好高产', '封面太好看了吧', '已预定！',
    '画风好绝', '终于等到了！', '求repo！', '什么时候开预售', '啊啊啊期待',
    '这个配色绝了', '太太永远的神', '冲了冲了', '这也太好看了', '收藏了！',
    '天天蹲更新', '好想去现场买', '求通贩链接！', '画力又进步了', '这质量也太高了',
    '等了好久终于出了', '直接all in', '封面杀我', '这次的特典是什么', '通贩什么时候开',
    '上次的本子还没看完', '一出必买系列', '太太辛苦了', '期待实物！', '又要吃土了',
    '求返图！', '希望这次能抢到', '每次都秒没', '活捉太太', '印量能多点吗',
    '啊好想去展会', '远程粉丝哭泣', '线上能买吗', '质量永远在线', '太香了',
  ],
  drama: [
    '吃瓜.jpg', '有人总结一下前因后果吗', '又来了...', '圈子好乱', '不想掺和但是好好奇',
    '双方都有问题吧', '别吵了行不行', '退坑保平安', '这瓜比本子好看', '每天都有新瓜',
    '当事人能出来说两句吗', '截图都看了，离谱', '建议双方冷静一下', '圈子太小了',
    '吃完这个瓜就去画画', '好累啊天天吵', '感觉要分裂了', '两边都关注了好尴尬',
    '有没有不吵架的一天', '我就看看不说话', '这件事说来话长', '保持围观不站队',
    '好想回到只画画的日子', '别上升到真人吧', '论坛已经炸了', '热搜第一名',
    '大家冷静冷静', '原来是这么回事', '背后的故事更精彩', '这下圈外人都知道了',
  ],
  trend: [
    '这波我要跟！', '好多人在画这个', '确实最近刷屏了', '终于轮到这个tag火了',
    '我也想画但是画不出来', '这种风格好难但是好好看', '已经开坑了', '赶紧上车',
    '再不画就过气了', '这个trend真的很有感觉', '但愿不是三分钟热度', '画了一半了',
    '感觉什么都在跟这个', '确实好看', '很适合出本', '这波热度真高',
    '有人统计了最近的排行吗', '我就不跟风了', '画自己想画的就好', '卷起来了',
    '好多太太在画', '时间线全是这个', '这个tag太卷了', '但是真的好看啊',
  ],
  fan: [
    '太太我爱你！', '每本都买了', '安利给全世界', '什么时候出下一本', '永远支持',
    '你的作品治愈了我', '质量太稳了', '看了三遍了还想看', '是宝藏太太！', '求出续篇',
    '我就是从这本入坑的', '推荐给同事了，她也喜欢', '实物比图片更好看', '好想认识你',
    '悄悄表白太太', '你的画风是我最喜欢的', '每次出新作都第一时间买', '永远的神',
    '收到本子了好开心', '质量太高了', '看完哭了', '这本太好了', '太太请继续创作',
  ],
  market: [
    '市场真卷', '感觉越来越难了', '新人好多', '老人都去哪了', '钱包撑不住了',
    '二手价格好离谱', '为什么谷子这么贵了', '以前没这么卷啊', '同人不好做了',
    '希望市场能稳定一点', '这个月花太多了', '需要节制消费了', '好想摆摊啊',
    '成本越来越高了', '印刷费涨价了', '邮费也涨了', '做同人真的不赚钱',
    '但是快乐是真的', '累并快乐着', '下个月继续冲', '存钱等展会',
  ],
  flavor: [
    '哈哈哈哈共鸣了', '说的就是我', '笑死', '太真实了', '每天的日常',
    '能不能别emo了', '打工人的眼泪', '什么时候是个头', '但是还是很开心', '同感+1',
    '这不就是我吗', '谁懂啊', '抱抱', '一起加油', '人间真实',
    '哭了', '属于是了', '你说得对但是我选择摸鱼', '就是说', '太有道理了',
    '每次看到这种帖子都想转发', '就是这种感觉', '有人懂我了', '今日份共鸣',
    '写出了我想说的话', '评论区比正文好看', '收藏了', '下次还来', '日常打卡',
  ],
};

function pickComments(type, count) {
  const pool = COMMENTS[type] || COMMENTS.flavor;
  const result = [];
  const used = new Set();
  const n = Math.min(count, pool.length);
  while (result.length < n) {
    const idx = Math.floor(r() * pool.length);
    if (!used.has(idx)) { used.add(idx); result.push(pool[idx]); }
  }
  return result;
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
    // Generate visible comment texts (1-3 per post)
    const commentCount = 1 + Math.floor(r() * 3);
    item.commentTexts = pickComments(item.type, commentCount);
    item.comments = item.commentTexts.length + Math.floor(r() * 8);
  }

  // Shuffle and cap
  return feed.sort(() => r() - 0.5).slice(0, 8);
}
