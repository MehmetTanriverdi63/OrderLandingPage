import {describe,it,expect,vi} from 'vitest';
import {berlinDay,reportStart,monthWindow,monthlyCsv,summarizeSales,type SaleRow} from '../shared/statistics';
import {encodeOrderNote,decodeOrderNote} from '../shared/order-details';
import {privacyPreview,applyPrivacy,privacyApplySchema,recordPageView} from '../worker/data-centre';
const base:SaleRow={created_at:'2026-11-08 23:30:00',status:'completed',payment_method:'cash',payment_status:'paid',total:2000,items:JSON.stringify([{name:'Pizza',quantity:2,unitPrice:1000,selections:[]}])};
describe('sales aggregation without customer identity',()=>{
 it('separates completed paid cash from test payments, previews, rejected and unpaid orders',()=>{
  const result=summarizeSales([base,{...base,payment_method:'stripe',total:3000},{...base,payment_method:'online_demo',payment_status:'test_only'},{...base,status:'rejected'},{...base,payment_status:'unpaid'}]);
  expect(result.orders).toBe(5);expect(result.cashTotal).toBe(2000);expect(result.completedCash).toBe(1);expect(result.stripeTestTotal).toBe(3000);expect(result.rejected).toBe(1);expect(result.onlinePreviews).toBe(1);expect(result.products).toEqual([{name:'Pizza',quantity:2,total:2000}]);expect(result.daily[0].day).toBe('2026-11-09');
 });
 it('uses Berlin calendar dates across daylight-saving changes',()=>{expect(berlinDay('2026-07-08T22:30:00Z')).toBe('2026-07-09');expect(reportStart(1,Date.parse('2026-03-29T15:00:00Z'))).toBe('2026-03-28T23:00:00.000Z');expect(reportStart(1,Date.parse('2026-10-25T15:00:00Z'))).toBe('2026-10-24T22:00:00.000Z');});
 it('exports a Berlin calendar month in Excel-friendly CSV without formula execution or customer fields',()=>{
  expect(monthWindow('2026-03')).toEqual({since:'2026-02-28T23:00:00.000Z',until:'2026-03-31T22:00:00.000Z'});
  const stats={...summarizeSales([{...base,items:JSON.stringify([{name:'=HYPERLINK("bad")',quantity:1,unitPrice:2000,selections:[]}])}]),pageViews:[],pageViewsReady:true};
  const csv=monthlyCsv('2026-11',stats);expect(csv.startsWith('\uFEFF')).toBe(true);expect(csv).toContain('20,00');expect(csv).toContain("'=HYPERLINK");expect(csv).toContain('keine eindeutigen Personen');expect(csv).not.toContain('customer_name');
 });

});
function fixture(){
 const address={street:'Teststraße',houseNumber:'10',postalCode:'67549',city:'Worms',instructions:'Klingel Testname'};
 const rows=[{id:'order-1',restaurant_id:'restaurant-a',number:1001,created_at:'2000-01-01 12:00:00',status:'completed',payment_status:'paid',total:2000,items:base.items,note:encodeOrderNote('Private Notiz','delivery',address,'person@example.com'),customer_name:'Privater Name',phone:'015119137118',request_id:'old-request',access_token_hash:'old-hash'},
 {id:'order-2',restaurant_id:'restaurant-b',number:1002,created_at:'2000-01-01 12:00:00',status:'completed',payment_status:'paid',total:4000,items:base.items,note:'Anderer Mandant',customer_name:'Andere Person',phone:'01234567890',request_id:'other-request',access_token_hash:'other-hash'},
 {id:'order-3',restaurant_id:'restaurant-a',number:1003,created_at:'2000-01-01 12:00:00',status:'pending',payment_status:'unpaid',total:2000,items:base.items,note:'Aktiv',customer_name:'Aktive Person',phone:'01234567890',request_id:'active-request',access_token_hash:'active-hash'}];
 const batch=vi.fn(async(statements:{args:unknown[]}[])=>statements.map(({args})=>{const row=rows.find(row=>row.id===args[2]&&row.restaurant_id===args[3]);if(!row||row.note!==args[4])return {meta:{changes:0}};row.note=String(args[0]);row.access_token_hash=String(args[1]);row.customer_name='Kontaktdaten entfernt';row.phone='';return {meta:{changes:1}};}));
 const DB={prepare(sql:string){return {bind(...args:unknown[]){return {sql,args,async all(){expect(sql).toContain('restaurant_id=?');return {results:rows.filter(row=>row.restaurant_id===args[0]&&['completed','rejected'].includes(row.status)&&!(row.status==='rejected'&&row.payment_status==='paid')&&Date.parse(row.created_at+'Z')<Date.parse(String(args[1]))).map(row=>({...row}))};}};}};},batch} as unknown as D1Database;
 return {DB,rows,batch};
}
describe('reviewed contact removal preserves statistics and tenant boundaries',()=>{
 it('previews no personal data, changes nothing until applied, and preserves articles and amounts',async()=>{
  const f=fixture(),before={total:f.rows[0].total,items:f.rows[0].items,created_at:f.rows[0].created_at,number:f.rows[0].number};
  const preview=await privacyPreview(f.DB,'restaurant-a',30);expect(preview.batchSize).toBe(1);expect(JSON.stringify(preview)).not.toContain('Privater Name');expect(JSON.stringify(preview)).not.toContain('person@example.com');expect(f.batch).not.toHaveBeenCalled();
  const result=await applyPrivacy(f.DB,'restaurant-a',{retentionDays:30,previewToken:preview.previewToken,confirmation:'KONTAKTDATEN ENTFERNEN',bookkeepingConfirmed:true});expect(result.updated).toBe(1);
  expect(f.rows[0]).toMatchObject({...before,customer_name:'Kontaktdaten entfernt',phone:''});expect(f.rows[0].access_token_hash).not.toBe('old-hash');expect(f.rows[0].request_id).toBe('old-request');expect(f.rows[0].note).not.toContain('person@example.com');expect(f.rows[0].note).not.toContain('Teststraße');expect(f.rows[0].note).not.toContain('Private Notiz');expect(decodeOrderNote(f.rows[0].note)).toMatchObject({fulfillment_method:'delivery',delivery_address:null,personal_data_removed:true});expect(f.rows[1].customer_name).toBe('Andere Person');expect(f.rows[2].customer_name).toBe('Aktive Person');
  expect((await privacyPreview(f.DB,'restaurant-a',30)).batchSize).toBe(0);
 });
 it('refuses a stale preview and requires exact confirmation and bookkeeping acknowledgement',async()=>{
  const f=fixture(),preview=await privacyPreview(f.DB,'restaurant-a',30);f.rows[0].note='Zwischenzeitlich geändert';const result=await applyPrivacy(f.DB,'restaurant-a',{retentionDays:30,previewToken:preview.previewToken,confirmation:'KONTAKTDATEN ENTFERNEN',bookkeepingConfirmed:true});expect(result.stale).toBe(true);expect(f.batch).not.toHaveBeenCalled();expect(privacyApplySchema.safeParse({retentionDays:30,previewToken:preview.previewToken,confirmation:'ja',bookkeepingConfirmed:false}).success).toBe(false);
 });
 it('stores only aggregate page/date/count fields and no request identifiers',async()=>{
  const run=vi.fn(async()=>({meta:{changes:1}})),bind=vi.fn((..._args:unknown[])=>({run}));const DB={prepare:vi.fn(()=>({bind}))} as unknown as D1Database;expect(await recordPageView(DB,'/angebot')).toBe(true);expect(bind.mock.calls[0]).toHaveLength(3);expect(bind.mock.calls[0][2]).toBe('/angebot');
 });
});
