import { useState } from 'react';
import { ArrowUpRight, Instagram, ShieldCheck } from 'lucide-react';
import { INSTAGRAM_URL } from '../../shared/model';

export default function InstagramSection() {
  const [loaded,setLoaded]=useState(false);
  return <section className="container instagram-section" id="instagram" aria-labelledby="instagram-heading">
    <div className="instagram-copy"><div className="eyebrow"><Instagram size={16}/> DIREKT AUS UNSERER KÜCHE</div>
      <h2 id="instagram-heading">Frisch auf dem Teller.<br/><em>Frisch auf Instagram.</em></h2>
      <p>Ein Blick hinter die Kulissen, unsere Lieblingsgerichte und Neuigkeiten aus Worms. Entdecke, was bei uns gerade auf den Tisch kommt.</p>
      <a className="button primary" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"><Instagram size={18}/> @mediterranekucheworms <ArrowUpRight size={17}/></a>
      <p className="instagram-caption">Beiträge, Reels und Kommentare findest du direkt bei Instagram.</p>
    </div>
    <div className="instagram-panel">
      {loaded ? <><iframe title="Instagram-Profil Mediterrane Küche Worms" src={`${INSTAGRAM_URL}embed/`} loading="lazy" referrerPolicy="no-referrer" allow="encrypted-media; picture-in-picture"/><div className="instagram-embed-actions"><a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">Vorschau fehlt? Auf Instagram öffnen <ArrowUpRight size={14}/></a><button type="button" onClick={()=>setLoaded(false)}>Vorschau schließen</button></div></> : <div className="instagram-consent"><span className="instagram-mark"><Instagram size={38}/></span><h3>Ein kleiner Einblick.<br/>Ganz viel Geschmack.</h3><p>Hier kannst du unser Instagram-Profil laden. Dabei werden deine IP-Adresse und Browserdaten an Meta übermittelt; Instagram kann Cookies verwenden.</p><button type="button" className="button primary" onClick={()=>setLoaded(true)}><Instagram size={17}/> Instagram-Vorschau laden</button><span className="instagram-privacy"><ShieldCheck size={14}/> Erst nach deinem Klick. Nur für diesen Besuch.</span></div>}
    </div>
  </section>;
}
