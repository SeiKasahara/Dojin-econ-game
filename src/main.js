/**
 * Main — 同人社団物語 v5
 * Game loop with mini-game, pricing, event chains
 */

import './style.css';
import { createInitialState, executeTurn, rollEvent, applyEvent, ACTIONS, getLifeStage, generatePartnerCandidates } from './engine.js';
import { renderTitle, renderEndowments, renderGame, renderTutorial, renderResult, renderEvent, renderGameOver, renderPriceSelector, renderEventSelector, renderReprintSelector, renderStrategySelector, renderEventModeSelector, renderSubtypeSelector, renderCreativeChoice, renderAppPage, renderMessageApp, openSNSPanel, openMarketApp, openBrowserApp } from './ui.js';
import { HVP_SUBTYPES, LVP_SUBTYPES, CREATIVE_CHOICES, applyCreativeChoice } from './engine.js';
import { preloadBGM, initAudioUnlock, updateBGM } from './bgm.js';
import { ic } from './icons.js';
import { saveGame, loadGame, deleteSave } from './save.js';

let state = null;

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
    renderTutorial(() => {});
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
      // Roll event condition: cancelled / normal / popular (recession increases cancel chance)
      const cancelChance = state.recessionTurnsLeft > 0 ? 0.15 : 0.05;
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
        }, () => proceedWithTurn(actionId));
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
            proceedWithTurn(actionId);
            return;
          }
        }

        state._eventMode = mode;
        if (mode === 'attend') {
          // 亲参 → play minigame
          syncBGM('minigame');
          import('./minigame.js').then(({ startMinigame }) => {
            startMinigame(state, chosenEvent, (mgResult) => {
              state._minigameResult = mgResult || null;
              proceedWithTurn(actionId);
            });
          });
        } else {
          // 寄售 → skip minigame, use CES model
          state._minigameResult = null;
          proceedWithTurn(actionId);
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
    renderReprintSelector(state, (workId) => {
      state._reprintWorkId = workId;
      proceedWithTurn(actionId);
    }, cancelBack);
    return;
  }

  // === HVP flow: new project → subtype + theme choice; continue → execution/polish choice ===
  if (actionId === 'hvp' && !needsPricing(actionId)) {
    if (!state.hvpProject) {
      // New project: select subtype → theme choice → proceed
      renderSubtypeSelector(state, 'hvp', (subtypeId) => {
        state._selectedHVPSubtype = subtypeId;
        const sub = HVP_SUBTYPES[subtypeId];
        renderCreativeChoice(CREATIVE_CHOICES.theme, (themeId) => {
          state._pendingChoices = [{ category: 'theme', optionId: themeId }];
          proceedWithTurn(actionId);
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
          proceedWithTurn(actionId);
        }, cancelBack);
      // Month 3+: final polish choice (if 3+ month project and not yet made)
      } else if (nextMonth >= 3 && nextMonth >= state.hvpProject.needed && choicesMade < 3) {
        renderCreativeChoice(CREATIVE_CHOICES.finalPolish, (choiceId) => {
          state._pendingChoices = [{ category: 'finalPolish', optionId: choiceId }];
          proceedWithTurn(actionId);
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
            <div style="font-weight:700;margin:4px 0">继续创作${sub.name}</div>
            <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:12px">进度 ${p.progress}/${p.needed}</div>
            <button class="btn btn-primary btn-block" id="btn-hvp-go" style="margin-bottom:6px">继续创作</button>
            <button class="btn btn-block" id="btn-hvp-back" style="background:var(--bg);border:1px solid var(--border);color:var(--text-light)">返回</button>
          </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#btn-hvp-go').addEventListener('click', () => { overlay.remove(); proceedWithTurn(actionId); });
        overlay.querySelector('#btn-hvp-back').addEventListener('click', () => { overlay.remove(); cancelBack(); });
      }
    }
    return;
  }

  // === LVP flow: select subtype → process choice → pricing ===
  if (actionId === 'lvp') {
    renderSubtypeSelector(state, 'lvp', (subtypeId) => {
      state._selectedLVPSubtype = subtypeId;
      renderCreativeChoice(CREATIVE_CHOICES.lvpProcess, (processId) => {
        state._lvpProcessChoice = processId;
        // Now pricing
        renderPriceSelector(state, 'lvp', (chosenPrice) => {
          state.playerPrice.lvp = chosenPrice;
          proceedWithTurn(actionId);
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
          proceedWithTurn(actionId);
        });
      } else {
        proceedWithTurn(actionId);
      }
    }, cancelBack);
    return;
  }

  // === Find Partner: candidate selection flow ===
  if (actionId === 'findPartner') {
    const candidates = generatePartnerCandidates(state);
    if (!candidates) {
      // No candidates available — show failure overlay then proceed
      state._partnerSearchFailed = true;
      proceedWithTurn(actionId);
      return;
    }
    // Show candidate selection
    const overlay = document.createElement('div');
    overlay.className = 'event-overlay';
    overlay.innerHTML = `
      <div class="app-page" style="max-height:75vh">
        <div class="app-titlebar" style="border-bottom-color:#27AE60">
          <button class="app-back" id="partner-back">${ic('arrow-left')} 返回</button>
          <span class="app-title">${ic('handshake')} 寻找搭档</span>
          <span style="width:60px"></span>
        </div>
        <div class="app-page-body">
          <div style="font-size:0.78rem;color:var(--text-light);margin-bottom:12px;text-align:center">有${candidates.length}位创作者愿意合作，选一个试试？</div>
          ${candidates.map((c, i) => `
            <div class="app-action-card" data-idx="${i}" style="cursor:pointer">
              <div style="width:36px;height:36px;border-radius:50%;background:#27AE60;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;font-size:0.85rem">
                ${ic('user')}
              </div>
              <div class="app-action-body">
                <div class="app-action-name">${c.name}</div>
                <div class="app-action-cost">${c.bio}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#partner-back').addEventListener('click', () => { overlay.remove(); cancelBack(); });
    overlay.querySelectorAll('.app-action-card').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx);
        state._selectedPartnerCandidate = candidates[idx];
        overlay.remove();
        proceedWithTurn(actionId);
      });
    });
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
  overlay.querySelector('#btn-gen-go').addEventListener('click', () => { overlay.remove(); proceedWithTurn(actionId); });
  overlay.querySelector('#btn-gen-back').addEventListener('click', () => { overlay.remove(); cancelBack(); });
}

