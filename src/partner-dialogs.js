/**
 * Partner Chat Dialogs — 搭档短信对话池
 * Preset dialog system for trusted partners (affinity >= 4)
 * Four personality variants: supportive, demanding, unreliable, toxic
 */

// === GENERAL: 日常创作者闲聊 ===
const GENERAL = [
  // --- supportive (默契搭档) ---
  { types: ['supportive'], npc: '今天画了一整天，手有点酸但好开心~你呢？', replies: [
    { text: '我也在画！', response: '太好了！一起冲！今晚互相看看进度？', effect: { passion: 2 } },
    { text: '在摸鱼…', response: '偶尔摸鱼也是充电呀，别有压力~' },
    { text: '有点累了', response: '那就休息一下嘛，别硬撑，明天再画也来得及' },
  ]},
  { types: ['supportive'], npc: '我觉得你最近的画风进步好大！', replies: [
    { text: '真的吗？谢谢！', response: '真的真的！线条比之前流畅多了，继续保持~', effect: { passion: 2 } },
    { text: '还差得远…', response: '别这样说嘛，进步是一点一点的，我都看在眼里' },
    { text: '你也在进步啊', response: '嘿嘿，互相鼓励互相成长！这就是搭档的意义~', effect: { affinity: 0.1 } },
  ]},
  { types: ['supportive'], npc: '你最近有没有遇到什么创作瓶颈？', replies: [
    { text: '有…画不出想要的感觉', response: '换个工具或者换个环境试试？有时候换换心情就通了' },
    { text: '还好，状态不错', response: '那太好了！趁状态好多产出点~', effect: { passion: 2 } },
    { text: '想和你讨论一下', response: '当然！随时找我，两个脑袋比一个强~', effect: { affinity: 0.1 } },
  ]},
  { types: ['supportive'], npc: '刚在通贩网站上看到有人安利你的作品！', replies: [
    { text: '真的？好开心！', response: '对呀！评价超好的，你值得被更多人看到~', effect: { passion: 3 } },
    { text: '是水军吧…', response: '才不是！你就不能对自己有点信心嘛' },
    { text: '希望能卖出去', response: '会的会的，好作品不怕没人买~', effect: { passion: 1 } },
  ]},
  { types: ['supportive'], npc: '要不要下次展会一起摆摊？互相照应也安心', replies: [
    { text: '好呀！', response: '说定了！到时候我帮你看摊你去逛~', effect: { passion: 2, affinity: 0.1 } },
    { text: '我可能寄售', response: '也行，不过有机会还是亲自来，现场氛围很不一样的' },
    { text: '看情况吧', response: '嗯嗯，不急，到时候再说~' },
  ]},
  { types: ['supportive'], npc: '今天做了个新菜，超好吃！改天做给你吃', replies: [
    { text: '什么菜！', response: '番茄炖牛腩！汤汁特别浓，配饭绝了~', effect: { passion: 1 } },
    { text: '你还会做饭啊', response: '嘿嘿，创作者也要好好吃饭嘛' },
    { text: '好期待', response: '下次见面带给你！当面交流也比线上有意思~', effect: { affinity: 0.1 } },
  ]},
  { types: ['supportive'], npc: '看到你之前的旧作了，跟现在对比变化好大', replies: [
    { text: '黑历史别看！', response: '哈哈哈，可是能看到成长轨迹不是很棒吗？' },
    { text: '确实进步了不少', response: '嗯嗯！坚持就是最好的天赋~', effect: { passion: 2 } },
    { text: '还有很大提升空间', response: '一步一个脚印，不着急~', effect: { passion: 1 } },
  ]},
  { types: ['supportive'], npc: '你觉得做同人最快乐的瞬间是什么？', replies: [
    { text: '有人说喜欢我的作品时', response: '对！那种被认可的感觉无可替代~', effect: { passion: 2 } },
    { text: '完成一个作品的时候', response: '那种成就感真的比什么都强！', effect: { passion: 2 } },
    { text: '和你一起创作的时候', response: '…嘿嘿，我也是！搭档万岁~', effect: { affinity: 0.15 } },
  ]},
  { types: ['supportive'], npc: '刚入了一套新画材，想试试看效果', replies: [
    { text: '什么画材！', response: 'Copic的新色号！颜色过渡超丝滑~', effect: { passion: 1 } },
    { text: '又乱花钱', response: '才没有！工欲善其事嘛~…好吧确实有点冲动', effect: { passion: 1 } },
    { text: '试完分享心得', response: '一定！好东西要和好搭档分享~', effect: { affinity: 0.1 } },
  ]},

  // --- demanding (严格搭档) ---
  { types: ['demanding'], npc: '你上次那个配色方案，说实话不太行', replies: [
    { text: '…具体哪里不好？', response: '对比度太弱，主色调和背景打架。我发你几个参考', effect: { passion: -1, affinity: 0.15 } },
    { text: '我觉得还行啊', response: '你觉得还行就行吧…但市场不这么想', effect: { passion: -2 } },
    { text: '那你帮我改改？', response: '…行吧，谁让我答应帮你了', effect: { affinity: 0.1 } },
  ]},
  { types: ['demanding'], npc: '你今天画了多少？', replies: [
    { text: '画了一整天！', response: '嗯，这种自律要保持。量变才能质变' },
    { text: '没怎么画…', response: '…你是不是又摸鱼了。这样下去作品什么时候能完？', effect: { passion: -1 } },
    { text: '质量比数量重要吧', response: '说得好，但零产出更没质量可言', effect: { passion: 1 } },
  ]},
  { types: ['demanding'], npc: '最近看了几个新人的作品，水平在涨', replies: [
    { text: '有危机感了', response: '有危机感是好事。逆水行舟不进则退', effect: { passion: 1 } },
    { text: '我不跟别人比', response: '你应该跟自己比，但也不能无视市场', effect: { affinity: 0.1 } },
    { text: '那我也要加油', response: '这话我爱听。去练速写，一周后给我看', effect: { passion: 2 } },
  ]},
  { types: ['demanding'], npc: '你那个排版我重新调了一版，你看看', replies: [
    { text: '谢谢！确实好多了', response: '嗯。下次自己注意留白和行距的比例', effect: { affinity: 0.15 } },
    { text: '为什么不先跟我说', response: '因为你拖太久了。结果不是挺好的吗', effect: { passion: -1 } },
    { text: '我可以自己来的…', response: '那你倒是做啊。我等了两周了', effect: { passion: -2 } },
  ]},
  { types: ['demanding'], npc: '印刷厂那边我帮你问了，这次用特种纸', replies: [
    { text: '好靠谱！谢谢', response: '用心做出来的东西，印刷不能拖后腿', effect: { passion: 1, affinity: 0.1 } },
    { text: '会不会太贵了', response: '贵是贵了点，但读者拿到手的触感完全不一样', effect: { passion: 1 } },
    { text: '你做主就好', response: '哼，这种事情你也该学着自己跟进', effect: { passion: -1 } },
  ]},
  { types: ['demanding'], npc: '你最近的作品我分析了一下，有几个共性问题', replies: [
    { text: '直说', response: '构图太安全了。你怕犯错所以一直在舒适区里', effect: { passion: -1, affinity: 0.15 } },
    { text: '又要被骂了…', response: '我不是骂你。我是在帮你，还是你分不清？', effect: { passion: -2 } },
    { text: '我自己也感觉到了', response: '那就好。知道问题在哪就有救', effect: { passion: 1, affinity: 0.1 } },
  ]},
  { types: ['demanding'], npc: '我觉得你应该去参加那个画风挑战赛', replies: [
    { text: '我水平够吗…', response: '够不够不是你说了算。去试了才知道', effect: { passion: 1 } },
    { text: '好，我去！', response: '这才对。就算输了也是经验', effect: { passion: 2 } },
    { text: '没时间', response: '你有时间摸鱼就有时间参赛。优先级问题', effect: { passion: -1 } },
  ]},
  { types: ['demanding'], npc: '你知道为什么你的作品卖得不够多吗', replies: [
    { text: '为什么？', response: '因为你宣发做得太少。酒香也怕巷子深', effect: { infoDisclosure: 0.03 } },
    { text: '我不在乎销量', response: '你可以不在乎，但如果想继续做同人，钱还是要赚的' },
    { text: '比起来你卖得多？', response: '…至少我的投入产出比比你高', effect: { passion: -1 } },
  ]},
  { types: ['demanding'], npc: '上次展会你表现还行，但摊位布置可以更好', replies: [
    { text: '具体怎么改？', response: '主推作品要放在视线高度，价格牌要大。我画个布局图给你', effect: { passion: 1, affinity: 0.1 } },
    { text: '我觉得挺好了', response: '你觉得好和买家觉得好是两回事', effect: { passion: -1 } },
    { text: '下次你帮我布置吧', response: '可以，但你得学会，不能每次都靠我', effect: { affinity: 0.1 } },
  ]},

  // --- unreliable (不靠谱搭档) ---
  { types: ['unreliable'], npc: '啊啊啊我刚看到一个超棒的配色板！等下发你…等等我在做什么来着', replies: [
    { text: '发给我啊！', response: '对对对！等我找找…刚才存在哪了…算了我重新搜', effect: { passion: 1 } },
    { text: '你又跑题了', response: '哈哈哈抱歉！但真的超好看的！…好吧我先把手上的事做完' },
    { text: '你是不是多动症', response: '可能吧！但创意人嘛灵感一来就控制不住~', effect: { passion: 2 } },
  ]},
  { types: ['unreliable'], npc: '我昨天熬夜画了个超厉害的东西！但是忘记保存了…', replies: [
    { text: '…节哀', response: '呜呜呜…不过说不定重画一遍会更好？（自我安慰中）' },
    { text: '你就不能自动保存吗', response: '关了…因为自动保存会卡…我活该', effect: { passion: 1 } },
    { text: '下次我提醒你保存', response: '真的吗！你太好了呜呜呜，搭档还是你靠谱', effect: { affinity: 0.15 } },
  ]},
  { types: ['unreliable'], npc: '我刚接了个超有趣的私稿！虽然说好帮你画那个的…', replies: [
    { text: '…你又跑了', response: '不是不是！就耽误几天！…好吧可能一周…对不起', effect: { passion: -1 } },
    { text: '没事，你开心就好', response: '你真好！我画完马上回来帮你！大概！', effect: { affinity: 0.1 } },
    { text: '你每次都这样', response: '这次不一样！…好吧确实每次都这样。但我有在反省的', effect: { passion: -1 } },
  ]},
  { types: ['unreliable'], npc: '你信不信我三天能画完一整本漫画', replies: [
    { text: '信你个鬼', response: '哈哈哈好吧确实不太可能…但万一呢！', effect: { passion: 1 } },
    { text: '你认真的？', response: '半认真！如果灵感爆发的话…好吧四天', effect: { passion: 1 } },
    { text: '你先把上次的坑填了', response: '啊…那个…还差一点…再给我两周？', effect: { passion: -1 } },
  ]},
  { types: ['unreliable'], npc: '我今天居然按时起床了！太不可思议了！', replies: [
    { text: '恭喜…？', response: '你不懂！对我来说这比画完一本书还难！', effect: { passion: 1 } },
    { text: '几点？', response: '十一点！…好吧对你来说可能不算早', effect: { passion: 1 } },
    { text: '希望你能保持', response: '我也希望！但明天再说吧~', effect: { affinity: 0.1 } },
  ]},
  { types: ['unreliable'], npc: '诶诶诶你知道吗！我刚偶然发现一个超冷门但超好用的技法！', replies: [
    { text: '什么技法？', response: '就是那个…等等我想想叫什么来着…反正超好用！我做个教程给你！', effect: { passion: 2 } },
    { text: '你总是发现奇怪的东西', response: '这就是我的天赋嘛~灵感雷达！', effect: { passion: 1 } },
    { text: '先别忙，你的稿子呢', response: '那个…快了快了…你别催我越催越慢', effect: { passion: -1 } },
  ]},
  { types: ['unreliable'], npc: '刚在二手市场看到我们合作的那本被炒高价了！', replies: [
    { text: '真的？我去看看', response: '对啊！虽然钱跟我们没关系…但说明有人喜欢啊！', effect: { passion: 2 } },
    { text: '早知道多印点', response: '对吧！…不过当时谁知道呢哈哈', effect: { passion: 1 } },
    { text: '都是因为你的部分画得好', response: '诶嘿嘿…你也很棒的好吧！这是合作的力量！', effect: { affinity: 0.15 } },
  ]},
  { types: ['unreliable'], npc: '我最近想转型做音乐了！', replies: [
    { text: '…你认真的吗', response: '半认真！已经下载了编曲软件！…虽然还没打开', effect: { passion: 1 } },
    { text: '你能不能专注一件事', response: '嘿！多元发展也是一种策略好不好！', effect: { passion: -1 } },
    { text: '做个同人音乐专辑怎么样', response: '哇这个主意好！要不我们合作？！', effect: { passion: 2, affinity: 0.1 } },
  ]},
  { types: ['unreliable'], npc: '对了上次说帮你画的那个封面…', replies: [
    { text: '你画完了？！', response: '没有…但我画了一半了！真的！你要看吗！', effect: { passion: 1 } },
    { text: '我已经不抱希望了', response: '不要这样嘛！今晚一定画完！…大概', effect: { passion: -1 } },
    { text: '不急，慢慢来', response: '你人真好呜呜呜…那我就慢慢来了嘿嘿', effect: { affinity: 0.1 } },
  ]},

  // --- toxic (有毒搭档) ---
  { types: ['toxic'], npc: '你看到XX的新作品了吗？画得真好啊…比起来——啊不是那个意思啦', replies: [
    { text: '…你到底想说啥', response: '没什么啦！就觉得你可以更努力嘛，又不是在损你~', effect: { passion: -2 } },
    { text: '我走我自己的路', response: '哎呀好有志气~希望这个志气能持续到下次展会', effect: { passion: -1 } },
    { text: '嗯…我会加油的', response: '嗯嗯，反正有我在你身边帮你嘛~', effect: { affinity: 0.1 } },
  ]},
  { types: ['toxic'], npc: '最近好多人找我约稿呢~你有这种烦恼吗？', replies: [
    { text: '没有…', response: '啊…那你要不要我帮你推荐一下？不过人家可能嫌…算了没事', effect: { passion: -3 } },
    { text: '我也挺忙的', response: '是嘛~那就好，怕你一个人太闲了嘛', effect: { passion: -1 } },
    { text: '恭喜你啊', response: '嘿嘿谢谢~不过和你合作的时候我会优先的，放心吧', effect: { affinity: 0.1 } },
  ]},
  { types: ['toxic'], npc: '上次展会你怎么没告诉我你去了？我还是看别人的照片才知道的', replies: [
    { text: '忘了说了，抱歉', response: '哦…没事啦。反正你也不是非要跟我一起对吧', effect: { passion: -2 } },
    { text: '下次一起去', response: '算了吧，你可能又会"忘了"', effect: { passion: -2 } },
    { text: '临时决定的', response: '嗯…好吧。下次记得叫我', effect: { passion: -1, affinity: 0.1 } },
  ]},
  { types: ['toxic'], npc: '我发现你最近老是不回我消息诶', replies: [
    { text: '最近确实忙', response: '嗯…忙到连打几个字的时间都没有吗。算了我理解', effect: { passion: -2 } },
    { text: '有吗？没注意到', response: '哦。原来我在你心里是"没注意到"的存在啊', effect: { passion: -3 } },
    { text: '抱歉抱歉', response: '道歉有什么用嘛…不过看在你态度诚恳的份上就算了', effect: { passion: -1, affinity: 0.1 } },
  ]},
  { types: ['toxic'], npc: '说真的，如果没有我帮你，你觉得你能走到今天吗？', replies: [
    { text: '谢谢你的帮助', response: '嗯，至少你还知道感恩。不像有些人', effect: { passion: -1, affinity: 0.1 } },
    { text: '我自己也很努力', response: '是是是，你最努力了~我就是沾光的对吧', effect: { passion: -3 } },
    { text: '…', response: '怎么不说话了？又心虚了？', effect: { passion: -2 } },
  ]},
  { types: ['toxic'], npc: '我帮你在群里说了好话哦~别人都在夸你。不用谢我~', replies: [
    { text: '谢谢…？', response: '客气什么嘛，不过下次有好事记得也想着我哦', effect: { passion: -1, affinity: 0.1 } },
    { text: '我不需要别人帮我说', response: '哎呀你看你这脾气，好心当成驴肝肺', effect: { passion: -2 } },
    { text: '你说了什么', response: '放心啦都是好话~具体的你别管，知道有人罩着你就行', effect: { passion: -2 } },
  ]},
  { types: ['toxic'], npc: '你最近是不是跟别人合作了？我看到你发的图里有不熟悉的画风', replies: [
    { text: '只是朋友帮忙', response: '哦~"只是朋友"。那你跟我也"只是朋友"吗？', effect: { passion: -2 } },
    { text: '没有啊', response: '那就好。我就是随便问问…你别多想', effect: { passion: -1 } },
    { text: '就算有也很正常吧', response: '嗯，正常。非常正常。我懂的', effect: { passion: -2, affinity: -0.1 } },
  ]},
  { types: ['toxic'], npc: '唉…最近心情不太好。你能陪我聊聊天吗', replies: [
    { text: '怎么了？', response: '也没什么大事啦…就是觉得在这个圈子里只有你对我好', effect: { passion: -1, affinity: 0.1 } },
    { text: '我也有点忙…', response: '好吧。反正你也不是第一次推脱了', effect: { passion: -3 } },
    { text: '当然可以', response: '嗯…谢谢。虽然说了你也不一定真的在听', effect: { passion: -2 } },
  ]},
];

