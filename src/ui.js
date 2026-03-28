/**
 * UI Renderer — 同人社团物语 v4 (Phase 2)
 * Market ecosystem panel, pricing UI, diversity indicators
 */

import { ACTIONS, canPerformAction, getActionDisplay, getAchievementInfo, getTimeLabel, getLifeStage, getLifeStageLabel, getAge, PARTNER_TYPES, ENDOWMENTS, ENDOWMENT_TOTAL_POINTS, ENDOWMENT_MAX_PER_TRAIT, getCreativeSkill, getSkillLabel, getSkillEffects, BACKGROUNDS, rollBackground, HVP_SUBTYPES, LVP_SUBTYPES, CREATIVE_CHOICES, ensureEventCalendar } from './engine.js';
import { createChartCanvas, drawSupplyDemand } from './chart.js';
import { getMarketNarratives, getPriceTiers, calculatePricedSales, getMarketAvgPrice, IP_TYPES } from './market.js';
import { getOfficialNarratives } from './official.js';
import { getAdvancedNarratives } from './advanced.js';
import { generateWorldNews } from './world-news.js';
import { toggleMute, isMuted } from './bgm.js';
import { ic, escapeHtml } from './icons.js';
import { fogRecession, fogTrend, fogConsumerAlpha, fogCreatorCount, fogCreatorRange, fogConfidence, fogSecondHand } from './market-fog.js';
import { hasSave, getSaveSummary } from './save.js';

const $ = (sel) => document.querySelector(sel);
const app = () => $('#app');

// === Title Screen ===
export function renderTitle(onStart, onContinue) {
  const save = hasSave() ? getSaveSummary() : null;

  app().innerHTML = `
    <div class="screen title-screen">
      <h1>同人社团物语</h1>
      <p class="subtitle">一个关于热情、声誉与选择的<br/>同人经济学模拟游戏</p>
      <p class="tagline">
        <br/>
        从高考后的暑假开始，经历大学、工作<br/>
        你的同人创作之路能走多远？
      </p>
      ${save ? `
      <button class="btn btn-primary" id="btn-continue" style="margin-bottom:12px;width:100%;max-width:340px;padding:14px 16px;line-height:1.6">
        <div style="font-size:1rem">${ic('play')} 继续游戏</div>
        <div style="font-size:0.7rem;font-weight:400;margin-top:4px;opacity:0.75;letter-spacing:0.3px">
          第${save.turn + 1}回合 · ${save.age}岁${save.stage} · ¥${save.money?.toLocaleString()} · ${ic('heart')} ${save.passion}
        </div>
      </button>` : ''}
      <div class="title-reveal-4" style="margin-bottom:20px;width:100%;max-width:340px">
        <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:8px;text-align:center">你喜欢什么样的作品？</div>
        <div class="price-selector">
          <div class="price-btn selected" data-fandom="niche">
            <div class="price-label">${ic('diamond')} 冷门佳作</div>
            <div class="price-desc">小众但有味道的作品<br/>圈子小，不知道能不能火</div>
          </div>
          <div class="price-btn" data-fandom="popular">
            <div class="price-label">${ic('fire')} 热门大作</div>
            <div class="price-desc">当下最火的作品<br/>圈子大，但热度能持续多久？</div>
          </div>
        </div>
      </div>
      <div class="title-reveal-5"><button class="btn ${save ? 'btn-secondary' : 'btn-primary'}" id="btn-start" style="width:100%;max-width:340px">${save ? '开始新游戏' : '开始创作之旅'}</button></div>
      <p class="tagline mt-16 title-reveal-6" style="font-size:0.7rem">
        玩法：每回合选择行动，管理热情·声誉·资金<br/>
        热情归零 = 游戏结束
      </p>
      <div class="title-reveal-6"><button id="btn-mute" style="margin-top:10px;background:none;border:1px solid var(--border);border-radius:20px;padding:4px 14px;font-size:0.75rem;color:var(--text-light);cursor:pointer">${isMuted() ? ic('speaker-slash') + ' 音乐已关闭' : ic('speaker-high') + ' 音乐已开启'}</button></div>
      <p class="tagline title-reveal-6" style="font-size:0.65rem;margin-top:8px">
        作者博客：<a href="https://seikasahara.com/zh/" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">seikasahara.com/zh/</a><br/>
        音乐：<a href="https://amachamusic.chagasi.com/" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">甘茶音乐工坊</a><br/>
        像素素材：<a href="https://www.avatarsinpixels.com/" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">Pixels © MostlyPixels</a><br/>
        背景美术：<a href="https://www.deviantart.com/coolarts223/gallery" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">coolarts223</a><br/>
      </p>
      ${[0,1,2,3,4,5,6,7].map(i => {
        const left = 8 + i * 11;
        const dur = 9 + (i % 5) * 1.4;
        const delay = i * 1.1;
        const size = 6 + (i % 3) * 3;
        const colors = ['#5BCFB5', '#FF6B9D', '#00A8E8', '#F5A623'];
        const bg = colors[i % colors.length];
        return `<span class="title-particle" style="left:${left}%;animation-duration:${dur}s;animation-delay:${delay}s;width:${size}px;height:${size}px;background:${bg};opacity:0.5"></span>`;
      }).join('')}
    </div>
  `;
  let selectedFandom = 'niche';
  document.querySelectorAll('.price-btn[data-fandom]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.price-btn[data-fandom]').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedFandom = btn.dataset.fandom;
    });
  });
  $('#btn-mute').addEventListener('click', () => {
    const m = toggleMute();
    $('#btn-mute').innerHTML = m ? ic('speaker-slash') + ' 音乐已关闭' : ic('speaker-high') + ' 音乐已开启';
  });
  document.getElementById('btn-continue')?.addEventListener('click', () => {
    if (onContinue) onContinue();
  });
  $('#btn-start').addEventListener('click', () => {
    // Roll actual IP type and community size behind the scenes
    let ipType, preset;
    if (selectedFandom === 'niche') {
      // Niche: small community, could be cold or secretly have potential
      preset = 'early';
      const r = Math.random();
      ipType = r < 0.40 ? 'cold' : r < 0.85 ? 'normal' : 'hot'; // 40% cold, 45% normal, 15% sleeper hit
    } else {
      // Popular: large community, but could decline
      preset = Math.random() < 0.6 ? 'late' : 'mid';
      const r = Math.random();
      ipType = r < 0.05 ? 'cold' : r < 0.35 ? 'normal' : 'hot'; // 5% already declining, 30% normal, 65% hot
    }
    onStart(preset, ipType);
  });
}

// === Endowment Allocation Screen ===
export function renderEndowments(onConfirm) {
  const MAX = ENDOWMENT_MAX_PER_TRAIT;
  const TRAIT_COUNT = Object.keys(ENDOWMENTS).length; // 5
  const MIN_TOTAL = TRAIT_COUNT; // each trait at least 1
  const MAX_TOTAL = TRAIT_COUNT * MAX; // 15

  // Left-skewed normal: Box-Muller, mean=7.5 sd=2, clamp to [MIN_TOTAL, MAX_TOTAL]
  function rollTotal() {
    const u1 = Math.random(), u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    // Skew left: use lower mean so high rolls are rarer
    const raw = 7 + z * 1.8;
    return Math.max(MIN_TOTAL, Math.min(MAX_TOTAL, Math.round(raw)));
  }

  let totalPoints = rollTotal();
  let bgId = rollBackground();
  let rolled = false; // one reroll allowed
  const pts = { talent: 1, stamina: 1, social: 1, marketing: 1, resilience: 1 };

  function remaining() { return totalPoints - Object.values(pts).reduce((s, v) => s + v, 0); }

  // Rating for the roll
  function rollRating(t) {
    if (t >= 12) return { text: '天选之人！', color: '#E74C3C' };
    if (t >= 10) return { text: '非常幸运', color: '#F39C12' };
    if (t >= 8) return { text: '不错', color: 'var(--success)' };
    if (t >= 7) return { text: '普通', color: 'var(--text-light)' };
    return { text: '逆境开局', color: 'var(--danger)' };
  }

  function render() {
    const rem = remaining();
    const keys = Object.keys(ENDOWMENTS);
    const rating = rollRating(totalPoints);
    const isLegendary = totalPoints >= 12;
    app().innerHTML = `
      <div class="screen endowment-screen">
        <h2 style="text-align:center;margin-bottom:4px">角色禀赋</h2>
        <p style="text-align:center;font-size:0.8rem;color:var(--text-light);margin-bottom:8px">
          先抽取天赋点数，再自由分配（每项至少1，上限${MAX}）
        </p>
        <div style="display:flex;justify-content:center;gap:16px;margin-bottom:12px">
          <div style="text-align:center;flex:1">
            <div class="endow-total-num" data-target="${totalPoints}" style="font-size:1.8rem;font-weight:700;color:${rating.color}">0</div>
            <div class="endow-rating${isLegendary ? ' endow-rating--legendary' : ''}" style="font-size:0.75rem;color:${rating.color};font-weight:600">${rating.text}</div>
            <div style="font-size:0.65rem;color:var(--text-muted)">天赋点数</div>
          </div>
          <div style="text-align:center;flex:1">
            <div style="font-size:1.8rem">${ic(BACKGROUNDS[bgId].emoji)}</div>
            <div style="font-size:0.75rem;font-weight:600">${BACKGROUNDS[bgId].name}</div>
            <div style="font-size:0.65rem;color:var(--text-muted)">¥${BACKGROUNDS[bgId].money}起步</div>
          </div>
        </div>
        <div style="text-align:center;margin-bottom:8px">
          ${!rolled ? `<button class="btn btn-secondary" id="btn-reroll" style="padding:4px 20px;font-size:0.82rem">${ic('dice-five')} 重新抽取（仅1次）</button>` : `<div style="font-size:0.7rem;color:var(--text-muted)">已用完重抽机会</div>`}
        </div>
        <div style="text-align:center;margin-bottom:8px">
          <span class="endow-remaining--${rem > 0 ? 'pending' : 'done'}" style="font-size:0.9rem;font-weight:700;color:${rem > 0 ? 'var(--primary)' : 'var(--success)'}">剩余: ${rem}</span>
        </div>
        <div class="endow-stats-frame">
          ${keys.map(k => {
            const e = ENDOWMENTS[k];
            const v = pts[k];
            return `
            <div class="endow-trait-row" data-key="${k}">
              <span style="font-size:1.3rem;width:28px;text-align:center">${ic(e.emoji)}</span>
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:0.85rem">${e.name}</div>
                <div style="font-size:0.7rem;color:var(--text-light)">${e.desc}</div>
                <div style="font-size:0.65rem;color:var(--text-muted)">${e.effects.join(' · ')}</div>
              </div>
              <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
                <button class="endow-btn" data-key="${k}" data-dir="-1" ${v <= 1 ? 'disabled' : ''} style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:var(--bg);font-size:1rem;cursor:pointer">−</button>
                <div style="width:60px;text-align:center">
                  <div class="endow-val" style="font-size:1.1rem;font-weight:700">${v}</div>
                  <div style="display:flex;gap:2px;justify-content:center">${Array.from({length: MAX}, (_, i) => `<div class="endow-bar-pip${i < v ? ' filled' : ''}" style="background:${i < v ? 'var(--primary)' : '#E0E0E0'}"></div>`).join('')}</div>
                </div>
                <button class="endow-btn" data-key="${k}" data-dir="1" ${v >= MAX || rem <= 0 ? 'disabled' : ''} style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:var(--bg);font-size:1rem;cursor:pointer">+</button>
              </div>
            </div>`;
          }).join('')}
        </div>
        <div style="max-width:360px;margin:12px auto 0">
          <button class="btn btn-primary btn-block" id="btn-endow-confirm" ${rem !== 0 ? 'disabled style="opacity:0.5"' : ''}>确认禀赋 (${rem === 0 ? '✓' : `还剩${rem}点`})</button>
        </div>
        <div class="tip-box" style="max-width:360px;margin:12px auto 0;text-align:left">
          <div class="tip-label">禀赋与理论</div>
          <div class="tip-text">天赋点数服从偏左正态分布——大多数人拿到6-8点，少数幸运儿可达10+，也有人以5点逆境开局。每项至少保底1点。</div>
        </div>
      </div>
    `;
    // Animate total points counter (roll effect)
    const numEl = document.querySelector('.endow-total-num');
    if (numEl) {
      const target = parseInt(numEl.dataset.target);
      let current = 0;
      const step = () => {
        current += 1;
        numEl.textContent = current;
        if (current < target) requestAnimationFrame(step);
      };
      setTimeout(() => requestAnimationFrame(step), 200);
    }

    // Incremental DOM update instead of full re-render
    function updateTraitUI(key) {
      const rem = remaining();
      const keys = Object.keys(ENDOWMENTS);

      // Update the changed trait's value + bar pips
      const row = document.querySelector(`.endow-trait-row[data-key="${key}"]`);
      if (row) {
        const v = pts[key];
        row.querySelector('.endow-val').textContent = v;
        row.querySelectorAll('.endow-bar-pip').forEach((pip, i) => {
          const shouldFill = i < v;
          pip.classList.toggle('filled', shouldFill);
          pip.style.background = shouldFill ? 'var(--primary)' : '#E0E0E0';
        });
        // Update +/- button disabled states for this row
        row.querySelector('[data-dir="-1"]').disabled = v <= 1;
        row.querySelector('[data-dir="1"]').disabled = v >= MAX || rem <= 0;
      }

      // Update all other rows' + buttons (rem might have changed)
      keys.forEach(k => {
        if (k === key) return;
        const r = document.querySelector(`.endow-trait-row[data-key="${k}"] [data-dir="1"]`);
        if (r) r.disabled = pts[k] >= MAX || rem <= 0;
      });

      // Update remaining display
      const remEl = document.querySelector('[class*="endow-remaining"]');
      if (remEl) {
        remEl.className = rem > 0 ? 'endow-remaining--pending' : 'endow-remaining--done';
        remEl.style.color = rem > 0 ? 'var(--primary)' : 'var(--success)';
        remEl.textContent = `剩余: ${rem}`;
      }

      // Update confirm button
      const cfm = document.getElementById('btn-endow-confirm');
      if (cfm) {
        cfm.disabled = rem !== 0;
        cfm.style.opacity = rem !== 0 ? '0.5' : '1';
        cfm.textContent = `确认禀赋 (${rem === 0 ? '✓' : `还剩${rem}点`})`;
        // Re-bind click if just became enabled
        if (rem === 0) {
          cfm.onclick = () => onConfirm({ ...pts }, bgId);
        } else {
          cfm.onclick = null;
        }
      }
    }

    document.querySelectorAll('.endow-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.key;
        const dir = parseInt(btn.dataset.dir);
        const newVal = pts[k] + dir;
        if (newVal < 1 || newVal > MAX) return;
        if (dir > 0 && remaining() <= 0) return;
        pts[k] = newVal;
        updateTraitUI(k);
      });
    });
    const confirmBtn = document.getElementById('btn-endow-confirm');
    if (confirmBtn && remaining() === 0) {
      confirmBtn.addEventListener('click', () => onConfirm({ ...pts }, bgId));
    }
    document.getElementById('btn-reroll')?.addEventListener('click', () => {
      if (rolled) return;
      rolled = true;
      // Shake the button before re-rendering
      document.getElementById('btn-reroll')?.classList.add('shake-anim');
      totalPoints = rollTotal();
      bgId = rollBackground();
      pts.talent = 1; pts.stamina = 1; pts.social = 1; pts.marketing = 1; pts.resilience = 1;
      setTimeout(() => render(), 150);
    });
  }
  render();
}

