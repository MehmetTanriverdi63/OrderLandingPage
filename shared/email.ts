export type EmailKind='received'|'accepted';
export type EmailState='sending'|'accepted'|'failed'|'unknown';
export type EmailNotice={state:EmailState;updatedAt:number;firstAttemptAt?:number;providerId?:string;error?:string};
export type EmailNotices=Partial<Record<EmailKind,EmailNotice>>;
export const emailStateLabel=(notice:EmailNotice|undefined)=>!notice?'Noch nicht versendet':notice.state==='sending'?'Wird versendet':notice.state==='accepted'?'Vom Versanddienst angenommen':notice.state==='unknown'?'Versandstatus unklar – im Postfach prüfen':'Versand fehlgeschlagen';
