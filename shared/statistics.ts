import type { OrderItem } from './model';
export function berlinDay(iso:string|number){const date=typeof iso==='number'?new Date(iso):new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso)?iso:iso.replace(' ','T')+'Z');return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function reportStart(days:number,now=Date.now()){
 const day=berlinDay(now);const start=new Date(day+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-days+1);
 const date=start.toISOString().slice(0,10);const midnight=Date.parse(date+'T00:00:00Z');
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',hour:'2-digit',hourCycle:'h23'}).format(new Date(midnight)));
 return new Date(midnight-hour*3600000).toISOString();
}
export type SaleRow={created_at:string;status:string;payment_method:string;payment_status:string;total:number;items:string};
export function summarizeSales(rows:SaleRow[]){
 const daily=new Map<string,{day:string;orders:number;completedCash:number;cashTotal:number;stripeTestTotal:number}>();
 const products=new Map<string,{name:string;quantity:number;total:number}>();
 let cashTotal=0,stripeTestTotal=0,completedCash=0,rejected=0,onlinePreviews=0;
 for(const row of rows){
  const day=berlinDay(row.created_at);const bucket=daily.get(day)||{day,orders:0,completedCash:0,cashTotal:0,stripeTestTotal:0};bucket.orders++;
  if(row.status==='rejected')rejected++;
  if(row.payment_method==='online_demo')onlinePreviews++;
  if(row.status==='completed'&&row.payment_status==='paid'){
   if(row.payment_method==='cash'){
    cashTotal+=row.total;completedCash++;bucket.cashTotal+=row.total;bucket.completedCash++;
    let items:OrderItem[]=[];try{const parsed=JSON.parse(row.items);if(Array.isArray(parsed))items=parsed;}catch{/* Total remains visible even if a legacy item snapshot is invalid. */}
    for(const item of items){if(typeof item.name!=='string'||!Number.isInteger(item.quantity)||item.quantity<1||!Number.isInteger(item.unitPrice)||item.unitPrice<0)continue;const product=products.get(item.name)||{name:item.name,quantity:0,total:0};product.quantity+=item.quantity;product.total+=item.quantity*item.unitPrice;products.set(item.name,product);}
   }else if(row.payment_method==='stripe'){stripeTestTotal+=row.total;bucket.stripeTestTotal+=row.total;}
  }
  daily.set(day,bucket);
 }
 return {orders:rows.length,cashTotal,completedCash,stripeTestTotal,rejected,onlinePreviews,daily:[...daily.values()].sort((a,b)=>a.day.localeCompare(b.day)),products:[...products.values()].sort((a,b)=>b.quantity-a.quantity||a.name.localeCompare(b.name))};
}
export function monthWindow(month:string){
 const [year,index]=month.split('-').map(Number);
 return {since:reportStart(1,Date.UTC(year,index-1,1,12)),until:reportStart(1,Date.UTC(year,index,1,12))};
}
export function monthlyCsv(month:string,stats:ReturnType<typeof summarizeSales>&{pageViews:{day:string;page:string;views:number}[];pageViewsReady:boolean}){
 const cell=(value:string|number)=>{let text=String(value);if(/^[\s]*[=+@\-]/.test(text)||/^[\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
 const euros=(cents:number)=>(cents/100).toFixed(2).replace('.',',');
 const lines:Array<Array<string|number>>=[['Monatsbericht',month,'Testbetrieb – kein Buchhaltungsnachweis'],['Zeitzone','Europe/Berlin'],['Kennzahl','Wert'],['Bestellungen insgesamt',stats.orders],['Abgeschlossene Barbestellungen',stats.completedCash],['Bar kassiert EUR',euros(stats.cashTotal)],['Stripe-Testbetrag EUR (separat)',euros(stats.stripeTestTotal)],['Online-Vorschauen',stats.onlinePreviews],['Abgelehnt/storniert',stats.rejected],[],['Verkaufte Gerichte – abgeschlossene bezahlte Barbestellungen'],['Gericht','Menge','Betrag EUR'],...stats.products.map(p=>[p.name,p.quantity,euros(p.total)]),[],['Tagesübersicht nach Bestelleingang'],['Bestelldatum','Bestellungen','Abgeschlossene Barbestellungen','Bar kassiert EUR','Stripe-Testbetrag EUR'],...stats.daily.map(row=>[row.day,row.orders,row.completedCash,euros(row.cashTotal),euros(row.stripeTestTotal)]),[],['Seitenaufrufe (keine eindeutigen Personen)'],['Datum','Seite','Aufrufe'],...stats.pageViews.map(row=>[row.day,row.page,row.views]),['Hinweis',stats.pageViewsReady?'Seitenaufrufe ohne Besucherkennung; Neuladen zählt erneut.':'Seitenaufrufe noch nicht verfügbar; Datenbankmigration fehlt.']];
 return '\uFEFF'+lines.map(row=>row.map(cell).join(';')).join('\r\n')+'\r\n';
}
