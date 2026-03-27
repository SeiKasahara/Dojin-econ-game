/**
 * Doujin Event Mini-Game — Logic & State Machine
 * Player runs a booth at a doujin event, interacts with customers
 */

import { renderMinigame, renderFrame, renderScoring, preloadSprites } from './minigame-canvas.js';
import { HVP_SUBTYPES, LVP_SUBTYPES } from './engine.js';
import dialogData from './minigame-dialogs.json';

const CUSTOMER_EMOJIS = ['👤', '🧑', '👩', '👨', '🧒', '👧', '🧑‍🎓', '👩‍🎓'];
const SPRITE_COUNT = 12;
const DIALOG_CHANCE = 0.3; // 30% chance per action
const MAX_DIALOGS_PER_GAME = 4; // cap to keep game flowing
const PREF_MAP = { hvp: '📖', lvp: '🔑', any: '❓' };

// === Actions ===
const ACTIONS = {
  greet:    { id: 'greet',    name: '招呼',     emoji: '🗣️', icon: 'megaphone',      cooldown: 2000, energyCost: 4 },
  explain:  { id: 'explain',  name: '介绍作品', emoji: '📖', icon: 'book-open-text',  cooldown: 3000, energyCost: 7 },
  freebie:  { id: 'freebie',  name: '送无料',   emoji: '🎁', icon: 'gift',            cooldown: 5000, moneyCost: 50 },
  exchange: { id: 'exchange', name: '交换名片', emoji: '📇', icon: 'address-book',    cooldown: 4000, energyCost: 5 },
};

// === Neighbor reputation based on network structure ===
function rollNeighborRep(mainState) {
  const playerRep = mainState.reputation || 1;
  const gini = mainState.advanced?.networkGini || 0.5;
  // Higher gini = more variance (scale-free network: some big, some tiny)
  // Lower gini = closer to player (fully connected: everyone similar)
  const variance = gini * 3; // 0.3 gini → ±0.9, 0.9 gini → ±2.7
  const offset = (Math.random() * 2 - 1) * variance;
  return Math.max(0.2, playerRep + offset);
}

// === Create Mini-Game State ===
function createState(mainState, event) {
  const cs = mainState.market?.communitySize || 10000;
  const sizeMult = event.size === 'mega' ? 8 : event.size === 'big' ? 5 : 2.5;
  const popularMult = event.condition === 'popular' ? 1.35 : 1.0;
  const maxCustomers = Math.max(30, Math.round((cs / 1000 * sizeMult + 12) * popularMult));
  const duration = event.size === 'mega' ? 90 : event.size === 'big' ? 75 : 60;

  return {
    phase: 'init', // init | playing | scoring | done
    timeTotal: duration * 1000,
    timeRemaining: duration * 1000,
    lastTimestamp: 0,
    energy: 100,
    moneySpent: 0,
    // Customers
    customers: [],
    nextSpawnTime: 0,
    spawnInterval: Math.max(800, duration * 1000 / maxCustomers),
    totalSpawned: 0,
    maxCustomers,
    // Booth zone (canvas coords)
    boothX: 190, boothY: 195, boothW: 100, boothH: 50,
    // Score
    score: { sold: 0, greeted: 0, freebiesGiven: 0, cardsExchanged: 0 },
    browsedCount: 0,
    // Cooldowns (ms remaining)
    cooldowns: { greet: 0, explain: 0, freebie: 0, exchange: 0 },
    // Player works (detailed inventory for context-aware dialogs & preferences)
    playerWorks: { hvp: mainState.totalHVP, lvp: mainState.totalLVP },
    playerReputation: mainState.reputation,
    // Actual works in stock for dialog context
    playerHVPWorks: (mainState.inventory?.works || []).filter(w => w.type === 'hvp' && w.qty > 0).map(w => {
      const sub = HVP_SUBTYPES[w.subtype] || HVP_SUBTYPES.manga;
      return { subtype: w.subtype, subtypeName: sub.name, name: w.name, isCultHit: w.isCultHit, displayName: sub.name + (w.name ? '·' + w.name : '') };
    }),
    playerLVPWorks: (mainState.inventory?.works || []).filter(w => w.type === 'lvp' && w.qty > 0).map(w => {
      const sub = LVP_SUBTYPES[w.subtype] || LVP_SUBTYPES.acrylic;
      return { subtype: w.subtype, subtypeName: sub.name, name: w.name, displayName: sub.name + (w.name ? '·' + w.name : '') };
    }),
    hasHVP: mainState.inventory?.hvpStock > 0,
    hasLVP: mainState.inventory?.lvpStock > 0,
    // Neighbor chat
    neighborChatAvailable: false,
    neighborChatTimer: 15000 + Math.random() * 20000, // first chat after 15-35s
    neighborChatsUsed: 0,
    passionBonus: 0,
    // Info disclosure affects how many fans come directly
    playerInfoDisclosure: mainState.infoDisclosure || 0.2,
    // Neighbor booth activity — reputation based on network structure
    neighborLeft:  { nextAction: 3000 + Math.random() * 5000, reputation: rollNeighborRep(mainState) },
    neighborRight: { nextAction: 5000 + Math.random() * 5000, reputation: rollNeighborRep(mainState) },
    // Random background
    _bgKey: Math.random() < 0.5 ? 'bg1' : 'bg2',
    // Neighbor pixel sprites (random 2 from 5, no duplicates)
    _neighborLeftSprite: `n${1 + Math.floor(Math.random() * 5)}`,
    _neighborRightSprite: (() => { const a = 1 + Math.floor(Math.random() * 5); let b; do { b = 1 + Math.floor(Math.random() * 5); } while (b === a); return `n${b}`; })(),
    // Random in-game events
    randomEventTimer: 12000 + Math.random() * 8000, // first event after 12-20s
    randomEventsFired: 0,
    activeToast: null, // { text, emoji, life }
    // Dialog system
    dialogCount: 0,
    activeDialog: null, // { customerSprite, customerText, choices, onResolve }
    // Particles (purchase animations)
    particles: [],
    // Animation frame
    animFrameId: null,
    // Event info
    event,
  };
}

