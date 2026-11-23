import { describe, expect, it } from 'vitest';
import { potenciaDcKwp } from './potencia';

describe('potenciaDcKwp', () => {
  it('74 paneles de 615 W = 45.51 kWp', () => {
    expect(potenciaDcKwp(74, 615)).toBe(45.51);
  });
});
