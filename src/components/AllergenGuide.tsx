import { useState } from 'react';
import { ChevronDown, Egg, Fish, Info, Leaf, Milk, Nut, Phone, Search, Wheat } from 'lucide-react';
const groups=[
 {name:'Glutenhaltiges Getreide',example:'Zum Beispiel Weizen, Roggen, Gerste, Hafer, Dinkel und entsprechende Hybridstämme – sowie daraus hergestellte Erzeugnisse.',icon:Wheat},
 {name:'Krebstiere',example:'Zum Beispiel Garnelen, Krabben und Hummer – sowie daraus hergestellte Erzeugnisse.',icon:Fish},
 {name:'Eier',example:'Eier und daraus hergestellte Erzeugnisse.',icon:Egg},
 {name:'Fisch',example:'Fisch und daraus hergestellte Erzeugnisse.',icon:Fish},
 {name:'Erdnüsse',example:'Erdnüsse und daraus hergestellte Erzeugnisse. Sie bilden eine eigene Gruppe neben Schalenfrüchten.',icon:Nut},
 {name:'Soja',example:'Sojabohnen und daraus hergestellte Erzeugnisse.',icon:Leaf},
 {name:'Milch & Laktose',example:'Milch und daraus hergestellte Erzeugnisse, einschließlich Laktose.',icon:Milk},
 {name:'Schalenfrüchte',example:'Mandeln, Haselnüsse, Walnüsse, Cashewnüsse, Pekannüsse, Paranüsse, Pistazien und Macadamia-/Queenslandnüsse – sowie daraus hergestellte Erzeugnisse.',icon:Nut},
 {name:'Sellerie',example:'Sellerie und daraus hergestellte Erzeugnisse.',icon:Leaf},
 {name:'Senf',example:'Senf und daraus hergestellte Erzeugnisse.',icon:Leaf},
 {name:'Sesam',example:'Sesamsamen und daraus hergestellte Erzeugnisse.',icon:Leaf},
 {name:'Schwefeldioxid & Sulfite',example:'Schwefeldioxid und Sulfite in Konzentrationen von mehr als 10 mg/kg oder 10 mg/l, als insgesamt vorhandenes SO₂ im verzehrfertigen Produkt.',icon:Info},
 {name:'Lupinen',example:'Lupinen und daraus hergestellte Erzeugnisse.',icon:Leaf},
 {name:'Weichtiere',example:'Zum Beispiel Muscheln, Schnecken und Tintenfisch – sowie daraus hergestellte Erzeugnisse.',icon:Fish},
];
export function AllergenNotice({product=false}:{product?:boolean}){
 return <aside className="allergen-quick-note"><Info size={19} aria-hidden="true"/><div><b>Du hast eine Allergie oder Unverträglichkeit?</b><p>{product?'Die Allergenangaben für dieses Gericht, Soßen und Extras sind noch nicht bestätigt.':'Die bestätigten Allergenangaben je Gericht fehlen noch.'} Bitte vor dem Bestellen beim Restaurant nachfragen.</p><div><a href="/allergene" target="_blank" rel="noopener noreferrer">Allergenhinweise ansehen</a><a href="tel:062412107548"><Phone size={13} aria-hidden="true"/>06241 2107548</a></div></div></aside>;
}
export default function AllergenGuide(){
 const [query,setQuery]=useState('');
 const search=query.toLocaleLowerCase('de').trim();
 const visible=groups.filter(item=>`${item.name} ${item.example}`.toLocaleLowerCase('de').includes(search));
 return <section className="allergen-guide" aria-labelledby="allergen-guide-title">
  <div className="allergen-intro"><span className="allergen-intro-icon"><Leaf size={26} aria-hidden="true"/></span><div><h2 id="allergen-guide-title">Gut informiert. Bewusst genießen.</h2><p>Hier findest du die 14 kennzeichnungspflichtigen Allergengruppen verständlich erklärt. Tippe auf eine Gruppe, um Beispiele zu sehen.</p></div></div>
  <div className="allergen-confirmation"><b>Angaben pro Gericht noch nicht bestätigt</b><p>Diese Übersicht erklärt Begriffe. Sie sagt nicht, welche Allergene in deinem Essen enthalten sind. Aus fehlenden Angaben folgt keine Allergenfreiheit.</p><a className="button primary" href="tel:062412107548"><Phone size={17}/>Beim Restaurant nachfragen</a></div>
  <label className="allergen-search"><Search size={18} aria-hidden="true"/><span className="sr-only">Allergengruppe suchen</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Zum Beispiel Milch, Gluten oder Sesam"/></label>
  <p className="allergen-count" role="status">{visible.length} von 14 Allergengruppen</p>
  <ul className="allergen-grid">{visible.map(({name,example,icon:Icon})=><li key={name}><details><summary><span className="allergen-symbol"><Icon size={22} aria-hidden="true"/></span><span><b>{name}</b><small>Erklärung ansehen</small></span><ChevronDown size={16} aria-hidden="true"/></summary><p>{example}</p></details></li>)}</ul>
  {!visible.length&&<div className="allergen-empty"><p>Keine passende Gruppe gefunden. Versuche einen anderen Begriff oder frage direkt beim Restaurant nach.</p><button type="button" className="button secondary" onClick={()=>setQuery('')}>Alle Gruppen anzeigen</button></div>}
  <div className="allergen-extra-info"><h3>Auch Soßen, Extras und Getränke gehören dazu</h3><p>Die Zutaten können sich je nach Auswahl und Zubereitung unterscheiden. Bitte kläre auch mögliche Kreuzkontakte in der Küche. Eine Notiz im Warenkorb ersetzt keine verbindliche Auskunft.</p><h3>Und die Zusatzstoffe?</h3><p>Die bestätigte Zusatzstofflegende des Restaurants fehlt ebenfalls noch. Wir übernehmen keine unklaren Buchstaben- oder Zahlencodes aus der Speisekarte.</p></div>
 </section>;
}