function proceedWithTurn(actionId) {
  const result = executeTurn(state, actionId);

  if (state.phase === 'gameover') {
    deleteSave();
    syncBGM('gameover');
    renderGameOver(state, () => { syncBGM('title'); renderTitle(startGame, continueGame); });
    return;
  }

  renderResult(state, result, () => {
    const officialEvts = (result.officialEvents || []).filter(e => e.type);
    showEventChain([...officialEvts], () => {
      const event = rollEvent(state);
      if (event) {
        // Resolve dynamic effect text (some events compute effect based on player state)
        const displayEvent = typeof event.effect === 'function' ? { ...event, effect: event.effect(state) } : event;
        state.lastEvent = displayEvent;
        renderEvent(displayEvent, () => {
          applyEvent(state, event);
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
  });
}

function showEventChain(events, done) {
  if (events.length === 0) { done(); return; }
  const evt = events.shift();
  if (evt.apply) evt.apply(state);
  renderEvent(evt, () => {
    if (state.phase === 'gameover') { deleteSave(); syncBGM('gameover'); renderGameOver(state, () => { syncBGM('title'); renderTitle(startGame, continueGame); }); return; }
    showEventChain(events, done);
  });
}

preloadBGM();
initAudioUnlock();
syncBGM('title');
renderTitle(startGame, continueGame);
