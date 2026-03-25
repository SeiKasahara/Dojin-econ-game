/**
 * Save/Load system — localStorage persistence
 */

import { getAge, getLifeStageLabel } from './engine.js';

const SAVE_KEY = 'dojin_save';

/** Filter out temporary _ properties before serializing */
function cleanState(state) {
  const cleaned = {};
  for (const [k, v] of Object.entries(state)) {
    if (k.startsWith('_')) continue;
    cleaned[k] = v;
  }
  return cleaned;
}

/** Save current game state to localStorage */
export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      state: cleanState(state),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage full or unavailable — silently fail
  }
}

/** Load game state from localStorage. Returns state object or null. */
export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.state) return null;
    // Restore _prevAchievementCount so achievements don't re-announce
    data.state._prevAchievementCount = data.state.achievements?.length || 0;
    return data.state;
  } catch (e) {
    return null;
  }
}

/** Check if a save exists */
export function hasSave() {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch (e) {
    return false;
  }
}

/** Get summary info for display on title screen */
export function getSaveSummary() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const s = data.state;
    if (!s) return null;
    return {
      turn: s.turn,
      age: getAge(s.turn),
      stage: getLifeStageLabel(s.turn, s),
      money: s.money,
      reputation: s.reputation?.toFixed(1),
      passion: Math.round(s.passion),
      savedAt: data.savedAt,
    };
  } catch (e) {
    return null;
  }
}

/** Delete save data */
export function deleteSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    // ignore
  }
}
