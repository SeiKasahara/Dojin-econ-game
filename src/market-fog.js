/**
 * Market Fog — 信息模糊化层
 * 将精确的市场数值转换为同人创作者能感知到的模糊信号
 * 教学理念：现实中创作者不会看到精确数字，只能从环境信号推断
 */

import { ic } from './icons.js';

// === 经济下行：隐藏精确月数，改为阶段描述 ===
export function fogRecession(turnsLeft) {
  if (turnsLeft <= 0) return null;
  if (turnsLeft >= 18) return { label: '经济寒冬刚刚开始', icon: 'snowflake', severity: 'severe' };
  if (turnsLeft >= 12) return { label: '经济下行持续中，看不到尽头', icon: 'trend-down', severity: 'severe' };
  if (turnsLeft >= 6)  return { label: '经济低迷，但似乎在筑底', icon: 'minus', severity: 'warning' };
  if (turnsLeft >= 3)  return { label: '市场似乎在慢慢好转', icon: 'trend-up', severity: 'neutral' };
  return { label: '经济回暖的迹象越来越明显', icon: 'sun', severity: 'positive' };
}

// === 潮流：只显示标签，不显示剩余月数 ===
// turnsLeft用于生成模糊热度描述
export function fogTrend(trend) {
  if (!trend) return null;
  const heat = trend.turnsLeft >= 3 ? '正在升温' : trend.turnsLeft >= 2 ? '热度正高' : '似乎要过气了';
  return { tag: trend.tag, heat, strength: trend.strength };
}

// === 消费者偏好α：完全隐藏数值，改为叙事信号 ===
export function fogConsumerAlpha(alpha) {
  if (alpha >= 0.95) return null; // 正常，不显示
  if (alpha >= 0.8) return '最近展会上翻同人本的人好像少了一点…';
  if (alpha >= 0.6) return '同人本的关注度明显在下降，买家更倾向于买谷子了';
  if (alpha >= 0.4) return '很多人已经不记得上一次买同人本是什么时候了…';
  return '同人本？那是什么？——消费者的记忆正在被遗忘吞噬';
}

// === 展会销量倍率：改为模糊描述 + 实际值加噪 ===
export function fogEventBoost(salesBoost, size) {
  // 返回模糊描述（UI用）和加噪后的实际倍率（计算用）
  const noise = 0.8 + Math.random() * 0.4; // ±20%波动
  const actualBoost = Math.round(salesBoost * noise * 10) / 10;
  let label;
  if (salesBoost >= 4.0) label = '盛况空前，人山人海';
  else if (salesBoost >= 2.5) label = '人气旺盛';
  else if (salesBoost >= 1.5) label = '人流一般';
  else label = '比较冷清';
  return { label, actualBoost, icon: salesBoost >= 2.5 ? 'fire' : 'users' };
}

// === 竞争者数量：改为范围区间 ===
export function fogCreatorCount(count, type) {
  const label = type === 'hvp' ? '同人本' : '谷子';
  if (count <= 3)  return `${label}创作者寥寥无几`;
  if (count <= 6)  return `${label}创作者不算多`;
  if (count <= 10) return `${label}创作者有一些`;
  if (count <= 15) return `${label}创作者挺多的`;
  if (count <= 25) return `${label}创作者很多`;
  return `${label}创作者多到数不清`;
}

// 返回模糊范围字符串
export function fogCreatorRange(count) {
  if (count <= 3) return '≤3';
  if (count <= 6) return '3~6';
  if (count <= 10) return '7~10';
  if (count <= 15) return '10~15';
  if (count <= 25) return '15~25';
  return '25+';
}

// === 市场信心：改为情绪词 ===
export function fogConfidence(confidence) {
  if (confidence >= 0.85) return { label: '乐观', color: 'var(--success)', icon: 'smiley' };
  if (confidence >= 0.65) return { label: '平稳', color: 'var(--primary)', icon: 'minus' };
  if (confidence >= 0.45) return { label: '悲观', color: '#E67E22', icon: 'smiley-sad' };
  return { label: '恐慌', color: 'var(--danger)', icon: 'warning' };
}

// === 二手市场压力：改为等级描述 ===
export function fogSecondHand(pressure) {
  if (pressure <= 0.1) return { label: '平静', color: 'var(--success)' };
  if (pressure <= 0.25) return { label: '有些活跃', color: 'var(--primary)' };
  if (pressure <= 0.45) return { label: '竞争明显', color: '#E67E22' };
  return { label: '泛滥成灾', color: 'var(--danger)' };
}
