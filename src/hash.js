/**
 * Shared hash utilities — used by save system and anti-cheat digest chain.
 * cyrb53: fast, non-cryptographic 53-bit hash (good collision resistance for game use).
 */

// --- Keyed hash (cyrb53 variant) ---
export function cyrb53(str, seed = 0) {
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

export function computeChecksum(payload) {
  // Double hash with key sandwiching (poor-man's HMAC)
  const inner = cyrb53(HMAC_KEY + payload, 0x9e3779b9);
  return cyrb53(inner + HMAC_KEY + payload.length, 0x517cc1b7);
}

// Digest chain salt — separate from save salt so compromising one doesn't break the other
const DIGEST_SALT = 'dj_d1g3st_ch41n_#v1';

/**
 * Compute a chained digest: hash(prevDigest + current state snapshot + salt)
 * @param {string} prevDigest - previous month's digest ('' for first month)
 * @param {object} snapshot - key-value object of current state to hash
 * @returns {string} digest string
 */
export function chainDigest(prevDigest, snapshot) {
  const payload = prevDigest + '|' + JSON.stringify(snapshot);
  return cyrb53(DIGEST_SALT + payload, 0x6a09e667);
}
