/**
 * UI Renderer — 同人社团物语 v4 (Phase 2)
 * Market ecosystem panel, pricing UI, diversity indicators
 */

import { ACTIONS, canPerformAction, getActionDisplay, getAchievementInfo, getTimeLabel, getLifeStage, getAge, PARTNER_TYPES } from './engine.js';
import { createChartCanvas, drawSupplyDemand } from './chart.js';
import { getMarketNarratives, getPriceTiers, calculatePricedSales } from './market.js';
import { getOfficialNarratives } from './official.js';
import { getAdvancedNarratives } from './advanced.js';

const $ = (sel) => document.querySelector(sel);
const app = () => $('#app');

// === Title Screen ===
export function renderTitle(onStart) {
  app().innerHTML = `
    <div class="screen title-screen">
      <h1>同人社团物语</h1>
      <p class="subtitle">一个关于热情、声誉与选择的<br/>同人经济学模拟游戏</p>
      <p class="tagline">
        基于真实问卷数据(n=192)构建的经济学模型<br/>
        从高考后的暑假开始，经历大学、工作<br/>
        你的同人创作之路能走多远？
      </p>
      <div style="margin-bottom:20px;width:100%;max-width:320px">
        <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:8px;text-align:center">选择你入坑时的圈子阶段</div>
        <div class="price-selector">
          <div class="price-btn selected" data-preset="early">
            <div class="price-label">🌱 新兴期</div>
            <div class="price-value" style="font-size:0.75rem">1500人</div>
            <div class="price-desc">小而全连接</div>
          </div>
          <div class="price-btn" data-preset="mid">
            <div class="price-label">🌳 成长期</div>
            <div class="price-value" style="font-size:0.75rem">10000人</div>
            <div class="price-desc">活跃发展</div>
          </div>
          <div class="price-btn" data-preset="late">
            <div class="price-label">🏔️ 成熟期</div>
            <div class="price-value" style="font-size:0.75rem">20000人</div>
            <div class="price-desc">竞争激烈</div>
          </div>
        </div>
      </div>
      <button class="btn btn-primary" id="btn-start">开始创作之旅</button>
      <p class="tagline mt-16" style="font-size:0.7rem">
        玩法：每回合选择行动，管理热情·声誉·资金<br/>
        热情归零 = 游戏结束 · 现实会越来越忙
      </p>
    </div>
  `;
  // Preset selection
  let selectedPreset = 'early';
  document.querySelectorAll('.price-btn[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.price-btn[data-preset]').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPreset = btn.dataset.preset;
    });
  });
  $('#btn-start').addEventListener('click', () => onStart(selectedPreset));
}