// === Random Mini-Game Events ===
const MINIGAME_EVENTS = [
  // --- Positive ---
  { emoji: '📸', text: '有人拍了你的摊位发SNS！',
    apply(mg) { // a small wave of walkers redirect to player
      let redirected = 0;
      for (const c of mg.customers) {
        if (c.state === 'walking' && (c.target === 'left' || c.target === 'right') && redirected < 2) {
          c.target = 'player';
          c.targetX = mg.boothX + Math.random() * mg.boothW;
          c.targetY = mg.boothY - 30 + Math.random() * 20;
          redirected++;
        }
      }
    }, weight: 3 },
  { emoji: '🌊', text: '人潮涌入！客流量短暂增加',
    apply(mg) { // spawn 2-3 extra customers
      for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) spawnCustomer(mg);
    }, weight: 3 },
  { emoji: '☀️', text: '天气很好，大家心情不错',
    apply(mg) { // all browsing customers get a small satisfaction bump
      for (const c of mg.customers) {
        if (c.state === 'browsing' || c.state === 'interested') c.satisfaction += 8;
      }
    }, weight: 3 },
  { emoji: '⚡', text: '你突然来了灵感！精力恢复',
    apply(mg) { mg.energy = Math.min(100, mg.energy + 15); }, weight: 2 },
  { emoji: '🎵', text: '隔壁放了你喜欢的曲子～',
    apply(mg) { mg.passionBonus += 2; }, weight: 2 },
  { emoji: '🤝', text: '老粉来捧场了！',
    apply(mg) { // spawn a direct fan
      if (mg.totalSpawned < mg.maxCustomers) {
        mg.totalSpawned++;
        mg.customers.push({
          id: mg.totalSpawned, x: mg.boothX + mg.boothW / 2, y: -10,
          targetX: mg.boothX + mg.boothW / 2, targetY: mg.boothY - 30,
          state: 'walking', preference: 'any', target: 'player_fan',
          patience: 5000, satisfaction: 55, emoji: '🧑‍🎓',
          spriteId: 1 + Math.floor(Math.random() * SPRITE_COUNT),
          thoughtBubble: '❤️', speed: 0.05, stateTimer: 0,
        });
      }
    }, weight: 2 },
  // --- Negative ---
  { emoji: '🚻', text: '附近的人都去排队上厕所了...',
    apply(mg) { // remove some walking customers
      let removed = 0;
      for (let i = mg.customers.length - 1; i >= 0; i--) {
        if (mg.customers[i].state === 'walking' && removed < 3) {
          mg.customers[i].state = 'leaving';
          mg.customers[i].targetY = 340;
          removed++;
        }
      }
    }, weight: 3 },
  { emoji: '😫', text: '站了太久有点累...',
    apply(mg) { mg.energy = Math.max(5, mg.energy - 10); }, weight: 2 },
  { emoji: '📢', text: '隔壁摊主大声吆喝抢客！',
    apply(mg) { // some browsing customers at player get distracted
      let lost = 0;
      for (const c of mg.customers) {
        if (c.state === 'browsing' && c.satisfaction < 30 && lost < 2) {
          c.state = 'leaving'; c.targetY = 340; c.thoughtBubble = null;
          lost++;
        }
      }
    }, weight: 2 },
  { emoji: '🔋', text: '累了，吃个饭……',
    apply(mg) { // brief cooldown spike on all actions
      for (const k of Object.keys(mg.cooldowns)) {
        mg.cooldowns[k] = Math.max(mg.cooldowns[k], 1500);
      }
    }, weight: 1 },
  { emoji: '🍱', text: '饭点到了，人流暂时变少',
    apply(mg) { // slow spawning temporarily
      mg.nextSpawnTime += 3000;
    }, weight: 2 },
];

function rollRandomEvent(mg) {
  const totalWeight = MINIGAME_EVENTS.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * totalWeight;
  for (const evt of MINIGAME_EVENTS) {
    r -= evt.weight;
    if (r <= 0) return evt;
  }
  return MINIGAME_EVENTS[0];
}

