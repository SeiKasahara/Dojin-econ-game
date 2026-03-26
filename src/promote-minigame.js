/**
 * Promote Mini-Game — 次元宣发机 Social Media Campaign
 * 小红书-style DOM-based mini-game for "全力宣发" action
 * Player manages social media posts to maximize reach in 60 seconds
 */

import { ic } from './icons.js';
import { NOISE_POSTS, NOISE_AUTHORS, NOISE_COLORS, PLAYER_WORK_TEXTS, PLAYER_CASUAL_TEXTS } from './promote-texts.js';

// === Constants ===
const GAME_DURATION = 60000; // 60 seconds
const NPC_AVATAR_COUNT = 30; // prop-npc/1.webp ~ 30.webp
const MAX_FEED_POSTS = 12;
const DOM_UPDATE_INTERVAL = 66; // ~15fps for DOM updates
const SPAM_THRESHOLD = 2000; // ms between posts to trigger spam
const SPAM_PENALTY = 15;
const COMMENT_WINDOW_MS = 3000;
const COMMENT_SPAWN_MIN = 4000;
const COMMENT_SPAWN_MAX = 6000;
const TREND_DURATION = 8000;
const HEAT_FREQUENCY = 0.00016; // ~1.5 cycles in 60s

const ACTIONS = {
  postWork:   { id: 'postWork',   name: '发作品', icon: 'camera',            baseCd: 8000 },
  postCasual: { id: 'postCasual', name: '发日常', icon: 'chat-circle',       baseCd: 3000 },
  engage:     { id: 'engage',     name: '互动',   icon: 'arrows-clockwise',  baseCd: 2000 },
  rideWave:   { id: 'rideWave',   name: '蹭热点', icon: 'fire',              baseCd: 0 },
};

const ALL_CATEGORIES = [
  'manga', 'novel', 'artbook', 'lorebook', 'music',
  'acrylic', 'badge', 'shikishi', 'postcard',
  '甜文', '虐心', '热血',
];

const CATEGORY_DISPLAY = {
  manga: '漫画', novel: '小说', artbook: '绘本', lorebook: '设定集', music: '音乐',
  acrylic: '亚克力', badge: '吧唧', shikishi: '色纸', postcard: '明信片',
  '甜文': '甜文', '虐心': '虐心', '热血': '热血',
};

// === State Factory ===
function createPromoteState(mainState) {
  const works = (mainState.inventory?.works || []).filter(w => w.qty > 0);
  const playerSubtypes = new Set();
  const playerStyleTags = new Set();
  for (const w of works) {
    if (w.subtype) playerSubtypes.add(w.subtype);
    if (w.styleTag) playerStyleTags.add(w.styleTag);
  }

  const sigInflation = mainState.advanced?.signalInflation || 1.0;
  const mktLevel = mainState.endowments?.marketing || 0;

  return {
    phase: 'init',
    timeTotal: GAME_DURATION,
    timeRemaining: GAME_DURATION,
    lastTimestamp: 0,
    lastDomUpdate: 0,

    // Cooldowns (ms remaining)
    cooldowns: { postWork: 0, postCasual: 0, engage: 0, rideWave: 0 },
    cdReduction: mktLevel * 500, // 0.5s per marketing level

    // Spam detection
    lastPostTime: -9999,
    spamPenalties: 0,

    // Resources
    workPostAmmo: mainState.totalHVP + mainState.totalLVP,
    stickinessStacks: 0, // 0-3

    // Player tags
    playerSubtypes,
    playerStyleTags,

    // Feed posts
    posts: [],
    postIdCounter: 0,
    nextNoiseTime: 1500 + Math.random() * 1000,
    noiseInterval: 4000 / Math.max(1, sigInflation),

    // Heat wave
    heatPhase: Math.random() * Math.PI * 2,

    // Trending topics
    trendingTopic: null,
    nextTrendTime: 16000 + Math.random() * 6000, // first trend ~16-22s
    trendsSpawned: 0,

    // Comment windows
    nextCommentTime: 5000 + Math.random() * 3000,
    hasActiveComment: false,

    // Score accumulators
    totalReach: 0,
    engageCount: 0,
    commentBonuses: 0,
    trendHits: 0,
    trendMisses: 0,
    workPostsUsed: 0,
    casualPostsUsed: 0,

    // From main state
    signalInflation: sigInflation,
    reputation: mainState.reputation || 0.3,
    mktLevel,

    // Animation
    animFrameId: 0,
    toasts: [], // { text, life, positive }
  };
}

