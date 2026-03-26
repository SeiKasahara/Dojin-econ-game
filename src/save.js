/**
 * Save/Load system — localStorage persistence with anti-tamper protection
 *
 * Protection layers:
 * 1. State JSON is Base64-encoded (not directly readable/editable in DevTools)
 * 2. HMAC-like checksum using a keyed hash (editing payload invalidates checksum)
 * 3. Tampered saves are flagged but not deleted (player keeps progress with a mark)
 */

import { getAge, getLifeStageLabel } from './engine.js';

const SAVE_KEY = 'dojin_save';
const SAVE_VERSION = 2; // v2 = signed saves

// --- Keyed hash (cyrb53 variant) ---
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// Salt mixed into hash — makes rainbow tables useless
const HMAC_KEY = 'dj_ec0n_s4lt_!@#_2024';

function computeChecksum(payload) {
  // Double hash with key sandwiching (poor-man's HMAC)
  const inner = cyrb53(HMAC_KEY + payload, 0x9e3779b9);
  return cyrb53(inner + HMAC_KEY + payload.length, 0x517cc1b7);
}

// --- Base64 helpers (handle Unicode via UTF-8 encoding) ---
function toBase64(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
}

function fromBase64(b64) {
  return decodeURIComponent(
    atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
  );
}

// --- Clean state (remove temporary _ properties) ---
function cleanState(state) {
  const cleaned = {};
  for (const [k, v] of Object.entries(state)) {
    if (k.startsWith('_')) continue;
    cleaned[k] = v;
  }
  return cleaned;
}

/** Save current game state to localStorage (signed + encoded) */
export function saveGame(state) {
  try {
    const stateJson = JSON.stringify(cleanState(state));
    const payload = toBase64(stateJson);
    const checksum = computeChecksum(stateJson);
    const data = {
      v: SAVE_VERSION,
      t: Date.now(),
      p: payload,
      c: checksum,
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

    let state;

    if (data.v >= 2 && data.p) {
      // --- v2 signed save ---
      const stateJson = fromBase64(data.p);
      const expectedChecksum = computeChecksum(stateJson);

      state = JSON.parse(stateJson);

      if (data.c !== expectedChecksum) {
        // Tampered! Allow loading but mark the save
        state.tampered = true;
      }
    } else if (data.state) {
      // --- v1 legacy save (unprotected) — migrate silently ---
      state = data.state;
    } else {
      return null;
    }

    // Restore internal fields
    state._prevAchievementCount = state.achievements?.length || 0;

    // Migrations
    if (!state.contacts) state.contacts = [];
    if (!state.contactNextId) state.contactNextId = 1;
    if (state.activeContactId === undefined) state.activeContactId = null;
    if (state.monthTimeSpent === undefined) state.monthTimeSpent = 0;
    if (!state.monthActions) state.monthActions = [];
    if (state.hvpWorkedThisMonth === undefined) state.hvpWorkedThisMonth = false;
    if (state.lvpWorkedThisMonth === undefined) state.lvpWorkedThisMonth = false;
    if (state.monthHadCreativeAction === undefined) state.monthHadCreativeAction = false;

    return state;
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

    let s;
    if (data.v >= 2 && data.p) {
      s = JSON.parse(fromBase64(data.p));
    } else if (data.state) {
      s = data.state;
    }
    if (!s) return null;

    return {
      turn: s.turn,
      age: getAge(s.turn),
      stage: getLifeStageLabel(s.turn, s),
      money: s.money,
      reputation: s.reputation?.toFixed(1),
      passion: Math.round(s.passion),
      savedAt: data.t || data.savedAt,
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
