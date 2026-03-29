/**
 * Bestie (小柚) Dialog Pool — 预设对话场景
 * 每条对话: { trigger, npc, replies: [{ text, npcResponse }] }
 * trigger: 'any' | function(state) => boolean (条件触发)
 */

// === 通用日常对话（任何状态都可能出现）===
const GENERAL = [
  {
    npc: '今天中午吃什么呀？好纠结',
    replies: [
      { text: '随便吃点算了', response: '也是…最后大概又是外卖吧哈哈' },
      { text: '我请你吃火锅！', response: '真的吗！那我要点很多肉！' },
      { text: '我在赶稿没空想这个', response: '好吧好吧，那我给你带一份回来~' },
    ],
  },
  {
    npc: '最近在追一部新番超好看！你看了吗',
    replies: [
      { text: '没时间看…', response: '赶紧抽空看！看完你肯定想出本子' },
      { text: '我也在追！', response: '对吧对吧！第三集那里我哭死了' },
      { text: '安利一下？', response: '就是那个！画风超棒，你看了绝对会想画同人' },
    ],
  },
  {
    npc: '你说做同人到底图个啥呢',
    replies: [
      { text: '图个开心呗', response: '嗯嗯，开心最重要！别把自己搞太累了' },
      { text: '图被人看到吧', response: '有人喜欢你的作品确实超有成就感的' },
      { text: '我也不知道…', response: '没事啦，不知道也没关系，做着做着就明白了' },
    ],
  },
  {
    npc: '周末有啥安排呀',
    replies: [
      { text: '赶稿…', response: '又赶稿！注意休息啊，别熬太晚' },
      { text: '想出去逛逛', response: '带我带我！好久没出门了' },
      { text: '还没想好', response: '那要不一起去逛展？听说有个小展还不错' },
    ],
  },
  {
    npc: '我刚买了一堆谷子开箱好开心！',
    replies: [
      { text: '又买！钱包君还好吗', response: '别提了…但是打开的那一刻真的值得！' },
      { text: '给我看给我看！', response: '(发了一堆照片) 好看吧好看吧！' },
      { text: '我也想买…', response: '那一起拼单呀！凑满减！' },
    ],
  },
  {
    npc: '啊啊啊今天好困，昨晚又熬夜了',
    replies: [
      { text: '我也是…', response: '我们都是夜猫子命啊…' },
      { text: '早点睡啊笨蛋', response: '你说得对但我做不到嘤嘤嘤' },
      { text: '熬夜干啥了', response: '别问了…刷手机刷到三点…' },
    ],
  },
  {
    npc: '你有没有那种突然很想创作但不知道画什么的时候',
    replies: [
      { text: '经常！', response: '对吧！手痒但脑子空，好痛苦' },
      { text: '画点摸鱼的不就好了', response: '也是…先画个头像练练手？' },
      { text: '看看别人的作品找灵感', response: '好主意！不过小心看着看着就emo了哈哈' },
    ],
  },
  {
    npc: '今天在路上看到一只超可爱的猫！',
    replies: [
      { text: '照片呢！', response: '(发了三张猫猫照片) 是不是超可爱！' },
      { text: '我也想撸猫…', response: '要不我们去猫咖？边撸猫边聊天' },
      { text: '猫猫好，猫猫治愈', response: '说的没错，看到猫咪心情就变好了~' },
    ],
  },
  {
    npc: '你觉得我适合搞同人吗',
    replies: [
      { text: '当然！试试呗', response: '好…好吧，那我先从小东西开始做！' },
      { text: '你画得比我好啊', response: '哪有！你别夸我了我会当真的' },
      { text: '一起搞！', response: '真的吗！那我们可以合作一个！' },
    ],
  },
  {
    npc: '最近有没有什么好听的歌推荐',
    replies: [
      { text: '我最近单曲循环一首', response: '发来听听！我需要新的创作BGM' },
      { text: '随便听的', response: '我也是…歌单都听腻了' },
      { text: '你先推荐一首', response: '这首！超适合画画的时候听' },
    ],
  },
  {
    npc: '今天奶茶买一送一！要不要一起',
    replies: [
      { text: '冲！', response: '走走走！我要超大杯加珍珠！' },
      { text: '减肥中…', response: '减什么肥！创作消耗脑力也算运动！' },
      { text: '帮我带一杯吧', response: '好嘞～你要老样子？' },
    ],
  },
  {
    npc: '你一般创作的时候喝什么呀',
    replies: [
      { text: '咖啡，续命必备', response: '咖啡战士！小心胃啊，要不换燕麦拿铁？' },
      { text: '白开水', response: '好朴素…你是不是把钱都拿去印本子了' },
      { text: '奶茶！', response: '奶茶创作法！是不是一口奶茶一笔灵感' },
    ],
  },
  {
    npc: '昨天做了个超奇怪的梦，梦到我的谷子成精了',
    replies: [
      { text: '哈哈哈什么鬼', response: '亚克力小人围着我跳舞…醒来笑了半天' },
      { text: '那你画出来呀', response: '诶这个主意好！搞个四格漫画？' },
      { text: '你是不是谷子买太多了', response: '被你说中了…昨天刚拆了三箱快递' },
    ],
  },
  {
    npc: '你创作的时候会和角色说话吗…就我一个人这样吗',
    replies: [
      { text: '我也会！', response: '太好了不是只有我！画着画着就跟他们聊起来了' },
      { text: '你需要出去走走', response: '可能吧…但是画完之后真的有一种他们活过来的感觉嘛' },
      { text: '这不是很正常嘛', response: '对吧对吧！创作者的浪漫！' },
    ],
  },
  {
    npc: '你会在意别人对你作品的评价吗',
    replies: [
      { text: '多少会吧', response: '我也是…明知道不该太在意但还是忍不住刷评论' },
      { text: '我只在意你的评价！', response: '哈哈哈你嘴好甜！那我以后每次都给你写长评' },
      { text: '已经学会屏蔽了', response: '好强…教教我，我一条差评能难过一整天' },
    ],
  },
  {
    npc: '刚在某宝看到有人卖盗版同人本…气死了',
    replies: [
      { text: '举报！', response: '已经举报了！但感觉没啥用…好气' },
      { text: '没办法，这行就这样', response: '虽然知道但还是不爽…创作者太难了' },
      { text: '所以展会面贩才重要', response: '确实，面贩至少盗不了你的签绘和互动！' },
    ],
  },
  {
    npc: '你有没有特别崇拜的同人创作者',
    replies: [
      { text: '有！好几个', response: '有目标就有动力！说不定以后你也是别人的目标呢' },
      { text: '我想成为那样的人', response: '你已经在路上了！我看好你！' },
      { text: '我比较咸鱼…', response: '咸鱼也有咸鱼的快乐啦，别给自己太大压力' },
    ],
  },
  {
    npc: '你存了多少张素材图了？我的参考文件夹要爆炸了',
    replies: [
      { text: '别说了，好几个G', response: '我也是！收藏从来不看系列哈哈' },
      { text: '我都分好类了', response: '你好自律…我的全堆在一个文件夹里' },
      { text: '脑子里的比收藏的多', response: '大脑就是最好的素材库！不过偶尔也该清清缓存' },
    ],
  },
  {
    npc: '有人在群里吵架了…好烦',
    replies: [
      { text: '吃瓜！', response: '我截图给你看！…不对，我们不应该围观的' },
      { text: '退群保平安', response: '我也想退但又怕错过什么消息…' },
      { text: '做自己的事不理他们', response: '你说得对！我去画画了，不看群了！' },
    ],
  },
  {
    npc: '如果有平行世界的话，你觉得另一个你在做什么',
    replies: [
      { text: '可能在上班摸鱼', response: '哈哈哈和这边也差不多嘛' },
      { text: '已经是大触了吧', response: '那这边的你也在努力变成大触的路上呀！' },
      { text: '肯定没在搞同人', response: '那她可太无聊了，搞同人多快乐啊！' },
    ],
  },
];

