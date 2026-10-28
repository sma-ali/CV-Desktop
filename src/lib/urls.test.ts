import { describe, expect, it } from 'vitest';
import { displayUrl } from './urls';

describe('displayUrl', () => {
  it.each([
    ['https://www.linkedin.com/in/smaali', 'linkedin.com/in/smaali'],
    ['https://github.com/sma-ali', 'github.com/sma-ali'],
    ['https://alismaani.fr', 'alismaani.fr'],
    ['https://alismaani.fr/', 'alismaani.fr'],
    ['https://github.com/sma-ali/Netherbrain/', 'github.com/sma-ali/Netherbrain'],
  ])('%s se lit « %s »', (url, expected) => {
    expect(displayUrl(url)).toBe(expected);
  });
});
