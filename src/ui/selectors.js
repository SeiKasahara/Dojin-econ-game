import { HVP_SUBTYPES, LVP_SUBTYPES, CREATIVE_CHOICES } from '../engine.js';
import { getPriceTiers, getMarketAvgPrice } from '../market.js';
import { ic, escapeHtml } from '../icons.js';
import { fogCreatorCount } from '../market-fog.js';

export function renderPriceSelector(state, productType, onSelect, onCancel) {
  const isHVP = productType === 'hvp';
  // Dynamic market average price based on current market conditions
  const basePrice = state.market ? getMarketAvgPrice(state.market, state, productType) : (isHVP ? 50 : 15);
  const tiers = getPriceTiers(basePrice, productType);
  const label = isHVP ? '同人本' : '谷子';
  const elasticity = isHVP ? 1.06 : 0.92;
  const typeLabel = isHVP ? '弱奢侈品' : '必需品';

  // --- Market intelligence ---
  const cs = state.market?.communitySize || 10000;
  const nComp = isHVP ? (state.market?.nHVP || 9) : (state.market?.nLVP || 55);
  const npcAvgRep = isHVP ? 2.0 : 0.5;
  const totalAlpha = nComp * npcAvgRep + state.reputation;
  const playerShare = totalAlpha > 0 ? state.reputation / totalAlpha : 0.1;
  const baseConv = Math.min(0.95, 0.20 + state.infoDisclosure * 0.50);
  const gamma = isHVP ? 5 : 15;
  const baseDemand = Math.round(gamma * (cs / 1000) * playerShare * baseConv);
  // Production cost context (skill-adjusted)
  const rawUnitCost = isHVP ? 50 : 7;
  const unitCost = Math.round(rawUnitCost * (1 - Math.min(0.2, (state.totalHVP * 3 + state.totalLVP) * 0.005)));
  const recLabel = state.recessionTurnsLeft > 0 ? ' ' + ic('trend-down') + '下行中' : '';
  const refPrice = isHVP ? 50 : 15; // static reference for comparison

  // Demand & profit preview for each tier
  const previews = tiers.map(t => {
    const priceFactor = Math.pow(t.price / basePrice, -elasticity);
    const estDemand = Math.max(1, Math.round(baseDemand * priceFactor));
    const estRevenue = estDemand * t.price;
    const estProfit = estDemand * (t.price - unitCost);
    return { ...t, estDemand, estRevenue, estProfit, priceFactor };
  });

  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `
    <div class="event-card" style="max-width:400px;max-height:85vh;overflow-y:auto;text-align:left">
      <div style="text-align:center;margin-bottom:8px">
        <span style="font-size:1.5rem">${isHVP ? ic('book-open-text') : ic('key')}</span>
        <div style="font-weight:700;font-size:1rem;margin-top:2px">${label}定价</div>
      </div>

      <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px;font-size:0.72rem;padding:8px;background:#F8F9FA;border-radius:8px">
        <div>${ic('users', '0.7rem')} ${cs > 15000 ? '社群很大，潜在买家多' : cs > 8000 ? '社群规模中等' : '社群偏小，买家有限'}</div>
        <div>${ic('storefront', '0.7rem')} ${fogCreatorCount(nComp, productType)}${recLabel}</div>
        <div>${ic('coins', '0.7rem')} 最近别人的摊位上，同类${label}大概卖 ¥${Math.round(basePrice * 0.9)}~¥${Math.round(basePrice * 1.1)} 左右</div>
        <div style="color:var(--text-muted);font-style:italic;margin-top:2px">${isHVP ? '同人本是“想要但不是必须”的东西——定价太高，犹豫的人就不买了' : '谷子对粉丝来说几乎是“必买品”——涨一点价，大多数人还是会买'}</div>
      </div>

      <div style="margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <input type="range" id="price-slider" min="1" max="${isHVP ? 200 : 60}" value="${basePrice}" step="1" style="flex:1;accent-color:var(--primary)">
          <span id="price-value" style="font-weight:700;font-size:1.3rem;min-width:55px;text-align:center">¥${basePrice}</span>
        </div>
        <div id="price-reaction" style="text-align:center;padding:10px;border-radius:10px;background:var(--bg-card);border:1.5px solid var(--border);min-height:60px">
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text-muted);margin-top:3px;padding:0 2px">
          <span>白送</span>
          <span>别人差不多这个价</span>
          <span>天价</span>
        </div>
      </div>

      <div class="tip-box" style="text-align:left;margin-bottom:0">
        <div class="tip-label">定价直觉</div>
        <div class="tip-text">${isHVP
          ? '同人本涨价容易吓跑犹豫的买家——但如果你声誉够高、作品够好，粉丝愿意为品质买单。低价冲量还是高价精品，取决于你对自己作品的信心。'
          : '谷子是粉丝日常消费品，对价格没那么敏感。适当提价通常不会影响太多销量。低价走量和高价少量都行——看你库存够不够。'}</div>
      </div>
      <button class="btn btn-primary btn-block" id="btn-price-confirm" style="margin-top:10px">确认定价 ¥${basePrice}</button>
      <button class="btn btn-block btn-cancel-overlay" style="margin-top:6px;background:var(--bg);border:1px solid var(--border);color:var(--text-light)">返回</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const priceSlider = overlay.querySelector('#price-slider');
  const priceLabel = overlay.querySelector('#price-value');
  const reactionEl = overlay.querySelector('#price-reaction');
  const confirmBtn = overlay.querySelector('#btn-price-confirm');
  let selectedPrice = basePrice;

  function updatePriceReaction() {
    const p = parseInt(priceSlider.value);
    selectedPrice = p;
    priceLabel.textContent = '¥' + p;
    confirmBtn.textContent = '确认定价 ¥' + p;

    const ratio = p / basePrice;
    const pf = Math.pow(Math.max(0.01, ratio), -elasticity);
    const estSales = Math.max(1, Math.round(baseDemand * pf));

    // Inner monologue
    let thought;
    if (p <= 1) thought = '等等我在干什么…这连印刷成本都收不回来啊';
    else if (ratio < 0.3) thought = '虽然每本都在亏钱，但应该能卖很多…吧？';
    else if (ratio < 0.6) thought = '虽然每本赚得少，但卖得多应该能回本…吧？';
    else if (ratio < 0.85) thought = '便宜一点点，应该能多吸引几个犹豫的人';
    else if (ratio <= 1.15) thought = '跟大家差不多的价格，应该不会出什么问题';
    else if (ratio <= 1.5) thought = '有点贵了…但我对这次的作品有信心';
    else if (ratio <= 2.5) thought = '这个价格…除了真爱粉应该没人会买吧';
    else if (ratio <= 5) thought = '我是不是疑了…算了，定都定了';
    else thought = '……我到底在想什么';

    reactionEl.innerHTML = '<div style=\"font-size:0.85rem;font-weight:600;font-style:italic;color:var(--text);line-height:1.5\">「' + thought + '」</div>';
  }
  updatePriceReaction();

  priceSlider.addEventListener('input', updatePriceReaction);
  overlay.querySelector('#btn-price-confirm').addEventListener('click', () => {
    if (selectedPrice == null) return;
    overlay.remove();
    onSelect(selectedPrice);
  });
  overlay.querySelector('.btn-cancel-overlay').addEventListener('click', () => {
    overlay.remove();
    if (onCancel) onCancel();
  });
}

// === Subtype Selector ===
export function renderSubtypeSelector(state, productType, onSelect, onCancel) {
  const isHVP = productType === 'hvp';
  const subtypes = isHVP ? HVP_SUBTYPES : LVP_SUBTYPES;
  const label = isHVP ? '同人本' : '谷子';
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `
    <div class="event-card" style="max-width:380px;text-align:left">
      <div style="text-align:center;margin-bottom:10px">
        <span style="font-size:1.3rem">${isHVP ? ic('book-open-text') : ic('key')}</span>
        <div style="font-weight:700;font-size:1rem">选择${label}类型</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">
        ${Object.values(subtypes).map(s => {
          const locked = isHVP && s.requiredRep > 0 && state.reputation < s.requiredRep;
          const lockLabel = locked ? ` ${ic('lock')} 声誉≥${s.requiredRep}` : '';
          const detail = isHVP
            ? `${s.monthsSolo}月(独)/${s.monthsPartner}月(搭) · ¥${s.costRange[0]}~${s.costRange[1]}`
            : `¥${s.cost} · ${s.batchSize}个/批`;
          return `
          <div class="price-btn subtype-btn" data-subtype="${s.id}" ${locked ? 'data-locked="1"' : ''} style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:${locked ? 'not-allowed' : 'pointer'};${locked ? 'opacity:0.5;' : ''}">
            <span style="font-size:1.3rem">${ic(s.emoji)}</span>
            <div style="flex:1">
              <div style="font-weight:700;font-size:0.85rem">${s.name}${lockLabel}</div>
              <div style="font-size:0.72rem;color:var(--text-light)">${s.desc}</div>
              <div style="font-size:0.65rem;color:var(--text-muted)">${detail}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <button class="btn btn-primary btn-block" id="btn-subtype-confirm" disabled style="opacity:0.5">请选择类型</button>
      <button class="btn btn-block btn-cancel-overlay" style="margin-top:6px;background:var(--bg);border:1px solid var(--border);color:var(--text-light)">返回</button>
    </div>
  `;
  document.body.appendChild(overlay);
  let selected = null;
  overlay.querySelectorAll('.subtype-btn').forEach(btn => {
    if (btn.dataset.locked === '1') return;
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.subtype-btn').forEach(b => { if (b.dataset.locked !== '1') { b.style.border = '1px solid var(--border)'; b.style.background = ''; }});
      btn.style.border = '2px solid var(--primary)';
      btn.style.background = '#F0FAF8';
      selected = btn.dataset.subtype;
      const cfm = overlay.querySelector('#btn-subtype-confirm');
      cfm.disabled = false;
      cfm.style.opacity = '1';
      const name = subtypes[selected]?.name || selected;
      cfm.textContent = `确认: ${name}`;
    });
  });
  overlay.querySelector('#btn-subtype-confirm').addEventListener('click', () => {
    if (!selected) return;
    overlay.remove();
    onSelect(selected);
  });
  overlay.querySelector('.btn-cancel-overlay').addEventListener('click', () => { overlay.remove(); if (onCancel) onCancel(); });
}

// === Random Work Name Generator ===
const _namePartA = [
  '星', '月', '花', '风', '雪', '梦', '光', '影', '夜', '空',
  '海', '云', '雨', '虹', '樱', '蝶', '猫', '鸟', '鹿', '狐',
  '春', '夏', '秋', '冬', '朝', '暮', '黄昏', '黎明', '午后', '深夜',
  '琉璃', '翡翠', '珀', '银', '苍', '绯', '藏蓝', '茖', '墨', '白',
];
const _namePartB = [
  '之歌', '物语', '幻想', '日记', '旅途', '信笺', '碎片', '回响', '轨迹', '余韵',
  '庭院', '街角', '渡口', '窗台', '阁楼', '彼岸', '尽头', '入口', '站台', '长廊',
  '约定', '告白', '秘密', '预言', '独白', '呢喃', '心跳', '叹息', '微笑', '眼泪',
  '奏鸣曲', '协奏曲', '小夜曲', '圆舞曲', '进行曲', '摇篮曲', '狂想曲', '变奏曲', '叙事诗', '安魂曲',
];
const _nameTemplates = [
  (a, b) => a + b,
  (a, b) => a + '与' + _namePartA[Math.floor(Math.random() * _namePartA.length)] + '的' + b,
  (a, b) => '致' + a + '的' + b,
  (a, b) => a + '色' + b,
  (a, b) => '最后的' + a + b,
  (a, b) => a + b + ' Vol.' + (Math.floor(Math.random() * 9) + 1),
  (a, _) => a + '限定',
  (_, b) => '那年' + b,
  (a, _) => a + '不眠夜',
  (a, b) => '在' + a + '的' + b.slice(0, 2),
];
const _usedNames = new Set();
function generateRandomWorkName() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const a = _namePartA[Math.floor(Math.random() * _namePartA.length)];
    const b = _namePartB[Math.floor(Math.random() * _namePartB.length)];
    const tpl = _nameTemplates[Math.floor(Math.random() * _nameTemplates.length)];
    const name = tpl(a, b);
    if (name.length <= 20 && !_usedNames.has(name)) {
      _usedNames.add(name);
      return name;
    }
  }
  // fallback: always unique via counter
  const a = _namePartA[Math.floor(Math.random() * _namePartA.length)];
  const b = _namePartB[Math.floor(Math.random() * _namePartB.length)];
  return a + b;
}

