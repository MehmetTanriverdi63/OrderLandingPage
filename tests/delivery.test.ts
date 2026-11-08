import {describe,it,expect,vi,afterEach} from 'vitest';
import {deliverySlots,distanceKm,DELIVERY_ORIGIN} from '../shared/delivery';
import {checkDeliveryAddress} from '../worker/delivery';
const address={street:'Teststraße',houseNumber:'10',postalCode:'67549',city:'Worms',instructions:''};
const hours=Array.from({length:7},(_,day)=>({day,open:'11:00',close:'22:00',closed:false}));
afterEach(()=>vi.unstubAllGlobals());
describe('delivery geography and Berlin delivery hours',()=>{
 it('limits winter and summer slots to 16:00 through 21:30 Berlin, preserving closed days and lead time',()=>{
  const winter=deliverySlots(hours,Date.parse('2026-11-08T10:00:00Z')).filter(s=>s.startsWith('2026-11-08'));expect(winter[0]).toBe('2026-11-08T15:00:00.000Z');expect(winter.at(-1)).toBe('2026-11-08T20:30:00.000Z');
  const summer=deliverySlots(hours,Date.parse('2026-07-08T10:00:00Z')).filter(s=>s.startsWith('2026-07-08'));expect(summer[0]).toBe('2026-07-08T14:00:00.000Z');expect(summer.at(-1)).toBe('2026-07-08T19:30:00.000Z');
  expect(deliverySlots(hours,Date.parse('2026-11-08T20:15:00Z')).filter(s=>s.startsWith('2026-11-08'))).toEqual([]);
  expect(deliverySlots(hours.map(h=>({...h,closed:true})),Date.parse('2026-11-08T10:00:00Z'))).toEqual([]);
 });
 it('measures from the restaurant rather than from a town or postcode centre',()=>{expect(distanceKm(DELIVERY_ORIGIN,DELIVERY_ORIGIN)).toBe(0);expect(distanceKm(DELIVERY_ORIGIN,{lat:49.8,lon:8.35})).toBeGreaterThan(12);});
 it('resolves the full address and rejects a point just outside 12km without rounding it into the delivery area',async()=>{
  const fetcher=vi.fn(async(_url:string|URL|Request)=>Response.json([{lat:String(DELIVERY_ORIGIN.lat+12.004/6371*180/Math.PI),lon:String(DELIVERY_ORIGIN.lon),address:{road:'Teststraße',house_number:'10',postcode:'67549',country_code:'de'}}]));
  const before=vi.fn(async()=>{});
  const result=await checkDeliveryAddress(address,before,'https://example.com',fetcher as typeof fetch);
  expect(result.allowed).toBe(false);expect(before).toHaveBeenCalledOnce();
  const url=new URL(String(fetcher.mock.calls[0][0]));expect(url.searchParams.get('street')).toBe('10 Teststraße');expect(url.searchParams.get('limit')).toBe('1');
 });
 it('requires exact house number and postcode instead of accepting a broad approximate address',async()=>{
  await expect(checkDeliveryAddress(address,async()=>{},'https://example.com',async()=>Response.json([{lat:'49.63',lon:'8.35',address:{road:'Teststraße',house_number:'99',postcode:'67549',country_code:'de'}}]))).rejects.toThrow('genaue Lieferadresse');
 });
 it('fails closed when the free geocoder is unavailable',async()=>{await expect(checkDeliveryAddress(address,async()=>{},'https://example.com',async()=>new Response('',{status:503}))).rejects.toThrow('nicht verfügbar');});
 it('caches only coordinates under a hashed key and avoids repeated provider calls',async()=>{
  let cached:Response|undefined;const put=vi.fn(async(_key:Request,value:Response)=>{cached=value.clone();});
  vi.stubGlobal('caches',{default:{match:async()=>cached?.clone(),put}});
  const before=vi.fn(async()=>{}),fetcher=vi.fn(async()=>Response.json([{lat:String(DELIVERY_ORIGIN.lat),lon:String(DELIVERY_ORIGIN.lon),address:{road:'Teststraße',house_number:'10',postcode:'67549',country_code:'de'}}]));
  expect((await checkDeliveryAddress(address,before,'https://example.com',fetcher as typeof fetch)).allowed).toBe(true);
  expect((await checkDeliveryAddress(address,before,'https://example.com',fetcher as typeof fetch)).allowed).toBe(true);
  expect(fetcher).toHaveBeenCalledOnce();expect(before).toHaveBeenCalledOnce();expect(put.mock.calls[0][0].url).not.toContain('Test');
  expect(put.mock.calls[0][1].headers.get('Cache-Control')).toBe('max-age=900');expect(await cached!.json()).toEqual({lat:String(DELIVERY_ORIGIN.lat),lon:String(DELIVERY_ORIGIN.lon)});
 });

});
