import {useEffect,useState} from 'react';
import {Mail,RefreshCw} from 'lucide-react';
import {api} from '../lib/api';
type Status={configured:boolean;connected:boolean;schemaReady:boolean;account?:string|null};
export default function OutlookConnection(){
 const [status,setStatus]=useState<Status|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function load(){try{setStatus(await api<Status>('/admin/outlook'));setMessage('');}catch(error){setMessage((error as Error).message);}}
 useEffect(()=>{void load();},[]);
 async function disconnect(){setBusy(true);try{await api('/admin/outlook',{method:'DELETE',body:'{}'});await load();setMessage('Outlook-Verbindung in der Website entfernt. Die App-Freigabe kannst du zusätzlich im Microsoft-Konto widerrufen.');}catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}
 return <section className="outlook-connection" aria-labelledby="outlook-title"><div><h2 id="outlook-title"><Mail size={22}/> Outlook für Test-E-Mails</h2><button className="icon-button" aria-label="Outlook-Verbindung aktualisieren" onClick={()=>void load()}><RefreshCw size={17}/></button></div>
 <p>Versand aus deinem eigenen Microsoft-Postfach, ohne Outlook-Passwort in dieser Website. Testnachrichten gehen nur an das konfigurierte Testpostfach. Nachrichten erscheinen auch im Outlook-Ordner „Gesendet“.</p>
 {status&&!status.configured&&<div className="notice">Zuerst eine Microsoft-Appregistrierung und deren Zugangsdaten in Cloudflare einrichten. Danach kannst du hier dein Konto sicher verbinden. Das Öffnen dieses Bereichs versendet keine E-Mail. <a href="https://github.com/MehmetTanriverdi63/OrderLandingPage/blob/master/docs/OUTLOOK-TEST.md" target="_blank" rel="noopener noreferrer">Einrichtung ansehen</a></div>}
 {status?.configured&&!status.schemaReady&&<div className="notice">Die Datenbankmigration für die verschlüsselte Outlook-Verbindung fehlt noch.</div>}
 {status?.connected&&<p className="outlook-connected">Verbunden: <b>{status.account}</b> · nur Testversand</p>}
 {status?.configured&&status.schemaReady&&<div className="outlook-buttons"><a className="button primary" href="/api/admin/outlook/connect">{status.connected?'Microsoft-Konto erneut verbinden':'Microsoft-Konto verbinden'}</a>{status.connected&&<button className="button secondary" disabled={busy} onClick={()=>void disconnect()}>Verbindung entfernen</button>}</div>}
 <p className="small muted">Microsoft verlangt deine eigene Anmeldung und Freigabe. Die Website erhält Profil- und Versandzugriff sowie eine erneuerbare Freigabe, keinen Zugriff auf das Lesen deines Posteingangs. Für das kostenlose Testen ist kein Resend-Konto nötig.</p>
 {message&&<p role="status">{message}</p>}
 </section>;
}
