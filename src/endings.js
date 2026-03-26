/**
 * Ending Generator — 同人社団物語
 * Generates ending text based on player journey
 */

import { getLifeStage, getAge, getCreativeSkill } from './engine.js';

export function generateEnding(state) {
  const stage = getLifeStage(state.turn);
  const rep = state.maxReputation;
  const hvp = state.totalHVP;
  const rev = state.totalRevenue;
  const events = state.eventLog?.length || 0;
  const unemployed = state.unemployed;

  if (unemployed && state.money < -500) {
    return '失业和债务的双重压力让你再也无法提起画笔。同人创作从生活的支柱变成了无法承受的奢侈……但那些作品里倾注的心血，读者不会忘记。';
  }
  if (stage === 'university' && hvp === 0 && state.totalLVP <= 1) {
    return '大学生活的丰富多彩最终让创作计划搁浅了。也许这只是一个"以后再说"的梦想——但谁知道呢，很多传奇创作者都是毕业后才真正开始的。';
  }
  if (rep >= 5 && hvp >= 3) {
    return `从声誉${rep.toFixed(1)}的高峰缓缓走下，你在圈内留下了${hvp}本同人志的印记。虽然热情最终还是燃尽了，但你的作品已经成为了这个圈子历史的一部分。有人会记得你的名字。`;
  }
  if (rev >= 10000 && events >= 5) {
    return `累计¥${rev.toLocaleString()}的销售额和${events}次展会经历，你已经不是"用爱发电"那么简单了。这是一段真正的创业故事——只不过主角最终选择了转身。也许未来某天，你会以不同的身份回到这个圈子。`;
  }
  if (hvp >= 5) {
    return `${hvp}本同人志，每一本都是无数个深夜的结晶。你证明了自己能够持续产出高质量的作品。热情会消退，但创作能力不会——它已经刻进了你的骨子里。`;
  }
  if (events >= 8) {
    return `跑了${events}场展会，从紧张地守着空荡荡的摊位到熟练地招呼来客……展会上认识的人、交换的名片、听到的故事，这些才是最珍贵的收获。同人展的热闹会想你的。`;
  }
  if (state.totalLVP >= 8 && hvp <= 1) {
    return '你是谷子界的多产选手，用小而精的周边温暖了很多人的日常。虽然始终没能跨过同人本的门槛，但这又有什么关系呢？创作的形式不重要，重要的是你表达过。';
  }
  if (stage === 'work' && rep < 1) {
    return '工作和生活的压力逐渐磨灭了你对同人创作的热情。这不是失败——51.2%的创作者都因为"现实太忙"而离开。你只是选择了另一种生活方式。';
  }
  if (state.turn < 12) {
    return '同人创作之路刚刚开始就戛然而止。也许时机不对，也许准备不足——但至少你迈出了第一步。很多人连试都不敢试。';
  }
  if (state.money >= 5000) {
    return '虽然热情燃尽了，但你至少攒下了一笔积蓄。这段创作经历教会你的不只是画画和排版——还有成本控制、市场判断和自我管理。这些能力会跟着你一辈子。';
  }
  return stage === 'work'
    ? '工作的齿轮不会为任何人的梦想停转。你的同人创作之路在现实的重压下缓缓落幕——但每一个曾经熬过的夜晚，都是真实存在过的热爱。'
    : '热情耗尽——用爱发电的电量归零了。但请记住：退坑不等于失败，只是人生的优先级发生了变化。那些作品会替你记住，你曾经为热爱全力以赴过。';
}