// === STATE_DIALOGS: 按游戏状态触发 ===
const STATE_DIALOGS = [
  { trigger: s => s.passion < 30, types: ['supportive'], npc: '你最近看起来好累…要不要歇一歇？', replies: [
    { text: '有点撑不住了', response: '那就放下笔休息一下吧，作品等得了你', effect: { passion: 3 } },
    { text: '还行，能扛', response: '别逞强了…答应我今天早点睡好不好？', effect: { passion: 2 } },
    { text: '谢谢关心', response: '不客气~累了随时找我聊天，我一直在的', effect: { passion: 2, affinity: 0.1 } },
  ]},
  { trigger: s => s.passion < 30, types: ['demanding'], npc: '看你现在这个状态，别硬画了', replies: [
    { text: '…你难得不逼我', response: '我又不是机器人。该休息的时候就得休息，不然出来的东西也是垃圾', effect: { passion: 3 } },
    { text: '我能行', response: '你行什么行。去休息。这是命令', effect: { passion: 2 } },
    { text: '你也要注意身体', response: '…哼，用不着你操心。但你说的也没错', effect: { affinity: 0.15 } },
  ]},
  { trigger: s => s.passion < 30, types: ['unreliable', 'toxic'], npc: '诶你是不是状态不太好？', replies: [
    { text: '确实…', response: '那要不要一起去吃个好的！心情不好的时候吃东西最有效！', effect: { passion: 2 } },
    { text: '没事', response: '哦好吧…那你自己调整~', effect: { passion: 1 } },
    { text: '聊聊天就好了', response: '那就聊！我最近有个超搞笑的事跟你说——', effect: { passion: 2 } },
  ]},
  { trigger: s => s.money < -1000, types: ['supportive', 'demanding', 'unreliable', 'toxic'], npc: '听说你最近经济有点紧张？', replies: [
    { text: '是啊…在想办法', response: '别太焦虑了，先把手头的作品做完，会好起来的', effect: { passion: 2 } },
    { text: '还行，能撑', response: '注意别为了省钱降低作品质量就好' },
    { text: '你能借我点吗', response: '…这个嘛，朋友之间借钱伤感情，你还是想想别的办法吧', effect: { passion: -1 } },
  ]},
  { trigger: s => s.reputation > 5, types: ['supportive'], npc: '你现在在圈子里越来越有名了！好多人提起你', replies: [
    { text: '有点不真实', response: '一步一步走过来的，你值得的~', effect: { passion: 2 } },
    { text: '有压力', response: '别给自己太大压力，做你想做的就好', effect: { passion: 2 } },
    { text: '你也会的', response: '哈哈我可没那么大的野心，看你发光就很开心~', effect: { affinity: 0.15 } },
  ]},
  { trigger: s => s.reputation > 5, types: ['demanding'], npc: '声誉上来了不代表可以松懈。越是这时候越容易栽跟头', replies: [
    { text: '你说得对', response: '嗯。继续保持这个标准，甚至提高。市场不会因为你有名就降低要求', effect: { passion: 1, affinity: 0.1 } },
    { text: '能不能夸我一次', response: '…不错。行了吧？继续干活', effect: { passion: 2 } },
    { text: '你是在担心我？', response: '哼…别自作多情。我是不想我合作过的人翻车', effect: { affinity: 0.1 } },
  ]},
  { trigger: s => s.hvpProject != null, types: ['supportive', 'demanding', 'unreliable'], npc: '新本子进度怎么样了？', replies: [
    { text: '还在磨', response: '加油加油！期待成品~', effect: { passion: 2 } },
    { text: '快完成了', response: '太好了！需要帮忙校稿记得找我', effect: { passion: 1, affinity: 0.1 } },
    { text: '有点卡住了', response: '换个思路试试？有时候从结尾倒推会有新灵感', effect: { passion: 1 } },
  ]},
  { trigger: s => s.fullTimeDoujin, types: ['supportive'], npc: '全职搞同人感觉怎么样？自由吗？', replies: [
    { text: '自由但焦虑', response: '这是正常的~给自己定个小目标，一步一步来', effect: { passion: 2 } },
    { text: '比上班好多了', response: '哈哈！能做喜欢的事是最大的幸福~', effect: { passion: 2 } },
    { text: '有时候挺孤独', response: '有我在呢！随时可以找我聊天~', effect: { passion: 2, affinity: 0.1 } },
  ]},
  { trigger: s => s.fullTimeDoujin, types: ['demanding'], npc: '全职同人不是让你躺着的，你每天有工作计划吗', replies: [
    { text: '有的，很严格', response: '很好。自律的人才配得上自由', effect: { passion: 2 } },
    { text: '大概有…', response: '大概？不行。今天开始给我写每日to-do，发给我看', effect: { passion: -1, affinity: 0.1 } },
    { text: '自由就是不想被计划束缚', response: '那你很快就会自由到没饭吃了', effect: { passion: -2 } },
  ]},
  { trigger: s => s.turn > 49 && !s.unemployed && !s.fullTimeDoujin, types: ['supportive', 'demanding', 'unreliable', 'toxic'], npc: '上班还在坚持创作，真的不容易啊', replies: [
    { text: '累但快乐', response: '嗯！能坚持的人都不简单~', effect: { passion: 2 } },
    { text: '时间真的不够用', response: '周末集中突击？或者通勤路上构思剧情？', effect: { passion: 1 } },
    { text: '想辞职全职搞', response: '这个决定要慎重…但如果你准备好了我支持你', effect: { passion: 1 } },
  ]},
];

