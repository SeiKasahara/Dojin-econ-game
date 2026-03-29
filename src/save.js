/**
 * Save/Load system — localStorage persistence with anti-tamper protection
 *
 * Protection layers:
 * 1. State JSON is Base64-encoded (not directly readable/editable in DevTools)
 * 2. HMAC-like checksum using a keyed hash (editing payload invalidates checksum)
 * 3. Tampered saves are flagged but not deleted (player keeps progress with a mark)
 */

import { getAge, getLifeStageLabel } from './engine/core.js';
import { rebuildResolveCheck } from './prediction-contracts.js';
import { cyrb53, computeChecksum } from './hash.js';

const SAVE_KEY = 'dojin_save';
const AVATAR_KEY = 'dojin_avatar';

/** Save custom avatar (base64 data URL) */
export function saveAvatar(dataUrl) {
  try { localStorage.setItem(AVATAR_KEY, dataUrl); } catch (e) { /* full */ }
}

/** Load custom avatar. Returns data URL string or null. */
export function loadAvatar() {
  try { return localStorage.getItem(AVATAR_KEY); } catch (e) { return null; }
}

/** Delete custom avatar */
export function deleteAvatar() {
  try { localStorage.removeItem(AVATAR_KEY); } catch (e) { /* ignore */ }
}

/** Get player avatar src — custom if uploaded, else default */
export function getPlayerAvatar() {
  return loadAvatar() || 'prop-npc/player.webp';
}
const SAVE_VERSION = 2; // v2 = signed saves

// --- Base64 helpers (handle Unicode via UTF-8 encoding) ---
function toBase64(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
}

function fromBase64(b64) {
  return decodeURIComponent(
    atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
  );
}

// --- Clean state (remove temporary _ properties, preserve persistent ones) ---
const PERSISTENT_UNDERSCORED = new Set([
  '_predictions',         // prediction market: contracts, holdings, profit history
  '_debtBailoutDone',     // achievement tracking: debt bailout this cycle
  '_debtBailedOnce',      // achievement tracking: permanent first-bailout flag
  '_debtPassionStreak',   // achievement tracking: consecutive low-money high-passion months
  '_lowPassionHit',       // achievement tracking: ever had passion<=15
  '_passionRecovered',    // achievement tracking: recovered from <=15 to >=80
  '_recessionEndTurn',    // tracks when recession ended (for doubleRecession contract)
  '_lastBacklashTurn',    // backlash cooldown
  '_partnerRenewalOffer', // pending partner renewal offer
  '_tamperCountdown',     // anti-tamper system
  '_smallCircleBigRepShown',  // milestone: rep≥5 in small circle (one-time)
  '_smallCircleLegendShown',  // milestone: rep≥8 in small circle (one-time)
  '_partnerChatLastTurn',     // partner chat cooldown tracking
  '_clubContractFired',       // player club prediction contract (one-time)
  '_marketManipulated',       // achievement flag: won a club contract
  '_fundEstablished',         // new creator fund established (permanent time debuff)
]);

function cleanState(state) {
  const cleaned = {};
  for (const [k, v] of Object.entries(state)) {
    if (k.startsWith('_') && !PERSISTENT_UNDERSCORED.has(k)) continue;
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
    // Reconstruct cumulative counters from works array if missing
    if (state.totalHVP == null || state.totalLVP == null) {
      const works = state.inventory?.works || [];
      state.totalHVP = state.totalHVP ?? works.filter(w => w.type === 'hvp').length;
      state.totalLVP = state.totalLVP ?? works.filter(w => w.type === 'lvp').length;
    }
    // Migrate skillExp for saves from before the experience-based skill system
    // getCreativeSkill will handle the actual migration on first call
    if (state.skillExp == null) state.skillExp = 0;

    // Rebuild prediction market resolveCheck functions from serializable descriptors
    if (state._predictions?.contracts) {
      for (const c of state._predictions.contracts) {
        rebuildResolveCheck(c);
      }
    }

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

/** Export save as a downloadable JSON file */
export function exportSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const data = JSON.parse(raw);
    let filename = 'dojin-save';
    // Try to include age in filename for identification
    if (data.p) {
      try {
        const s = JSON.parse(fromBase64(data.p));
        filename = `dojin-save-${getAge(s.turn)}岁`;
      } catch (_) { /* ignore */ }
    }
    a.href = url;
    a.download = `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/** Import save from a JSON file. Returns a Promise that resolves to { success, error? } */
export function importSave() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) { resolve({ success: false, error: '未选择文件' }); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = reader.result;
          const data = JSON.parse(raw);
          // Validate structure: must have v+p (v2) or state (v1)
          if (!((data.v >= 2 && data.p) || data.state)) {
            resolve({ success: false, error: '文件格式不正确' });
            return;
          }
          localStorage.setItem(SAVE_KEY, raw);
          resolve({ success: true });
        } catch (e) {
          resolve({ success: false, error: '文件解析失败' });
        }
      };
      reader.onerror = () => resolve({ success: false, error: '文件读取失败' });
      reader.readAsText(file);
    });
    // User cancelled file picker
    input.addEventListener('cancel', () => resolve({ success: false, error: '已取消' }));
    input.click();
  });
}
