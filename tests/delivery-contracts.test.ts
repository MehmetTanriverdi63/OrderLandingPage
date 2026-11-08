import {describe,it,expect,vi,afterEach} from 'vitest';
import worker,{type Env} from '../worker/index';
import {DELIVERY_ORIGIN} from '../shared/delivery';
const hours=Array.from({length:7},(_,day)=>({day,open:'11:00',close:'22:00',closed:false}));
const address={street:'Teststraße',houseNumber:'10',postalCode:'67549',city:'Worms',instructions:'2. Stock'};
function fixture(){
 let stored:Record<string,unknown>|null=null;
 const DB={prepare(sql:string){return {bind(...b:unknown[]){return {
 async first(){
  if(sql.includes('rate_limits'))return {count:1};
  if(sql.includes('SELECT id,name,address,phone,hours'))return {id:'mediterrane-worms',hours:JSON.stringify(hours)};
  if(sql.includes('INSERT INTO orders')){stored={id:b[0],restaurant_id:b[1],access_token_hash:b[2],request_id:b[3],customer_name:b[4],phone:b[5],note:b[6],pickup_at:b[7],payment_method:b[8],payment_status:b[9],total:b[10],items:b[11],number:1001,status:'pending',confirmed_pickup:null};return stored;}
  if(sql.includes('access_token_hash=?'))return stored?.access_token_hash===b[1]?stored:null;
  if(sql.includes('SELECT * FROM orders'))return stored;
  return null;
 },async all(){return {results:[{id:'deal',restaurant_id:'mediterrane-worms',name:'Menü',price:990,options:'[]',image:'',category:'Menü'}]};}
 };}};} } as unknown as D1Database;
 return {env:{DB} as Env,stored:()=>stored};
}
function request(changes:Record<string,unknown>={}){
 return new Request('https://example.com/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({restaurantId:'mediterrane-worms',customerName:'Testgast',phone:'015119137118',note:'Ohne Zwiebeln',quotedTotal:990,pickupAt:'2026-11-08T15:00:00.000Z',fulfillmentMethod:'delivery',deliveryAddress:address,paymentMethod:'online_demo',consent:true,requestId:'c67ff3f4-cc2f-4359-926b-88d0f69d051a',items:[{productId:'deal',quantity:1,selections:{}}],...changes})});
}
function geocoder(lat=DELIVERY_ORIGIN.lat){return vi.fn(async()=>Response.json([{lat:String(lat),lon:String(DELIVERY_ORIGIN.lon),address:{road:'Teststraße',house_number:'10',postcode:'67549',country_code:'de'}}]));}
const ctx={waitUntil:vi.fn()} as unknown as ExecutionContext;
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe('server delivery and unpaid online preview contracts',()=>{
 it('stores delivery and returns its address privately while never pretending a demo payment was paid',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-08T10:00:00Z'));vi.stubGlobal('caches',undefined);const external=geocoder();vi.stubGlobal('fetch',external);
  const f=fixture(),response=await worker.fetch(request(),f.env,ctx);expect(response.status).toBe(201);
  expect(f.stored()?.payment_method).toBe('online_demo');expect(f.stored()?.payment_status).toBe('test_only');
  const receipt=await response.json() as {id:string;token:string;paymentUrl?:string};expect(receipt.paymentUrl).toBeUndefined();
  const tracked=await worker.fetch(new Request(`https://example.com/api/orders/${receipt.id}`,{headers:{Authorization:`Bearer ${receipt.token}`}}),f.env,ctx);
  const data=await tracked.json() as Record<string,unknown>;expect(data.delivery_address).toEqual(address);expect(data.fulfillment_method).toBe('delivery');expect(data.payment_status).toBe('test_only');
  expect(external).toHaveBeenCalledOnce();expect(String(external.mock.calls[0])).not.toContain('stripe');
 });
 it('rejects outside addresses even when the client submits forged inside coordinates',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-08T10:00:00Z'));vi.stubGlobal('caches',undefined);vi.stubGlobal('fetch',geocoder(49.9));const f=fixture();
  const response=await worker.fetch(request({deliveryAddress:{...address,lat:DELIVERY_ORIGIN.lat,lon:DELIVERY_ORIGIN.lon}}),f.env,ctx);
  expect(response.status).toBe(400);expect(await response.text()).toContain('12 km');expect(f.stored()).toBeNull();
 });
 it('rejects delivery before 16:00 and after 21:30 without calling a provider',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-08T10:00:00Z'));const external=vi.fn();vi.stubGlobal('fetch',external);
  for(const time of ['2026-11-08T14:45:00.000Z','2026-11-08T20:45:00.000Z']){const f=fixture();const response=await worker.fetch(request({pickupAt:time}),f.env,ctx);expect(response.status).toBe(400);expect(await response.text()).toContain('16:00 und 21:30');expect(f.stored()).toBeNull();}
  expect(external).not.toHaveBeenCalled();
 });
});
