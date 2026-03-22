/**
 * Main — 同人社団物語 v5
 * Game loop with mini-game, pricing, event chains
 */

import './style.css';
import { createInitialState, executeTurn, rollEvent, applyEvent } from './engine.js';
import { renderTitle, renderGame, renderResult, renderEvent, renderGameOver, renderPriceSelector, renderEventSelector } from './ui.js';

let state = null;

function startGame(communityPreset) {
  state = createInitialState(communityPreset || 'mid');
  state._prevAchievementCount = 0;
  renderGame(state, handleAction);
}

function needsPricing(actionId) {
  if (actionId === 'lvp') return true;
  if (actionId === 'hvp' && state.hvpProject && state.hvpProject.progress + 1 >= state.hvpProject.needed) return true;
  return false;
}

function handleAction(actionId) {
  // === Attend Event: event selection → mini-game → proceed ===
  if (actionId === 'attendEvent') {
    const launchMinigame = (chosenEvent) => {
      state.attendingEvent = chosenEvent;
      // Dynamic import for code splitting
      import('./minigame.js').then(({ startMinigame }) => {
        startMinigame(state, chosenEvent, (mgResult) => {
          if (mgResult === null) {
            // Skipped mini-game → use default instant resolve
            proceedWithTurn(actionId);
          } else {
            state._minigameResult = mgResult;
            proceedWithTurn(actionId);
          }
        });
      });
    };

    if (state.availableEvents && state.availableEvents.length > 1) {
      renderEventSelector(state, launchMinigame);
    } else if (state.availableEvents && state.availableEvents.length === 1) {
      launchMinigame(state.availableEvents[0]);
    }
    return;
  }

  // === Pricing ===
  if (needsPricing(actionId)) {
    const type = actionId === 'lvp' ? 'lvp' : 'hvp';
    renderPriceSelector(state, type, (chosenPrice) => {
      state.playerPrice[type] = chosenPrice;
      proceedWithTurn(actionId);
    });
    return;
  }

  proceedWithTurn(actionId);
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
