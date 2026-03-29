/**
 * Leaderboard — payload assembly + digest verification for anti-cheat submission.
 *
 * Digest chain: each month's digest = hash(prevDigest + stateSnapshot).
 * Server re-computes the chain from _actionLog to verify integrity.
 */

import { chainDigest, computeChecksum } from './hash.js';
import { getAge } from './engine/core.js';
import { ic } from './icons.js';
import { app } from './ui/shared.js';

const LEADERBOARD_URL = 'https://wild-sunset-05f7.fortheapocalypse.workers.dev/leaderboard';

/**
 * Build the payload to submit to the leaderboard API.
 * Called at game-over with the final state.
 * @param {object} state - full game state at game-over
 * @returns {object} leaderboard submission payload
 */
export function buildLeaderboardPayload(state) {
  const turns = state.turn;
  const age = getAge(turns);

  // Determine ending type
  let endingType = 'burnout';
  if (state.commercialTransition) endingType = 'commercial';
  else if (age >= 42) endingType = 'open';
  else if (state.idleMonthStreak >= 12) endingType = 'idle';

  // Core stats
  const stats = {
    turns,
    age,
    totalRevenue: state.totalRevenue,
    maxReputation: Math.round(state.maxReputation * 100) / 100,
    totalSales: state.totalSales,
    totalHVP: state.totalHVP,
    totalLVP: state.totalLVP,
    achievementCount: (state.achievements || []).length,
    endingType,
    tampered: !!state.tampered,
  };

  // Build info (for leaderboard flavor, not scored)
  const build = {
    playerName: state.clubName || '匿名社团',
    background: state.background,
    endowments: { ...state.endowments },
    obsessiveTrait: state.obsessiveTrait || null,
  };

  // Anti-cheat data
  const integrity = {
    digestChain: state._digestChain || [],
    actionLog: state._actionLog || [],
  };

  // Top-level checksum over the critical stats — server verifies this matches
  const checksumPayload = [
    stats.turns, stats.totalRevenue, stats.maxReputation,
    stats.totalSales, stats.totalHVP, stats.totalLVP,
    stats.endingType,
    integrity.digestChain.length > 0 ? integrity.digestChain[integrity.digestChain.length - 1] : '',
  ].join('|');

  return {
    v: 1,                                // payload version
    stats,
    build,
    integrity,
    checksum: computeChecksum(checksumPayload),
    submittedAt: Date.now(),
  };
}

/**
 * Verify a digest chain locally (same logic server will run).
 * Useful for testing — returns true if chain is internally consistent.
 * @param {Array} actionLog - the _actionLog array
 * @param {Array} digestChain - the _digestChain array
 * @returns {{ valid: boolean, brokenAt: number|null }}
 */
export function verifyDigestChain(actionLog, digestChain) {
  if (actionLog.length !== digestChain.length) {
    return { valid: false, brokenAt: 0 };
  }
  let prevDigest = '';
  for (let i = 0; i < actionLog.length; i++) {
    const entry = actionLog[i];
    // Reconstruct the exact snapshot that was hashed during endMonth
    const snapshot = {
      t: entry.t,
      m: entry.m,
      r: entry.r,
      p: entry.p,
      rv: entry.rv,
      ts: entry.s,
      hv: entry.hv,
      lv: entry.lv,
      hs: entry.hs,
      ls: entry.ls,
      a: (entry.a || []).join(','),
    };
    const expected = chainDigest(prevDigest, snapshot);
    if (expected !== digestChain[i]) {
      return { valid: false, brokenAt: i };
    }
    prevDigest = digestChain[i];
  }
  return { valid: true, brokenAt: null };
}

// === API ===

/**
 * Submit score to leaderboard. Returns { ok, rank, error }.
 */
export async function submitToLeaderboard(state) {
  try {
    const payload = buildLeaderboardPayload(state);
    const res = await fetch(LEADERBOARD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true, rank: data.rank, id: data.id };
  } catch (e) {
    return { ok: false, error: '网络错误，请稍后重试' };
  }
}

/**
 * Fetch leaderboard entries.
 * @param {string} sort - 'revenue' | 'reputation' | 'turns'
 * @param {number} limit
 * @param {number} offset
 * @returns {Promise<{ entries, total, sort }>}
 */
// Set to true to use mock data for layout testing (bypass API)
const USE_MOCK_DATA = false;