// === Heat Wave ===
function getHeatLevel(state) {
  const elapsed = state.timeTotal - state.timeRemaining;
  const raw = Math.sin(state.heatPhase + elapsed * HEAT_FREQUENCY);
  return 0.5 + raw * 0.5; // 0-1
}

function getHeatMultiplier(state) {
  return 0.5 + getHeatLevel(state); // 0.5x - 1.5x
}

// === Action Logic ===
function performAction(state, actionId) {
  const act = ACTIONS[actionId];
  if (!act) return;

  // Cooldown check
  if (actionId !== 'rideWave' && state.cooldowns[actionId] > 0) return;

  const elapsed = state.timeTotal - state.timeRemaining;
  const heatMult = getHeatMultiplier(state);

  if (actionId === 'postWork') {
    if (state.workPostAmmo <= 0) return;
    state.workPostAmmo--;
    state.workPostsUsed++;

    const baseReach = 80 + Math.random() * 40;
    const stickyBonus = 1 + state.stickinessStacks * 0.25;
    const reach = Math.round(baseReach * heatMult * stickyBonus);
    state.stickinessStacks = 0;
    state.totalReach += reach;

    const matchedTexts = PLAYER_WORK_TEXTS
      .filter(t => !t.for || t.for.some(f => state.playerSubtypes.has(f)))
      .map(t => t.text);
    addPlayerPost(state, 'player_work', pick(matchedTexts), reach, 12000);
    state.cooldowns.postWork = Math.max(500, act.baseCd - state.cdReduction);

    // Spam check
    checkSpam(state, elapsed);
    state.lastPostTime = elapsed;

  } else if (actionId === 'postCasual') {
    state.casualPostsUsed++;

    const baseReach = 20 + Math.random() * 20;
    const reach = Math.round(baseReach * heatMult);
    state.totalReach += reach;
    state.stickinessStacks = Math.min(3, state.stickinessStacks + 1);

    addPlayerPost(state, 'player_casual', pick(PLAYER_CASUAL_TEXTS), reach, 8000);
    state.cooldowns.postCasual = Math.max(500, act.baseCd - state.cdReduction);

    checkSpam(state, elapsed);
    state.lastPostTime = elapsed;

  } else if (actionId === 'engage') {
    state.engageCount++;
    let bonusReach = 0;
    let commentHits = 0;

    for (const p of state.posts) {
      if (!p.isPlayer) continue;
      // Extend life
      p.life = Math.min(p.maxLife, p.life + 3000);
      // Comment bonus
      if (p.hasComment) {
        if (p.commentTimer > 0) {
          bonusReach += 15;
          state.commentBonuses++;
          commentHits++;
        } else {
          bonusReach += 5;
        }
        p.hasComment = false;
        p.commentTimer = 0;
      }
    }
    state.totalReach += bonusReach;
    // Single summary toast instead of per-post spam
    if (commentHits > 0) {
      addToast(state, `评论互动 +${commentHits * 15}`, true);
    } else if (bonusReach > 0) {
      addToast(state, `续命 +${bonusReach}`, true);
    }
    state.cooldowns.engage = Math.max(500, act.baseCd - state.cdReduction);

  } else if (actionId === 'rideWave') {
    if (!state.trendingTopic) return;

    const topic = state.trendingTopic;
    const matched = state.playerSubtypes.has(topic.category) || state.playerStyleTags.has(topic.category);

    if (matched) {
      const reach = Math.round((120 + Math.random() * 60) * heatMult);
      state.totalReach += reach;
      state.trendHits++;
      addPlayerPost(state, 'player_trend', `#${topic.displayName} 相关创作分享！`, reach, 10000);
      addToast(state, `热点命中！+${reach}`, true);
    } else {
      state.totalReach = Math.max(0, state.totalReach - 30);
      state.trendMisses++;
      addToast(state, '强蹭翻车 掉粉-30', false);
    }
    state.trendingTopic = null;
  }
}

function checkSpam(state, elapsed) {
  if (elapsed - state.lastPostTime < SPAM_THRESHOLD) {
    state.spamPenalties++;
    state.totalReach = Math.max(0, state.totalReach - SPAM_PENALTY);
    addToast(state, '刷屏掉粉！-15', false);
  }
}

