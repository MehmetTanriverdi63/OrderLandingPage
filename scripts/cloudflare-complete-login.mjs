import { pathToFileURL } from 'node:url';
import { readPassword } from './read-password.mjs';
export function localCallback(value) {
  let url;try{url=new URL(value.trim());}catch{throw new Error('Bitte die vollständige localhost-Adresse aus der Browser-Adressleiste verwenden.');}
  if(url.protocol!=='http:' || !['localhost','127.0.0.1'].includes(url.hostname) || url.port!=='8976' || url.pathname!=='/oauth/callback' || url.username || url.password)throw new Error('Erwartet wird ausschließlich http://localhost:8976/oauth/callback mit den Anmeldeparametern.');
  if(!url.searchParams.get('code') || !url.searchParams.get('state'))throw new Error('Die Adresse enthält keinen vollständigen Anmeldecode. Bitte zuerst Cloudflare-Zugriff im Browser erlauben.');
  url.hostname='127.0.0.1';url.hash='';return url;
}
export async function completeLogin() {
  const url=localCallback(await readPassword('Vollständige localhost-Rückleitungsadresse einfügen (unsichtbar): '));
  let response;
  try{response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000)});}
  catch{throw new Error('Der Anmeldeprozess auf Port 8976 ist nicht erreichbar. Wrangler login muss noch im ersten Terminal laufen; bei Zeitüberschreitung neu starten.');}
  if(response.status<200 || response.status>=400)throw new Error(`Rückleitung nicht angenommen (HTTP ${response.status}). Bitte die Meldung im Wrangler-login-Terminal prüfen und gegebenenfalls neu anmelden.`);
  console.log('Rückleitung an den lokalen Codespace-Anmeldeprozess übergeben. Im ersten Terminal auf die erfolgreiche Anmeldung warten.');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)completeLogin().catch(error=>{console.error(error.message);process.exitCode=1;});
