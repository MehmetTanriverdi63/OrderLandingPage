import { RESTAURANT,money,timeLabel } from '../shared/model';
import { decodeOrderNote,encodeOrderNote } from '../shared/order-details';
import type { EmailKind,EmailNotice,EmailNotices } from '../shared/email';
import { sha256,equal } from './security';
export interface EmailEnv {DB:D1Database;EMAIL_ENABLED?:string;RESEND_API_KEY?:string;EMAIL_FROM?:string;PUBLIC_SITE_URL?:string;EMAIL_DAILY_LIMIT?:string}
export function emailEnabled(env:EmailEnv){return env.EMAIL_ENABLED==='true'&&/^re_[A-Za-z0-9_-]+$/.test(env.RESEND_API_KEY||'')&&!!env.EMAIL_FROM&&/^[^\r\n<>]*<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$/.test(env.EMAIL_FROM);}
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function emailMessage(row:Record<string,unknown>,kind:EmailKind,env:Pick<EmailEnv,'PUBLIC_SITE_URL'>){
 const detail=decodeOrderNote(String(row.note||''));
 const site=new URL(env.PUBLIC_SITE_URL||'https://instagram-to-order.m-verdi.workers.dev');
 if(site.protocol!=='https:'||site.username||site.password)throw new Error('Öffentliche Website-Adresse ungültig.');
 const token=await sha256(`${row.request_id}:${row.id}`);
 if(!equal(await sha256(token),String(row.access_token_hash)))throw new Error('Privater Bestelllink konnte nicht bestätigt werden.');
 const link=`${site.origin}/?order=${encodeURIComponent(String(row.id))}&token=${token}`;
 const delivery=detail.fulfillment_method==='delivery';
 const title=kind==='received'?'Deine Bestellung ist eingegangen':'Deine Bestellung wurde angenommen';
 const explanation=kind==='received'?'Dies ist eine Eingangsbestätigung. Das Restaurant hat deine Bestellung noch nicht angenommen. Den aktuellen Status findest du über deinen privaten Link.':'Das Restaurant hat deine Bestellung angenommen.';
 const when=timeLabel(String(kind==='accepted'?row.confirmed_pickup||row.pickup_at:row.pickup_at));
 const payment=row.payment_method==='online_demo'?'Online-Testvorschau: nicht bezahlt, keine Abbuchung.':row.payment_method==='stripe'?(row.payment_status==='paid'?'Stripe-Testzahlung bestätigt.':'Stripe-Testzahlung noch nicht bestätigt.'):`Barzahlung bei ${delivery?'Lieferung':'Abholung'}.`;
 const text=`Hallo ${String(row.customer_name).slice(0,80)},\n\n${title} – #${row.number}\n${explanation}\n\n${delivery?'Lieferung':'Abholung'} · ${kind==='accepted'?'Bestätigte Zeit':'Wunschzeit (unbestätigt)'}: ${when}\nGesamt: ${money(Number(row.total))}\n${payment}\n\nDein privater Bestellstatus:\n${link}\n\nBitte diesen Link nicht weitergeben. Bei Rückfragen: 06241 2107548.\n\nMediterrane Küche Worms\nTestbetrieb – keine produktive Bestellung. Keine Werbe-E-Mail.`;
 return {subject:`${kind==='received'?'Eingangsbestätigung':'Bestellung angenommen'} #${row.number} · Mediterrane Küche Worms`,text,html:`<!doctype html><html lang="de"><body style="margin:0;background:#f5f4ee;font-family:Arial,sans-serif;color:#233a32"><div style="max-width:560px;margin:32px auto;padding:28px;background:white;border-radius:14px"><p style="font-size:12px;letter-spacing:2px">MEDITERRANE KÜCHE · WORMS</p><h1 style="font-size:26px">${escape(title)}</h1><p>Hallo ${escape(String(row.customer_name).slice(0,80))},</p><p>${escape(explanation)}</p><p><b>Bestellung #${Number(row.number)}</b><br/>${delivery?'Lieferung':'Abholung'} · ${kind==='accepted'?'Bestätigte Zeit':'Wunschzeit (unbestätigt)'}: ${escape(when)}<br/>Gesamt: ${escape(money(Number(row.total)))}</p><p>${escape(payment)}</p><p style="margin:28px 0"><a style="display:inline-block;padding:16px 22px;background:#173e36;color:white;text-decoration:none;border-radius:8px" href="${escape(link)}">Bestellstatus ansehen</a></p><p style="font-size:12px">Dein Bestelllink ist privat. Bei Rückfragen: 06241 2107548.</p><p style="font-size:11px;color:#6f7868">Testbetrieb – keine produktive Bestellung. Diese Nachricht ist eine Bestellinformation, keine Werbung.</p></div></body></html>`};
}
async function updateNotice(env:EmailEnv,row:Record<string,unknown>,kind:EmailKind,notice:EmailNotice){
 const details=decodeOrderNote(String(row.note||''));
 const old=details.email_notifications?.[kind];
 const notes:EmailNotices={...details.email_notifications,[kind]:{...notice,firstAttemptAt:old?.firstAttemptAt||old?.updatedAt||notice.updatedAt}};
 const encoded=encodeOrderNote(details.note,details.fulfillment_method,details.delivery_address,details.customer_email,notes);
 const result=await env.DB.prepare('UPDATE orders SET note=? WHERE id=? AND restaurant_id=? AND note=?').bind(encoded,row.id,row.restaurant_id,row.note).run();
 return result.meta.changes>0;
}
async function load(env:EmailEnv,id:string,restaurantId:string){return env.DB.prepare('SELECT * FROM orders WHERE id=? AND restaurant_id=?').bind(id,restaurantId).first<Record<string,unknown>>();}
async function finish(env:EmailEnv,id:string,restaurantId:string,kind:EmailKind,claimAt:number,notice:EmailNotice){
 for(let attempt=0;attempt<4;attempt++){
  const row=await load(env,id,restaurantId);if(!row)return;
  const current=decodeOrderNote(String(row.note||'')).email_notifications?.[kind];
  if(current?.state!=='sending'||current.updatedAt!==claimAt)return;
  if(await updateNotice(env,row,kind,notice))return;
 }
 throw new Error('Versandstatus konnte nicht gespeichert werden.');
}
export async function sendOrderEmail(env:EmailEnv,id:string,restaurantId:string,kind:EmailKind,fetcher:typeof fetch=fetch){
 if(restaurantId!==RESTAURANT||!emailEnabled(env))return {state:'not_configured'};
 let claimed:Record<string,unknown>|null=null;const claimAt=Date.now();
 for(let attempt=0;attempt<4;attempt++){
  const row=await load(env,id,restaurantId);if(!row)return {state:'not_found'};
  const detail=decodeOrderNote(String(row.note||''));if(!detail.customer_email)return {state:'no_email'};
  if(kind==='accepted'&&!['accepted','ready','completed'].includes(String(row.status)))return {state:'not_accepted'};
  const old=detail.email_notifications?.[kind];
  if(old?.state==='accepted')return {state:'already_sent'};
  if(old?.state==='sending'&&claimAt-old.updatedAt<5*60_000)return {state:'sending'};
  // The provider's idempotency window is finite: never automatically retry an uncertain old send.
  if(old&&claimAt-(old.firstAttemptAt||old.updatedAt)>23*60*60_000)return {state:'manual_check_required'};
  if(await updateNotice(env,row,kind,{state:'sending',updatedAt:claimAt})){claimed=row;break;}
 }
 if(!claimed)return {state:'busy'};
 const detail=decodeOrderNote(String(claimed.note||''));
 try{
  const cap=Math.min(50,Math.max(1,Number(env.EMAIL_DAILY_LIMIT)||50));
  const day=new Date().toISOString().slice(0,10),reset=Date.parse(`${day}T00:00:00Z`)+86400000;
  const quota=await env.DB.prepare('INSERT INTO rate_limits(key,count,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(`email-daily:${day}`,reset).first<{count:number}>();
  if(!quota||quota.count>cap)throw new Error('Tageslimit erreicht.');
  const message=await emailMessage(claimed,kind,env);
  const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`order-${id}-${kind}`},body:JSON.stringify({from:env.EMAIL_FROM,to:[detail.customer_email],...message}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Versanddienst hat die Nachricht nicht angenommen.');
  const result=await response.json() as {id?:string};if(typeof result.id!=='string'||!result.id||result.id.length>100)throw new Error('Versanddienst konnte nicht bestätigt werden.');
  await finish(env,id,restaurantId,kind,claimAt,{state:'accepted',updatedAt:Date.now(),providerId:result.id});
  return {state:'accepted'};
 }catch(error){
  const message=error instanceof Error&&error.message==='Tageslimit erreicht.'?'Tageslimit erreicht.':'Versand nicht bestätigt. Bitte im Versanddienst prüfen.';
  await finish(env,id,restaurantId,kind,claimAt,{state:'failed',updatedAt:Date.now(),error:message});
  return {state:'failed'};
 }
}