// === Post Management ===
function addPlayerPost(state, type, text, reach, maxLife) {
  const post = {
    id: ++state.postIdCounter,
    type,
    text,
    author: '我',
    avatarImg: 'prop-npc/player.webp',
    avatarColor: '#C73E3A',
    reach,
    life: maxLife,
    maxLife,
    hasComment: false,
    commentTimer: 0,
    isPlayer: true,
  };
  state.posts.unshift(post);
  trimFeed(state);
  return post;
}

function addNoisePost(state) {
  const avatarIdx = 1 + Math.floor(Math.random() * NPC_AVATAR_COUNT);
  const post = {
    id: ++state.postIdCounter,
    type: 'noise',
    text: pick(NOISE_POSTS),
    author: pick(NOISE_AUTHORS),
    avatarImg: `prop-npc/${avatarIdx}.webp`,
    avatarColor: pick(NOISE_COLORS),
    reach: 0,
    life: 3000 + Math.random() * 2000,
    maxLife: 5000,
    hasComment: false,
    commentTimer: 0,
    isPlayer: false,
  };
  state.posts.unshift(post);
  trimFeed(state);
}

function trimFeed(state) {
  while (state.posts.length > MAX_FEED_POSTS) {
    state.posts.pop();
  }
}

function addToast(state, text, positive) {
  state.toasts.push({ text, life: 1200, positive });
}

// === Trending Topic ===
function spawnTrending(state) {
  // 50% chance: pick from player's own tags (guaranteed match if they ride it)
  // 50% chance: fully random (may or may not match)
  const playerTags = [...state.playerSubtypes, ...state.playerStyleTags];
  let category;
  if (playerTags.length > 0 && Math.random() < 0.5) {
    category = pick(playerTags);
  } else {
    category = pick(ALL_CATEGORIES);
  }
  const matched = state.playerSubtypes.has(category) || state.playerStyleTags.has(category);
  state.trendingTopic = {
    category,
    displayName: CATEGORY_DISPLAY[category] || category,
    matched, // pre-compute for hint display (player still needs to recognize it)
    remainingMs: TREND_DURATION,
  };
  state.trendsSpawned++;
  // Schedule second trend
  if (state.trendsSpawned < 2) {
    state.nextTrendTime = 20000 + Math.random() * 8000; // relative from now — handled in update
  } else {
    state.nextTrendTime = Infinity;
  }
}

// === Scoring ===
function estimateMaxReach(state) {
  const workPosts = Math.min(state.workPostAmmo + state.workPostsUsed, 7);
  const casualSlots = Math.floor((GAME_DURATION - workPosts * 8000) / 3000);
  return workPosts * 160 + casualSlots * 40 + 250; // generous ceiling
}

function calculateResult(state) {
  const maxReach = Math.max(200, estimateMaxReach(state));
  const rawPerf = Math.min(1, state.totalReach / maxReach);

  let infoGain;
  if (rawPerf < 0.3) {
    infoGain = 0.30 + rawPerf * (0.10 / 0.3);
  } else if (rawPerf < 0.6) {
    infoGain = 0.40 + (rawPerf - 0.3) * (0.20 / 0.3);
  } else {
    infoGain = 0.60 + (rawPerf - 0.6) * (0.30 / 0.4);
  }

  const repBonus = Math.min(0.15, state.engageCount * 0.01 + state.commentBonuses * 0.02);

  return {
    totalReach: Math.round(state.totalReach),
    infoGain: Math.round(infoGain * 100) / 100,
    engageCount: state.engageCount,
    repBonus: Math.round(repBonus * 100) / 100,
    trendHits: state.trendHits,
    trendMisses: state.trendMisses,
    spamPenalties: state.spamPenalties,
    performance: Math.round(rawPerf * 100),
  };
}

function getGrade(perf) {
  if (perf >= 90) return 'S';
  if (perf >= 75) return 'A';
  if (perf >= 55) return 'B';
  if (perf >= 35) return 'C';
  return 'D';
}

