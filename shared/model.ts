import { z } from 'zod';
export const RESTAURANT = 'mediterrane-worms';
export const INSTAGRAM_URL = 'https://www.instagram.com/mediterranekucheworms/';
export type Choice = { id: string; name: string; price: number };
export type OptionGroup = { id: string; name: string; required: boolean; choices: Choice[] };
export type Product = { menu_number?: string | null; id: string; restaurant_id: string; name: string; description: string; category: string; price: number; image: string; badge: string | null; available: number; options: OptionGroup[] };
export type CartItem = { productId: string; quantity: number; selections: Record<string, string>; product?: Product };
export type Hours = { day: number; open: string; close: string; closed: boolean }[];
export type OrderItem = { name: string; quantity: number; unitPrice: number; selections: string[] };
export type Order = { id: string; restaurant_id: string; number: number; customer_name: string; phone: string; note: string; pickup_at: string; confirmed_pickup: string | null; status: string; payment_method: string; payment_status: string; total: number; items: OrderItem[]; created_at: string };
export const money = (cents: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export const timeLabel = (iso: string) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(new Date(iso));
export const cartItemSchema = z.object({ productId: z.string().min(1).max(100), quantity: z.number().int().min(1).max(20), selections: z.record(z.string().max(80), z.string().max(80)) });
export const checkoutSchema = z.object({ restaurantId: z.string().min(1).max(80), customerName: z.string().trim().min(2).max(80), phone: z.string().trim().regex(/^\+?[0-9 ()/\-]{7,25}$/, 'Bitte eine gültige Telefonnummer eingeben.'), note: z.string().trim().max(500).default(''), quotedTotal: z.number().int().min(0).max(100000), pickupAt: z.string().datetime(), paymentMethod: z.enum(['cash', 'stripe']), items: z.array(cartItemSchema).min(1).max(30), consent: z.literal(true), requestId: z.string().uuid() });
export const hoursSchema = z.array(z.object({ day: z.number().int().min(0).max(6), open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), closed: z.boolean() })).length(7).refine(h => new Set(h.map(d => d.day)).size === 7 && h.every(d => d.closed || d.open < d.close), 'Jeden Wochentag einmal angeben; Schließzeit muss nach Öffnung liegen.');
export function calculateItem(product: Product, item: CartItem): { unitPrice: number; selections: string[] } {
  let unitPrice = product.price;
  const selections: string[] = [];
  for (const id of Object.keys(item.selections)) if (!product.options.some(g => g.id === id)) throw new Error('Unbekannte Produktoption.');
  for (const group of product.options) {
    const selected = item.selections[group.id];
    if (!selected && group.required) throw new Error(`Bitte ${group.name} auswählen.`);
    if (!selected) continue;
    const choice = group.choices.find(c => c.id === selected);
    if (!choice) throw new Error('Ungültige Produktoption.');
    unitPrice += choice.price;
    selections.push(`${group.name}: ${choice.name}`);
  }
  return { unitPrice, selections };
}
export function pickupSlots(hours: Hours, now = Date.now()): string[] {
  const slots: string[] = [];
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const start = Math.ceil((now + 30 * 60_000) / 900_000) * 900_000;
  for (let t = start; t < now + 72 * 3600_000; t += 900_000) {
    const p = Object.fromEntries(fmt.formatToParts(t).map(p => [p.type, p.value]));
    const h = hours.find(h => h.day === days.indexOf(p.weekday));
    const time = `${p.hour}:${p.minute}`;
    if (h && !h.closed && time >= h.open && time < h.close) slots.push(new Date(t).toISOString());
  }
  return slots;
}
