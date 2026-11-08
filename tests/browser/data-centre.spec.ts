import {test,expect} from '@playwright/test';
async function admin(page:import('@playwright/test').Page,emailEnabled=false){
 const hours=Array.from({length:7},(_,day)=>({day,open:'11:00',close:'22:00',closed:false}));
 await page.route('**/api/admin/me',route=>route.fulfill({json:{email:'admin-test',restaurant:{name:'Testrestaurant',hours},telegramEnabled:false,stripeEnabled:false,emailEnabled}}));
 await page.route('**/api/admin/orders',route=>route.fulfill({json:{orders:[]}}));
 await page.route('**/api/admin/statistics?*',route=>route.fulfill({json:{orders:3,cashTotal:2000,completedCash:1,stripeTestTotal:1000,rejected:1,onlinePreviews:1,daily:[{day:'2026-11-08',orders:3,completedCash:1,cashTotal:2000,stripeTestTotal:1000}],products:[{name:'Pizza Margherita',quantity:2,total:2000}],days:30,limited:false,pageViewsReady:true,pageViewTotal:5,pageViews:[{day:'2026-11-08',page:'/angebot',views:5}]}}));
 await page.route('**/api/admin/privacy',route=>route.fulfill({json:{ready:true,retentionDays:30,automaticCleanup:false}}));
 await page.goto('/admin');await page.getByRole('button',{name:'Statistik & Daten',exact:true}).click();
}
test('monthly download and reviewed privacy action preserve sales reporting',async({page})=>{
 let writes=0;
 await page.route('**/api/admin/privacy/preview?*',route=>route.fulfill({json:{retentionDays:30,cutoff:'2026-10-01T00:00:00Z',totalEligible:1,batchSize:1,previewToken:'a'.repeat(64),orders:[{id:'test-old',number:1234,created_at:'2026-09-01 12:00:00',status:'completed',total:2000}]}}));
 await page.route('**/api/admin/privacy/apply',route=>{writes++;const body=route.request().postDataJSON();expect(body.confirmation).toBe('KONTAKTDATEN ENTFERNEN');expect(body.bookkeepingConfirmed).toBe(true);return route.fulfill({json:{updated:1,skipped:0}});});
 await page.route('**/api/admin/statistics/export?*',route=>route.fulfill({headers:{'Content-Type':'text/csv; charset=utf-8'},body:'\uFEFFGericht;Menge\r\nPizza;2'}));
 await admin(page);await expect(page.getByRole('heading',{name:'Was wurde verkauft?'})).toBeVisible();await expect(page.getByText('Pizza Margherita',{exact:true})).toBeVisible();
 await page.getByLabel('Berichtsmonat',{exact:true}).fill('2026-11');const download=page.waitForEvent('download');await page.getByRole('button',{name:'CSV herunterladen',exact:true}).click();expect((await download).suggestedFilename()).toBe('monatsbericht-2026-11.csv');
 await expect(page.getByRole('button',{name:'Bericht per E-Mail senden'})).toBeDisabled();
 await page.getByRole('button',{name:'Betroffene Bestellungen ansehen'}).click();await expect(page.getByText('Vorschau: 1 von 1 Bestellungen')).toBeVisible();expect(writes).toBe(0);
 const apply=page.getByRole('button',{name:'Kontaktdaten dieser Bestellungen endgültig entfernen'});await expect(apply).toBeDisabled();
 await page.getByLabel('Zur Bestätigung „KONTAKTDATEN ENTFERNEN“ eingeben').fill('KONTAKTDATEN ENTFERNEN');await expect(apply).toBeDisabled();
 await page.getByRole('checkbox',{name:/Ich habe geprüft/}).check();await apply.click();await expect(page.getByText(/1 Bestellungen bearbeitet/)).toBeVisible();expect(writes).toBe(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('monthly email is an explicit admin action and reports provider acceptance accurately',async({page})=>{
 let mailed=0;await page.route('**/api/admin/statistics/email',route=>{mailed++;expect(route.request().postDataJSON().to).toBe('owner@example.com');return route.fulfill({json:{state:'accepted'}});});await admin(page,true);await page.getByLabel('E-Mail-Empfänger des Monatsberichts').fill('owner@example.com');expect(mailed).toBe(0);await page.getByRole('button',{name:'Bericht per E-Mail senden'}).click();await expect(page.getByText(/Bericht vom Versanddienst angenommen/)).toBeVisible();expect(mailed).toBe(1);
});
test('page counter sends only a path, omits cookies and skips private status pages',async({page,context})=>{
 const requests:Array<{body:unknown;cookie:string|undefined}>=[];
 await context.addCookies([{name:'session',value:'test-session',url:'http://127.0.0.1:5173'}]);
 await page.route('**/api/analytics/pageview',async route=>{requests.push({body:route.request().postDataJSON(),cookie:(await route.request().allHeaders()).cookie});await route.fulfill({json:{counted:true}});});
 await page.goto('/angebot?utm_source=instagram');await expect.poll(()=>requests.length).toBe(1);expect(requests[0].body).toEqual({page:'/angebot'});expect(requests[0].cookie).toBeUndefined();
 await page.goto('/datenschutz');await expect(page.getByRole('heading',{name:'Datenschutz',exact:true})).toBeVisible();expect(requests).toHaveLength(1);
 await page.route('**/api/orders/private-fixture',route=>route.fulfill({json:{number:1234,status:'accepted',payment_method:'cash',payment_status:'unpaid',pickup_at:'2030-01-01T15:00:00Z',total:990,items:[]}}));await page.goto('/?order=private-fixture&token=private-token');await expect(page.getByText('Wir machen’s frisch für dich.',{exact:true})).toBeVisible();expect(requests).toHaveLength(1);
});