// === DOM Rendering ===
function renderPromoteMinigame(state, onAction, onSkip) {
  const app = document.getElementById('app');
  const container = document.createElement('div');
  container.className = 'screen';
  container.style.background = 'var(--bg)';

  container.innerHTML = `
    <div class="promo-titlebar">
      <span class="promo-title">${ic('megaphone', '0.9rem')} 次元宣发机 · 全力宣发</span>
      <span class="promo-timer" id="promo-timer">60s</span>
      <button class="btn btn-secondary promo-skip-btn" id="promo-skip" style="padding:3px 8px;font-size:0.7rem">跳过</button>
    </div>
    <div class="promo-heat-bar">
      <span style="font-size:0.65rem;color:var(--text-muted)">${ic('chart-line-up', '0.7rem')} 热度</span>
      <div class="promo-heat-track">
        <div class="promo-heat-fill" id="promo-heat-fill"></div>
      </div>
      <span class="promo-heat-label" id="promo-heat-label">50%</span>
    </div>
    <div class="promo-trend-banner" id="promo-trend" style="display:none"></div>
    <div class="promo-feed" id="promo-feed"></div>
    <div class="promo-hud">
      <span id="promo-reach">${ic('eye', '0.75rem')} 触达 0</span>
      <span id="promo-ammo">${ic('camera', '0.75rem')} 素材 ${state.workPostAmmo}</span>
    </div>
    <div class="mg-actions promo-actions" id="promo-actions">
      <button class="mg-action-btn" data-action="postWork" style="position:relative">
        <span>${ic('camera', '1.1rem')}</span>
        <span style="font-size:0.72rem">发作品</span>
        <span class="promo-ammo-badge" id="promo-ammo-badge">${state.workPostAmmo}</span>
        <div class="mg-cd-bar" id="cd-postWork"></div>
      </button>
      <button class="mg-action-btn" data-action="postCasual">
        <span>${ic('chat-circle', '1.1rem')}</span>
        <span style="font-size:0.72rem">发日常</span>
        <div class="promo-stickiness" id="promo-sticky">
          <span class="promo-stickiness-dot"></span>
          <span class="promo-stickiness-dot"></span>
          <span class="promo-stickiness-dot"></span>
        </div>
        <div class="mg-cd-bar" id="cd-postCasual"></div>
      </button>
      <button class="mg-action-btn" data-action="engage" id="btn-engage">
        <span>${ic('arrows-clockwise', '1.1rem')}</span>
        <span style="font-size:0.72rem">互动</span>
        <div class="mg-cd-bar" id="cd-engage"></div>
      </button>
      <button class="mg-action-btn disabled" data-action="rideWave" id="btn-rideWave">
        <span>${ic('fire', '1.1rem')}</span>
        <span style="font-size:0.72rem">蹭热点</span>
        <div class="mg-cd-bar" id="cd-rideWave"></div>
      </button>
    </div>
    <div id="promo-toast-layer" style="position:absolute;top:40%;left:0;right:0;pointer-events:none;z-index:20;display:flex;flex-direction:column;align-items:center;gap:4px"></div>
    <div id="promo-scoring" style="display:none"></div>
  `;

  app.innerHTML = '';
  app.appendChild(container);

  // Bind action buttons
  container.querySelectorAll('.mg-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const actionId = btn.dataset.action;
      if (actionId) onAction(actionId);
    });
  });

  // Skip button with confirmation
  container.querySelector('#promo-skip').addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:50';
    overlay.innerHTML = `
      <div style="background:var(--bg-card);border-radius:var(--radius);padding:20px;text-align:center;max-width:260px;box-shadow:var(--shadow-lg)">
        <div style="font-weight:700;margin-bottom:8px">跳过宣发？</div>
        <div style="font-size:0.78rem;color:var(--text-light);margin-bottom:12px">将使用默认宣发效果</div>
        <button class="btn btn-primary" id="skip-yes" style="margin-right:8px;padding:6px 16px">跳过</button>
        <button class="btn" id="skip-no" style="padding:6px 16px;background:var(--bg);border:1px solid var(--border)">继续</button>
      </div>
    `;
    container.appendChild(overlay);
    overlay.querySelector('#skip-yes').addEventListener('click', () => onSkip());
    overlay.querySelector('#skip-no').addEventListener('click', () => overlay.remove());
  });

  // DOM element cache
  const dom = {
    feed: container.querySelector('#promo-feed'),
    timer: container.querySelector('#promo-timer'),
    heatFill: container.querySelector('#promo-heat-fill'),
    heatLabel: container.querySelector('#promo-heat-label'),
    trendBanner: container.querySelector('#promo-trend'),
    reach: container.querySelector('#promo-reach'),
    ammoHud: container.querySelector('#promo-ammo'),
    ammoBadge: container.querySelector('#promo-ammo-badge'),
    stickyDots: container.querySelectorAll('.promo-stickiness-dot'),
    btnEngage: container.querySelector('#btn-engage'),
    btnRideWave: container.querySelector('#btn-rideWave'),
    toastLayer: container.querySelector('#promo-toast-layer'),
    scoringDiv: container.querySelector('#promo-scoring'),
    postElements: new Map(), // postId -> HTMLElement
  };

  function cleanup() {
    cancelAnimationFrame(state.animFrameId);
  }

  return { container, dom, cleanup };
}

