import {test,expect} from '@playwright/test';
test('email is optional and an unconfigured sender is not presented as delivered',async({page})=>{
 await page.goto('/angebot');await page.getByRole('button',{name:'Menü zusammenstellen',exact:true}).first().click();await page.getByRole('button',{name:/Hinzufügen ·/}).click();await page.getByRole('button',{name:'Weiter zur Kasse'}).click();
 const email=page.getByLabel(/E-Mail-Adresse/);await expect(email).not.toHaveAttribute('required');await expect(page.getByText(/Automatischer E-Mail-Versand ist noch nicht eingerichtet/)).toBeVisible();await email.fill('gast@example.com');expect(await email.evaluate((el:HTMLInputElement)=>el.checkValidity())).toBe(true);await email.fill('bad-email');expect(await email.evaluate((el:HTMLInputElement)=>el.checkValidity())).toBe(false);
});
test('admin sees accepted-by-provider status without suggesting the message was read',async({page})=>{
 const hours=Array.from({length:7},(_,day)=>({day,open:'11:00',close:'22:00',closed:false}));
 await page.route('**/api/admin/me',route=>route.fulfill({json:{email:'test-admin',restaurant:{name:'Testrestaurant',hours},telegramEnabled:false,stripeEnabled:false,emailEnabled:true}}));
 await page.route('**/api/admin/orders',route=>route.fulfill({json:{orders:[{id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',number:1234,customer_name:'Testgast',phone:'015119137118',customer_email:'gast@example.com',note:'',status:'accepted',payment_method:'cash',payment_status:'unpaid',pickup_at:'2030-01-01T15:00:00.000Z',created_at:'2030-01-01T12:00:00.000Z',total:990,items:[],email_notifications:{received:{state:'accepted',updatedAt:1},accepted:{state:'failed',updatedAt:2}}}]}}));
 await page.goto('/admin');const card=page.locator('.email-status');await expect(card).toContainText('Vom Versanddienst angenommen');await expect(card).toContainText('Versand fehlgeschlagen');await expect(card).toContainText('keine Lese- oder Posteingangsbestätigung');await expect(card.getByRole('link')).toHaveAttribute('href','mailto:gast@example.com');
});
