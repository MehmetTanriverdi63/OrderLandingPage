import { describe, expect, it } from 'vitest';
import { normalizePhone } from '../shared/phone';
import { checkoutSchema } from '../shared/model';
describe('phone autofill and server normalization', () => {
  it.each([
    ['15119137118','015119137118'],
    ['151 19137118','015119137118'],
    ['017612345678','017612345678'],
    ['17612345678','017612345678'],
    ['4915119137118','+4915119137118'],
    ['+49 15119137118','+49 15119137118'],
    ['004915119137118','004915119137118'],
    ['+33 612345678','+33 612345678'],
    ['06241 2107548','06241 2107548'],
    ['12345678','12345678'],
  ])('normalizes %s without corrupting other prefixes', (input,expected) => {
    expect(normalizePhone(input)).toBe(expected);
    expect(checkoutSchema.shape.phone.parse(input)).toBe(expected);
    expect(normalizePhone(expected)).toBe(expected);
  });
});