export async function fetchLeaderboard(sort = 'revenue', limit = 50, offset = 0) {
  if (USE_MOCK_DATA) return generateMockData(sort);
  try {
    const res = await fetch(`${LEADERBOARD_URL}?sort=${sort}&limit=${limit}&offset=${offset}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return { entries: [], total: 0, sort, error: e.message };
  }
}

function generateMockData(sort) {
  const names = ['星屑工房', '月光社', '拾光绘社', '织梦亭', '鹿鸣馆', '深夜食堂', '黑猫印刷所', '朝雾工坊', '彼岸花社', '七色猫窝', '无光之海', '银河便利店', '夕暮画廊', '蓝莓松饼社', '雪代薰的摊位'];
  const bgs = ['poor', 'ordinary', 'comfort', 'educated', 'wealthy', 'tycoon'];
  const endings = ['commercial', 'burnout', 'open', 'idle'];
  const obsTraits = [null, null, null, 'talent', 'stamina', 'social', 'marketing', 'resilience'];
  const entries = names.map((name, i) => ({
    id: `mock-${i}`,
    stats: {
      turns: 240 - i * 12 - Math.floor(Math.random() * 20),
      age: 38 - Math.floor(i / 2),
      totalRevenue: Math.round(500000 - i * 30000 + Math.random() * 20000),
      maxReputation: Math.round((9.5 - i * 0.5 + Math.random() * 0.3) * 100) / 100,
      totalSales: Math.round(5000 - i * 300 + Math.random() * 200),
      totalHVP: 20 - i + Math.floor(Math.random() * 3),
      totalLVP: 30 - i * 2 + Math.floor(Math.random() * 5),
      endingType: endings[i % endings.length],
      achievementCount: 20 - i,
    },
    build: {
      playerName: name,
      background: bgs[i % bgs.length],
      obsessiveTrait: obsTraits[i % obsTraits.length],
    },
    submittedAt: Date.now() - i * 86400000,
  }));
  // Sort by selected dimension
  const key = sort === 'reputation' ? 'maxReputation' : sort === 'turns' ? 'turns' : 'totalRevenue';
  entries.sort((a, b) => b.stats[key] - a.stats[key]);
  return { sort, total: entries.length, offset: 0, entries };
}

// === Leaderboard Viewer UI ===

const SORT_OPTIONS = [
  { key: 'revenue', label: '收入', icon: 'coins', fmt: v => `¥${v.stats.totalRevenue.toLocaleString()}` },
  { key: 'reputation', label: '声誉', icon: 'star', fmt: v => v.stats.maxReputation.toFixed(1) },
  { key: 'turns', label: '月数', icon: 'calendar', fmt: v => `${v.stats.turns}月` },
];

const ENDING_LABELS = { commercial: '商业出道', burnout: '燃尽', open: '待续', idle: '沉寂' };
const BG_LABELS = { poor: '困难', ordinary: '普通', comfort: '小康', educated: '书香', wealthy: '富裕', tycoon: '超富' };

export function openLeaderboard(state, onBack) {
  const savedHTML = app().innerHTML;
  let currentSort = 'revenue';
  let loading = false;

  function goBack() {
    if (onBack) { onBack(); }
    else { app().innerHTML = savedHTML; }
  }

  async function render() {
    loading = true;
    const sortOpt = SORT_OPTIONS.find(s => s.key === currentSort);
    app().innerHTML = `
    <div class="screen" style="display:flex;flex-direction:column;height:100vh;max-width:480px;margin:0 auto">
      <div style="display:flex;align-items:center;padding:12px 16px;border-bottom:2px solid #F39C12;flex-shrink:0">
        <button id="lb-back" style="background:none;border:none;cursor:pointer;font-size:0.85rem;color:var(--text-light);padding:4px 8px">${ic('arrow-left')} 返回</button>
        <span style="flex:1;text-align:center;font-weight:700;font-size:1rem">${ic('trophy')} 排行榜</span>
        <span style="width:60px"></span>
      </div>
      <div style="display:flex;gap:6px;padding:10px 16px;border-bottom:1px solid var(--border);flex-shrink:0">
        ${SORT_OPTIONS.map(s => `<button class="lb-sort-btn" data-sort="${s.key}" style="flex:1;padding:8px;border-radius:8px;border:1.5px solid ${s.key === currentSort ? 'var(--primary)' : 'var(--border)'};background:${s.key === currentSort ? '#FFF8F0' : 'var(--bg)'};font-size:0.78rem;font-weight:${s.key === currentSort ? '700' : '400'};cursor:pointer">${ic(s.icon,'0.7rem')} ${s.label}</button>`).join('')}
      </div>
      <div style="text-align:center;padding:6px 16px;font-size:0.65rem;color:var(--text-muted);border-bottom:1px solid var(--border)">仅收录游玩 6 回合以上的玩家</div>
      <div id="lb-body" style="flex:1;overflow-y:auto;padding:0">
        <div style="text-align:center;padding:40px;color:var(--text-muted);font-size:0.85rem">加载中…</div>
      </div>
    </div>`;

    document.getElementById('lb-back').addEventListener('click', goBack);
    document.querySelectorAll('.lb-sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (loading) return;
        currentSort = btn.dataset.sort;
        render();
      });
    });

    const data = await fetchLeaderboard(currentSort, 100, 0);
    loading = false;
    const body = document.getElementById('lb-body');
    if (!body) return;

    if (data.error) {
      body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--danger);font-size:0.85rem">加载失败: ${data.error}</div>`;
      return;
    }
    if (data.entries.length === 0) {
      body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:0.85rem">暂无数据，成为第一个上榜的人！</div>`;
      return;
    }

    // Inject shimmer keyframes once
    if (!document.getElementById('lb-shimmer-style')) {
      const style = document.createElement('style');
      style.id = 'lb-shimmer-style';
      style.textContent = `
        @keyframes lb-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .lb-row-gold { background: linear-gradient(90deg, #FFFDF5 0%, #FFF8E1 25%, #FFFDE8 50%, #FFF1C2 75%, #FFFDF5 100%); background-size: 200% 100%; animation: lb-shimmer 3s ease-in-out infinite; }
        .lb-row-silver { background: linear-gradient(90deg, #FAFAFA 0%, #F0F0F0 25%, #F8F8F8 50%, #E8E8E8 75%, #FAFAFA 100%); background-size: 200% 100%; animation: lb-shimmer 3.5s ease-in-out infinite; }
        .lb-row-bronze { background: linear-gradient(90deg, #FFF8F2 0%, #FDEBD0 25%, #FFF4E8 50%, #F5CBA7 75%, #FFF8F2 100%); background-size: 200% 100%; animation: lb-shimmer 4s ease-in-out infinite; }
      `;
      document.head.appendChild(style);
    }

    const rows = data.entries.map((e, i) => {
      const rank = i + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `<span style="color:var(--text-muted);font-size:0.75rem;min-width:20px;display:inline-block;text-align:center">${rank}</span>`;
      const rowClass = rank === 1 ? 'lb-row-gold' : rank === 2 ? 'lb-row-silver' : rank === 3 ? 'lb-row-bronze' : '';
      const nameColor = rank === 1 ? '#B8860B' : rank === 2 ? '#6B7280' : rank === 3 ? '#A0522D' : '';
      const name = e.build?.playerName || '匿名社团';
      const bg = BG_LABELS[e.build?.background] || '';
      const obs = e.build?.obsessiveTrait ? `<span style="font-size:0.55rem;color:var(--danger);border:1px solid var(--danger);border-radius:3px;padding:0 2px;margin-left:3px">偏执</span>` : '';
      const ending = ENDING_LABELS[e.stats.endingType] || '';
      const val = sortOpt.fmt(e);
      return `<div class="${rowClass}" style="display:flex;align-items:center;gap:10px;padding:${rank <= 3 ? '12px 16px' : '10px 16px'};border-bottom:1px solid var(--border)">
        <span style="width:30px;text-align:center;flex-shrink:0;font-size:${rank <= 3 ? '1.3rem' : '1.1rem'}">${medal}</span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:${rank <= 3 ? '700' : '600'};font-size:${rank <= 3 ? '0.9rem' : '0.85rem'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${nameColor ? 'color:' + nameColor : ''}">${name}${obs}</div>
          <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px">${bg} · ${e.stats.age}岁 · ${ending} · ${e.stats.totalHVP}本${e.stats.totalLVP}谷</div>
        </div>
        <span style="font-weight:700;font-size:${rank <= 3 ? '1rem' : '0.9rem'};flex-shrink:0;color:var(--primary)">${val}</span>
      </div>`;
    }).join('');
    body.innerHTML = rows;
  }

  render();
}
