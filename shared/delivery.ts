import type { Hours } from './model';
import { pickupSlots } from './model';
export const DELIVERY_RADIUS_KM=12;
// Friedrich-Ebert-Straße 50, 67549 Worms. OSM building way/297347515, checked 08.11.2026.
export const DELIVERY_ORIGIN={lat:49.6340817,lon:8.3498238};
export function distanceKm(a:{lat:number;lon:number},b:{lat:number;lon:number}){
  const rad=(n:number)=>n*Math.PI/180;
  const h=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lon-a.lon)/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function deliverySlots(hours:Hours,now=Date.now()){
  return pickupSlots(hours,now).filter(slot=>{
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(slot));
    const minutes=Number(parts.find(p=>p.type==='hour')?.value)*60+Number(parts.find(p=>p.type==='minute')?.value);
    return minutes>=16*60&&minutes<=21*60+30;
  });
}