// === Work Naming Input ===
export function renderWorkNameInput(subtypeName, emoji, onConfirm, onCancel) {
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `
    <div class="event-card" style="max-width:340px;text-align:center">
      <div style="font-size:1.3rem;margin-bottom:4px">${ic(emoji, '1.3rem')}</div>
      <div style="font-weight:700;font-size:1rem;margin-bottom:4px">为你的${subtypeName}起个名字</div>
      <div style="font-size:0.78rem;color:var(--text-light);margin-bottom:12px">这个名字会显示在库存和销售记录中</div>
      <div style="display:flex;gap:6px;margin-bottom:12px">
        <input type="text" id="work-name-input" maxlength="20" placeholder="例：星之彼方、夏日限定…"
          style="flex:1;min-width:0;padding:10px 12px;border:2px solid var(--border);border-radius:8px;font-size:0.9rem;text-align:center;outline:none">
        <button id="btn-name-random" style="flex-shrink:0;padding:8px 12px;border:2px solid var(--primary);border-radius:8px;background:var(--bg);color:var(--primary);font-size:0.8rem;font-weight:600;cursor:pointer">${ic('arrows-clockwise', '0.85rem')} 随机</button>
      </div>
      <button class="btn btn-primary btn-block" id="btn-name-confirm" style="margin-bottom:6px">确认</button>
      <button class="btn btn-block" id="btn-name-skip" style="background:var(--bg);border:1px solid var(--border);color:var(--text-muted);font-size:0.78rem">跳过（使用默认名称）</button>
    </div>`;
  document.body.appendChild(overlay);

  const input = overlay.querySelector('#work-name-input');
  setTimeout(() => input.focus(), 50);

  overlay.querySelector('#btn-name-random').addEventListener('click', () => {
    input.value = generateRandomWorkName();
    input.focus();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { overlay.remove(); onConfirm(input.value.trim() || null); }
  });
  overlay.querySelector('#btn-name-confirm').addEventListener('click', () => {
    overlay.remove(); onConfirm(input.value.trim() || null);
  });
  overlay.querySelector('#btn-name-skip').addEventListener('click', () => {
    overlay.remove(); onConfirm(null);
  });
}

