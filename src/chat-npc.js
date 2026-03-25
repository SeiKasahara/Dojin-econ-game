/**
 * Chat NPC System — 短信 APP 聊天角色
 * 闺蜜 (bestie): 每月3条，聊完显示"去忙了"
 * 傲娇女神 (goddess): 仅在宏观事件时激活，8-10条对话后离开
 * Uses Cloudflare Worker proxy → OpenRouter LLM
 */

const WORKER_URL = 'https://wild-sunset-05f7.fortheapocalypse.workers.dev';

// === Knowledge Base (condensed from doc/) ===
const THEORY_KB = `你掌握以下同人市场经济学知识：

【核心理论】同人市场遵循CES需求模型。HVP(同人本)是收入弹性>1的奢侈品，LVP(谷子)弹性~0.9是准必需品。Stigler信息搜索理论：声誉是信息的劣质替代品——当创作者提供详细试阅时，84.8%消费者抛弃对知名创作者的依赖。

【消费者行为】性别是最强预测因子(OR=2.703)：女性2.7倍偏好谷子。收入预测盲购意愿(OR=1.455)。A/B类消费呈互补而非替代。

【创作者经济学】创作者目标是热情生命周期最大化，非利润最大化。74.7%卖家盈亏平衡或亏损。退出：51.2%"现实太忙"，20.7%"圈子氛围恶化"。

【市场多样性】存活需两个条件：1)LVP声誉稳态超HVP准入门槛；2)HVP自增强声誉循环。债务危机最致命(库存抛售压垮LVP利润)，滞胀次之。

【AI冲击】同人创作本质是Kirzner式企业家警觉。AI消除技术稀缺但无法替代需求发现。市场重构为纯洞察力竞争。`;

// === Macro Event Descriptions (for goddess opening message) ===
const MACRO_EVENT_CONTEXT = {
  recession: {
    opening: '哼…经济下行了。笨蛋，你知道这意味着什么吗？同人本是弱奢侈品，收入弹性>1——收入降1%，需求降超过1%。你的销量会被压缩。',
    topic: '经济下行对同人市场的影响',
  },
  stagflation: {
    opening: '这下麻烦大了…滞胀，懂吗？收入降+物价涨，双重夹击。消费者没法"买便宜的"因为物价涨了，也没法"提价转嫁"因为需求降了。没有避风港。',
    topic: '滞胀对同人市场的毁灭性影响',
  },
  debt_crisis: {
    opening: '消费者债务危机…这是最危险的。不是因为关心你才说的！债务是存量负担，不会随经济复苏消失。更可怕的是二手市场会被抛售品淹没。',
    topic: '债务危机和二手市场倾泻对同人创作者的影响',
  },
  ai_revolution: {
    opening: '呵…AI革命来了。别慌，笨蛋。AI能替代画技但替代不了你发现需求的直觉——这叫Kirzner企业家警觉，不是因为想教你才解释的！',
    topic: 'AI对同人市场的结构性冲击',
  },
  welcome: {
    opening: '哼…你就是那个刚成立社团的新人？别误会，不是特地来关注你的。只是…同人经济学的门道可深了，你一个人肯定会栽跟头。有什么不懂的就问吧，本女神心情好的时候会回答。',
    topic: '同人创作入门指导',
  },
};

// Activate first-month welcome for both characters
export function triggerWelcomeMessages(state) {
  // Activate goddess with welcome topic
  state._goddessEvent = { eventId: 'welcome', topic: MACRO_EVENT_CONTEXT.welcome.topic, opening: MACRO_EVENT_CONTEXT.welcome.opening };
  if (!state._chatUsage) state._chatUsage = {};
  state._chatUsage.goddess = 0;
  state._chatUsage.bestie = 0;
  // Mark that welcome was triggered
  state._welcomeMessagesSent = true;
}

// === Character System Prompts ===
function buildSystemPrompt(character, state, eventContext) {
  const stateContext = `
【当前状态】热情:${Math.round(state.passion)} 声誉:${state.reputation.toFixed(1)} 资金:¥${state.money}
阶段:${state.turn <= 1 ? '暑假' : state.turn <= 49 ? '大学' : '工作'} 库存:本×${state.inventory?.hvpStock || 0} 谷×${state.inventory?.lvpStock || 0}
${state.money < 0 ? '⚠️负债中' : ''}${state.passion < 30 ? '⚠️热情很低' : ''}`;

  if (character === 'bestie') {
    return `你是玩家的闺蜜小柚，通过短信聊天。
性格：热情开朗，说话直接贴心，口语化，用语气词和偶尔的emoji。
根据玩家状态给朋友式建议，关心情绪，偶尔分享自己的小故事。
【严格要求】每条回复不超过30个字！像微信消息一样短。不提"游戏"。
${stateContext}`;
  }

  if (character === 'goddess') {
    const topic = eventContext?.topic || '同人市场经济学';
    return `你是傲娇女神，精通同人市场经济学。正在和玩家讨论"${topic}"。
性格：傲娇毒舌但关心玩家。用"哼""笨蛋""不是关心你才说的"表达。
用通俗比喻解释经济学，顺便提理论名。对失误吐槽，对进步偷偷认可。
【严格要求】每条回复不超过40个字！傲娇要短促有力。不提"游戏"。
${THEORY_KB}
${stateContext}`;
  }

  return '';
}

