/**
 * Main — 同人社団物語 v5
 * Game loop with mini-game, pricing, event chains
 */

import './style.css';
import { createInitialState, executeTurn, executeAction, endMonth, rollEvent, applyEvent, ACTIONS, getLifeStage, generatePartnerCandidates, getTimeCost, calculateSales, getActionDisplay, needsPricing, rollEventCondition, rollPartnerBusy, getSponsorTiers } from './engine.js';
import { renderTitle, renderEndowments, renderGame, renderTutorial, renderResult, renderEvent, renderGameOver, renderPriceSelector, renderEventSelector, renderReprintSelector, renderStrategySelector, renderEventModeSelector, renderSubtypeSelector, renderCreativeChoice, renderWorkNameInput, renderAppPage, renderMessageApp, openSNSPanel, openMarketApp, openBrowserApp, renderEventWorksSelector } from './ui.js';
import { HVP_SUBTYPES, LVP_SUBTYPES, CREATIVE_CHOICES, applyCreativeChoice, PARTNER_TYPES, getQualityStars } from './engine.js';
import { preloadBGM, initAudioUnlock, updateBGM } from './bgm.js';
import { ic } from './icons.js';
import { saveGame, loadGame, deleteSave } from './save.js';

let state = null;

// Loading overlay to block interaction during async imports (iOS tap-through fix)
function showLoadingOverlay(text = '加载中…') {
  const el = document.createElement('div');
  el.className = 'event-overlay';
  el.id = 'loading-overlay';
  el.style.cssText = 'z-index:999;display:flex;align-items:center;justify-content:center;';
  el.innerHTML = `<div style="background:var(--bg-card);padding:20px 32px;border-radius:var(--radius);box-shadow:var(--shadow-lg);font-size:0.85rem;font-weight:600;color:var(--text-light)">${text}</div>`;
  document.body.appendChild(el);
  return el;
}
function removeLoadingOverlay() {
  document.getElementById('loading-overlay')?.remove();
}

let selectedPreset = 'mid';
let selectedIpType = 'normal';

// Sync BGM with current game state
function syncBGM(screen) {
  if (state) state._lifeStage = getLifeStage(state.turn);
  updateBGM(screen, state);
}

function startGame(communityPreset, ipType) {
  selectedPreset = communityPreset || 'mid';
  selectedIpType = ipType || 'normal';
  // Show endowment allocation screen before game starts
  syncBGM('endowment');
  renderEndowments((endowments, backgroundId, obsessiveTrait) => {
    state = createInitialState(selectedPreset, endowments, backgroundId, selectedIpType);
    state.obsessiveTrait = obsessiveTrait || null;
    state._prevAchievementCount = 0;

    // Ask player to name their doujin circle
    const nameOverlay = document.createElement('div');
    nameOverlay.className = 'event-overlay';
    nameOverlay.innerHTML = `
      <div class="event-card" style="max-width:340px;text-align:center">
        <div style="font-size:1.3rem;margin-bottom:4px">${ic('flag-banner', '1.3rem')}</div>
        <div style="font-weight:700;font-size:1rem;margin-bottom:4px">为你的同人社团起个名字</div>
        <div style="font-size:0.78rem;color:var(--text-light);margin-bottom:12px">这个名字会出现在市场和社交动态以及排行榜中</div>
        <input type="text" id="club-name-input" maxlength="15" placeholder="例：星屑工房、月光社…"
          style="width:100%;box-sizing:border-box;padding:10px 12px;border:2px solid var(--border);border-radius:8px;font-size:0.9rem;text-align:center;outline:none;margin-bottom:12px">
        <button class="btn btn-primary btn-block" id="btn-club-confirm" style="margin-bottom:6px">确认</button>
        <button class="btn btn-block" id="btn-club-skip" style="background:var(--bg);border:1px solid var(--border);color:var(--text-muted);font-size:0.78rem">跳过（使用默认名称）</button>
      </div>`;
    document.body.appendChild(nameOverlay);
    const clubInput = nameOverlay.querySelector('#club-name-input');
    setTimeout(() => clubInput.focus(), 50);

    function finishNaming(name) {
      state.clubName = name || '无名社团';
      nameOverlay.remove();
      renderGame(state, handleAction, handleRetire);
      syncBGM('game');
      renderTutorial(() => {
        import('./chat-npc.js').then(({ triggerWelcomeMessages }) => {
          triggerWelcomeMessages(state);
          renderGame(state, handleAction, handleRetire);
        });
      });
    }
    clubInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') finishNaming(clubInput.value.trim() || null); });
    nameOverlay.querySelector('#btn-club-confirm').addEventListener('click', () => finishNaming(clubInput.value.trim() || null));
    nameOverlay.querySelector('#btn-club-skip').addEventListener('click', () => finishNaming(null));
  });
}

function continueGame() {
  const saved = loadGame();
  if (!saved) return;
  state = saved;
  syncBGM('game');
  renderGame(state, handleAction, handleRetire);
}

function handleRetire() {
  deleteSave();
  syncBGM('gameover');
  renderGameOver(state, () => { syncBGM('title'); renderTitle(startGame, continueGame); });
}

// needsPricing is now imported from engine.js

