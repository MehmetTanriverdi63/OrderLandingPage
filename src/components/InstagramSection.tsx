import { ArrowUpRight, Instagram } from 'lucide-react';
import { INSTAGRAM_URL } from '../../shared/model';

export default function InstagramSection() {
  return <section className="container instagram-section" id="instagram" aria-labelledby="instagram-heading">
    <div className="instagram-copy"><div className="eyebrow"><Instagram size={16}/> AUS UNSERER KÜCHE</div>
      <h2 id="instagram-heading">Gutes Essen.<br/><em>Neue Geschichten.</em></h2>
      <p>Was brutzelt gerade? Was gibt’s Neues bei uns in Worms? Unsere aktuellen Beiträge, Reels und Einblicke findest du auf Instagram.</p>
      <a className="button primary" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"><Instagram size={18}/> Auf Instagram entdecken <ArrowUpRight size={17}/></a>
      <p className="instagram-caption">@mediterranekucheworms · direkt zum Original</p>
    </div>
    <a className="instagram-editorial" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Aktuelle Beiträge von Mediterrane Küche auf Instagram öffnen">
      <img src="/images/doner.webp" alt="Illustratives Beispielbild: Döner mit frischen Zutaten" loading="lazy"/>
      <span className="instagram-editorial-label"><Instagram size={18}/> Mediterrane Küche · Worms</span>
      <span className="instagram-editorial-caption"><span>APPETIT AUF MEHR?</span><b>Wir sehen uns<br/>auf Instagram.</b><span className="instagram-editorial-link">Beiträge & Reels entdecken <ArrowUpRight size={19}/></span></span>
    </a>
  </section>;
}