// === MICRO_DECISION: 带gameplay effect的决策对话 ===
const MICRO_DECISION = [
  // supportive
  { types: ['supportive'], npc: '下次合作的时候，你想试试什么新方向？', replies: [
    { text: '想挑战新题材', response: '好！我帮你收集参考资料，我们一起研究！', effect: { passion: 3, collabHint: true } },
    { text: '把擅长的做得更好', response: '深耕也很棒，稳中求进~', effect: { affinity: 0.15 } },
    { text: '你来决定吧', response: '哈哈好吧，那我想想…下次给你惊喜！', effect: { passion: 2 } },
  ]},
  { types: ['supportive'], npc: '我最近研究了一些新技法，下次合作想用上', replies: [
    { text: '好啊！分享给我', response: '你看这个水彩叠色法，效果超好！', effect: { passion: 2, collabHint: true } },
    { text: '会不会风险太大', response: '小范围试试嘛，不行就换回来~', effect: { passion: 1 } },
    { text: '我相信你的眼光', response: '嘿嘿，那就交给我吧~', effect: { affinity: 0.15 } },
  ]},
  { types: ['supportive'], npc: '有个展会在招合作摊位，我们一起报名？', replies: [
    { text: '好！一起去', response: '说定了！我来研究布展方案~', effect: { passion: 2, infoDisclosure: 0.03 } },
    { text: '这次我想自己去', response: '嗯嗯，那我帮你看看有没有好的摊位位置~', effect: { passion: 1 } },
    { text: '最近没钱参展…', response: '路费我可以先帮你垫一点~', effect: { passion: 2, affinity: 0.15 } },
  ]},

  // demanding
  { types: ['demanding'], npc: '下次合作，我想把质量标准再提高一档。你跟不跟得上？', replies: [
    { text: '当然！一起冲', response: '哼，这才像话。那我先拟个标准文档', effect: { passion: 2, collabHint: true } },
    { text: '能不能别逼这么紧', response: '…我不是在逼你，是在推你。但好吧，你的节奏你定', effect: { affinity: 0.1 } },
    { text: '我需要时间准备', response: '行，给你一个月。到时候别让我失望', effect: { passion: 1 } },
  ]},
  { types: ['demanding'], npc: '你那个宣发做得太随意了。我帮你策划一个方案？', replies: [
    { text: '好！指导一下', response: '先把你的卖点提炼出来。三句话之内要说清楚', effect: { infoDisclosure: 0.05, affinity: 0.1 } },
    { text: '我觉得够了', response: '够？你的曝光率连市场平均都不到', effect: { passion: -1 } },
    { text: '那就交给你了', response: '不行。我教你，你自己做。不能什么都依赖别人', effect: { passion: 1, infoDisclosure: 0.03 } },
  ]},
  { types: ['demanding'], npc: '我觉得我们下次合作的分工要调整', replies: [
    { text: '你说，我听', response: '你负责故事和分镜，我抓质量和排版。各司其职', effect: { collabHint: true, affinity: 0.15 } },
    { text: '现在这样不好吗', response: '不是不好，是可以更好。别满足于"还行"', effect: { passion: 1 } },
    { text: '感觉你什么都要管', response: '因为你不管我就得管。你主动一点我自然就放手了', effect: { passion: -1 } },
  ]},

  // unreliable
  { types: ['unreliable'], npc: '嘿！我想到一个超级无敌疯狂的企划！你听听看！', replies: [
    { text: '说来听听！', response: '我们做一本24小时限定本！从零开始当天画完当天卖！', effect: { passion: 3, collabHint: true } },
    { text: '又来了…', response: '别这样嘛！这次真的可行！大概…', effect: { passion: 1 } },
    { text: '你先把上次的做完', response: '啊…那个…好吧你说得对…', effect: { passion: -1, affinity: 0.1 } },
  ]},
  { types: ['unreliable'], npc: '下次展会我们要不要搞个联合签售？肯定超有趣！', replies: [
    { text: '好呀！', response: '耶！那我去做宣传图！…等等我先把这个表情包画完', effect: { passion: 2, infoDisclosure: 0.03 } },
    { text: '你到时候会来吗', response: '当然！这次一定！…大概…九成会来！', effect: { passion: 1 } },
    { text: '先说好，别放我鸽子', response: '我什么时候放过你鸽子！…好吧有过。这次不会了！', effect: { affinity: 0.15 } },
  ]},
  { types: ['unreliable'], npc: '我觉得我们应该做周边！抱枕！钥匙扣！全套那种！', replies: [
    { text: '一步一步来吧', response: '好吧好吧…那先做钥匙扣？成本低好试水', effect: { passion: 1, collabHint: true } },
    { text: '你出设计我出钱？', response: '诶这个分工好！但你可能要等我有灵感的时候…', effect: { passion: 1 } },
    { text: '我怕你做一半跑了', response: '不会！绝对不会！…可能不会…你看着我就行', effect: { affinity: 0.1 } },
  ]},

  // toxic
  { types: ['toxic'], npc: '下次合作的时候，你要听我的。上次你非要自己搞结果怎么样', replies: [
    { text: '…好吧', response: '嗯，乖~听我的不会错的', effect: { passion: -2, collabHint: true } },
    { text: '我们可以商量', response: '商量？上次商量完你不还是按自己的来吗', effect: { passion: -2 } },
    { text: '我不想被控制', response: '什么控制啊，我这叫关心你好不好', effect: { passion: -3 } },
  ]},
  { types: ['toxic'], npc: '有人在群里说你坏话，我帮你怼回去了', replies: [
    { text: '谢谢你…', response: '不用谢~反正我也不喜欢那个人。以后有人欺负你就跟我说', effect: { passion: -1, affinity: 0.1 } },
    { text: '说了什么', response: '你不想知道的。反正我处理了，你安心做你的就好', effect: { passion: -2 } },
    { text: '我可以自己处理', response: '哦？那你之前怎么不处理？还不是要靠我', effect: { passion: -3 } },
  ]},
  { types: ['toxic'], npc: '我觉得我们应该只跟对方合作，别找其他人了', replies: [
    { text: '这…太极端了吧', response: '极端吗？你有更好的搭档吗？', effect: { passion: -2 } },
    { text: '我会优先跟你合作', response: '嗯…优先。也就是说还是会找别人对吧', effect: { passion: -2 } },
    { text: '好的，就我们两个', response: '这就对了嘛~有我一个人就够了', effect: { passion: -1, affinity: 0.15 } },
  ]},
];

