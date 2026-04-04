import { ENDOWMENTS, OBSESSIVE_TRAITS, HVP_SUBTYPES, LVP_SUBTYPES } from '../engine.js';
import { ic, escapeHtml } from '../icons.js';
import { fogConfidence, fogTrend, fogConsumerAlpha, fogSecondHand, fogCreatorRange, fogCreatorCount } from '../market-fog.js';
import { buildNarrativeSections } from './shared.js';
import { computeIPPhase } from '../official.js';

export function openMarketApp(state) {
  const market = state.market;
  const official = state.official;

  // === Tab 1: 市场数据 ===
  let marketHtml = '';
  if (market) {
    const ipHeat = official ? Math.round(official.ipHeat) : 80;
    const ipPhase = official ? computeIPPhase(official) : 'peak';
    const ipPhaseNames = { growth: '上升期', peak: '鼎盛期', decline: '衰退期', twilight: '黄昏期', death: '消亡期', revival: '复兴期' };
    const ipPhaseColors = { growth: '#E74C3C', peak: 'var(--primary)', decline: 'var(--warning)', twilight: '#9B59B6', death: '#888', revival: '#E91E63' };
    const ipColor = ipPhaseColors[ipPhase] || '#888';
    const divPct = Math.round(market.diversityHealth * 100);
    const confPct = Math.round(market.marketConfidence * 100);
    const divColor = divPct > 60 ? 'var(--success)' : divPct > 30 ? 'var(--warning)' : 'var(--danger)';
    const divLabel = divPct > 60 ? '健康' : divPct > 30 ? '脆弱' : '危险';
    const npcFeed = market.npcEvents.length > 0
      ? market.npcEvents.map(e => `<div style="font-size:0.75rem;color:var(--text-light);padding:3px 0">${e}</div>`).join('')
      : '<div style="font-size:0.75rem;color:var(--text-muted)">市场平稳运行中...</div>';

    const confFog = fogConfidence(market.marketConfidence);
    const trendFog = fogTrend(market.currentTrend);
    const alphaFog = fogConsumerAlpha(market.consumerAlpha);
    const shLvpFog = official ? fogSecondHand(official.secondHandPressure.lvp) : null;
    const shHvpFog = official ? fogSecondHand(official.secondHandPressure.hvp) : null;

    marketHtml = `
      <div style="display:flex;justify-content:space-around;padding:12px 0;font-size:0.78rem;text-align:center">
        <div><div style="font-weight:700;font-size:1.2rem">${market.communitySize.toLocaleString()}</div><div style="color:var(--text-muted)">社群人数</div></div>
        <div><div style="font-weight:700;font-size:1rem;color:var(--primary)">${fogCreatorRange(market.nHVP)}</div><div style="color:var(--text-muted)">同人本创作者</div></div>
        <div><div style="font-weight:700;font-size:1rem">${fogCreatorRange(market.nLVP)}</div><div style="color:var(--text-muted)">同人谷创作者</div></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;padding:0 4px 12px">
        <div class="stat-row"><span class="stat-icon">${ic('users')}</span><span class="stat-label">多样</span><div class="stat-bar-wrap"><div class="stat-bar" style="width:${divPct}%;background:linear-gradient(90deg,${divColor},${divColor}88)"></div></div><span class="stat-value" style="color:${divColor}">${divLabel}</span></div>
        <div class="stat-row"><span class="stat-icon">${ic(confFog.icon)}</span><span class="stat-label">信心</span><div class="stat-bar-wrap"><div class="stat-bar" style="width:${confPct}%;background:linear-gradient(90deg,${confFog.color},${confFog.color}88)"></div></div><span class="stat-value" style="color:${confFog.color}">${confFog.label}</span></div>
        <div class="stat-row"><span class="stat-icon">${ic('film-strip')}</span><span class="stat-label">IP热</span><div class="stat-bar-wrap"><div class="stat-bar" style="width:${ipHeat}%;background:linear-gradient(90deg,${ipColor},${ipColor}88)"></div></div><span class="stat-value" style="color:${ipColor}">${ipPhaseNames[ipPhase] || '未知'}</span></div>
      </div>
      ${trendFog ? `<div style="font-size:0.78rem;padding:8px 4px;color:var(--primary);font-weight:600;border-top:1px solid var(--border)">${ic('fire')} 热门话题:「${trendFog.tag}」${trendFog.heat}</div>` : ''}
      ${alphaFog ? `<div style="font-size:0.75rem;color:var(--danger);padding:4px">${ic('warning')} ${alphaFog}</div>` : ''}
      ${shLvpFog && official.secondHandPressure.lvp > 0.05 ? `<div style="font-size:0.75rem;color:${shLvpFog.color};padding:4px">${ic('package')} 二手谷子市场: ${shLvpFog.label}</div>` : ''}
      ${shHvpFog && official.secondHandPressure.hvp > 0.05 ? `<div style="font-size:0.75rem;color:${shHvpFog.color};padding:4px">${ic('package')} 二手同人本市场: ${shHvpFog.label}</div>` : ''}
      ${(state.inventory.works || []).filter(w => w.qty > 0).length > 0 ? `
      <div style="margin-top:8px;border-top:1px solid var(--border);padding:8px 4px">
        <div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin-bottom:6px">${ic('tag')} 调整定价</div>
        ${state.inventory.works.filter(w => w.qty > 0).map(w => {
          const sub = w.type === 'hvp' ? (HVP_SUBTYPES[w.subtype] || HVP_SUBTYPES.manga) : (LVP_SUBTYPES[w.subtype] || LVP_SUBTYPES.acrylic);
          const cd = w._lastRepriceTurn != null ? Math.max(0, 6 - (state.turn - w._lastRepriceTurn)) : 0;
          const locked = cd > 0;
          return `<div class="reprice-row" data-work-id="${w.id}" data-is-hvp="${w.type === 'hvp' ? 1 : 0}" data-current="${w.price}" style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px dashed #eee;font-size:0.72rem;cursor:${locked ? 'default' : 'pointer'}">
            <span style="flex-shrink:0">${ic(sub.emoji, '0.7rem')}</span>
            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sub.name}${w.name ? '·' + escapeHtml(w.name) : ''}</span>
            <span style="flex-shrink:0;font-weight:700;color:var(--primary)">¥${w.price}</span>
            ${locked
              ? `<span style="font-size:0.6rem;color:var(--text-muted)">${cd}月后可改</span>`
              : `<span style="font-size:0.6rem;color:var(--secondary)">点击改价</span>`
            }
          </div>`;
        }).join('')}
        <div id="reprice-panel" style="display:none;margin-top:6px;padding:10px;background:var(--bg-card);border:2px solid var(--primary);border-radius:10px">
          <div id="reprice-title" style="font-weight:600;font-size:0.78rem;margin-bottom:6px"></div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <button id="reprice-minus" style="width:30px;height:30px;border:1.5px solid var(--border);border-radius:8px;background:var(--bg);cursor:pointer;font-size:1rem;font-weight:700;color:var(--text);flex-shrink:0;touch-action:manipulation">\u2212</button>
            <input type="range" id="reprice-slider" min="1" max="200" value="50" step="1" style="flex:1;accent-color:var(--primary);touch-action:none">
            <button id="reprice-plus" style="width:30px;height:30px;border:1.5px solid var(--border);border-radius:8px;background:var(--bg);cursor:pointer;font-size:1rem;font-weight:700;color:var(--text);flex-shrink:0;touch-action:manipulation">+</button>
            <span id="reprice-label" style="font-weight:700;font-size:1rem;min-width:45px;text-align:center;cursor:pointer;text-decoration:underline dotted var(--text-muted)" title="点击手动输入价格">¥50</span>
          </div>
          <div id="reprice-hint" style="font-size:0.65rem;color:var(--text-muted);text-align:center;margin-bottom:8px;font-style:italic"></div>
          <button id="reprice-confirm" class="btn btn-primary btn-block" style="font-size:0.8rem;padding:8px">确认改价</button>
        </div>
        <div style="font-size:0.62rem;color:var(--text-muted);margin-top:4px;font-style:italic">${ic('warning', '0.55rem')} 改价后6个月内不可再改——频繁改价是明目张胆的价格歧视，会让买家不信任你。</div>
      </div>` : ''}
      <div style="margin-top:8px;border-top:1px solid var(--border);padding:8px 4px">
        <div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin-bottom:4px">${ic('storefront')} 市场动态</div>
        ${npcFeed}
      </div>
      ${(() => {
        const s = buildNarrativeSections(state);
        const w = s.world;
        const worldSections = [];
        if (w.market.length) worldSections.push(`<div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin-bottom:4px">${ic('storefront')} 同人市场趋势</div>${w.market.map(t => `<div style="font-size:0.75rem;color:var(--text-light);padding:2px 0">${t}</div>`).join('')}`);
        if (w.official.length) worldSections.push(`<div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin-bottom:4px">${ic('film-strip')} IP动态</div>${w.official.map(t => `<div style="font-size:0.75rem;color:var(--text-light);padding:2px 0">${t}</div>`).join('')}`);
        if (w.advanced.length) worldSections.push(`<div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin-bottom:4px">${ic('globe-simple')} 宏观环境</div>${w.advanced.map(t => `<div style="font-size:0.75rem;color:var(--text-light);padding:2px 0">${t}</div>`).join('')}`);
        return worldSections.length > 0 ? `<div style="margin-top:8px;border-top:1px solid var(--border);padding:8px 4px">${worldSections.join('<div style="margin-top:6px"></div>')}</div>` : '';
      })()}`;
  } else {
    marketHtml = '<div style="text-align:center;padding:24px;color:var(--text-muted)">暂无市场数据</div>';
  }

  // === Tab 2: 创作者数据 ===
  const h = state.history || [];
  const el = state.eventLog || [];
  const e = state.endowments || {};
  const totalEvents = el.length;
  const totalEventRev = el.reduce((s, x) => s + x.revenue, 0);
  const avgEventRev = totalEvents > 0 ? Math.round(totalEventRev / totalEvents) : 0;
  const recent = h.slice(-12);
  const maxRev = Math.max(1, ...recent.map(r => r.turnRevenue));
  const revLine = recent.map((r, i) => {
    const x = Math.round(i / Math.max(1, recent.length - 1) * 200);
    const y = Math.round((1 - r.turnRevenue / maxRev) * 50);
    return { x, y, isEvent: r.action === 'attendEvent', rev: r.turnRevenue, turn: r.turn };
  });
  const revPolyline = revLine.map(p => `${p.x},${p.y}`).join(' ');
  const cumMax = Math.max(1, ...recent.map(r => r.cumRevenue));
  const cumLine = recent.map((r, i) => `${Math.round(i / Math.max(1, recent.length - 1) * 200)},${Math.round((1 - r.cumRevenue / cumMax) * 50)}`).join(' ');
  const repRecent = h.slice(-12);
  const repMax = Math.max(1, ...repRecent.map(r => r.reputation));
  const repPoints = repRecent.map((r, i) => `${Math.round(i / Math.max(1, repRecent.length - 1) * 200)},${Math.round((1 - r.reputation / repMax) * 40)}`).join(' ');
  const passRecent = h.slice(-12);
  const passPoints = passRecent.map((r, i) => `${Math.round(i / Math.max(1, passRecent.length - 1) * 200)},${Math.round((1 - r.passion / 100) * 40)}`).join(' ');
  const invMax = Math.max(1, state.inventory.hvpStock, state.inventory.lvpStock, 50);
  const hvpPct = Math.round(state.inventory.hvpStock / invMax * 100);
  const lvpPct = Math.round(state.inventory.lvpStock / invMax * 100);
  const obsKey = state.obsessiveTrait;
  const endowHtml = Object.entries(ENDOWMENTS).map(([k, def]) => {
    const v = e[k] || 0;
    const maxPips = obsKey === k ? 4 : 3;
    const isObs = obsKey === k;
    const dots = Array.from({length: maxPips}, (_, i) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${i < v ? (isObs && i === 3 ? 'var(--danger)' : 'var(--primary)') : '#E0E0E0'};margin:0 1px"></span>`).join('');
    const obsLabel = isObs ? `<span style="font-size:0.58rem;color:var(--danger);margin-left:2px">${OBSESSIVE_TRAITS[k].name}</span>` : '';
    return `<div style="display:flex;align-items:center;gap:6px;font-size:0.75rem"><span>${ic(def.emoji)}</span><span style="width:48px">${def.name}</span>${dots}${obsLabel}</div>`;
  }).join('');
  const recentEvents = el.slice(-5).reverse();
  const eventRows = recentEvents.length > 0
    ? recentEvents.map(ev => `<div style="display:flex;justify-content:space-between;font-size:0.72rem;padding:2px 0"><span>${ev.condition === 'popular' ? ic('fire') : ic('tent')} 第${ev.turn + 1}月 ${ev.name}@${ev.city}</span><span style="color:${ev.revenue > 0 ? 'var(--success)' : 'var(--text-muted)'}">+¥${ev.revenue} (${ev.sold}件)</span></div>`).join('')
    : '<div style="font-size:0.72rem;color:var(--text-muted)">还没有参展记录</div>';

  const dashHtml = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
      <div style="text-align:center;padding:8px;background:#F8F9FA;border-radius:8px"><div style="font-size:1.1rem;font-weight:700;color:var(--primary)">¥${state.totalRevenue.toLocaleString()}</div><div style="font-size:0.65rem;color:var(--text-muted)">累计收入</div></div>
      <div style="text-align:center;padding:8px;background:#F8F9FA;border-radius:8px"><div style="font-size:1.1rem;font-weight:700">${state.totalSales}</div><div style="font-size:0.65rem;color:var(--text-muted)">总销量</div></div>
      <div style="text-align:center;padding:8px;background:#F8F9FA;border-radius:8px"><div style="font-size:1.1rem;font-weight:700">${totalEvents}</div><div style="font-size:0.65rem;color:var(--text-muted)">参展</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div style="text-align:center;padding:8px;background:#F8F9FA;border-radius:8px"><div style="font-size:1rem;font-weight:700">${state.totalHVP}</div><div style="font-size:0.65rem;color:var(--text-muted)">同人志</div></div>
      <div style="text-align:center;padding:8px;background:#F8F9FA;border-radius:8px"><div style="font-size:1rem;font-weight:700">${state.totalLVP}</div><div style="font-size:0.65rem;color:var(--text-muted)">谷子批次</div></div>
    </div>
    <div style="margin-bottom:12px">
      <div style="font-weight:600;font-size:0.8rem;margin-bottom:6px">${ic('package')} 库存 <span style="font-weight:400;color:var(--text-muted)">本×${state.inventory.hvpStock} 谷×${state.inventory.lvpStock}</span></div>
      ${state.inventory.works.filter(w => w.qty > 0).length > 0
        ? state.inventory.works.filter(w => w.qty > 0).map(w => {
            const sub = w.type === 'hvp' ? (HVP_SUBTYPES[w.subtype] || HVP_SUBTYPES.manga) : (LVP_SUBTYPES[w.subtype] || LVP_SUBTYPES.acrylic);
            const qColor = w.workQuality >= 1.3 ? 'var(--success)' : w.workQuality < 0.8 ? 'var(--danger)' : 'var(--text-muted)';
            const wAge = Math.max(0, state.turn - (w.turn || state.turn));
            const noveltyTag = wAge <= 0 ? '<span style="background:#27AE60;color:#fff;padding:0 4px;border-radius:3px;font-size:0.6rem;margin-left:3px">新刊</span>'
              : wAge <= 2 ? '<span style="background:#F39C12;color:#fff;padding:0 4px;border-radius:3px;font-size:0.6rem;margin-left:3px">近期</span>' : '';
            const cs = state.market ? state.market.communitySize : 10000;
            const satCoeff = w.type === 'hvp' ? 0.008 : 0.012;
            const soldAge = Math.max(0, state.turn - (w.turn || state.turn));
            const effectiveSold = (w.totalSold || 0) * Math.pow(0.98, soldAge);
            const satCap = Math.max(30, cs * satCoeff);
            const satRatio = effectiveSold / satCap;
            const satTag = satRatio > 0.7 ? '<span style="color:var(--danger);font-size:0.58rem;margin-left:2px">买过的人很多了</span>'
              : satRatio > 0.3 ? '<span style="color:#E67E22;font-size:0.58rem;margin-left:2px">开始有人买过了</span>' : '';
            const styleTag = w.styleTag ? `<span style="background:var(--bg);border:1px solid var(--border);padding:0 3px;border-radius:3px;font-size:0.58rem;margin-left:2px;color:var(--secondary)">${w.styleTag}</span>` : '';
            return `<div style="display:flex;align-items:center;gap:6px;font-size:0.72rem;padding:4px 0;border-bottom:1px dashed #eee">
              <span style="flex-shrink:0">${ic(sub.emoji)}</span>
              <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sub.name}${w.name ? '·' + escapeHtml(w.name) : ''}${w.isCultHit ? ' ★' : ''}${styleTag}${noveltyTag}${satTag}</span>
              <span style="color:${qColor};flex-shrink:0">Q${(w.workQuality || 1).toFixed(1)}</span>
              <span style="flex-shrink:0;font-weight:600">×${w.qty}</span>
              <span style="flex-shrink:0;color:var(--primary)">¥${w.price}</span>
            </div>`;
          }).join('')
        : '<div style="font-size:0.72rem;color:var(--text-muted);padding:4px 0">暂无库存</div>'
      }
    </div>
    ${recent.length > 1 ? `<div style="margin-bottom:12px"><div style="font-weight:600;font-size:0.8rem;margin-bottom:4px">${ic('coins')} 近${recent.length}月收入</div><div style="display:flex;gap:12px;font-size:0.65rem;color:var(--text-muted);margin-bottom:2px"><span style="color:var(--primary)">● 月收入</span><span style="color:#F39C12">● 累计</span></div><svg viewBox="-10 -8 220 68" style="width:100%;height:65px"><polyline points="${cumLine}" fill="none" stroke="#F39C12" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.6"/><polyline points="${revPolyline}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linejoin="round"/>${revLine.map(p => p.isEvent ? `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="var(--primary)" stroke="#fff" stroke-width="1"/>` : `<circle cx="${p.x}" cy="${p.y}" r="2" fill="#81D4FA"/>`).join('')}</svg></div>` : ''}
    ${repRecent.length > 1 ? `<div style="margin-bottom:12px"><div style="font-weight:600;font-size:0.8rem;margin-bottom:4px">${ic('star')} 声誉趋势 <span style="font-weight:400;color:var(--text-muted)">(${state.reputation.toFixed(1)})</span></div><svg viewBox="-5 -5 210 50" style="width:100%;height:50px"><polyline points="${repPoints}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linejoin="round"/></svg></div>` : ''}
    ${passRecent.length > 1 ? `<div style="margin-bottom:12px"><div style="font-weight:600;font-size:0.8rem;margin-bottom:4px">${ic('heart')} 热情趋势 <span style="font-weight:400;color:var(--text-muted)">(${Math.round(state.passion)})</span></div><svg viewBox="-5 -5 210 50" style="width:100%;height:50px"><polyline points="${passPoints}" fill="none" stroke="#E74C3C" stroke-width="2" stroke-linejoin="round"/></svg></div>` : ''}
    <div style="margin-bottom:12px"><div style="font-weight:600;font-size:0.8rem;margin-bottom:4px">${ic('tent')} 参展记录 ${totalEvents > 0 ? `<span style="font-weight:400;color:var(--text-muted)">场均¥${avgEventRev}</span>` : ''}</div>${eventRows}</div>
    <div><div style="font-weight:600;font-size:0.8rem;margin-bottom:4px">${ic('palette')} 禀赋</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">${endowHtml}</div></div>`;

  // === Build overlay with tabs ===
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `
    <div class="app-page" style="max-height:85vh">
      <div class="app-titlebar" style="border-bottom:none;padding-bottom:0">
        <button class="app-back" id="market-back">${ic('arrow-left')} 返回</button>
        <span class="app-title">${ic('chart-bar')} 同人市场观察</span>
        <span style="width:60px"></span>
      </div>
      <div class="sns-header" style="padding-top:0">
        <div class="sns-tabs">
          <div class="sns-tab active" data-tab="market">${ic('storefront')} 市场数据</div>
          <div class="sns-tab" data-tab="creator">${ic('user')} 创作者数据</div>
        </div>
      </div>
      <div class="app-page-body">
        <div id="mkt-tab-market">${marketHtml}</div>
        <div id="mkt-tab-creator" style="display:none">${dashHtml}</div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#market-back').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) overlay.remove(); });
  // Reprice: click row → show slider panel → confirm to apply
  let activeRepriceWid = null;
  const repricePanel = overlay.querySelector('#reprice-panel');
  const repriceSlider = overlay.querySelector('#reprice-slider');
  const repriceLabel = overlay.querySelector('#reprice-label');
  const repriceHint = overlay.querySelector('#reprice-hint');
  const repriceTitle = overlay.querySelector('#reprice-title');
  const repriceConfirm = overlay.querySelector('#reprice-confirm');

  overlay.querySelectorAll('.reprice-row').forEach(row => {
    const cd = (() => { const w = (state.inventory.works || []).find(w => w.id === parseInt(row.dataset.workId)); return w?._lastRepriceTurn != null ? Math.max(0, 6 - (state.turn - w._lastRepriceTurn)) : 0; })();
    if (cd > 0) return; // locked, no click handler
    row.addEventListener('click', () => {
      const wid = parseInt(row.dataset.workId);
      const isHVP = row.dataset.isHvp === '1';
      const cur = parseInt(row.dataset.current);
      activeRepriceWid = wid;
      repriceSlider.min = 1;
      repriceSlider.max = isHVP ? 200 : 60;
      repriceSlider.value = cur;
      repriceLabel.textContent = '¥' + cur;
      repriceTitle.textContent = row.querySelector('span:nth-child(2)').textContent;
      repriceHint.textContent = cur === parseInt(repriceSlider.value) ? '拖动滑块调整价格' : '';
      if (repricePanel) {
        repricePanel.style.display = 'block';
        setTimeout(() => repricePanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
      }
      // Highlight active row
      overlay.querySelectorAll('.reprice-row').forEach(r => r.style.background = '');
      row.style.background = '#F0FAF8';
    });
  });

  function syncRepriceDisplay() {
    const p = parseInt(repriceSlider.value);
    repriceLabel.textContent = '¥' + p;
    const work = (state.inventory.works || []).find(w => w.id === activeRepriceWid);
    if (work) {
      const diff = p - work.price;
      repriceHint.textContent = diff === 0 ? '价格未变' : diff > 0 ? `涨价 +¥${diff}` : `降价 ¥${diff}`;
    }
  }
  if (repriceSlider) {
    repriceSlider.addEventListener('input', syncRepriceDisplay);
  }
  // +/- buttons for fine-grained price adjustment (especially useful when slider is at extremes)
  const repriceMinus = overlay.querySelector('#reprice-minus');
  const repricePlus = overlay.querySelector('#reprice-plus');
  if (repriceMinus) {
    repriceMinus.addEventListener('click', (e) => {
      e.stopPropagation();
      const v = parseInt(repriceSlider.value);
      if (v > parseInt(repriceSlider.min)) { repriceSlider.value = v - 1; syncRepriceDisplay(); }
    });
  }
  if (repricePlus) {
    repricePlus.addEventListener('click', (e) => {
      e.stopPropagation();
      const v = parseInt(repriceSlider.value);
      if (v < parseInt(repriceSlider.max)) { repriceSlider.value = v + 1; syncRepriceDisplay(); }
    });
  }
  // Tap price label to enter custom value directly
  if (repriceLabel) {
    repriceLabel.addEventListener('click', () => {
      if (activeRepriceWid == null) return;
      const max = parseInt(repriceSlider.max);
      const input = prompt(`输入新价格 (1~${max}):`, repriceSlider.value);
      if (input != null) {
        const v = parseInt(input);
        if (!isNaN(v) && v >= 1 && v <= max) { repriceSlider.value = v; syncRepriceDisplay(); }
      }
    });
  }

  if (repriceConfirm) {
    repriceConfirm.addEventListener('click', () => {
      if (activeRepriceWid == null) return;
      const newPrice = parseInt(repriceSlider.value);
      const work = (state.inventory.works || []).find(w => w.id === activeRepriceWid);
      if (work && work.price !== newPrice) {
        work.price = newPrice;
        work._lastRepriceTurn = state.turn;
        // Update row display
        const row = overlay.querySelector(`.reprice-row[data-work-id="${activeRepriceWid}"]`);
        if (row) {
          row.querySelector('span:nth-child(3)').textContent = '¥' + newPrice;
          row.querySelector('span:nth-child(4)').textContent = '6月后可改';
          row.style.cursor = 'default';
          row.style.background = '';
          row.replaceWith(row.cloneNode(true)); // remove click listener
        }
      }
      if (repricePanel) repricePanel.style.display = 'none';
      activeRepriceWid = null;
    });
  }
  overlay.querySelectorAll('.sns-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      overlay.querySelectorAll('.sns-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      overlay.querySelector('#mkt-tab-market').style.display = tab.dataset.tab === 'market' ? '' : 'none';
      overlay.querySelector('#mkt-tab-creator').style.display = tab.dataset.tab === 'creator' ? '' : 'none';
    });
  });
}
