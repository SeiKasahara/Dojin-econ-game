/**
 * Main — 同人社団物語 v5
 * Game loop with mini-game, pricing, event chains
 */

import './style.css';
import { createInitialState, executeTurn, rollEvent, applyEvent, ACTIONS } from './engine.js';
import { renderTitle, renderEndowments, renderGame, renderResult, renderEvent, renderGameOver, renderPriceSelector, renderEventSelector, renderReprintSelector, renderStrategySelector, renderEventModeSelector } from './ui.js';

let state = null;

let selectedPreset = 'mid';

function startGame(communityPreset) {
  selectedPreset = communityPreset || 'mid';
  // Show endowment allocation screen before game starts
  renderEndowments((endowments, backgroundId) => {
    state = createInitialState(selectedPreset, endowments, backgroundId);
    state._prevAchievementCount = 0;
    renderGame(state, handleAction);
  });
}

function needsPricing(actionId) {
  if (actionId === 'lvp') return true;
  if (actionId === 'hvp' && state.hvpProject && state.hvpProject.progress + 1 >= state.hvpProject.needed) return true;
  return false;
}

function handleAction(actionId) {
  const cancelBack = () => renderGame(state, handleAction);

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
          emoji: '😱', title: '展会流展了！',
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
        state._eventMode = mode;
        if (mode === 'attend') {
          // 亲参 → play minigame
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
    renderReprintSelector(state, (reprintType) => {
      state._reprintType = reprintType;
      proceedWithTurn(actionId);
    }, cancelBack);
    return;
  }

  // === HVP confirmation (multi-turn commitment) ===
  if (actionId === 'hvp' && !needsPricing(actionId)) {
    const isNew = !state.hvpProject;
    const needed = state.hasPartner ? 2 : 3;
    const overlay = document.createElement('div');
    overlay.className = 'event-overlay';
    overlay.innerHTML = `
      <div class="event-card" style="max-width:340px">
        <div class="event-emoji">📖</div>
        <div class="event-title">${isNew ? '开始创作同人本？' : '继续创作同人本？'}</div>
        <div class="event-desc" style="margin-bottom:12px">${isNew
          ? `需要${needed}个月完成${state.hasPartner ? '（搭档协作）' : '（独自创作）'}，每月消耗热情。完成后印刷入库。`
          : `当前进度 ${state.hvpProject.progress}/${state.hvpProject.needed}，继续投入本月的创作时间。`}</div>
        <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:12px">每月消耗：热情-${Math.max(8, 15 - (state.endowments?.stamina || 0))} · 需闲暇≥4</div>
        <button class="btn btn-primary btn-block" id="btn-hvp-go" style="margin-bottom:8px">${isNew ? '开始创作' : '继续创作'}</button>
        <button class="btn btn-block" id="btn-hvp-back" style="background:var(--bg);border:1px solid var(--border);color:var(--text-light)">返回</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#btn-hvp-go').addEventListener('click', () => { overlay.remove(); proceedWithTurn(actionId); });
    overlay.querySelector('#btn-hvp-back').addEventListener('click', () => { overlay.remove(); cancelBack(); });
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

  // Generic confirmation for all other actions
  const act = ACTIONS[actionId];
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `
    <div class="event-card" style="max-width:320px">
      <div style="font-size:1.5rem">${act?.emoji || '❓'}</div>
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
    renderGameOver(state, () => renderTitle(startGame));
    return;
  }

  renderResult(state, result, () => {
    const officialEvts = (result.officialEvents || []).filter(e => e.type);
    showEventChain([...officialEvts], () => {
      const event = rollEvent(state);
      if (event) {
        state.lastEvent = event;
        renderEvent(event, () => {
          applyEvent(state, event);
          if (state.phase === 'gameover') { renderGameOver(state, () => renderTitle(startGame)); return; }
          state.phase = 'action';
          renderGame(state, handleAction);
        });
      } else {
        state.phase = 'action';
        renderGame(state, handleAction);
      }
    });
  });
}

function showEventChain(events, done) {
  if (events.length === 0) { done(); return; }
  const evt = events.shift();
  if (evt.apply) evt.apply(state);
  renderEvent(evt, () => {
    if (state.phase === 'gameover') { renderGameOver(state, () => renderTitle(startGame)); return; }
    showEventChain(events, done);
  });
}

renderTitle(startGame);
