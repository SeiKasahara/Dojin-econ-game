/**
 * Official IP & Second-Hand Market — Phase 3
 * bilateral market, asset depreciation, Hotelling positioning
 * durable goods, secondhand pricing, resale value
 */

// === IP Heat System (hsls.md: dK/dt = I_official + θ·N_D - λ·K) ===
export function createOfficialState() {
  return {
    ipHeat: 80,            // K: IP热度 (0-100), starts healthy
    officialActive: true,   // whether official is producing content
    dormancyTurns: 0,       // months since last official release
    shadowPrice: 0,         // P_D: negative=subsidy, positive=restriction
    lastReleaseType: null,  // 'major'|'minor'|null

    // Second-hand market
    secondHandPool: { hvp: 0, lvp: 0 },  // aggregate available secondhand items
    secondHandPressure: 0,                 // 0-1, how much secondhand is eating into new sales
    playerInventory: [],                    // player's past works: [{ type, turn, reputation, qty }]
  };
}

// === Tick Official IP each turn ===
export function tickOfficial(official, market, playerState) {
  const events = [];

  // --- 1. IP Heat decay: dK/dt = I_official + θ·N_D - λ·K ---
  const lambda = 0.03;  // natural decay rate 3%/month
  const totalCreators = market.nHVP + market.nLVP + 1; // +1 for player
  const doujinContrib = totalCreators * 0.15; // θ·N_D: each creator sustains heat
  let officialInput = 0;

  // Official release cycle: roughly every 8-18 months
  official.dormancyTurns++;
  if (official.officialActive) {
    // Check for scheduled release
    if (official.dormancyTurns >= 8 && Math.random() < 0.12) {
      // Major release
      officialInput = 30;
      official.dormancyTurns = 0;
      official.lastReleaseType = 'major';
      events.push({ type: 'official_release', emoji: '🎬', title: '官方出新作了！',
        desc: 'IP官方发布了重大新内容！整个圈子沸腾了，社群人数激增，创作热情高涨。',
        effect: 'IP热度大幅↑ 社群+20% 热情+10', effectClass: 'positive',
        tip: '官方新作是IP热度的"资本注入"I_official(t)。在hsls.md的折旧模型中：dK/dt = I_official + θ·N_D - λ·K。官方出新作时搭顺风车创作，声誉收益最大。',
        apply: (s) => {
          s.official.ipHeat = Math.min(100, s.official.ipHeat + 30);
          s.market.communitySize = Math.round(s.market.communitySize * 1.2);
          s.passion = Math.min(100, s.passion + 10);
        },
      });
    } else if (official.dormancyTurns >= 4 && Math.random() < 0.1) {
      // Minor update
      officialInput = 10;
      official.dormancyTurns = Math.max(0, official.dormancyTurns - 4);
      official.lastReleaseType = 'minor';
      events.push({ type: 'official_minor', emoji: '📰', title: '官方小更新',
        desc: '官方发布了一些新情报/活动/联动，圈子热度小幅回升。',
        effect: 'IP热度+10 社群+5%', effectClass: 'positive',
        tip: '官方的持续运营维持IP热度K不跌破死亡阈值。即使是小更新也能重置信息半衰期，延长IP的社交货币寿命。',
        apply: (s) => {
          s.official.ipHeat = Math.min(100, s.official.ipHeat + 10);
          s.market.communitySize = Math.round(s.market.communitySize * 1.05);
        },
      });
    }

    // Official crackdown (rare) — shadow price goes positive
    if (Math.random() < 0.02) {
      events.push({ type: 'official_crackdown', emoji: '⚖️', title: '官方版权收紧',
        desc: '官方发布了更严格的二创指引，部分创作者被警告。创作成本和心理压力上升...',
        effect: '影子价格↑ NPC创作者减少 热情-8', effectClass: 'negative',
        tip: '拉姆齐定价P_D为正=官方对同人"收税"。创作者是高敏人群(y大)，哪怕小幅限制也会导致大批人退出。跨边外部性会放大效应：创作者减少→消费者也跟着流失。',
        apply: (s) => {
          s.official.shadowPrice = 0.3;
          s.passion -= 8;
          s.market.nLVP = Math.max(10, s.market.nLVP - Math.floor(s.market.nLVP * 0.15));
          s.market.nHVP = Math.max(0, s.market.nHVP - 1);
        },
      });
    }

    // Official subsidy (rare) — shadow price goes negative
    if (official.shadowPrice <= 0 && Math.random() < 0.03) {
      events.push({ type: 'official_subsidy', emoji: '🎁', title: '官方发布素材包/征稿',
        desc: '官方公开了创作素材库，并发起同人征集活动。相当于对创作者的隐性补贴！',
        effect: '制作成本↓ 新创作者涌入 声誉+0.2', effectClass: 'positive',
        tip: '当P_D为负，影子价格变为补贴。官方主业赚钱时，补贴同人是理性的——每多一个创作者都能转化新的付费粉丝。这就是拉姆齐定价的第三项(P_C-c_C)·f\'γ在起作用。',
        apply: (s) => {
          s.official.shadowPrice = -0.2;
          s.reputation += 0.2;
          s.market.nLVP += 5;
          s.money += 300; // subsidy equivalent
        },
      });
    }
  }

  // IP Heat update
  const heatDelta = officialInput + doujinContrib - lambda * official.ipHeat;
  official.ipHeat = Math.max(0, Math.min(100, official.ipHeat + heatDelta));

  // Shadow price decays back to 0 over time
  official.shadowPrice *= 0.9;

  // IP Heat affects community: if heat drops too low, fans leave faster
  if (official.ipHeat < 20) {
    market.communitySize = Math.round(market.communitySize * 0.97); // extra 3% churn
  }

  // --- 2. Second-Hand Market (frmn.md) ---

  // Natural secondhand supply: consumers who exit/change fandoms sell their stuff
  const churnRate = playerState.recessionTurnsLeft > 0 ? 0.05 : 0.02;
  official.secondHandPool.lvp += Math.floor(market.communitySize * 0.001 * churnRate * 50);
  official.secondHandPool.hvp += Math.floor(market.communitySize * 0.001 * churnRate * 10);

  // Debt crisis flooding: during recession, consumers dump collections
  if (playerState.recessionTurnsLeft > 0) {
    official.secondHandPool.lvp += Math.floor(market.communitySize * 0.003);
    official.secondHandPool.hvp += Math.floor(market.communitySize * 0.001);
  }

  // Secondhand items decay (get sold or become unsellable)
  official.secondHandPool.lvp = Math.floor(official.secondHandPool.lvp * 0.85);
  official.secondHandPool.hvp = Math.floor(official.secondHandPool.hvp * 0.90);

  // Secondhand pressure on new sales
  // LVP: high substitutability (ρ→1), secondhand crushes new
  // HVP: partial protection (differentiated product)
  const lvpPressure = Math.min(0.5, official.secondHandPool.lvp / (market.communitySize * 0.05));
  const hvpPressure = Math.min(0.2, official.secondHandPool.hvp / (market.communitySize * 0.1));
  official.secondHandPressure = { lvp: lvpPressure, hvp: hvpPressure };

  return events;
}