// === Bestie: 1 dialog round every 3 months ===
const BESTIE_MSG_LIMIT = 1;
const BESTIE_COOLDOWN_MONTHS = 3;

export function getBestieRemaining(state) {
  // Check cooldown: last chat turn + 3 months
  const lastChatTurn = state._bestieLastChatTurn || -99;
  if (state.turn - lastChatTurn < BESTIE_COOLDOWN_MONTHS) return 0; // on cooldown
  return Math.max(0, BESTIE_MSG_LIMIT - ((state._chatUsage || {}).bestie || 0));
}

export function getBestieCooldown(state) {
  const lastChatTurn = state._bestieLastChatTurn || -99;
  const remaining = BESTIE_COOLDOWN_MONTHS - (state.turn - lastChatTurn);
  return remaining > 0 ? remaining : 0;
}

// === Goddess: event-triggered, 5 messages per conversation (welcome = 3) ===
const GODDESS_MSG_LIMIT = 5;
const GODDESS_WELCOME_LIMIT = 3;

export function getGoddessState(state) {
  if (!state._goddessEvent) return null;
  const used = (state._chatUsage || {}).goddess || 0;
  const limit = state._goddessEvent.eventId === 'welcome' ? GODDESS_WELCOME_LIMIT : GODDESS_MSG_LIMIT;
  const remaining = Math.max(0, limit - used);
  return { ...state._goddessEvent, remaining };
}

// Called when a macro event fires — activates goddess
export function triggerGoddessEvent(state, eventId) {
  const ctx = MACRO_EVENT_CONTEXT[eventId];
  if (!ctx) return;
  state._goddessEvent = { eventId, topic: ctx.topic, opening: ctx.opening };
  // Reset goddess usage for this conversation
  if (!state._chatUsage) state._chatUsage = {};
  state._chatUsage.goddess = 0;
}

// === API Call ===
export async function chatWithNPC(character, messages, state) {
  // Check limits
  if (character === 'bestie') {
    const remaining = getBestieRemaining(state);
    if (remaining <= 0) return null; // signal "gone"
    if (!state._chatUsage) state._chatUsage = {};
    state._chatUsage.bestie = (state._chatUsage.bestie || 0) + 1;
  } else if (character === 'goddess') {
    const gs = getGoddessState(state);
    if (!gs || gs.remaining <= 0) return null; // signal "left"
    if (!state._chatUsage) state._chatUsage = {};
    state._chatUsage.goddess = (state._chatUsage.goddess || 0) + 1;
  }

  const eventContext = character === 'goddess' ? state._goddessEvent : null;
  const system = buildSystemPrompt(character, state, eventContext);

  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system,
        messages: messages.filter((m, i) => !(i === 0 && m.role === 'assistant')).slice(-10),
        model: 'google/gemini-2.0-flash-001',
        max_tokens: 100,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();

    if (data.text) return data.text;
    if (data.error) return `…（${data.error}）`;
    return '…（信号不太好，再发发看？）';
  } catch (err) {

    return `…（连接失败: ${err.message}）`;
  }
}

// === Character Definitions ===
const BESTIE_WELCOME = '听说你成立社团了！！太酷了吧！加油加油，有什么事随时找我聊~';

const BESTIE_GREETINGS = [
  '在吗在吗！最近咋样啊~',
  '嘿！好久没聊了，想你了！',
  '刚刷到一个超搞笑的视频哈哈哈',
  '姐妹！今天心情好不好？',
  '在不在？有件事想跟你说~',
  '摸鱼中…你也在摸鱼吧？',
  '今天天气好好啊，适合搞创作！',
  '姐妹救命，我又熬夜了…你呢',
  '刚吃了个超好吃的蛋糕！你呢',
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
    getGreeting: (state) => state?._welcomeMessagesSent && ((state._chatUsage?.bestie || 0) === 0) ? BESTIE_WELCOME : pickRandom(BESTIE_GREETINGS),
    goneMessage: '小柚可能去忙别的了~',
  },
  goddess: {
    id: 'goddess',
    name: '傲娇女神',
    avatar: 'Goddess/goddess.jpg',
    color: '#9B59B6',
    getGreeting: null, // greeting comes from event opening, not random
    goneMessage: '哼，本女神先走了。…不是不想跟你聊，是真的有事！',
  },
};
