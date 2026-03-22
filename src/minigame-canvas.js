/**
 * Doujin Event Mini-Game — Canvas Rendering
 * Emoji-based booth scene with customers, HUD, and action buttons
 */

const DPR = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
const CW = 480, CH = 300;

// Emoji cache for performance
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
  const ctx = canvas.getContext('2d');
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // Build container
  const container = document.createElement('div');
  container.className = 'screen';
  container.style.background = 'var(--bg)';
  container.innerHTML = `
    <div style="padding:8px 16px 4px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-weight:700;font-size:0.9rem">🎪 ${mg.event.name}@${mg.event.city}</span>
      <button class="btn btn-secondary mg-skip" style="padding:4px 12px;font-size:0.75rem;min-height:32px">跳过</button>
    </div>
    <div style="padding:0 16px" id="mg-canvas-wrap"></div>
    <div style="padding:4px 16px;display:flex;gap:6px;justify-content:space-between;font-size:0.72rem;color:var(--text-light)">
      <span id="mg-energy">⚡ 精力 100</span>
      <span id="mg-sold">💰 售出 0</span>
      <span id="mg-time">⏱️ 60s</span>
    </div>
    <div class="mg-actions" id="mg-actions">
      ${Object.values(actions).map(a => `
        <button class="mg-action-btn" data-action="${a.id}">
          <span style="font-size:1.2rem">${a.emoji}</span>
          <span style="font-size:0.75rem;font-weight:600">${a.name}</span>
          <div class="mg-cd-bar" id="mg-cd-${a.id}"></div>
        </button>
      `).join('')}
    </div>
    <div id="mg-neighbor-chat" style="display:none;padding:4px 16px">
      <button class="btn btn-accent btn-block mg-chat-btn" style="padding:8px;font-size:0.82rem">💬 和隔壁摊主聊天（热情+3）</button>
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

  // Skip button
  container.querySelector('.mg-skip').addEventListener('click', onSkip);

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
    if (e) e.textContent = `⚡ 精力 ${mg.energy}`;
    if (s) s.textContent = `💰 售出 ${mg.score.sold}`;
    if (t) t.textContent = `⏱️ ${Math.ceil(mg.timeRemaining / 1000)}s`;

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

  // Attach updateHUD to be callable
  canvas._updateHUD = updateHUD;

  return { canvas, ctx, container, cleanup };
}

// === Render Frame ===
export function renderFrame(ctx, mg, canvas) {
  const W = CW, H = CH;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // --- Floor ---
  ctx.fillStyle = '#F5E6D0';
  ctx.fillRect(0, 0, W, H);
  // Floor grid
  ctx.strokeStyle = '#E8D5C0';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 30) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 30) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // --- Neighbor booths ---
  drawBooth(ctx, 20, 190, 60, 40, '#D4C5B0', '🎨');
  drawBooth(ctx, 400, 190, 60, 40, '#C5D4B0', '✏️');

  // --- Player booth ---
  drawBooth(ctx, mg.boothX, mg.boothY, mg.boothW, mg.boothH, '#FFD6D6', '📖🔑');
  // Works display
  ctx.fillStyle = '#3D2B1F';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`本${mg.playerWorks.hvp} 谷${mg.playerWorks.lvp}`, mg.boothX + mg.boothW / 2, mg.boothY + mg.boothH + 12);

  // Player emoji at booth
  drawEmoji(ctx, '🧑‍🎨', mg.boothX + mg.boothW / 2, mg.boothY + mg.boothH - 5, 22);

  // --- Customers ---
  for (const c of mg.customers) {
    drawCustomer(ctx, c);
  }

  // --- Particles ---
  for (const p of mg.particles) {
    const alpha = Math.min(1, p.life / 400);
    ctx.globalAlpha = alpha;
    drawEmoji(ctx, p.text, p.x, p.y, 16);
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

  // Update HUD
  if (canvas._updateHUD) canvas._updateHUD(mg, performance.now());
}

// === Render Scoring Overlay ===
export function renderScoring(ctx, result, canvas) {
  const W = CW, H = CH;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);

  // Score card
  ctx.fillStyle = '#FFF';
  roundRect(ctx, 60, 40, W - 120, H - 80, 16);
  ctx.fill();

  ctx.fillStyle = '#3D2B1F';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';

  const emoji = result.performance >= 70 ? '🎉' : result.performance >= 40 ? '📊' : '😅';
  ctx.fillText(`${emoji} 展会结束！`, W / 2, 75);

  ctx.font = '13px sans-serif';
  ctx.fillText(`表现评分: ${result.performance}分`, W / 2, 105);

  const lines = [
    `招呼: ${result.greeted}次  售出: ${result.sold}份`,
    `无料: ${result.freebiesGiven}次  名片: ${result.cardsExchanged}次`,
    `销量倍率: ×${result.salesMultiplier}`,
    `热情变化: ${result.passionDelta > 0 ? '+' : ''}${result.passionDelta}`,
    `声誉变化: +${result.reputationDelta.toFixed(2)}`,
  ];
  ctx.font = '11px sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, 135 + i * 22);
  });

  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#888';
  ctx.fillText('即将返回主游戏...', W / 2, H - 55);
}

// === Helper: Draw booth ===
function drawBooth(ctx, x, y, w, h, color, items) {
  ctx.fillStyle = color;
  ctx.strokeStyle = '#8B7355';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.stroke();
  // Items on table
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

  // Emoji
  drawEmoji(ctx, c.emoji, c.x, c.y, 18);

  // Thought bubble
  if (c.thoughtBubble && (c.state === 'browsing' || c.state === 'interested')) {
    ctx.fillStyle = '#FFF';
    ctx.strokeStyle = '#DDD';
    ctx.lineWidth = 1;
    roundRect(ctx, c.x + 8, c.y - 22, 20, 18, 6);
    ctx.fill();
    ctx.stroke();
    drawEmoji(ctx, c.thoughtBubble, c.x + 18, c.y - 13, 10);
  }

  // Satisfaction bar (for browsing/interested)
  if (c.state === 'browsing' || c.state === 'interested') {
    const barW = 20;
    const pct = Math.min(1, c.satisfaction / 60);
    ctx.fillStyle = '#E0E0E0';
    ctx.fillRect(c.x - barW / 2, c.y + 12, barW, 3);
    ctx.fillStyle = pct >= 1 ? '#27AE60' : '#F39C12';
    ctx.fillRect(c.x - barW / 2, c.y + 12, barW * pct, 3);
  }

  // Buying animation
  if (c.state === 'buying') {
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
