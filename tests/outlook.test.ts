import {afterEach,describe,it,expect,vi} from 'vitest';
import {RESTAURANT} from '../shared/model';
import {startOutlook,completeOutlook,sealOutlook,openOutlook,sendOutlook,outlookStatus,OutlookUncertainError,type OutlookEnv} from '../worker/outlook';
function fixture(){
 let row:{account_email:string;refresh_token:string}|null=null;
 const writes:unknown[][]=[];
 const DB={prepare(sql:string){return {bind(...args:unknown[]){return {async first(){return args[0]===RESTAURANT?row:null;},async run(){writes.push(args);if(sql.startsWith('INSERT'))row={account_email:String(args[1]),refresh_token:String(args[2])};if(sql.startsWith('UPDATE')&&row&&row.refresh_token===args[2])row.refresh_token=String(args[0]);return {meta:{changes:1}};}};}};}} as unknown as D1Database;
 const env:OutlookEnv={DB,MICROSOFT_CLIENT_ID:'11111111-1111-4111-8111-111111111111',MICROSOFT_CLIENT_SECRET:'only-a-mock-client-secret',MICROSOFT_MAILBOX:'tester@outlook.de'};
 return {env,writes,row:()=>row};
}
async function connect(f:ReturnType<typeof fixture>,profile='tester@outlook.de'){
 const start=await startOutlook(f.env,RESTAURANT,'admin-1');const location=new URL(start.headers.get('Location')!);const cookie=start.headers.get('Set-Cookie')!.split(';')[0];
 const fetcher=vi.fn(async(url:string|URL|Request)=>String(url).includes('/token')?Response.json({access_token:'access-only-mock',refresh_token:'refresh-only-mock'}):Response.json({mail:profile}));
 const req=new Request(`https://instagram-to-order.m-verdi.workers.dev/api/admin/outlook/callback?state=${location.searchParams.get('state')}&code=test-code`,{headers:{Cookie:cookie}});
 return {response:await completeOutlook(f.env,req,RESTAURANT,'admin-1',fetcher as typeof fetch),fetcher};
}
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});
describe('Microsoft OAuth and test-only Graph transport (mocked, no real accounts)',()=>{
 it('starts delegated consumer login with PKCE and an encrypted HttpOnly cookie, without Mail.Read',async()=>{
  const f=fixture(),response=await startOutlook(f.env,RESTAURANT,'admin-1'),url=new URL(response.headers.get('Location')!);
  expect(url.hostname).toBe('login.microsoftonline.com');expect(url.pathname).toContain('/consumers/');expect(url.searchParams.get('scope')).toContain('Mail.Send');expect(url.searchParams.get('scope')).not.toContain('Mail.Read');expect(url.searchParams.get('code_challenge_method')).toBe('S256');expect(response.headers.get('Set-Cookie')).toContain('HttpOnly; Secure; SameSite=Lax');expect(response.headers.get('Set-Cookie')).not.toContain('admin-1');expect(url.toString()).not.toContain(f.env.MICROSOFT_CLIENT_SECRET!);
 });
 it('protects secrets against tampering and use in another purpose or restaurant',async()=>{
  const f=fixture(),sealed=await sealOutlook(f.env,'private-refresh','refresh:'+RESTAURANT);expect(sealed).not.toContain('private-refresh');expect(await openOutlook(f.env,sealed,'refresh:'+RESTAURANT)).toBe('private-refresh');await expect(openOutlook(f.env,sealed,'oauth-cookie')).rejects.toThrow();await expect(openOutlook(f.env,sealed,'refresh:other')).rejects.toThrow();
 });
 it('checks callback state, admin identity and expiry before any Microsoft token request',async()=>{
  const f=fixture(),start=await startOutlook(f.env,RESTAURANT,'admin-1'),cookie=start.headers.get('Set-Cookie')!.split(';')[0],fetcher=vi.fn();
  const req=new Request('https://example.com/api/admin/outlook/callback?state=forged&code=x',{headers:{Cookie:cookie}});await expect(completeOutlook(f.env,req,RESTAURANT,'other-admin',fetcher)).rejects.toThrow('Ungültige');expect(fetcher).not.toHaveBeenCalled();
 });
 it('verifies the exact account and encrypts its refresh token without sending email',async()=>{
  const f=fixture(),{response,fetcher}=await connect(f);expect(response.status).toBe(303);expect(response.headers.get('Location')).toBe('/admin?outlook=connected');expect(f.row()?.account_email).toBe('tester@outlook.de');expect(f.row()?.refresh_token).not.toContain('refresh-only-mock');expect((await outlookStatus(f.env,RESTAURANT)).connected).toBe(true);expect(fetcher).toHaveBeenCalledTimes(2);
  const other=fixture();await expect(connect(other,'wrong@outlook.de')).rejects.toThrow('Falsches');expect(other.writes).toHaveLength(0);
 });
 it('rotates encrypted refresh tokens and sends only to the permitted test mailbox',async()=>{
  const f=fixture();await connect(f);const before=f.row()!.refresh_token;
  const fetcher=vi.fn(async(url:string|URL|Request)=>String(url).includes('/token')?Response.json({access_token:'refreshed-access',refresh_token:'rotated-refresh'}):new Response(null,{status:202}));
  await sendOutlook(f.env,RESTAURANT,'tester@outlook.de',{subject:'Testbestellung',text:'Test'},fetcher as typeof fetch);expect(fetcher).toHaveBeenCalledTimes(2);expect(f.row()!.refresh_token).not.toBe(before);expect(f.row()!.refresh_token).not.toContain('rotated-refresh');
  const payload=JSON.parse(String((fetcher.mock.calls[1] as unknown as [string,RequestInit])[1].body));expect(payload.saveToSentItems).toBe(true);expect(payload.message.toRecipients[0].emailAddress.address).toBe('tester@outlook.de');expect(payload.message.subject).toContain('[TEST]');expect(payload.message).not.toHaveProperty('from');
  const blocked=vi.fn();await expect(sendOutlook(f.env,RESTAURANT,'stranger@example.com',{subject:'No',text:'No'},blocked)).rejects.toThrow('Testpostfach');expect(blocked).not.toHaveBeenCalled();
 });
 it('marks an ambiguous send failure so the application will not blindly resend',async()=>{
  const f=fixture();await connect(f);const fetcher=vi.fn(async(url:string|URL|Request)=>{if(String(url).includes('/token'))return Response.json({access_token:'mock'});throw new Error('connection lost');});
  await expect(sendOutlook(f.env,RESTAURANT,'tester@outlook.de',{subject:'Test',text:'Test'},fetcher as typeof fetch)).rejects.toBeInstanceOf(OutlookUncertainError);
 });
 it('rejects an expired connection cookie before exchanging any authorization code',async()=>{
  const f=fixture(),response=await startOutlook(f.env,RESTAURANT,'admin-1'),location=new URL(response.headers.get('Location')!),cookie=response.headers.get('Set-Cookie')!.split(';')[0];
  vi.useFakeTimers();vi.setSystemTime(Date.now()+11*60000);const fetcher=vi.fn();
  const req=new Request(`https://example.com/api/admin/outlook/callback?state=${location.searchParams.get('state')}&code=old-code`,{headers:{Cookie:cookie}});
  await expect(completeOutlook(f.env,req,RESTAURANT,'admin-1',fetcher)).rejects.toThrow('abgelaufene');expect(fetcher).not.toHaveBeenCalled();
 });

});
