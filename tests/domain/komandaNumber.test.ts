import { displayIdentifier, formatYyyyMmDd } from '@/domain/komandaNumber';

describe('formatYyyyMmDd', () => {
  it('returns YYYYMMDD from a Date in local time', () => {
    expect(formatYyyyMmDd(new Date(2026, 3, 18))).toBe('20260418'); // April = 3
    expect(formatYyyyMmDd(new Date(2026, 11, 1))).toBe('20261201');
  });
});

describe('displayIdentifier', () => {
  it('returns the server number when present', () => {
    expect(
      displayIdentifier({ number: 'komanda-20260418-007', display_name: null, opened_at: '2026-04-18T14:32:00Z' })
    ).toBe('komanda-20260418-007');
  });
  it('falls back to "Ticket — <date time>" when number is null', () => {
    expect(
      displayIdentifier({ number: null, display_name: null, opened_at: '2026-04-18T14:32:00Z' })
    ).toMatch(/^Ticket — 2026-04-18/);
  });
  it('prefixes display_name when both are missing the number', () => {
    expect(
      displayIdentifier({ number: null, display_name: 'Table 5', opened_at: '2026-04-18T14:32:00Z' })
    ).toMatch(/Table 5/);
  });
});
