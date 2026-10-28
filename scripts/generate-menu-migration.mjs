import { readFileSync, writeFileSync } from 'node:fs';
const source = JSON.parse(readFileSync('data/menu-card.json', 'utf8'));
const q = v => "'" + String(v).replaceAll("'", "''") + "'";
const aliases = { '5': 'salad', '8': 'doner', '15': 'falafel', '17': 'durum', '19': 'lahmacun', 'E1': 'fries' };
const sauces = { id: 'sauce', name: 'Soße', required: true, choices: [{ id: 'knoblauch', name: 'Knoblauch', price: 0 }, { id: 'kraeuter', name: 'Kräuter', price: 0 }, { id: 'scharf', name: 'Scharf', price: 0 }, { id: 'ohne', name: 'Ohne Soße', price: 0 }] };
const extra = { id: 'extra', name: 'Extra', required: false, choices: [{ id: 'none', name: 'Keine Extras', price: 0 }, { id: 'feta', name: 'Feta', price: 200 }, { id: 'fleisch', name: 'Extra Fleisch', price: 290 }] };
const sides = { id: 'side', name: 'Beilage', required: true, choices: [{ id: 'pommes', name: 'Pommes', price: 0 }, { id: 'reis', name: 'Reis', price: 0 }] };
const toppings = source.extras.map(e => ({ id: `extra-${e.id}`, name: e.name, required: false, choices: [{ id: 'add', name: e.name, price: e.price }] }));
const lateSql = ['-- Nr.44: price confirmed by the user as EUR 13.90 after the initial transcription.'];
const sql = ['-- Transcribed from five supplied menu photographs. Unreadable prices are excluded.', 'ALTER TABLE products ADD COLUMN menu_number TEXT;', `UPDATE products SET available=0 WHERE restaurant_id='mediterrane-worms' AND id IN ('ayran');`];
for (let index = 0; index < source.products.length; index++) {
 const p = source.products[index]; if (p.price === null) continue;
 const id = aliases[p.number] || `karte-${p.number.toLowerCase()}`;
 let options = [], image = `illustration:${p.category}`, badge = null;
 if (p.category === 'Salate') image = '/images/menu-grid.png#2,0';
 if (p.category === 'Drehspieß') {
   image = ['17','18','16A'].includes(p.number) ? '/images/menu-grid.png#0,0' : ['15','16'].includes(p.number) ? '/images/menu-grid.png#1,0' : p.number === '19' || p.number === '20' ? '/images/menu-grid.png#0,1' : '/images/doner.png';
   options = [sauces, ...(['14','15','16','16A'].includes(p.number) ? [] : [extra])];
   if (['13','16'].includes(p.number)) options.unshift(sides);
 }
 if (p.category === 'Pizza' || p.category === 'Pide') options = toppings;
 if (p.number === '21') options = [{ id: 'garlic', name: 'Knoblauch', required: true, choices: [{ id: 'with', name: 'Mit Knoblauch', price: 0 }, { id: 'without', name: 'Ohne Knoblauch', price: 0 }] }];
 if (['14','15','16'].includes(p.number)) badge = 'Vegetarisch';
 if (p.number === 'E1') image = '/images/menu-grid.png#1,1';
 if (['E3','E4'].includes(p.number)) options = [{ id: 'pommes', name: 'Mit Pommes', required: false, choices: [{ id: 'add', name: 'Mit Pommes', price: 250 }] }];
 const values = [id,'mediterrane-worms',p.name,p.description,p.category,p.price,image,badge,1,JSON.stringify(options),index+1,p.number];
 const encoded = values.map(v => v === null ? 'NULL' : typeof v === 'number' ? String(v) : q(v)).join(',');
 (p.number === '44' ? lateSql : sql).push(`INSERT INTO products(id,restaurant_id,name,description,category,price,image,badge,available,options,sort_order,menu_number) VALUES (${encoded}) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,category=excluded.category,price=excluded.price,image=excluded.image,badge=excluded.badge,available=excluded.available,options=excluded.options,sort_order=excluded.sort_order,menu_number=excluded.menu_number WHERE products.restaurant_id=excluded.restaurant_id;`);
}
// Update the retained project deal's extras without inventing standalone drink prices.
// Keep the known deal's sauce/drink groups, replacing its price additions explicitly.
const drinks = { id:'drink',name:'Getränk',required:true,choices:[{id:'cola',name:'Cola 0,33 l',price:0},{id:'ayran',name:'Ayran 0,25 l',price:0},{id:'water',name:'Wasser 0,5 l',price:0}] };
sql.push(`UPDATE products SET options=${q(JSON.stringify([sauces,extra,drinks]))},description='Projektangebot: Döner, Pommes und ein Getränk deiner Wahl. Separates Instagram-Special, nicht auf der fotografierten Karte.',sort_order=0 WHERE restaurant_id='mediterrane-worms' AND id='insta-menu';`);
sql.push(`UPDATE restaurants SET name=${q(source.restaurant.name)},address=${q(source.restaurant.address)},phone=${q(source.restaurant.phone)},hours=${q(JSON.stringify(source.restaurant.hours))} WHERE id='mediterrane-worms';`);
writeFileSync('migrations/0004_menu_card.sql', sql.join('\n')+'\n');
writeFileSync('migrations/0005_confirmed_frutti_di_mare.sql',lateSql.join('\n')+'\n');
console.log(`Migrationen: ${source.products.filter(p=>p.price!==null).length} Kartenpositionen, plus Instagram-Menü. Nr.44 bestätigt: 13,90 Euro.`);