// === DOM Update (throttled) ===
function updateDOM(state, dom, timestamp) {
  if (timestamp - state.lastDomUpdate < DOM_UPDATE_INTERVAL) return;
  state.lastDomUpdate = timestamp;

  // Timer
  const secs = Math.ceil(state.timeRemaining / 1000);
  dom.timer.textContent = `${secs}s`;
  if (secs <= 10) dom.timer.style.color = 'var(--danger)';

  // Heat bar
  const heat = getHeatLevel(state);
  const heatPct = Math.round(heat * 100);
  dom.heatFill.style.width = heatPct + '%';
  dom.heatFill.className = 'promo-heat-fill' + (heat < 0.33 ? ' low' : heat < 0.66 ? ' mid' : ' high');
  dom.heatLabel.textContent = heat < 0.33 ? '低谷' : heat > 0.66 ? '高峰' : '平稳';

  // Reach
  dom.reach.innerHTML = `${ic('eye', '0.75rem')} 触达 ${Math.round(state.totalReach)}`;

  // Ammo
  dom.ammoBadge.textContent = state.workPostAmmo;
  dom.ammoHud.innerHTML = `${ic('camera', '0.75rem')} 素材 ${state.workPostAmmo}`;

  // Stickiness dots
  dom.stickyDots.forEach((dot, i) => {
    dot.className = 'promo-stickiness-dot' + (i < state.stickinessStacks ? ' active' : '');
  });

  // Cooldown bars
  for (const [id, act] of Object.entries(ACTIONS)) {
    const bar = document.getElementById(`cd-${id}`);
    if (!bar) continue;
    const cd = state.cooldowns[id];
    const maxCd = Math.max(500, act.baseCd - state.cdReduction);
    bar.style.width = cd > 0 ? (cd / maxCd * 100) + '%' : '0';
  }

  // Disable postWork if no ammo
  const workBtn = document.querySelector('[data-action="postWork"]');
  if (workBtn) {
    if (state.workPostAmmo <= 0) workBtn.classList.add('disabled');
    else workBtn.classList.remove('disabled');
  }

  // Engage button pulse when comment active
  const hasComment = state.posts.some(p => p.isPlayer && p.hasComment && p.commentTimer > 0);
  if (hasComment) dom.btnEngage.classList.add('highlight');
  else dom.btnEngage.classList.remove('highlight');

  // Ride wave button
  if (state.trendingTopic) {
    dom.btnRideWave.classList.remove('disabled');
    dom.btnRideWave.classList.add('highlight');
  } else {
    dom.btnRideWave.classList.add('disabled');
    dom.btnRideWave.classList.remove('highlight');
  }

  // Trending topic banner
  if (state.trendingTopic) {
    const t = state.trendingTopic;
    const tSec = Math.ceil(t.remainingMs / 1000);
    dom.trendBanner.style.display = '';
    const matchHint = t.matched
      ? `<span style="color:var(--success);font-size:0.65rem;margin-left:4px">${ic('check-circle', '0.65rem')} 与你的作品相关</span>`
      : `<span style="color:var(--text-muted);font-size:0.65rem;margin-left:4px">${ic('warning', '0.65rem')} 和你无关</span>`;
    dom.trendBanner.innerHTML = `${ic('fire', '0.85rem')} 热搜 <b>#${t.displayName}</b> ${matchHint} <span class="promo-trend-timer">${tSec}s</span>`;
  } else {
    dom.trendBanner.style.display = 'none';
  }

  // Sync feed posts
  syncFeedDOM(state, dom);

  // Toasts — only touch DOM on add/remove, not every frame
  for (const t of state.toasts) {
    if (!t._el) {
      // New toast: create and mount
      t._el = document.createElement('div');
      t._el.className = 'promo-toast' + (t.positive ? ' positive' : '');
      t._el.textContent = t.text;
      dom.toastLayer.appendChild(t._el);
    }
    // Fade out in last 300ms
    t._el.style.opacity = t.life < 300 ? (t.life / 300).toFixed(2) : '';
  }
  // Remove dead toasts
  for (let i = state.toasts.length - 1; i >= 0; i--) {
    if (state.toasts[i].life <= 0) {
      state.toasts[i]._el?.remove();
      state.toasts.splice(i, 1);
    }
  }
}

