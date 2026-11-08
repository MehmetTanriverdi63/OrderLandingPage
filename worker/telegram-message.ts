import { addressLabel } from '../shared/order-details';
import { money, timeLabel, type Order } from '../shared/model';
const line = (text: string, limit = 150) => text.replace(/[\r\n\t]+/g, ' ').trim().slice(0, limit);
export function telegramOrderMessage(order: Order): string {
  const header = [
    `🛍️ Neue Bestellung #${order.number}`,
    `👤 Kunde: ${line(order.customer_name, 80)}`,
    `📞 Telefon: ${line(order.phone, 30) || 'Nicht angegeben'}`,
    `🚚 Bestellart: ${order.fulfillment_method==='delivery'?'Lieferung':'Abholung'}`,
    ...(order.fulfillment_method==='delivery'&&order.delivery_address?[`📍 Lieferadresse: ${addressLabel(order.delivery_address)}`, ...(order.delivery_address.instructions?[`🚪 Zustellhinweis: ${line(order.delivery_address.instructions,200)}`]:[])]:[]),
    `⏰ ${order.fulfillment_method==='delivery'?'Lieferwunsch':'Abholwunsch'}: ${timeLabel(order.pickup_at)}`,
    `💶 Gesamt: ${money(order.total)}`,
    `💳 Zahlung: ${order.payment_method === 'cash' ? (order.fulfillment_method==='delivery'?'Barzahlung bei Lieferung':'Barzahlung bei Abholung') : order.payment_method==='online_demo'?'Online-Testvorschau – NICHT bezahlt, keine Abbuchung':'Stripe-Testzahlung'}`,
    '', '🍽️ Gerichte:'
  ].join('\n');
  let details = '';
  for (const item of order.items) {
    const itemText = `${item.quantity}× ${line(item.name,100)}${item.selections.length ? `\n   ↳ ${item.selections.map(s=>line(s,90)).join(' · ')}` : ''}\n`;
    if (details.length + itemText.length > 2450) { details += '… Weitere Bestelldetails im Dashboard.\n'; break; }
    details += itemText;
  }
  const note = order.note ? `\n📝 Hinweis: ${line(order.note, 350)}\n` : '';
  return `${header}\n${details}${note}\n📋 Bitte im Dashboard annehmen oder ablehnen.`;
}
