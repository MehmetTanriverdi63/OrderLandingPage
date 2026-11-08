import type { DeliveryAddress } from '../shared/order-details';
import { DELIVERY_ORIGIN,DELIVERY_RADIUS_KM,distanceKm } from '../shared/delivery';
import { sha256 } from './security';
export class DeliveryCheckError extends Error {constructor(public status:number,message:string){super(message);}}
type Match={lat:string;lon:string;address?:{house_number?:string;road?:string;pedestrian?:string;postcode?:string;country_code?:string}};
const normalized=(text:string)=>text.toLocaleLowerCase('de').replace(/straße|strasse/g,'str').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
export async function checkDeliveryAddress(address:DeliveryAddress,beforeNetwork:()=>Promise<void>,origin:string,fetcher:typeof fetch=fetch,endpoint='https://nominatim.openstreetmap.org/search'){
  // Exact-address requests only; no autocomplete. Cache keys are hashes, not addresses.
  const key=await sha256(JSON.stringify([normalized(address.street),normalized(address.houseNumber),address.postalCode,normalized(address.city)]));
  const cache=typeof caches!=='undefined'?(caches as CacheStorage & {default:Cache}).default:undefined;
  const cacheRequest=new Request(`${origin}/__internal/delivery-address/${key}`);
  const cached=cache?await cache.match(cacheRequest).catch(()=>undefined):undefined;
  let match:Match|undefined;
  if(cached)match=await cached.json() as Match;
  else{
    await beforeNetwork();
    const service=new URL(endpoint);if(service.protocol!=='https:'||service.username||service.password)throw new DeliveryCheckError(503,'Die Adressprüfung ist nicht korrekt eingerichtet.');
    const query=new URLSearchParams({street:`${address.houseNumber} ${address.street}`,city:address.city,postalcode:address.postalCode,countrycodes:'de',format:'jsonv2',addressdetails:'1',limit:'1'});
    let response:Response;
    try{response=await fetcher(`${service.origin}${service.pathname}?${query}`,{headers:{'User-Agent':'MediterraneOrderPilot/0.1 (https://github.com/MehmetTanriverdi63/OrderLandingPage)','Accept-Language':'de'},signal:AbortSignal.timeout(12000)});}catch{throw new DeliveryCheckError(503,'Die Adressprüfung ist gerade nicht erreichbar. Bitte später erneut versuchen oder Abholung wählen.');}
    if(!response.ok)throw new DeliveryCheckError(503,'Die Adressprüfung ist gerade nicht verfügbar. Bitte später erneut versuchen.');
    const results=await response.json().catch(()=>null) as Match[]|null;
    match=Array.isArray(results)?results[0]:undefined;
    const found=match?.address;
    if(!found||found.country_code!=='de'||found.postcode!==address.postalCode||normalized(found.house_number||'')!==normalized(address.houseNumber)||normalized(found.road||found.pedestrian||'')!==normalized(address.street))throw new DeliveryCheckError(422,'Diese genaue Lieferadresse wurde nicht gefunden. Bitte Straße, Hausnummer, Postleitzahl und Ort prüfen.');
    const lat=Number(match!.lat),lon=Number(match!.lon);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<47||lat>56||lon<5||lon>16)throw new DeliveryCheckError(422,'Die Lieferadresse konnte nicht eindeutig geprüft werden.');
    if(cache)await cache.put(cacheRequest,Response.json({lat:match!.lat,lon:match!.lon},{headers:{'Cache-Control':'max-age=900'}})).catch(()=>{});
  }
  const km=distanceKm(DELIVERY_ORIGIN,{lat:Number(match!.lat),lon:Number(match!.lon)});
  return {allowed:km<=DELIVERY_RADIUS_KM,distanceKm:Math.round(km*100)/100,radiusKm:DELIVERY_RADIUS_KM};
}
