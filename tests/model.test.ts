import { describe, expect, it } from 'vitest';
import { calculateItem, checkoutSchema, hoursSchema, pickupSlots, type Product, type Hours } from '../shared/model';
const p: Product = { id: 'deal', restaurant_id: 'a', name: 'Menü', description: '', category: '', price: 990, image: '', badge: null, available: 1, options: [{ id: 'sauce', name: 'Soße', required: true, choices: [{ id: 'garlic', name: 'Knoblauch', price: 0 }] }, { id: 'extra', name: 'Extra', required: false, choices: [{ id: 'feta', name: 'Feta', price: 150 }] }] };
const hours: Hours = Array.from({ length: 7 }, (_, day) => ({ day, open: '11:00', close: '22:00', closed: false }));
describe('server-authoritative prices', () => {
  it('calculates required choices and paid extras in cents', () => { expect(calculateItem(p, { productId: 'deal', quantity: 2, selections: { sauce: 'garlic', extra: 'feta' } })).toEqual({ unitPrice: 1140, selections: ['Soße: Knoblauch', 'Extra: Feta'] }); });
  it('rejects missing required choice', () => expect(() => calculateItem(p, { productId: 'deal', quantity: 1, selections: {} })).toThrow('Soße'));
  it('rejects invented extras and unknown groups', () => { expect(() => calculateItem(p, { productId: 'deal', quantity: 1, selections: { sauce: 'free' } })).toThrow(); expect(() => calculateItem(p, { productId: 'deal', quantity: 1, selections: { sauce: 'garlic', discount: 'free' } })).toThrow(); });
});
describe('pickup availability', () => {
  it('uses Berlin time, 30 minute lead time, and 15 minute increments', () => { const now = Date.parse('2026-10-27T10:07:00Z'); const slots = pickupSlots(hours, now); expect(slots[0]).toBe('2026-10-27T10:45:00.000Z'); expect(slots.every(s => Date.parse(s) >= now + 1800000)).toBe(true); expect(slots.every(s => new Date(s).getUTCMinutes() % 15 === 0)).toBe(true); });
  it('excludes closed days and closing time', () => { expect(pickupSlots(hours.map(h => ({ ...h, closed: true })))).toEqual([]); const slots = pickupSlots(hours, Date.parse('2026-10-27T20:15:00Z')); expect(slots[0]).toBe('2026-10-27T20:45:00.000Z'); expect(slots).not.toContain('2026-10-27T21:00:00.000Z'); });
  it('handles daylight saving transition', () => { const h = hours.map(h => ({ ...h, open: '01:00', close: '04:00' })); const slots = pickupSlots(h, Date.parse('2026-10-25T00:00:00Z')); expect(new Set(slots).size).toBe(slots.length); expect(slots).toContain('2026-10-25T01:30:00.000Z'); });
  it('rejects duplicate days and overnight hours', () => { expect(hoursSchema.safeParse(hours).success).toBe(true); expect(hoursSchema.safeParse(hours.map(h => ({ ...h, day: 1 }))).success).toBe(false); expect(hoursSchema.safeParse(hours.map(h => ({ ...h, open: '22:00', close: '02:00' }))).success).toBe(false); });
});
describe('checkout input', () => {
  const valid = { restaurantId: 'a', quotedTotal: 990, customerName: 'Demo Gast', phone: '0123456789', pickupAt: '2026-10-27T15:00:00.000Z', paymentMethod: 'cash', items: [{ productId: 'deal', quantity: 1, selections: { sauce: 'garlic' } }], consent: true, requestId: 'c67ff3f4-cc2f-4359-926b-88d0f69d051a' };
  it('requires consent, positive integral quantities, and phone', () => { expect(checkoutSchema.safeParse(valid).success).toBe(true); expect(checkoutSchema.safeParse({ ...valid, consent: false }).success).toBe(false); expect(checkoutSchema.safeParse({ ...valid, phone: 'n/a' }).success).toBe(false); expect(checkoutSchema.safeParse({ ...valid, items: [{ ...valid.items[0], quantity: -1 }] }).success).toBe(false); });
});