function syncFeedDOM(state, dom) {
  const feed = dom.feed;
  const existingIds = new Set();

  // Add new posts, update existing
  for (const post of state.posts) {
    existingIds.add(post.id);
    let el = dom.postElements.get(post.id);

    if (!el) {
      el = createPostElement(post);
      feed.prepend(el);
      dom.postElements.set(post.id, el);
    }

    // Update comment badge
    const badge = el.querySelector('.comment-badge');
    if (post.isPlayer && post.hasComment && post.commentTimer > 0) {
      if (!badge) {
        const b = document.createElement('span');
        b.className = 'comment-badge';
        b.innerHTML = `${ic('chat-circle', '0.6rem')} 新评论`;
        el.querySelector('.sns-feed-stats')?.prepend(b);
      }
    } else if (badge) {
      badge.remove();
    }

    // Fade out near death
    const lifeRatio = post.life / post.maxLife;
    if (lifeRatio < 0.3) {
      el.style.opacity = Math.max(0.15, lifeRatio / 0.3);
    } else {
      el.style.opacity = '';
    }
  }

  // Remove dead posts
  for (const [id, el] of dom.postElements) {
    if (!existingIds.has(id)) {
      el.remove();
      dom.postElements.delete(id);
    }
  }
}

function createPostElement(post) {
  const el = document.createElement('div');
  const typeClass = post.isPlayer
    ? (post.type === 'player_work' ? 'player-post work' : 'player-post')
    : 'noise-post';
  el.className = `sns-feed-item promo-post ${typeClass}`;

  const avatarHtml = post.avatarImg
    ? `<img class="sns-feed-avatar" src="${post.avatarImg}" style="object-fit:cover" alt="">`
    : `<div class="sns-feed-avatar" style="background:${post.avatarColor}">${post.author.charAt(0)}</div>`;
  const reachHtml = post.isPlayer ? `<span style="color:var(--primary)">${ic('heart', '0.7rem')} ${post.reach}</span>` : '';

  el.innerHTML = `
    ${avatarHtml}
    <div class="sns-feed-body">
      <div class="sns-feed-meta">
        <span class="sns-feed-author">${post.author}</span>
        <span class="sns-feed-time">刚刚</span>
        ${post.type === 'player_trend' ? `<span class="sns-hot-tag">${ic('fire', '0.55rem')} 热搜</span>` : ''}
      </div>
      <div class="sns-feed-text">${post.text}</div>
      <div class="sns-feed-stats">${reachHtml}</div>
    </div>
  `;
  return el;
}

// === Scoring Screen ===
function showScoringScreen(state, dom, onComplete) {
  const result = calculateResult(state);
  const grade = getGrade(result.performance);

  dom.scoringDiv.style.display = '';
  dom.scoringDiv.className = 'promo-scoring';
  dom.scoringDiv.innerHTML = `
    <div class="promo-grade">${grade}</div>
    <div style="font-size:0.85rem;font-weight:600;color:var(--text-light)">宣发表现：${result.performance}分</div>
    <div style="width:85%;margin-top:8px">
      <div class="promo-score-row"><span>${ic('eye')} 总触达</span><span style="font-weight:700">${result.totalReach}</span></div>
      <div class="promo-score-row"><span>${ic('camera')} 作品发布</span><span>${state.workPostsUsed}次</span></div>
      <div class="promo-score-row"><span>${ic('chat-circle')} 日常发布</span><span>${state.casualPostsUsed}次</span></div>
      <div class="promo-score-row"><span>${ic('arrows-clockwise')} 互动次数</span><span>${result.engageCount}次</span></div>
      ${result.trendHits > 0 ? `<div class="promo-score-row"><span>${ic('fire')} 热点命中</span><span style="color:var(--success)">×${result.trendHits}</span></div>` : ''}
      ${result.trendMisses > 0 ? `<div class="promo-score-row"><span>${ic('warning')} 热点翻车</span><span style="color:var(--danger)">×${result.trendMisses}</span></div>` : ''}
      ${result.spamPenalties > 0 ? `<div class="promo-score-row"><span>${ic('prohibit')} 刷屏惩罚</span><span style="color:var(--danger)">×${result.spamPenalties}</span></div>` : ''}
      ${result.commentBonuses > 0 ? `<div class="promo-score-row"><span>${ic('chat-circle')} 评论互动</span><span style="color:var(--success)">+${result.commentBonuses}</span></div>` : ''}
    </div>
    <button class="btn btn-primary" id="promo-done" style="margin-top:14px;padding:8px 32px">继续</button>
  `;

  dom.scoringDiv.querySelector('#promo-done').addEventListener('click', () => {
    onComplete(result);
  });
}

