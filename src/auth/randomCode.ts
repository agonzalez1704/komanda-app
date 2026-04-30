// Crockford-style base32 minus easily-confused chars (I, L, O, 0, 1).
// 31 chars × 8 picks = ~40 bits — plenty of entropy for invite codes at our
// scale (thousands per org, not billions).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function pick8(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < 8; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function randomCode(): string {
  const raw = pick8();
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}
