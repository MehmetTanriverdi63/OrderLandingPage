import {expect,it} from 'vitest';
import {telegramOrderMessage} from '../worker/telegram-message';
import type {Order} from '../shared/model';
const order={number:1024,customer_name:'Testgast',phone:'+49 123 456789',pickup_at:'2026-10-31T17:00:00.000Z',payment_method:'cash',total:1190,note:'Ohne Zwiebeln',items:[{name:'Pizza Margherita',quantity:1,unitPrice:1190,selections:['Extra: Feta']}]} as Order;
it('shows the checkout phone with a phone icon, relevant icons, extras and customer note',()=>{
 const text=telegramOrderMessage(order);expect(text).toContain('📞 Telefon: +49 123 456789');expect(text).toContain('🛍️ Neue Bestellung #1024');expect(text).toContain('1× Pizza Margherita');expect(text).toContain('Extra: Feta');expect(text).toContain('📝 Hinweis: Ohne Zwiebeln');expect(text).toContain('Barzahlung bei Abholung');
});
it('keeps long orders within Telegram limits without dropping phone, amount or pickup time',()=>{
 const text=telegramOrderMessage({...order,items:Array.from({length:30},()=>({name:'Langes Gericht '.repeat(10),quantity:20,unitPrice:1000,selections:Array(10).fill('Sehr langes Extra '.repeat(10))})),note:'X'.repeat(500)});expect(text.length).toBeLessThan(4096);expect(text).toContain('Telefon: +49');expect(text).toContain('Abholwunsch');expect(text).toContain('Weitere Bestelldetails');
});