// === Spawn Customer ===
/** Pick a random element from an array */
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function spawnCustomer(mg) {
  if (mg.totalSpawned >= mg.maxCustomers) return;

  // Preference based on actual stock (customers look for what you're actually selling)
  let preference, preferredWork = null;
  if (mg.hasHVP && mg.hasLVP) {
    const r = Math.random();
    if (r < 0.35) { preference = 'hvp'; preferredWork = pick(mg.playerHVPWorks); }
    else if (r < 0.7) { preference = 'lvp'; preferredWork = pick(mg.playerLVPWorks); }
    else { preference = 'any'; }
  } else if (mg.hasHVP) {
    preference = Math.random() < 0.7 ? 'hvp' : 'any';
    if (preference === 'hvp') preferredWork = pick(mg.playerHVPWorks);
  } else if (mg.hasLVP) {
    preference = Math.random() < 0.7 ? 'lvp' : 'any';
    if (preference === 'lvp') preferredWork = pick(mg.playerLVPWorks);
  } else {
    preference = 'any';
  }

  // Determine destination using reputation-weighted distribution
  // Higher reputation booth attracts more customers
  const fanChance = Math.min(0.25, mg.playerInfoDisclosure * 0.3);
  const roll = Math.random();
  let target, targetX, targetY, initSat = 0, initBubble = null;

  if (roll < fanChance) {
    // Direct fan — saw promo online, comes to player booth with intent
    target = 'player_fan';
    targetX = mg.boothX + 20 + Math.random() * (mg.boothW - 40);
    targetY = mg.boothY - 40 + Math.random() * 20;
    initSat = 40 + Math.random() * 15;
    initBubble = '❤️';
  } else {
    // Remaining customers split by reputation weight among 3 booths
    const pRep = Math.max(0.3, mg.playerReputation);
    const lRep = mg.neighborLeft.reputation;
    const rRep = mg.neighborRight.reputation;
    const total = pRep + lRep + rRep;
    const pShare = pRep / total;
    const lShare = lRep / total;
    // rShare = 1 - pShare - lShare

    const destRoll = Math.random();
    if (destRoll < pShare) {
      // General passerby near player area
      target = 'player';
      targetX = 80 + Math.random() * 320;
      targetY = 100 + Math.random() * 80;
    } else if (destRoll < pShare + lShare) {
      target = 'left';
      targetX = 15 + Math.random() * 55;
      targetY = 170 + Math.random() * 30;
    } else {
      target = 'right';
      targetX = 395 + Math.random() * 55;
      targetY = 170 + Math.random() * 30;
    }
  }

  mg.customers.push({
    id: mg.totalSpawned++,
    x: 40 + Math.random() * 400,
    y: -20,
    targetX, targetY,
    state: 'walking',
    // walking | browsing | interested | buying | browsing_neighbor | buying_neighbor | leaving
    preference, preferredWork, target,
    patience: 2500 + Math.random() * 3000, // 2.5-5.5s — faster turnover
    satisfaction: initSat,
    emoji: CUSTOMER_EMOJIS[Math.floor(Math.random() * CUSTOMER_EMOJIS.length)],
    spriteId: 1 + Math.floor(Math.random() * SPRITE_COUNT),
    thoughtBubble: initBubble,
    speed: 0.03 + Math.random() * 0.02,
    stateTimer: 0,
  });
}

// === Neighbor booth centers ===
const NB_LEFT_CX = 50, NB_LEFT_CY = 210;
const NB_RIGHT_CX = 430, NB_RIGHT_CY = 210;