// === Game Screen ===
export function renderGame(state, onAction) {
  const partnerInfo = state.hasPartner && state.partnerType
    ? (() => {
        const pt = PARTNER_TYPES[state.partnerType];
        return `<span style="font-size:0.75rem;padding:2px 8px;border-radius:10px;background:${state.partnerType === 'toxic' ? '#FDE8E8' : state.partnerType === 'supportive' ? '#E8F8F0' : '#FFF8E8'}">${pt.emoji} ${pt.name} (${state.partnerTurns}月)</span>`;
      })()
    : '';

  // Time debuff display
  const debuffInfo = state.timeDebuffs.length > 0
    ? state.timeDebuffs.filter(d => d.turnsLeft < 900).map(d =>
        `<span style="font-size:0.7rem;padding:2px 6px;border-radius:8px;background:#FDE8E8;color:var(--danger)">⏳ ${d.reason} ${d.turnsLeft}月</span>`
      ).join(' ')
    : '';

  const recessionInfo = state.recessionTurnsLeft > 0
    ? `<span style="font-size:0.7rem;padding:2px 6px;border-radius:8px;background:#FDE8E8;color:var(--danger)">📉 经济下行 ${state.recessionTurnsLeft}月</span>`
    : '';

  const hvpInfo = state.hvpProject
    ? `<span style="font-size:0.7rem;padding:2px 6px;border-radius:8px;background:#E8F0FF;color:#2C3E50">📖 同人本 ${state.hvpProject.progress}/${state.hvpProject.needed}</span>`
    : '';

  const unemployedInfo = state.unemployed
    ? `<span style="font-size:0.7rem;padding:2px 6px;border-radius:8px;background:#FDE8E8;color:var(--danger);font-weight:700">🚨 失业中</span>`
    : '';

  app().innerHTML = `
    <div class="screen">
      <div class="game-header">
        <span class="turn-badge">第 ${state.turn + 1} 回合</span>
        <span class="money-badge" ${state.money < 0 ? 'style="color:var(--danger)"' : ''}>¥${state.money.toLocaleString()}</span>
      </div>

      <div style="padding:0 16px 4px;font-size:0.8rem;color:var(--text-light)">
        ${getTimeLabel(state.turn)}
        ${unemployedInfo} ${hvpInfo} ${partnerInfo} ${debuffInfo} ${recessionInfo}
      </div>

      ${renderStats(state)}

      <div class="game-content">
        ${state.market ? renderMarketPanel(state.market, state.official) : ''}

        <div class="narrative">
          <div class="turn-title">${getNarrativeTitle(state)}</div>
          ${getNarrativeText(state)}
        </div>

        <div class="action-grid">
          ${Object.values(ACTIONS).map(a => renderActionCard(a, state)).join('')}
        </div>
      </div>
    </div>
  `;

  // Bind actions
  document.querySelectorAll('.action-card:not(.disabled)').forEach(el => {
    el.addEventListener('click', () => onAction(el.dataset.action));
  });
  // Market panel toggle
  const toggle = document.getElementById('market-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      toggle.closest('.market-panel').classList.toggle('collapsed');
    });
  }
}

function renderStats(state) {
  const passionPct = Math.max(0, state.passion);
  const repPct = Math.min(100, state.reputation * 10);
  const timePct = Math.min(100, state.time * 10);
  const infoPct = state.infoDisclosure * 100;

  return `
    <div class="stats-panel">
      <div class="stat-row">
        <span class="stat-icon">❤️</span>
        <span class="stat-label">热情</span>
        <div class="stat-bar-wrap">
          <div class="stat-bar passion ${passionPct < 25 ? 'danger' : ''}" style="width:${passionPct}%"></div>
        </div>
        <span class="stat-value">${Math.round(state.passion)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-icon">⭐</span>
        <span class="stat-label">声誉</span>
        <div class="stat-bar-wrap">
          <div class="stat-bar reputation" style="width:${repPct}%"></div>
        </div>
        <span class="stat-value">${state.reputation.toFixed(1)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-icon">⏰</span>
        <span class="stat-label">时间</span>
        <div class="stat-bar-wrap">
          <div class="stat-bar time ${state.time <= 1 ? 'danger' : ''}" style="width:${timePct}%"></div>
        </div>
        <span class="stat-value">${state.time}/10</span>
      </div>
      <div class="stat-row">
        <span class="stat-icon">📢</span>
        <span class="stat-label">信息</span>
        <div class="stat-bar-wrap">
          <div class="stat-bar" style="width:${infoPct}%;background:linear-gradient(90deg,#E6A817,#F5D76E)"></div>
        </div>
        <span class="stat-value">${Math.round(infoPct)}%</span>
      </div>
      ${infoPct > 15 ? `<div style="font-size:0.65rem;color:var(--text-muted);text-align:right;padding-right:4px;margin-top:-4px">每月-10% · ${Math.ceil((infoPct - 8) / 10)}月后回到底线</div>` : ''}
    </div>
  `;
}