// === NUDGE MESSAGES: 搭档主动发消息（长期不互动时触发）===
export const PARTNER_NUDGE_MESSAGES = {
  supportive: [
    '好久没聊了，你还好吗？最近在忙什么呀',
    '在吗~突然想起来好久没联系你了',
  ],
  demanding: [
    '你是不是把我忘了？这种态度可不行',
    '多久没联系了？你不会连基本的人际维护都不做吧',
  ],
  unreliable: [
    '啊！突然想起来好久没找你了！你还活着吗哈哈',
    '诶诶诶！我刚想到一个事想跟你说——等等我忘了是什么了',
  ],
  toxic: [
    '你是不是在躲我…算了，反正也习惯了',
    '呵…这么久不找我，是觉得不需要我了吧',
  ],
};

/**
 * Pick a partner dialog based on game state and partner type
 * @param {object} state - game state
 * @param {string} partnerType - 'supportive'|'demanding'|'unreliable'|'toxic'
 * @returns {{ npc: string, replies: Array<{ text: string, response: string, effect?: object }> }}
 */
export function pickPartnerDialog(state, partnerType) {
  const r = Math.random();
  const typeFilter = d => d.types.includes(partnerType);

  // 20% micro-decision
  if (r < 0.2) {
    const pool = MICRO_DECISION.filter(typeFilter);
    if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
  }

  // 30% state-triggered
  if (r < 0.5) {
    const pool = STATE_DIALOGS.filter(d => typeFilter(d) && (!d.trigger || d.trigger(state)));
    if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
  }

  // fallback: general
  const pool = GENERAL.filter(typeFilter);
  return pool[Math.floor(Math.random() * pool.length)];
}
