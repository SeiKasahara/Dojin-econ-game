/**
 * 织梦交易 — Doujin Prediction Market (Polymarket-style)
 *
 * Core mechanic: share trading at market price
 * - Each contract has a price ¥5-¥95 per share (implied probability)
 * - Buy YES shares at price P → payout ¥100/share if true, ¥0 if false
 * - Buy NO shares at price (100-P) → payout ¥100/share if false, ¥0 if true
 * - Price fluctuates each month (random walk + drift)
 * - Can sell shares early at current price
 * - Resolution: winning side pays ¥100/share
 */

import { ic } from './icons.js';
import { addMoney } from './engine.js';
import { generatePredictions } from './prediction-contracts.js';

// === Price tick: generate new month's price + daily candles, persisted on contract ===
const DAILY_TICKS_PER_MONTH = 30;
const DAYS_PER_CANDLE = 2;

function tickContractPrice(contract, state) {
  if (!contract.priceHistory) contract.priceHistory = [contract.price];
  if (!contract.candles) contract.candles = [];

  const prevPrice = contract.price;
  // Random walk ± 3-8, with slight drift toward "fair" value
  const noise = (Math.random() - 0.5) * 12;
  const turnsLeft = Math.max(1, contract.resolveTurn - state.turn);
  const driftStrength = Math.min(0.3, 1 / turnsLeft);
  const signal = Math.random() < 0.5 ? contract.price + (Math.random() - 0.4) * 10 : contract.price;
  const drift = (signal - contract.price) * driftStrength;
  contract.price = Math.max(5, Math.min(95, Math.round(contract.price + noise + drift)));
  contract.priceHistory.push(contract.price);

  // Generate daily ticks for this month via Brownian bridge, then persist candles
  const a = prevPrice, b = contract.price;
  const vol = Math.abs(b - a) * 0.4 + 1.5;
  const dailyTicks = [a];
  for (let s = 1; s < DAILY_TICKS_PER_MONTH; s++) {
    const t = s / DAILY_TICKS_PER_MONTH;
    const expected = a + t * (b - a);
    const noiseScale = vol * Math.sqrt(t * (1 - t));
    dailyTicks.push(expected + (Math.random() - 0.5) * 2 * noiseScale);
  }
  dailyTicks.push(b);

  // Group daily ticks into OHLC candles and append
  for (let i = 0; i < dailyTicks.length - 1; i += DAYS_PER_CANDLE) {
    const slice = dailyTicks.slice(i, Math.min(i + DAYS_PER_CANDLE + 1, dailyTicks.length));
    if (slice.length < 2) break;
    contract.candles.push({
      open: slice[0],
      close: slice[slice.length - 1],
      high: Math.max(...slice),
      low: Math.min(...slice),
    });
  }
}

// === Initialize candles for newly created contract (first month) ===
function initContractCandles(contract) {
  contract.candles = [];
  // Generate a few initial candles around the starting price for visual context
  const p = contract.price;
  const vol = 1.5;
  let cur = p;
  for (let i = 0; i < 5; i++) {
    const next = Math.max(5, Math.min(95, cur + (Math.random() - 0.5) * vol * 2));
    contract.candles.push({
      open: cur,
      close: next,
      high: Math.max(cur, next) + Math.random() * vol,
      low: Math.min(cur, next) - Math.random() * vol,
    });
    cur = next;
  }
}

// === Render daily candlestick chart (K-line) ===
// Smart scaling: shows all candles, auto-adjusts width
const MAX_DISPLAY_CANDLES = 30;