// === Update Customers ===
function updateCustomers(mg, dt) {
  const boothCX = mg.boothX + mg.boothW / 2;
  const boothCY = mg.boothY;

  for (let i = mg.customers.length - 1; i >= 0; i--) {
    const c = mg.customers[i];

    if (c.state === 'walking') {
      // Move toward target
      c.x += (c.targetX - c.x) * c.speed * dt * 0.06;
      c.y += (c.targetY - c.y) * c.speed * dt * 0.06;

      if (c.target === 'left' || c.target === 'right') {
        // --- Heading to a NEIGHBOR booth ---
        const nbCX = c.target === 'left' ? NB_LEFT_CX : NB_RIGHT_CX;
        const nbCY = c.target === 'left' ? NB_LEFT_CY : NB_RIGHT_CY;
        const nearNB = Math.abs(c.x - nbCX) < 50 && Math.abs(c.y - nbCY) < 60 && c.y > 80;
        if (nearNB) {
          c.state = 'browsing_neighbor';
          c.patience = 1500 + Math.random() * 2500;
          c.thoughtBubble = PREF_MAP[c.preference];
        }
        // Fallback: if walking too long or past the booths, leave
        if (c.state === 'walking' && (c.y > 230 || c.patience <= 0)) {
          c.state = 'leaving'; c.targetY = 340;
        }
      } else {
        // --- Heading toward PLAYER booth area ---
        const nearBooth = Math.abs(c.x - boothCX) < mg.boothW && Math.abs(c.y - boothCY) < 60;
        if (nearBooth && c.y > 100) {
          if (c.target === 'player_fan') {
            // Fan: directly starts browsing with high satisfaction
            c.state = c.satisfaction >= 50 ? 'interested' : 'browsing';
            c.thoughtBubble = '❤️';
            mg.browsedCount++;
          } else {
            // Regular passerby: chance to stop
            const stopChance = 0.3 + Math.min(0.3, mg.playerReputation * 0.03);
            if (Math.random() < stopChance) {
              c.state = 'browsing';
              c.thoughtBubble = PREF_MAP[c.preference];
              mg.browsedCount++;
            } else if (c.y > 160) {
              c.state = 'leaving'; c.targetY = 340;
            }
          }
        }
        if (c.y > 250 && c.state === 'walking') {
          c.state = 'leaving'; c.targetY = 340;
        }
      }

    } else if (c.state === 'browsing_neighbor') {
      // --- Browsing at a NEIGHBOR booth ---
      c.patience -= dt;
      const nbCX = c.target === 'left' ? NB_LEFT_CX : NB_RIGHT_CX;
      const nbCY = c.target === 'left' ? NB_LEFT_CY : NB_RIGHT_CY;
      c.x += (nbCX + (c.id % 2 === 0 ? -15 : 15) - c.x) * 0.02;
      c.y += (nbCY - 25 - c.y) * 0.02;
      if (c.patience <= 0) {
        if (Math.random() < 0.55) {
          c.state = 'buying_neighbor';
          c.stateTimer = 800;
        } else if (Math.random() < 0.25) {
          // Didn't buy at neighbor, wanders to player booth to look
          c.state = 'walking';
          c.target = 'player';
          c.targetX = mg.boothX + 20 + Math.random() * (mg.boothW - 40);
          c.targetY = mg.boothY - 30 + Math.random() * 20;
          c.thoughtBubble = null;
          c.patience = 2000 + Math.random() * 2000;
        } else {
          c.state = 'leaving'; c.targetY = 340; c.thoughtBubble = null;
        }
      }

    } else if (c.state === 'buying_neighbor') {
      // --- Buying at a NEIGHBOR booth ---
      c.stateTimer -= dt;
      if (c.stateTimer <= 0) {
        const nbCX = c.target === 'left' ? NB_LEFT_CX : NB_RIGHT_CX;
        mg.particles.push({ x: nbCX, y: c.y - 5, text: '💰', life: 800, vy: -0.06 });
        // Some customers wander to player booth after buying at neighbor
        if (Math.random() < 0.3) {
          c.state = 'walking';
          c.target = 'player';
          c.targetX = mg.boothX + 20 + Math.random() * (mg.boothW - 40);
          c.targetY = mg.boothY - 30 + Math.random() * 20;
          c.thoughtBubble = null;
          c.patience = 2000 + Math.random() * 2000; // fresh patience for browsing
        } else {
          c.state = 'leaving'; c.targetY = 340; c.thoughtBubble = '😊';
        }
      }

    } else if (c.state === 'browsing') {
      // --- Browsing at PLAYER booth ---
      c.patience -= dt;
      c.x += (boothCX + (c.id % 2 === 0 ? -30 : 30) - c.x) * 0.02;
      c.y += (boothCY - 30 - c.y) * 0.02;
      if (c.satisfaction >= 60) {
        c.state = 'buying'; c.stateTimer = 800;
      } else if (c.patience <= 0) {
        c.state = 'leaving'; c.targetY = 340; c.thoughtBubble = null;
      }

    } else if (c.state === 'interested') {
      c.patience -= dt * 0.7; // interested are more patient, but still leave eventually
      c.x += (boothCX - c.x) * 0.01;
      if (c.satisfaction >= 60) {
        c.state = 'buying'; c.stateTimer = 800;
      } else if (c.patience <= 0) {
        c.state = 'leaving'; c.targetY = 340;
      }

    } else if (c.state === 'buying') {
      c.stateTimer -= dt;
      if (c.stateTimer <= 0) {
        // Diversity bonus: fans/any-preference customers with diverse inventory buy multiple
        const diversityBuy = (c.preference === 'any' && mg.hasHVP && mg.hasLVP) ? 2 : 1;
        // Late-game bulk buy: high reputation + info disclosure → customers buy extras (帮朋友带、多买收藏)
        let bulkExtra = 0;
        if (mg.playerReputation >= 3 && mg.playerInfoDisclosure >= 0.5) {
          const isFan = c.target === 'player_fan';
          const bulkChance = Math.min(0.55,
            (mg.playerReputation - 2) * 0.04 +
            (mg.playerInfoDisclosure - 0.4) * 0.25 +
            (isFan ? 0.15 : 0)
          );
          if (Math.random() < bulkChance) {
            bulkExtra = Math.random() < 0.3 ? 2 : 1;
          }
        }
        const totalBuy = diversityBuy + bulkExtra;
        mg.score.sold += totalBuy;
        const coinText = totalBuy >= 3 ? '💰💰💰' : totalBuy >= 2 ? '💰💰' : '💰';
        mg.particles.push({ x: c.x, y: c.y, text: coinText, life: 1000, vy: -0.08 });
        c.state = 'leaving'; c.targetY = 340; c.thoughtBubble = totalBuy >= 2 ? '🤩' : '😊';
      }

    } else if (c.state === 'leaving') {
      c.y += 0.07 * dt;
      c.x += (c.targetX > boothCX ? 0.025 : -0.025) * dt;
      if (c.y > 320) {
        mg.customers.splice(i, 1);
      }
    }
  }

  // --- Neighbor booth periodic activity (visual greet particles) ---
  mg.neighborLeft.nextAction -= dt;
  if (mg.neighborLeft.nextAction <= 0) {
    mg.particles.push({ x: NB_LEFT_CX, y: NB_LEFT_CY - 20, text: '🗣️', life: 500, vy: -0.04 });
    mg.neighborLeft.nextAction = 4000 + Math.random() * 6000;
  }
  mg.neighborRight.nextAction -= dt;
  if (mg.neighborRight.nextAction <= 0) {
    mg.particles.push({ x: NB_RIGHT_CX, y: NB_RIGHT_CY - 20, text: '🗣️', life: 500, vy: -0.04 });
    mg.neighborRight.nextAction = 4000 + Math.random() * 6000;
  }

  // Update particles
  for (let i = mg.particles.length - 1; i >= 0; i--) {
    const p = mg.particles[i];
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) mg.particles.splice(i, 1);
  }
}