// === Utility ===
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// === Main Entry ===
export function startPromoteMinigame(mainState, onComplete) {
  const state = createPromoteState(mainState);

  const { container, dom, cleanup } = renderPromoteMinigame(state, (actionId) => {
    if (state.phase === 'playing') performAction(state, actionId);
  }, () => {
    cleanup();
    onComplete(null);
  });

  // Game loop
  function gameLoop(timestamp) {
    if (state.phase === 'done') return;

    if (state.phase === 'init') {
      state.phase = 'playing';
      state.lastTimestamp = timestamp;
      state.lastDomUpdate = timestamp;
    }

    if (state.phase === 'scoring') {
      state.animFrameId = requestAnimationFrame(gameLoop);
      return;
    }

    const dt = Math.min(50, timestamp - state.lastTimestamp);
    state.lastTimestamp = timestamp;

    if (state.phase === 'playing') {
      state.timeRemaining -= dt;

      // Update cooldowns
      for (const k of Object.keys(state.cooldowns)) {
        state.cooldowns[k] = Math.max(0, state.cooldowns[k] - dt);
      }

      // Update post lifetimes
      for (let i = state.posts.length - 1; i >= 0; i--) {
        const p = state.posts[i];
        p.life -= dt;
        if (p.hasComment && p.commentTimer > 0) {
          p.commentTimer -= dt;
          if (p.commentTimer <= 0) p.commentTimer = 0;
        }
        if (p.life <= 0) state.posts.splice(i, 1);
      }

      // Spawn noise posts
      state.nextNoiseTime -= dt;
      if (state.nextNoiseTime <= 0) {
        addNoisePost(state);
        state.nextNoiseTime = state.noiseInterval * (0.7 + Math.random() * 0.6);
      }

      // Comment windows
      state.nextCommentTime -= dt;
      if (state.nextCommentTime <= 0) {
        const playerPosts = state.posts.filter(p => p.isPlayer && !p.hasComment);
        if (playerPosts.length > 0) {
          const target = pick(playerPosts);
          target.hasComment = true;
          target.commentTimer = COMMENT_WINDOW_MS;
        }
        state.nextCommentTime = COMMENT_SPAWN_MIN + Math.random() * (COMMENT_SPAWN_MAX - COMMENT_SPAWN_MIN);
      }

      // Trending topic countdown
      if (state.trendingTopic) {
        state.trendingTopic.remainingMs -= dt;
        if (state.trendingTopic.remainingMs <= 0) {
          state.trendingTopic = null;
        }
      }

      // Trending topic spawning
      if (!state.trendingTopic && state.trendsSpawned < 2) {
        state.nextTrendTime -= dt;
        if (state.nextTrendTime <= 0) {
          spawnTrending(state);
        }
      }

      // Toast lifetime (removal handled in updateDOM)
      for (const t of state.toasts) t.life -= dt;

      // Time's up
      if (state.timeRemaining <= 0) {
        state.timeRemaining = 0;
        state.phase = 'scoring';
        showScoringScreen(state, dom, (result) => {
          state.phase = 'done';
          cleanup();
          onComplete(result);
        });
      }
    }

    // Update DOM
    updateDOM(state, dom, timestamp);

    state.animFrameId = requestAnimationFrame(gameLoop);
  }

  state.animFrameId = requestAnimationFrame(gameLoop);
}