function handleAction(actionId) {
  const cancelBack = () => renderGame(state, handleAction, handleRetire);

  // === End month manually ===
  if (actionId === 'endMonth') {
    const remaining = state.time - (state.monthTimeSpent || 0);
    if (remaining > 0) {
      // Confirm if there's still leisure left
      const overlay = document.createElement('div');
      overlay.className = 'event-overlay';
      overlay.innerHTML = `
        <div class="event-card" style="max-width:320px;text-align:center">
          <div style="font-size:1.3rem;margin-bottom:6px">${ic('calendar-check', '1.3rem')}</div>
          <div style="font-weight:700;margin-bottom:6px">还有${remaining}天闲暇</div>
          <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:12px;line-height:1.5">剩余的时间会自动转为休息恢复。确定要结束本月吗？</div>
          <button class="btn btn-primary btn-block" id="end-month-yes" style="margin-bottom:6px">结束本月</button>
          <button class="btn btn-block" id="end-month-no" style="background:var(--bg);border:1px solid var(--border);color:var(--text-light)">继续安排</button>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#end-month-yes').addEventListener('click', () => { overlay.remove(); finishMonth(); });
      overlay.querySelector('#end-month-no').addEventListener('click', () => overlay.remove());
    } else {
      finishMonth();
    }
    return;
  }

  // === Auto-end month if zero leisure and no actions taken yet (0-leisure month) ===
  if (!actionId.startsWith('app:')) {
    const remaining = state.time - (state.monthTimeSpent || 0);
    if (remaining <= 0 && (state.monthActions || []).length === 0) {
      finishMonth();
      return;
    }
  }

  // === APP routing: open app page overlay ===
  if (actionId.startsWith('app:')) {
    const appId = actionId.slice(4);
    if (appId === 'message') {
      renderMessageApp(state, handleAction, cancelBack);
    } else if (appId === 'nyaner') {
      openSNSPanel(state);
    } else if (appId === 'browser') {
      openBrowserApp();
    } else if (appId === 'prediction') {
      import('./prediction-market.js').then(({ openPredictionMarket }) => openPredictionMarket(state));
    } else if (appId === 'market') {
      openMarketApp(state);
    } else if (appId === 'rest') {
      // Single-action app: go directly to action
      handleAction('rest');
    } else if (appId === 'memu') {
      handleAction('upgradeEquipment');
    } else {
      renderAppPage(appId, state, handleAction, cancelBack);
    }
    return;
  }

  // === Attend Event: event selection → mode → mini-game/consign → proceed ===
  if (actionId === 'attendEvent') {
    const processEvent = (chosenEvent) => {
      chosenEvent.condition = rollEventCondition(chosenEvent, state.recessionTurnsLeft > 0);

      // Show attend mode selector: 亲参 vs 寄售
      renderEventModeSelector(state, chosenEvent, (mode) => {
        state.attendingEvent = chosenEvent;

        // --- 流展：根据参展模式展示不同的损失信息 ---
        if (chosenEvent.condition === 'cancelled') {
          state._minigameResult = null;
          state._eventMode = mode;
          if (mode === 'attend') {
            renderEvent({
              emoji: 'smiley-x-eyes', title: '展会流展了！',
              desc: `${chosenEvent.name}@${chosenEvent.city}因故取消，到了现场才知道消息……路费白花了。`,
              effect: `路费-¥${chosenEvent.travelCost} 热情-5`, effectClass: 'negative',
              tip: '流展是同人展会的现实风险之一。路费变成沉没成本，只能认栽。',
            }, () => executeInMonth(actionId));
          } else {
            const shipCost = Math.round(chosenEvent.travelCost * 0.3);
            renderEvent({
              emoji: 'smiley-x-eyes', title: '展会流展了！',
              desc: `${chosenEvent.name}@${chosenEvent.city}因故取消，寄出的货物被退回，只损失了邮费。`,
              effect: `邮费-¥${shipCost} 热情-1`, effectClass: 'negative',
              tip: '流展是同人展会的现实风险之一。好在是寄售，损失比亲自到场小得多。',
            }, () => executeInMonth(actionId));
          }
          return;
        }

        state._eventMode = mode;

        // --- Works selection: choose which works to bring ---
        const eventLabel = chosenEvent.name + '@' + chosenEvent.city;
        renderEventWorksSelector(state, eventLabel, (worksSelection) => {
          state._eventWorksSelection = worksSelection; // [{ workId, qty }]

          // Apply selection to inventory NOW so minigame + CES see only selected works
          const _savedQtys = new Map();
          for (const w of state.inventory.works) {
            _savedQtys.set(w.id, w.qty);
            const sel = worksSelection.find(s => s.workId === w.id);
            w.qty = sel ? Math.min(sel.qty, w.qty) : 0;
          }
          state.inventory.hvpStock = state.inventory.works.filter(w => w.type === 'hvp').reduce((s, w) => s + w.qty, 0);
          state.inventory.lvpStock = state.inventory.works.filter(w => w.type === 'lvp').reduce((s, w) => s + w.qty, 0);

          // Restore function: called after executeAction to add back works not brought to this event
          const restoreInventory = () => {
            for (const w of state.inventory.works) {
              const orig = _savedQtys.get(w.id);
              if (orig != null) {
                const brought = worksSelection.find(s => s.workId === w.id)?.qty || 0;
                const soldFromThis = Math.max(0, Math.min(brought, orig) - w.qty);
                w.qty = orig - soldFromThis;
              }
            }
            state.inventory.hvpStock = state.inventory.works.filter(w => w.type === 'hvp').reduce((s, w) => s + w.qty, 0);
            state.inventory.lvpStock = state.inventory.works.filter(w => w.type === 'lvp').reduce((s, w) => s + w.qty, 0);
            // Engine doesn't need to re-apply selection — already consumed
            state._eventWorksSelection = null;
          };

        if (mode === 'attend') {
          // 亲参 → play minigame
          // Pre-compute CES floor (now uses filtered inventory)
          const savedAttending = state.attendingEvent;
          state.attendingEvent = { ...chosenEvent, salesBoost: chosenEvent.salesBoost };
          state.playerPrice.hvp = state.inventory?.hvpPrice || 50;
          state.playerPrice.lvp = state.inventory?.lvpPrice || 15;
          const cesHvp = state.inventory.hvpStock > 0 ? (calculateSales('hvp', state).hvpSales || 0) : 0;
          const cesLvp = state.inventory.lvpStock > 0 ? (calculateSales('lvp', state).lvpSales || 0) : 0;
          state.attendingEvent = savedAttending;
          const cesFloorTotal = cesHvp + cesLvp;

          syncBGM('minigame');
          showLoadingOverlay('准备展会中…');
          import('./minigame.js').then(({ startMinigame }) => {
            removeLoadingOverlay();
            startMinigame(state, { ...chosenEvent, _cesFloor: cesFloorTotal }, (mgResult) => {
              state._minigameResult = mgResult || null;
              state._restoreEventInventory = restoreInventory;
              syncBGM('game');
              executeInMonth(actionId);
            });
          }).catch(() => {
            removeLoadingOverlay();
            state._restoreEventInventory = restoreInventory;
            syncBGM('game');
            executeInMonth(actionId);
          });
        } else {
          // 寄售 → skip minigame, use CES model
          state._minigameResult = null;
          state._restoreEventInventory = restoreInventory;
          executeInMonth(actionId);
        }
        }, cancelBack); // close renderEventWorksSelector
      }, cancelBack);
    };

    if (state.availableEvents && state.availableEvents.length > 1) {
      renderEventSelector(state, processEvent, cancelBack);
    } else if (state.availableEvents && state.availableEvents.length === 1) {
      processEvent(state.availableEvents[0]);
    }
    return;
  }

  // === Reprint: type selection → proceed ===
  if (actionId === 'reprint') {
    renderReprintSelector(state, (orders) => {
      state._reprintOrders = orders; // [{ id, qty }, ...]
      executeInMonth(actionId);
    }, cancelBack);
    return;
  }

  // === HVP flow: new project → all choices upfront; continue → just confirm ===
  if (actionId === 'hvp' && !needsPricing(state, actionId)) {
    if (!state.hvpProject) {
      // New project: subtype → name → theme → execution → finalPolish → proceed
      renderSubtypeSelector(state, 'hvp', (subtypeId) => {
        state._selectedHVPSubtype = subtypeId;
        const sub = HVP_SUBTYPES[subtypeId];
        renderWorkNameInput(sub.name, sub.emoji, (name) => {
          state._hvpWorkName = name;
          renderCreativeChoice(CREATIVE_CHOICES.theme, (themeId) => {
            renderCreativeChoice(CREATIVE_CHOICES.execution, (execId) => {
              renderCreativeChoice(CREATIVE_CHOICES.finalPolish, (polishId) => {
                state._pendingChoices = [
                  { category: 'theme', optionId: themeId },
                  { category: 'execution', optionId: execId },
                  { category: 'finalPolish', optionId: polishId },
                ];
                executeInMonth(actionId);
              }, cancelBack);
            }, cancelBack);
          }, cancelBack);
        }, cancelBack);
      }, cancelBack);
    } else {
      // Continue project: just confirm, no more choices
      const p = state.hvpProject;
      const sub = HVP_SUBTYPES[p.subtype] || HVP_SUBTYPES.manga;
      const overlay = document.createElement('div');
      overlay.className = 'event-overlay';
      overlay.innerHTML = `
        <div class="event-card" style="max-width:340px">
          <div style="font-size:1.3rem">${ic(sub.emoji, '1.3rem')}</div>
          <div style="font-weight:700;margin:4px 0">继续创作${sub.name}${p.name ? '·' + p.name : ''}</div>
          <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:12px">进度 ${p.progress}/${p.needed} · 质量${getQualityStars(p.workQuality)}</div>
          <button class="btn btn-primary btn-block" id="btn-hvp-go" style="margin-bottom:6px">继续创作</button>
          <button class="btn btn-block" id="btn-hvp-back" style="background:var(--bg);border:1px solid var(--border);color:var(--text-light)">返回</button>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#btn-hvp-go').addEventListener('click', () => { overlay.remove(); executeInMonth(actionId); });
      overlay.querySelector('#btn-hvp-back').addEventListener('click', () => { overlay.remove(); cancelBack(); });
    }
    return;
  }

  // === LVP flow: select subtype → name → process choice → pricing ===
  if (actionId === 'lvp') {
    renderSubtypeSelector(state, 'lvp', (subtypeId) => {
      state._selectedLVPSubtype = subtypeId;
      const sub = LVP_SUBTYPES[subtypeId];
      renderWorkNameInput(sub.name, sub.emoji, (name) => {
        state._lvpWorkName = name;
        renderCreativeChoice(CREATIVE_CHOICES.lvpProcess, (processId) => {
          state._lvpProcessChoice = processId;
          // Now pricing
          renderPriceSelector(state, 'lvp', (chosenPrice) => {
            state.playerPrice.lvp = chosenPrice;
            executeInMonth(actionId);
          }, cancelBack);
        }, cancelBack);
      }, cancelBack);
    }, cancelBack);
    return;
  }

  // === Pricing ===
  if (needsPricing(state, actionId)) {
    const type = actionId === 'lvp' ? 'lvp' : 'hvp';
    renderPriceSelector(state, type, (chosenPrice) => {
      state.playerPrice[type] = chosenPrice;
      // For HVP completion: also choose anti-speculator strategy
      if (type === 'hvp') {
        renderStrategySelector(state, (strategy) => {
          state._antiSpecStrategy = strategy;
          executeInMonth(actionId);
        });
      } else {
        executeInMonth(actionId);
      }
    }, cancelBack);
    return;
  }

  // === Find Partner: candidate selection flow (draws from contacts pool) ===
  if (actionId === 'findPartner') {
    // Check for renewal offer first
    if (state._partnerRenewalOffer && !state.hasPartner) {
      const contact = (state.contacts || []).find(c => c.id === state._partnerRenewalOffer);
      if (contact) {
        const pt = PARTNER_TYPES[contact.pType];
        const renewOverlay = document.createElement('div');
        renewOverlay.className = 'event-overlay';
        renewOverlay.innerHTML = `
          <div class="event-card" style="max-width:340px;text-align:center">
            <img src="partner/${contact.avatarIdx}.webp" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:3px solid var(--success);margin-bottom:8px">
            <div style="font-weight:700;font-size:1rem">${contact.name}</div>
            <div style="font-size:0.8rem;color:var(--text-light);margin:4px 0 12px">"还想继续合作吗？"</div>
            <button class="btn btn-primary btn-block" id="renew-yes" style="margin-bottom:6px">${ic('arrows-clockwise')} 续约合作</button>
            <button class="btn btn-block" id="renew-no" style="background:var(--bg);border:1px solid var(--border);color:var(--text-light)">换个人试试</button>
            <button class="btn btn-block" id="renew-back" style="margin-top:4px;background:var(--bg);border:1px solid var(--border);color:var(--text-muted);font-size:0.78rem">返回</button>
          </div>`;
        document.body.appendChild(renewOverlay);
        const closeRenew = () => { renewOverlay.remove(); cancelBack(); };
        renewOverlay.addEventListener('click', (ev) => { if (ev.target === renewOverlay) closeRenew(); });
        renewOverlay.querySelector('#renew-back').addEventListener('click', closeRenew);
        renewOverlay.querySelector('#renew-yes').addEventListener('click', () => {
          renewOverlay.remove();
          state._selectedPartnerCandidate = {
            name: contact.name, bio: contact.bio, _type: contact.pType,
            contactId: contact.id, avatarIdx: contact.avatarIdx,
            tier: contact.tier, affinity: contact.affinity,
            visibleType: contact.pType, // trusted = fully visible
          };
          state._partnerRenewalOffer = null;
          executeInMonth(actionId);
        });
        renewOverlay.querySelector('#renew-no').addEventListener('click', () => {
          renewOverlay.remove();
          state._partnerRenewalOffer = null;
          // Fall through to normal selection below
          showPartnerSelector();
        });
        return;
      }
      state._partnerRenewalOffer = null;
    }

    const busyThisMonth = new Set(); // candidate indices unavailable this month
    const BUSY_EXCUSES = [
      '最近太忙了，下个月再说吧…',
      '不好意思，这个月有别的安排',
      '家里有点事，暂时没法合作',
      '刚接了个急稿，抽不开身',
      '最近身体不太好，先休息一阵',
      '正在赶自己的本子，没有余力',
    ];
    function showPartnerSelector() {
      const candidates = generatePartnerCandidates(state);
      if (!candidates) {
        state._partnerSearchFailed = true;
        executeInMonth(actionId);
        return;
      }
      const isFromPool = candidates[0]?.contactId != null;
      const tierColors = { acquaintance: '#95a5a6', familiar: '#3498db', trusted: '#27ae60' };
      const tierLabels = { acquaintance: '认识', familiar: '熟悉', trusted: '信任' };

      const overlay = document.createElement('div');
      overlay.className = 'event-overlay';
      overlay.innerHTML = `
        <div class="app-page" style="max-height:80vh">
          <div class="app-titlebar" style="border-bottom-color:#27AE60">
            <button class="app-back" id="partner-back">${ic('arrow-left')} 返回</button>
            <span class="app-title">${ic('handshake')} 寻找搭档</span>
            <span style="width:60px"></span>
          </div>
          <div class="app-page-body">
            <div style="font-size:0.78rem;color:var(--text-light);margin-bottom:12px;text-align:center">
              ${isFromPool ? `人脉池中有${candidates.length}位认识的人` : `有${candidates.length}位创作者愿意合作，选一个试试？`}
            </div>
            ${candidates.map((c, i) => {
              const tc = tierColors[c.tier] || '#95a5a6';
              const tl = tierLabels[c.tier] || '';
              const busy = busyThisMonth.has(i);
              const avatarHtml = c.avatarIdx
                ? `<img src="partner/${c.avatarIdx}.webp" style="width:42px;height:42px;border-radius:50%;object-fit:cover;border:2px solid ${busy ? '#ccc' : tc};flex-shrink:0;${busy ? 'filter:grayscale(0.8);opacity:0.5' : ''}">`
                : `<div style="width:42px;height:42px;border-radius:50%;background:${busy ? '#ccc' : '#27AE60'};display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0">${ic('user')}</div>`;
              const typeHint = c.visibleType
                ? `<span style="font-size:0.65rem;color:${c.visibleType === 'supportive' ? 'var(--success)' : c.visibleType === 'toxic' ? 'var(--danger)' : 'var(--accent)'}">${PARTNER_TYPES[c.visibleType]?.name || ''}</span>`
                : '';
              const affinityDots = c.affinity != null
                ? '<span style="font-size:0.6rem;color:' + tc + '">' + '●'.repeat(Math.floor(c.affinity)) + '○'.repeat(5 - Math.floor(c.affinity)) + '</span>'
                : '';
              return `
                <div class="app-action-card" data-idx="${i}" style="cursor:${busy ? 'default' : 'pointer'};${busy ? 'opacity:0.5;pointer-events:none' : ''}">
                  ${avatarHtml}
                  <div class="app-action-body">
                    <div class="app-action-name" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                      ${c.name}
                      ${c.tier ? `<span style="font-size:0.58rem;padding:1px 5px;border-radius:6px;background:${tc}18;color:${tc};font-weight:600">${tl}</span>` : ''}
                      ${typeHint}
                    </div>
                    <div class="app-action-cost">${busy ? '<span style="color:var(--danger)">本月没空</span>' : c.bio}</div>
                    ${affinityDots ? `<div style="margin-top:2px">${affinityDots}</div>` : ''}
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#partner-back').addEventListener('click', () => { overlay.remove(); cancelBack(); });
      overlay.addEventListener('click', (ev) => { if (ev.target === overlay) { overlay.remove(); cancelBack(); } });
      overlay.querySelectorAll('.app-action-card').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.idx);
          if (busyThisMonth.has(idx)) return;
          const candidate = candidates[idx];
          if (rollPartnerBusy(candidate)) {
            busyThisMonth.add(idx);
            const excuse = BUSY_EXCUSES[Math.floor(Math.random() * BUSY_EXCUSES.length)];
            const busyPopup = document.createElement('div');
            busyPopup.className = 'event-overlay';
            busyPopup.style.zIndex = '110';
            busyPopup.innerHTML = `
              <div class="event-card" style="max-width:300px;text-align:center">
                ${candidate.avatarIdx ? `<img src="partner/${candidate.avatarIdx}.webp" style="width:48px;height:48px;border-radius:50%;object-fit:cover;margin-bottom:8px">` : ''}
                <div style="font-weight:700;font-size:0.95rem;margin-bottom:4px">${candidate.name}</div>
                <div style="font-size:0.82rem;color:var(--text-light);margin:8px 0 14px;line-height:1.5">"${excuse}"</div>
                <button class="btn btn-primary btn-block" id="busy-ok">知道了</button>
              </div>`;
            document.body.appendChild(busyPopup);
            const allBusy = busyThisMonth.size >= candidates.length;
            const dismissBusy = () => {
              busyPopup.remove();
              overlay.remove();
              if (allBusy) {
                // Everyone is busy → treat as search failed
                state._partnerSearchFailed = true;
                executeInMonth(actionId);
              } else {
                showPartnerSelector(); // re-render with this candidate greyed out
              }
            };
            busyPopup.querySelector('#busy-ok').addEventListener('click', dismissBusy);
            busyPopup.addEventListener('click', (ev) => { if (ev.target === busyPopup) dismissBusy(); });
            return;
          }
          state._selectedPartnerCandidate = candidate;
          overlay.remove();
          executeInMonth(actionId);
        });
      });
    } // end showPartnerSelector
    showPartnerSelector();
    return;
  }

  // === Promote Heavy: launch social media mini-game ===
  if (actionId === 'promote_heavy') {
    syncBGM('minigame');
    showLoadingOverlay('启动宣发机…');
    import('./promote-minigame.js').then(({ startPromoteMinigame }) => {
      removeLoadingOverlay();
      startPromoteMinigame(state, (mgResult) => {
        state._promoteMinigameResult = mgResult || null;
        syncBGM('game');
        executeInMonth(actionId);
      });
    }).catch(() => {
      removeLoadingOverlay();
      syncBGM('game');
      executeInMonth(actionId);
    });
    return;
  }

  // === Rest: custom time slider ===
  if (actionId === 'rest') {
    const remaining = state.time - (state.monthTimeSpent || 0);
    const maxHours = Math.max(1, remaining);
    const defaultHours = Math.min(2, maxHours);
    const overlay = document.createElement('div');
    overlay.className = 'event-overlay';
    overlay.innerHTML = `
      <div class="event-card" style="max-width:320px">
        <div style="font-size:1.5rem">${ic('coffee', '1.5rem')}</div>
        <div style="font-weight:700;margin:6px 0">休息充电</div>
        <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:8px">选择休息时长，时间越多恢复越多</div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <input type="range" id="rest-slider" min="1" max="${maxHours}" value="${defaultHours}" step="1" style="flex:1;accent-color:var(--primary)">
          <span id="rest-hours-label" style="font-weight:700;font-size:1.1rem;min-width:36px;text-align:center">${defaultHours}天</span>
        </div>
        <div id="rest-preview" style="font-size:0.75rem;color:var(--text-muted);margin-bottom:12px;text-align:center">预计恢复热情 ~${defaultHours * 5}</div>
        <button class="btn btn-primary btn-block" id="btn-rest-go" style="margin-bottom:6px">开始休息</button>
        <button class="btn btn-block" id="btn-rest-back" style="background:var(--bg);border:1px solid var(--border);color:var(--text-light)">返回</button>
      </div>`;
    document.body.appendChild(overlay);
    const slider = overlay.querySelector('#rest-slider');
    const label = overlay.querySelector('#rest-hours-label');
    const preview = overlay.querySelector('#rest-preview');
    slider.addEventListener('input', () => {
      const h = parseInt(slider.value);
      label.textContent = h + '天';
      preview.textContent = `预计恢复热情 ~${h * 5}`;
    });
    overlay.querySelector('#btn-rest-go').addEventListener('click', () => {
      state._restHours = parseInt(slider.value);
      overlay.remove();
      executeInMonth(actionId);
    });
    overlay.querySelector('#btn-rest-back').addEventListener('click', () => { overlay.remove(); cancelBack(); });
    return;
  }

  // === Sell Goods: quantity slider ===
  if (actionId === 'sellGoods') {
    const maxQty = state.goodsCollection || 0;
    if (maxQty <= 0) { executeInMonth(actionId); return; }
    const defaultQty = Math.min(1, maxQty);
    const shPressure = state.official?.secondHandPressure?.lvp || 0;
    const unitPrice = Math.max(50, Math.round(120 * (1 - shPressure * 0.5)));
    const overlay = document.createElement('div');
    overlay.className = 'event-overlay';
    overlay.innerHTML = `
      <div class="event-card" style="max-width:320px">
        <div style="font-size:1.5rem">${ic('export', '1.5rem')}</div>
        <div style="font-weight:700;margin:6px 0">出售闲置收藏</div>
        <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:8px">选择出售数量，卖越多割爱越痛</div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <input type="range" id="sell-slider" min="1" max="${maxQty}" value="${defaultQty}" step="1" style="flex:1;accent-color:var(--primary)">
          <span id="sell-qty-label" style="font-weight:700;font-size:1.1rem;min-width:36px;text-align:center">${defaultQty}件</span>
        </div>
        <div id="sell-preview" style="font-size:0.75rem;color:var(--text-muted);margin-bottom:12px;text-align:center">预估收入 ¥${defaultQty * unitPrice} · 热情-${Math.min(8, Math.ceil(defaultQty * 0.8))}</div>
        <button class="btn btn-primary btn-block" id="btn-sell-go" style="margin-bottom:6px">确认出售</button>
        <button class="btn btn-block" id="btn-sell-back" style="background:var(--bg);border:1px solid var(--border);color:var(--text-light)">返回</button>
      </div>`;
    document.body.appendChild(overlay);
    const slider = overlay.querySelector('#sell-slider');
    const label = overlay.querySelector('#sell-qty-label');
    const preview = overlay.querySelector('#sell-preview');
    slider.addEventListener('input', () => {
      const q = parseInt(slider.value);
      label.textContent = q + '件';
      const passionCost = Math.min(8, Math.ceil(q * 0.8));
      preview.textContent = `预估收入 ¥${q * unitPrice} · 热情-${passionCost}`;
    });
    overlay.querySelector('#btn-sell-go').addEventListener('click', () => {
      state._sellQty = parseInt(slider.value);
      overlay.remove();
      executeInMonth(actionId);
    });
    overlay.querySelector('#btn-sell-back').addEventListener('click', () => { overlay.remove(); cancelBack(); });
    return;
  }

  // === Freelance: type selector ===
  if (actionId === 'freelance') {
    const baseTC = state.unemployed || state.fullTimeDoujin ? 2 : state.turn < 50 ? 3 : 5;
    const remaining = state.time - (state.monthTimeSpent || 0);
    const baseIncome = 200 + Math.floor(Math.sqrt(state.reputation) * 600);
    const recTag = state.recessionTurnsLeft > 0 ? ' (经济下行-50%)' : '';
    const canPremium = state.reputation >= 4 && remaining >= baseTC + 1;
    const canStandard = remaining >= baseTC;
    const canQuick = remaining >= Math.max(1, baseTC - 1);
    const overlay = document.createElement('div');
    overlay.className = 'event-overlay';
    overlay.innerHTML = `
      <div class="event-card" style="max-width:360px;text-align:left">
        <div style="text-align:center;margin-bottom:10px">
          <div style="font-size:1.3rem">${ic('paint-brush')}</div>
          <div style="font-weight:700">选择稿件类型</div>
          <div style="font-size:0.75rem;color:var(--text-light)">不同稿件有不同的收入和消耗${recTag}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
          <div class="price-btn fl-type-btn${canQuick ? '' : ' disabled'}" data-fl="quick" style="padding:12px;cursor:${canQuick ? 'pointer' : 'not-allowed'};${canQuick ? '' : 'opacity:0.45;'}">
            <div style="font-weight:700;font-size:0.9rem">${ic('lightning')} 快速小单</div>
            <div style="font-size:0.72rem;color:var(--text-light);margin-top:2px">头像、表情包等小活，快速回款</div>
            <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px">收入约¥${Math.round(baseIncome * 0.4)} · 热情-2 · 需${Math.max(1, baseTC - 1)}天 · 下月闲暇-1天</div>
          </div>
          <div class="price-btn fl-type-btn${canStandard ? '' : ' disabled'}" data-fl="standard" style="padding:12px;cursor:${canStandard ? 'pointer' : 'not-allowed'};${canStandard ? '' : 'opacity:0.45;'}">
            <div style="font-weight:700;font-size:0.9rem">${ic('paint-brush')} 标准同人稿</div>
            <div style="font-size:0.72rem;color:var(--text-light);margin-top:2px">插画、封面等常规商稿</div>
            <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px">收入约¥${Math.round(baseIncome * 0.8)} · 热情-4 · 需${baseTC}天 · 下月闲暇-2天 · 声誉+</div>
          </div>
          <div class="price-btn fl-type-btn${canPremium ? '' : ' disabled'}" data-fl="premium" style="padding:12px;cursor:${canPremium ? 'pointer' : 'not-allowed'};${canPremium ? '' : 'opacity:0.45;'}">
            <div style="font-weight:700;font-size:0.9rem">${ic('star')} 高端约稿</div>
            <div style="font-size:0.72rem;color:var(--text-light);margin-top:2px">长期商业企划，高报酬高消耗</div>
            <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px">收入约¥${Math.round(baseIncome * 1.2)} · 热情-7 · 需${baseTC + 1}天 · 下月闲暇-3天 · 声誉++ · 技艺经验+</div>
            ${!canPremium && state.reputation < 4 ? `<div style="font-size:0.65rem;color:var(--danger);margin-top:2px">${ic('warning')} 需要声誉≥4</div>` : ''}
            ${!canPremium && state.reputation >= 4 ? `<div style="font-size:0.65rem;color:var(--danger);margin-top:2px">${ic('warning')} 闲暇不足（需≥${baseTC + 1}天）</div>` : ''}
          </div>
        </div>
        <button class="btn btn-primary btn-block" id="btn-fl-confirm" disabled style="opacity:0.5">请选择稿件类型</button>
        <button class="btn btn-block" id="btn-fl-back" style="margin-top:6px;background:var(--bg);border:1px solid var(--border);color:var(--text-light)">返回</button>
      </div>`;
    document.body.appendChild(overlay);
    let selectedFL = null;
    overlay.querySelectorAll('.fl-type-btn:not(.disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.fl-type-btn').forEach(b => { b.style.border = '1px solid var(--border)'; b.style.background = ''; });
        btn.style.border = '2px solid var(--primary)';
        btn.style.background = '#F0FAF8';
        selectedFL = btn.dataset.fl;
        const cfm = overlay.querySelector('#btn-fl-confirm');
        cfm.disabled = false;
        cfm.style.opacity = '1';
        const labels = { quick: '确认接小单', standard: '确认接稿', premium: '确认接高端约稿' };
        cfm.textContent = labels[selectedFL] || '确认';
      });
    });
    overlay.querySelector('#btn-fl-confirm').addEventListener('click', () => {
      if (!selectedFL) return;
      state._freelanceType = selectedFL;
      overlay.remove();
      executeInMonth(actionId);
    });
    overlay.querySelector('#btn-fl-back').addEventListener('click', () => { overlay.remove(); cancelBack(); });
    return;
  }

  // === Sponsor Community: tier selector ===
  if (actionId === 'sponsorCommunity') {
    const tiers = getSponsorTiers(state);
    const overlay = document.createElement('div');
    overlay.className = 'event-overlay';
    overlay.innerHTML = `
      <div class="event-card" style="max-width:380px;text-align:left">
        <div style="text-align:center;margin-bottom:10px">
          <div style="font-size:1.3rem">${ic('hand-heart', '1.3rem')}</div>
          <div style="font-weight:700">投资社群</div>
          <div style="font-size:0.75rem;color:var(--text-light)">选择赞助方式（冷却6个月）</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
          ${tiers.map(t => `
            <div class="price-btn sponsor-tier${t.unlocked ? '' : ' disabled'}" data-tier="${t.id}" style="padding:12px;cursor:${t.unlocked ? 'pointer' : 'not-allowed'};${t.unlocked ? '' : 'opacity:0.4;'}">
              <div style="font-weight:700;font-size:0.9rem">${ic(t.emoji || 'hand-heart')} ${t.name}</div>
              <div style="font-size:0.72rem;color:var(--text-light);margin-top:2px">${t.desc}</div>
              <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px">¥${t.cost.toLocaleString()}${t.timeCost > 0 ? ` · ${t.timeCost}天` : ''} · 声誉↑ · 热情+${t.passionGain} · 曝光+${Math.round(t.infoGain * 100)}%${t.communityGrowth ? ' · 社群扩张' : ''}</div>
              ${!t.unlocked ? `<div style="font-size:0.62rem;color:var(--danger);margin-top:2px">${ic('lock', '0.6rem')} ${state.money < t.cost ? '资金不足' : (state.time - (state.monthTimeSpent || 0)) < t.timeCost ? '闲暇不足' : '需要更高声誉或更多经验'}</div>` : ''}
            </div>
          `).join('')}
        </div>
        <button class="btn btn-primary btn-block" id="btn-sponsor-go" disabled style="opacity:0.5">请选择赞助方式</button>
        <button class="btn btn-block" id="btn-sponsor-back" style="margin-top:6px;background:var(--bg);border:1px solid var(--border);color:var(--text-light)">返回</button>
      </div>`;
    document.body.appendChild(overlay);
    let selectedTier = null;
    overlay.querySelectorAll('.sponsor-tier:not(.disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.sponsor-tier').forEach(b => { b.style.border = '1px solid var(--border)'; b.style.background = ''; });
        btn.style.border = '2px solid var(--primary)';
        btn.style.background = '#F0FAF8';
        selectedTier = btn.dataset.tier;
        const cfm = overlay.querySelector('#btn-sponsor-go');
        cfm.disabled = false;
        cfm.style.opacity = '1';
        cfm.textContent = '确认赞助';
      });
    });
    overlay.querySelector('#btn-sponsor-go').addEventListener('click', () => {
      if (!selectedTier) return;
      // Fund tier: show irreversibility warning
      if (selectedTier === 'fund') {
        const cs = state.market ? state.market.communitySize : 10000;
        const monthlyCost = Math.round(300 + cs / 10000 * 200);
        const warn = document.createElement('div');
        warn.className = 'event-overlay';
        warn.style.zIndex = '110';
        warn.innerHTML = `
          <div class="event-card" style="max-width:320px;text-align:center">
            <div style="font-size:1.5rem;margin-bottom:8px">${ic('warning', '1.5rem')}</div>
            <div style="font-weight:700;font-size:1rem;margin-bottom:8px;color:var(--danger)">这是一条不归路</div>
            <div style="font-size:0.82rem;color:var(--text-light);line-height:1.7;margin-bottom:14px;text-align:left">
              设立新人基金后，<b>无法撤销</b>。你将永久承担：<br/>
              <span style="color:var(--danger)">· 每月闲暇 -1天</span>（运营事务）<br/>
              <span style="color:var(--danger)">· 每月自动扣除 ¥${monthlyCost}</span>（运营费用）<br/><br/>
              这意味着你的时间和资金都会被持续消耗——<br/>投入容易，抽身难。<br/><br/>
              <span style="font-size:0.75rem;color:var(--text-muted);font-style:italic">"种下一棵树最好的时间是十年前，第二好的时间是现在。但浇水的责任，从此以后每一天都是你的。"</span>
            </div>
            <button class="btn btn-block" id="fund-confirm" style="background:#FFF0F0;border:1px solid var(--danger);color:var(--danger);margin-bottom:6px;font-weight:700">我想清楚了，设立基金</button>
            <button class="btn btn-block" id="fund-cancel" style="background:var(--bg);border:1px solid var(--border);color:var(--text-light)">再想想</button>
          </div>`;
        document.body.appendChild(warn);
        warn.querySelector('#fund-cancel').addEventListener('click', () => warn.remove());
        warn.querySelector('#fund-confirm').addEventListener('click', () => {
          warn.remove();
          state._sponsorTier = selectedTier;
          overlay.remove();
          executeInMonth(actionId);
        });
        return;
      }
      state._sponsorTier = selectedTier;
      overlay.remove();
      executeInMonth(actionId);
    });
    overlay.querySelector('#btn-sponsor-back').addEventListener('click', () => { overlay.remove(); cancelBack(); });
    return;
  }

  // Generic confirmation for all other actions
  const act = getActionDisplay(actionId, state) || ACTIONS[actionId];
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `
    <div class="event-card" style="max-width:320px">
      <div style="font-size:1.5rem">${act?.emoji ? ic(act.emoji, '1.5rem') : '?'}</div>
      <div style="font-weight:700;margin:6px 0">${act?.name || actionId}</div>
      <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:12px">${act?.costLabel || ''}</div>
      <button class="btn btn-primary btn-block" id="btn-gen-go" style="margin-bottom:6px">确认</button>
      <button class="btn btn-block" id="btn-gen-back" style="background:var(--bg);border:1px solid var(--border);color:var(--text-light)">返回</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#btn-gen-go').addEventListener('click', () => { overlay.remove(); executeInMonth(actionId); });
  overlay.querySelector('#btn-gen-back').addEventListener('click', () => { overlay.remove(); cancelBack(); });
}

// === Month Loop: every action shows full result, month-end is silent transition ===
function executeInMonth(actionId) {
  const { result, monthOver } = executeAction(state, actionId);

  // Restore event inventory: add back works not brought to this event, deduct sold
  if (state._restoreEventInventory) {
    state._restoreEventInventory();
    state._restoreEventInventory = null;
  }

  // Immediate gameover (goCommercial, etc.)
  if (state.phase === 'gameover') {
    deleteSave();
    syncBGM('gameover');
    renderGameOver(state, () => { syncBGM('title'); renderTitle(startGame, continueGame); });
    return;
  }

  // Show savings injection popup before result (first-time full-time doujin)
  const showResultFn = () => {
    renderResult(state, result, () => {
      state.phase = 'action';
      saveGame(state);
      renderGame(state, handleAction, handleRetire);
    });
  };

  if (result.savingsInjection) {
    const popup = document.createElement('div');
    popup.className = 'event-overlay';
    popup.innerHTML = `
      <div class="event-card" style="max-width:340px;text-align:center">
        <div style="font-size:1.5rem;margin-bottom:8px">${ic('wallet')}</div>
        <div style="font-weight:700;font-size:1.05rem;margin-bottom:8px">积蓄取出</div>
        <div style="font-size:0.82rem;color:var(--text-light);line-height:1.7;margin-bottom:12px;text-align:left">
          这些年工作攒下的存款<b>¥${result.savingsInjection.toLocaleString()}</b>，现在全部取出来了。<br><br>
          从现在起，右上角的金额就是你的<b>全部身家</b>——没有工资兜底，每月固定扣除¥1,300生活费。<br><br>
          <span style="color:var(--danger)">存款低于¥5,000时焦虑会开始消耗热情，归零就真的撑不下去了。</span>
        </div>
        <button class="btn btn-primary btn-block" id="savings-ok">明白了，开始搏斗</button>
      </div>`;
    document.body.appendChild(popup);
    popup.querySelector('#savings-ok').addEventListener('click', () => { popup.remove(); showResultFn(); });
  } else {
    showResultFn();
  }
}

function finishMonth() {
  // Month-end processing
  const monthResult = endMonth(state);
  monthResult.action = 'endMonth';
  monthResult.actionName = '月末结算';
  monthResult.actionEmoji = 'calendar-check';

  if (state.phase === 'gameover') {
    deleteSave();
    syncBGM('gameover');
    renderGameOver(state, () => { syncBGM('title'); renderTitle(startGame, continueGame); });
    return;
  }

  // Show month-end result page → transition animation → events → next month
  // Always show the settlement page (even with 0 deltas) so the financial summary is visible
  if (monthResult.deltas.length > 0 || monthResult.monthFinancial) {
    renderResult(state, monthResult, () => {
      showMonthTransition(state, () => afterMonthTransition(monthResult));
    });
  } else {
    showMonthTransition(state, () => afterMonthTransition(monthResult));
  }
}

function afterMonthTransition(monthResult) {
  const officialEvts = (monthResult.officialEvents || []).filter(e => e.type);
  showEventChain([...officialEvts], () => {
    const event = rollEvent(state);
    if (event) {
      let displayEvent = typeof event.effect === 'function' ? { ...event, effect: event.effect(state) } : event;
      if (typeof displayEvent.title === 'function') displayEvent = { ...displayEvent, title: displayEvent.title(state) };
      if (typeof displayEvent.desc === 'function') displayEvent = { ...displayEvent, desc: displayEvent.desc(state) };
      if (typeof displayEvent.tip === 'function') displayEvent = { ...displayEvent, tip: displayEvent.tip(state) };
      if (typeof displayEvent.effectClass === 'function') displayEvent = { ...displayEvent, effectClass: displayEvent.effectClass(state) };
      state.lastEvent = displayEvent;
      renderEvent(displayEvent, () => {
        applyEvent(state, event);
        // Trigger goddess chat for macro economic events
        const macroIds = ['recession', 'stagflation', 'debt_crisis', 'ai_revolution'];
        if (macroIds.includes(event.id)) {
          import('./chat-npc.js').then(({ triggerGoddessEvent }) => triggerGoddessEvent(state, event.id));
        }
        // Reset monthly accumulators so event money doesn't leak into next month's report
        state._monthIncome = 0;
        state._monthExpense = 0;
        if (state.phase === 'gameover') { deleteSave(); syncBGM('gameover'); renderGameOver(state, () => { syncBGM('title'); renderTitle(startGame, continueGame); }); return; }
        state.phase = 'action';
        syncBGM('game');
        saveGame(state);
        renderGame(state, handleAction, handleRetire);
      });
    } else {
      state.phase = 'action';
      syncBGM('game');
      saveGame(state);
      renderGame(state, handleAction, handleRetire);
    }
  });
}

function showMonthTransition(state, onDone) {
  const month = ((state.turn + 6) % 12) + 1;
  const seasonIcon = month >= 3 && month <= 5 ? 'flower-lotus' : month >= 6 && month <= 8 ? 'sun' : month >= 9 && month <= 11 ? 'leaf' : 'snowflake';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:200;animation:fadeIn 0.3s ease';
  overlay.innerHTML = `
    <div style="font-size:2.5rem;margin-bottom:8px">${ic(seasonIcon, '2.5rem')}</div>
    <div style="font-size:1.2rem;font-weight:700;color:var(--secondary)">第 ${state.turn + 1} 月</div>
    <div style="font-size:0.8rem;color:var(--text-light);margin-top:4px">进入下一个月…</div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.4s ease';
    setTimeout(() => { overlay.remove(); onDone(); }, 400);
  }, 800);
}