// === Creative Choice Overlay (VN-style, no numbers shown) ===
export function renderCreativeChoice(choiceData, onSelect, onCancel) {
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `
    <div class="event-card" style="max-width:360px;text-align:left">
      <div style="text-align:center;margin-bottom:10px">
        <div style="font-weight:700;font-size:1rem">${choiceData.title}</div>
        <div style="font-size:0.8rem;color:var(--text-light)">${choiceData.desc}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
        ${choiceData.options.map(o => `
          <div class="price-btn choice-btn" data-choice="${o.id}" style="display:flex;align-items:center;gap:10px;padding:12px;cursor:pointer">
            <span style="font-size:1.5rem">${ic(o.emoji)}</span>
            <div>
              <div style="font-weight:700;font-size:0.9rem">${o.name}</div>
              <div style="font-size:0.75rem;color:var(--text-light)">${o.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-primary btn-block" id="btn-choice-confirm" disabled style="opacity:0.5">请选择</button>
      ${onCancel ? '<button class="btn btn-block btn-cancel-overlay" style="margin-top:6px;background:var(--bg);border:1px solid var(--border);color:var(--text-light)">返回</button>' : ''}
    </div>
  `;
  document.body.appendChild(overlay);
  let selected = null;
  overlay.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.choice-btn').forEach(b => { b.style.border = '1px solid var(--border)'; b.style.background = ''; });
      btn.style.border = '2px solid var(--primary)';
      btn.style.background = '#F0FAF8';
      selected = btn.dataset.choice;
      const cfm = overlay.querySelector('#btn-choice-confirm');
      cfm.disabled = false;
      cfm.style.opacity = '1';
      cfm.textContent = '确认选择';
    });
  });
  overlay.querySelector('#btn-choice-confirm').addEventListener('click', () => {
    if (!selected) return;
    overlay.remove();
    onSelect(selected);
  });
  overlay.querySelector('.btn-cancel-overlay')?.addEventListener('click', () => {
    overlay.remove();
    if (onCancel) onCancel();
  });
}

// === Anti-Speculator Strategy Selector (frmn.md) ===
export function renderStrategySelector(state, onSelect) {
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';

  const strategies = [
    { id: 'normal', emoji: 'package', name: '普通发售', desc: '按正常流程印刷发售', detail: '不做特殊处理。二手市场自由流通。' },
    { id: 'unlimited', emoji: 'infinity', name: '不限量发售', desc: '承诺持续接受预订再版', detail: '投机客无法预估存量，泡沫项趋近于零。压制二手同人本炒价。' },
    { id: 'signed', emoji: 'pencil', name: 'To签/定制化', desc: '每本附赠买家专属签绘', detail: '大幅降低二手流通价值（个人签名难以转售）。粉丝好感上升声誉+0.1。' },
    { id: 'digital', emoji: 'phone', name: '同步发行电子版', desc: '实体+电子同步发售', detail: '用低成本满足内容消费需求，减少投机买家。额外获得约30%电子版收入。' },
  ];

  overlay.innerHTML = `
    <div class="event-card" style="max-width:380px;text-align:left">
      <div style="text-align:center;margin-bottom:8px">
        <span style="font-size:1.3rem">${ic('shield')}</span>
        <div style="font-weight:700;font-size:1rem">发售策略</div>
        <div style="font-size:0.75rem;color:var(--text-light)">选择如何发售你的同人本（影响二手市场行为）</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">
        ${strategies.map(s => `
          <div class="price-btn strat-btn" data-strat="${s.id}" style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;cursor:pointer">
            <span style="font-size:1.3rem">${ic(s.emoji)}</span>
            <div>
              <div style="font-weight:700;font-size:0.85rem">${s.name}</div>
              <div style="font-size:0.72rem;color:var(--text-light)">${s.desc}</div>
              <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px">${s.detail}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-primary btn-block" id="btn-strat-confirm" disabled style="opacity:0.5">请选择策略</button>
      <div class="tip-box" style="text-align:left;margin-top:8px;margin-bottom:0">
        <div class="tip-label">创作者反制</div>
        <div class="tip-text">投机客的利益建立在稀缺性之上。创作者可以通过干预供给预期(不限量)、降低流通属性(To签)或分离内容效用(电子版)来抑制投机。每种策略有不同的收益与取舍。</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  let selected = null;
  overlay.querySelectorAll('.strat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.strat-btn').forEach(b => { b.style.border = '1px solid var(--border)'; b.style.background = ''; });
      btn.style.border = '2px solid var(--primary)';
      btn.style.background = '#F0FAF8';
      selected = btn.dataset.strat;
      const cfm = overlay.querySelector('#btn-strat-confirm');
      cfm.disabled = false;
      cfm.style.opacity = '1';
      cfm.textContent = '确认发售策略';
    });
  });
  overlay.querySelector('#btn-strat-confirm').addEventListener('click', () => {
    if (!selected) return;
    overlay.remove();
    onSelect(selected);
  });
}

// === Event Mode Selector: 亲参 vs 寄售 ===
export function renderEventModeSelector(state, event, onSelect, onCancel) {
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  const condLabel = event.condition === 'popular' ? ' ' + ic('fire') + '人气爆棚' : '';

  overlay.innerHTML = `
    <div class="event-card" style="max-width:360px;text-align:left">
      <div style="text-align:center;margin-bottom:10px">
        <div style="font-size:1.3rem">${ic('tent')}</div>
        <div style="font-weight:700">${event.name}@${event.city}${condLabel}</div>
        <div style="font-size:0.75rem;color:var(--text-light)">路费¥${event.travelCost} · ${ic('package')}本${state.inventory.hvpStock} 谷${state.inventory.lvpStock}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
        <div class="price-btn mode-btn${(state.time - (state.monthTimeSpent || 0)) < 3 ? ' disabled' : ''}" data-mode="attend" style="padding:12px;cursor:${(state.time - (state.monthTimeSpent || 0)) < 3 ? 'not-allowed' : 'pointer'};${(state.time - (state.monthTimeSpent || 0)) < 3 ? 'opacity:0.5;' : ''}">
          <div style="font-weight:700;font-size:0.9rem">${ic('storefront')} 亲自摆摊</div>
          <div style="font-size:0.72rem;color:var(--text-light);margin-top:2px">进入展会迷你游戏，亲手招揽客人售卖。销量取决于你的操作表现。</div>
          <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px">热情-5 · 闲暇≥3天 · 路费+住宿餐饮+摊位≈¥${event.travelCost + Math.round(event.travelCost * 1.2 + 200)} · 连续参展有疂劳</div>
          ${(state.time - (state.monthTimeSpent || 0)) < 3 ? `<div style="font-size:0.65rem;color:var(--danger);margin-top:2px">${ic('warning')} 闲暇不足（剩余${state.time - (state.monthTimeSpent || 0)}天），无法亲参</div>` : ''}
        </div>
        <div class="price-btn mode-btn" data-mode="consign" style="padding:12px;cursor:pointer">
          <div style="font-weight:700;font-size:0.9rem">${ic('package')} 寄售委托</div>
          <div style="font-size:0.72rem;color:var(--text-light);margin-top:2px">委托朋友或摊主代售，无需亲自到场。销量由市场供需模型决定。</div>
          <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px">热情-2 · 闲暇≥1天 · 邮费¥${Math.round(event.travelCost * 0.3)} · 无参展疂劳</div>
        </div>
      </div>
      <div style="font-size:0.68rem;color:var(--text-muted);text-align:center;margin-bottom:8px;line-height:1.4">${ic('lightbulb')} 不想玩小游戏？选择寄售可跳过，直接按市场模型结算</div>
      <button class="btn btn-primary btn-block" id="btn-mode-confirm" disabled style="opacity:0.5">请选择参展方式</button>
      <button class="btn btn-block btn-cancel-overlay" style="margin-top:6px;background:var(--bg);border:1px solid var(--border);color:var(--text-light)">返回</button>
    </div>
  `;
  document.body.appendChild(overlay);

  let selected = null;
  overlay.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Block attend if not enough time
      if (btn.dataset.mode === 'attend' && (state.time - (state.monthTimeSpent || 0)) < 3) return;
      overlay.querySelectorAll('.mode-btn').forEach(b => { b.style.border = '1px solid var(--border)'; b.style.background = ''; });
      btn.style.border = '2px solid var(--primary)';
      btn.style.background = '#F0FAF8';
      selected = btn.dataset.mode;
      const cfm = overlay.querySelector('#btn-mode-confirm');
      cfm.disabled = false;
      cfm.style.opacity = '1';
      cfm.textContent = selected === 'attend' ? '确认亲参' : '确认寄售';
    });
  });
  overlay.querySelector('#btn-mode-confirm').addEventListener('click', () => {
    if (!selected) return;
    overlay.remove();
    onSelect(selected);
  });
  overlay.querySelector('.btn-cancel-overlay').addEventListener('click', () => {
    overlay.remove();
    if (onCancel) onCancel();
  });
}

// === Doujin Event Selector ===
export function renderEventSelector(state, onSelect, onCancel) {
  const events = state.availableEvents || [];
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `
    <div class="event-card" style="max-width:360px">
      <div class="event-emoji">${ic('tent')}</div>
      <div class="event-title">选择同人展</div>
      <div class="event-desc" style="margin-bottom:8px">本月有${events.length}个同人展可以参加（一个月只能去一个）</div>
      <div style="font-size:0.8rem;padding:6px 10px;background:#F0F7FF;border-radius:6px;margin-bottom:12px">${ic('package')} 当前库存：同人本×${state.inventory.hvpStock} 谷子×${state.inventory.lvpStock}</div>
      ${events.map((e, i) => {
        const attended = (state.eventsAttendedThisMonth || []).includes(e.name);
        return `<div class="price-btn${attended ? ' disabled' : ''}" data-idx="${i}" style="margin-bottom:8px;text-align:left;padding:12px;${attended ? 'opacity:0.4;pointer-events:none;' : ''}">
          <div style="font-weight:700">${e.size === 'mega' ? ic('star-four') : e.size === 'big' ? ic('tent') : ic('note-pencil')} ${e.name}${attended ? ' ✓ 已参加' : ''}</div>
          <div style="font-size:0.8rem;color:var(--text-light)">${ic('map-pin')}${e.city} · 路费¥${e.travelCost} · ${e.salesBoost >= 4 ? '盛况空前' : e.salesBoost >= 2.5 ? '人气旺盛' : e.salesBoost >= 1.5 ? '人流一般' : '比较冷清'}</div>
        </div>`;
      }).join('')}
      <div class="tip-box" style="text-align:left;margin-bottom:0">
        <div class="tip-label">同人展经济学</div>
        <div class="tip-text">大型展会销量倍率高但路费贵（机会成本）。本市小展路费便宜但销量加成低。选择取决于你当前的资金和库存状态。</div>
      </div>
      <button class="btn btn-block btn-cancel-overlay" style="margin-top:12px;background:var(--bg);border:1px solid var(--border);color:var(--text-light)">返回</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.price-btn[data-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.remove();
      onSelect(events[parseInt(btn.dataset.idx)]);
    });
  });
  overlay.querySelector('.btn-cancel-overlay').addEventListener('click', () => {
    overlay.remove();
    if (onCancel) onCancel();
  });
}

