import { z } from 'zod';
export const deliveryAddressSchema=z.object({street:z.string().trim().min(2).max(120),houseNumber:z.string().trim().min(1).max(20),postalCode:z.string().regex(/^\d{5}$/,'Bitte eine fünfstellige Postleitzahl angeben.'),city:z.string().trim().min(2).max(80),instructions:z.string().trim().max(200).default('')});
export type DeliveryAddress=z.infer<typeof deliveryAddressSchema>;
export type FulfillmentMethod='pickup'|'delivery';
// A versioned envelope in the existing order note keeps old deployments and databases compatible.
// New orders use this envelope; legacy plain-text notes remain unchanged.
const prefix='[order-details:v1]';
export function encodeOrderNote(note:string,method:FulfillmentMethod,address?:DeliveryAddress|null){
  return prefix+JSON.stringify({note,fulfillmentMethod:method,deliveryAddress:method==='delivery'?deliveryAddressSchema.parse(address):null});
}
export function decodeOrderNote(stored:string):{note:string;fulfillment_method:FulfillmentMethod;delivery_address:DeliveryAddress|null}{
  if(stored.startsWith(prefix))try{
    const value=JSON.parse(stored.slice(prefix.length));
    if(value.fulfillmentMethod==='pickup'&&typeof value.note==='string')return {note:value.note,fulfillment_method:'pickup',delivery_address:null};
    const address=deliveryAddressSchema.safeParse(value.deliveryAddress);
    if(value.fulfillmentMethod==='delivery'&&typeof value.note==='string'&&address.success)return {note:value.note,fulfillment_method:'delivery',delivery_address:address.data};
  }catch{/* Historical free-text notes are preserved. */}
  return {note:stored,fulfillment_method:'pickup',delivery_address:null};
}
export function addressLabel(address:DeliveryAddress){return `${address.street} ${address.houseNumber}, ${address.postalCode} ${address.city}`;}