function showEventChain(events, done) {
  if (events.length === 0) { done(); return; }
  const evt = events.shift();
  if (evt.apply) evt.apply(state);
  // Trigger goddess for advanced macro events too
  const macroIds = ['recession', 'stagflation', 'debt_crisis', 'ai_revolution'];
  if (evt.id && macroIds.includes(evt.id)) {
    import('./chat-npc.js').then(({ triggerGoddessEvent }) => triggerGoddessEvent(state, evt.id));
  }
  renderEvent(evt, () => {
    if (state.phase === 'gameover') { deleteSave(); syncBGM('gameover'); renderGameOver(state, () => { syncBGM('title'); renderTitle(startGame, continueGame); }); return; }
    showEventChain(events, done);
  });
}

preloadBGM();
initAudioUnlock();
syncBGM('title');
renderTitle(startGame, continueGame);

// === Staggered preloading for slow connections (GitHub Pages from China) ===
// User spends 5-10s on title screen; use that time to warm caches.
const preloadImg = (src) => { const i = new Image(); i.src = src; };
const preloadChunk = (path) => import(path).catch(() => {});
const idle = (fn, ms) => typeof requestIdleCallback === 'function' ? requestIdleCallback(fn) : setTimeout(fn, ms);

// Phase 1 (~0s): JS chunks — most critical, unblocks minigame loading
idle(() => {
  preloadChunk('./minigame.js');
  preloadChunk('./promote-minigame.js');
  preloadChunk('./chat-npc.js');
}, 1000);