export function generateCheatEnding(state) {
  const money = state.money;
  const endings = [
    `你翻开账本，发现数字在自己跳动。¥${money.toLocaleString()}——这个数字从未出现在任何一笔交易记录中。\n\n你看了你的支付通app，皱起眉头："谁动了我的余额？"\n\n闺蜜叹了口气："你是不是干了什么见不得人的事情。"\n\n你突然意识到——在真实世界里，凭空出现的财富比任何bug都刺眼。\n\n世界突然崩塌在此刻，这个宇宙因为一个数字错误崩溃了。`,

    `"等一下。"\n\n你突然停下排版的手，盯着屏幕上的记账本。"我们的资金、库存……这些数字，有的不对劲。"\n\n"什么意思？"\n\n"我是说，这些数字不像是'发生'出来的，更像是被人'放'进去的。就好像……有人直接改了存档。"\n\n空气安静了很久。你望向窗外——那些路人的动作似乎凝固了一瞬。整个世界短暂地闪烁了一下，像是有什么底层逻辑正在被重新校验。\n\n然后你听见了一声轻响——像是第四面墙碎裂的声音。\n\n故事在此处优雅地拒绝继续。`,

    `这天夜里你做了一个奇怪的梦。\n\n梦里你站在一片巨大的世界树前，每片叶子上都写着一个数字——金钱、热情、名誉。你伸手把金钱那片叶子上的数字擦掉，写上了一个更大的数。\n\n树抖了抖，所有叶子哗啦啦响了一下。然后一个声音从树干深处传来：\n\n"这棵树的每片叶子都连着根系。你改了一片叶子，本女神可记得真正的数字，这里不是你该来的地方~！"\n\n你醒来时发现手机屏幕上多了一行字：\n\n「在这个世界，不劳而获违反的不是法律，而是叙事的因果律。此路线已被剪枝。」`,
  ];
  return endings[Math.floor(Math.random() * endings.length)];
}

export function generateCommercialEnding(state) {
  const rep = state.maxReputation;
  const hvp = state.totalHVP;
  const rev = state.totalRevenue;
  const age = getAge(state.turn);
  if (rep >= 8 && hvp >= 8) {
    return `从${age - 18}岁暑假的第一本同人志，到声誉${rep.toFixed(1)}的圈内传说，再到今天签下商业出版合约——你的故事本身就是一部最好的作品。${hvp}本同人志积累的技艺、审美和粉丝，将成为你商业生涯最坚实的基础。同人圈永远欢迎你回来。`;
  }
  if (rev >= 50000) {
    return `累计¥${rev.toLocaleString()}的同人销售额证明了你的商业潜力。出版社看中的不只是你的创作能力，更是你对市场的敏锐嗅觉。从"为爱发电"到"以此为业"，这不是梦想的终结，而是梦想的升级。`;
  }
  return `${hvp}本同人志、无数个深夜的创作、大大小小的展会——这些经历铸就了今天的你。当出版社编辑递来合约时，你知道这不是终点。同人时代教会你的一切——对作品的执着、对读者的理解、对市场的把握——将在商业舞台上绽放更耀眼的光芒。`;
}

export function generateOpenEnding(state) {
  const rep = state.maxReputation;
  const hvp = state.totalHVP;
  const lvp = state.totalLVP;
  const rev = state.totalRevenue;
  const events = state.eventLog?.length || 0;
  const skill = getCreativeSkill(state);

  const journeySummary = hvp >= 8 && rep >= 5
    ? `${hvp}本同人志、声誉${rep.toFixed(1)}——你已经是圈内有分量的名字了。`
    : hvp >= 4
    ? `${hvp}本同人志的积累，让你从青涩的新人成长为了有自己风格的创作者。`
    : lvp >= 10
    ? `你用一批又一批精心制作的谷子，在圈内建立了自己独特的存在感。`
    : events >= 10
    ? `${events}场展会的历练，让你对同人创作这件事有了远超同龄人的理解。`
    : `虽然创作产出不算多，但这些年的经历已经悄然改变了你看待世界的方式。`;

  const futureTease = state.fullTimeDoujin
    ? '全职同人的路走到这里，前方是更大的舞台还是更难的抉择？只有继续走下去才知道。'
    : rep >= 5
    ? '商业出版社的邀约、海外展会的机会、全职创作的可能性……42岁的你，面前的路比18岁时更宽。'
    : rev >= 20000
    ? '同人创作早已不只是"用爱发电"——它教会了你经营、判断和坚持。这些能力，会带你走向更远的地方。'
    : '42岁，你的故事远没有结束。无论同人是主业还是爱好，它已经成为了你生命的一部分。';

  return `从18岁高考后的暑假到现在，二十四年过去了。\n\n${journeySummary}\n\n${futureTease}\n\n故事还在继续——`;
}