function renderPriceChart(contract, width, height) {
  const allCandles = contract.candles || [];
  if (allCandles.length === 0) return '';
  // Show last N candles, scale to fit
  const candles = allCandles.slice(-MAX_DISPLAY_CANDLES);

  const allVals = candles.flatMap(c => [c.high, c.low]);
  const min = Math.min(...allVals) - 2;
  const max = Math.max(...allVals) + 2;
  const range = max - min || 1;
  const toY = v => height - ((v - min) / range) * (height - 6) - 3;

  const candleW = Math.max(3, Math.min(10, (width - 8) / candles.length * 0.7));
  const gap = (width - 8) / candles.length;

  let svg = '';
  // Grid lines
  const mid = (max + min) / 2;
  svg += `<line x1="0" y1="${toY(mid)}" x2="${width}" y2="${toY(mid)}" stroke="#eee" stroke-width="0.5" stroke-dasharray="2,2"/>`;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const x = 4 + i * gap + gap / 2;
    const bullish = c.close >= c.open;
    const color = bullish ? '#27AE60' : '#E74C3C';
    const bodyTop = toY(Math.max(c.open, c.close));
    const bodyBot = toY(Math.min(c.open, c.close));
    const bodyH = Math.max(1, bodyBot - bodyTop);

    // Wick (high-low line)
    svg += `<line x1="${x}" y1="${toY(c.high)}" x2="${x}" y2="${toY(c.low)}" stroke="${color}" stroke-width="1"/>`;
    // Body
    svg += `<rect x="${x - candleW / 2}" y="${bodyTop}" width="${candleW}" height="${bodyH}" fill="${bullish ? color : color}" rx="0.5" opacity="${bullish ? '0.3' : '0.8'}"/>`;
    svg += `<rect x="${x - candleW / 2}" y="${bodyTop}" width="${candleW}" height="${bodyH}" fill="none" stroke="${color}" stroke-width="0.8" rx="0.5"/>`;
  }

  // Current price label (from last candle close)
  const last = candles[candles.length - 1].close;
  const prev = candles.length > 1 ? candles[candles.length - 2].close : last;
  const lastColor = last >= prev ? '#27AE60' : '#E74C3C';
  const lastY = toY(last);
  svg += `<line x1="0" y1="${lastY}" x2="${width}" y2="${lastY}" stroke="${lastColor}" stroke-width="0.5" stroke-dasharray="1,2" opacity="0.6"/>`;
  svg += `<circle cx="${width - 3}" cy="${lastY}" r="2" fill="${lastColor}"/>`;

  return `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:${height}px">${svg}</svg>`;
}

function showToast(parent, msg) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:20%;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:8px 16px;border-radius:10px;font-size:0.78rem;z-index:99999;pointer-events:none;transition:opacity 0.3s';
  el.textContent = msg;
  (parent || document.body).appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; }, 1500);
  setTimeout(() => el.remove(), 1900);
}

function syncMoneyBadge(state) {
  const badge = document.querySelector('.money-badge');
  if (badge) {
    badge.textContent = `¥${state.money.toLocaleString()}`;
    badge.style.color = state.money < 0 ? 'var(--danger)' : '';
  }
}