// === Context-Aware Dialog Generator ===
// Generates dialogs that reference the player's actual works
function generateContextDialog(actionId, customer, mg) {
  const w = customer.preferredWork; // may be null
  const wName = w?.displayName;     // e.g. "漫画本·星之彼方"
  const wType = w?.subtypeName;     // e.g. "漫画本" or "亚克力"
  const hasMulti = mg.hasHVP && mg.hasLVP;

  // Helper: pick an HVP or LVP work reference
  const anyHVP = mg.playerHVPWorks.length ? pick(mg.playerHVPWorks) : null;
  const anyLVP = mg.playerLVPWorks.length ? pick(mg.playerLVPWorks) : null;

  if (actionId === 'greet' && wName) {
    const templates = [
      { customer: `你好！这个「${wName}」看起来好棒！`, choices: [
        { text: '谢谢！这是我最近的新作，来仔细看看吧～', positive: true, reply: '好的！让我翻翻看！' },
        { text: '啊...就随便做的...', positive: false, reply: '哦...那我看看别家的吧。' },
      ]},
      { customer: `请问「${wName}」还有货吗？朋友推荐我来的！`, choices: [
        { text: '有的有的！你朋友眼光真好，来这边看～', positive: true, reply: '太好了！让我看看！' },
        { text: '应该还有吧...你自己找找。', positive: false, reply: '嗯...那我自己看看。' },
      ]},
    ];
    if (wType) templates.push(
      { customer: `哇，你们有${wType}！我正好在找这类的～`, choices: [
        { text: `对！这款${wType}是我特别用心做的，摸摸看质感～`, positive: true, reply: '手感真好！我喜欢！' },
        { text: '嗯，就摆在那边。', positive: false, reply: '好吧...（自己拿起来看）' },
      ]}
    );
    return pick(templates);
  }

  if (actionId === 'explain' && wName) {
    const templates = [
      { customer: `「${wName}」讲的是什么故事呀？`, choices: [
        { text: '这是一个很用心的作品！让我给你介绍一下～', positive: true, reply: '听起来好有趣！我要买！' },
        { text: '就...你自己翻翻看吧。', positive: false, reply: '这样啊...我再看看别家的。' },
      ]},
      { customer: `这个${wType || '作品'}做了多久？看起来好精致！`, choices: [
        { text: '花了很多心血！每个细节都反复打磨过～', positive: true, reply: '能感受到用心！支持你！' },
        { text: '记不清了...反正做了挺久的。', positive: false, reply: '哦...那挺辛苦的。' },
      ]},
    ];
    if (hasMulti) templates.push(
      { customer: `除了${wType || '这个'}，你们还有别的作品吗？`, choices: [
        { text: `有的！${anyHVP ? anyHVP.displayName : ''}${anyHVP && anyLVP ? '和' : ''}${anyLVP ? anyLVP.displayName : ''}都可以看看～`, positive: true, reply: '种类好丰富！让我都看看！' },
        { text: '就这些了。', positive: false, reply: '好吧...那我先看看这个。' },
      ]}
    );
    return pick(templates);
  }

  if (actionId === 'fan') {
    const refWork = w || anyHVP || anyLVP;
    const refName = refWork?.displayName || '你的作品';
    const templates = [
      { customer: `啊啊啊终于找到你了！我是看了「${refName}」入坑的！`, choices: [
        { text: '谢谢一直支持！今天有新作哦～', positive: true, reply: '新作！给我来一份！不，两份！' },
        { text: '真的吗？太开心了...', positive: true, reply: '真的！你每次的作品我都买了！' },
      ]},
      { customer: `「${refName}」太棒了！我安利给了好多朋友！`, choices: [
        { text: '感动！这次的新作也请多多支持～', positive: true, reply: '必须买！朋友们也让我帮她们带！' },
        { text: '谢谢你帮我宣传...', positive: true, reply: '应该的！好作品值得被更多人看到！' },
      ]},
    ];
    if (hasMulti) templates.push(
      { customer: `大大！你的${anyHVP?.subtypeName || '本子'}和${anyLVP?.subtypeName || '谷子'}我全都要！`, choices: [
        { text: '全都要？太豪气了！给你包好～', positive: true, reply: '嘿嘿，钱包准备好了！全部打包！' },
        { text: '真的全要吗？会不会太多了...', positive: true, reply: '不多不多！买了就是赚到！' },
      ]}
    );
    return pick(templates);
  }

  // freebie, exchange, troll: fall back to static dialogs
  return null;
}

