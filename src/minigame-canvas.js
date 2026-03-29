/**
 * Doujin Event Mini-Game — Canvas Rendering
 * Pixel sprite booth scene with customers, HUD, and action buttons
 */

import { ic } from './icons.js';

const DPR = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
const CW = 480, CH = 300;

// Emoji cache for performance (used for thought bubbles, particles, etc.)
const emojiCache = new Map();
function getEmojiImage(emoji, size = 20) {
  const key = `${emoji}_${size}`;
  if (emojiCache.has(key)) return emojiCache.get(key);
  const c = document.createElement('canvas');
  c.width = size * DPR * 1.2;
  c.height = size * DPR * 1.2;
  const cx = c.getContext('2d');
  cx.font = `${size * DPR}px sans-serif`;
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillText(emoji, c.width / 2, c.height / 2);
  emojiCache.set(key, c);
  return c;
}

// === Pixel sprite system ===
const SPRITE_COUNT = 12;
const NEIGHBOR_COUNT = 5;
const spriteImages = {}; // { key: HTMLImageElement }
let spritesLoaded = false;

export function preloadSprites() {
  if (spritesLoaded) return Promise.resolve();
  const promises = [];

  function load(key, src) {
    const img = new Image();
    img.src = src;
    promises.push(new Promise(resolve => {
      img.onload = () => { spriteImages[key] = img; resolve(); };
      img.onerror = resolve;
    }));
  }

  // Customer sprites
  for (let i = 1; i <= SPRITE_COUNT; i++) load(`c${i}`, `customers/${i}.png`);
  // Player sprite
  load('player', 'player/player.png');
  // Neighbor sprites
  for (let i = 1; i <= NEIGHBOR_COUNT; i++) load(`n${i}`, `player/neighbor${i}.png`);
  // Backgrounds & booth
  load('bg1', 'minigame-background/bg.png');
  load('bg2', 'minigame-background/bg2.png');
  load('desk', 'minigame-background/desk.png');
  // Settlement screens
  load('jiesuan', 'jiesuan/jiesuan.webp');
  load('jiesuan2', 'jiesuan/jiesuan2.webp');

  return Promise.all(promises).then(() => { spritesLoaded = true; });
}

function drawSprite(ctx, key, x, y, size) {
  const img = spriteImages[key];
  if (!img) { drawEmoji(ctx, '👤', x, y, size); return; } // fallback
  // Keep original aspect ratio, scale by height = size
  const aspect = img.naturalWidth / img.naturalHeight;
  const h = size;
  const w = size * aspect;
  ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
}

