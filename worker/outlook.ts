import { RESTAURANT } from '../shared/model';
export interface OutlookEnv {DB:D1Database;MICROSOFT_CLIENT_ID?:string;MICROSOFT_CLIENT_SECRET?:string;MICROSOFT_MAILBOX?:string;EMAIL_TEST_RECIPIENT?:string;PUBLIC_SITE_URL?:string}
const authority='https://login.microsoftonline.com/consumers/oauth2/v2.0';
const scopes='offline_access User.Read Mail.Send';
export class OutlookError extends Error{}
export class OutlookUncertainError extends Error{}
export function outlookConfigured(env:OutlookEnv){return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(env.MICROSOFT_CLIENT_ID||'')&&!!env.MICROSOFT_CLIENT_SECRET&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.MICROSOFT_MAILBOX||'');}
export function outlookRecipientAllowed(env:OutlookEnv,to:string){return to.toLowerCase()===(env.EMAIL_TEST_RECIPIENT||env.MICROSOFT_MAILBOX||'').toLowerCase();}
function base64(bytes:Uint8Array){let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function unbase64(text:string){return Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),char=>char.charCodeAt(0));}
async function key(env:OutlookEnv){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`outlook-secret-v1:${env.MICROSOFT_CLIENT_SECRET}`));return crypto.subtle.importKey('raw',hash,{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function sealOutlook(env:OutlookEnv,text:string,purpose:string){const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(purpose)},await key(env),new TextEncoder().encode(text));return `${base64(iv)}.${base64(new Uint8Array(cipher))}`;}
export async function openOutlook(env:OutlookEnv,text:string,purpose:string){const [iv,cipher]=text.split('.');const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(iv),additionalData:new TextEncoder().encode(purpose)},await key(env),unbase64(cipher));return new TextDecoder().decode(plain);}
function callback(env:OutlookEnv){const url=new URL(env.PUBLIC_SITE_URL||'https://instagram-to-order.m-verdi.workers.dev');if(url.protocol!=='https:'||url.username||url.password)throw new OutlookError('Öffentliche HTTPS-Adresse prüfen.');return `${url.origin}/api/admin/outlook/callback`;}
const cookieName='outlook_connect';
const cookie=(value:string,maxAge:number)=>`${cookieName}=${value}; Path=/api/admin/outlook; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
async function connection(env:OutlookEnv,restaurantId:string){return env.DB.prepare('SELECT account_email,refresh_token FROM outlook_connections WHERE restaurant_id=?').bind(restaurantId).first<{account_email:string;refresh_token:string}>();}
export async function outlookStatus(env:OutlookEnv,restaurantId:string){
 if(restaurantId!==RESTAURANT||!outlookConfigured(env))return {configured:false,connected:false,schemaReady:true};
 try{const row=await connection(env,restaurantId);return {configured:true,connected:!!row&&row.account_email.toLowerCase()===env.MICROSOFT_MAILBOX!.toLowerCase(),schemaReady:true,account:row?.account_email||null};}catch(error){if(/no such table/i.test(String(error)))return {configured:true,connected:false,schemaReady:false};throw error;}
}
export async function startOutlook(env:OutlookEnv,restaurantId:string,adminId:string){
 if(restaurantId!==RESTAURANT||!outlookConfigured(env))throw new OutlookError('Microsoft-App und Postfach sind noch nicht konfiguriert.');
 const status=await outlookStatus(env,restaurantId);if(!status.schemaReady)throw new OutlookError('Die Datenbankmigration für Outlook fehlt noch.');
 const state=base64(crypto.getRandomValues(new Uint8Array(24))),verifier=base64(crypto.getRandomValues(new Uint8Array(32)));
 const payload=await sealOutlook(env,JSON.stringify({state,verifier,restaurantId,adminId,expires:Date.now()+600000}),'oauth-cookie');
 const challenge=base64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 const query=new URLSearchParams({client_id:env.MICROSOFT_CLIENT_ID!,response_type:'code',redirect_uri:callback(env),response_mode:'query',scope:scopes,state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'});
 return new Response(null,{status:302,headers:{Location:`${authority}/authorize?${query}`,'Set-Cookie':cookie(payload,600),'Cache-Control':'no-store'}});
}
export async function completeOutlook(env:OutlookEnv,req:Request,restaurantId:string,adminId:string,fetcher:typeof fetch=fetch){
 if(restaurantId!==RESTAURANT||!outlookConfigured(env))throw new OutlookError('Microsoft-Verbindung nicht konfiguriert.');
 const url=new URL(req.url);const sealed=req.headers.get('Cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 if(!sealed||url.searchParams.has('error'))throw new OutlookError('Microsoft-Anmeldung abgebrochen oder abgelaufen. Bitte erneut verbinden.');
 let data:{state:string;verifier:string;restaurantId:string;adminId:string;expires:number};
 try{data=JSON.parse(await openOutlook(env,sealed,'oauth-cookie'));}catch{throw new OutlookError('Ungültige Anmeldung. Bitte erneut verbinden.');}
 if(data.expires<Date.now()||data.restaurantId!==restaurantId||data.adminId!==adminId||data.state!==url.searchParams.get('state'))throw new OutlookError('Ungültige oder abgelaufene Anmeldung.');
 const code=url.searchParams.get('code');if(!code||code.length>4096)throw new OutlookError('Anmeldecode fehlt.');
 const response=await fetcher(`${authority}/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.MICROSOFT_CLIENT_ID!,client_secret:env.MICROSOFT_CLIENT_SECRET!,grant_type:'authorization_code',code,redirect_uri:callback(env),code_verifier:data.verifier,scope:scopes}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new OutlookError('Microsoft konnte die Anmeldung nicht bestätigen. App-Einstellungen prüfen.');
 const token=await response.json() as {access_token?:string;refresh_token?:string};if(!token.access_token||!token.refresh_token)throw new OutlookError('Microsoft hat keinen dauerhaften Versandzugriff erteilt.');
 const profile=await fetcher('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName',{headers:{Authorization:`Bearer ${token.access_token}`},signal:AbortSignal.timeout(15000)});if(!profile.ok)throw new OutlookError('Microsoft-Postfach konnte nicht bestätigt werden.');
 const user=await profile.json() as {mail?:string;userPrincipalName?:string};const address=(user.mail||user.userPrincipalName||'').toLowerCase();
 if(address!==env.MICROSOFT_MAILBOX!.toLowerCase())throw new OutlookError('Falsches Microsoft-Konto. Bitte das konfigurierte Outlook-Postfach auswählen.');
 const encrypted=await sealOutlook(env,token.refresh_token,`refresh:${restaurantId}`);
 await env.DB.prepare('INSERT INTO outlook_connections(restaurant_id,account_email,refresh_token) VALUES (?,?,?) ON CONFLICT(restaurant_id) DO UPDATE SET account_email=excluded.account_email,refresh_token=excluded.refresh_token,updated_at=CURRENT_TIMESTAMP').bind(restaurantId,address,encrypted).run();
 return new Response(null,{status:303,headers:{Location:'/admin?outlook=connected','Set-Cookie':cookie('',0),'Cache-Control':'no-store'}});
}
export async function disconnectOutlook(env:OutlookEnv,restaurantId:string){await env.DB.prepare('DELETE FROM outlook_connections WHERE restaurant_id=?').bind(restaurantId).run();}
async function accessToken(env:OutlookEnv,restaurantId:string,fetcher:typeof fetch){
 const row=await connection(env,restaurantId);if(!row||row.account_email.toLowerCase()!==env.MICROSOFT_MAILBOX!.toLowerCase())throw new OutlookError('Outlook ist nicht verbunden.');
 let refresh:string;try{refresh=await openOutlook(env,row.refresh_token,`refresh:${restaurantId}`);}catch{throw new OutlookError('Verbindung erneut herstellen; Microsoft-Schlüssel wurde geändert.');}
 const response=await fetcher(`${authority}/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.MICROSOFT_CLIENT_ID!,client_secret:env.MICROSOFT_CLIENT_SECRET!,grant_type:'refresh_token',refresh_token:refresh,scope:scopes}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new OutlookError('Outlook-Zugriff abgelaufen oder widerrufen. Bitte erneut verbinden.');
 const token=await response.json() as {access_token?:string;refresh_token?:string};if(!token.access_token)throw new OutlookError('Microsoft-Zugriff nicht bestätigt.');
 if(token.refresh_token){const encrypted=await sealOutlook(env,token.refresh_token,`refresh:${restaurantId}`);await env.DB.prepare('UPDATE outlook_connections SET refresh_token=?,updated_at=CURRENT_TIMESTAMP WHERE restaurant_id=? AND refresh_token=?').bind(encrypted,restaurantId,row.refresh_token).run();}
 return token.access_token;
}
export async function sendOutlook(env:OutlookEnv,restaurantId:string,to:string,message:{subject:string;text:string;html?:string;attachments?:Array<{filename:string;content:string}>},fetcher:typeof fetch=fetch){
 if(!outlookRecipientAllowed(env,to))throw new OutlookError('Der Outlook-Testversand ist nur an das freigegebene Testpostfach möglich.');
 const access=await accessToken(env,restaurantId,fetcher);
 let response:Response;
 try{response=await fetcher('https://graph.microsoft.com/v1.0/me/sendMail',{method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json'},body:JSON.stringify({message:{subject:`[TEST] ${message.subject}`,body:{contentType:message.html?'HTML':'Text',content:message.html||message.text},toRecipients:[{emailAddress:{address:to}}],...(message.attachments?{attachments:message.attachments.map(file=>({'@odata.type':'#microsoft.graph.fileAttachment',name:file.filename,contentType:'text/csv',contentBytes:file.content}))}:{})},saveToSentItems:true}),signal:AbortSignal.timeout(15000)});}catch{throw new OutlookUncertainError('Microsoft hat den Versand nicht eindeutig bestätigt. Im Ordner Gesendet prüfen.');}
 if(response.status===202)return;
 if(response.status>=500||response.status===408)throw new OutlookUncertainError('Microsoft-Versandstatus unklar. Im Ordner Gesendet prüfen.');
 throw new OutlookError('Microsoft hat die Nachricht nicht angenommen. Kontolimit oder Verbindung prüfen.');
}
