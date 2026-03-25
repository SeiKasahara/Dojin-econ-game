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