// === Mount Mini-Game UI ===
export function renderMinigame(mg, actions, onAction, onSkip, onNeighborChat) {
  const app = document.getElementById('app');

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = CW * DPR;
  canvas.height = CH * DPR;
  canvas.style.width = '100%';
  canvas.style.maxWidth = CW + 'px';
  canvas.style.height = 'auto';
  canvas.style.display = 'block';
  canvas.style.margin = '0 auto';
  canvas.style.borderRadius = '12px';
  canvas.style.touchAction = 'manipulation';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // Build container
  const container = document.createElement('div');
  container.className = 'screen';
  container.style.background = 'var(--bg)';
  container.innerHTML = `
    <div style="padding:8px 16px 4px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-weight:700;font-size:0.9rem">${ic('tent')} ${mg.event.name}@${mg.event.city}</span>
      <span style="display:flex;gap:4px">
        <button class="btn btn-secondary mg-pause" style="padding:4px 10px;font-size:0.75rem;min-height:32px">${ic('pause')}</button>
        <button class="btn btn-secondary mg-skip" style="padding:4px 10px;font-size:0.75rem;min-height:32px">跳过</button>
      </span>
    </div>
    <div style="padding:0 16px" id="mg-canvas-wrap"></div>
    <div style="padding:4px 16px;display:flex;gap:6px;justify-content:space-between;font-size:0.72rem;color:var(--text-light)">
      <span id="mg-energy">${ic('lightning')} 精力 100</span>
      <span id="mg-sold">${ic('coins')} 售出 0</span>
      <span id="mg-time">${ic('timer')} 60s</span>
    </div>
    <div id="mg-stock" style="padding:2px 16px;display:flex;flex-wrap:wrap;gap:4px 10px;font-size:0.68rem;color:var(--text-light)">
      ${mg.worksStock.map((w, i) => `<span id="mg-stock-${i}" style="white-space:nowrap">${ic(w.icon, '0.7rem')} ${w.displayName} ×<b>${w.qty}</b></span>`).join('')}
    </div>
    <div class="mg-actions" id="mg-actions">
      ${Object.values(actions).map(a => `
        <button class="mg-action-btn" data-action="${a.id}">
          <span style="font-size:1.2rem">${ic(a.icon || a.emoji, '1.2rem')}</span>
          <span style="font-size:0.75rem;font-weight:600">${a.name}</span>
          <div class="mg-cd-bar" id="mg-cd-${a.id}"></div>
        </button>
      `).join('')}
    </div>
    <div id="mg-neighbor-chat" style="display:none;padding:4px 16px">
      <button class="btn btn-accent btn-block mg-chat-btn" style="padding:8px;font-size:0.82rem">${ic('chat-circle')} 和隔壁摊主聊天（热情+3）</button>
    </div>
  `;

  document.getElementById('mg-canvas-wrap')?.remove; // just in case
  app.innerHTML = '';
  app.appendChild(container);
  container.querySelector('#mg-canvas-wrap').appendChild(canvas);

  // Bind action buttons
  container.querySelectorAll('.mg-action-btn').forEach(btn => {
    btn.addEventListener('click', () => onAction(btn.dataset.action));
  });

  // Skip button — with confirmation
  container.querySelector('.mg-skip').addEventListener('click', () => {
    mg.phase = 'paused';
    const overlay = document.createElement('div');
    overlay.className = 'event-overlay';
    overlay.innerHTML = `
      <div class="event-card" style="max-width:320px;text-align:center">
        <div style="font-size:1.5rem;margin-bottom:8px">${ic('warning', '1.5rem')}</div>
        <div style="font-weight:700;margin-bottom:8px">确定跳过小游戏？</div>
        <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:16px;line-height:1.5">
          跳过后将按当前已售出 <b>${mg.score.sold}件</b> 的成绩结算。<br/>剩余时间的销售机会将全部放弃。
        </div>
        <button class="btn btn-block" id="mg-skip-confirm" style="background:#FFF0F0;border:1px solid var(--danger);color:var(--danger);margin-bottom:8px">确认跳过</button>
        <button class="btn btn-block" id="mg-skip-cancel" style="background:var(--bg);border:1px solid var(--border);color:var(--text-light)">继续摆摊</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#mg-skip-cancel').addEventListener('click', () => {
      overlay.remove();
      mg.phase = 'playing';
      mg.lastTimestamp = performance.now();
    });
    overlay.querySelector('#mg-skip-confirm').addEventListener('click', () => {
      overlay.remove();
      onSkip();
    });
  });

  // Pause button
  container.querySelector('.mg-pause').addEventListener('click', () => {
    if (mg.phase === 'playing') {
      mg.phase = 'paused';
      container.querySelector('.mg-pause').innerHTML = ic('play');
      // Show pause overlay on canvas
      const pDiv = document.createElement('div');
      pDiv.id = 'mg-pause-overlay';
      pDiv.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.5);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;border-radius:12px;z-index:10';
      pDiv.innerHTML = `
        <div style="color:#fff;font-size:1.2rem;font-weight:700">${ic('pause')} 暂停中</div>
        <button class="btn btn-primary" id="mg-resume" style="padding:8px 24px">继续</button>
        <button class="btn btn-secondary" id="mg-restart" style="padding:6px 20px;font-size:0.8rem">重新开始</button>
      `;
      const wrap = container.querySelector('#mg-canvas-wrap');
      wrap.style.position = 'relative';
      wrap.appendChild(pDiv);
      pDiv.querySelector('#mg-resume').addEventListener('click', () => {
        mg.phase = 'playing';
        mg.lastTimestamp = performance.now();
        container.querySelector('.mg-pause').innerHTML = ic('pause');
        pDiv.remove();
      });
      pDiv.querySelector('#mg-restart').addEventListener('click', () => {
        pDiv.remove();
        cleanup();
        onSkip(); // restart = exit current, main.js will re-trigger
      });
    } else if (mg.phase === 'paused') {
      mg.phase = 'playing';
      mg.lastTimestamp = performance.now();
      container.querySelector('.mg-pause').innerHTML = ic('pause');
      document.getElementById('mg-pause-overlay')?.remove();
    }
  });

  // Neighbor chat
  container.querySelector('.mg-chat-btn')?.addEventListener('click', () => {
    onNeighborChat();
    container.querySelector('#mg-neighbor-chat').style.display = 'none';
  });

  // Update HUD function (called from game loop)
  let lastHudUpdate = 0;
  function updateHUD(mg, now) {
    if (now - lastHudUpdate < 200) return; // throttle
    lastHudUpdate = now;
    const e = container.querySelector('#mg-energy');
    const s = container.querySelector('#mg-sold');
    const t = container.querySelector('#mg-time');
    if (e) e.innerHTML = `${ic('lightning')} 精力 ${Math.floor(mg.energy)}`;
    if (s) s.innerHTML = `${ic('coins')} 售出 ${mg.score.sold}`;
    if (t) t.innerHTML = `${ic('timer')} ${Math.ceil(mg.timeRemaining / 1000)}s`;

    // Update per-work stock display
    for (let i = 0; i < mg.worksStock.length; i++) {
      const el = container.querySelector(`#mg-stock-${i}`);
      if (el) {
        const w = mg.worksStock[i];
        const soldOut = w.qty <= 0;
        el.innerHTML = `${ic(w.icon, '0.7rem')} ${w.displayName} ×<b>${w.qty}</b>`;
        el.style.color = soldOut ? 'var(--danger)' : 'var(--text-light)';
        el.style.opacity = soldOut ? '0.7' : '1';
      }
    }

    // Update cooldown bars
    for (const [id, cd] of Object.entries(mg.cooldowns)) {
      const bar = container.querySelector(`#mg-cd-${id}`);
      const btn = container.querySelector(`[data-action="${id}"]`);
      if (bar) {
        const action = actions[id];
        const pct = cd > 0 ? (cd / action.cooldown * 100) : 0;
        bar.style.width = `${pct}%`;
      }
      if (btn) {
        const action = actions[id];
        const disabled = cd > 0 || (action.energyCost && mg.energy < action.energyCost);
        btn.style.opacity = disabled ? '0.4' : '1';
        btn.style.pointerEvents = disabled ? 'none' : 'auto';
      }
    }

    // Neighbor chat visibility
    const chatEl = container.querySelector('#mg-neighbor-chat');
    if (chatEl) chatEl.style.display = mg.neighborChatAvailable ? 'block' : 'none';
  }

  // Cleanup
  function cleanup() {
    if (mg.animFrameId) cancelAnimationFrame(mg.animFrameId);
    emojiCache.clear();
  }

  // Dialog overlay management
  let dialogOverlay = null;
  function showDialog(dialog, onChoice) {
    if (dialogOverlay) dialogOverlay.remove();
    const wrap = container.querySelector('#mg-canvas-wrap');
    wrap.style.position = 'relative';

    dialogOverlay = document.createElement('div');
    dialogOverlay.id = 'mg-dialog';
    dialogOverlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.55);display:flex;flex-direction:column;justify-content:flex-end;border-radius:12px;z-index:20;padding:8px';

    const spriteHtml = dialog.customerSprite
      ? `<img src="customers/${dialog.customerSprite.replace('c','')}.png" style="width:40px;height:40px;object-fit:contain;border-radius:50%;background:#fff;border:2px solid #fff">`
      : `<div style="width:40px;height:40px;border-radius:50%;background:#888;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.2rem">?</div>`;

    if (dialog.resolved) {
      // Show reply — always customer's avatar (it's their reaction)
      dialogOverlay.innerHTML = `
        <div style="background:#fff;border-radius:12px;padding:10px 12px;display:flex;gap:8px;align-items:flex-start">
          ${spriteHtml.replace('style="', 'style="flex-shrink:0;')}
          <div style="font-size:0.78rem;line-height:1.5;color:${dialog.positive ? 'var(--success)' : 'var(--danger)'}">${dialog.reply}</div>
        </div>`;
    } else {
      // Show question + choices
      dialogOverlay.innerHTML = `
        <div style="background:#fff;border-radius:12px;padding:10px 12px;margin-bottom:6px;display:flex;gap:8px;align-items:flex-start">
          ${spriteHtml}
          <div style="font-size:0.8rem;line-height:1.5;color:var(--text);flex:1">${dialog.customerText}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${dialog.choices.map((c, i) => `
            <button class="mg-dialog-choice" data-idx="${i}" style="background:#fff;border:1.5px solid var(--border);border-radius:8px;padding:8px 10px;font-size:0.75rem;text-align:left;cursor:pointer;display:flex;gap:8px;align-items:center;transition:background 0.15s">
              <img src="player/player.png" style="width:28px;height:28px;object-fit:contain;border-radius:50%;background:#FFE8E8;flex-shrink:0">
              <span>${c.text}</span>
            </button>`).join('')}
        </div>`;
      dialogOverlay.querySelectorAll('.mg-dialog-choice').forEach(btn => {
        btn.addEventListener('click', () => onChoice(parseInt(btn.dataset.idx)));
      });
    }
    wrap.appendChild(dialogOverlay);
  }

  function hideDialog() {
    if (dialogOverlay) { dialogOverlay.remove(); dialogOverlay = null; }
  }

  // Attach updateHUD to be callable
  canvas._updateHUD = updateHUD;
  canvas._showDialog = showDialog;
  canvas._hideDialog = hideDialog;

  return { canvas, ctx, container, cleanup };
}