// === Reprint Selector: single-select + quantity slider ===
export function renderReprintSelector(state, onSelect, onCancel) {
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';

  const allWorks = (state.inventory.works || []).filter(w => w.qty >= 0);
  const workItems = allWorks.map(w => {
    const sub = w.type === 'hvp' ? (HVP_SUBTYPES[w.subtype] || HVP_SUBTYPES.manga) : (LVP_SUBTYPES[w.subtype] || LVP_SUBTYPES.acrylic);
    const isHVP = w.type === 'hvp';
    const unitCost = isHVP ? 20 : 6;
    const cs = state.market ? state.market.communitySize : 10000;
    const satCoeff = isHVP ? 0.008 : 0.012;
    const soldAge = Math.max(0, state.turn - (w.turn || state.turn));
    const effectiveSold = (w.totalSold || 0) * Math.pow(0.98, soldAge);
    const satCap = Math.max(30, cs * satCoeff);
    const satRatio = effectiveSold / satCap;
    const satLabel = satRatio <= 0.3 ? '<span style="color:var(--success);font-size:0.62rem">市场空间充足</span>'
      : satRatio <= 0.7 ? '<span style="color:#E67E22;font-size:0.62rem">感觉想买的人不多了</span>'
      : '<span style="color:var(--danger);font-size:0.62rem">感觉几乎人手一份了？</span>';
    return `<div class="app-action-card reprint-work" data-work-id="${w.id}" data-unit-cost="${unitCost}" data-is-hvp="${isHVP ? 1 : 0}" style="cursor:pointer">
      <div class="app-action-icon" style="color:${isHVP ? 'var(--primary)' : 'var(--secondary)'}">${ic(sub.emoji, '1.1rem')}</div>
      <div class="app-action-body">
        <div class="app-action-name">${sub.name}${w.name ? '·' + escapeHtml(w.name) : ''}${w.isCultHit ? ' ★' : ''}${w.styleTag ? ` <span style="background:var(--bg);border:1px solid var(--border);padding:0 3px;border-radius:3px;font-size:0.62rem;color:var(--secondary)">${w.styleTag}</span>` : ''}</div>
        <div class="app-action-cost">¥${unitCost}/${isHVP ? '本' : '个'} · 库存${w.qty} · ${satLabel}</div>
      </div>
    </div>`;
  }).join('');

  overlay.innerHTML = `
    <div class="event-card" style="max-width:380px;text-align:left">
      <div style="text-align:center;margin-bottom:8px"><span style="font-size:1.3rem">${ic('printer')}</span></div>
      <div style="text-align:center;font-weight:700;font-size:1rem;margin-bottom:4px">追加印刷</div>
      <div style="text-align:center;font-size:0.8rem;color:var(--text-light);margin-bottom:12px">选择作品，然后选择数量</div>
      <div style="max-height:35vh;overflow-y:auto;margin-bottom:8px">
        ${workItems || '<div style="text-align:center;color:var(--text-muted);padding:12px">没有可追印的作品</div>'}
      </div>
      <div id="reprint-qty-panel" style="display:none;padding:10px;background:var(--bg-card);border-radius:10px;border:2px solid var(--primary);margin-bottom:8px">
        <div id="reprint-qty-title" style="font-weight:600;font-size:0.82rem;margin-bottom:6px"></div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <input type="range" id="reprint-slider" min="10" max="200" value="30" step="5" style="flex:1;accent-color:var(--primary)">
          <span id="reprint-qty-label" style="font-weight:700;font-size:1rem;min-width:40px;text-align:center">30</span>
        </div>
        <div id="reprint-preview" style="font-size:0.72rem;color:var(--text-muted);text-align:center"></div>
      </div>
      <button class="btn btn-primary btn-block" id="reprint-confirm" style="margin-top:8px" disabled>选择要追印的作品</button>
      <button class="btn btn-block btn-cancel-overlay" style="margin-top:6px;background:var(--bg);border:1px solid var(--border);color:var(--text-light)">返回</button>
    </div>
  `;
  document.body.appendChild(overlay);

  // Per-work quantity map: workId -> { qty, unitCost, isHVP, name }
  const qtyMap = new Map();
  let activeWorkId = null;
  const confirmBtn = overlay.querySelector('#reprint-confirm');
  const panel = overlay.querySelector('#reprint-qty-panel');
  const slider = overlay.querySelector('#reprint-slider');
  const qtyLabel = overlay.querySelector('#reprint-qty-label');
  const preview = overlay.querySelector('#reprint-preview');
  const titleEl = overlay.querySelector('#reprint-qty-title');

  function saveActiveToMap() {
    if (activeWorkId != null) {
      const entry = qtyMap.get(activeWorkId);
      if (entry) entry.qty = parseInt(slider.value);
    }
  }

  function updateConfirmBtn() {
    const entries = [...qtyMap.values()].filter(e => e.qty > 0);
    if (entries.length === 0) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = '选择要追印的作品';
      return;
    }
    const totalCost = entries.reduce((s, e) => s + e.qty * e.unitCost, 0);
    const totalItems = entries.reduce((s, e) => s + e.qty, 0);
    const debt = totalCost > state.money ? ' (将欠债)' : '';
    confirmBtn.disabled = false;
    confirmBtn.textContent = `确认追印 ${entries.length}种${totalItems}件 · ¥${totalCost}${debt}`;
  }

  function updateSliderPreview() {
    const entry = qtyMap.get(activeWorkId);
    if (!entry) return;
    const qty = parseInt(slider.value);
    const cost = qty * entry.unitCost;
    qtyLabel.textContent = qty;
    preview.textContent = `${qty}${entry.isHVP ? '本' : '个'} × ¥${entry.unitCost} = ¥${cost}`;
    entry.qty = qty;
    // Update badge on card
    const card = overlay.querySelector(`.reprint-work[data-work-id="${activeWorkId}"]`);
    let badge = card?.querySelector('.reprint-badge');
    if (card && qty > 0) {
      if (!badge) { badge = document.createElement('span'); badge.className = 'reprint-badge'; badge.style.cssText = 'position:absolute;top:-4px;right:-4px;background:var(--primary);color:#fff;font-size:0.6rem;font-weight:700;padding:1px 5px;border-radius:8px'; card.style.position = 'relative'; card.appendChild(badge); }
      badge.textContent = `+${qty}`;
    } else if (badge) { badge.remove(); }
    updateConfirmBtn();
  }

  overlay.querySelectorAll('.reprint-work').forEach(btn => {
    btn.addEventListener('click', () => {
      const wid = parseInt(btn.dataset.workId);
      const unitCost = parseInt(btn.dataset.unitCost);
      const isHVP = btn.dataset.isHvp === '1';
      const name = btn.querySelector('.app-action-name').textContent;

      // Save current slider value before switching
      saveActiveToMap();

      // Init entry if first click
      if (!qtyMap.has(wid)) qtyMap.set(wid, { qty: 30, unitCost, isHVP, name });

      activeWorkId = wid;
      const entry = qtyMap.get(wid);

      // Highlight active (keep selected ones with border too)
      overlay.querySelectorAll('.reprint-work').forEach(b => {
        const bid = parseInt(b.dataset.workId);
        if (bid === wid) { b.style.borderColor = 'var(--primary)'; b.style.background = '#F0FAF8'; }
        else if (qtyMap.has(bid) && qtyMap.get(bid).qty > 0) { b.style.borderColor = 'var(--primary)'; b.style.background = ''; }
        else { b.style.borderColor = 'transparent'; b.style.background = 'var(--bg-card)'; }
      });

      // Load slider from saved qty
      slider.value = entry.qty;
      titleEl.textContent = name;
      panel.style.display = 'block';
      updateSliderPreview();
    });
  });

  slider.addEventListener('input', updateSliderPreview);

  confirmBtn.addEventListener('click', () => {
    saveActiveToMap();
    const orders = [...qtyMap.entries()].filter(([, e]) => e.qty > 0).map(([id, e]) => ({ id, qty: e.qty }));
    if (orders.length === 0) return;
    overlay.remove();
    onSelect(orders);
  });
  overlay.querySelector('.btn-cancel-overlay').addEventListener('click', () => {
    overlay.remove();
    if (onCancel) onCancel();
  });
}

