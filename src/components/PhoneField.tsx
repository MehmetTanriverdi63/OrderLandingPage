import { useRef, useState } from 'react';
import { Check, Contact, Phone, X } from 'lucide-react';
import { readStorage, writeStorage } from '../lib/api';
export const PHONE_STORAGE_KEY='mediterrane-saved-phone';
const validPhone=(phone:string)=>/^\+?[0-9 ()/\-]{7,25}$/.test(phone) && phone.replace(/\D/g,'').length>=7 && phone.replace(/\D/g,'').length<=15;
type ContactsNavigator=Navigator & {contacts?:{select:(fields:string[],options:{multiple:boolean})=>Promise<Array<{tel?:string[]}>>}};
export function rememberPhoneAfterOrder(phone:string,remember:boolean){writeStorage(PHONE_STORAGE_KEY,remember&&validPhone(phone)?phone:'');}
export default function PhoneField({disabled=false}:{disabled?:boolean}) {
  const input=useRef<HTMLInputElement>(null);
  const saved=readStorage<unknown>(PHONE_STORAGE_KEY,'');
  const initial=typeof saved==='string'&&validPhone(saved)?saved:'';
  const [phone,setPhone]=useState(''),[candidate,setCandidate]=useState(initial),[source,setSource]=useState<'saved'|'contact'>('saved'),[remember,setRemember]=useState(Boolean(initial)),[message,setMessage]=useState('');
  const contacts=(navigator as ContactsNavigator).contacts;
  const supported=Boolean(window.isSecureContext && window.top===window.self && contacts?.select);
  async function chooseContact(){
    setMessage('');
    try{
      const selected=await contacts!.select(['tel'],{multiple:false});
      const number=selected[0]?.tel?.map(t=>t.trim()).find(validPhone);
      if(number){setCandidate(number);setSource('contact');}
      else if(selected.length)setMessage('Keine passende Telefonnummer gefunden. Bitte deine eigene Nummer eingeben.');
    }catch(error){if((error as Error).name!=='AbortError')setMessage('Kontaktauswahl hier nicht verfügbar. Bitte deine Nummer eintippen oder die Ausfüllhilfe deines Browsers nutzen.');}
  }
  return <div className="phone-field"><label htmlFor="customer-phone">Telefonnummer <span className="required-label">Pflichtfeld</span></label><div className="phone-input"><Phone size={16}/><input ref={input} id="customer-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required pattern={String.raw`\+?[0-9 \(\)\/\-]{7,25}`} maxLength={25} disabled={disabled} value={phone} onChange={e=>{setPhone(e.target.value);e.target.setCustomValidity('');}} onBlur={e=>{if(e.target.value)e.target.setCustomValidity(validPhone(e.target.value)?'':'Bitte eine Telefonnummer mit 7 bis 15 Ziffern eingeben.');}} placeholder="Deine Nummer für Rückfragen"/></div><p className="phone-help">Damit wir dich bei Rückfragen zu deiner Bestellung erreichen können. Deine Nummer wird mit der Bestellung an das Restaurant übermittelt.</p>
    {candidate&&<div className="phone-suggestion"><b>{source==='saved'?'Gespeicherte Nummer übernehmen?':'Ist das deine eigene Telefonnummer?'}</b><span>{candidate}</span><p>Die Nummer wird erst nach deiner Bestätigung eingetragen.</p><div><button type="button" disabled={disabled} onClick={()=>{setPhone(candidate);input.current?.setCustomValidity('');setCandidate('');setMessage('Nummer übernommen. Du kannst sie jederzeit ändern.');}}><Check size={14}/>Übernehmen</button><button type="button" disabled={disabled} onClick={()=>{setCandidate('');setRemember(false);setMessage('Bitte deine eigene Telefonnummer eingeben.');}}><X size={14}/>Nicht übernehmen</button></div></div>}
    {supported&&<button type="button" className="contact-pick" disabled={disabled} onClick={()=>void chooseContact()}><Contact size={15}/>Eigene Nummer aus Kontakt auswählen</button>}
    {supported&&<p className="phone-help">Wähle deinen eigenen Kontakt. Du entscheidest, welche Nummer du teilst.</p>}
    <label className="checkbox-label remember-phone"><input type="checkbox" name="rememberPhone" checked={remember} disabled={disabled} onChange={e=>setRemember(e.target.checked)}/><span>Nummer auf diesem Gerät für die nächste Bestellung merken (freiwillig).</span></label>
    {initial&&<button type="button" className="forget-phone" onClick={()=>{writeStorage(PHONE_STORAGE_KEY,'');setCandidate('');setRemember(false);setMessage('Gespeicherte Telefonnummer gelöscht.');}}>Gespeicherte Nummer löschen</button>}
    {message&&<p role="status" className="phone-help">{message}</p>}
  </div>;
}