// === Dialog System ===
function tryTriggerDialog(mg, actionId, nearby) {
  if (mg.activeDialog) return false;
  if (mg.dialogCount >= MAX_DIALOGS_PER_GAME) return false;
  if (nearby.length === 0) return false;
  if (Math.random() > DIALOG_CHANCE) return false;

  const target = nearby[Math.floor(Math.random() * nearby.length)];

  // 10% troll, 12% fan, rest normal
  const roll = Math.random();
  let dialog, dialogType = 'normal';
  if (roll < 0.10 && dialogData.troll?.length) {
    dialog = pick(dialogData.troll);
    dialogType = 'troll';
  } else if (roll < 0.22 && dialogData.fan?.length) {
    // Try context-aware fan dialog first
    dialog = generateContextDialog('fan', target, mg) || pick(dialogData.fan);
    dialogType = 'fan';
  } else {
    // Try context-aware dialog, fall back to static
    dialog = generateContextDialog(actionId, target, mg);
    if (!dialog) {
      const pool = dialogData[actionId];
      if (!pool || pool.length === 0) return false;
      dialog = pick(pool);
    }
  }
  if (!dialog) return false;

  mg.phase = 'dialog';
  mg.dialogCount++;
  mg.activeDialog = {
    customerSprite: target.spriteId ? `c${target.spriteId}` : null,
    customerText: dialog.customer,
    choices: Math.random() < 0.5 ? [...dialog.choices] : [...dialog.choices].reverse(),
    targetCustomer: target,
    dialogType,
  };
  return true;
}

export function resolveDialog(mg, choiceIdx) {
  if (!mg.activeDialog) return;
  const choice = mg.activeDialog.choices[choiceIdx];
  const target = mg.activeDialog.targetCustomer;

  const dtype = mg.activeDialog.dialogType || 'normal';

  if (dtype === 'troll') {
    // Troll: always negative, heavier penalty
    if (target) { target.state = 'leaving'; target.targetY = 340; target.thoughtBubble = null; }
    mg.energy = Math.max(0, mg.energy - 8);
    mg.passionBonus -= 2;

  } else if (dtype === 'fan') {
    // Fan: always positive, extra bonus + instant buy
    // If player has diverse inventory, fan buys both types
    if (target) {
      if (mg.hasHVP && mg.hasLVP) target.preference = 'any';
      target.satisfaction = 100; target.state = 'buying'; target.stateTimer = 800;
    }
    mg.energy = Math.min(100, mg.energy + 8);
    mg.passionBonus += 3;
  } else if (choice.positive) {
    // Normal positive
    if (target) target.satisfaction += 30;
    mg.energy = Math.min(100, mg.energy + 5);
    mg.passionBonus += 1;
  } else {
    // Normal negative: 50% leave, 50% stay with reduced satisfaction
    if (target) {
      if (Math.random() < 0.5) {
        target.state = 'leaving'; target.targetY = 340; target.thoughtBubble = null;
      } else {
        target.satisfaction = Math.max(0, target.satisfaction - 15);
      }
    }
    mg.energy = Math.max(0, mg.energy - 3);
    mg.passionBonus -= 1;
  }

  // Store reply for brief display
  mg.activeDialog.reply = choice.reply;
  mg.activeDialog.resolved = true;
  mg.activeDialog.positive = choice.positive;

  // Auto-dismiss after delay
  setTimeout(() => {
    mg.activeDialog = null;
    mg.phase = 'playing';
  }, 1500);
}

