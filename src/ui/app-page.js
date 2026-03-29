import { ACTIONS, canPerformAction, getActionDisplay, ensureEventCalendar, HVP_SUBTYPES } from '../engine.js';
import { ic, escapeHtml } from '../icons.js';

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

export function renderAppDesktop(state) {
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
    if (app.id === 'enzao' && state.hvpProject) badge = `<span class="app-badge">${Math.round(state.hvpProject.progress * 100) / 100}/${state.hvpProject.needed}</span>`;
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