// === Secondhand modifier for player sales ===
export function getSecondHandModifier(official, productType) {
  if (!official) return 1.0;
  const p = productType === 'hvp' ? official.secondHandPressure.hvp : official.secondHandPressure.lvp;
  return Math.max(0.5, 1 - (p || 0));
}

// === Record player's sold work for future resale value ===
export function recordPlayerWork(official, type, turn, reputation, qty) {
  official.playerInventory.push({ type, turn, reputation, qty, remaining: qty });
}

// === Player can sell old inventory on secondhand market ===
export function getResaleValue(work, currentTurn) {
  const age = currentTurn - work.turn;
  const delta = 0.95; // time discount per month
  const basePrice = work.type === 'hvp' ? 50 : 15;
  // Older + higher reputation at creation = higher resale
  const reputationBonus = 1 + work.reputation * 0.1;
  const price = Math.round(basePrice * Math.pow(delta, age) * reputationBonus);
  return Math.max(5, price);
}

// === IP Heat narratives ===
export function getOfficialNarratives(official) {
  const phrases = [];
  if (official.ipHeat > 80) phrases.push('🔥 IP热度很高，创作正当时！');
  else if (official.ipHeat > 50) phrases.push('IP热度尚可，官方和同人共同维持着话题度。');
  else if (official.ipHeat > 20) phrases.push('⚠️ IP热度在下降。官方断更太久，只靠同人在续命...');
  else phrases.push('🧊 IP几乎被遗忘了。只有最核心的同人创作者还在坚持。社群正在萎缩...');

  if (official.dormancyTurns > 12) phrases.push('官方已经' + official.dormancyTurns + '个月没有任何动静了...');

  const shp = official.secondHandPressure;
  if (shp && shp.lvp > 0.3) phrases.push('📦 二手谷子大量涌入，新品谷子销量被严重挤压。');
  if (shp && shp.hvp > 0.1) phrases.push('📚 二手同人本市场活跃，对新品有一定冲击。');

  return phrases;
}
