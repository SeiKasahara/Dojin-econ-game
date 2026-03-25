/**
 * Ending Generator — 同人社団物語
 * Generates ending text based on player journey
 */

import { getLifeStage, getAge } from './engine.js';

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
