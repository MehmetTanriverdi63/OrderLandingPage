import { useState } from 'react';
import { Mail } from 'lucide-react';
import { emailStateLabel,type EmailKind } from '../../shared/email';
import type { Order } from '../../shared/model';
import { api } from '../lib/api';
export default function EmailStatus({order,enabled}:{order:Order;enabled:boolean}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 if(!order.customer_email)return null;
 async function retry(kind:EmailKind){
  setBusy(true);setMessage('');
  try{const result=await api<{state:string}>(`/admin/orders/${order.id}/email`,{method:'POST',body:JSON.stringify({kind})});
   setMessage(result.state==='accepted'||result.state==='already_sent'?'Vom Versanddienst angenommen.':result.state==='manual_check_required'?'Bitte zuerst im Versanddienst prüfen; ein möglicher Doppelversand wurde verhindert.':result.state==='sending'?'Versand läuft bereits.':result.state==='failed'?'Versand nicht bestätigt. Bitte im Versanddienst prüfen.':'Versand derzeit nicht möglich.');
  }catch(error){setMessage((error as Error).message);}finally{setBusy(false);}
 }
 return <div className="email-status"><a href={`mailto:${order.customer_email}`}><Mail size={14} aria-hidden="true"/>{order.customer_email}</a>{!enabled?<p>Automatischer E-Mail-Versand noch nicht eingerichtet.</p>:<><dl>{(['received','accepted'] as const).map(kind=><div key={kind}><dt>{kind==='received'?'Eingangsbestätigung':'Annahmebestätigung'}</dt><dd>{kind==='accepted'&&order.status==='pending'?'Nach Annahme':emailStateLabel(order.email_notifications?.[kind])}{(order.email_notifications?.[kind]?.state==='failed'||!order.email_notifications?.[kind])&&(kind==='received'||['accepted','ready','completed'].includes(order.status))&&<button type="button" disabled={busy} onClick={()=>void retry(kind)}>Versand erneut versuchen</button>}</dd></div>)}</dl><small>„Angenommen“ bedeutet vom Versanddienst akzeptiert – keine Lese- oder Posteingangsbestätigung.</small></>}{message&&<p role="status">{message}</p>}</div>;
}
