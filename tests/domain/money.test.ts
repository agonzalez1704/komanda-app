import { formatMXN } from '@/domain/money';

describe('formatMXN', () => {
  it('formats integer cents as Mexican pesos', () => {
    expect(formatMXN(2500)).toBe('$25.00');
    expect(formatMXN(0)).toBe('$0.00');
    expect(formatMXN(12345)).toBe('$123.45');
  });
  it('handles negative values with a leading minus', () => {
    expect(formatMXN(-500)).toBe('-$5.00');
  });
});
