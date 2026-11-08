import {useEffect,useRef} from 'react';
/** Counts views, not people. No cookies, persistent identifier, referrer or URL query is sent. */
export function usePageView(page:string,hasPrivateOrder:boolean){
 const sent=useRef<string|null>(null);
 useEffect(()=>{
  if(!['/','/angebot'].includes(page)||hasPrivateOrder||sent.current===page||navigator.doNotTrack==='1'||(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl)return;
  sent.current=page;
  void fetch('/api/analytics/pageview',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',body:JSON.stringify({page}),keepalive:true}).catch(()=>{});
 },[page,hasPrivateOrder]);
}