// === Perform Action ===
export function performAction(mg, actionId) {
  const act = ACTIONS[actionId];
  if (!act) return;
  if (mg.cooldowns[actionId] > 0) return;
  if (mg.phase === 'dialog') return; // block during dialog
  if (act.energyCost && mg.energy < act.energyCost) return;

  // Apply cost
  if (act.energyCost) mg.energy -= act.energyCost;
  if (act.moneyCost) mg.moneySpent += act.moneyCost;
  mg.cooldowns[actionId] = act.cooldown;

  // Get customers in booth zone
  const nearby = mg.customers.filter(c =>
    (c.state === 'walking' || c.state === 'browsing' || c.state === 'interested') &&
    Math.abs(c.x - (mg.boothX + mg.boothW / 2)) < mg.boothW * 1.2 &&
    c.y > 80 && c.y < 260
  );

  if (actionId === 'greet') {
    mg.score.greeted++;
    // Attract walking customers (can steal from neighbor-targeted ones too)
    let attracted = 0;
    for (const c of nearby) {
      if (c.state === 'walking' && attracted < 3) {
        c.state = 'browsing';
        c.target = 'player'; // redirect to player
        c.thoughtBubble = PREF_MAP[c.preference];
        c.satisfaction += 15;
        mg.browsedCount++;
        attracted++;
      } else if (c.state === 'browsing') {
        c.satisfaction += 15;
      }
    }
    mg.particles.push({ x: mg.boothX + mg.boothW / 2, y: mg.boothY - 10, text: '🗣️', life: 600, vy: -0.05 });

  } else if (actionId === 'explain') {
    for (const c of nearby) {
      if (c.state === 'browsing' || c.state === 'interested') {
        // Preference matching
        let gain = 25;
        if (c.preference === 'hvp' && mg.playerWorks.hvp > 0) gain = 40;
        else if (c.preference === 'lvp' && mg.playerWorks.lvp > 0) gain = 35;
        else if (c.preference === 'any') gain = 30;
        c.satisfaction += gain;
        if (c.state === 'browsing') c.state = 'interested';
      }
    }
    mg.particles.push({ x: mg.boothX + mg.boothW / 2, y: mg.boothY - 10, text: '📖', life: 600, vy: -0.05 });

  } else if (actionId === 'freebie') {
    mg.score.freebiesGiven++;
    for (const c of nearby) {
      if (c.state === 'browsing' || c.state === 'interested' || c.state === 'walking') {
        // Freebie doesn't always work
        const freebieRoll = Math.random();
        if (freebieRoll < 0.65) {
          // Full effect
          c.satisfaction += 50;
          if (c.state === 'walking') {
            c.state = 'browsing';
            c.target = 'player';
            c.thoughtBubble = PREF_MAP[c.preference];
            mg.browsedCount++;
          }
          if (c.state === 'browsing') c.state = 'interested';
        } else if (freebieRoll < 0.90) {
          // Partial effect — takes freebie but not very impressed
          c.satisfaction += 20;
          if (c.state === 'walking') {
            c.state = 'browsing';
            c.target = 'player';
            c.thoughtBubble = '🎁';
            mg.browsedCount++;
          }
        }
        // else 10%: customer ignores/misses the freebie
      }
    }
    mg.particles.push({ x: mg.boothX + mg.boothW / 2, y: mg.boothY - 10, text: '🎁', life: 800, vy: -0.04 });

  } else if (actionId === 'exchange') {
    mg.score.cardsExchanged++;
    for (const c of nearby) {
      if (c.state === 'interested' || c.state === 'buying') {
        c.satisfaction += 10;
      }
    }
    mg.particles.push({ x: mg.boothX + mg.boothW / 2, y: mg.boothY - 10, text: '📇', life: 600, vy: -0.05 });
  }

  // Maybe trigger a dialog interaction
  tryTriggerDialog(mg, actionId, nearby);
}

// === Calculate Result ===
function calculateResult(mg, event) {
  const { sold, greeted, freebiesGiven, cardsExchanged } = mg.score;
  const total = mg.maxCustomers;

  const engagementRate = Math.min(1, greeted / Math.max(1, total * 0.3));
  const conversionRate = sold / Math.max(1, mg.browsedCount);
  const cardRate = Math.min(1, cardsExchanged / 5);
  const performance = engagementRate * 0.3 + conversionRate * 0.5 + cardRate * 0.2;

  // Performance coefficient: scales the event's base salesBoost
  // 0.5x (terrible) → 1.0x (average) → 1.5x (perfect)
  // Final sales = eventBoost × performanceCoeff (applied in engine.js)
  let salesMultiplier;
  if (performance < 0.2) salesMultiplier = 0.5 + performance * 1.5;       // 0.5 → 0.8
  else if (performance < 0.5) salesMultiplier = 0.8 + (performance - 0.2) * 0.67; // 0.8 → 1.0
  else if (performance < 0.8) salesMultiplier = 1.0 + (performance - 0.5) * 1.0;  // 1.0 → 1.3
  else salesMultiplier = 1.3 + (performance - 0.8) * 1.0;                 // 1.3 → 1.5

  const perfRepBonus = performance > 0.6 ? (performance - 0.6) * 0.3 : 0; // up to +0.12 for perfect play
  const reputationDelta = event.reputationBoost + freebiesGiven * 0.02 + cardsExchanged * 0.01 + perfRepBonus;
  const passionDelta = event.passionBoost + mg.passionBonus +
    (performance > 0.5 ? Math.round((performance - 0.5) * 20) : performance < 0.2 ? -Math.round((0.2 - performance) * 30) : 0);

  return {
    salesMultiplier: Math.round(salesMultiplier * 10) / 10,
    passionDelta,
    reputationDelta: Math.round(reputationDelta * 100) / 100,
    moneySpent: mg.moneySpent,
    performance: Math.round(performance * 100),
    sold, greeted, freebiesGiven, cardsExchanged, totalCustomers: total,
  };
}