function renderMarketPanel(market, official) {
  // IP Heat bar
  const ipHeat = official ? Math.round(official.ipHeat) : 80;
  const ipColor = ipHeat > 60 ? '#E74C3C' : ipHeat > 30 ? 'var(--warning)' : '#888';
  const divPct = Math.round(market.diversityHealth * 100);
  const confPct = Math.round(market.marketConfidence * 100);
  const divColor = divPct > 60 ? 'var(--success)' : divPct > 30 ? 'var(--warning)' : 'var(--danger)';
  const divLabel = divPct > 60 ? '健康' : divPct > 30 ? '脆弱' : '危险';
  const npcFeed = market.npcEvents.length > 0
    ? market.npcEvents.map(e => `<div style="font-size:0.72rem;color:var(--text-light);padding:2px 0">${e}</div>`).join('')
    : '<div style="font-size:0.72rem;color:var(--text-muted)">市场平稳运行中...</div>';

  return `
    <div class="market-panel collapsed">
      <div class="market-header" id="market-toggle">
        <span>🏪 市场生态</span>
        <span style="display:flex;align-items:center;gap:8px">
          <span style="font-size:0.72rem">👥${market.communitySize} HVP:${market.nHVP} LVP:${market.nLVP}</span>
          <span style="font-size:0.72rem;color:${divColor}">${divLabel}</span>
          <span class="market-arrow">▼</span>
        </span>
      </div>
      <div class="market-body">
        <div style="display:flex;justify-content:space-around;padding:8px 0;font-size:0.78rem;text-align:center">
          <div><div style="font-weight:700;font-size:1.1rem">${market.communitySize.toLocaleString()}</div><div style="color:var(--text-muted)">社群人数</div></div>
          <div><div style="font-weight:700;font-size:1.1rem;color:var(--primary)">${market.nHVP}</div><div style="color:var(--text-muted)">HVP创作者</div></div>
          <div><div style="font-weight:700;font-size:1.1rem">${market.nLVP}</div><div style="color:var(--text-muted)">LVP创作者</div></div>
        </div>
        <div class="stat-row" style="margin-top:4px">
          <span class="stat-icon">🌈</span>
          <span class="stat-label">多样</span>
          <div class="stat-bar-wrap">
            <div class="stat-bar" style="width:${divPct}%;background:linear-gradient(90deg,${divColor},${divColor}88)"></div>
          </div>
          <span class="stat-value" style="color:${divColor}">${divPct}%</span>
        </div>
        <div class="stat-row">
          <span class="stat-icon">📊</span>
          <span class="stat-label">信心</span>
          <div class="stat-bar-wrap">
            <div class="stat-bar" style="width:${confPct}%;background:linear-gradient(90deg,#3498DB,#81D4FA)"></div>
          </div>
          <span class="stat-value">${confPct}%</span>
        </div>
        <div class="stat-row">
          <span class="stat-icon">🎬</span>
          <span class="stat-label">IP热</span>
          <div class="stat-bar-wrap">
            <div class="stat-bar" style="width:${ipHeat}%;background:linear-gradient(90deg,${ipColor},${ipColor}88)"></div>
          </div>
          <span class="stat-value">${ipHeat}</span>
        </div>
        ${market.consumerAlpha < 0.9 ? `<div style="font-size:0.72rem;color:var(--danger);padding:4px 0">⚠ 消费者HVP偏好衰减: α=${market.consumerAlpha.toFixed(2)}</div>` : ''}
        ${official && official.secondHandPressure.lvp > 0.1 ? `<div style="font-size:0.72rem;color:var(--warning);padding:2px 0">📦 二手LVP压力: ${Math.round(official.secondHandPressure.lvp * 100)}%</div>` : ''}
        <div style="margin-top:6px;border-top:1px solid var(--border);padding-top:6px">
          ${npcFeed}
        </div>
      </div>
    </div>
  `;
}

function renderActionCard(action, state) {
  const display = getActionDisplay(action.id, state) || action;
  const disabled = !canPerformAction(state, action.id);
  let disableReason = '';
  if (disabled) {
    const r = action.requires;
    if (r.time && state.time < r.time) disableReason = `需闲暇≥${r.time}`;
    else if (r.passion && state.passion < r.passion) disableReason = '热情不足';
  }
  // Highlight if HVP in progress
  const highlight = action.id === 'hvp' && state.hvpProject ? 'border-color:var(--primary);background:#FFF5F5;' : '';

  return `
    <div class="action-card ${disabled ? 'disabled' : ''}" data-action="${action.id}" style="${highlight}">
      <span class="action-emoji">${display.emoji}</span>
      <span class="action-name">${display.name}</span>
      <span class="action-cost">${disabled && disableReason ? disableReason : display.costLabel}</span>
    </div>
  `;
}

