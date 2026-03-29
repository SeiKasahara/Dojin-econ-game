/**
 * UI Renderer — 同人社团物语 v4 (Phase 2)
 * Re-export orchestrator: all UI modules live under ./ui/
 */

export { renderTitle, renderEndowments, renderGame, renderTutorial, renderResult, renderEvent, renderGameOver } from './ui/screens.js';
export { APP_DEFS, renderAppDesktop, renderAppPage } from './ui/app-page.js';
export { renderMessageApp } from './ui/app-message.js';
export { openBrowserApp } from './ui/app-browser.js';
export { openMarketApp } from './ui/app-market.js';
export { openSNSPanel } from './ui/app-sns.js';
export { renderPriceSelector, renderSubtypeSelector, renderWorkNameInput, renderCreativeChoice, renderStrategySelector, renderEventModeSelector, renderEventSelector, renderReprintSelector } from './ui/selectors.js';