// Phase 2 (~3s): game screen images — needed right after clicking "start"
setTimeout(() => {
  preloadImg('background/background.webp');
  preloadImg('Goddess/Guimi.jpg');
  preloadImg('Goddess/goddess.jpg');
  const logos = ['嗯造.avif','次元宣发机.jpg','喵画师.avif','喵丝职聘.avif','漫展通.avif','打破次元壁.jpg','休息.avif','Memu.avif','同人市场观察.jpg','Nyaner.avif','短信.png'];
  logos.forEach(f => preloadImg(`app logos/${f}`));
}, 3000);

// Phase 3 (~6s): minigame assets — customers, backgrounds, settlement
setTimeout(() => {
  for (let i = 1; i <= 12; i++) preloadImg(`customers/${i}.png`);
  preloadImg('player/player.png');
  for (let i = 1; i <= 5; i++) preloadImg(`player/neighbor${i}.png`);
  ['bg.png','bg2.png','desk.png'].forEach(f => preloadImg(`minigame-background/${f}`));
  preloadImg('jiesuan/jiesuan.webp');
  preloadImg('jiesuan/jiesuan2.webp');
}, 6000);

// Phase 4 (~9s): promote minigame NPC avatars (30 small webps)
setTimeout(() => {
  preloadImg('prop-npc/player.webp');
  for (let i = 1; i <= 30; i++) preloadImg(`prop-npc/${i}.webp`);
}, 9000);