// === Result Screen ===
export function renderResult(state, result, onContinue) {
  const tipHtml = result.tip ? `
    <div class="tip-box">
      <div class="tip-label">${result.tip.label}</div>
      <div class="tip-text">${result.tip.text}</div>
    </div>
  ` : '';

  // Only show newly earned achievements
  const prevCount = (state._prevAchievementCount || 0);
  const newAchievements = state.achievements.slice(prevCount);
  state._prevAchievementCount = state.achievements.length;

  const achieveHtml = newAchievements.map(id => {
    const a = getAchievementInfo(id);
    return `<div style="text-align:center;padding:8px;background:#FFF8E8;border-radius:8px;margin-bottom:8px;animation:slideUp 0.4s ease">
      <span style="font-size:1.5rem">${a.emoji}</span>
      <div style="font-weight:700;font-size:0.85rem;margin-top:4px">${a.name}</div>
      <div style="font-size:0.75rem;color:var(--text-light)">${a.desc}</div>
    </div>`;
  }).join('');

  // Chart placeholder
  const chartId = result.supplyDemand ? 'supply-demand-chart' : '';

  app().innerHTML = `
    <div class="screen">
      <div class="game-header">
        <span class="turn-badge">第 ${state.turn} 回合结果</span>
        <span class="money-badge">¥${state.money.toLocaleString()}</span>
      </div>

      ${renderStats(state)}

      <div class="game-content">
        <div class="result-box">
          <h3>${result.actionEmoji} ${result.actionName}</h3>
          ${result.deltas.map(d => `
            <div class="delta-item">
              <span class="delta-icon">${d.icon}</span>
              <span style="flex:1">${d.label}</span>
              <span class="${d.positive ? 'delta-positive' : 'delta-negative'}">${d.value}</span>
            </div>
          `).join('')}
        </div>

        ${result.salesInfo ? renderSalesBreakdown(result.salesInfo) : ''}

        ${chartId ? `<div class="result-box" style="padding:12px">
          <h3 style="font-size:0.85rem;margin-bottom:8px">📊 供需曲线</h3>
          <div id="${chartId}"></div>
          <p style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;text-align:center">
            声誉↑需求曲线右移 · 信息透明度↑转化率提升 · 绿色=你的收入
          </p>
        </div>` : ''}

        ${achieveHtml}
        ${tipHtml}
      </div>

      <div class="bottom-bar">
        <button class="btn btn-primary btn-block" id="btn-continue">继续 →</button>
      </div>
    </div>
  `;

  // Draw chart if applicable
  if (result.supplyDemand) {
    const container = document.getElementById(chartId);
    if (container) {
      const canvas = createChartCanvas();
      container.appendChild(canvas);
      drawSupplyDemand(canvas, result.supplyDemand, true);
    }
  }

  $('#btn-continue').addEventListener('click', onContinue);
  // Collapsible panels in result screen
  document.querySelectorAll('.market-panel .market-header').forEach(h => {
    h.addEventListener('click', () => h.closest('.market-panel').classList.toggle('collapsed'));
  });
}

