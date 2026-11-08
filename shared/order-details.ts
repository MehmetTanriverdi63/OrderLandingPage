import type { EmailNotices } from './email';
import { z } from 'zod';
export const deliveryAddressSchema=z.object({street:z.string().trim().min(2).max(120),houseNumber:z.string().trim().min(1).max(20),postalCode:z.string().regex(/^\d{5}$/,'Bitte eine fünfstellige Postleitzahl angeben.'),city:z.string().trim().min(2).max(80),instructions:z.string().trim().max(200).default('')});
export type DeliveryAddress=z.infer<typeof deliveryAddressSchema>;
export type FulfillmentMethod='pickup'|'delivery';
// A versioned envelope in the existing order note keeps old deployments and databases compatible.
// New orders use this envelope; legacy plain-text notes remain unchanged.
const prefix='[order-details:v1]';
export function encodeOrderNote(note:string,method:FulfillmentMethod,address?:DeliveryAddress|null,email?:string|null,notifications?:EmailNotices){
  return prefix+JSON.stringify({note,fulfillmentMethod:method,deliveryAddress:method==='delivery'?deliveryAddressSchema.parse(address):null,customerEmail:email||null,emailNotifications:notifications||{}});
}
export function decodeOrderNote(stored:string):{note:string;fulfillment_method:FulfillmentMethod;delivery_address:DeliveryAddress|null;customer_email?:string;email_notifications?:EmailNotices}{
  if(stored.startsWith(prefix))try{
    const value=JSON.parse(stored.slice(prefix.length));
    const email=z.string().email().max(254).safeParse(value.customerEmail);
    const notifications=z.partialRecord(z.enum(['received','accepted']),z.object({state:z.enum(['sending','accepted','failed']),updatedAt:z.number(),firstAttemptAt:z.number().optional(),providerId:z.string().max(100).optional(),error:z.string().max(200).optional()})).safeParse(value.emailNotifications);
    const emailData=email.success?{customer_email:email.data,...(notifications.success?{email_notifications:notifications.data}:{})}:{};
    if(value.fulfillmentMethod==='pickup'&&typeof value.note==='string')return {note:value.note,fulfillment_method:'pickup',delivery_address:null,...emailData};
    const address=deliveryAddressSchema.safeParse(value.deliveryAddress);
    if(value.fulfillmentMethod==='delivery'&&typeof value.note==='string'&&address.success)return {note:value.note,fulfillment_method:'delivery',delivery_address:address.data,...emailData};
  }catch{/* Historical free-text notes are preserved. */}
  return {note:stored,fulfillment_method:'pickup',delivery_address:null};
}
export function addressLabel(address:DeliveryAddress){return `${address.street} ${address.houseNumber}, ${address.postalCode} ${address.city}`;}
