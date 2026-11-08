import {test,expect} from '@playwright/test';
test('Outlook connection UI never requests a password or sends email on opening',async({page})=>{
 const hours=Array.from({length:7},(_,day)=>({day,open:'11:00',close:'22:00',closed:false}));
 await page.route('**/api/admin/me',route=>route.fulfill({json:{email:'admin-test',restaurant:{name:'Testrestaurant',hours},telegramEnabled:false,stripeEnabled:false,emailEnabled:false}}));await page.route('**/api/admin/orders',route=>route.fulfill({json:{orders:[]}}));
 await page.route('**/api/admin/statistics?*',route=>route.fulfill({json:{orders:0,cashTotal:0,completedCash:0,stripeTestTotal:0,rejected:0,onlinePreviews:0,daily:[],products:[],pageViews:[],pageViewTotal:0,pageViewsReady:true}}));await page.route('**/api/admin/privacy',route=>route.fulfill({json:{ready:true,retentionDays:30}}));
 let connected=false;await page.route('**/api/admin/outlook',route=>route.fulfill({json:{configured:true,connected,schemaReady:true,account:connected?'tester@outlook.de':null}}));
 const external:string[]=[];page.on('request',request=>{if(/microsoftonline|graph.microsoft/.test(request.url()))external.push(request.url());});
 await page.goto('/admin');await page.getByRole('button',{name:'Statistik & Daten',exact:true}).click();const section=page.locator('.outlook-connection');await expect(section.getByRole('link',{name:'Microsoft-Konto verbinden'})).toHaveAttribute('href','/api/admin/outlook/connect');await expect(section.locator('input[type=password]')).toHaveCount(0);expect(external).toHaveLength(0);
 connected=true;await page.getByRole('button',{name:'Outlook-Verbindung aktualisieren'}).click();await expect(section).toContainText('tester@outlook.de');await expect(section.getByRole('button',{name:'Verbindung entfernen'})).toBeVisible();expect(external).toHaveLength(0);
});
