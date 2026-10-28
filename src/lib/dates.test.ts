import { describe, expect, it } from 'vitest';
import {
  formatMonthPeriod,
  formatYearMonth,
  formatYearPeriod,
  periodText,
  RANGE_SEPARATOR,
} from './dates';

describe('formatYearMonth', () => {
  it.each([
    ['2024-01', 'janv. 2024', 'Jan 2024'],
    ['2026-06', 'juin 2026', 'Jun 2026'],
    ['2020-09', 'sept. 2020', 'Sep 2020'],
    ['2023-08', 'août 2023', 'Aug 2023'],
    ['2025-12', 'déc. 2025', 'Dec 2025'],
  ])('%s donne « %s » en FR et « %s » en EN', (value, fr, en) => {
    expect(formatYearMonth(value, 'fr')).toEqual({ dateTime: value, label: fr });
    expect(formatYearMonth(value, 'en')).toEqual({ dateTime: value, label: en });
  });

  it('refuse une valeur mal formée', () => {
    expect(() => formatYearMonth('2024-13', 'fr')).toThrow();
    expect(() => formatYearMonth('janvier', 'fr')).toThrow();
  });
});

describe('périodes', () => {
  it("met « - » entre le début et la fin d'une expérience", () => {
    const period = { start: '2024-01', end: '2026-06' };
    expect(periodText(formatMonthPeriod(period, 'fr'))).toBe('janv. 2024 - juin 2026');
    expect(periodText(formatMonthPeriod(period, 'en'))).toBe('Jan 2024 - Jun 2026');
    expect(formatMonthPeriod(period, 'fr').map((bound) => bound.dateTime)).toEqual([
      '2024-01',
      '2026-06',
    ]);
  });

  it('donne deux années pour une formation sur plusieurs années', () => {
    expect(formatYearPeriod(2021, 2023)).toEqual([
      { dateTime: '2021', label: '2021' },
      { dateTime: '2023', label: '2023' },
    ]);
    expect(periodText(formatYearPeriod(2021, 2023))).toBe('2021 - 2023');
  });

  it('donne une seule année pour une formation sur une année', () => {
    expect(formatYearPeriod(2017, 2017)).toEqual([{ dateTime: '2017', label: '2017' }]);
  });

  it("n'utilise jamais de tiret cadratin ni de demi-cadratin", () => {
    const texts = [
      RANGE_SEPARATOR,
      periodText(formatMonthPeriod({ start: '2020-09', end: '2023-08' }, 'fr')),
      periodText(formatMonthPeriod({ start: '2020-09', end: '2023-08' }, 'en')),
      periodText(formatYearPeriod(2019, 2020)),
    ];
    for (const text of texts) expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});
