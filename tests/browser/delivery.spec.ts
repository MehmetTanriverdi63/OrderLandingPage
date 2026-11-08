import {test,expect} from '@playwright/test';
async function checkout(page:import('@playwright/test').Page){
 await page.goto('/');await page.getByRole('button',{name:'Deal sichern'}).click();await page.getByRole('button',{name:'Menge erhöhen'}).click();await page.getByRole('button',{name:'Menge erhöhen'}).click();await page.getByRole('button',{name:/Hinzufügen ·/}).click();await page.locator('.cart-button').click();await page.getByRole('button',{name:'Weiter zur Kasse'}).click();
 await page.getByRole('radio',{name:/Lieferung/}).check();
 await page.getByLabel('Dein Name',{exact:true}).fill('Liefer Testgast');await page.getByLabel(/Telefonnummer/).fill('015119137118');
 await page.getByLabel('Straße',{exact:true}).fill('Teststraße');await page.getByLabel('Hausnummer',{exact:true}).fill('10');await page.getByLabel('Postleitzahl',{exact:true}).fill('67549');
 await page.getByLabel('Deine gewünschte Lieferzeit').selectOption({index:1});await page.locator('input[name=consent]').check();
}
test('delivery address and online preview require explicit test confirmation before sending',async({page})=>{
 let sent=0;let payload:Record<string,any>={};
 await page.route('**/api/menu?*',async route=>{const response=await route.fetch();const menu=await response.json();await route.fulfill({json:{...menu,stripeEnabled:false}});});
 await page.route('**/api/delivery/check',route=>route.fulfill({json:{allowed:true,distanceKm:2.1,radiusKm:12}}));
 await page.route('**/api/orders',route=>{sent++;payload=route.request().postDataJSON();return route.fulfill({status:201,json:{id:'delivery-fixture',token:'private-test-token',number:1234,total:2970}});});
 await page.route('**/api/orders/delivery-fixture',route=>route.fulfill({json:{number:1234,status:'pending',payment_method:'online_demo',payment_status:'test_only',fulfillment_method:'delivery',delivery_address:payload.deliveryAddress,pickup_at:payload.pickupAt,total:2970,items:[]}}));
 await checkout(page);
 await page.getByRole('button',{name:'Lieferadresse prüfen'}).click();await expect(page.getByText(/Im Liefergebiet/)).toBeVisible();
 const options=await page.locator('select[name=pickup] option:not([disabled])').evaluateAll(options=>options.map(o=>(o as HTMLOptionElement).value));
 for(const slot of options){const time=new Date(slot).toLocaleTimeString('en-GB',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'});expect(time>='16:00'&&time<='21:30').toBe(true);}
 await page.getByRole('radio',{name:/Online bezahlen/}).check();
 await page.getByRole('button',{name:/Online bestellen/}).click();
 await expect(page.getByRole('alertdialog')).toContainText('nur zu Testzwecken');expect(sent).toBe(0);
 await page.getByRole('button',{name:'Zurück',exact:true}).click();expect(sent).toBe(0);await expect(page.getByLabel('Straße',{exact:true})).toHaveValue('Teststraße');
 await page.getByRole('button',{name:/Online bestellen/}).click();await page.getByRole('button',{name:'Testbestellung bestätigen',exact:true}).click();
 await expect(page.getByText('Deine Bestellung ist angekommen.',{exact:true})).toBeVisible();
 expect(sent).toBe(1);expect(payload.fulfillmentMethod).toBe('delivery');expect(payload.deliveryAddress).toMatchObject({street:'Teststraße',houseNumber:'10',postalCode:'67549',city:'Worms'});expect(payload.paymentMethod).toBe('online_demo');
 await expect(page.getByText('Online-Testvorschau: keine Abbuchung, nicht bezahlt.')).toBeVisible();await expect(page.locator('.delivery-summary')).toContainText('Teststraße 10');
});
test('outside delivery address is rejected and a changed address needs a fresh check',async({page})=>{
 let allowed=true,sent=0;
 await page.route('**/api/delivery/check',route=>route.fulfill({json:{allowed,distanceKm:allowed?2:15,radiusKm:12}}));
 await page.route('**/api/orders',route=>{sent++;return route.fulfill({status:500,json:{error:'Must not submit'}});});
 await checkout(page);await page.getByRole('button',{name:'Lieferadresse prüfen'}).click();await expect(page.getByText(/Im Liefergebiet/)).toBeVisible();
 await page.getByLabel('Hausnummer',{exact:true}).fill('99');await expect(page.getByText(/Im Liefergebiet/)).toHaveCount(0);
 allowed=false;await page.getByRole('button',{name:'Lieferadresse prüfen'}).click();await expect(page.getByText(/Diese Adresse liegt außerhalb/)).toBeVisible();
 await page.getByRole('button',{name:/Testbestellung aufgeben/}).click();await expect(page.getByText(/Bitte zuerst eine Adresse/)).toBeVisible();expect(sent).toBe(0);
});

test('admin sees delivery address and clearly unpaid online preview',async({page})=>{
 const hours=Array.from({length:7},(_,day)=>({day,open:'11:00',close:'22:00',closed:false}));
 await page.route('**/api/admin/me',route=>route.fulfill({json:{email:'test-admin',restaurant:{name:'Testrestaurant',hours},telegramEnabled:false,stripeEnabled:false}}));
 await page.route('**/api/admin/orders',route=>route.fulfill({json:{orders:[{id:'delivery-admin-fixture',restaurant_id:'mediterrane-worms',number:4321,customer_name:'Liefer Testgast',phone:'015119137118',note:'Ohne Zwiebeln',status:'ready',payment_method:'online_demo',payment_status:'test_only',pickup_at:'2030-01-01T15:00:00.000Z',created_at:'2030-01-01T12:00:00.000Z',total:990,items:[],fulfillment_method:'delivery',delivery_address:{street:'Teststraße',houseNumber:'10',postalCode:'67549',city:'Worms',instructions:'2. Stock'}}]}}));
 await page.goto('/admin');const card=page.locator('.admin-order');await expect(card).toContainText('Teststraße 10, 67549 Worms');await expect(card).toContainText('2. Stock');await expect(card).toContainText('Online-Testvorschau · NICHT bezahlt');await expect(card.locator('.status-badge')).toHaveText('Lieferbereit');await expect(card.getByRole('button',{name:'Zugestellt'})).toBeVisible();
 await page.screenshot({path:`/tmp/delivery-admin-${test.info().project.name}.png`});
});
