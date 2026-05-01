import { randomCode } from '@/auth/randomCode';

describe('randomCode', () => {
  it('returns string formatted XXXX-XXXX with Crockford-friendly base32 (no I, L, O, 0, 1)', () => {
    for (let i = 0; i < 50; i++) {
      const c = randomCode();
      expect(c).toMatch(/^[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/);
    }
  });

  it('produces unique codes across 10k samples', () => {
    const set = new Set<string>();
    for (let i = 0; i < 10_000; i++) set.add(randomCode());
    expect(set.size).toBe(10_000);
  });
});