// === Game Screen ===
export function renderGame(state, onAction, onRetire) {
  const partnerInfo = state.hasPartner && state.partnerType
    ? (() => {
        const pt = PARTNER_TYPES[state.partnerType];
        return `<span style="font-size:0.75rem;padding:2px 8px;border-radius:10px;background:${state.partnerType === 'toxic' ? '#FDE8E8' : state.partnerType === 'supportive' ? '#E8F8F0' : '#FFF8E8'}">${ic(pt.emoji)} ${pt.name} (${state.partnerTurns}月)</span>`;
      })()
    : '';

  // Time debuff/buff display
  const debuffInfo = state.timeDebuffs.length > 0
    ? state.timeDebuffs.filter(d => d.turnsLeft < 900).map(d => {
        const isPositive = d.delta > 0;
        const bg = isPositive ? '#E8F8F0' : '#FDE8E8';
        const color = isPositive ? 'var(--success)' : 'var(--danger)';
        const icon = isPositive ? 'sun' : 'hourglass';
        return `<span style="font-size:0.7rem;padding:2px 6px;border-radius:8px;background:${bg};color:${color}">${ic(icon)} ${d.reason} ${d.turnsLeft}月</span>`;
      }).join(' ')
    : '';

  const recFog = fogRecession(state.recessionTurnsLeft);
  const recessionInfo = recFog
    ? `<span style="font-size:0.7rem;padding:2px 6px;border-radius:8px;background:#FDE8E8;color:var(--danger)">${ic(recFog.icon)} ${recFog.label}</span>`
    : '';

  const hvpInfo = state.hvpProject
    ? `<span style="font-size:0.7rem;padding:2px 6px;border-radius:8px;background:#E8F0FF;color:#2C3E50">${ic('book-open-text')} 同人本 ${state.hvpProject.progress}/${state.hvpProject.needed}</span>`
    : '';

  const unemployedInfo = state.unemployed
    ? `<span style="font-size:0.7rem;padding:2px 6px;border-radius:8px;background:#FDE8E8;color:var(--danger);font-weight:700">${ic('warning-circle')} 失业中</span>`
    : state.fullTimeDoujin
    ? `<span style="font-size:0.7rem;padding:2px 6px;border-radius:8px;background:#E8F8F0;color:var(--success);font-weight:700">${ic('sparkle')} 全职同人</span>`
    : '';

  // Month schedule card
  const timeRemaining = Math.max(0, state.time - (state.monthTimeSpent || 0));
  const actions = state.monthActions || [];
  const scheduleCard = `
    <div class="schedule-card">
      <div class="schedule-header">
        <span>${ic('calendar-blank')} 本月日程</span>
        <span class="schedule-remaining" style="color:${timeRemaining <= 0 ? 'var(--danger)' : timeRemaining <= 2 ? 'var(--warning)' : 'var(--text-light)'}">
          ${timeRemaining <= 0 ? `${ic('warning')} 0/${state.time}天` : `剩余 ${timeRemaining}/${state.time}天`}
        </span>
      </div>
      <div class="schedule-body">
        ${(() => {
          const timedActions = actions.filter(a => a.timeCost > 0);
          const freeActions = actions.filter(a => a.timeCost === 0);
          if (actions.length === 0) return `<div class="schedule-empty">还没有安排，选择一个行动开始吧</div>`;
          let html = '';
          if (timedActions.length > 0 || timeRemaining > 0) {
            html += `<div class="schedule-timeline"><div class="schedule-track">
              ${timedActions.map(a => `<div class="schedule-block" style="flex:${a.timeCost} 0 0" title="${ACTIONS[a.actionId]?.name || a.actionId} ${a.timeCost}天">
                <span class="schedule-block-name">${ACTIONS[a.actionId]?.name || a.actionId}</span>
                <span class="schedule-block-cost">${a.timeCost}天</span>
              </div>`).join('')}
              ${timeRemaining > 0 ? `<div class="schedule-block schedule-block-free" style="flex:${timeRemaining} 0 0"><span class="schedule-block-name">空闲</span></div>` : ''}
            </div></div>`;
          }
          if (freeActions.length > 0) {
            html += `<div class="schedule-tags">${freeActions.map(a =>
              `<span class="schedule-tag">${ic('check', '0.6rem')} ${ACTIONS[a.actionId]?.name || a.actionId}</span>`
            ).join('')}</div>`;
          }
          return html;
        })()}
      </div>
      <div class="schedule-footer">
        <button class="schedule-end-btn ${timeRemaining <= 0 ? 'urgent' : ''}" id="btn-end-month">
          ${ic('calendar-check')} ${timeRemaining <= 0 ? '闲暇耗尽 · 结束本月' : actions.length > 0 ? `结束本月（剩余${timeRemaining}天）` : '结束本月（跳过）'}
        </button>
      </div>
    </div>`;

  app().innerHTML = `
    <div class="screen screen-game">
      <div class="game-header">
        <span class="turn-badge">第 ${state.turn + 1} 回合</span>
        <span style="display:flex;align-items:center;gap:6px">
          <button class="btn btn-secondary" id="btn-mute-game" style="padding:2px 8px;font-size:0.75rem;min-height:28px">${isMuted() ? ic('speaker-slash') : ic('speaker-high')}</button>
          <button class="btn btn-secondary" id="btn-retire" style="padding:2px 10px;font-size:0.75rem;min-height:28px;color:var(--text-muted)">${ic('smiley-sad')}</button>
          <span class="money-badge" ${state.money < 0 ? 'style="color:var(--danger)"' : ''}>¥${state.money.toLocaleString()}</span>
        </span>
      </div>

      ${renderPhoneNarrative(state, partnerInfo, debuffInfo, recessionInfo, hvpInfo, unemployedInfo)}

      <div class="game-content">
        ${renderStatsBar(state)}
        ${scheduleCard}
        ${renderAppDesktop(state)}
      </div>
    </div>
  `;

  // End month button
  document.getElementById('btn-end-month')?.addEventListener('click', () => onAction('endMonth'));

  // Schedule block tap tooltip (mobile: title attr doesn't show)
  document.querySelectorAll('.schedule-block[title]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.schedule-tooltip').forEach(t => t.remove());
      const tip = document.createElement('div');
      tip.className = 'schedule-tooltip';
      tip.textContent = el.getAttribute('title');
      el.style.position = 'relative';
      el.appendChild(tip);
      setTimeout(() => tip.remove(), 2000);
    });
  });

  // App icon clicks
  document.querySelectorAll('.app-icon:not(.disabled)').forEach(el => {
    el.addEventListener('click', () => onAction('app:' + el.dataset.app));
  });
  // Mute button
  document.getElementById('btn-mute-game')?.addEventListener('click', () => {
    const m = toggleMute();
    document.getElementById('btn-mute-game').innerHTML = m ? ic('speaker-slash') : ic('speaker-high');
  });
  // Stats panel toggle
  document.getElementById('phone-stats-toggle')?.addEventListener('click', () => {
    document.getElementById('phone-stats-panel')?.classList.toggle('collapsed');
  });
  // Retire button — voluntary exit
  document.getElementById('btn-retire')?.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'event-overlay';
    const months = state.turn;
    const hasWorks = state.totalHVP > 0 || state.totalLVP > 0;
    overlay.innerHTML = `
      <div class="event-card" style="max-width:340px">
        <div style="font-size:2rem;margin-bottom:8px">${ic('smiley-sad')}</div>
        <div style="font-weight:700;font-size:1rem;margin-bottom:8px">放下画笔</div>
        <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:16px;line-height:1.5">
          ${months < 6 ? '才刚开始就想放弃了吗...也许同人创作不适合每个人。'
            : hasWorks ? `创作了${months}个月，也许是时候去过另一种生活了。你的作品会留在这里。`
            : `在圈子里待了${months}个月，虽然一直没动笔，但这段时光也不算白费。`}
        </div>
        <button class="btn btn-block" id="btn-retire-confirm" style="background:#F8F0F0;border:1px solid var(--danger);color:var(--danger);margin-bottom:8px">是的，我想退坑了</button>
        <button class="btn btn-block" id="btn-retire-cancel" style="background:var(--bg);border:1px solid var(--border);color:var(--text-light)">再坚持一下</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#btn-retire-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#btn-retire-confirm').addEventListener('click', () => {
      overlay.remove();
      state.passion = 0;
      state.phase = 'gameover';
      state.gameOverReason = months < 6
        ? '你在同人创作的门口短暂驻足，最终选择了转身离开。这不是失败——只是人生有太多可能性。'
        : hasWorks
        ? '不是热情燃尽，而是你主动选择了放下。也许这叫"体面退坑"——带着所有美好的记忆，去拥抱下一段人生。'
        : '你始终没能迈出创作的第一步，但在这个圈子里度过的每一天，看过的每一件作品，都是真实的快乐。';
      if (onRetire) onRetire();
    });
  });
}

// === Tutorial Overlay ===
const TUTORIAL_STEPS = [
  { target: '.phone-clock', title: '时间显示', body: '这是你的年龄和当前人生阶段。游戏从18岁高考后暑假开始，经历大学和工作。' },
  { target: '.phone-stats-grid', title: '核心属性', body: `四大核心数值一目了然：<br/><b>${ic('heart')} 热情</b> 生命值，归零=Game Over<br/><b>${ic('star')} 声誉</b> 决定市场份额和销量<br/><b>${ic('timer')} 闲暇</b> 每月可用天数，行动消耗天数<br/><b>${ic('megaphone')} 信息</b> 买家认知度，每月衰减` },
  { target: '.schedule-card', title: '月度日程', body: '每个月你可以执行<b>多个行动</b>，每个行动消耗若干天闲暇。时间轴会显示本月安排。<b>闲暇用完或手动点击「结束本月」</b>进入月末结算。剩余天数会自动转为休息恢复。' },
  { target: '.money-badge', title: '同人资金', body: '用于<b>同人创作和消费</b>的资金。印刷、参展路费、购买同人等都从这里扣。打工、接稿、售卖收入会增加。<b>变为负数时焦虑会消耗热情</b>。' },
  { target: '.app-icon[data-app="enzao"]', title: '嗯造', body: '创作同人本（多月项目）、制作谷子（单月完成）、追加印刷。<b>创作是你的核心活动</b>，完成后作品入库。同人本和谷子每月只能各做一次。' },
  { target: '.app-icon[data-app="xuanfa"]', title: '次元宣发机', body: '提高信息透明度，让更多潜在买家看到你的作品。<b>全力宣发</b>会进入社媒运营小游戏！信息每月衰减，要持续维护。' },
  { target: '.app-icon[data-app="manzhan"]', title: '漫展通', body: '参加同人展是<b>销售的黄金机会</b>，亲参会进入摊位小游戏。展会会消耗当月全部剩余闲暇。也可以在这里购买或出售谷子。' },
  { target: '.app-icon[data-app="ciyuanbi"]', title: '打破次元墙', body: `<b>人脉与协作</b>中心：<br/>· <b>寻找搭档</b>：从人脉池中选人合作，搭档能加速创作、提升销量<br/>· <b>外包助手</b>：花钱加速同人本进度<br/>· <b>赞助社区</b>：花钱提升声誉和曝光，同时认识新朋友<br/><br/>人脉通过<b>展会交换名片、赞助社区、线上宣发</b>积累。关系越深，搭档越靠谱！` },
  { target: '.app-icon[data-app="nyaner"]', title: 'Nyaner', body: '查看<b>圈内动态</b>（创作者们在干什么）和<b>今日新闻</b>（宏观经济、社会热点、文化现象）。同人市场数据请去「同人市场观察」App查看。' },
  { target: '.app-icon[data-app="prediction"]', title: '织梦交易', body: `<b>同人圈预测市场</b>——用真金白银押注圈子的未来，没空行动可以来玩：<br/>· 社群会涨还是跌？潮流会变吗？经济会衰退吗？<br/>· 买<b>YES</b>或<b>NO</b>份额，到期结算赢家得¥100/份<br/>· 可随时按当前价格<b>卖出</b>提前止盈止损<br/><br/>风险提示：判断错误会血本无归。量力而行！` },
  { target: '.app-icon[data-app="market"]', title: '同人市场观察', body: '查看详细的<b>市场数据</b>（社群人数、多样性、IP热度）和你的<b>创作者数据面板</b>（收入、销量、趋势图）。' },
  { target: '.app-icon[data-app="message"]', title: '短信', body: `<b>和朋友聊天：</b><br/>· <b>小柚</b>（闺蜜）：关心你的近况，给生活建议<br/>· <b>傲娇女神</b>（织梦）：当宏观经济事件发生时上线，用傲娇的方式解释同人经济学原理。抓住机会请教！<br/><br/>此外，如果有出版社看上你的作品，也会通过短信联系你。` },
  { target: '.phone-stats-panel', title: '叙事信息', body: '下拉展开可以查看<b>当前状态提示和叙事文本</b>。包括人生阶段描述、创作建议、状态徽章（搭档、同人本进度、经济下行等）。', expand: '#phone-stats-panel' },
  { target: null, title: '开始你的创作之旅', body: `<div style="text-align:left;line-height:1.8">· 先<b>创作</b>积累库存，再<b>宣发</b>让人知道你<br/>· 参加<b>同人展</b>卖出去，库存也有通贩收入<br/>· 关注<b>资金</b>，印刷和生活都要花钱<br/>· 上班后闲暇骤降，要<b>取舍</b><br/>· 热情低于30要及时<b>休息</b>！<br/>· 通过展会和社区活动积累<b>人脉</b>，找到好搭档</div>` },
];

export function renderTutorial(onDone) {
  let step = 0;
  let prevHighlight = null;
  let prevExpand = null;

  function cleanup() {
    if (prevHighlight) { prevHighlight.classList.remove('tut-highlight'); prevHighlight = null; }
    if (prevExpand) { prevExpand.classList.add('collapsed'); prevExpand = null; }
    document.getElementById('tut-overlay')?.remove();
    document.getElementById('tut-bubble')?.remove();
  }

  function render() {
    cleanup();
    const s = TUTORIAL_STEPS[step];
    const isLast = step === TUTORIAL_STEPS.length - 1;
    const total = TUTORIAL_STEPS.length;

    // Expand panel if needed
    if (s.expand) {
      const panel = document.querySelector(s.expand);
      if (panel) { panel.classList.remove('collapsed'); prevExpand = panel; }
    }

    // Highlight target
    const targetEl = s.target ? document.querySelector(s.target) : null;
    if (targetEl) { targetEl.classList.add('tut-highlight'); prevHighlight = targetEl; }

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'tut-overlay';
    overlay.className = 'tut-overlay';

    // Calculate bubble position class
    let bubbleClass = 'tut-bubble-center';
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      bubbleClass = rect.top < window.innerHeight * 0.4 ? 'tut-bubble-below' : 'tut-bubble-above';
    }

    document.body.appendChild(overlay);

    const bubble = document.createElement('div');
    bubble.id = 'tut-bubble';
    bubble.className = `tut-bubble ${bubbleClass}`;
    bubble.innerHTML = `
        <div class="tut-bubble-title">${s.title}</div>
        <div class="tut-bubble-text">${s.body}</div>
        <div class="tut-bubble-nav">
          <span style="font-size:0.7rem;color:var(--text-muted)">${step + 1} / ${total}</span>
          <span style="display:flex;gap:6px">
            ${step > 0 ? '<button class="btn btn-secondary" id="tut-prev" style="padding:4px 12px;min-height:32px;font-size:0.78rem">上一步</button>' : ''}
            <button class="btn btn-primary" id="tut-next" style="padding:4px 14px;min-height:32px;font-size:0.78rem">${isLast ? '开始游戏！' : '下一步'}</button>
          </span>
        </div>
        ${isLast ? '' : '<div style="text-align:center;margin-top:6px"><span id="tut-skip" style="font-size:0.65rem;color:var(--text-muted);cursor:pointer;text-decoration:underline">跳过教程</span></div>'}`;
    document.body.appendChild(bubble);

    const done = () => { cleanup(); onDone(); };
    document.getElementById('tut-next').addEventListener('click', () => { if (isLast) done(); else { step++; render(); } });
    document.getElementById('tut-prev')?.addEventListener('click', () => { step--; render(); });
    document.getElementById('tut-skip')?.addEventListener('click', done);
  }

  render();
}

// === Dashboard Overlay ===
function renderDashboard(state) {
  const h = state.history || [];
  const el = state.eventLog || [];
  const e = state.endowments || {};

  // --- Summary stats ---
  const totalEvents = el.length;
  const totalEventRev = el.reduce((s, x) => s + x.revenue, 0);
  const avgEventRev = totalEvents > 0 ? Math.round(totalEventRev / totalEvents) : 0;

  // --- Recent 12 months revenue bars ---
  const recent = h.slice(-12);
  const maxRev = Math.max(1, ...recent.map(r => r.turnRevenue));
  // Revenue line chart data
  const revLine = recent.map((r, i) => {
    const x = Math.round(i / Math.max(1, recent.length - 1) * 200);
    const y = Math.round((1 - r.turnRevenue / maxRev) * 50);
    return { x, y, isEvent: r.action === 'attendEvent', rev: r.turnRevenue, turn: r.turn };
  });
  const revPolyline = revLine.map(p => `${p.x},${p.y}`).join(' ');
  // Cumulative revenue line
  const cumMax = Math.max(1, ...recent.map(r => r.cumRevenue));
  const cumLine = recent.map((r, i) => {
    const x = Math.round(i / Math.max(1, recent.length - 1) * 200);
    const y = Math.round((1 - r.cumRevenue / cumMax) * 50);
    return `${x},${y}`;
  }).join(' ');

  // --- Reputation trend (last 12) ---
  const repRecent = h.slice(-12);
  const repMax = Math.max(1, ...repRecent.map(r => r.reputation));
  const repPoints = repRecent.map((r, i) => {
    const x = Math.round(i / Math.max(1, repRecent.length - 1) * 200);
    const y = Math.round((1 - r.reputation / repMax) * 40);
    return `${x},${y}`;
  }).join(' ');

  // --- Inventory bars ---
  const invMax = Math.max(1, state.inventory.hvpStock, state.inventory.lvpStock, 50);
  const hvpPct = Math.round(state.inventory.hvpStock / invMax * 100);
  const lvpPct = Math.round(state.inventory.lvpStock / invMax * 100);

  // --- Passion trend sparkline ---
  const passRecent = h.slice(-12);
  const passPoints = passRecent.map((r, i) => {
    const x = Math.round(i / Math.max(1, passRecent.length - 1) * 200);
    const y = Math.round((1 - r.passion / 100) * 40);
    return `${x},${y}`;
  }).join(' ');

  // --- Endowments radar-style display ---
  const endowHtml = Object.entries(ENDOWMENTS).map(([k, def]) => {
    const v = e[k] || 0;
    const dots = Array.from({length: 3}, (_, i) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${i < v ? 'var(--primary)' : '#E0E0E0'};margin:0 1px"></span>`).join('');
    return `<div style="display:flex;align-items:center;gap:6px;font-size:0.75rem"><span>${ic(def.emoji)}</span><span style="width:48px">${def.name}</span>${dots}</div>`;
  }).join('');

  // --- Event log (last 5) ---
  const recentEvents = el.slice(-5).reverse();
  const eventRows = recentEvents.length > 0
    ? recentEvents.map(ev => `<div style="display:flex;justify-content:space-between;font-size:0.72rem;padding:2px 0">
        <span>${ev.condition === 'popular' ? ic('fire') : ic('tent')} 第${ev.turn + 1}月 ${ev.name}@${ev.city}</span>
        <span style="color:${ev.revenue > 0 ? 'var(--success)' : 'var(--text-muted)'}">+¥${ev.revenue} (${ev.sold}件)</span>
      </div>`).join('')
    : '<div style="font-size:0.72rem;color:var(--text-muted)">还没有参展记录</div>';

  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `
    <div class="event-card" style="max-width:400px;max-height:85vh;overflow-y:auto;text-align:left">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-weight:700;font-size:1rem">${ic('chart-bar')} 创作者数据面板</div>
        <button class="btn btn-secondary" id="btn-close-dash" style="padding:2px 12px;font-size:0.8rem;min-height:28px">关闭</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
        <div style="text-align:center;padding:8px;background:#F8F9FA;border-radius:8px">
          <div style="font-size:1.1rem;font-weight:700;color:var(--primary)">¥${state.totalRevenue.toLocaleString()}</div>
          <div style="font-size:0.65rem;color:var(--text-muted)">累计收入</div>
        </div>
        <div style="text-align:center;padding:8px;background:#F8F9FA;border-radius:8px">
          <div style="font-size:1.1rem;font-weight:700">${state.totalSales}</div>
          <div style="font-size:0.65rem;color:var(--text-muted)">总销量(件)</div>
        </div>
        <div style="text-align:center;padding:8px;background:#F8F9FA;border-radius:8px">
          <div style="font-size:1.1rem;font-weight:700">${totalEvents}</div>
          <div style="font-size:0.65rem;color:var(--text-muted)">参展次数</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div style="text-align:center;padding:8px;background:#F8F9FA;border-radius:8px">
          <div style="font-size:1rem;font-weight:700">${state.totalHVP}</div>
          <div style="font-size:0.65rem;color:var(--text-muted)">同人志作品</div>
        </div>
        <div style="text-align:center;padding:8px;background:#F8F9FA;border-radius:8px">
          <div style="font-size:1rem;font-weight:700">${state.totalLVP}</div>
          <div style="font-size:0.65rem;color:var(--text-muted)">谷子批次</div>
        </div>
      </div>

      <div style="margin-bottom:12px">
        <div style="font-weight:600;font-size:0.8rem;margin-bottom:4px">${ic('package')} 库存</div>
        <div style="display:flex;align-items:center;gap:8px;font-size:0.75rem;margin-bottom:4px">
          <span style="width:36px">${ic('book-open-text')}×${state.inventory.hvpStock}</span>
          <div style="flex:1;height:10px;background:#E0E0E0;border-radius:5px;overflow:hidden"><div style="height:100%;width:${hvpPct}%;background:var(--primary);border-radius:5px"></div></div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;font-size:0.75rem">
          <span style="width:36px">${ic('key')}×${state.inventory.lvpStock}</span>
          <div style="flex:1;height:10px;background:#E0E0E0;border-radius:5px;overflow:hidden"><div style="height:100%;width:${lvpPct}%;background:var(--secondary);border-radius:5px"></div></div>
        </div>
      </div>

      ${recent.length > 1 ? `<div style="margin-bottom:12px">
        <div style="font-weight:600;font-size:0.8rem;margin-bottom:4px">${ic('coins')} 近${recent.length}月收入</div>
        <div style="display:flex;gap:12px;font-size:0.65rem;color:var(--text-muted);margin-bottom:2px"><span style="color:var(--primary)">● 月收入</span><span style="color:#F39C12">● 累计收入</span><span>● 展会月</span></div>
        <svg viewBox="-10 -8 220 68" style="width:100%;height:65px">
          <polyline points="${cumLine}" fill="none" stroke="#F39C12" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.6"/>
          <polyline points="${revPolyline}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linejoin="round"/>
          ${revLine.map(p => p.isEvent
            ? `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="var(--primary)" stroke="#fff" stroke-width="1"/>`
            : `<circle cx="${p.x}" cy="${p.y}" r="2" fill="#81D4FA"/>`
          ).join('')}
          <text x="0" y="64" font-size="7" fill="#999">第${recent[0].turn + 1}月</text>
          <text x="200" y="64" font-size="7" fill="#999" text-anchor="end">第${recent[recent.length - 1].turn + 1}月</text>
        </svg>
      </div>` : ''}

      ${repRecent.length > 1 ? `<div style="margin-bottom:12px">
        <div style="font-weight:600;font-size:0.8rem;margin-bottom:4px">${ic('star')} 声誉趋势 <span style="font-weight:400;color:var(--text-muted)">(当前 ${state.reputation.toFixed(1)})</span></div>
        <svg viewBox="-5 -5 210 50" style="width:100%;height:50px">
          <polyline points="${repPoints}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linejoin="round"/>
          ${repRecent.map((r, i) => {
            const x = Math.round(i / Math.max(1, repRecent.length - 1) * 200);
            const y = Math.round((1 - r.reputation / repMax) * 40);
            return `<circle cx="${x}" cy="${y}" r="2.5" fill="var(--primary)"/>`;
          }).join('')}
        </svg>
      </div>` : ''}

      ${passRecent.length > 1 ? `<div style="margin-bottom:12px">
        <div style="font-weight:600;font-size:0.8rem;margin-bottom:4px">${ic('heart')} 热情趋势 <span style="font-weight:400;color:var(--text-muted)">(当前 ${Math.round(state.passion)})</span></div>
        <svg viewBox="-5 -5 210 50" style="width:100%;height:50px">
          <polyline points="${passPoints}" fill="none" stroke="#E74C3C" stroke-width="2" stroke-linejoin="round"/>
          ${passRecent.map((r, i) => {
            const x = Math.round(i / Math.max(1, passRecent.length - 1) * 200);
            const y = Math.round((1 - r.passion / 100) * 40);
            return `<circle cx="${x}" cy="${y}" r="2.5" fill="#E74C3C"/>`;
          }).join('')}
        </svg>
      </div>` : ''}

      <div style="margin-bottom:12px">
        <div style="font-weight:600;font-size:0.8rem;margin-bottom:4px">${ic('tent')} 参展记录 ${totalEvents > 0 ? `<span style="font-weight:400;color:var(--text-muted)">场均¥${avgEventRev}</span>` : ''}</div>
        ${eventRows}
      </div>

      <div>
        <div style="font-weight:600;font-size:0.8rem;margin-bottom:4px">${ic('palette')} 禀赋</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">${endowHtml}</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#btn-close-dash').addEventListener('click', () => overlay.remove());
  // Click outside to close
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) overlay.remove(); });
}

// Narrative goes in the collapsible phone panel (折叠区)
function renderPhoneNarrative(state, partnerInfo, debuffInfo, recessionInfo, hvpInfo, unemployedInfo) {
  const age = getAge(state.turn);
  const stageLabel = getLifeStageLabel(state.turn, state);
  const month = ((state.turn + 6) % 12) + 1;
  const seasonIcon = month >= 3 && month <= 5 ? 'flower-lotus' : month >= 6 && month <= 8 ? 'sun' : month >= 9 && month <= 11 ? 'leaf' : 'snowflake';

  const badges = [unemployedInfo, hvpInfo, partnerInfo, debuffInfo, recessionInfo].filter(Boolean).join(' ');
  const sk = (state.totalHVP + state.totalLVP > 0) ? getCreativeSkill(state) : null;
  const invLine = (state.inventory.hvpStock > 0 || state.inventory.lvpStock > 0)
    ? `${ic('package')} 本×${state.inventory.hvpStock} 谷×${state.inventory.lvpStock}` : '';
  const skillLine = sk !== null ? `${ic('target')} Lv${sk.toFixed(1)} ${getSkillLabel(sk)}` : '';
  const narrative = (() => { const s = buildNarrativeSections(state); return renderAlertBanner(s.alerts) + renderSpotlightCard(s.spotlight) + renderPersonalNarrative(getNarrativeTitle(state), s.personal); })();

  return `
    <div class="phone-clock">
      <div class="phone-clock-time">${age}<span class="phone-clock-unit">岁</span></div>
      <div class="phone-clock-sub">${ic(seasonIcon)} ${stageLabel} · ${month}月</div>
    </div>
    <div class="phone-stats-panel collapsed" id="phone-stats-panel">
      <div class="phone-stats-handle" id="phone-stats-toggle"><div class="phone-stats-bar"></div></div>
      ${badges ? `<div class="phone-badges">${badges}</div>` : ''}
      ${invLine || skillLine ? `<div class="phone-inv">${invLine}${invLine && skillLine ? ' · ' : ''}${skillLine}</div>` : ''}
      <div style="padding:0 12px 8px">${narrative}</div>
    </div>`;
}

// Stats bar directly visible in game-content (不折叠)
function renderStatsBar(state) {
  const passionPct = Math.max(0, state.passion);
  const repPct = Math.min(100, state.reputation * 10);
  const timeRemaining = Math.max(0, state.time - (state.monthTimeSpent || 0));
  const timePct = Math.min(100, state.time * 10);
  const timeRemainingPct = Math.min(100, timeRemaining * 10);
  const infoPct = state.infoDisclosure * 100;

  return `
    <div class="phone-stats-grid" style="padding:0 12px 4px">
      <div class="phone-stat-card">
        <div class="phone-stat-header"><span>${ic('heart')} 热情</span><span class="phone-stat-val ${passionPct < 25 ? 'danger' : ''}">${Math.round(state.passion)}</span></div>
        <div class="phone-stat-bar-bg"><div class="stat-bar passion ${passionPct < 25 ? 'danger' : ''}" style="width:${passionPct}%"></div></div>
      </div>
      <div class="phone-stat-card">
        <div class="phone-stat-header"><span>${ic('star')} 声誉</span><span class="phone-stat-val">${state.reputation.toFixed(1)}</span></div>
        <div class="phone-stat-bar-bg"><div class="stat-bar reputation" style="width:${repPct}%"></div></div>
      </div>
      <div class="phone-stat-card">
        <div class="phone-stat-header"><span>${ic('timer')} 闲暇</span><span class="phone-stat-val ${timeRemaining <= 1 ? 'danger' : ''}">${timeRemaining}/${state.time}天</span></div>
        <div class="phone-stat-bar-bg" style="position:relative">
          <div class="stat-bar" style="width:${timePct}%;background:#D8D0C4;position:absolute;top:0;left:0;height:100%;border-radius:3px"></div>
          <div class="stat-bar time ${timeRemaining <= 1 ? 'danger' : ''}" style="width:${timeRemainingPct}%;position:relative;z-index:1"></div>
        </div>
      </div>
      <div class="phone-stat-card">
        <div class="phone-stat-header"><span>${ic('megaphone')} 信息</span><span class="phone-stat-val">${Math.round(infoPct)}%</span></div>
        <div class="phone-stat-bar-bg"><div class="stat-bar" style="width:${infoPct}%;background:linear-gradient(90deg,#E6A817,#F5D76E)"></div></div>
      </div>
    </div>`;
}

function renderStats(state) {
  const passionPct = Math.max(0, state.passion);
  const repPct = Math.min(100, state.reputation * 10);
  const timePct = Math.min(100, state.time * 10);
  const infoPct = state.infoDisclosure * 100;

  return `
    <div class="stats-panel">
      <div class="stat-row">
        <span class="stat-icon">${ic('heart')}</span>
        <span class="stat-label">热情</span>
        <div class="stat-bar-wrap">
          <div class="stat-bar passion ${passionPct < 25 ? 'danger' : ''}" style="width:${passionPct}%"></div>
        </div>
        <span class="stat-value">${Math.round(state.passion)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-icon">${ic('star')}</span>
        <span class="stat-label">声誉</span>
        <div class="stat-bar-wrap">
          <div class="stat-bar reputation" style="width:${repPct}%"></div>
        </div>
        <span class="stat-value">${state.reputation.toFixed(1)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-icon">${ic('timer')}</span>
        <span class="stat-label">时间</span>
        <div class="stat-bar-wrap">
          <div class="stat-bar time ${state.time <= 1 ? 'danger' : ''}" style="width:${timePct}%"></div>
        </div>
        <span class="stat-value">${state.time}/10</span>
      </div>
      <div class="stat-row">
        <span class="stat-icon">${ic('megaphone')}</span>
        <span class="stat-label">信息</span>
        <div class="stat-bar-wrap">
          <div class="stat-bar" style="width:${infoPct}%;background:linear-gradient(90deg,#E6A817,#F5D76E)"></div>
        </div>
        <span class="stat-value">${Math.round(infoPct)}%</span>
      </div>
      ${infoPct > 15 ? `<div style="font-size:0.65rem;color:var(--text-muted);text-align:right;padding-right:4px;margin-top:-4px">每月-7% · ${Math.ceil((infoPct - 8) / 7)}月后回到底线</div>` : ''}
      ${(state.inventory.hvpStock > 0 || state.inventory.lvpStock > 0) || (state.totalHVP + state.totalLVP > 0) ? `
      <div style="display:flex;justify-content:center;gap:12px;padding:6px 0;margin-top:4px;border-top:1px dashed var(--border);font-size:0.78rem;flex-wrap:wrap">
        ${(state.inventory.hvpStock > 0 || state.inventory.lvpStock > 0) ? `<span>${ic('package')} 本×${state.inventory.hvpStock} 谷×${state.inventory.lvpStock}</span>` : ''}
        ${(state.totalHVP + state.totalLVP > 0) ? (() => {
          const sk = getCreativeSkill(state);
          return `<span style="color:var(--secondary)">${ic('target')} 技艺Lv${sk.toFixed(1)} ${getSkillLabel(sk)}</span>`;
        })() : ''}
      </div>` : ''}
    </div>
  `;
}

function renderMarketPanel(market, official) {
  // IP Heat bar
  const ipHeat = official ? Math.round(official.ipHeat) : 80;
  const ipColor = ipHeat > 60 ? '#E74C3C' : ipHeat > 30 ? 'var(--warning)' : '#888';
  const divPct = Math.round(market.diversityHealth * 100);
  const confPct = Math.round(market.marketConfidence * 100);
  const divColor = divPct > 60 ? 'var(--success)' : divPct > 30 ? 'var(--warning)' : 'var(--danger)';
  const divLabel = divPct > 60 ? '健康' : divPct > 30 ? '脆弱' : '危险';
  const npcFeed = market.npcEvents.length > 0
    ? market.npcEvents.map(e => `<div style="font-size:0.72rem;color:var(--text-light);padding:2px 0">${e}</div>`).join('')
    : '<div style="font-size:0.72rem;color:var(--text-muted)">市场平稳运行中...</div>';

  return `
    <div class="market-panel collapsed">
      <div class="market-header" id="market-toggle">
        <span>${ic('storefront')} 市场生态 ${IP_TYPES[market.ipType]?.emoji ? ic(IP_TYPES[market.ipType].emoji) : ''}</span>
        <span style="display:flex;align-items:center;gap:8px">
          <span style="font-size:0.72rem">${ic('users')}${market.communitySize} 同人本创作者:${market.nHVP} 同人谷创作者:${market.nLVP}</span>
          <span style="font-size:0.72rem;color:${divColor}">${divLabel}</span>
          <span class="market-arrow">▼</span>
        </span>
      </div>
      <div class="market-body">
        <div style="display:flex;justify-content:space-around;padding:8px 0;font-size:0.78rem;text-align:center">
          <div><div style="font-weight:700;font-size:1.1rem">${market.communitySize.toLocaleString()}</div><div style="color:var(--text-muted)">社群人数</div></div>
          <div><div style="font-weight:700;font-size:1.1rem;color:var(--primary)">${market.nHVP}</div><div style="color:var(--text-muted)">同人本创作者</div></div>
          <div><div style="font-weight:700;font-size:1.1rem">${market.nLVP}</div><div style="color:var(--text-muted)">同人谷创作者</div></div>
        </div>
        <div class="stat-row" style="margin-top:4px">
          <span class="stat-icon">${ic('rainbow')}</span>
          <span class="stat-label">多样</span>
          <div class="stat-bar-wrap">
            <div class="stat-bar" style="width:${divPct}%;background:linear-gradient(90deg,${divColor},${divColor}88)"></div>
          </div>
          <span class="stat-value" style="color:${divColor}">${divPct}%</span>
        </div>
        <div class="stat-row">
          <span class="stat-icon">${ic('chart-bar')}</span>
          <span class="stat-label">信心</span>
          <div class="stat-bar-wrap">
            <div class="stat-bar" style="width:${confPct}%;background:linear-gradient(90deg,#3498DB,#81D4FA)"></div>
          </div>
          <span class="stat-value">${confPct}%</span>
        </div>
        <div class="stat-row">
          <span class="stat-icon">${ic('film-strip')}</span>
          <span class="stat-label">IP热</span>
          <div class="stat-bar-wrap">
            <div class="stat-bar" style="width:${ipHeat}%;background:linear-gradient(90deg,${ipColor},${ipColor}88)"></div>
          </div>
          <span class="stat-value">${ipHeat}</span>
        </div>
        ${market.currentTrend ? `<div style="font-size:0.75rem;padding:4px 0;color:var(--primary);font-weight:600">${ic('fire')} 热门话题: ${market.currentTrend.tag} (${market.currentTrend.turnsLeft}月)</div>` : ''}
        ${market.consumerAlpha < 0.9 ? `<div style="font-size:0.72rem;color:var(--danger);padding:4px 0">${ic('warning')} 消费者同人本偏好衰减: α=${market.consumerAlpha.toFixed(2)}</div>` : ''}
        ${official && official.secondHandPressure.lvp > 0.05 ? `<div style="font-size:0.72rem;color:${official.secondHandPressure.lvp > 0.3 ? 'var(--danger)' : 'var(--warning)'};padding:2px 0">${ic('package')} 二手谷子压力: ${Math.round(official.secondHandPressure.lvp * 100)}%${official.secondHandPressure.lvp > 0.3 ? ' ' + ic('warning') : ''}</div>` : ''}
        ${official && official.secondHandPressure.hvp > 0.05 ? `<div style="font-size:0.72rem;color:${official.secondHandPressure.hvp > 0.2 ? 'var(--danger)' : 'var(--warning)'};padding:2px 0">${ic('package')} 二手同人本压力: ${Math.round(official.secondHandPressure.hvp * 100)}%${official.secondHandPressure.hvp > 0.2 ? ' ' + ic('warning') : ''}</div>` : ''}
        <div style="margin-top:6px;border-top:1px solid var(--border);padding-top:6px">
          ${npcFeed}
        </div>
      </div>
    </div>
  `;
}

export function openBrowserApp() {
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `
    <div class="app-page" style="max-height:70vh">
      <div class="app-titlebar" style="border-bottom-color:#4285F4">
        <button class="app-back" id="browser-back">${ic('arrow-left')} 返回</button>
        <span class="app-title">${ic('globe')} 浏览器</span>
        <span style="width:60px"></span>
      </div>
      <div class="app-page-body" style="padding:20px 16px">
        <div style="text-align:center;margin-bottom:20px;color:var(--text-muted);font-size:0.8rem">想去哪里？</div>
        <a href="https://github.com/SeiKasahara/Dojin-econ-game/issues" target="_blank" rel="noopener" class="app-action-card" style="text-decoration:none;color:inherit;margin-bottom:10px">
          <div class="app-action-icon" style="color:#24292e">${ic('github-logo', '1.3rem')}</div>
          <div class="app-action-body">
            <div class="app-action-name">提交反馈 / Issue</div>
            <div class="app-action-cost">在 GitHub 上报告 Bug 或提出建议</div>
          </div>
          <div style="color:var(--text-muted)">${ic('arrow-right')}</div>
        </a>
        <a href="https://seikasahara.com/zh/" target="_blank" rel="noopener" class="app-action-card" style="text-decoration:none;color:inherit;margin-bottom:10px">
          <div class="app-action-icon" style="color:#2A9D8F">${ic('notebook', '1.3rem')}</div>
          <div class="app-action-body">
            <div class="app-action-name">同人经济学理论</div>
            <div class="app-action-cost">seikasahara.com/zh/</div>
          </div>
          <div style="color:var(--text-muted)">${ic('arrow-right')}</div>
        </a>
        <a href="https://wj.qq.com/s2/25896834/7619/" target="_blank" rel="noopener" class="app-action-card" style="text-decoration:none;color:inherit;margin-bottom:10px">
          <div class="app-action-icon" style="color:#FF6B35">${ic('clipboard-text', '1.3rem')}</div>
          <div class="app-action-body">
            <div class="app-action-name">同人经济学调查问卷</div>
            <div class="app-action-cost">帮助我们的研究，填写只需几分钟</div>
          </div>
          <div style="color:var(--text-muted)">${ic('arrow-right')}</div>
        </a>
        <a href="https://space.bilibili.com/4330116" target="_blank" rel="noopener" class="app-action-card" style="text-decoration:none;color:inherit">
          <div class="app-action-icon" style="color:#00A1D6">${ic('monitor-play', '1.3rem')}</div>
          <div class="app-action-body">
            <div class="app-action-name">作者 Bilibili</div>
            <div class="app-action-cost">关注作者的B站空间</div>
          </div>
          <div style="color:var(--text-muted)">${ic('arrow-right')}</div>
        </a>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#browser-back').addEventListener('click', () => overlay.remove());
}

export function openMarketApp(state) {
  const market = state.market;
  const official = state.official;

  // === Tab 1: 市场数据 ===
  let marketHtml = '';
  if (market) {
    const ipHeat = official ? Math.round(official.ipHeat) : 80;
    const ipColor = ipHeat > 60 ? '#E74C3C' : ipHeat > 30 ? 'var(--warning)' : '#888';
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
        <div class="stat-row"><span class="stat-icon">${ic('film-strip')}</span><span class="stat-label">IP热</span><div class="stat-bar-wrap"><div class="stat-bar" style="width:${ipHeat}%;background:linear-gradient(90deg,${ipColor},${ipColor}88)"></div></div><span class="stat-value">${ipHeat > 60 ? '火热' : ipHeat > 30 ? '温和' : '冷淡'}</span></div>
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
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <input type="range" id="reprice-slider" min="1" max="200" value="50" step="1" style="flex:1;accent-color:var(--primary)">
            <span id="reprice-label" style="font-weight:700;font-size:1rem;min-width:45px;text-align:center">¥50</span>
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

  // === Tab 2: 创作者数据 (from renderDashboard) ===
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
  const endowHtml = Object.entries(ENDOWMENTS).map(([k, def]) => {
    const v = e[k] || 0;
    const dots = Array.from({length: 3}, (_, i) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${i < v ? 'var(--primary)' : '#E0E0E0'};margin:0 1px"></span>`).join('');
    return `<div style="display:flex;align-items:center;gap:6px;font-size:0.75rem"><span>${ic(def.emoji)}</span><span style="width:48px">${def.name}</span>${dots}</div>`;
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
            const satPct = Math.round((w.totalSold || 0) / (cs * satCoeff) * 100);
            const satTag = satPct > 30 ? `<span style="color:${satPct > 70 ? 'var(--danger)' : '#E67E22'};font-size:0.58rem;margin-left:2px">饱${satPct}%</span>` : '';
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
      if (repricePanel) repricePanel.style.display = 'block';
      // Highlight active row
      overlay.querySelectorAll('.reprice-row').forEach(r => r.style.background = '');
      row.style.background = '#F0FAF8';
    });
  });

  if (repriceSlider) {
    repriceSlider.addEventListener('input', () => {
      const p = parseInt(repriceSlider.value);
      repriceLabel.textContent = '¥' + p;
      const work = (state.inventory.works || []).find(w => w.id === activeRepriceWid);
      if (work) {
        const diff = p - work.price;
        repriceHint.textContent = diff === 0 ? '价格未变' : diff > 0 ? `涨价 +¥${diff}` : `降价 ¥${diff}`;
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

function renderSocialFeed(feedItems) {
  if (!feedItems || feedItems.length === 0) return '';
  const typeEmoji = { npc: 'sparkle', trend: 'chart-bar', fan: 'heart', market: 'package', flavor: 'chat-circle-dots', drama: 'lightning' };
  const items = feedItems.map(f => `
    <div style="display:flex;gap:8px;align-items:flex-start;padding:4px 0;font-size:0.73rem;color:var(--text-light);border-bottom:1px dashed var(--border)">
      <span style="flex-shrink:0">${ic(typeEmoji[f.type] || 'chat-circle')}</span>
      <span>${f.text}</span>
    </div>
  `).join('');
  return `
    <div class="market-panel collapsed" style="margin-top:6px">
      <div class="market-header" id="feed-toggle">
        <span>${ic('chat-circle')} 圈内动态</span>
        <span class="market-arrow">▼</span>
      </div>
      <div class="market-body" style="padding:4px 0">
        ${items}
      </div>
    </div>
  `;
}

// === SNS Panel ===
function renderSNSButton(state) {
  const feedCount = state.market?.socialFeed?.length || 0;
  const sections = buildNarrativeSections(state);
  const worldCount = sections.world.market.length + sections.world.official.length + sections.world.advanced.length;
  const total = feedCount + worldCount;
  return `<button class="sns-fab" id="sns-fab">${ic('chat-circle-dots', '1.3rem')}${total > 0 ? `<span class="sns-badge">${total}</span>` : ''}</button>`;
}

export function openSNSPanel(state) {
  const typeIcon = { npc: 'sparkle', trend: 'chart-bar', fan: 'heart', market: 'package', flavor: 'chat-circle-dots', drama: 'lightning' };
  const typeHandle = { npc: '创作者', trend: '趋势话题', fan: '粉丝', market: '市场观察', flavor: '闲聊', drama: '热搜' };
  const avatarColor = { npc: '#264653', trend: '#F5A623', fan: '#FF6B9D', market: '#00A8E8', flavor: '#6B8A7A', drama: '#E76F51' };
  const timeLabels = ['刚刚', '3分钟前', '8分钟前', '15分钟前', '28分钟前', '1小时前', '2小时前', '3小时前'];

  // Build feed HTML
  const feedItems = state.market?.socialFeed || [];
  const feedHtml = feedItems.length === 0
    ? `<div style="text-align:center;padding:40px 20px;color:var(--text-muted);font-size:0.82rem">${ic('chat-circle-dots', '2rem')}<br><br>暂时没有新动态</div>`
    : feedItems.map((f, i) => {
      const authorName = f.author || '匿名';
      const time = timeLabels[Math.min(i, timeLabels.length - 1)];
      const handle = typeHandle[f.type] || '动态';
      const hotTag = f.hot ? `<span class="sns-hot-tag">${ic('fire', '0.6rem')} 热门</span>` : '';
      // Stable avatar from prop-npc based on author name hash
      let nameHash = 0;
      for (let c = 0; c < authorName.length; c++) nameHash = ((nameHash << 5) - nameHash + authorName.charCodeAt(c)) | 0;
      const avatarIdx = (Math.abs(nameHash) % 30) + 1;

      return `
      <div class="sns-feed-item">
        <img class="sns-feed-avatar" src="prop-npc/${avatarIdx}.webp" style="object-fit:cover" alt="">
        <div class="sns-feed-body">
          <div class="sns-feed-meta">
            <span class="sns-feed-author">${authorName}</span>
            <span class="sns-feed-handle">@${handle}</span>
            <span class="sns-feed-dot">·</span>
            <span class="sns-feed-time">${time}</span>
            ${hotTag}
          </div>
          <div class="sns-feed-text">${f.text}</div>
          ${f.commentTexts?.length ? `<div class="sns-feed-comments">${f.commentTexts.map(c => `<div class="sns-comment">${c}</div>`).join('')}</div>` : ''}
          <div class="sns-feed-stats">
            <span>${ic('chat-circle', '0.75rem')} ${f.comments || 0}</span>
            <span>${ic('arrows-clockwise', '0.75rem')} ${f.retweets || 0}</span>
            <span>${ic('heart', '0.75rem')} ${f.likes || 0}</span>
          </div>
        </div>
      </div>`;
    }).join('');

  // Build world news HTML (macro economy & life headlines, not market data)
  const worldNews = generateWorldNews(state);
  const categoryIcons = { macro: 'chart-line-up', life: 'newspaper', quirky: 'smiley-wink', app: 'device-mobile' };
  const categoryLabels = { macro: '财经', life: '社会', quirky: '趣闻', app: '科技' };
  const worldHtml = worldNews.length === 0
    ? '<div style="text-align:center;padding:40px 20px;color:var(--text-muted);font-size:0.82rem">暂无新闻</div>'
    : worldNews.map(n => `
      <div class="sns-feed-item" style="padding:10px 14px">
        <div style="width:32px;height:32px;border-radius:50%;background:${n.category === 'macro' ? '#3498DB' : n.category === 'app' ? '#9B59B6' : n.category === 'quirky' ? '#F39C12' : '#27AE60'};display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;font-size:0.75rem">${ic(categoryIcons[n.category] || 'newspaper')}</div>
        <div class="sns-feed-body">
          <div class="sns-feed-meta">
            <span class="sns-feed-author">${categoryLabels[n.category] || '新闻'}</span>
            <span class="sns-feed-time">今日</span>
          </div>
          <div class="sns-feed-text">${n.text}</div>
        </div>
      </div>`).join('');

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'sns-overlay';
  overlay.innerHTML = `
    <div class="sns-backdrop" id="sns-backdrop"></div>
    <div class="sns-panel">
      <div class="sns-drag-bar"></div>
      <div class="sns-topbar">
        <div class="sns-topbar-avatar">${ic('user', '0.9rem')}</div>
        <span class="sns-topbar-title">Nyaner</span>
        <button class="sns-close" id="sns-close">${ic('x-circle', '1.2rem')}</button>
      </div>
      <div class="sns-header">
        <div class="sns-tabs">
          <div class="sns-tab active" data-tab="feed">圈内动态</div>
          <div class="sns-tab" data-tab="world">今日新闻</div>
        </div>
      </div>
      <div class="sns-content">
        <div class="sns-tab-content" id="sns-tab-feed">${feedHtml}</div>
        <div class="sns-tab-content" id="sns-tab-world" style="display:none">${worldHtml}</div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // Bind events
  const close = () => { overlay.remove(); };
  overlay.querySelector('#sns-backdrop').addEventListener('click', close);
  overlay.querySelector('#sns-close').addEventListener('click', close);
  overlay.querySelectorAll('.sns-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      overlay.querySelectorAll('.sns-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      overlay.querySelector('#sns-tab-feed').style.display = tab.dataset.tab === 'feed' ? '' : 'none';
      overlay.querySelector('#sns-tab-world').style.display = tab.dataset.tab === 'world' ? '' : 'none';
    });
  });
}

// === App Desktop ===
export const APP_DEFS = [
  { id: 'enzao', name: '嗯造', icon: 'palette', color: '#2A9D8F', actions: ['hvp', 'lvp', 'reprint'], logo: 'app logos/嗯造.avif' },
  { id: 'xuanfa', name: '次元宣发机', icon: 'megaphone', color: '#E6A817', actions: ['promote_light', 'promote_heavy'], logo: 'app logos/次元宣发机.jpg' },
  { id: 'miaohuashi', name: '喵画师', icon: 'paint-brush', color: '#9B59B6', actions: ['freelance'], logo: 'app logos/喵画师.avif' },
  { id: 'miaosi', name: '喵丝职聘', icon: 'briefcase', color: '#5B7DB1', actions: ['partTimeJob', 'jobSearch', 'quitForDoujin'], logo: 'app logos/喵丝职聘.avif' },
  { id: 'manzhan', name: '漫展通', icon: 'tent', color: '#E84393', actions: ['attendEvent', 'buyGoods', 'sellGoods'], logo: 'app logos/漫展通.avif' },
  { id: 'ciyuanbi', name: '打破次元墙', icon: 'handshake', color: '#27AE60', actions: ['findPartner', 'hireAssistant', 'sponsorCommunity'], logo: 'app logos/打破次元壁.jpg' },
  { id: 'rest', name: '休息', icon: 'coffee', color: '#8B6914', actions: ['rest'], special: true, logo: 'app logos/休息.avif' },
  { id: 'memu', name: 'Memu', icon: 'desktop', color: '#3498DB', actions: ['upgradeEquipment'], special: true, logo: 'app logos/Memu.avif' },
  { id: 'prediction', name: '织梦交易', icon: 'chart-line-up', color: '#F39C12', actions: [], special: 'prediction', logo: 'app logos/织梦交易.avif' },
  { id: 'market', name: '同人市场观察', icon: 'chart-bar', color: '#34495E', actions: [], special: 'market', logo: 'app logos/同人市场观察.jpg' },
  { id: 'nyaner', name: 'Nyaner', icon: 'chat-circle-dots', color: '#1DA1F2', actions: [], special: 'sns', logo: 'app logos/Nyaner.avif' },
  { id: 'message', name: '短信', icon: 'envelope', color: '#2ECC71', actions: ['goCommercial'], special: 'message', logo: 'app logos/短信.png' },
  { id: 'browser', name: '浏览器', icon: 'globe', color: '#4285F4', actions: [], special: 'browser' },
];

function renderAppDesktop(state) {
  const feedCount = (state.market?.socialFeed?.length || 0) + (state.market ? 3 : 0); // approx world items

  const apps = APP_DEFS.map(app => {
    // Disabled logic
    let disabled = false;
    if (app.special === 'sns' || app.special === 'market' || app.special === 'browser' || app.special === 'prediction') {
      disabled = false; // always available
    } else if (app.special === 'message') {
      disabled = false; // always available (闺蜜 + 女神 always there)
    } else if (app.id === 'manzhan') {
      disabled = false; // always available (漫展日历不需要条件)
    } else if (app.id === 'ciyuanbi') {
      disabled = false; // always available (赞助社群随时可用)
    } else {
      disabled = !app.actions.some(a => canPerformAction(state, a));
    }

    // Badge logic
    let badge = '';
    if (app.id === 'enzao' && state.hvpProject) badge = `<span class="app-badge">${state.hvpProject.progress}/${state.hvpProject.needed}</span>`;
    if (app.id === 'manzhan' && state.availableEvents?.length) badge = `<span class="app-badge">${state.availableEvents.length}</span>`;
    if (app.id === 'ciyuanbi' && state.hasPartner) badge = `<span class="app-badge">${ic('check', '0.6rem')}</span>`;
    if (app.id === 'nyaner' && feedCount > 0) badge = `<span class="app-badge">${feedCount}</span>`;
    if (app.id === 'message') {
      const hasPublisher = state.commercialOfferReceived;
      const hasGoddess = !!state._goddessEvent;
      const hasWelcome = state._welcomeMessagesSent && ((state._chatUsage?.bestie || 0) === 0);
      const msgCount = (hasPublisher ? 1 : 0) + (hasGoddess ? 1 : 0) + (hasWelcome ? 1 : 0);
      if (msgCount > 0) badge = `<span class="app-badge">${msgCount}</span>`;
    }

    const iconContent = app.logo
      ? `<div class="app-icon-bg app-icon-logo"><img src="${app.logo}" alt="${app.name}"></div>`
      : `<div class="app-icon-bg" style="background:${app.color}">${ic(app.icon, '1.5rem')}</div>`;

    return `
      <div class="app-icon ${disabled ? 'disabled' : ''}" data-app="${app.id}">
        ${iconContent}
        <div class="app-icon-name">${app.name}</div>
        ${badge}
      </div>`;
  }).join('');

  return `<div class="app-desktop">${apps}</div>`;
}

export function renderAppPage(appId, state, onAction, onBack) {
  const app = APP_DEFS.find(a => a.id === appId);
  if (!app) return;

  // Build action cards for this app
  const cards = app.actions.map(actionId => {
    const action = ACTIONS[actionId];
    if (!action) return '';
    const display = getActionDisplay(actionId, state) || action;
    const disabled = !canPerformAction(state, actionId);
    let disableReason = '';
    if (disabled) {
      const r = action.requires;
      if (r.time && state.time < r.time) {
        disableReason = actionId === 'hvp' ? `需闲暇≥${r.time}天（有搭档≥2天）` : `需闲暇≥${r.time}天`;
      } else if (r.passion && state.passion < r.passion) disableReason = '热情不足';
    }
    return `
      <div class="app-action-card ${disabled ? 'disabled' : ''}" data-action="${actionId}">
        <div class="app-action-icon" style="color:${app.color}">${ic(display.emoji, '1.3rem')}</div>
        <div class="app-action-body">
          <div class="app-action-name">${display.name}</div>
          <div class="app-action-cost">${disabled && disableReason ? disableReason : display.costLabel}</div>
        </div>
      </div>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `
    <div class="app-page">
      <div class="app-titlebar" style="border-bottom-color:${app.color}">
        <button class="app-back" id="app-back">${ic('arrow-left')} 返回</button>
        <span class="app-title">${ic(app.icon)} ${app.name}</span>
        <span style="width:60px"></span>
      </div>
      <div class="app-page-body">
        ${cards}
        ${appId === 'xuanfa' ? '<div style="text-align:center;font-size:0.6rem;color:var(--text-muted);padding:8px 0 4px;opacity:0.7">由 Openclaw 集成的 AI 宣发机，全网都能广播到！</div>' : ''}
        ${appId === 'ciyuanbi' && state.contacts?.length > 0 ? (() => {
          const tierColors = { acquaintance: '#95a5a6', familiar: '#3498db', trusted: '#27ae60' };
          const tierLabels = { acquaintance: '认识', familiar: '熟悉', trusted: '信任' };
          const contactsList = [...state.contacts]
            .sort((a, b) => b.affinity - a.affinity)
            .map(c => {
              const tc = tierColors[c.tier] || '#95a5a6';
              const tl = tierLabels[c.tier] || '';
              return `<div class="contact-row" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
                <img src="partner/${c.avatarIdx}.webp" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid ${tc}">
                <div style="flex:1;min-width:0">
                  <div style="font-size:0.78rem;font-weight:600;display:flex;gap:4px;align-items:center">${c.name} <span style="font-size:0.58rem;padding:0 4px;border-radius:6px;background:${tc}18;color:${tc}">${tl}</span></div>
                  <div style="font-size:0.65rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.bio}</div>
                </div>
                <button class="contact-remove" data-cid="${c.id}" data-affinity="${c.affinity}" data-name="${c.name}" style="background:none;border:none;color:var(--danger);cursor:pointer;padding:4px;font-size:0.8rem" title="断联">${ic('trash', '0.8rem')}</button>
              </div>`;
            }).join('');
          return `<div style="margin-top:16px;padding-top:12px;border-top:2px solid var(--border)">
            <div class="contact-pool-count" style="font-size:0.8rem;font-weight:700;margin-bottom:8px">${ic('users')} 人脉池 (${state.contacts.length})</div>
            <div style="max-height:200px;overflow-y:auto">${contactsList}</div>
          </div>`;
        })() : ''}
        ${appId === 'manzhan' ? (() => {
          ensureEventCalendar(state);
          const cal = state.eventCalendar || [];
          const MTAG = { 1: '寒假', 5: '五一', 7: '暑假', 8: '暑假', 10: '国庆' };
          const curIdx = Math.max(0, cal.findIndex(e => e.turn === state.turn));
          return `<div style="margin-top:16px;padding-top:12px;border-top:2px solid var(--border)">
            <div style="font-size:0.8rem;font-weight:700;margin-bottom:8px">${ic('calendar-dots')} 漫展年历</div>
            <div id="ecal-months" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;-webkit-overflow-scrolling:touch">
              ${cal.map((entry, i) => {
                const isCur = entry.turn === state.turn;
                const has = entry.events.length > 0;
                const tag = MTAG[entry.month] || '';
                return `<span class="ecal-pill" data-idx="${i}" style="flex-shrink:0;padding:5px 10px;border-radius:14px;font-size:0.72rem;cursor:pointer;border:1.5px solid ${isCur ? '#E84393' : 'var(--border)'};background:${isCur ? '#E8439318' : 'var(--bg-card)'};text-align:center;position:relative;white-space:nowrap;user-select:none;line-height:1.3;transition:all 0.15s">
                  ${entry.month}月${tag ? `<br><span style="font-size:0.55rem;opacity:0.6">${tag}</span>` : ''}
                  ${has ? '<span style="position:absolute;top:2px;right:2px;width:5px;height:5px;border-radius:50%;background:#E84393"></span>' : ''}
                </span>`;
              }).join('')}
            </div>
            <div id="ecal-body" data-default="${curIdx}"></div>
          </div>`;
        })() : ''}
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // Bind
  overlay.querySelector('#app-back').addEventListener('click', () => { overlay.remove(); if (onBack) onBack(); });
  overlay.querySelectorAll('.app-action-card:not(.disabled)').forEach(el => {
    el.addEventListener('click', () => { overlay.remove(); onAction(el.dataset.action); });
  });
  // Bind contact removal (断联)
  overlay.querySelectorAll('.contact-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cid = parseInt(btn.dataset.cid);
      const affinity = parseFloat(btn.dataset.affinity) || 0;
      const cname = btn.dataset.name || '';
      const row = btn.closest('.contact-row');
      // Reputation penalty scales with affinity × network density
      // Denser network (more contacts, more high-affinity) = word spreads faster
      const networkSize = (state.contacts || []).length;
      const highAffinityCount = (state.contacts || []).filter(c => c.affinity >= 2).length;
      const densityMult = 1 + Math.min(1.0, highAffinityCount * 0.15); // 0 close friends→1.0x, 3→1.45x, 7+→2.0x
      const basePenalty = affinity >= 4 ? Math.min(4, (affinity - 1) * 1.0)   // trusted: -3.0~-4.0
        : affinity >= 2 ? Math.min(3, (affinity - 1) * 0.75)                  // familiar: -0.75~-2.25
        : 0.1 + affinity * 0.03;                                              // acquaintance: -0.1~-0.16
      const repPenalty = Math.round(basePenalty * densityMult * 100) / 100;
      const doRemove = (deductRep) => {
        if (deductRep) state.reputation = Math.max(0, state.reputation - repPenalty);
        state.contacts = state.contacts.filter(c => c.id !== cid);
        if (state.activeContactId === cid) {
          state.hasPartner = false; state.partnerType = null; state.partnerTurns = 0; state.activeContactId = null;
        }
        row?.remove();
        const countEl = overlay.querySelector('.contact-pool-count');
        if (countEl) countEl.innerHTML = `${ic('users')} 人脉池 (${state.contacts.length})`;
      };
      // Show confirmation modal
      const modal = document.createElement('div');
      modal.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center';
      const backdrop = document.createElement('div');
      backdrop.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.45)';
      const panel = document.createElement('div');
      panel.style.cssText = 'position:relative;background:var(--card-bg,#fff);border-radius:16px;padding:24px 20px 16px;max-width:300px;width:85%;box-shadow:0 8px 32px rgba(0,0,0,0.25);text-align:center';
      if (repPenalty > 0) {
        const relDesc = affinity >= 4 ? '关系很深' : affinity >= 2 ? '关系不错' : '虽然只是点头之交，但圈子里传出去也不好听';
        panel.innerHTML = `
          <div style="font-size:1.5rem;margin-bottom:8px">${ic('warning','1.5rem')}</div>
          <div style="font-size:0.9rem;font-weight:700;margin-bottom:6px">确认断联？</div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px">你和 <b>${cname}</b> ${relDesc}</div>
          <div style="font-size:0.78rem;color:var(--danger);font-weight:600;margin-bottom:16px">断联将损失 ${repPenalty.toFixed(2)} 声誉</div>
          <div style="display:flex;gap:10px;justify-content:center">
            <button class="confirm-modal-cancel" style="flex:1;padding:8px 0;border-radius:10px;border:1px solid var(--border);background:var(--bg,#f5f5f5);color:var(--text);font-size:0.8rem;cursor:pointer">取消</button>
            <button class="confirm-modal-ok" style="flex:1;padding:8px 0;border-radius:10px;border:none;background:var(--danger);color:#fff;font-size:0.8rem;font-weight:600;cursor:pointer">确认断联</button>
          </div>`;
      } else {
        panel.innerHTML = `
          <div style="font-size:0.9rem;font-weight:700;margin-bottom:6px">确认断联？</div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:16px">将 <b>${cname}</b> 从人脉池中移除</div>
          <div style="display:flex;gap:10px;justify-content:center">
            <button class="confirm-modal-cancel" style="flex:1;padding:8px 0;border-radius:10px;border:1px solid var(--border);background:var(--bg,#f5f5f5);color:var(--text);font-size:0.8rem;cursor:pointer">取消</button>
            <button class="confirm-modal-ok" style="flex:1;padding:8px 0;border-radius:10px;border:none;background:var(--danger);color:#fff;font-size:0.8rem;font-weight:600;cursor:pointer">确认</button>
          </div>`;
      }
      modal.appendChild(backdrop);
      modal.appendChild(panel);
      document.body.appendChild(modal);
      backdrop.addEventListener('click', () => modal.remove());
      panel.querySelector('.confirm-modal-cancel').addEventListener('click', () => modal.remove());
      panel.querySelector('.confirm-modal-ok').addEventListener('click', () => {
        doRemove(repPenalty > 0);
        modal.remove();
      });
    });
  });
  // Bind event calendar month switching (漫展年历)
  if (appId === 'manzhan') {
    const ecalBody = overlay.querySelector('#ecal-body');
    const ecalPills = overlay.querySelectorAll('.ecal-pill');
    if (ecalBody && ecalPills.length > 0) {
      const cal = state.eventCalendar || [];
      const attended = state.calendarEventsAttended || [];
      const sIcon = { mega: ic('star-four'), big: ic('tent'), small: ic('note-pencil') };
      const sLabel = { mega: '全国盛典', big: '大型展会', small: '小型展会' };

      function showCalMonth(idx) {
        ecalPills.forEach(p => {
          const pi = parseInt(p.dataset.idx);
          const sel = pi === idx;
          const cur = cal[pi]?.turn === state.turn;
          p.style.background = sel ? '#E84393' : (cur ? '#E8439318' : 'var(--bg-card)');
          p.style.color = sel ? '#fff' : 'var(--text)';
          p.style.borderColor = sel ? '#E84393' : (cur ? '#E84393' : 'var(--border)');
        });
        const entry = cal[idx];
        if (!entry || entry.events.length === 0) {
          ecalBody.innerHTML = `<div style="text-align:center;padding:20px 12px;color:var(--text-muted);font-size:0.78rem">${ic('calendar-x')} 本月无同人展安排</div>`;
          return;
        }
        const isCur = entry.turn === state.turn;
        ecalBody.innerHTML = `${isCur ? `<div style="font-size:0.65rem;color:#E84393;font-weight:600;margin-bottom:6px">${ic('map-pin-area', '0.65rem')} 当前月份</div>` : `<div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:6px">${entry.turn < state.turn ? '已过去' : `${entry.turn - state.turn}个月后`}</div>`}` +
          entry.events.map(e => {
            const done = attended.includes(e.calendarId);
            const isPast = entry.turn < state.turn;
            const dimmed = done || isPast;
            const tag = done ? ' <span style="color:var(--text-muted)">✓ 已参加</span>' : isPast ? ' <span style="color:var(--text-muted)">已过期</span>' : '';
            return `<div style="padding:10px 12px;margin-bottom:6px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border);${dimmed ? 'opacity:0.4;' : ''}">
              <div style="font-weight:600;font-size:0.8rem;margin-bottom:3px">${sIcon[e.size] || ''} ${e.name}${tag}</div>
              <div style="font-size:0.7rem;color:var(--text-muted)">${ic('map-pin', '0.65rem')} ${e.city} · 路费¥${e.travelCost} · ${e.salesBoost >= 4 ? '盛况空前' : e.salesBoost >= 2.5 ? '人气旺盛' : e.salesBoost >= 1.5 ? '人流一般' : '比较冷清'}</div>
              <div style="font-size:0.62rem;color:var(--text-muted);margin-top:2px">${sLabel[e.size] || ''}</div>
            </div>`;
          }).join('');
      }

      ecalPills.forEach(p => p.addEventListener('click', () => showCalMonth(parseInt(p.dataset.idx))));
      showCalMonth(parseInt(ecalBody.dataset.default || '0'));
      // Scroll current month pill into view
      const curPill = overlay.querySelector(`.ecal-pill[data-idx="${ecalBody.dataset.default}"]`);
      if (curPill) setTimeout(() => curPill.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }), 50);
    }
  }
}

export function renderMessageApp(state, onAction, onBack) {
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';

  // Dynamically import to check goddess state
  import('./chat-npc.js').then(({ getBestieRemaining, getBestieCooldown, getGoddessState, CHAT_CHARACTERS }) => {
    const bestieRemain = getBestieRemaining(state);
    const bestieCd = getBestieCooldown(state);
    const goddessState = getGoddessState(state);

    let bestieSubtitle;
    if (bestieRemain > 0) bestieSubtitle = '闺蜜 · 有空聊天';
    else if (bestieCd > 0) bestieSubtitle = `闺蜜 · ${bestieCd}个月后再聊`;
    else bestieSubtitle = '闺蜜 · 忙去了';

    const contacts = [
      { id: 'bestie', name: '小柚', subtitle: bestieSubtitle, color: '#E84393', avatar: 'Goddess/Guimi.jpg', disabled: bestieRemain <= 0 },
    ];
    if (goddessState) {
      contacts.push({ id: 'goddess', name: '傲娇女神织梦', subtitle: goddessState.remaining > 0 ? `${goddessState.topic} · 剩${goddessState.remaining}条` : '已离开', color: '#9B59B6', avatar: 'Goddess/goddess.jpg', badge: goddessState.remaining > 0, disabled: goddessState.remaining <= 0 });
    } else {
      contacts.push({ id: 'goddess', name: '傲娇女神织梦', subtitle: '不在线', color: '#9B59B6', avatar: 'Goddess/goddess.jpg', disabled: true });
    }
    if (state.commercialOfferReceived) {
      contacts.push({ id: 'publisher', name: '某出版社编辑', subtitle: '新消息！', color: '#2ECC71', icon: 'building-office', badge: true });
    }

    overlay.innerHTML = `
      <div class="app-page">
        <div class="app-titlebar" style="border-bottom-color:#2ECC71">
          <button class="app-back" id="app-back">${ic('arrow-left')} 返回</button>
          <span class="app-title">${ic('envelope')} 短信</span>
          <span style="width:60px"></span>
        </div>
        <div class="app-page-body">
          ${contacts.map(c => `
            <div class="app-action-card ${c.disabled ? 'disabled' : ''}" data-contact="${c.id}" style="cursor:${c.disabled ? 'default' : 'pointer'};${c.disabled ? 'opacity:0.5;' : ''}">
              ${c.avatar
                ? `<img src="${c.avatar}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid ${c.color}">`
                : `<div style="width:40px;height:40px;border-radius:50%;background:${c.color};display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff">${ic(c.icon || 'user', '1.1rem')}</div>`
              }
              <div class="app-action-body">
                <div class="app-action-name">${c.name} ${c.badge ? `<span style="background:var(--danger);color:#fff;font-size:0.55rem;padding:1px 5px;border-radius:8px;margin-left:4px">新</span>` : ''}</div>
                <div class="app-action-cost">${c.subtitle}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#app-back').addEventListener('click', () => { overlay.remove(); if (onBack) onBack(); });

    overlay.querySelectorAll('.app-action-card:not(.disabled)[data-contact]').forEach(el => {
      el.addEventListener('click', () => {
        const contactId = el.dataset.contact;
        overlay.remove();
        if (contactId === 'publisher') {
          renderPublisherMessage(state, onAction, onBack);
        } else {
          renderChatView(state, contactId, onAction, onBack);
        }
      });
    });
  });
}

function renderPublisherMessage(state, onAction, onBack) {
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `
    <div class="app-page">
      <div class="app-titlebar" style="border-bottom-color:#2ECC71">
        <button class="app-back" id="app-back">${ic('arrow-left')} 返回</button>
        <span class="app-title">${ic('building-office')} 某出版社编辑</span>
        <span style="width:60px"></span>
      </div>
      <div class="app-page-body" style="padding:16px">
        <div style="background:#F0FAF0;border-radius:var(--radius);padding:14px;font-size:0.82rem;line-height:1.6;color:var(--text);margin-bottom:16px">
          你好！我是XX出版社的编辑。在上次展会后一直在关注你的作品——我们很看好你的创作实力。<br><br>
          不知道你有没有兴趣聊聊商业出版？
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:16px;line-height:1.5">
          ${ic('lightbulb')} 接受后将告别同人创作，开启商业出道结局。
        </div>
        <button class="btn btn-primary btn-block" id="msg-accept" style="margin-bottom:8px">${ic('star')} 接受邀约</button>
        <button class="btn btn-block" id="msg-decline" style="background:var(--bg);border:1px solid var(--border);color:var(--text-light)">暂时不考虑</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#app-back').addEventListener('click', () => { overlay.remove(); renderMessageApp(state, onAction, onBack); });
  overlay.querySelector('#msg-decline').addEventListener('click', () => { overlay.remove(); renderMessageApp(state, onAction, onBack); });
  overlay.querySelector('#msg-accept').addEventListener('click', () => { overlay.remove(); onAction('goCommercial'); });
}

async function renderChatView(state, characterId, onAction, onBack) {
  if (characterId === 'bestie') {
    return renderBestieChat(state, onAction, onBack);
  }
  return renderGoddessChat(state, onAction, onBack);
}

// === Bestie: preset dialog with choices ===
async function renderBestieChat(state, onAction, onBack) {
  const { CHAT_CHARACTERS, getBestieRemaining } = await import('./chat-npc.js');
  const { pickBestieDialog } = await import('./bestie-dialogs.js');
  const char = CHAT_CHARACTERS.bestie;

  if (!state._chatHistory) state._chatHistory = {};
  if (!state._chatHistory.bestie) state._chatHistory.bestie = [];
  const history = state._chatHistory.bestie;

  // First open: inject greeting
  if (history.length === 0) {
    history.push({ role: 'assistant', content: char.getGreeting(state) });
  }

  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function render() {
    const remaining = getBestieRemaining(state);
    const gone = remaining <= 0;
    // Pick a new dialog if we need to show choices
    const needsDialog = !gone && !history._pendingDialog && history[history.length - 1]?.role === 'assistant';
    if (needsDialog) {
      history._pendingDialog = pickBestieDialog(state);
      // If last message is greeting, show the dialog npc message too
      if (history.length === 1 || history[history.length - 1]?.content !== history._pendingDialog.npc) {
        history.push({ role: 'assistant', content: history._pendingDialog.npc });
      }
    }

    const msgsHtml = history.filter(m => typeof m === 'object' && m.role).map(m => `
      <div style="display:flex;margin-bottom:8px;${m.role === 'user' ? 'flex-direction:row-reverse' : ''}">
        <div style="max-width:80%;padding:8px 12px;border-radius:12px;font-size:0.8rem;line-height:1.5;${
          m.role === 'user'
            ? 'background:var(--primary);color:#fff;border-bottom-right-radius:4px'
            : 'background:var(--bg);border:1px solid var(--border);color:var(--text);border-bottom-left-radius:4px'
        }">${escapeHtml(m.content)}</div>
      </div>`).join('');

    const dialog = history._pendingDialog;
    const choicesHtml = (!gone && dialog) ? `
      <div style="display:flex;flex-direction:column;gap:6px;padding:8px 12px">
        ${dialog.replies.map((r, i) => `
          <button class="btn bestie-reply" data-idx="${i}" style="text-align:left;padding:8px 12px;font-size:0.78rem;background:var(--bg-card);border:1.5px solid var(--border);border-radius:12px;cursor:pointer">${escapeHtml(r.text)}</button>
        `).join('')}
      </div>` : '';

    overlay.innerHTML = `
      <div class="app-page" style="display:flex;flex-direction:column;height:80vh">
        <div class="app-titlebar" style="border-bottom-color:${char.color};flex-shrink:0">
          <button class="app-back" id="chat-back">${ic('arrow-left')} 返回</button>
          <span class="app-title" style="display:flex;align-items:center;gap:6px">
            <img src="${char.avatar}" style="width:24px;height:24px;border-radius:50%;object-fit:cover">
            ${char.name}
          </span>
          <span style="width:60px"></span>
        </div>
        <div id="chat-messages" style="flex:1;overflow-y:auto;padding:12px;-webkit-overflow-scrolling:touch">
          ${msgsHtml}
          ${choicesHtml}
          ${gone ? `<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:0.78rem">${char.goneMessage}</div>` : ''}
        </div>
      </div>`;

    if (!document.body.contains(overlay)) document.body.appendChild(overlay);

    const msgBox = overlay.querySelector('#chat-messages');
    msgBox.scrollTop = msgBox.scrollHeight;

    overlay.querySelector('#chat-back').addEventListener('click', () => { overlay.remove(); renderMessageApp(state, onAction, onBack); });

    // Bind reply choices
    overlay.querySelectorAll('.bestie-reply').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const reply = dialog.replies[idx];
        // Player chose
        history.push({ role: 'user', content: reply.text });
        // Bestie responds
        history.push({ role: 'assistant', content: reply.response });
        history._pendingDialog = null;
        // Track usage + mark cooldown start
        if (!state._chatUsage) state._chatUsage = {};
        state._chatUsage.bestie = (state._chatUsage.bestie || 0) + 1;
        state._bestieLastChatTurn = state.turn; // start 3-month cooldown
        // Grow bestie affinity (hidden stat)
        state.bestieAffinity = Math.min(100, (state.bestieAffinity || 10) + 3);
        render();
      });
    });
  }

  render();
}

// === Goddess: AI-powered free-input chat ===
async function renderGoddessChat(state, onAction, onBack) {
  const { chatWithNPC, CHAT_CHARACTERS, getGoddessState } = await import('./chat-npc.js');
  const char = CHAT_CHARACTERS.goddess;

  if (!state._chatHistory) state._chatHistory = {};
  if (!state._chatHistory.goddess) {
    state._chatHistory.goddess = [];
    const gs = getGoddessState(state);
    if (gs?.opening) state._chatHistory.goddess.push({ role: 'assistant', content: gs.opening });
  }
  const history = state._chatHistory.goddess;

  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function render() {
    const gs = getGoddessState(state);
    const remaining = gs ? gs.remaining : 0;
    const gone = remaining <= 0;

    const msgsHtml = history.map(m => `
      <div style="display:flex;margin-bottom:8px;${m.role === 'user' ? 'flex-direction:row-reverse' : ''}">
        <div style="max-width:75%;padding:8px 12px;border-radius:12px;font-size:0.8rem;line-height:1.5;${
          m.role === 'user'
            ? 'background:var(--primary);color:#fff;border-bottom-right-radius:4px'
            : 'background:var(--bg);border:1px solid var(--border);color:var(--text);border-bottom-left-radius:4px'
        }">${escapeHtml(m.content)}</div>
      </div>`).join('');

    overlay.innerHTML = `
      <div class="app-page" style="display:flex;flex-direction:column;height:80vh">
        <div class="app-titlebar" style="border-bottom-color:${char.color};flex-shrink:0">
          <button class="app-back" id="chat-back">${ic('arrow-left')} 返回</button>
          <span class="app-title" style="display:flex;align-items:center;gap:6px">
            <img src="${char.avatar}" style="width:24px;height:24px;border-radius:50%;object-fit:cover">
            ${char.name}
          </span>
          <span style="width:60px"></span>
        </div>
        <div id="chat-messages" style="flex:1;overflow-y:auto;padding:12px;-webkit-overflow-scrolling:touch">
          ${msgsHtml}
          ${gone ? `<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:0.78rem">${char.goneMessage}</div>` : ''}
        </div>
        <div style="padding:8px 12px;border-top:1px solid var(--border);display:flex;gap:8px;flex-shrink:0;background:var(--bg-card)">
          <input id="chat-input" type="text" placeholder="${gone ? '女神已离开' : `说点什么…（剩${remaining}条）`}" ${gone ? 'disabled' : ''} style="flex:1;border:1.5px solid var(--border);border-radius:20px;padding:8px 14px;font-size:0.8rem;outline:none;background:var(--bg)">
          <button id="chat-send" class="btn btn-primary" style="padding:8px 14px;border-radius:20px;font-size:0.8rem" ${gone ? 'disabled' : ''}>${ic('paper-plane-right')}</button>
        </div>
      </div>`;

    if (!document.body.contains(overlay)) document.body.appendChild(overlay);

    const msgBox = overlay.querySelector('#chat-messages');
    msgBox.scrollTop = msgBox.scrollHeight;

    overlay.querySelector('#chat-back').addEventListener('click', () => { overlay.remove(); renderMessageApp(state, onAction, onBack); });

    if (!gone) {
      const input = overlay.querySelector('#chat-input');
      const sendBtn = overlay.querySelector('#chat-send');

      async function send() {
        const text = input.value.trim();
        if (!text) return;
        input.value = '';

        history.push({ role: 'user', content: text });
        render();

        const msgBox2 = overlay.querySelector('#chat-messages');
        const typing = document.createElement('div');
        typing.style.cssText = 'text-align:left;padding:4px 0;font-size:0.75rem;color:var(--text-muted)';
        typing.textContent = `${char.name}正在输入...`;
        msgBox2.appendChild(typing);
        msgBox2.scrollTop = msgBox2.scrollHeight;

        const reply = await chatWithNPC('goddess', history, state);
        typing.remove();

        if (reply === null) {
          render();
        } else {
          history.push({ role: 'assistant', content: reply });
          render();
        }
      }

      sendBtn.addEventListener('click', send);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) send(); });
      input.focus();
    }
  }

  render();
}

function renderActionCard(action, state) {
  const display = getActionDisplay(action.id, state) || action;
  const disabled = !canPerformAction(state, action.id);
  let disableReason = '';
  if (disabled) {
    const r = action.requires;
    if (r.time && state.time < r.time) {
      disableReason = action.id === 'hvp' ? `需闲暇≥${r.time}天（有搭档≥2天）` : `需闲暇≥${r.time}天`;
    } else if (r.passion && state.passion < r.passion) disableReason = '热情不足';
  }
  // Highlight if HVP in progress
  const highlight = action.id === 'hvp' && state.hvpProject ? 'border-color:var(--primary);background:#F0FAF8;' : '';

  return `
    <div class="action-card ${disabled ? 'disabled' : ''}" data-action="${action.id}" style="${highlight}">
      <span class="action-emoji">${ic(display.emoji)}</span>
      <span class="action-name">${display.name}</span>
      <span class="action-cost">${disabled && disableReason ? disableReason : display.costLabel}</span>
    </div>
  `;
}

// === Result Screen ===
// === Grouped Delta Display ===
function renderGroupedDeltas(deltas) {
  // Categorize deltas by icon/label keywords
  const groups = { passion: [], money: [], reputation: [], inventory: [], other: [] };
  const passionIcons = ['heart', 'smiley-nervous', 'smiley-sad', 'globe', 'hourglass', 'money', 'fire', 'smiley-meh', 'chat-circle', 'confetti'];
  const moneyIcons = ['coins', 'printer', 'handshake', 'briefcase', 'house', 'globe-simple'];
  const repIcons = ['star', 'megaphone', 'trend-up'];
  const invIcons = ['package', 'key', 'book-open-text'];

  for (const d of deltas) {
    if (passionIcons.includes(d.icon)) groups.passion.push(d);
    else if (moneyIcons.includes(d.icon)) groups.money.push(d);
    else if (repIcons.includes(d.icon)) groups.reputation.push(d);
    else if (invIcons.includes(d.icon)) groups.inventory.push(d);
    else groups.other.push(d);
  }

  const renderItems = (items) => items.map(d => {
    const critical = !d.positive && (d.label.includes('热情') || d.label.includes('焦虑'));
    return `<div class="delta-item" ${critical ? 'style="background:#FFF0F0;border-radius:4px;padding:1px 4px;margin:-1px -4px"' : ''}>
      <span class="delta-icon">${ic(d.icon)}</span>
      <span style="flex:1">${d.label}</span>
      <span class="${d.positive ? 'delta-positive' : 'delta-negative'}">${d.value}</span>
    </div>`;
  }).join('');

  const sections = [
    { key: 'passion', label: ic('heart') + ' 热情', items: groups.passion },
    { key: 'money', label: ic('coins') + ' 收支', items: groups.money },
    { key: 'reputation', label: ic('star') + ' 声誉', items: groups.reputation },
    { key: 'inventory', label: ic('package') + ' 库存', items: groups.inventory },
    { key: 'other', label: ic('note-pencil') + ' 其他', items: groups.other },
  ].filter(s => s.items.length > 0);

  // If total deltas ≤ 6, show flat (no grouping needed)
  if (deltas.length <= 6) return renderItems(deltas);

  return sections.map(s => `
    <div style="margin-bottom:4px">
      <div style="font-size:0.7rem;font-weight:600;color:var(--text-muted);padding:2px 0;border-bottom:1px solid var(--border);margin-bottom:2px">${s.label}</div>
      ${renderItems(s.items)}
    </div>
  `).join('');
}

export function renderResult(state, result, onContinue) {
  const tipHtml = result.tip ? `
    <div class="tip-box">
      <div class="tip-label">${result.tip.label}</div>
      <div class="tip-text">${result.tip.text}</div>
    </div>
  ` : '';

  // Only show newly earned achievements
  const prevCount = (state._prevAchievementCount || 0);
  const newAchievements = state.achievements.slice(prevCount);
  state._prevAchievementCount = state.achievements.length;

  const achieveHtml = newAchievements.map(id => {
    const a = getAchievementInfo(id);
    return `<div style="text-align:center;padding:8px;background:#FFF8E8;border-radius:8px;margin-bottom:8px;animation:achievePop 0.6s cubic-bezier(0.34,1.56,0.64,1)">
      <span style="font-size:1.5rem">${ic(a.emoji)}</span>
      <div style="font-weight:700;font-size:0.85rem;margin-top:4px">${a.name}</div>
      <div style="font-size:0.75rem;color:var(--text-light)">${a.desc}</div>
    </div>`;
  }).join('');

  // Chart placeholder
  const chartId = ''; // supply-demand chart removed (info fog)

  app().innerHTML = `
    <div class="screen">
      <div class="game-header">
        <span class="turn-badge">第 ${state.turn} 回合结果</span>
        <span class="money-badge">¥${state.money.toLocaleString()}</span>
      </div>

      ${renderStats(state)}

      <div class="game-content game-content--frosted">
        <div class="result-box">
          <h3>${ic(result.actionEmoji)} ${result.actionName}</h3>
          ${renderGroupedDeltas(result.deltas)}
        </div>

        ${result.salesInfo ? renderSalesBreakdown(result.salesInfo, result.salesDetails) : ''}

        ${chartId ? `<div class="result-box" style="padding:12px">
          <h3 style="font-size:0.85rem;margin-bottom:8px">${ic('chart-bar')} 供需曲线</h3>
          <div id="${chartId}"></div>
          <p style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;text-align:center">
            声誉↑需求曲线右移 · 信息透明度↑转化率提升 · 绿色=你的收入
          </p>
        </div>` : ''}

        ${result.digitalSalesDetails ? (() => {
          const d = result.digitalSalesDetails;
          const total = result.digitalSalesTotal;
          const collapsed = d.length > 3;
          const rows = d.map(item =>
            `<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:0.7rem">
              <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(item.name)}</span>
              <span style="flex-shrink:0;color:var(--text-muted);margin:0 6px">×${item.sales} @¥${item.price}</span>
              <span style="flex-shrink:0;font-weight:600;color:var(--success)">+¥${item.rev}</span>
            </div>`
          ).join('');
          return `<div class="market-panel${collapsed ? ' collapsed' : ''}" style="margin-bottom:10px">
            <div class="market-header" style="cursor:${collapsed ? 'pointer' : 'default'}">
              <span>${ic('phone')} 电子版被动收入 <span style="font-weight:700;color:var(--success)">+¥${total}</span> <span style="color:var(--text-muted);font-size:0.7rem">(${d.length}部)</span></span>
              ${collapsed ? '<span class="market-arrow">▼</span>' : ''}
            </div>
            <div class="market-body" style="padding:4px 0">${rows}</div>
          </div>`;
        })() : ''}

        ${result.predictionSettlements ? (() => {
          const ps = result.predictionSettlements;
          const totalPL = ps.reduce((s, p) => s + p.profit, 0);
          const collapsed = ps.length > 3;
          const rows = ps.map(p => {
            const sideLabel = p.side === 'yes' ? 'YES' : 'NO';
            const sideColor = p.won ? 'var(--success)' : 'var(--danger)';
            const resultIcon = p.won ? '${ic("check-circle","0.65rem")}' : '${ic("x-circle","0.65rem")}';
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:0.7rem;border-bottom:1px dashed var(--border)">
              <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.question)}</span>
              <span style="flex-shrink:0;margin:0 4px;font-size:0.62rem;color:var(--text-muted)">结果${p.outcome} · 持${sideLabel}×${p.shares}</span>
              <span style="flex-shrink:0;font-weight:600;color:${sideColor}">${p.won ? '+¥' + p.payout : '-¥' + p.cost}</span>
            </div>`;
          }).join('');
          const plColor = totalPL >= 0 ? 'var(--success)' : 'var(--danger)';
          return `<div class="market-panel${collapsed ? ' collapsed' : ''}" style="margin-bottom:10px">
            <div class="market-header" style="cursor:${collapsed ? 'pointer' : 'default'}">
              <span>${ic('chart-line-up')} 织梦交易结算 <span style="font-weight:700;color:${plColor}">${totalPL >= 0 ? '+' : ''}¥${totalPL}</span> <span style="color:var(--text-muted);font-size:0.7rem">(${ps.length}笔)</span></span>
              ${collapsed ? '<span class="market-arrow">▼</span>' : ''}
            </div>
            <div class="market-body" style="padding:4px 0">${rows}</div>
          </div>`;
        })() : ''}

        ${result.monthFinancial ? (() => {
          const f = result.monthFinancial;
          const profit = f.income - f.expense;
          const profitColor = profit > 0 ? 'var(--success, #27AE60)' : profit < 0 ? 'var(--danger, #E74C3C)' : 'var(--text-muted)';
          const profitSign = profit > 0 ? '+' : profit < 0 ? '-' : '';
          return `<div class="result-box" style="padding:12px">
            <h3 style="font-size:0.85rem;margin-bottom:10px">${ic('chart-pie')} 本月盈亏汇总</h3>
            <div style="display:flex;gap:8px;margin-bottom:8px">
              <div style="flex:1;text-align:center;padding:8px;border-radius:8px;background:#E8F8F0">
                <div style="font-size:0.65rem;color:var(--text-muted)">收入</div>
                <div class="result-counter" data-count-to="${f.income}" data-prefix="+¥" style="font-size:1rem;font-weight:700;color:#27AE60">+¥0</div>
              </div>
              <div style="flex:1;text-align:center;padding:8px;border-radius:8px;background:#FDF0F0">
                <div style="font-size:0.65rem;color:var(--text-muted)">支出</div>
                <div class="result-counter" data-count-to="${f.expense}" data-prefix="-¥" style="font-size:1rem;font-weight:700;color:#E74C3C">-¥0</div>
              </div>
            </div>
            <div class="result-profit--${profit > 0 ? 'positive' : profit < 0 ? 'negative' : ''}" style="text-align:center;padding:8px;border-radius:8px;background:var(--bg-card);border:2px solid ${profitColor}">
              <div style="font-size:0.65rem;color:var(--text-muted)">毛利</div>
              <div class="result-counter" data-count-to="${Math.abs(profit)}" data-prefix="${profitSign}¥" style="font-size:1.1rem;font-weight:700;color:${profitColor}">${profitSign}¥0</div>
            </div>
          </div>`;
        })() : ''}

        ${achieveHtml}
        ${tipHtml}
      </div>

      <div class="bottom-bar result-bottom-bar">
        <button class="btn btn-primary btn-block" id="btn-continue">继续 →</button>
      </div>
    </div>
  `;

  // Animate financial counters
  document.querySelectorAll('.result-counter').forEach(el => {
    const target = parseInt(el.dataset.countTo) || 0;
    const prefix = el.dataset.prefix || '';
    if (target === 0) { el.textContent = prefix + '0'; return; }
    const duration = 600;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = prefix + Math.round(target * eased).toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
    };
    setTimeout(() => requestAnimationFrame(step), 300);
  });

  // Draw chart if applicable
  if (result.supplyDemand) {
    const container = document.getElementById(chartId);
    if (container) {
      const canvas = createChartCanvas();
      container.appendChild(canvas);
      drawSupplyDemand(canvas, result.supplyDemand, true);
    }
  }

  $('#btn-continue').addEventListener('click', onContinue);
  // Collapsible panels in result screen
  document.querySelectorAll('.market-panel .market-header').forEach(h => {
    h.addEventListener('click', () => h.closest('.market-panel').classList.toggle('collapsed'));
  });
}

// === Event Overlay ===
// === Sales Breakdown (educational waterfall) ===
function renderSalesBreakdown(s, salesDetails) {
  // Narrative intuition panel — no precise numbers, only causal signals
  const insights = [];

  // Market size signal
  const csLabel = s.communitySize > 15000 ? '社群人气很旺，潜在买家多' : s.communitySize > 8000 ? '社群规模中等' : s.communitySize > 3000 ? '社群规模偏小' : '社群人丁稀少';
  insights.push({ icon: 'users', text: csLabel, positive: s.communitySize > 8000 });

  // Reputation → share
  const shareLabel = s.playerShare > 30 ? '你在圈里很有存在感，不少人专程来找你' : s.playerShare > 15 ? '有一部分人认识你，会优先看你的摊位' : s.playerShare > 5 ? '知道你的人不多，大部分人只是路过' : '你还是无名小卒，需要更多曝光';
  insights.push({ icon: 'star', text: shareLabel, positive: s.playerShare > 15 });

  // Info disclosure → conversion
  const convLabel = s.conversion > 60 ? '你的宣传做得很到位，看到的人大多愿意掏钱' : s.conversion > 40 ? '有一定曝光度，路人转化率还行' : '很多人不知道你在卖什么，需要加强宣传';
  insights.push({ icon: 'megaphone', text: convLabel, positive: s.conversion > 40 });

  // Modifiers as narrative
  if (s.partnerMult > 100) insights.push({ icon: 'handshake', text: '搭档帮忙招揽了更多客人', positive: true });
  if (s.shModPct < 90) insights.push({ icon: 'package', text: '二手市场上的竞品分流了一些买家', positive: false });
  if (s.eventBoost > 100) insights.push({ icon: 'tent', text: '展会的面对面接触大大提升了成交意愿', positive: true });
  if (s.catalogBonus > 105) insights.push({ icon: 'books', text: '丰富的产品线吸引了更多人驻足', positive: true });
  if (s.qualityDemandBonus > 110) insights.push({ icon: 'sparkle', text: '作品质量本身就是最好的广告', positive: true });
  if (s.infoHighBonus > 100) insights.push({ icon: 'chat-circle', text: '口碑效应带来了额外的客流', positive: true });
  if (s.alphaMod < 95) insights.push({ icon: 'warning', text: '消费者对同人本的兴趣在衰退，市场在萎缩', positive: false });
  if (s.communitySize < 5000 && s.playerShare > 30) insights.push({ icon: 'crown', text: '小圈子里的绝对核心——但市场天花板也近在咫尺', positive: true });

  const insightsHtml = insights.map(i =>
    `<div style="display:flex;align-items:flex-start;gap:6px;padding:3px 0;font-size:0.72rem">
      <span style="flex-shrink:0;color:${i.positive ? 'var(--success)' : 'var(--danger)'}">${ic(i.icon, '0.72rem')}</span>
      <span style="color:${i.positive ? 'var(--text)' : 'var(--danger)'}">${i.text}</span>
    </div>`
  ).join('');

  // Per-work narrative breakdown
  let workNarrativeHtml = '';
  if (salesDetails && salesDetails.length > 0) {
    const rows = salesDetails.filter(d => d.sold > 0).map(d => {
      const w = d.work;
      const sub = w.type === 'hvp' ? (HVP_SUBTYPES[w.subtype] || HVP_SUBTYPES.manga) : (LVP_SUBTYPES[w.subtype] || LVP_SUBTYPES.acrylic);
      const name = `${sub.name}${w.name ? '·' + escapeHtml(w.name) : ''}`;
      const reasons = [];
      if (d.noveltyBonus > 1) reasons.push('<span style="color:#27AE60">新刊效应</span>');
      if (d.qualityMult > 1.2) reasons.push('<span style="color:var(--success)">质量出众</span>');
      else if (d.qualityMult < 0.8) reasons.push('<span style="color:var(--danger)">质量堪忧</span>');
      if (d.trendMult > 1.1) reasons.push('<span style="color:#27AE60">踩中潮流</span>');
      else if (d.trendMult < 0.9) reasons.push('<span style="color:#E67E22">不合时宜</span>');
      if (d.saturationFactor < 0.5) reasons.push('<span style="color:var(--danger)">市场饱和</span>');
      if (d.ageDecay < 0.7) reasons.push('<span style="color:#E67E22">老作品热度消退</span>');
      return `<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:0.68rem">
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ic(sub.emoji)} ${name}</span>
        <span style="flex-shrink:0;margin:0 4px;color:var(--text-muted)">${reasons.join(' ')}</span>
        <span style="flex-shrink:0;font-weight:600">${d.sold}${w.type === 'hvp' ? '本' : '个'}</span>
      </div>`;
    }).join('');
    if (rows) {
      workNarrativeHtml = `<div style="padding:6px 0;border-top:1px dashed var(--border)">
        <div style="font-weight:700;color:var(--secondary);margin-bottom:4px">${ic('list-dashes')} 各作品表现</div>
        ${rows}
      </div>`;
    }
  }

  return `
    <div class="market-panel collapsed" style="margin-bottom:10px">
      <div class="market-header" id="breakdown-toggle">
        <span>${ic('lightbulb')} 销售直觉分析</span>
        <span class="market-arrow">▼</span>
      </div>
      <div class="market-body" style="font-size:0.75rem">
        <div style="padding:6px 0;font-size:0.68rem;color:var(--text-muted);font-style:italic;margin-bottom:4px">
          作为创作者，你不会看到精确的公式——但你能凭直觉感知到这些因素在起作用：
        </div>
        ${insightsHtml}
        ${workNarrativeHtml}
        <div style="padding:6px 0;font-size:0.65rem;color:var(--text-muted);border-top:1px dashed var(--border);margin-top:4px">
          ${ic('lightbulb', '0.6rem')} 提升销量的关键：声誉决定有多少人知道你，宣传决定多少人愿意买，作品质量决定口碑能否扩散。
        </div>
      </div>
    </div>
  `;
}

// === Price Selection Screen ===
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
        <div style="color:var(--text-muted);font-style:italic;margin-top:2px">${isHVP ? '同人本是"想要但不是必须"的东西——定价太高，犹豫的人就不买了' : '谷子对粉丝来说几乎是"必买品"——涨一点价，大多数人还是会买'}</div>
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
    else if (ratio <= 5) thought = '我是不是疯了…算了，定都定了';
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
  '琉璃', '翡翠', '珀', '银', '苍', '绯', '藏蓝', '茜', '墨', '白',
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
          <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px">热情-5 · 闲暇≥3天 · 路费+住宿餐饮+摊位≈¥${event.travelCost + Math.round(event.travelCost * 1.2 + 200)} · 连续参展有疲劳</div>
          ${(state.time - (state.monthTimeSpent || 0)) < 3 ? `<div style="font-size:0.65rem;color:var(--danger);margin-top:2px">${ic('warning')} 闲暇不足（剩余${state.time - (state.monthTimeSpent || 0)}天），无法亲参</div>` : ''}
        </div>
        <div class="price-btn mode-btn" data-mode="consign" style="padding:12px;cursor:pointer">
          <div style="font-weight:700;font-size:0.9rem">${ic('package')} 寄售委托</div>
          <div style="font-size:0.72rem;color:var(--text-light);margin-top:2px">委托朋友或摊主代售，无需亲自到场。销量由市场供需模型决定。</div>
          <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px">热情-2 · 闲暇≥1天 · 邮费¥${Math.round(event.travelCost * 0.3)} · 无参展疲劳</div>
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
    const satPct = Math.round((w.totalSold || 0) / (cs * satCoeff) * 100);
    const satLabel = satPct <= 30 ? '<span style="color:var(--success);font-size:0.62rem">市场空间充足</span>'
      : satPct <= 70 ? `<span style="color:#E67E22;font-size:0.62rem">饱和${satPct}%</span>`
      : `<span style="color:var(--danger);font-size:0.62rem">饱和${satPct}%</span>`;
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

  // Per-work quantity map: workId → { qty, unitCost, isHVP, name }
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

export function renderEvent(event, onDismiss) {
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `
    <div class="event-card">
      <div class="event-emoji">${ic(event.emoji)}</div>
      <div class="event-title">${event.title}</div>
      <div class="event-desc">${event.desc}</div>
      <div class="event-effect ${event.effectClass}">${event.effect}</div>
      <div class="tip-box" style="text-align:left;margin-bottom:16px">
        <div class="tip-label">经济学原理</div>
        <div class="tip-text">${event.tip}</div>
      </div>
      <button class="btn btn-primary btn-block" id="btn-dismiss-event">了解 →</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#btn-dismiss-event').addEventListener('click', () => {
    overlay.remove();
    onDismiss();
  });
}

// === Game Over ===
export function renderGameOver(state, onRestart) {
  const survived = state.turn;
  const age = getAge(state.turn);
  const stage = getLifeStage(state.turn);
  const isCommercial = state.commercialTransition;
  const isTampered = state.tampered;
  const isOpenEnding = state.openEnding;
  const title = isTampered ? '叙事崩溃' : isOpenEnding ? '待续……' : isCommercial ? '商业出道' : survived >= 48 ? '传奇落幕' : survived >= 24 ? '旅程结束' : survived >= 12 ? '一段经历' : '遗憾退场';
  const emoji = isTampered ? 'bug' : isOpenEnding ? 'shooting-star' : isCommercial ? 'star-four' : survived >= 48 ? 'trophy' : survived >= 24 ? 'book-open-text' : survived >= 12 ? 'star-four' : 'smiley-sad';

  const stageText = stage === 'work' ? '工作后' : stage === 'university' ? '大学期间' : '暑假';

  const shareText = isOpenEnding
    ? `我在「同人社团物语」中从18岁暑假到42岁，走过了24年的同人创作之路！` +
      `声誉最高${state.maxReputation.toFixed(1)}，` +
      `制作了${state.totalHVP}本同人志和${state.totalLVP}批谷子，累计销售额¥${state.totalRevenue.toLocaleString()}。` +
      `故事还在继续——你的同人人生会是什么样？`
    : isCommercial
    ? `我在「同人社团物语」中从18岁暑假开始创作，` +
      `在${age}岁时成功商业出道！` +
      `声誉最高${state.maxReputation.toFixed(1)}，` +
      `制作了${state.totalHVP}本同人志，累计销售额¥${state.totalRevenue.toLocaleString()}。` +
      `从同人到商业，你能做到吗？`
    : `我在「同人社团物语」中从18岁的暑假开始创作，` +
    `坚持到了${age}岁（${stageText}），` +
    `声誉最高${state.maxReputation.toFixed(1)}，` +
    `制作了${state.totalHVP}本同人志和${state.totalLVP}批谷子。` +
    `你的同人创作之路能走多远？`;

  const achieveHtml = state.achievements
    .filter(id => !id.endsWith('_encounter'))
    .map(id => {
      const a = getAchievementInfo(id);
      return `<span style="display:inline-block;background:#FFF8E8;padding:4px 10px;border-radius:20px;font-size:0.8rem;margin:3px">${ic(a.emoji)} ${a.name}</span>`;
    }).join('');

  app().innerHTML = `
    <div class="screen gameover-screen">
      <div class="go-emoji">${ic(emoji)}</div>
      <h2>${title}</h2>
      <p class="go-subtitle">${state.gameOverReason}</p>

      <div class="go-stats">
        <div class="go-stat-item"><span>起点</span><span class="go-stat-val">18岁 高考后暑假</span></div>
        <div class="go-stat-item"><span>背景</span><span class="go-stat-val">${ic(BACKGROUNDS[state.background]?.emoji || 'house')} ${BACKGROUNDS[state.background]?.name || '普通家庭'}</span></div>
        <div class="go-stat-item"><span>IP</span><span class="go-stat-val">${ic(IP_TYPES[state.market?.ipType]?.emoji || 'star-four')} ${IP_TYPES[state.market?.ipType]?.name || '潜力IP'}</span></div>
        <div class="go-stat-item"><span>禀赋</span><span class="go-stat-val">${Object.entries(state.endowments || {}).map(([k, v]) => `${ENDOWMENTS[k]?.emoji ? ic(ENDOWMENTS[k].emoji) : ''}${v}`).join(' ')}</span></div>
        <div class="go-stat-item"><span>终点</span><span class="go-stat-val">${age}岁 · ${stageText}</span></div>
        <div class="go-stat-item"><span>坚持月数</span><span class="go-stat-val">${survived} 个月</span></div>
        <div class="go-stat-item"><span>最高声誉</span><span class="go-stat-val">${state.maxReputation.toFixed(1)}</span></div>
        <div class="go-stat-item"><span>同人志</span><span class="go-stat-val">${state.totalHVP} 本</span></div>
        <div class="go-stat-item"><span>谷子</span><span class="go-stat-val">${state.totalLVP} 批</span></div>
        <div class="go-stat-item"><span>总销量</span><span class="go-stat-val">${state.totalSales} 件</span></div>
        <div class="go-stat-item"><span>总销售额</span><span class="go-stat-val">¥${state.totalRevenue.toLocaleString()}</span></div>
      </div>

      ${achieveHtml ? `<div style="margin-bottom:16px;text-align:center">${achieveHtml}</div>` : ''}

      <div class="share-card">
        <div class="share-text">${shareText}</div>
        <button class="btn btn-secondary btn-block mt-8" id="btn-copy" style="font-size:0.85rem">复制分享文案</button>
      </div>

      <button class="btn btn-primary" id="btn-restart">再来一局</button>

      <p class="tagline mt-16" style="font-size:0.7rem">
        理论基石请访问个人博客：<a href="https://seikasahara.com/zh/" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">seikasahara.com/zh/</a>
      </p>
    </div>
  `;

  $('#btn-restart').addEventListener('click', onRestart);
  $('#btn-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(shareText).then(() => {
      $('#btn-copy').textContent = '已复制！';
      setTimeout(() => { $('#btn-copy').textContent = '复制分享文案'; }, 1500);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = shareText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      $('#btn-copy').textContent = '已复制！';
      setTimeout(() => { $('#btn-copy').textContent = '复制分享文案'; }, 1500);
    });
  });
}

// === Narrative Helpers ===
function getNarrativeTitle(state) {
  return getTimeLabel(state.turn);
}

function buildNarrativeSections(state) {
  const stage = getLifeStage(state.turn);
  const alerts = [];    // { icon, text, severity: 'danger'|'warning' }
  const spotlight = [];  // { icon, text }
  const personal = [];   // plain strings
  const world = { market: [], official: [], advanced: [] };

  // === Turn 0 special case ===
  if (state.turn === 0) {
    personal.push('高考终于结束了！这个暑假，你决定把一直以来的同人创作梦想付诸行动，成立了自己的社团。');
    personal.push(`<span style="color:var(--text-muted);font-size:0.8rem">提示：暑假时间充裕，做同人时间有(${state.time}天/月)，是起步的好时机。注意管理热情值——它会随着时间推移越来越难维持。</span>`);
    return { alerts, spotlight, personal, world };
  }

  // === ALERTS: urgent / negative status ===
  if (state.passion < 20) {
    alerts.push({ icon: 'heart', text: '身心俱疲，创作热情即将耗尽...赶紧休息！', severity: 'danger' });
  } else if (state.passion < 40) {
    alerts.push({ icon: 'heart', text: '疲惫感在累积，注意管理热情值。', severity: 'warning' });
  }

  if (state.money < -2000) {
    alerts.push({ icon: 'money', text: '严重亏损！焦虑影响热情。去"打工"或"接稿"吧。', severity: 'danger' });
  } else if (state.money < -500) {
    alerts.push({ icon: 'money', text: '贴钱做同人的焦虑感在累积...试试打工或接稿。', severity: 'warning' });
  } else if (state.money < 0) {
    alerts.push({ icon: 'coins', text: '资金是负数了。亏损焦虑会消耗热情。', severity: 'warning' });
  } else if (state.money < 300 && stage !== 'work') {
    alerts.push({ icon: 'coins', text: '资金不多了，继续制作可能会亏损。', severity: 'warning' });
  }

  if (state.time <= 1) {
    alerts.push({ icon: 'timer', text: '几乎没有空闲时间，只能休息等忙碌的日子过去。', severity: 'danger' });
  } else if (state.time <= 2) {
    alerts.push({ icon: 'timer', text: '时间非常紧张，只够做轻量级的事情。', severity: 'warning' });
  }

  if (state.unemployed) {
    alerts.push({ icon: 'warning-circle', text: `失业中（已找工作${state.jobSearchTurns}个月）。可以找工作、休息或接稿。`, severity: 'danger' });
    if (state.recessionTurnsLeft > 0) alerts.push({ icon: 'trend-down', text: '经济下行让求职更加困难。', severity: 'danger' });
  }

  if (state.recessionTurnsLeft > 0) {
    const rf = fogRecession(state.recessionTurnsLeft);
    alerts.push({ icon: 'trend-down', text: `${rf.label}，销量下降，成本上升。`, severity: 'warning' });
  }

  const negDebuffs = state.timeDebuffs.filter(d => d.delta < 0);
  if (negDebuffs.length > 0) {
    const reasons = negDebuffs.map(d => d.reason).join('、');
    alerts.push({ icon: 'hourglass', text: `受"${reasons}"影响，可用时间减少。`, severity: 'warning' });
  }

  // === SPOTLIGHT: actionable opportunities ===
  if (state.availableEvents && state.availableEvents.length > 0) {
    for (const e of state.availableEvents) {
      spotlight.push({ icon: 'tent', text: `<b>${e.name}</b>@${e.city} <span class="spotlight-chip">路费¥${e.travelCost}</span> <span class="spotlight-chip">${e.salesBoost >= 4 ? '盛况空前' : e.salesBoost >= 2.5 ? '人气旺盛' : '人流一般'}</span>` });
    }
  }
  if (state.attendingEvent) {
    spotlight.push({ icon: 'sparkle', text: `参展加成生效中！` });
  }
  if (state.hvpProject) {
    const p = state.hvpProject;
    spotlight.push({ icon: 'book-open-text', text: `同人本创作中 <span class="spotlight-chip">${p.progress}/${p.needed}</span> 选择"创作同人本"推进进度` });
  }

  // === PERSONAL: life story / status ===
  if (state.turn === 2) personal.push('大学开学了！新环境、新朋友，但课程也开始占用时间了。');
  if (state.turn === 14) personal.push('大二了，课程变多，你开始感受到平衡学业和创作的压力。');
  if (state.turn === 26) personal.push('大三了...身边的同学开始讨论考研还是找工作。你呢？');
  if (state.turn === 38) personal.push('大四上学期，秋招、考研，现实的压力越来越大。还能坚持创作吗？');
  if (state.turn === 50) personal.push('毕业了，正式踏入社会。工作占据了大部分时间，但每个月有了固定收入。同人创作从此成了"业余爱好"...');

  if (state.passion > 85) personal.push('你充满干劲，灵感源源不断！');

  if (state.hasPartner && state.partnerType) {
    const pt = PARTNER_TYPES[state.partnerType];
    if (state.partnerType === 'toxic') {
      personal.push(`${ic(pt.emoji)} 有毒搭档还会纠缠你${state.partnerTurns}个月...忍忍吧。`);
    } else {
      personal.push(`${ic(pt.emoji)} ${pt.name}还会陪你${state.partnerTurns}个月。`);
    }
  }

  const cs = state.market?.communitySize || 10000;
  const smallCircle = cs < 5000;
  if (state.reputation >= 8 && smallCircle) {
    personal.push(`${ic('crown')} 这个${cs < 2000 ? '微型' : '小众'}圈子几乎就是围着你转的——你就是这里的"镇圈之宝"。虽然外面的世界不认识你，但这里的每个人都视你为传说。`);
    personal.push(`<span style="font-size:0.78rem;color:var(--text-muted);font-style:italic">"在一千个人心中封神，胜过在一百万人眼里路过。"</span>`);
  } else if (state.reputation >= 5 && smallCircle) {
    personal.push(`${ic('star')} 圈子虽小，但你已经是这里响当当的名字了。几乎每个人都认识你的作品——大鱼，小池塘。`);
    if (cs < 3000) personal.push(`<span style="font-size:0.78rem;color:var(--text-muted);font-style:italic">社群不到${cs.toLocaleString()}人，市场天花板就在头顶。但这份被所有人认识的归属感，大圈子里可得不到。</span>`);
  } else if (state.reputation >= 8) {
    personal.push('你是圈内公认的大手，作品发布就有人翘首以盼。');
  } else if (state.reputation >= 5) {
    personal.push('越来越多人认识你了，社群里经常能看到对你作品的讨论。');
  } else if (state.reputation < 0.5) {
    personal.push('圈子里还没什么人知道你。试试宣发推广？');
  }

  if (state.infoDisclosure < 0.15) {
    personal.push(`${ic('lightbulb')} 信息透明度很低——先"宣发推广"，然后立刻制作售卖！`);
  }

  // Default
  if (personal.length === 0 && alerts.length === 0 && spotlight.length === 0) {
    const defaults = ['新的一个月，这个月打算做什么呢？', '每一步选择都在塑造你的同人生涯。', '看看手头的状态，做出最适合的选择吧。'];
    personal.push(defaults[state.turn % defaults.length]);
  }

  // === WORLD: market / IP / advanced ===
  if (state.market) world.market = getMarketNarratives(state.market);
  if (state.official) world.official = getOfficialNarratives(state.official);
  if (state.advanced) world.advanced = getAdvancedNarratives(state.advanced);

  return { alerts, spotlight, personal, world };
}

// --- Section renderers ---
function renderAlertBanner(alerts) {
  if (!alerts.length) return '';
  const items = alerts.map(a =>
    `<div class="alert-item ${a.severity}"><span class="alert-icon">${ic(a.icon)}</span>${a.text}</div>`
  ).join('');
  return `<div class="alert-strip">${items}</div>`;
}

function renderSpotlightCard(spotlight) {
  if (!spotlight.length) return '';
  const items = spotlight.map(s =>
    `<div class="spotlight-item"><span class="spotlight-icon">${ic(s.icon)}</span><span>${s.text}</span></div>`
  ).join('');
  return `<div class="spotlight-card"><div class="spotlight-title">${ic('target')} 本月机会</div>${items}</div>`;
}

function renderPersonalNarrative(title, personal) {
  if (!personal.length) return '';
  return `<div class="narrative"><div class="turn-title">${title}</div><p>${personal.join('</p><p>')}</p></div>`;
}

function renderWorldTicker(world) {
  const all = [...world.market, ...world.official, ...world.advanced];
  if (!all.length) return '';

  const chipCount = all.length;
  const sections = [];
  if (world.market.length) sections.push(`<div class="world-section"><div class="world-section-label">${ic('storefront')} 市场</div>${world.market.map(t => `<div class="world-section-item">${t}</div>`).join('')}</div>`);
  if (world.official.length) sections.push(`<div class="world-section"><div class="world-section-label">${ic('film-strip')} IP动态</div>${world.official.map(t => `<div class="world-section-item">${t}</div>`).join('')}</div>`);
  if (world.advanced.length) sections.push(`<div class="world-section"><div class="world-section-label">${ic('globe-simple')} 宏观</div>${world.advanced.map(t => `<div class="world-section-item">${t}</div>`).join('')}</div>`);

  return `
    <div class="world-ticker collapsed">
      <div class="world-ticker-header" id="world-ticker-toggle">
        <span>${ic('globe')} 世界动态 <span style="font-weight:400;color:var(--text-muted);font-size:0.7rem">${chipCount}条</span></span>
        <span class="market-arrow">▼</span>
      </div>
      <div class="world-ticker-body">${sections.join('')}</div>
    </div>`;
}
