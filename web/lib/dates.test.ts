import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { addDays, daysBetween, formatDay, mondayOf, todayPrague } from './dates';

// Run every assertion with the process in a time zone far from Prague (UTC+14, no DST), so a helper that
// silently used the local zone instead of Europe/Prague or UTC would fail here.
const originalTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Pacific/Kiritimati';
});
afterAll(() => {
  process.env.TZ = originalTz;
});

describe('time zone guard', () => {
  it('really runs far from Prague', () => {
    expect(new Date('2026-01-01T00:00:00Z').getTimezoneOffset()).toBe(-14 * 60);
  });
});

describe('todayPrague', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const at = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
    return todayPrague();
  };

  it('uses CET (UTC+1) in winter: 23:30 UTC is already the next day', () => {
    expect(at('2026-11-01T22:59:59Z')).toBe('2026-11-01');
    expect(at('2026-11-01T23:00:00Z')).toBe('2026-11-02');
    expect(at('2026-11-01T23:30:00Z')).toBe('2026-11-02');
  });

  it('uses CEST (UTC+2) in summer: midnight Prague is 22:00 UTC', () => {
    expect(at('2026-07-31T21:59:59Z')).toBe('2026-07-31');
    expect(at('2026-07-31T22:00:00Z')).toBe('2026-08-01');
  });

  it('follows the spring DST switch (29/3/2026, clocks 02:00 -> 03:00)', () => {
    // Midnight of the switch day is still CET.
    expect(at('2026-03-28T22:59:59Z')).toBe('2026-03-28');
    expect(at('2026-03-28T23:00:00Z')).toBe('2026-03-29');
    // After the switch, midnight is 22:00 UTC.
    expect(at('2026-03-29T21:59:59Z')).toBe('2026-03-29');
    expect(at('2026-03-29T22:00:00Z')).toBe('2026-03-30');
  });

  it('follows the autumn DST switch (25/10/2026, clocks 03:00 -> 02:00)', () => {
    // Midnight of the switch day is still CEST.
    expect(at('2026-10-24T21:59:59Z')).toBe('2026-10-24');
    expect(at('2026-10-24T22:00:00Z')).toBe('2026-10-25');
    // The repeated hour stays on the same day; the next midnight is 23:00 UTC.
    expect(at('2026-10-25T01:30:00Z')).toBe('2026-10-25');
    expect(at('2026-10-25T22:59:59Z')).toBe('2026-10-25');
    expect(at('2026-10-25T23:00:00Z')).toBe('2026-10-26');
  });

  it('rolls over the year in Prague before it does in UTC', () => {
    expect(at('2026-12-31T23:00:00Z')).toBe('2027-01-01');
  });
});

describe('addDays', () => {
  it('crosses month, year and leap-day boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('is not shifted by the DST switch days (date-only arithmetic)', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-10-26', -1)).toBe('2026-10-25');
  });

  it('keeps the day for n = 0 and accepts a datetime string (date part only)', () => {
    expect(addDays('2026-11-02', 0)).toBe('2026-11-02');
    expect(addDays('2026-11-02T23:30:00+01:00', 7)).toBe('2026-11-09');
  });
});

describe('mondayOf', () => {
  it('returns the day itself for a Monday', () => {
    expect(mondayOf('2026-11-02')).toBe('2026-11-02');
  });

  it('treats Sunday as the last day of the ISO week, not the first', () => {
    expect(mondayOf('2026-11-08')).toBe('2026-11-02');
    expect(mondayOf('2026-11-09')).toBe('2026-11-09');
  });

  it('rolls back across month and year boundaries', () => {
    expect(mondayOf('2027-01-01')).toBe('2026-12-28');
    expect(mondayOf('2028-03-01')).toBe('2028-02-28');
  });

  it('is stable on the DST switch Sundays', () => {
    expect(mondayOf('2026-03-29')).toBe('2026-03-23');
    expect(mondayOf('2026-10-25')).toBe('2026-10-19');
  });

  it('gives the same Monday for every day of a week', () => {
    for (let i = 0; i < 7; i++) expect(mondayOf(addDays('2026-10-19', i))).toBe('2026-10-19');
  });
});

describe('daysBetween', () => {
  it('counts whole days, negative when going back', () => {
    expect(daysBetween('2026-11-02', '2026-11-09')).toBe(7);
    expect(daysBetween('2026-11-09', '2026-11-02')).toBe(-7);
    expect(daysBetween('2026-11-02', '2026-11-02')).toBe(0);
  });

  it('counts 23- and 25-hour Prague days as one day each', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('counts leap years', () => {
    expect(daysBetween('2028-01-01', '2029-01-01')).toBe(366);
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
  });
});

describe('formatDay', () => {
  it('formats d/m/yyyy without leading zeros', () => {
    expect(formatDay('2026-11-02')).toBe('2/11/2026');
    expect(formatDay('2027-01-09')).toBe('9/1/2027');
  });

  it('uses the date part of a datetime without converting the time zone', () => {
    expect(formatDay('2026-11-02T23:30:00-05:00')).toBe('2/11/2026');
  });

  it('returns an empty string for missing values and the input for garbage', () => {
    expect(formatDay(null)).toBe('');
    expect(formatDay(undefined)).toBe('');
    expect(formatDay('')).toBe('');
    expect(formatDay('soon')).toBe('soon');
  });
});