// === Render Frame ===
export function renderFrame(ctx, mg, canvas) {
  const W = CW, H = CH;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // --- Background ---
  const bgImg = spriteImages[mg._bgKey || 'bg1'];
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#F5E6D0';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#E8D5C0';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }

  // --- Neighbor booths ---
  drawBooth(ctx, 10, 185, 80, 50, '#D4C5B0', null);
  drawBooth(ctx, 390, 185, 80, 50, '#C5D4B0', null);
  // Neighbor shopkeepers (pixel sprites)
  drawSprite(ctx, mg._neighborLeftSprite || 'n1', 50, 218, 54);
  drawSprite(ctx, mg._neighborRightSprite || 'n2', 430, 218, 54);

  // --- Player booth ---
  drawBooth(ctx, mg.boothX, mg.boothY, mg.boothW, mg.boothH, '#FFD6D6', null);
  // Player pixel sprite at booth
  drawSprite(ctx, 'player', mg.boothX + mg.boothW / 2, mg.boothY + mg.boothH - 12, 60);

  // Works display — above booth as a label badge
  const stockText = `本×${mg.playerWorks.hvp}  谷×${mg.playerWorks.lvp}`;
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  const stockW = ctx.measureText(stockText).width + 12;
  const stockX = mg.boothX + mg.boothW / 2 - stockW / 2;
  const stockY = mg.boothY - 10;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  roundRect(ctx, stockX, stockY, stockW, 16, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3D2B1F';
  ctx.fillText(stockText, mg.boothX + mg.boothW / 2, stockY + 12);

  // --- Customers ---
  for (const c of mg.customers) {
    drawCustomer(ctx, c);
  }

  // --- Particles (emoji or text bubble) ---
  for (const p of mg.particles) {
    const alpha = Math.min(1, p.life / 400);
    ctx.globalAlpha = alpha;
    // If text is longer than 2 chars and not pure emoji → draw as speech bubble
    if (p.text.length > 2 && /[\u4e00-\u9fffa-zA-Z]/.test(p.text)) {
      const fontSize = Math.min(9, Math.max(6, 80 / p.text.length));
      ctx.font = `bold ${fontSize * DPR}px sans-serif`;
      const textW = ctx.measureText(p.text).width / DPR;
      const padX = 4, padY = 3, bh = fontSize + padY * 2, bw = textW + padX * 2;
      const bx = p.x - bw / 2, by = p.y - bh / 2;
      // White bubble with border
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = DPR * 0.5;
      roundRect(ctx, bx * DPR, by * DPR, bw * DPR, bh * DPR, 4 * DPR);
      ctx.fill();
      ctx.stroke();
      // Text
      ctx.fillStyle = '#333';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.text, p.x * DPR, p.y * DPR);
    } else {
      drawEmoji(ctx, p.text, p.x, p.y, 16);
    }
    ctx.globalAlpha = 1;
  }

  // --- Timer bar at top ---
  const timerPct = mg.timeRemaining / mg.timeTotal;
  ctx.fillStyle = '#E8DDD0';
  ctx.fillRect(0, 0, W, 6);
  ctx.fillStyle = timerPct > 0.3 ? '#27AE60' : timerPct > 0.1 ? '#F39C12' : '#E74C3C';
  ctx.fillRect(0, 0, W * timerPct, 6);

  // --- Neighbor chat bubble ---
  if (mg.neighborChatAvailable) {
    ctx.fillStyle = '#FFF';
    roundRect(ctx, 10, 170, 50, 20, 6);
    ctx.fill();
    ctx.strokeStyle = '#CCC';
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💬嗨!', 35, 183);
  }

  // --- Random event toast ---
  if (mg.activeToast) {
    const t = mg.activeToast;
    const alpha = Math.min(1, t.life / 500); // fade out in last 500ms
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    roundRect(ctx, W / 2 - 105, 16, 210, 28, 10);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${t.emoji} ${t.text}`, W / 2, 34);
    ctx.globalAlpha = 1;
  }

  // Update HUD
  if (canvas._updateHUD) canvas._updateHUD(mg, performance.now());
}

// === Render Scoring Overlay ===
export function renderScoring(ctx, result, canvas) {
  const W = CW, H = CH;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // Draw jiesuan image as full background (cover): good vs bad result
  const jImg = spriteImages[result.performance < 40 ? 'jiesuan2' : 'jiesuan'];
  if (jImg) {
    const imgAspect = jImg.naturalWidth / jImg.naturalHeight;
    const canvasAspect = W / H;
    let sx = 0, sy = 0, sw = jImg.naturalWidth, sh = jImg.naturalHeight;
    if (imgAspect > canvasAspect) {
      sw = jImg.naturalHeight * canvasAspect;
      sx = (jImg.naturalWidth - sw) / 2;
    } else {
      sh = jImg.naturalWidth / canvasAspect;
      sy = (jImg.naturalHeight - sh) / 2;
    }
    ctx.drawImage(jImg, sx, sy, sw, sh, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);
  }

  // Gradient overlay: transparent at top → dark at bottom for text readability
  const grad = ctx.createLinearGradient(0, H * 0.2, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.35, 'rgba(0,0,0,0.4)');
  grad.addColorStop(1, 'rgba(0,0,0,0.8)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Title with shadow for contrast over the illustration
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 6;

  const emoji = result.performance >= 70 ? '🎉' : result.performance >= 40 ? '📊' : '😅';
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`${emoji} 展会结束！`, W / 2, 35);

  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#FFD700';
  ctx.fillText(`表现评分: ${result.performance}分`, W / 2, 60);
  ctx.shadowBlur = 0;

  // Score panel — semi-transparent card at bottom portion
  const panelX = 50, panelY = H * 0.42, panelW = W - 100, panelH = H * 0.50;
  ctx.fillStyle = 'rgba(30, 20, 15, 0.7)';
  roundRect(ctx, panelX, panelY, panelW, panelH, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,0,0.4)';
  ctx.lineWidth = 1;
  roundRect(ctx, panelX, panelY, panelW, panelH, 12);
  ctx.stroke();

  // Score lines
  ctx.fillStyle = '#F0E6D3';
  ctx.font = '12px sans-serif';
  const lines = [
    `招呼: ${result.greeted}次  售出: ${result.sold}份`,
    `无料: ${result.freebiesGiven}次  名片: ${result.cardsExchanged}次`,
    `销量倍率: ×${result.salesMultiplier}`,
    `热情变化: ${result.passionDelta > 0 ? '+' : ''}${result.passionDelta}`,
    `声誉变化: +${result.reputationDelta.toFixed(2)}`,
  ];
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, panelY + 28 + i * 22);
  });

  ctx.font = '10px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('即将返回主游戏...', W / 2, panelY + panelH - 10);
}

// === Helper: Draw booth ===
function drawBooth(ctx, x, y, w, h, color, items) {
  const deskImg = spriteImages['desk'];
  if (deskImg) {
    // Draw desk sprite, keeping aspect ratio, fitting to booth width
    const aspect = deskImg.naturalWidth / deskImg.naturalHeight;
    const dw = w;
    const dh = w / aspect;
    ctx.drawImage(deskImg, x, y + h - dh, dw, dh);
  } else {
    ctx.fillStyle = color;
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 4);
    ctx.fill();
    ctx.stroke();
  }
  if (items) {
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(items, x + w / 2, y + h / 2 + 4);
  }
}

// === Helper: Draw customer ===
function drawCustomer(ctx, c) {
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 10, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pixel sprite (or emoji fallback)
  if (c.spriteId) {
    drawSprite(ctx, `c${c.spriteId}`, c.x, c.y, 51);
  } else {
    drawEmoji(ctx, c.emoji || '👤', c.x, c.y, 18);
  }

  // Thought bubble
  if (c.thoughtBubble && (c.state === 'browsing' || c.state === 'interested' || c.state === 'browsing_neighbor')) {
    ctx.fillStyle = '#FFF';
    ctx.strokeStyle = '#DDD';
    ctx.lineWidth = 1;
    roundRect(ctx, c.x + 8, c.y - 22, 20, 18, 6);
    ctx.fill();
    ctx.stroke();
    drawEmoji(ctx, c.thoughtBubble, c.x + 18, c.y - 13, 10);
  }

  // Satisfaction bar (player booth customers only)
  if (c.state === 'browsing' || c.state === 'interested') {
    const barW = 20;
    const pct = Math.min(1, c.satisfaction / 60);
    ctx.fillStyle = '#E0E0E0';
    ctx.fillRect(c.x - barW / 2, c.y + 12, barW, 3);
    ctx.fillStyle = pct >= 1 ? '#27AE60' : '#F39C12';
    ctx.fillRect(c.x - barW / 2, c.y + 12, barW * pct, 3);
  }

  // Buying animation (player or neighbor)
  if (c.state === 'buying' || c.state === 'buying_neighbor') {
    drawEmoji(ctx, '💫', c.x, c.y - 15, 14);
  }
}

// === Helper: Draw emoji from cache ===
function drawEmoji(ctx, emoji, x, y, size) {
  const img = getEmojiImage(emoji, size);
  ctx.drawImage(img, x - img.width / DPR / 2, y - img.height / DPR / 2, img.width / DPR, img.height / DPR);
}

// === Helper: Rounded rectangle ===
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