// === Event Works Selector: choose which works to bring to the event ===
export function renderEventWorksSelector(state, eventName, onConfirm, onCancel) {
  const works = (state.inventory?.works || []).filter(w => w.qty > 0);
  if (works.length === 0) { onConfirm([]); return; }
  // Only 1 work: auto-select all of it, skip the picker
  if (works.length === 1) { onConfirm([{ workId: works[0].id, qty: works[0].qty }]); return; }

  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  const rowsHtml = works.map(w => {
    const sub = w.type === 'hvp' ? (HVP_SUBTYPES[w.subtype] || HVP_SUBTYPES.manga) : (LVP_SUBTYPES[w.subtype] || LVP_SUBTYPES.acrylic);
    const age = Math.max(0, state.turn - (w.turn || state.turn));
    const tags = (age <= 0 ? '<span style="background:#27AE60;color:#fff;padding:0 4px;border-radius:3px;font-size:0.58rem;margin-left:3px">新刊</span>' : age <= 2 ? '<span style="background:#F39C12;color:#fff;padding:0 4px;border-radius:3px;font-size:0.58rem;margin-left:3px">近期</span>' : '') + (w.isCultHit ? ' <span style="color:#E91E63;font-size:0.65rem">★Cult</span>' : '');
    const qC = w.workQuality >= 1.3 ? 'var(--success)' : w.workQuality < 0.8 ? 'var(--danger)' : 'var(--text-muted)';
    const nameStr = sub.name + (w.name ? '·' + escapeHtml(w.name) : '');
    return `<div class="ew-row" data-wid="${w.id}" style="display:flex;align-items:center;gap:8px;padding:10px 8px;border-bottom:1px solid var(--border);cursor:pointer">
      <input type="checkbox" class="ew-check" data-wid="${w.id}" checked style="width:18px;height:18px;accent-color:var(--primary);flex-shrink:0">
      <span style="flex-shrink:0">${ic(sub.emoji, '1rem')}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:0.8rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nameStr}${tags}</div>
        <div style="font-size:0.65rem;color:var(--text-muted)">Q<span style="color:${qC}">${(w.workQuality || 1).toFixed(1)}</span> · ¥${w.price} · ${w.type === 'hvp' ? '本' : '谷'}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0;min-width:90px">
        <div style="display:flex;align-items:center;gap:0">
          <button class="ew-minus" data-wid="${w.id}" style="width:32px;height:32px;border:1.5px solid var(--border);border-radius:8px 0 0 8px;background:var(--bg);cursor:pointer;font-size:1rem;font-weight:700;color:var(--text);touch-action:manipulation">\u2212</button>
          <span class="ew-qty-tap" data-wid="${w.id}" data-max="${w.qty}" style="min-width:36px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;border-top:1.5px solid var(--border);border-bottom:1.5px solid var(--border);background:#fff;cursor:pointer;user-select:none">${w.qty}</span>
          <button class="ew-plus" data-wid="${w.id}" style="width:32px;height:32px;border:1.5px solid var(--border);border-radius:0 8px 8px 0;background:var(--bg);cursor:pointer;font-size:1rem;font-weight:700;color:var(--text);touch-action:manipulation">+</button>
        </div>
        <span style="font-size:0.58rem;color:var(--text-muted)">库存 ${w.qty}</span>
      </div></div>`;
  }).join('');
  overlay.innerHTML = `<div class="app-page" style="max-height:80vh;max-width:400px">
    <div class="app-titlebar" style="border-bottom-color:#E84393">
      <button class="app-back" id="ew-back">${ic('arrow-left')} 返回</button>
      <span class="app-title">${ic('package')} 选择参展作品</span><span style="width:60px"></span>
    </div>
    <div style="padding:8px 12px;font-size:0.75rem;color:var(--text-light);text-align:center;border-bottom:1px solid var(--border)">${escapeHtml(eventName)} · 选择要带去展会的作品和数量</div>
    <div class="app-page-body" style="padding:0">
      <div style="display:flex;justify-content:space-between;padding:8px 12px;font-size:0.72rem">
        <button id="ew-all" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:0.72rem">${ic('check-square','0.7rem')} 全选</button>
        <span id="ew-sum" style="color:var(--text-muted)"></span>
        <button id="ew-none" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.72rem">清空</button>
      </div>${rowsHtml}
    </div>
    <div style="padding:10px 12px"><button id="ew-go" class="btn btn-primary btn-block" style="font-size:0.85rem;padding:10px">${ic('tent')} 出发参展</button></div>
  </div>`;
  document.body.appendChild(overlay);
  const sel = {}; works.forEach(w => { sel[w.id] = w.qty; });
  const sync = () => {
    const tot = Object.values(sel).reduce((s,q) => s+q, 0);
    const cnt = Object.values(sel).filter(q => q > 0).length;
    const e = overlay.querySelector('#ew-sum'); if (e) e.textContent = cnt + '种 / ' + tot + '件';
    const b = overlay.querySelector('#ew-go'); if (b) { b.disabled = tot<=0; b.style.opacity = tot>0?'1':'0.4'; }
  };
  const setQ = (wid, q) => {
    const w = works.find(w => w.id === wid); if (!w) return;
    sel[wid] = Math.max(0, Math.min(w.qty, q));
    const span = overlay.querySelector(`.ew-qty-tap[data-wid="${wid}"]`); if (span) span.textContent = sel[wid];
    const ch = overlay.querySelector(`.ew-check[data-wid="${wid}"]`); if (ch) ch.checked = sel[wid] > 0;
    sync();
  };
  overlay.querySelectorAll('.ew-minus').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); setQ(+b.dataset.wid, sel[+b.dataset.wid]-1); }));
  overlay.querySelectorAll('.ew-plus').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); setQ(+b.dataset.wid, sel[+b.dataset.wid]+1); }));
  // Tap the number to type directly (mobile-friendly prompt)
  overlay.querySelectorAll('.ew-qty-tap').forEach(span => {
    span.addEventListener('click', e => {
      e.stopPropagation();
      const wid = +span.dataset.wid;
      const max = +span.dataset.max;
      const val = prompt(`输入携带数量 (0~${max})`, sel[wid]);
      if (val !== null) setQ(wid, parseInt(val) || 0);
    });
  });
  overlay.querySelectorAll('.ew-check').forEach(c => c.addEventListener('change', () => { const w = works.find(w => w.id === +c.dataset.wid); setQ(+c.dataset.wid, c.checked ? w.qty : 0); }));
  overlay.querySelectorAll('.ew-row').forEach(r => r.addEventListener('click', e => {
    if (e.target.closest('.ew-minus') || e.target.closest('.ew-plus') || e.target.classList.contains('ew-check')) return;
    const w = works.find(w => w.id === +r.dataset.wid); setQ(+r.dataset.wid, sel[+r.dataset.wid] > 0 ? 0 : w.qty);
  }));
  overlay.querySelector('#ew-all').addEventListener('click', () => works.forEach(w => setQ(w.id, w.qty)));
  overlay.querySelector('#ew-none').addEventListener('click', () => works.forEach(w => setQ(w.id, 0)));
  overlay.querySelector('#ew-go').addEventListener('click', () => {
    const r = Object.entries(sel).filter(([,q]) => q > 0).map(([id,q]) => ({ workId: +id, qty: q }));
    overlay.remove(); onConfirm(r);
  });
  overlay.querySelector('#ew-back').addEventListener('click', () => { overlay.remove(); if (onCancel) onCancel(); });
  sync();
}
