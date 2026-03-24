/**
 * BGM Manager — crossfade background music system
 * Tracks: title, university, work, event
 */

const FADE_MS = 1500; // crossfade duration
const FADE_STEP = 50; // interval step

const TRACKS = {
  title:      { src: 'music/yuruyakanaasayake.mp3',   vol: 0.45 },
  university: { src: 'music/kasumisou.mp3',            vol: 0.35 },
  work:       { src: 'music/latenightsnow.mp3',        vol: 0.35 },
  event:      { src: 'music/natsuyasuminotanken.mp3',   vol: 0.40 },
  gameover:   { src: 'music/kagaribi.mp3',              vol: 0.35 },
};

const audios = {};   // { trackId: HTMLAudioElement }
let current = null;  // currently playing track id
let desired = null;  // track we want to play (may not be playing yet due to autoplay policy)
let fadeTimer = null;
let muted = false;
let unlocked = false; // has user interacted?

function getAudio(id) {
  if (!audios[id]) {
    const a = new Audio(TRACKS[id].src);
    a.loop = true;
    a.volume = 0;
    a.preload = 'auto';
    audios[id] = a;
  }
  return audios[id];
}

/** Preload all tracks */
export function preloadBGM() {
  for (const id of Object.keys(TRACKS)) getAudio(id);
}

/** Actually start playing the desired track (call after user gesture) */
function tryPlay(trackId) {
  const audio = getAudio(trackId);
  const targetVol = muted ? 0 : TRACKS[trackId].vol;

  // If same track is already audibly playing, skip
  if (current === trackId && !audio.paused) return;

  const oldId = current;
  const oldAudio = oldId && oldId !== trackId ? audios[oldId] : null;
  current = trackId;

  // Start new track from beginning
  audio.currentTime = 0;
  audio.volume = 0;
  const p = audio.play();
  if (p) p.catch(() => {}); // still catch in case of edge cases

  // Clear any existing fade
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }

  const steps = FADE_MS / FADE_STEP;
  let step = 0;

  fadeTimer = setInterval(() => {
    step++;
    const t = step / steps;

    // Fade out old
    if (oldAudio) {
      const oldTarget = TRACKS[oldId].vol;
      oldAudio.volume = Math.max(0, oldTarget * (1 - t) * (muted ? 0 : 1));
    }

    // Fade in new
    audio.volume = Math.min(targetVol, targetVol * t);

    if (step >= steps) {
      clearInterval(fadeTimer);
      fadeTimer = null;
      if (oldAudio) { oldAudio.pause(); oldAudio.volume = 0; }
      audio.volume = targetVol;
    }
  }, FADE_STEP);
}

/**
 * Request a track to play. If audio is not yet unlocked (no user gesture),
 * stores as desired and will play on first interaction.
 */
export function playBGM(trackId) {
  if (!TRACKS[trackId]) return;
  desired = trackId;
  if (unlocked) tryPlay(trackId);
}

/** Call once from a user gesture to unlock audio playback */
function unlock() {
  if (unlocked) return;
  unlocked = true;
  // Only play the desired track — do NOT play all tracks at once (iOS bug)
  if (desired) {
    tryPlay(desired);
  }
}

/** Install a one-time global click/touch listener to unlock audio */
export function initAudioUnlock() {
  const handler = () => {
    unlock();
    document.removeEventListener('click', handler, true);
    document.removeEventListener('touchstart', handler, true);
  };
  document.addEventListener('click', handler, true);
  document.addEventListener('touchstart', handler, true);
}

/** Stop all tracks with fade out */
export function stopBGM() {
  desired = null;
  if (!current) return;
  const oldId = current;
  const oldAudio = audios[oldId];
  current = null;
  if (!oldAudio) return;

  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }

  const startVol = oldAudio.volume;
  const steps = FADE_MS / FADE_STEP;
  let step = 0;

  fadeTimer = setInterval(() => {
    step++;
    oldAudio.volume = Math.max(0, startVol * (1 - step / steps));
    if (step >= steps) {
      clearInterval(fadeTimer);
      fadeTimer = null;
      oldAudio.pause();
      oldAudio.volume = 0;
    }
  }, FADE_STEP);
}

/** Toggle mute */
export function toggleMute() {
  muted = !muted;
  if (current && audios[current]) {
    audios[current].volume = muted ? 0 : TRACKS[current].vol;
  }
  return muted;
}

export function isMuted() { return muted; }

/**
 * Decide which track should play based on game state.
 * Call this whenever the screen changes.
 */
export function updateBGM(screen, state) {
  if (screen === 'title' || screen === 'endowment') {
    playBGM('title');
    return;
  }
  if (screen === 'minigame') {
    playBGM('event');
    return;
  }
  if (screen === 'gameover') {
    playBGM('gameover');
    return;
  }
  // In-game: decide by state
  if (!state) { playBGM('title'); return; }

  // Event/achievement high moment
  if (state.attendingEvent) {
    playBGM('event');
    return;
  }

  // Work stage, debt, or low leisure → tense track
  const stage = state._lifeStage || 'university';
  if (stage === 'work' || state.money < 0 || state.time <= 2) {
    playBGM('work');
    return;
  }

  // University / summer → warm track
  playBGM('university');
}