// === Event Overlay ===
// === Sales Breakdown (educational waterfall) ===
function renderSalesBreakdown(s) {
  // Collapsible panel showing the full causal chain
  const modifiers = [];
  if (s.partnerMult !== 100) modifiers.push({ label: '搭档加成', val: s.partnerMult, icon: '🤝' });
  if (s.shModPct < 95) modifiers.push({ label: '二手冲击', val: s.shModPct, icon: '📦' });
  if (s.advMod !== 100) modifiers.push({ label: '宏观/AI/niche', val: s.advMod, icon: '🌐' });
  if (s.eventBoost > 100) modifiers.push({ label: '同人展加成', val: s.eventBoost, icon: '🎪' });

  const modHtml = modifiers.map(m => {
    const color = m.val >= 100 ? 'var(--success)' : 'var(--danger)';
    return `<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:0.72rem">
      <span>${m.icon} ${m.label}</span><span style="color:${color};font-weight:600">×${(m.val / 100).toFixed(2)}</span>
    </div>`;
  }).join('');

  return `
    <div class="market-panel collapsed" style="margin-bottom:10px">
      <div class="market-header" id="breakdown-toggle">
        <span>🔬 销售因果分析</span>
        <span class="market-arrow">▼</span>
      </div>
      <div class="market-body" style="font-size:0.75rem">
        <div style="padding:6px 0;border-bottom:1px dashed var(--border)">
          <div style="font-weight:700;color:var(--secondary);margin-bottom:4px">第1步：市场总需求 (Translated CES)</div>
          <div style="display:flex;justify-content:space-between"><span>社群 ${s.communitySize.toLocaleString()}人</span><span>承诺消费γ=${s.gamma}+超量m^s=${s.supernumerary}</span></div>
          <div style="display:flex;justify-content:space-between;font-weight:600"><span>→ 市场总需求</span><span>${s.marketDemand}单位</span></div>
        </div>
        <div style="padding:6px 0;border-bottom:1px dashed var(--border)">
          <div style="font-weight:700;color:var(--secondary);margin-bottom:4px">第2步：你的份额 (子层CES)</div>
          <div style="display:flex;justify-content:space-between"><span>你的声誉 θ=${s.playerRep}</span><span>竞争者${s.nCompetitors}人</span></div>
          ${s.alphaMod < 100 ? `<div style="display:flex;justify-content:space-between;color:var(--danger)"><span>消费者偏好衰减α</span><span>${s.alphaMod}%</span></div>` : ''}
          <div style="display:flex;justify-content:space-between;font-weight:600"><span>→ 你的份额</span><span>${s.playerShare}% → ${s.awareness}人关注你</span></div>
        </div>

        <div style="padding:6px 0;border-bottom:1px dashed var(--border)">
          <div style="font-weight:700;color:var(--secondary);margin-bottom:4px">第3步：谁愿意买？(Stigler转化)</div>
          <div style="display:flex;justify-content:space-between"><span>基础转化率</span><span>15%</span></div>
          <div style="display:flex;justify-content:space-between;color:var(--success)"><span>信息透明度加成</span><span>+${s.infoBonus}%</span></div>
          <div style="display:flex;justify-content:space-between;font-weight:700;margin-top:2px"><span>→ 转化率</span><span>${s.conversion}%</span></div>
        </div>

        ${modifiers.length > 0 ? `<div style="padding:6px 0;border-bottom:1px dashed var(--border)">
          <div style="font-weight:700;color:var(--secondary);margin-bottom:4px">第4步：市场环境修正</div>
          ${modHtml}
        </div>` : ''}

        <div style="padding:6px 0;font-size:0.68rem;color:var(--text-muted)">
          随机波动: ×${(s.noise / 100).toFixed(2)} · 最终 = 关注${s.awareness} × 转化${s.conversion}%${modifiers.length > 0 ? ' × 修正' : ''} × 波动
        </div>
      </div>
    </div>
  `;
}