// === 状态相关对话 ===
const STATE_DIALOGS = [
  // 热情低
  {
    trigger: s => s.passion < 30,
    npc: '你最近看起来好累…没事吧？',
    replies: [
      { text: '有点撑不住了', response: '那就休息一下嘛，作品什么时候都能做，身体最重要' },
      { text: '还行还行', response: '骗人…你都有黑眼圈了。去休息！' },
      { text: '谢谢关心', response: '别客气啦，我是你闺蜜诶。累了就说，别硬撑' },
    ],
  },
  // 负债
  {
    trigger: s => s.money < -1000,
    npc: '最近经济还好吗…需不需要我借你点',
    replies: [
      { text: '没事，快回本了', response: '那就好…别太勉强自己啊' },
      { text: '有点紧张…', response: '实在不行先打打工嘛，缓一缓再搞创作' },
      { text: '谢谢你，我能搞定', response: '好！我相信你。加油！' },
    ],
  },
  // 有搭档
  {
    trigger: s => s.hasPartner,
    npc: '听说你找到搭档了！咋样咋样',
    replies: [
      { text: '还不错～', response: '那太好了！有搭档效率高多了吧' },
      { text: '还在磨合', response: '慢慢来，合作嘛都需要适应期' },
      { text: '有点难搞…', response: '每个搭档都有脾气啦，多沟通沟通' },
    ],
  },
  // 完成了作品
  {
    trigger: s => s.totalHVP > 0 || s.totalLVP > 0,
    npc: '你的新作品我看到了！好棒！',
    replies: [
      { text: '还行还行', response: '什么还行！超好的好吗！我已经分享给朋友了' },
      { text: '有很多不满意的地方', response: '创作者总是对自己最严格的，在我看来已经很棒了' },
      { text: '谢谢！做完好有成就感', response: '辛苦啦！下一部也加油～我等着看！' },
    ],
  },
  // 大学阶段
  {
    trigger: s => s.turn > 2 && s.turn <= 49,
    npc: '作业好多啊…创作时间都被挤没了',
    replies: [
      { text: '我也是…', response: '大学生的悲哀…挤一挤总能挤出时间的！' },
      { text: '边做作业边摸鱼', response: '你这是在作业上画画吧哈哈' },
      { text: '周末集中创作', response: '嗯嗯好方法！平时攒灵感周末爆发' },
    ],
  },
  // 工作阶段
  {
    trigger: s => s.turn > 49 && !s.unemployed && !s.fullTimeDoujin,
    npc: '下班了吗？今天公司咋样',
    replies: [
      { text: '累死了…', response: '辛苦了…到家记得休息一会再赶稿啊' },
      { text: '还行，摸了会鱼', response: '哈哈哈摸鱼高手！我也是' },
      { text: '好想辞职搞同人', response: '想清楚再决定哦，存款够不够撑一阵子？' },
    ],
  },
  // 失业
  {
    trigger: s => s.unemployed,
    npc: '找工作顺利吗？别太焦虑啊',
    replies: [
      { text: '还在找…', response: '慢慢来，这段时间也可以多搞搞创作嘛' },
      { text: '考虑全职同人了', response: '哇好勇！存款够的话我支持你！' },
      { text: '压力好大', response: '会好的！你这么有才华，一定没问题的' },
    ],
  },
  // 声誉高
  {
    trigger: s => s.reputation > 3,
    npc: '你现在在圈子里好有名啊！好多人认识你',
    replies: [
      { text: '没有啦…', response: '谦虚！我都看到好多人转发你的作品了' },
      { text: '有压力…', response: '出名也有出名的烦恼嘛…但总比没人知道好吧' },
      { text: '都是大家支持', response: '你值得的！好作品就是会被看到' },
    ],
  },
  // 展会后
  {
    trigger: s => s.eventLog?.length > 0 && s.turn - (s.eventLog[s.eventLog.length - 1]?.turn || 0) <= 2,
    npc: '展会怎么样！卖得好吗',
    replies: [
      { text: '还不错！', response: '太好了！下次我也想去帮你看摊' },
      { text: '一般般…', response: '别灰心！经验是慢慢积累的嘛' },
      { text: '累但开心', response: '展会就是这样哈哈，累并快乐着' },
    ],
  },
  // 全职同人
  {
    trigger: s => s.fullTimeDoujin,
    npc: '全职搞同人感觉怎么样！自由吗',
    replies: [
      { text: '超自由！', response: '好羡慕…虽然我做不到，但替你开心！' },
      { text: '自由但焦虑', response: '没有固定收入确实会慌…存款要守住啊' },
      { text: '时间全是自己的感觉好爽', response: '就是就是！想几点画就几点画！不过别太放纵哈哈' },
    ],
  },
  // 正在创作HVP中
  {
    trigger: s => s.hvpProject != null,
    npc: '新本子创作进度怎么样啦？',
    replies: [
      { text: '还在画…好慢', response: '慢工出细活！你又不是赶DDL' },
      { text: '快完成了！', response: '期待期待！第一个读者算我的！' },
      { text: '卡文/卡图了…', response: '出去走走吧，灵感会自己回来的~' },
    ],
  },
  // 库存很多卖不出去
  {
    trigger: s => (s.inventory?.hvpStock || 0) + (s.inventory?.lvpStock || 0) > 80,
    npc: '你家是不是快被库存堆满了…',
    replies: [
      { text: '别提了，都没地方坐了', response: '要不搞个通贩清库存？或者下次展会多带点' },
      { text: '这叫战略储备！', response: '哈哈哈你这是开仓库呢！不过有货才有底气' },
      { text: '在等一个大展', response: '有规划就好！大展销量会好很多的' },
    ],
  },
  // 连续参展疲劳
  {
    trigger: s => s.recentEventTurns?.filter(t => s.turn - t < 6).length >= 3,
    npc: '你最近是不是展子跑得太频了…注意身体啊',
    replies: [
      { text: '确实有点累', response: '跑展也是体力活！中间歇一歇嘛' },
      { text: '趁有热度多跑几场', response: '道理是这样但别把自己累垮了…' },
      { text: '下个月休息！', response: '说到做到哦！我监督你！' },
    ],
  },
  // 声誉很低（新手期）
  {
    trigger: s => s.reputation < 0.8 && s.turn > 6,
    npc: '别灰心啦，每个大触都是从零开始的',
    replies: [
      { text: '我知道…就是有点急', response: '慢慢来！你的进步我都看在眼里的' },
      { text: '我会坚持的', response: '这就对了！坚持就是最大的天赋' },
      { text: '你真的觉得我行吗', response: '当然！你只是还没遇到欣赏你的人而已' },
    ],
  },
  // 有钱了
  {
    trigger: s => s.money > 20000,
    npc: '你最近是不是发财了！请客请客！',
    replies: [
      { text: '都是辛苦钱…', response: '辛苦钱也是钱！好歹能吃顿好的了吧' },
      { text: '要不要合作出个本', response: '我出故事你出画？！成交！' },
      { text: '存着下次展会用', response: '理财小能手！不过偶尔也该犒劳自己~' },
    ],
  },
  // 升级过设备
  {
    trigger: s => s.equipmentLevel >= 2,
    npc: '听说你换了新设备？手感怎么样',
    replies: [
      { text: '画起来顺滑多了', response: '工欲善其事必先利其器！产能是不是翻倍了' },
      { text: '还在适应', response: '新设备都要磨合期的，用几天就习惯了' },
      { text: '肉疼但值得', response: '设备是投资！好工具用好几年的' },
    ],
  },
  // 多次创作后的老手期
  {
    trigger: s => s.totalHVP >= 3 && s.totalLVP >= 3,
    npc: '你现在本子和谷子都出了好多了，好厉害',
    replies: [
      { text: '越做越上瘾', response: '这就是同人的魅力吧！看着自己的作品一排排的超有成就感' },
      { text: '但每次还是会紧张', response: '紧张说明你在意质量，这是好事！' },
      { text: '该尝试点新花样了', response: '换个题材或者换种类型？保持新鲜感很重要！' },
    ],
  },
  // 热情很高
  {
    trigger: s => s.passion > 85,
    npc: '你最近状态好好啊，眼睛都在发光！',
    replies: [
      { text: '灵感爆棚！', response: '趁这股劲多画点！状态好的时候产出也高' },
      { text: '对吧！停不下来', response: '这就是传说中的Zone状态吧！享受它！' },
      { text: '希望一直这样', response: '高潮总有低谷，但有过这种状态就知道自己能达到~' },
    ],
  },
  // 刚开始游戏
  {
    trigger: s => s.turn <= 2,
    npc: '暑假开始了！有什么创作计划吗',
    replies: [
      { text: '想试试出本子！', response: '加油！第一本虽然会手忙脚乱但一定很有成就感！' },
      { text: '先做点小谷子练手', response: '稳扎稳打！谷子成本低风险小，很适合入门' },
      { text: '还在想…', response: '不急不急，先看看别人怎么做的，找找灵感~' },
    ],
  },
  // 赞助社群后
  {
    trigger: s => s.lastSponsorTurn >= 0 && s.turn - s.lastSponsorTurn <= 2,
    npc: '听说你赞助了社区活动！好大方啊',
    replies: [
      { text: '回馈社区嘛', response: '好有前辈风范！大家都在说你好话呢~' },
      { text: '花了不少钱…', response: '钱花在这种地方很值得的！口碑是买不到的' },
      { text: '顺便认识了些新朋友', response: '这就是社区活动的魅力嘛，人脉比钱重要！' },
    ],
  },
  // 投资社群-高等级（工坊/社区祭/基金）
  {
    trigger: s => s.reputation >= 7 && s.lastSponsorTurn >= 0 && s.turn - s.lastSponsorTurn <= 2,
    npc: '你办的那个活动好多人参加啊！我朋友圈都在发',
    replies: [
      { text: '办活动比出本子还累', response: '哈哈哈但影响力完全不一样！你现在是圈子里的"建设者"了' },
      { text: '希望能帮到新人', response: '肯定能！好多人就是因为你的活动才入坑的' },
      { text: '花了好大一笔钱', response: '投资嘛…你在圈子里种下的种子以后都会开花的' },
    ],
  },
  // IP黄昏/消亡期
  {
    trigger: s => s.official?.ipPhase === 'twilight' || s.official?.ipPhase === 'death',
    npc: '这个IP好像越来越冷了…你还打算继续做吗',
    replies: [
      { text: '当然，这是我的热爱', response: '…你说得对。不是所有事都要看热度的。我支持你' },
      { text: '在考虑转型', response: '嗯…如果决定了我帮你参谋，不管怎样我都挺你' },
      { text: '冷门有冷门的好处', response: '确实！竞争少，真爱粉质量高。你是这个圈子的定海神针' },
    ],
  },
  // IP复兴
  {
    trigger: s => s.official?.ipPhase === 'revival',
    npc: '天哪这个IP突然又火起来了！！好多新人涌进来',
    replies: [
      { text: '赶紧出新作！', response: '对对对！趁热度赶紧冲！我帮你宣传！' },
      { text: '坚守终于有回报了', response: '你一直在的时候没人说什么，IP火了大家才知道你的坚持有多难得' },
      { text: '新人太多有点不适应', response: '哈哈老前辈心态！对新人好一点嘛，都是因为热爱才来的' },
    ],
  },
  // 30岁以上还在做
  {
    trigger: s => Math.floor(s.turn / 12) + 18 >= 30 && s.totalHVP >= 5,
    npc: '你做同人都十几年了吧…有没有想过为什么一直在坚持',
    replies: [
      { text: '习惯了吧', response: '习惯也是一种热爱的形式呀。你的坚持让圈子里很多人都有了信心' },
      { text: '因为还有人在等我的作品', response: '…你说这话的时候眼睛在发光诶。好，那就继续画！' },
      { text: '我也不知道，停不下来', response: '停不下来就对了！这就是你的答案嘛~' },
    ],
  },
  // 35岁以上
  {
    trigger: s => Math.floor(s.turn / 12) + 18 >= 35,
    npc: '你身体还好吗？最近有按时吃饭睡觉吗',
    replies: [
      { text: '还行，注意着呢', response: '那就好…不年轻了，别仗着以前能熬就继续熬啊' },
      { text: '偶尔还是会熬夜', response: '唉…你看看你的黑眼圈！给我保证以后十二点前睡！' },
      { text: '你怎么跟我妈一样', response: '因为关心你！你妈说得对！少熬夜多喝水！' },
    ],
  },
  // 带新人/有人请教
  {
    trigger: s => s.reputation >= 4 && s.turn > 110,
    npc: '有新人跟我说很崇拜你诶，你现在是"前辈"了',
    replies: [
      { text: '哈哈我还是觉得自己是新人', response: '你都出了这么多作品了还新人！你在新人眼里就是神好吗' },
      { text: '有点受宠若惊', response: '别谦虚了！你值得被仰望~' },
      { text: '希望能帮到他们', response: '你的作品本身就是最好的教材了，加上你人又好，新人们有福了' },
    ],
  },
  // IP冷门逆袭后
  {
    trigger: s => s.market?._initialIpType === 'cold' && s.market?.ipType === 'normal',
    npc: '你们那个IP居然火起来了！！当初选冷门的人现在都在偷笑吧',
    replies: [
      { text: '谁说冷门没前途的', response: '打脸了打脸了！你们这些坚持的人才是功臣啊' },
      { text: '终于不用解释"这是什么IP"了', response: '哈哈哈之前每次提起来都要科普半天，现在都知道了' },
      { text: '竞争也变多了', response: '确实…但先来的人有先发优势嘛，你的地位稳得很' },
    ],
  },
];

/**
 * Pick a dialog for this interaction
 * @param {object} state - game state
 * @returns {{ npc: string, replies: Array<{text: string, response: string}> }}
 */
export function pickBestieDialog(state) {
  // 30% chance to pick a state-related dialog if available
  if (Math.random() < 0.3) {
    const matching = STATE_DIALOGS.filter(d => d.trigger(state));
    if (matching.length > 0) {
      const d = matching[Math.floor(Math.random() * matching.length)];
      return { npc: d.npc, replies: d.replies };
    }
  }
  // Otherwise pick a general dialog
  const d = GENERAL[Math.floor(Math.random() * GENERAL.length)];
  return { npc: d.npc, replies: d.replies };
}
