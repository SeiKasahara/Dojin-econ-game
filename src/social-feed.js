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
const GENERIC_REACTIONS = [
  '说到心坎里了', '这条我要转给朋友看', '每次看到这种帖子都忍不住点进来',
  '笑着笑着就哭了', '怎么说的跟我一模一样', '评论区比正文精彩',
  '已截图保存', '这不就是我的日常吗', '看完沉默了好久',
];

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
  if (text.includes('预告') || text.includes('新刊')) pool.push(
    '啊啊啊终于等到预告了，钱包已经准备好了', '这封面也太绝了吧我先死为敬', '求求了什么时候开通贩，我人不在本地',
    '上一本到现在还在反复看，新的肯定也很棒', '已经把这个月的预算全部留给你了', '封面构图好有氛围感，期待内页');
  if (text.includes('展会') || text.includes('备货')) pool.push(
    '几号摊位啊，我要第一个冲过去', '能不能帮我带一份，路费实在凑不出来', '备货辛苦了！展会见！',
    '去年你们摊位排了好长的队，今年要早点去', '帮朋友问一下可以代购吗');
  if (text.includes('通贩') || text.includes('销量')) pool.push(
    '链接呢链接呢，刷了半天没找到', '手慢了一步就没了，能不能补货啊', '刚下单了，坐等快递中',
    '上次通贩十分钟就抢完了，这次设了闹钟', '终于买到了！开心到原地转圈');
  if (text.includes('直播') || text.includes('过程')) pool.push(
    '看了两小时根本停不下来，手太稳了', '原来大佬画画的过程是这样的，学到了', '建议出教程，愿意付费的那种',
    '看别人画画治愈了我加班的疲惫');
  if (text.includes('合作') || text.includes('出本')) pool.push(
    '天哪这个组合我做梦都不敢想，双厨狂喜', '强强联合出来的东西质量肯定炸裂', '两位太太的画风放一起也太搭了吧');
  if (text.includes('战利品') || text.includes('一袋子')) pool.push(
    '好羡慕能去现场的人...远程粉丝只能眼馋', '这一袋子少说花了四位数吧', '求求了出一个战利品清单吧，想抄作业');
  if (text.includes('涨价') || text.includes('印刷')) pool.push(
    '印刷成本涨了但是定价又不好意思涨，难搞', '小社团真的快撑不住了，纸价太离谱', '有没有人拼团印的，分摊一下成本',
    '换了三家印刷厂都在涨价，心累');
  if (text.includes('二手') || text.includes('炒')) pool.push(
    '黄牛真的把同人圈搞得乌烟瘴气', '溢价三倍你认真的吗，当初怎么不多印点', '求原价出，不想助长炒作风气');
  if (text.includes('停更') || text.includes('充电')) pool.push(
    '好好休息最重要，我们会一直等的', '太太身体要紧，作品什么时候都能画', '充完电回来继续发光发热',
    '正好可以把之前的作品再翻出来看一遍');
  if (text.includes('终于画完') || text.includes('画完了')) pool.push(
    '辛苦了！是不是又熬夜了，注意身体啊', '完成一个项目的成就感是真的无可替代', '速度好快，我三个月了还在磨第一页',
    '看到太太发这条我就知道又要出好东西了');
  if (text.includes('返图')) pool.push(
    '实物颜色好正，印刷质量在线', '比预想的还要好看，拿到实物的感觉就是不一样', '这个纸张手感肯定很好');
  if (text.includes('封面') || text.includes('意见')) pool.push(
    '个人觉得A方案更有冲击力', '两个都好看选不了，要不然出两个版本', '相信太太的审美，选哪个都不会差');
  if (text.includes('销售数据')) pool.push(
    '太厉害了，能分享一下运营经验吗', '看完只有一个感受：努力是有回报的', '数据看得我好酸，但也替你开心');
  if (text.includes('接稿') || text.includes('画不动')) pool.push(
    '别太拼了，手是吃饭的家伙', '约稿排到什么时候了？想约但怕太久', '接稿虽然赚钱但真的很消耗创作热情');
  if (text.includes('新坑')) pool.push(
    '什么坑！说出来让我看看值不值得跳', '又开新坑了，太太你是永动机吗', '已入坑，在线等安利');
  if (text.includes('草稿')) pool.push(
    '草稿阶段就这么好看了，成品还得了', '这线条也太干净了，羡慕手稳的人', '光看草稿就能感受到完成品的质量');
  if (text.includes('排期') || text.includes('出货')) pool.push(
    '终于确定排期了，等了好久', '希望印刷厂这次靠谱一点，别再延期了', '坐等出货，已经迫不及待了');
  if (text.includes('手绘板坏') || text.includes('鼠标')) pool.push(
    '用鼠标画画这种事我想想就头皮发麻', '趁着打折赶紧换一块吧，工具很重要', '之前板子坏了我直接用手机画了一个月...');
  if (text.includes('感谢信')) pool.push(
    '有读者写信是真的很感动，创作的意义就在这里', '好暖啊，这种反馈能顶三个月的热情', '看完也跟着感动了');
  if (text.includes('催更')) pool.push(
    '催更大军报到！但太太别有压力慢慢来', '不催不催，但如果更了我会第一时间冲', '太太什么时候更，我的F5键快按坏了');
  if (text.includes('画力对比') || text.includes('进步')) pool.push(
    '坚持画下来的人进步是真的肉眼可见', '天赋固然重要但你的努力更让人佩服', '看完进步对比图我也去翻了翻自己的旧图...');

  // Drama posts
  if (text.includes('挂') || text.includes('吵架')) pool.push(
    '好累啊能不能消停一天，我只想安静画画', '这瓜比本子还好看但吃完好空虚', '两边都关注了好尴尬，选择性失明中',
    '建议大家冷静下来，不要上头', '每次出事我都想退网，但又舍不得这个圈子');
  if (text.includes('描图')) pool.push(
    '如果实锤了那确实过分，但也得等证据', '对比图看了，有些线确实重合度太高了', '希望不是真的，那位太太的作品我很喜欢');
  if (text.includes('收费') || text.includes('定价')) pool.push(
    '创作是有成本的这点不接受反驳', '觉得贵可以不买，但别去人家评论区阴阳', '不同品质的东西定价当然不同，市场会说话');
  if (text.includes('拖稿') || text.includes('跑路')) pool.push(
    '以后约稿一定先看口碑再下单', '有完整的聊天记录的话建议维权', '太离谱了吧，同人圈的信任就是这样被消耗的');
  if (text.includes('CP') || text.includes('解释权')) pool.push(
    '各磕各的不好吗，为什么一定要争个高下', 'CP是各人的解读自由，不需要获得批准', '拉踩其他CP真的让圈子氛围变很差');
  if (text.includes('盗印')) pool.push(
    '辛辛苦苦画的东西被盗印真的太气了', '已举报，大家也帮忙举报一下吧', '买正版是对创作者最基本的尊重');

  // Trend posts
  if (text.includes('话题') || text.includes('热度')) pool.push(
    '这波热度是真的高，已经忍不住开始画了', '跟了跟了，但愿不是三分钟热度', '这个tag上热搜了吗，感觉到处都是');
  if (text.includes('讨论度') || text.includes('安利')) pool.push(
    '被安利了三次终于去看了，真香', '我也要加入安利大军', '确实好看，不愧是最近最火的tag');
  if (text.includes('风向') || text.includes('流行')) pool.push(
    '嗅到商机了，赶紧出本蹭热度', '观望中，想看看这波能持续多久', '不管流行什么，画自己喜欢的最重要');

  // Fan posts
  if (text.includes('二创') || text.includes('同人图')) pool.push(
    '大佬画大佬，这就是圈子里最浪漫的事', '看到二创的那一刻真的太感动了', '双向奔赴的感觉也太好了吧');
  if (text.includes('安利') || text.includes('推荐')) pool.push(
    '去看了真的很好！谢谢安利', '已入坑已购买，质量没让我失望', '朋友推荐的果然靠谱');
  if (text.includes('收藏')) pool.push(
    '默默关注了好久终于等到被发现', '有眼光的人迟早会被看到', '这位太太的作品真的被严重低估了');

  // Market posts
  if (text.includes('二手') && text.includes('难卖')) pool.push(
    '二手冲击太大了，新品根本竞争不过', '有什么办法能让买家优先选择新品呢', '供大于求的时候只能卷质量了');
  if (text.includes('热闹') || text.includes('新人')) pool.push(
    '新人多了竞争确实更激烈了但整体是好事', '欢迎新朋友，圈子需要新鲜血液', '看到新人入圈就觉得这个坑还有救');
  if (text.includes('安静') || text.includes('萎缩')) pool.push(
    '时间线冷冷清清的，大家都去忙现实了吗', '坚持到最后的人才是真的热爱', '越是冷的时候越要发声，不然真的会散');
  if (text.includes('经济不好') || text.includes('预算')) pool.push(
    '确实得省着点花了，但喜欢的还是忍不住买', '理性消费理性消费，但这本真的想要', '经济不好对小社团打击最大');

  // General chatter
  if (text.includes('画板') || text.includes('不知道画')) pool.push(
    '打开画板就是最难的一步，打开了就好了', '不知道画什么的时候就画喜欢的角色', '摸鱼也是创作过程的一部分（心理安慰）');
  if (text.includes('快递') || text.includes('谷子')) pool.push(
    '拆谷子的那种快乐是别的东西替代不了的', '什么谷什么谷，发出来让我看看', '又要控制不住购物欲了');
  if (text.includes('赶稿') || text.includes('头发')) pool.push(
    '同在赶稿，互相打气吧', '头发的事先不要想了，交稿要紧', '赶稿人的头发和DDL成反比');
  if (text.includes('排版') || text.includes('软件')) pool.push(
    '我用Clip排的感觉还不错，推荐试试', '排版这东西一开始觉得难，上手了就还好', '有没有现成的模板分享一下');
  if (text.includes('零花钱') || text.includes('扫货')) pool.push(
    '存了三个月就为了展会这一天', '理智告诉我要省钱，手已经开始掏钱包了', '每次逛展都超预算是怎么回事');
  if (text.includes('摸鱼')) pool.push(
    '被说中了，此刻正在摸鱼刷时间线', '摸鱼人狂喜，有人和我一样不想画画', '摸完这条就去画...大概');
  if (text.includes('咖啡') || text.includes('稿子')) pool.push(
    '没有咖啡就没有创作力，这是刚需', '第三杯了，但稿子还是没画完', '肝帝请收下我的膝盖，我两杯就要心悸了');
  if (text.includes('逛展') || text.includes('脚')) pool.push(
    '穿舒服的鞋子是逛展的第一要义', '走了一天腿已经不是自己的了但很快乐', '明年一定要记得带折叠凳');
  if (text.includes('邮费')) pool.push(
    '邮费比谷子还贵是怎么回事', '通贩的利润大半都被邮费吃了', '求求快递公司给同人创作者打个折吧');
  if (text.includes('预售')) pool.push(
    '开预售是个好主意，至少能提前知道大概印多少', '先预售再印刷是最稳的做法', '已蹲预售链接，出了第一时间下单');
  if (text.includes('浪漫') || text.includes('感动')) pool.push(
    '看到最后一句直接破防了', '说同人创作是浪漫的事我完全同意', '是这种帖子让我觉得留在这个圈子是值得的');

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