// === Price Selection Screen ===
export function renderPriceSelector(state, productType, onSelect) {
  const basePrice = productType === 'hvp' ? 50 : 15;
  const tiers = getPriceTiers(basePrice, productType);
  const label = productType === 'hvp' ? '同人本' : '谷子';
  const elasticity = productType === 'hvp' ? 1.06 : 0.92;
  const typeLabel = productType === 'hvp' ? '弱奢侈品' : '必需品';

  // Show predicted demand at each price level
  const demandPreviews = tiers.map(t => {
    const priceFactor = Math.pow(t.price / basePrice, -elasticity);
    const relDemand = Math.round(priceFactor * 100);
    const relRevenue = Math.round(priceFactor * t.price / basePrice * 100);
    return { ...t, relDemand, relRevenue };
  });

  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `
    <div class="event-card" style="max-width:360px">
      <div class="event-emoji">${productType === 'hvp' ? '📖' : '🔑'}</div>
      <div class="event-title">${label}定价</div>
      <div class="event-desc" style="margin-bottom:4px">
        弹性 ε = ${elasticity} (${typeLabel})
      </div>
      <div class="price-selector">
        ${demandPreviews.map(t => `
          <div class="price-btn" data-price="${t.price}">
            <div class="price-label">${t.label}</div>
            <div class="price-value">¥${t.price}</div>
            <div class="price-desc">需求${t.relDemand}%<br/>收入${t.relRevenue}%</div>
          </div>
        `).join('')}
      </div>
      <div class="tip-box" style="text-align:left;margin-bottom:0">
        <div class="tip-label">弹性公式: 需求 = 基准 × (价格/基准价)^(-ε)</div>
        <div class="tip-text">${productType === 'hvp'
          ? '同人本ε=1.06 > 1：涨价30%→需求降约33%→收入降低。定价权弱，高价策略有风险。'
          : '谷子ε=0.92 < 1：涨价30%→需求只降约25%→收入反而微增。必需品属性给了一定定价空间。'}</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelectorAll('.price-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.remove();
      onSelect(parseInt(btn.dataset.price));
    });
  });
}

// === Doujin Event Selector ===
export function renderEventSelector(state, onSelect) {
  const events = state.availableEvents || [];
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `
    <div class="event-card" style="max-width:360px">
      <div class="event-emoji">🎪</div>
      <div class="event-title">选择同人展</div>
      <div class="event-desc" style="margin-bottom:12px">本月有${events.length}个同人展可以参加（一个月只能去一个）</div>
      ${events.map((e, i) => `
        <div class="price-btn" data-idx="${i}" style="margin-bottom:8px;text-align:left;padding:12px">
          <div style="font-weight:700">${e.size === 'mega' ? '🌟' : e.size === 'big' ? '🎪' : '📋'} ${e.name}</div>
          <div style="font-size:0.8rem;color:var(--text-light)">📍${e.city} · 路费¥${e.travelCost} · 销量×${e.salesBoost} · 声誉+${e.reputationBoost}</div>
        </div>
      `).join('')}
      <div class="tip-box" style="text-align:left;margin-bottom:0">
        <div class="tip-label">同人展经济学</div>
        <div class="tip-text">大型展会销量倍率高但路费贵（机会成本）。本市小展路费便宜但销量加成低。选择取决于你当前的资金和库存状态。</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.price-btn[data-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.remove();
      onSelect(events[parseInt(btn.dataset.idx)]);
    });
  });
}

