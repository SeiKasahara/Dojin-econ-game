/**
 * Doujin Event Mini-Game — Logic & State Machine
 * Player runs a booth at a doujin event, interacts with customers
 */

import { renderMinigame, renderFrame, renderScoring } from './minigame-canvas.js';

const CUSTOMER_EMOJIS = ['👤', '🧑', '👩', '👨', '🧒', '👧', '🧑‍🎓', '👩‍🎓'];
const PREF_MAP = { hvp: '📖', lvp: '🔑', any: '❓' };

// === Actions ===
const ACTIONS = {
  greet:    { id: 'greet',    name: '招呼',     emoji: '🗣️', cooldown: 2000, energyCost: 5 },
  explain:  { id: 'explain',  name: '介绍作品', emoji: '📖', cooldown: 3000, energyCost: 10 },
  freebie:  { id: 'freebie',  name: '送无料',   emoji: '🎁', cooldown: 5000, moneyCost: 50 },
  exchange: { id: 'exchange', name: '交换名片', emoji: '📇', cooldown: 4000, energyCost: 8 },
};

// === Create Mini-Game State ===
function createState(mainState, event) {
  const cs = mainState.market?.communitySize || 10000;
  const sizeMult = event.size === 'mega' ? 5 : event.size === 'big' ? 3 : 1.5;
  const maxCustomers = Math.round(cs / 1000 * sizeMult);
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
    // Player works
    playerWorks: { hvp: mainState.totalHVP, lvp: mainState.totalLVP },
    playerReputation: mainState.reputation,
    // Neighbor chat
    neighborChatAvailable: false,
    neighborChatTimer: 15000 + Math.random() * 20000, // first chat after 15-35s
    neighborChatsUsed: 0,
    passionBonus: 0,
    // Particles (purchase animations)
    particles: [],
    // Animation frame
    animFrameId: null,
    // Event info
    event,
  };
}

// === Spawn Customer ===
function spawnCustomer(mg) {
  if (mg.totalSpawned >= mg.maxCustomers) return;
  const prefRoll = Math.random();
  const preference = prefRoll < 0.35 ? 'hvp' : prefRoll < 0.7 ? 'lvp' : 'any';

  mg.customers.push({
    id: mg.totalSpawned++,
    x: 40 + Math.random() * 400,
    y: -20,
    targetX: 80 + Math.random() * 320,
    targetY: 100 + Math.random() * 80,
    state: 'walking', // walking | browsing | interested | buying | leaving
    preference,
    patience: 4000 + Math.random() * 4000, // 4-8 seconds
    satisfaction: 0,
    emoji: CUSTOMER_EMOJIS[Math.floor(Math.random() * CUSTOMER_EMOJIS.length)],
    thoughtBubble: null,
    speed: 0.03 + Math.random() * 0.02,
    stateTimer: 0,
  });
}

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

      // Check if near booth zone
      const nearBooth = Math.abs(c.x - boothCX) < mg.boothW && Math.abs(c.y - boothCY) < 60;
      if (nearBooth && c.y > 100) {
        // Base 30% chance to stop, +reputation bonus
        const stopChance = 0.3 + Math.min(0.3, mg.playerReputation * 0.03);
        if (Math.random() < stopChance) {
          c.state = 'browsing';
          c.thoughtBubble = PREF_MAP[c.preference];
          mg.browsedCount++;
        } else if (c.y > 160) {
          c.state = 'leaving';
          c.targetY = 340;
        }
      }
      // If walked past without stopping
      if (c.y > 250 && c.state === 'walking') {
        c.state = 'leaving';
        c.targetY = 340;
      }

    } else if (c.state === 'browsing') {
      c.patience -= dt;
      // Hover near booth
      c.x += (boothCX + (c.id % 2 === 0 ? -30 : 30) - c.x) * 0.02;
      c.y += (boothCY - 30 - c.y) * 0.02;
      if (c.satisfaction >= 60) {
        c.state = 'buying';
        c.stateTimer = 800;
      } else if (c.patience <= 0) {
        c.state = 'leaving';
        c.targetY = 340;
        c.thoughtBubble = null;
      }

    } else if (c.state === 'interested') {
      c.patience -= dt * 0.5; // interested customers are more patient
      c.x += (boothCX - c.x) * 0.01;
      if (c.satisfaction >= 60) {
        c.state = 'buying';
        c.stateTimer = 800;
      } else if (c.patience <= 0) {
        c.state = 'leaving';
        c.targetY = 340;
      }

    } else if (c.state === 'buying') {
      c.stateTimer -= dt;
      if (c.stateTimer <= 0) {
        mg.score.sold++;
        // Particle effect
        mg.particles.push({ x: c.x, y: c.y, text: '💰', life: 1000, vy: -0.08 });
        c.state = 'leaving';
        c.targetY = 340;
        c.thoughtBubble = '😊';
      }

    } else if (c.state === 'leaving') {
      c.y += 0.06 * dt;
      c.x += (c.targetX > boothCX ? 0.02 : -0.02) * dt;
      if (c.y > 320) {
        mg.customers.splice(i, 1);
      }
    }
  }

  // Update particles
  for (let i = mg.particles.length - 1; i >= 0; i--) {
    const p = mg.particles[i];
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) mg.particles.splice(i, 1);
  }
}

// === Perform Action ===
export function performAction(mg, actionId) {
  const act = ACTIONS[actionId];
  if (!act) return;
  if (mg.cooldowns[actionId] > 0) return;
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
    // Attract walking customers
    let attracted = 0;
    for (const c of nearby) {
      if (c.state === 'walking' && attracted < 3) {
        c.state = 'browsing';
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
        c.satisfaction += 50;
        if (c.state === 'walking') {
          c.state = 'browsing';
          c.thoughtBubble = PREF_MAP[c.preference];
          mg.browsedCount++;
        }
        if (c.state === 'browsing') c.state = 'interested';
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
}

// === Calculate Result ===
function calculateResult(mg, event) {
  const { sold, greeted, freebiesGiven, cardsExchanged } = mg.score;
  const total = mg.maxCustomers;

  const engagementRate = Math.min(1, greeted / Math.max(1, total * 0.3));
  const conversionRate = sold / Math.max(1, mg.browsedCount);
  const cardRate = Math.min(1, cardsExchanged / 5);
  const performance = engagementRate * 0.3 + conversionRate * 0.5 + cardRate * 0.2;

  let salesMultiplier;
  if (performance < 0.2) salesMultiplier = 0.5 + performance * 1.5;
  else if (performance < 0.5) salesMultiplier = 0.8 + (performance - 0.2) * 2.33;
  else if (performance < 0.8) salesMultiplier = 1.5 + (performance - 0.5) * 3.33;
  else salesMultiplier = 2.5 + (performance - 0.8) * 2.5;

  const reputationDelta = event.reputationBoost + freebiesGiven * 0.05 + cardsExchanged * 0.03;
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

    const dt = Math.min(50, timestamp - mg.lastTimestamp);
    mg.lastTimestamp = timestamp;

    if (mg.phase === 'playing') {
      mg.timeRemaining -= dt;

      // Update cooldowns
      for (const k of Object.keys(mg.cooldowns)) {
        mg.cooldowns[k] = Math.max(0, mg.cooldowns[k] - dt);
      }

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
        }, 2500);
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
