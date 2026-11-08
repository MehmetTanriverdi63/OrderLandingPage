import { z } from 'zod';
import { RESTAURANT } from '../shared/model';
import { berlinDay,reportStart,monthWindow,summarizeSales,type SaleRow } from '../shared/statistics';
import { decodeOrderNote,removeContactNote } from '../shared/order-details';
import { sha256 } from './security';
const missingTable=(error:unknown)=>/no such table/i.test(String(error));
export async function recordPageView(DB:D1Database,page:'/'|'/angebot'){
 try{await DB.prepare('INSERT INTO page_view_days(restaurant_id,day,page,views) VALUES (?,?,?,1) ON CONFLICT(restaurant_id,day,page) DO UPDATE SET views=views+1').bind(RESTAURANT,berlinDay(Date.now()),page).run();return true;}catch(error){if(missingTable(error))return false;throw error;}
}
export async function statistics(DB:D1Database,restaurantId:string,days:number,month?:string){
 const range=month?monthWindow(month):{since:reportStart(days),until:null};const since=range.since;const rows=await DB.prepare('SELECT created_at,status,payment_method,payment_status,total,items FROM orders WHERE restaurant_id=? AND datetime(created_at)>=datetime(?) AND (? IS NULL OR datetime(created_at)<datetime(?)) ORDER BY created_at DESC LIMIT 10001').bind(restaurantId,since,range.until,range.until).all<SaleRow>();
 let pageViewsReady=true;let views:Array<{day:string;page:string;views:number}>=[];
 try{views=(await DB.prepare('SELECT day,page,views FROM page_view_days WHERE restaurant_id=? AND day>=? AND (? IS NULL OR day<?) ORDER BY day,page').bind(restaurantId,berlinDay(since),range.until?berlinDay(range.until):null,range.until?berlinDay(range.until):null).all<{day:string;page:string;views:number}>()).results;}catch(error){if(missingTable(error))pageViewsReady=false;else throw error;}
 return {...summarizeSales(rows.results.slice(0,10000)),since,days,month:month||null,limited:rows.results.length>10000,pageViewsReady,pageViews:views,pageViewTotal:views.reduce((sum,row)=>sum+row.views,0)};
}
export async function privacySettings(DB:D1Database,restaurantId:string){
 try{const row=await DB.prepare('SELECT retention_days FROM restaurant_privacy WHERE restaurant_id=?').bind(restaurantId).first<{retention_days:number}>();return {ready:true,retentionDays:row?.retention_days||30,automaticCleanup:false};}catch(error){if(missingTable(error))return {ready:false,retentionDays:30,automaticCleanup:false};throw error;}
}
export async function savePrivacySettings(DB:D1Database,restaurantId:string,days:number){await DB.prepare('INSERT INTO restaurant_privacy(restaurant_id,retention_days) VALUES (?,?) ON CONFLICT(restaurant_id) DO UPDATE SET retention_days=excluded.retention_days,updated_at=CURRENT_TIMESTAMP').bind(restaurantId,days).run();}
type Candidate={id:string;number:number;created_at:string;status:string;payment_status:string;total:number;note:string;customer_name:string;phone:string;request_id:string;access_token_hash:string};
async function candidates(DB:D1Database,restaurantId:string,days:number){
 const cutoff=new Date(Date.now()-days*86400000).toISOString();
 const rows=await DB.prepare("SELECT id,number,created_at,status,payment_status,total,note,customer_name,phone,request_id,access_token_hash FROM orders WHERE restaurant_id=? AND status IN ('completed','rejected') AND NOT (status='rejected' AND payment_status='paid') AND datetime(created_at)<datetime(?) ORDER BY created_at,id").bind(restaurantId,cutoff).all<Candidate>();
 const eligible=rows.results.filter(row=>!decodeOrderNote(row.note).personal_data_removed);return {rows:eligible.slice(0,100),cutoff,total:eligible.length};
}
async function snapshot(rows:Candidate[],restaurantId:string,days:number){return sha256(JSON.stringify([restaurantId,days,rows.map(row=>[row.id,row.note,row.customer_name,row.phone,row.request_id,row.access_token_hash,row.status])]));}
export async function privacyPreview(DB:D1Database,restaurantId:string,days:number){
 const result=await candidates(DB,restaurantId,days);return {retentionDays:days,cutoff:result.cutoff,totalEligible:result.total,batchSize:result.rows.length,previewToken:await snapshot(result.rows,restaurantId,days),orders:result.rows.map(({id,number,created_at,status,total})=>({id,number,created_at,status,total}))};
}
export const privacyApplySchema=z.object({retentionDays:z.number().int().min(1).max(3650),previewToken:z.string().regex(/^[a-f0-9]{64}$/),confirmation:z.literal('KONTAKTDATEN ENTFERNEN'),bookkeepingConfirmed:z.literal(true)});
export async function applyPrivacy(DB:D1Database,restaurantId:string,input:z.infer<typeof privacyApplySchema>){
 const current=await candidates(DB,restaurantId,input.retentionDays);
 if(await snapshot(current.rows,restaurantId,input.retentionDays)!==input.previewToken)return {stale:true,updated:0,skipped:current.rows.length};
 if(!current.rows.length)return {stale:false,updated:0,skipped:0};
 const statements=await Promise.all(current.rows.map(async row=>{
  const replacement=crypto.randomUUID();
  return DB.prepare("UPDATE orders SET customer_name='Kontaktdaten entfernt',phone='',note=?,access_token_hash=? WHERE id=? AND restaurant_id=? AND note=? AND customer_name=? AND phone=? AND access_token_hash=? AND request_id=? AND status=?").bind(removeContactNote(row.note),await sha256(replacement),row.id,restaurantId,row.note,row.customer_name,row.phone,row.access_token_hash,row.request_id,row.status);
 }));
 const results=await DB.batch(statements);const updated=results.reduce((sum,result)=>sum+Number(result.meta.changes||0),0);
 return {stale:false,updated,skipped:current.rows.length-updated};
}
