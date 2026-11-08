import {sealOutlook} from '../worker/outlook';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {sendOrderEmail,emailMessage,emailEnabled,sendMonthlyReport,type EmailEnv} from '../worker/email';
import {encodeOrderNote,decodeOrderNote} from '../shared/order-details';
import {checkoutSchema,RESTAURANT} from '../shared/model';
import {sha256} from '../worker/security';
async function fixture({email='kunde@example.com',status='pending',cap=50,microsoft=false}={}){
 const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',requestId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';const token=await sha256(`${requestId}:${id}`);
 const row:Record<string,unknown>={id,restaurant_id:RESTAURANT,request_id:requestId,access_token_hash:await sha256(token),number:1234,customer_name:'<Testgast>',phone:'015119137118',note:encodeOrderNote('Notiz','pickup',null,email),pickup_at:'2030-01-01T15:00:00.000Z',confirmed_pickup:'2030-01-01T15:15:00.000Z',status,payment_method:'cash',payment_status:'unpaid',total:990};
 let count=0;let connection:{account_email:string;refresh_token:string}|null=null;
 const DB={prepare(sql:string){return {bind(...args:unknown[]){return {async first(){if(sql.includes('outlook_connections'))return connection;if(sql.includes('rate_limits'))return {count:++count};return args[0]===id&&args[1]===RESTAURANT?{...row}:null;},async run(){if(sql.startsWith('UPDATE orders SET note=')&&args[1]===id&&args[2]===RESTAURANT&&args[3]===row.note){row.note=args[0];return {meta:{changes:1}};}return {meta:{changes:0}};}};}};}} as unknown as D1Database;
 const env:EmailEnv={DB,EMAIL_ENABLED:'true',RESEND_API_KEY:'re_mock_secret',EMAIL_FROM:'Mediterrane Küche Worms <bestellung@example.com>',EMAIL_DAILY_LIMIT:String(cap)};
 if(microsoft){Object.assign(env,{EMAIL_PROVIDER:'microsoft',MICROSOFT_CLIENT_ID:'11111111-1111-4111-8111-111111111111',MICROSOFT_CLIENT_SECRET:'only-a-mock-secret',MICROSOFT_MAILBOX:'tester@outlook.de'});connection={account_email:'tester@outlook.de',refresh_token:await sealOutlook(env,'test-refresh',`refresh:${RESTAURANT}`)};}
 return {row,env,id,token};
}
afterEach(()=>vi.restoreAllMocks());
describe('optional guest email confirmations (mocked external requests only)',()=>{
 it('validates optional email without requiring a customer account',()=>{expect(checkoutSchema.shape.email.parse('')).toBeNull();expect(checkoutSchema.shape.email.parse(undefined)).toBeNull();expect(checkoutSchema.shape.email.parse(' kunde@example.com ')).toBe('kunde@example.com');expect(checkoutSchema.shape.email.safeParse('kein-email').success).toBe(false);});
 it('does not send without a recipient, explicit configuration or the pilot tenant',async()=>{
  const f=await fixture(),fetcher=vi.fn();expect(emailEnabled({...f.env,EMAIL_FROM:'broken'})).toBe(false);
  await sendOrderEmail({...f.env,EMAIL_ENABLED:'false'},f.id,RESTAURANT,'received',fetcher);await sendOrderEmail(f.env,f.id,'other','received',fetcher);
  const noEmail=await fixture({email:''});await sendOrderEmail(noEmail.env,noEmail.id,RESTAURANT,'received',fetcher);expect(fetcher).not.toHaveBeenCalled();
 });
 it('sends a private receipt once and a separate confirmation only after restaurant acceptance',async()=>{
  const f=await fixture(),fetcher=vi.fn(async()=>Response.json({id:'provider-message-1'}));
  expect((await sendOrderEmail(f.env,f.id,RESTAURANT,'received',fetcher)).state).toBe('accepted');
  expect((await sendOrderEmail(f.env,f.id,RESTAURANT,'received',fetcher)).state).toBe('already_sent');
  expect((await sendOrderEmail(f.env,f.id,RESTAURANT,'accepted',fetcher)).state).toBe('not_accepted');
  f.row.status='accepted';expect((await sendOrderEmail(f.env,f.id,RESTAURANT,'accepted',fetcher)).state).toBe('accepted');expect(fetcher).toHaveBeenCalledTimes(2);
  const receipt=JSON.parse(String((fetcher.mock.calls[0] as unknown as [string,RequestInit])[1].body));expect(receipt.to).toEqual(['kunde@example.com']);expect(receipt.text).toContain('noch nicht angenommen');expect(receipt.text).toContain(f.token);expect(receipt.html).toContain('&lt;Testgast&gt;');expect(receipt.html).not.toContain('<Testgast>');
  const accepted=JSON.parse(String((fetcher.mock.calls[1] as unknown as [string,RequestInit])[1].body));expect(accepted.subject).toContain('Bestellung angenommen');expect(accepted.text).toContain('Bestätigte Zeit');
  const data=decodeOrderNote(String(f.row.note));expect(data.email_notifications?.received?.state).toBe('accepted');expect(data.email_notifications?.accepted?.state).toBe('accepted');
 });
 it('deduplicates concurrent sends using a persistent claim',async()=>{const f=await fixture(),fetcher=vi.fn(async()=>Response.json({id:'message'}));await Promise.all([sendOrderEmail(f.env,f.id,RESTAURANT,'received',fetcher),sendOrderEmail(f.env,f.id,RESTAURANT,'received',fetcher)]);expect(fetcher).toHaveBeenCalledOnce();});
 it('records failures without leaking provider errors and retries with the same idempotency key',async()=>{
  const f=await fixture(),fetcher=vi.fn().mockResolvedValueOnce(new Response('private provider diagnostic',{status:503})).mockResolvedValueOnce(Response.json({id:'retry-message'}));
  expect((await sendOrderEmail(f.env,f.id,RESTAURANT,'received',fetcher)).state).toBe('failed');expect(String(f.row.note)).not.toContain('private provider diagnostic');
  expect((await sendOrderEmail(f.env,f.id,RESTAURANT,'received',fetcher)).state).toBe('accepted');expect(fetcher.mock.calls[0][1].headers['Idempotency-Key']).toBe(fetcher.mock.calls[1][1].headers['Idempotency-Key']);
 });
 it('limits total provider requests per day and never treats API acceptance as a read receipt',async()=>{
  const f=await fixture({cap:1,status:'accepted'}),fetcher=vi.fn(async()=>Response.json({id:'message'}));
  await sendOrderEmail(f.env,f.id,RESTAURANT,'received',fetcher);expect((await sendOrderEmail(f.env,f.id,RESTAURANT,'accepted',fetcher)).state).toBe('failed');expect(fetcher).toHaveBeenCalledOnce();expect(decodeOrderNote(String(f.row.note)).email_notifications?.accepted?.error).toBe('Tageslimit erreicht.');
 });
 it('does not retry uncertain old sends outside the provider idempotency window',async()=>{
  const f=await fixture(),old=Date.now()-24*60*60_000;f.row.note=encodeOrderNote('','pickup',null,'kunde@example.com',{received:{state:'failed',updatedAt:Date.now()-1000,firstAttemptAt:old}});const fetcher=vi.fn();expect((await sendOrderEmail(f.env,f.id,RESTAURANT,'received',fetcher)).state).toBe('manual_check_required');expect(fetcher).not.toHaveBeenCalled();
 });
 it('refuses a forged tracking token hash and ignores request-host supplied destinations',async()=>{const f=await fixture();const message=await emailMessage(f.row,'received',{});expect(message.text).toContain('https://instagram-to-order.m-verdi.workers.dev/');await expect(emailMessage(f.row,'received',{PUBLIC_SITE_URL:'http://insecure.example'})).rejects.toThrow();f.row.access_token_hash='forged';await expect(emailMessage(f.row,'received',{})).rejects.toThrow('Bestelllink');});
 it('sends a monthly CSV only after explicit authenticated report action, using the shared quota',async()=>{
  const f=await fixture(),fetcher=vi.fn(async()=>Response.json({id:'report-message'}));
  const result=await sendMonthlyReport(f.env,RESTAURANT,'owner@example.com','2026-11','\uFEFFGericht;Menge\r\nDöner;2',fetcher);expect(result.state).toBe('accepted');
  const payload=JSON.parse(String((fetcher.mock.calls[0] as unknown as [string,RequestInit])[1].body));expect(payload.to).toEqual(['owner@example.com']);expect(payload.attachments[0].filename).toBe('monatsbericht-2026-11.csv');expect(Buffer.from(payload.attachments[0].content,'base64').toString('utf8')).toContain('Döner');
 });

 it('blocks non-test recipients in Outlook and never blindly resends an uncertain Microsoft message',async()=>{
  const blocked=await fixture({microsoft:true}),unused=vi.fn();expect((await sendOrderEmail(blocked.env,blocked.id,RESTAURANT,'received',unused)).state).toBe('test_recipient_only');expect(unused).not.toHaveBeenCalled();
  const f=await fixture({email:'tester@outlook.de',microsoft:true}),fetcher=vi.fn(async(url:string|URL|Request)=>{if(String(url).includes('/token'))return Response.json({access_token:'mock'});throw new Error('timeout after send');});
  expect((await sendOrderEmail(f.env,f.id,RESTAURANT,'received',fetcher as typeof fetch)).state).toBe('unknown');expect(decodeOrderNote(String(f.row.note)).email_notifications?.received?.state).toBe('unknown');expect((await sendOrderEmail(f.env,f.id,RESTAURANT,'received',fetcher as typeof fetch)).state).toBe('manual_check_required');expect(fetcher).toHaveBeenCalledTimes(2);
 });

});
