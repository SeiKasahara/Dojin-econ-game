/**
 * Main — 同人社団物語 v5
 * Game loop with mini-game, pricing, event chains
 */

import './style.css';
import { createInitialState, executeTurn, executeAction, endMonth, rollEvent, applyEvent, ACTIONS, getLifeStage, generatePartnerCandidates, getTimeCost } from './engine.js';
import { renderTitle, renderEndowments, renderGame, renderTutorial, renderResult, renderEvent, renderGameOver, renderPriceSelector, renderEventSelector, renderReprintSelector, renderStrategySelector, renderEventModeSelector, renderSubtypeSelector, renderCreativeChoice, renderWorkNameInput, renderAppPage, renderMessageApp, openSNSPanel, openMarketApp, openBrowserApp } from './ui.js';
import { HVP_SUBTYPES, LVP_SUBTYPES, CREATIVE_CHOICES, applyCreativeChoice, PARTNER_TYPES } from './engine.js';
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
  renderEndowments((endowments, backgroundId) => {
    state = createInitialState(selectedPreset, endowments, backgroundId, selectedIpType);
    state._prevAchievementCount = 0;
    renderGame(state, handleAction, handleRetire);
    syncBGM('game');
    // Show tutorial on first game start
    renderTutorial(() => {
      // First month: bestie & goddess send welcome messages
      import('./chat-npc.js').then(({ triggerWelcomeMessages }) => {
        triggerWelcomeMessages(state);
        // Re-render to show message badge
        renderGame(state, handleAction, handleRetire);
      });
    });
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

function needsPricing(actionId) {
  // LVP pricing is now handled in the LVP subtype flow
  if (actionId === 'hvp' && state.hvpProject && state.hvpProject.progress + 1 >= state.hvpProject.needed) return true;
  return false;
}

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
      // Roll event condition: cancelled / normal / popular
      // Bigger events are more organized → lower cancel chance
      const baseCancelChance = chosenEvent.size === 'mega' ? 0.01 : chosenEvent.size === 'big' ? 0.03 : 0.05;
      const cancelChance = state.recessionTurnsLeft > 0 ? baseCancelChance * 3 : baseCancelChance;
      const condRoll = Math.random();
      if (condRoll < cancelChance) {
        chosenEvent.condition = 'cancelled';
        state.attendingEvent = chosenEvent;
        state._minigameResult = null;
        state._eventMode = 'attend';
        renderEvent({
          emoji: 'smiley-x-eyes', title: '展会流展了！',
          desc: `${chosenEvent.name}@${chosenEvent.city}因故取消，到了现场才知道消息……路费白花了。`,
          effect: `路费-¥${chosenEvent.travelCost} 热情-5`, effectClass: 'negative',
          tip: '流展是同人展会的现实风险之一。路费变成沉没成本，只能认栽。',
        }, () => executeInMonth(actionId));
        return;
      }
      chosenEvent.condition = condRoll < 0.30 ? 'popular' : 'normal';

      // Show attend mode selector: 亲参 vs 寄售
      renderEventModeSelector(state, chosenEvent, (mode) => {
        state.attendingEvent = chosenEvent;

        // Work stage leave check: need to take time off to attend in person
        if (mode === 'attend' && getLifeStage(state.turn) === 'work' && !state.unemployed) {
          // Base 70%, drops during active time debuffs (996, burnout, etc.)
          const busyDebuffs = state.timeDebuffs.filter(d => d.delta < 0).length;
          const leaveProb = Math.max(0.25, 0.70 - busyDebuffs * 0.15);
          if (Math.random() >= leaveProb) {
            // Leave denied → forced consignment
            state._eventMode = 'consign';
            state._minigameResult = null;
            state._leaveDenied = true; // flag for result display
            executeInMonth(actionId);
            return;
          }
        }

        state._eventMode = mode;
        if (mode === 'attend') {
          // 亲参 → play minigame
          syncBGM('minigame');
          showLoadingOverlay('准备展会中…');
          import('./minigame.js').then(({ startMinigame }) => {
            removeLoadingOverlay();
            startMinigame(state, chosenEvent, (mgResult) => {
              state._minigameResult = mgResult || null;
              executeInMonth(actionId);
            });
          });
        } else {
          // 寄售 → skip minigame, use CES model
          state._minigameResult = null;
          executeInMonth(actionId);
        }
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
    renderReprintSelector(state, (workIds) => {
      state._reprintWorkIds = workIds;
      executeInMonth(actionId);
    }, cancelBack);
    return;
  }

  // === HVP flow: new project → subtype + theme choice; continue → execution/polish choice ===
  if (actionId === 'hvp' && !needsPricing(actionId)) {
    if (!state.hvpProject) {
      // New project: select subtype → name → theme choice → proceed
      renderSubtypeSelector(state, 'hvp', (subtypeId) => {
        state._selectedHVPSubtype = subtypeId;
        const sub = HVP_SUBTYPES[subtypeId];
        renderWorkNameInput(sub.name, sub.emoji, (name) => {
          state._hvpWorkName = name;
          renderCreativeChoice(CREATIVE_CHOICES.theme, (themeId) => {
            state._pendingChoices = [{ category: 'theme', optionId: themeId }];
            executeInMonth(actionId);
          }, cancelBack);
        }, cancelBack);
      }, cancelBack);
    } else {
      // Continue project: show creative choice for this month
      const nextMonth = state.hvpProject.progress + 1;
      const choicesMade = state.hvpProject.choices?.length || 0;
      // Month 2: execution choice (if not yet made and we have >1 month projects)
      if (nextMonth === 2 && choicesMade < 2) {
        renderCreativeChoice(CREATIVE_CHOICES.execution, (choiceId) => {
          state._pendingChoices = [{ category: 'execution', optionId: choiceId }];
          executeInMonth(actionId);
        }, cancelBack);
      // Month 3+: final polish choice (if 3+ month project and not yet made)
      } else if (nextMonth >= 3 && nextMonth >= state.hvpProject.needed && choicesMade < 3) {
        renderCreativeChoice(CREATIVE_CHOICES.finalPolish, (choiceId) => {
          state._pendingChoices = [{ category: 'finalPolish', optionId: choiceId }];
          executeInMonth(actionId);
        }, cancelBack);
      } else {
        // No choice needed this month, just confirm
        const p = state.hvpProject;
        const sub = HVP_SUBTYPES[p.subtype] || HVP_SUBTYPES.manga;
        const overlay = document.createElement('div');
        overlay.className = 'event-overlay';
        overlay.innerHTML = `
          <div class="event-card" style="max-width:340px">
            <div style="font-size:1.3rem">${ic(sub.emoji, '1.3rem')}</div>
            <div style="font-weight:700;margin:4px 0">继续创作${sub.name}${p.name ? '·' + p.name : ''}</div>
            <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:12px">进度 ${p.progress}/${p.needed}</div>
            <button class="btn btn-primary btn-block" id="btn-hvp-go" style="margin-bottom:6px">继续创作</button>
            <button class="btn btn-block" id="btn-hvp-back" style="background:var(--bg);border:1px solid var(--border);color:var(--text-light)">返回</button>
          </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#btn-hvp-go').addEventListener('click', () => { overlay.remove(); executeInMonth(actionId); });
        overlay.querySelector('#btn-hvp-back').addEventListener('click', () => { overlay.remove(); cancelBack(); });
      }
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
  if (needsPricing(actionId)) {
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
          </div>`;
        document.body.appendChild(renewOverlay);
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

    showPartnerSelector();
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
              const avatarHtml = c.avatarIdx
                ? `<img src="partner/${c.avatarIdx}.webp" style="width:42px;height:42px;border-radius:50%;object-fit:cover;border:2px solid ${tc};flex-shrink:0">`
                : `<div style="width:42px;height:42px;border-radius:50%;background:#27AE60;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0">${ic('user')}</div>`;
              const typeHint = c.visibleType
                ? `<span style="font-size:0.65rem;color:${c.visibleType === 'supportive' ? 'var(--success)' : c.visibleType === 'toxic' ? 'var(--danger)' : 'var(--accent)'}">${PARTNER_TYPES[c.visibleType]?.name || ''}</span>`
                : '';
              const affinityDots = c.affinity != null
                ? '<span style="font-size:0.6rem;color:' + tc + '">' + '●'.repeat(Math.floor(c.affinity)) + '○'.repeat(5 - Math.floor(c.affinity)) + '</span>'
                : '';
              return `
                <div class="app-action-card" data-idx="${i}" style="cursor:pointer">
                  ${avatarHtml}
                  <div class="app-action-body">
                    <div class="app-action-name" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                      ${c.name}
                      ${c.tier ? `<span style="font-size:0.58rem;padding:1px 5px;border-radius:6px;background:${tc}18;color:${tc};font-weight:600">${tl}</span>` : ''}
                      ${typeHint}
                    </div>
                    <div class="app-action-cost">${c.bio}</div>
                    ${affinityDots ? `<div style="margin-top:2px">${affinityDots}</div>` : ''}
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#partner-back').addEventListener('click', () => { overlay.remove(); cancelBack(); });
      overlay.querySelectorAll('.app-action-card').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.idx);
          state._selectedPartnerCandidate = candidates[idx];
          overlay.remove();
          executeInMonth(actionId);
        });
      });
    } // end showPartnerSelector
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

  // Generic confirmation for all other actions
  const act = ACTIONS[actionId];
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

  // Immediate gameover (goCommercial, etc.)
  if (state.phase === 'gameover') {
    deleteSave();
    syncBGM('gameover');
    renderGameOver(state, () => { syncBGM('title'); renderTitle(startGame, continueGame); });
    return;
  }

  // Every action shows full result page, then return to game (same month)
  renderResult(state, result, () => {
    state.phase = 'action';
    saveGame(state);
    renderGame(state, handleAction, handleRetire);
  });
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
      const displayEvent = typeof event.effect === 'function' ? { ...event, effect: event.effect(state) } : event;
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