export function renderEvent(event, onDismiss) {
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `
    <div class="event-card">
      <div class="event-emoji">${event.emoji}</div>
      <div class="event-title">${event.title}</div>
      <div class="event-desc">${event.desc}</div>
      <div class="event-effect ${event.effectClass}">${event.effect}</div>
      <div class="tip-box" style="text-align:left;margin-bottom:16px">
        <div class="tip-label">经济学原理</div>
        <div class="tip-text">${event.tip}</div>
      </div>
      <button class="btn btn-primary btn-block" id="btn-dismiss-event">了解 →</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#btn-dismiss-event').addEventListener('click', () => {
    overlay.remove();
    onDismiss();
  });
}

// === Game Over ===
export function renderGameOver(state, onRestart) {
  const survived = state.turn;
  const age = getAge(state.turn);
  const stage = getLifeStage(state.turn);
  const title = survived >= 48 ? '传奇落幕' : survived >= 24 ? '旅程结束' : survived >= 12 ? '一段经历' : '遗憾退场';
  const emoji = survived >= 48 ? '🏆' : survived >= 24 ? '📖' : survived >= 12 ? '🌟' : '😢';

  const stageText = stage === 'work' ? '工作后' : stage === 'university' ? '大学期间' : '暑假';

  const shareText = `我在「同人社团物语」中从18岁的暑假开始创作，` +
    `坚持到了${age}岁（${stageText}），` +
    `声誉最高${state.maxReputation.toFixed(1)}，` +
    `制作了${state.totalHVP}本同人志和${state.totalLVP}批谷子。` +
    `你的同人创作之路能走多远？`;

  const achieveHtml = state.achievements
    .filter(id => !id.endsWith('_encounter'))
    .map(id => {
      const a = getAchievementInfo(id);
      return `<span style="display:inline-block;background:#FFF8E8;padding:4px 10px;border-radius:20px;font-size:0.8rem;margin:3px">${a.emoji} ${a.name}</span>`;
    }).join('');

  app().innerHTML = `
    <div class="screen gameover-screen">
      <div class="go-emoji">${emoji}</div>
      <h2>${title}</h2>
      <p class="go-subtitle">${state.gameOverReason}</p>

      <div class="go-stats">
        <div class="go-stat-item"><span>起点</span><span class="go-stat-val">18岁 高考后暑假</span></div>
        <div class="go-stat-item"><span>终点</span><span class="go-stat-val">${age}岁 · ${stageText}</span></div>
        <div class="go-stat-item"><span>坚持月数</span><span class="go-stat-val">${survived} 个月</span></div>
        <div class="go-stat-item"><span>最高声誉</span><span class="go-stat-val">${state.maxReputation.toFixed(1)}</span></div>
        <div class="go-stat-item"><span>同人志</span><span class="go-stat-val">${state.totalHVP} 本</span></div>
        <div class="go-stat-item"><span>谷子</span><span class="go-stat-val">${state.totalLVP} 批</span></div>
        <div class="go-stat-item"><span>总销售额</span><span class="go-stat-val">¥${state.totalRevenue.toLocaleString()}</span></div>
      </div>

      ${achieveHtml ? `<div style="margin-bottom:16px;text-align:center">${achieveHtml}</div>` : ''}

      <div class="share-card">
        <div class="share-text">${shareText}</div>
        <button class="btn btn-secondary btn-block mt-8" id="btn-copy" style="font-size:0.85rem">复制分享文案</button>
      </div>

      <button class="btn btn-primary" id="btn-restart">再来一局</button>

      <p class="tagline mt-16" style="font-size:0.7rem">
        理论基石：Stigler信息搜寻 · Translated CES · 热情预算方程<br/>
        Producer模型 · 多样性条件 · 基于n=192实证数据
      </p>
    </div>
  `;

  $('#btn-restart').addEventListener('click', onRestart);
  $('#btn-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(shareText).then(() => {
      $('#btn-copy').textContent = '已复制！';
      setTimeout(() => { $('#btn-copy').textContent = '复制分享文案'; }, 1500);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = shareText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      $('#btn-copy').textContent = '已复制！';
      setTimeout(() => { $('#btn-copy').textContent = '复制分享文案'; }, 1500);
    });
  });
}

// === Narrative Helpers ===
function getNarrativeTitle(state) {
  return getTimeLabel(state.turn);
}

function getNarrativeText(state) {
  const stage = getLifeStage(state.turn);
  const phrases = [];

  // Life stage milestones
  if (state.turn === 0) {
    return `<p>高考终于结束了！这个暑假，你决定把一直以来的同人创作梦想付诸行动，成立了自己的社团。</p>
    <p style="color:var(--text-muted);font-size:0.8rem;margin-top:8px">提示：暑假时间充裕(${state.time}h/天)，是起步的好时机。注意管理热情值——它会随着时间推移越来越难维持。</p>`;
  }
  if (state.turn === 2) {
    phrases.push('大学开学了！新环境、新朋友，但课程也开始占用时间了。');
  }
  if (state.turn === 14) {
    phrases.push('大二了，课程变多，你开始感受到平衡学业和创作的压力。');
  }
  if (state.turn === 26) {
    phrases.push('大三了...身边的同学开始讨论考研还是找工作。你呢？');
  }
  if (state.turn === 38) {
    phrases.push('大四上学期，秋招、考研，现实的压力越来越大。还能坚持创作吗？');
  }
  if (state.turn === 50) {
    phrases.push('毕业了，正式踏入社会。工作占据了大部分时间，但每个月有了固定收入。同人创作从此成了"业余爱好"...');
  }

  // Time pressure
  if (state.time <= 1) {
    phrases.push('你现在几乎没有任何空闲时间。只能选择休息，等待忙碌的日子过去...');
  } else if (state.time <= 2) {
    phrases.push('时间非常紧张，只够做一些轻量级的事情。');
  }

  // Debuffs
  if (state.timeDebuffs.length > 0) {
    const reasons = state.timeDebuffs.map(d => d.reason).join('、');
    phrases.push(`当前受到"${reasons}"影响，可用时间减少。`);
  }

  // Passion warnings
  if (state.passion < 20) {
    phrases.push('你感到身心俱疲，创作热情即将耗尽...也许该休息一下了。');
  } else if (state.passion < 40) {
    phrases.push('疲惫感在累积，需要注意管理热情值。');
  } else if (state.passion > 85) {
    phrases.push('你充满干劲，灵感源源不断！');
  }

  // Unemployment
  if (state.unemployed) {
    phrases.push(`🚨 你现在失业了（已找工作${state.jobSearchTurns}个月）。可以"找工作"、"休息"或"接稿"维持收入，但同人创作暂时搁置...`);
    if (state.recessionTurnsLeft > 0) phrases.push('经济下行让求职更加困难，成功率大幅降低。');
  }

  // Available doujin events
  if (state.availableEvents && state.availableEvents.length > 0) {
    const evtList = state.availableEvents.map(e =>
      `🎪 <b>${e.name}</b>@${e.city}（路费¥${e.travelCost} 销量×${e.salesBoost}）`
    ).join('<br>');
    phrases.push(`本月有同人展：<br>${evtList}`);
  }
  if (state.attendingEvent) {
    phrases.push(`✨ 上次参展加成生效中：下次售卖销量×${state.attendingEvent.salesBoost}！赶紧制作/售卖。`);
  }

  // HVP project
  if (state.hvpProject) {
    const p = state.hvpProject;
    phrases.push(`📖 同人本创作中(${p.progress}/${p.needed})。继续选择"创作同人本"推进进度，或做其他事情暂停（进度保留）。`);
  }

  // Partner
  if (state.hasPartner && state.partnerType) {
    const pt = PARTNER_TYPES[state.partnerType];
    if (state.partnerType === 'toxic') {
      phrases.push(`${pt.emoji} 有毒搭档还会纠缠你${state.partnerTurns}个月...忍忍吧。`);
    } else {
      phrases.push(`${pt.emoji} ${pt.name}还会陪你${state.partnerTurns}个月。`);
    }
  }

  // Reputation
  if (state.reputation >= 8) phrases.push('你是圈内公认的大手，作品发布就有人翘首以盼。');
  else if (state.reputation >= 5) phrases.push('越来越多人认识你了，社群里经常能看到对你作品的讨论。');
  else if (state.reputation < 0.5) phrases.push('圈子里还没什么人知道你。试试宣发推广，让更多人看到你的作品？');

  // Info disclosure
  if (state.infoDisclosure < 0.15) {
    phrases.push('💡 你的信息透明度很低——潜在买家看不到你的作品质量。先"宣发推广"，然后立刻制作售卖！信息衰减很快。');
  }

  // Market ecosystem
  if (state.market) phrases.push(...getMarketNarratives(state.market));
  // Official IP
  if (state.official) phrases.push(...getOfficialNarratives(state.official));
  // Advanced systems (Phase 4+5)
  if (state.advanced) phrases.push(...getAdvancedNarratives(state.advanced));

  // Recession
  if (state.recessionTurnsLeft > 0) {
    const yrs = (state.recessionTurnsLeft / 12).toFixed(1);
    phrases.push(`📉 经济下行持续中（还有约${yrs}年），销量-30%，成本+20%。寒冬中更需要精打细算。`);
  }

  // Money / Debt
  if (state.money < -2000) {
    phrases.push('💸 严重亏损！焦虑感严重影响创作热情。考虑去"打工"或"接稿"赚点钱吧。');
  } else if (state.money < -500) {
    phrases.push('💸 贴钱做同人的焦虑感在累积...可以试试"普通打工"赚稳定收入，或用创作手艺"接稿赚钱"。');
  } else if (state.money < 0) {
    phrases.push('资金是负数了。虽然还能创作，但亏损焦虑会消耗热情。打工或接稿可以补充资金。');
  } else if (state.money < 300 && stage !== 'work') {
    phrases.push('资金不多了。继续制作可能会亏损——也可以先去打工攒点钱。');
  }

  // Default
  if (phrases.length === 0) {
    const defaults = [
      '新的一个月，这个月打算做什么呢？',
      '每一步选择都在塑造你的同人生涯。',
      '看看手头的状态，做出最适合的选择吧。',
    ];
    phrases.push(defaults[state.turn % defaults.length]);
  }

  return `<p>${phrases.join('</p><p>')}</p>`;
}
