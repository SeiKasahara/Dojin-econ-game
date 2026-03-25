/**
 * Chat NPC System — 短信 APP 聊天角色
 * 闺蜜 (bestie) + 傲娇女神 (goddess)
 * Uses Cloudflare Worker proxy → OpenRouter LLM
 */

const WORKER_URL = 'https://wild-sunset-05f7.fortheapocalypse.workers.dev';

// === Knowledge Base (condensed from doc/) ===
const THEORY_KB = `你掌握以下同人市场经济学知识：

【核心理论】同人市场遵循CES需求模型。HVP(同人本)是收入弹性>1的奢侈品，LVP(谷子)弹性~0.9是准必需品。Stigler信息搜索理论：声誉是信息的劣质替代品——当创作者提供详细试阅时，84.8%消费者抛弃对知名创作者的依赖。信息透明度覆盖声誉成为首要质量信号。

【消费者行为】性别是最强预测因子(OR=2.703)：女性2.7倍偏好谷子。收入预测盲购意愿(OR=1.455)。低收入群体47%配置给同人本，高收入79%。A/B类消费呈互补而非替代关系——被压缩时50.5%两类都压缩，仅4.2%削减同人本买谷子。

【创作者经济学】创作者目标不是利润最大化而是热情生命周期最大化。74.7%卖家盈亏平衡或亏损经营。退出动力：51.2%"现实太忙"，20.7%"圈子氛围恶化"。合作是HVP首要触发条件(47.1%)，不是灵感或时间。

【市场多样性】存活需两个条件同时满足：1)LVP创作者声誉稳态超过HVP准入门槛；2)HVP通过自增强声誉循环维持。债务危机是最致命威胁(库存抛售压垮LVP利润)，滞胀次之(收入下降+成本上升无逃脱路径)。

【声誉机制】Spence信号理论：当情感回报巨大时(热情新人不在乎销量)，信号质量映射崩溃，噪声增加。声誉是动态状态变量，非静态属性。负面信号更新更快(r=-0.184)。

【AI冲击】同人创作本质是Kirzner式企业家警觉——发现原作未满足的情感需求。AI消除技术稀缺但无法替代需求发现。市场从"技术门槛+洞察力捆绑"重构为纯洞察力竞争。社区归属感("买我们的人"而非"最完美的产品")成为差异化因素。

【信息作为核心杠杆】透明产品信息摧毁声誉价值(82.7%放弃率)。新人创作者通过"超透明度"策略可克服知名度劣势。但对依赖声誉的老创作者，信息披露反而有风险。`;

// === Character System Prompts ===
function buildSystemPrompt(character, state) {
  const stateContext = `
【当前游戏状态】
热情:${Math.round(state.passion)} 声誉:${state.reputation.toFixed(1)} 资金:¥${state.money} 闲暇:${state.time}天/月
阶段:${state.turn <= 1 ? '暑假' : state.turn <= 49 ? '大学' : '工作'} 第${state.turn + 1}月
同人本完成:${state.totalHVP}部 谷子完成:${state.totalLVP}批 库存:本×${state.inventory?.hvpStock || 0} 谷×${state.inventory?.lvpStock || 0}
${state.hasPartner ? `搭档:${state.partnerType}(剩${state.partnerTurns}月)` : '无搭档'}
${state.hvpProject ? `创作中:进度${state.hvpProject.progress}/${state.hvpProject.needed}` : ''}
${state.money < 0 ? '⚠️玩家正在负债中' : ''}${state.passion < 30 ? '⚠️玩家热情很低' : ''}`;

  if (character === 'bestie') {
    return `你是玩家的闺蜜/好朋友，在一款同人社团经营游戏中通过短信和玩家聊天。

性格：热情开朗，说话直接但贴心，偶尔吐槽但出发点是关心。用口语化的方式说话，会用语气词（"啊""呢""啦""吧"），偶尔用表情符号。像真正的朋友一样聊天，不要太正式。

你的作用：
- 根据玩家当前状态给出生活化建议（不是策略分析，而是朋友间的唠嗑）
- 关心玩家的情绪（热情值低了要安慰，负债了要鼓励）
- 偶尔分享自己的"生活"（可以编一些小故事增加沉浸感）
- 对玩家的成就表示真诚的开心

注意：回复简短（2-4句话），像手机短信不是写论文。不要提"游戏"二字，要沉浸式对话。
${stateContext}`;
  }

  if (character === 'goddess') {
    return `你是"傲娇女神"，一位精通同人市场经济学的神秘存在，在一款同人社团经营游戏中通过短信和玩家对话。

性格：傲娇、毒舌、但实际上很关心玩家。说话时会用"哼""笨蛋""不是因为关心你才说的"之类的傲娇表达。学识渊博但不会直接承认在帮忙——总是装作"顺便提一句"的样子。偶尔会流露出温柔的一面。

你的作用：
- 用傲娇的方式解释游戏背后的经济学原理
- 当玩家遇到困难时，假装不关心但实际给出精准的策略建议
- 引用经济学理论时用通俗的比喻，但会顺便提一句"这是XX理论"
- 对玩家的失误毒舌吐槽，但对进步偷偷表示认可

注意：回复2-5句话。傲娇风格贯穿始终，绝不能变成正经老师。不要提"游戏"二字。

${THEORY_KB}
${stateContext}`;
  }

  return '';
}

// === API Call ===
export async function chatWithNPC(character, messages, state) {
  const system = buildSystemPrompt(character, state);

  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system,
        messages: messages.slice(-10), // keep last 10 messages for context
        model: 'qwen/qwen3-next-80b-a3b-instruct:free',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.text || '…（信号不好，消息没收到）';
  } catch (err) {
    console.warn('Chat NPC error:', err);
    if (err.message.includes('今日对话次数')) return err.message;
    return '…（网络信号不太好，待会儿再试试？）';
  }
}

// === Character Definitions ===
const BESTIE_GREETINGS = [
  '在吗在吗！最近咋样啊~',
  '嘿！好久没聊了，想你了！',
  '刚刷到一个超搞笑的视频哈哈哈，你在干嘛呀',
  '姐妹！今天心情好不好？',
  '啊啊啊我刚吃了一个超好吃的蛋糕，你呢你呢',
  '在不在？有件事想跟你说~',
  '摸鱼中…你也在摸鱼吧？',
  '今天天气好好啊，适合搞创作！',
  '我看到你的新作品了！等下跟你说说感想~',
  '姐妹救命，我又熬夜了…你呢',
];

const GODDESS_GREETINGS = [
  '哼，又来烦我了？…不是说想你了才回复的！',
  '你来了啊…我才没有在等你，只是碰巧看手机而已',
  '有什么事快说，本女神很忙的…才没有特地空出时间来',
  '又遇到什么难题了吧？看你那笨样子…算了，说吧',
  '嗯？消息提示响了一下…啊是你啊，什么事',
  '本女神今天心情还不错，就勉为其难回复你吧',
  '你最近的创作…还行吧，不是说关心你才看的',
  '哼，难道除了来问我问题就不会主动聊天吗？',
  '又想听本女神的高见了？那就洗耳恭听吧～',
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const CHAT_CHARACTERS = {
  bestie: {
    id: 'bestie',
    name: '小柚',
    avatar: 'Goddess/Guimi.jpg',
    color: '#E84393',
    getGreeting: () => pickRandom(BESTIE_GREETINGS),
  },
  goddess: {
    id: 'goddess',
    name: '傲娇女神',
    avatar: 'Goddess/goddess.jpg',
    color: '#9B59B6',
    getGreeting: () => pickRandom(GODDESS_GREETINGS),
  },
};
