import {describe,it,expect} from 'vitest';
import {deliveryAddressSchema,encodeOrderNote,decodeOrderNote} from '../shared/order-details';
import {checkoutSchema} from '../shared/model';
import {telegramOrderMessage} from '../worker/telegram-message';
import type {Order} from '../shared/model';
const address={street:'Teststraße',houseNumber:'12a',postalCode:'67549',city:'Worms',instructions:'2. Stock'};
describe('delivery persistence and validation',()=>{
 it('round trips delivery without leaking metadata into customer notes',()=>{expect(decodeOrderNote(encodeOrderNote('Ohne Zwiebeln','delivery',address))).toEqual({note:'Ohne Zwiebeln',fulfillment_method:'delivery',delivery_address:address});});
 it('retains historical pickup orders and protects notes resembling metadata',()=>{expect(decodeOrderNote('Alte Notiz')).toEqual({note:'Alte Notiz',fulfillment_method:'pickup',delivery_address:null});const text=encodeOrderNote('Text','delivery',address);expect(decodeOrderNote(encodeOrderNote(text,'pickup')).note).toBe(text);expect(decodeOrderNote(encodeOrderNote(text,'pickup')).fulfillment_method).toBe('pickup');});
 it('rejects incomplete addresses and invalid postal codes',()=>{expect(deliveryAddressSchema.safeParse({...address,postalCode:'123'}).success).toBe(false);expect(()=>encodeOrderNote('','delivery',null)).toThrow();const valid={restaurantId:'a',quotedTotal:990,customerName:'Testgast',phone:'015119137118',pickupAt:'2030-01-01T15:00:00.000Z',paymentMethod:'online_demo',items:[{productId:'deal',quantity:1,selections:{}}],consent:true,requestId:'c67ff3f4-cc2f-4359-926b-88d0f69d051a',fulfillmentMethod:'delivery'};expect(checkoutSchema.safeParse(valid).success).toBe(false);expect(checkoutSchema.safeParse({...valid,deliveryAddress:address}).success).toBe(true);});
 it('includes delivery address and clearly unpaid demo status in Telegram',()=>{const text=telegramOrderMessage({number:1234,customer_name:'Testgast',phone:'015119137118',pickup_at:'2030-01-01T15:00:00.000Z',payment_method:'online_demo',total:990,note:'',items:[],fulfillment_method:'delivery',delivery_address:address} as unknown as Order);expect(text).toContain('Lieferadresse: Teststraße 12a, 67549 Worms');expect(text).toContain('Lieferwunsch');expect(text).toContain('NICHT bezahlt');expect(text).toContain('Zustellhinweis: 2. Stock');});
});