// === Main render ===
export function openPredictionMarket(state) {
  if (!state._predictions) state._predictions = { contracts: [], holdings: [], resolved: [], totalProfit: 0 };
  const pm = state._predictions;

  // Generate new contracts if pool is thin (keep 3-4 active contracts)
  const activeContracts = pm.contracts.filter(c => state.turn < c.resolveTurn);
  if (activeContracts.length < 3) {
    const newPreds = generatePredictions(state, 3 - activeContracts.length);
    for (const p of newPreds) {
      // Convert odds-based contract to price-based
      const impliedProb = 1 / (p.odds || 2);
      const price = Math.max(5, Math.min(95, Math.round(impliedProb * 100)));
      const newContract = { ...p, price, priceHistory: [price] };
      initContractCandles(newContract);
      pm.contracts.push(newContract);
    }
  }

  // Tick prices for all active contracts (display only, no resolution — settlement happens in endMonth)
  for (const c of pm.contracts) {
    if (state.turn < c.resolveTurn && c._lastTickTurn !== state.turn) {
      tickContractPrice(c, state);
      c._lastTickTurn = state.turn;
    }
  }

  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';

  // Build UI
  const plColor = pm.totalProfit >= 0 ? 'var(--success)' : 'var(--danger)';
  const plSign = pm.totalProfit >= 0 ? '+' : '';

  // Recent settlements (from endMonth, read-only display)
  const recentResolved = (pm.resolved || []).filter(r => r.resolvedAt === state.turn);
  const resolvedHtml = recentResolved.length > 0 ? recentResolved.map(r => `
    <div style="padding:8px;margin-bottom:6px;border-radius:8px;background:${r.won ? '#E8F8F0' : '#FDF0F0'};font-size:0.75rem">
      ${ic(r.won ? 'check-circle' : 'x-circle', '0.8rem')}
      ${(r.question || '').substring(0, 25)}… [${(r.side || '?').toUpperCase()}]
      <span style="font-weight:700;color:${r.won ? 'var(--success)' : 'var(--danger)'}">
        ${r.won ? `+¥${r.payout}` : `-¥${Math.abs(r.profit)}`}
      </span>
    </div>`).join('') : '';

  // Active contracts
  const contractsHtml = pm.contracts.filter(c => state.turn < c.resolveTurn).map((c, i) => {
    const myHoldings = pm.holdings.filter(h => h.contractId === c.id);
    const holdingHtml = myHoldings.length > 0
      ? myHoldings.map(h => {
          const currentVal = h.side === 'yes' ? h.shares * c.price : h.shares * (100 - c.price);
          const pl = currentVal - h.cost;
          return `<div style="font-size:0.65rem;padding:2px 0;color:${pl >= 0 ? 'var(--success)' : 'var(--danger)'}">
            持有 ${h.side.toUpperCase()} ×${h.shares} 成本¥${h.cost} 现值¥${currentVal} (${pl >= 0 ? '+' : ''}${pl})
            <button class="pm-sell" data-hidx="${pm.holdings.indexOf(h)}" style="font-size:0.6rem;padding:1px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg);cursor:pointer;margin-left:4px">卖出</button>
          </div>`;
        }).join('')
      : '';
    const chart = renderPriceChart(c, 160, 36);
    return `
      <div class="pm-contract" data-cidx="${i}" style="padding:10px;margin-bottom:8px;border:1.5px solid var(--border);border-radius:10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:600;font-size:0.78rem;flex:1">${ic(c.icon || 'question', '0.78rem')} ${c.question}</span>
          <span style="font-size:0.6rem;color:var(--text-muted)">${c.resolveTurn - state.turn}月后</span>
        </div>
        <div style="margin:4px 0">${chart}</div>
        <div style="display:flex;gap:6px;align-items:center;font-size:0.75rem">
          <span style="color:var(--success);font-weight:700">YES ¥${c.price}</span>
          <span style="color:var(--text-muted)">·</span>
          <span style="color:var(--danger);font-weight:700">NO ¥${100 - c.price}</span>
          <span style="flex:1"></span>
          <button class="pm-buy" data-cidx="${i}" data-side="yes" style="font-size:0.68rem;padding:3px 10px;border-radius:6px;border:1.5px solid var(--success);background:#E8F8F0;color:var(--success);font-weight:700;cursor:pointer">买YES</button>
          <button class="pm-buy" data-cidx="${i}" data-side="no" style="font-size:0.68rem;padding:3px 10px;border-radius:6px;border:1.5px solid var(--danger);background:#FDF0F0;color:var(--danger);font-weight:700;cursor:pointer">买NO</button>
        </div>
        ${holdingHtml}
      </div>`;
  }).join('');

  // History
  const historyHtml = pm.resolved.length > 0 ? `
    <div class="market-panel collapsed" style="margin-top:8px">
      <div class="market-header"><span>${ic('clock')} 历史记录 (${pm.resolved.length})</span><span class="market-arrow">▼</span></div>
      <div class="market-body" style="max-height:120px;overflow-y:auto;font-size:0.65rem">
        ${pm.resolved.slice().reverse().map(r => `
          <div style="padding:2px 0;color:${r.won ? 'var(--success)' : 'var(--danger)'}">${r.won ? '✓' : '✗'} ${r.question?.substring(0, 22) || '?'}… [${r.side?.toUpperCase() || '?'}] ${r.won ? `+¥${r.payout}` : `-¥${Math.abs(r.profit)}`}</div>
        `).join('')}
      </div>
    </div>` : '';

  overlay.innerHTML = `
    <div class="app-page" style="display:flex;flex-direction:column;max-height:85vh">
      <div class="app-titlebar" style="border-bottom-color:#F39C12;flex-shrink:0">
        <button class="app-back" id="pm-back">${ic('arrow-left')} 返回</button>
        <span class="app-title">${ic('chart-line-up')} 织梦交易</span>
        <span style="font-size:0.7rem;color:${plColor};font-weight:600;min-width:60px;text-align:right">${plSign}¥${pm.totalProfit}</span>
      </div>
      <div style="flex:1;overflow-y:auto;padding:12px">
        ${resolvedHtml}
        ${contractsHtml || '<div style="font-size:0.72rem;color:var(--text-muted);text-align:center;padding:16px">暂无可交易的合约</div>'}
        ${historyHtml}
        <div style="font-size:0.6rem;color:var(--text-muted);text-align:center;padding:10px 0;line-height:1.5">
          ${ic('warning', '0.55rem')} 每份YES+NO=¥100 · 单合约最大赔付¥2,000(20份) · 买入上限资金30%<br>
          到期结算: 正确方每份=¥100 · 错误方=¥0
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  syncMoneyBadge(state);

  // Back
  overlay.querySelector('#pm-back').addEventListener('click', () => { overlay.remove(); syncMoneyBadge(state); });

  // Collapsible panels
  overlay.querySelectorAll('.market-panel .market-header').forEach(h => {
    h.addEventListener('click', () => h.closest('.market-panel').classList.toggle('collapsed'));
  });

  // Buy buttons
  overlay.querySelectorAll('.pm-buy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cidx = parseInt(btn.dataset.cidx);
      const side = btn.dataset.side;
      const contract = pm.contracts.filter(c => state.turn < c.resolveTurn)[cidx];
      if (!contract) return;
      const pricePerShare = side === 'yes' ? contract.price : 100 - contract.price;
      const MAX_PAYOUT = 2000;
      // Allow buying if player can afford at least 1 share (no 30% cap for minimum)
      if (state.money < pricePerShare) {
        showToast(overlay, `资金不足，买1份${side.toUpperCase()}需要¥${pricePerShare}`);
        return;
      }
      const maxSpend = Math.max(pricePerShare, Math.min(2000, Math.floor(state.money * 0.3)));
      const maxByMoney = Math.max(1, Math.floor(maxSpend / pricePerShare));
      const maxByPayout = Math.floor(MAX_PAYOUT / 100);
      const maxShares = Math.min(maxByMoney, maxByPayout);
      const defaultShares = Math.min(5, maxShares);

      // Show buy panel
      const panel = document.createElement('div');
      panel.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center';
      const backdrop = document.createElement('div');
      backdrop.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.45)';
      const card = document.createElement('div');
      card.style.cssText = 'position:relative;background:var(--card-bg,#fff);border-radius:16px;padding:20px;max-width:300px;width:85%;box-shadow:0 8px 32px rgba(0,0,0,0.25)';
      const sideColor = side === 'yes' ? 'var(--success)' : 'var(--danger)';
      card.innerHTML = `
        <div style="font-weight:700;font-size:0.9rem;margin-bottom:4px;color:${sideColor}">买入 ${side.toUpperCase()}</div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px">${contract.question}</div>
        <div style="font-size:0.78rem;margin-bottom:6px">单价 ¥${pricePerShare}/份 · 到期赢得 ¥100/份</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <input type="range" id="pm-shares-slider" min="1" max="${maxShares}" value="${defaultShares}" step="1" style="flex:1;accent-color:#F39C12">
          <span id="pm-shares-label" style="font-weight:700;min-width:30px;text-align:center">${defaultShares}份</span>
        </div>
        <div id="pm-buy-preview" style="font-size:0.72rem;color:var(--text-muted);text-align:center;margin-bottom:10px"></div>
        <div style="display:flex;gap:8px">
          <button id="pm-buy-cancel" style="flex:1;padding:8px;border-radius:10px;border:1px solid var(--border);background:var(--bg);cursor:pointer;font-size:0.8rem">取消</button>
          <button id="pm-buy-ok" style="flex:1;padding:8px;border-radius:10px;border:none;background:#F39C12;color:#fff;font-weight:700;cursor:pointer;font-size:0.8rem">确认买入</button>
        </div>`;
      panel.appendChild(backdrop);
      panel.appendChild(card);
      document.body.appendChild(panel);

      const sl = card.querySelector('#pm-shares-slider');

      function updateBuyPreview() {
        const n = parseInt(sl.value);
        const cost = n * pricePerShare;
        card.querySelector('#pm-shares-label').textContent = `${n}份`;
        card.querySelector('#pm-buy-preview').textContent = `花费 ¥${cost} · 赢 +¥${n * 100} · 输 -¥${cost}`;
      }
      updateBuyPreview();

      sl.addEventListener('input', updateBuyPreview);

      card.querySelector('#pm-buy-cancel').addEventListener('click', () => panel.remove());
      backdrop.addEventListener('click', () => panel.remove());
      card.querySelector('#pm-buy-ok').addEventListener('click', () => {
        const shares = parseInt(sl.value);
        if (!shares || shares < 1) return;
        const cost = shares * pricePerShare;
        if (cost > state.money) { showToast(panel, `资金不足（需¥${cost}，现有¥${state.money}）`); return; }
        addMoney(state, -cost);
        pm.holdings.push({ contractId: contract.id, side, shares, cost, boughtPrice: pricePerShare, boughtTurn: state.turn });
        if (contract._onPlace) contract._onPlace(state);
        panel.remove();
        overlay.remove();
        openPredictionMarket(state);
      });
    });
  });

  // Sell buttons
  overlay.querySelectorAll('.pm-sell').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const hidx = parseInt(btn.dataset.hidx);
      const holding = pm.holdings[hidx];
      if (!holding) return;
      const contract = pm.contracts.find(c => c.id === holding.contractId);
      if (!contract) return;
      const sellPrice = holding.side === 'yes' ? contract.price : 100 - contract.price;
      const revenue = holding.shares * sellPrice;
      const profit = revenue - holding.cost;
      addMoney(state, revenue);
      pm.totalProfit += profit;
      pm.holdings.splice(hidx, 1);
      overlay.remove();
      openPredictionMarket(state);
    });
  });
}