// === Main Entry Point ===
export function startMinigame(mainState, event, onComplete) {
  // Preload pixel sprites (non-blocking, uses fallback emoji if not ready)
  preloadSprites();

  const mg = createState(mainState, event);

  // Mount UI
  const { canvas, ctx, container, cleanup } = renderMinigame(mg, ACTIONS, (actionId) => {
    if (mg.phase === 'playing') performAction(mg, actionId);
  }, () => {
    // Skip button
    cleanup();
    onComplete(null); // null = use default instant-resolve
  }, () => {
    // Neighbor chat
    if (mg.neighborChatAvailable && mg.neighborChatsUsed < 2) {
      mg.neighborChatAvailable = false;
      mg.neighborChatsUsed++;
      mg.passionBonus += 3;
      mg.particles.push({ x: 60, y: 200, text: '💬', life: 800, vy: -0.04 });
    }
  });

  // Game loop
  function gameLoop(timestamp) {
    if (mg.phase === 'done') return;

    if (mg.phase === 'init') {
      mg.phase = 'playing';
      mg.lastTimestamp = timestamp;
    }

    // Paused: keep rendering but don't advance time
    if (mg.phase === 'paused') {
      mg.lastTimestamp = timestamp;
      renderFrame(ctx, mg, canvas);
      mg.animFrameId = requestAnimationFrame(gameLoop);
      return;
    }

    // Dialog: show dialog UI, pause time
    if (mg.phase === 'dialog' && mg.activeDialog) {
      mg.lastTimestamp = timestamp;
      renderFrame(ctx, mg, canvas);
      if (!mg._dialogShown) {
        mg._dialogShown = true;
        canvas._showDialog(mg.activeDialog, (idx) => {
          resolveDialog(mg, idx);
          // Show reply briefly, then hide
          canvas._showDialog(mg.activeDialog, () => {});
          setTimeout(() => { canvas._hideDialog(); mg._dialogShown = false; }, 1500);
        });
      }
      // If dialog was resolved and auto-dismissed
      if (!mg.activeDialog) {
        canvas._hideDialog();
        mg._dialogShown = false;
      }
      mg.animFrameId = requestAnimationFrame(gameLoop);
      return;
    }

    const dt = Math.min(50, timestamp - mg.lastTimestamp);
    mg.lastTimestamp = timestamp;

    if (mg.phase === 'playing') {
      mg.timeRemaining -= dt;

      // Update cooldowns
      for (const k of Object.keys(mg.cooldowns)) {
        mg.cooldowns[k] = Math.max(0, mg.cooldowns[k] - dt);
      }

      // Passive energy regen: ~1.2 per second
      mg.energy = Math.min(100, Math.round((mg.energy + dt * 0.0012) * 100) / 100);

      // Spawn customers
      mg.nextSpawnTime -= dt;
      if (mg.nextSpawnTime <= 0 && mg.totalSpawned < mg.maxCustomers) {
        spawnCustomer(mg);
        mg.nextSpawnTime = mg.spawnInterval * (0.7 + Math.random() * 0.6);
      }

      // Neighbor chat opportunity
      mg.neighborChatTimer -= dt;
      if (mg.neighborChatTimer <= 0 && mg.neighborChatsUsed < 2) {
        mg.neighborChatAvailable = true;
        mg.neighborChatTimer = 25000 + Math.random() * 15000;
      }

      // Update all customers
      updateCustomers(mg, dt);

      // Random events (max 3 per game, not in last 10s)
      mg.randomEventTimer -= dt;
      if (mg.randomEventTimer <= 0 && mg.randomEventsFired < 3 && mg.timeRemaining > 10000) {
        const evt = rollRandomEvent(mg);
        evt.apply(mg);
        mg.activeToast = { text: evt.text, emoji: evt.emoji, life: 2500 };
        mg.randomEventsFired++;
        mg.randomEventTimer = 15000 + Math.random() * 10000; // next in 15-25s
      }
      // Tick toast
      if (mg.activeToast) {
        mg.activeToast.life -= dt;
        if (mg.activeToast.life <= 0) mg.activeToast = null;
      }

      // Time's up
      if (mg.timeRemaining <= 0) {
        mg.timeRemaining = 0;
        mg.phase = 'scoring';
        const result = calculateResult(mg, event);
        mg.result = result;
        setTimeout(() => {
          mg.phase = 'done';
          cleanup();
          onComplete(result);
        }, 4000);
      }
    }

    // Render
    renderFrame(ctx, mg, canvas);
    if (mg.phase === 'scoring' && mg.result) {
      renderScoring(ctx, mg.result, canvas);
    }

    mg.animFrameId = requestAnimationFrame(gameLoop);
  }

  mg.animFrameId = requestAnimationFrame(gameLoop);
}
