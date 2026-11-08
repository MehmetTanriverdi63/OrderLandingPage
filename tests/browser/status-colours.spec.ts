import {test,expect} from '@playwright/test';
test('dashboard uses distinct labelled colours and direct filters for each order stage',async({page})=>{
 const hours=Array.from({length:7},(_,day)=>({day,open:'11:00',close:'22:00',closed:false}));
 await page.route('**/api/admin/me',route=>route.fulfill({json:{email:'admin-test',restaurant:{name:'Testrestaurant',hours},telegramEnabled:false,stripeEnabled:false,emailEnabled:false}}));
 await page.route('**/api/admin/orders',route=>route.fulfill({json:{orders:['pending','accepted','ready','completed','rejected'].map((status,index)=>({id:`order-${index}`,number:1001+index,customer_name:`Testgast ${index+1}`,phone:'015119137118',note:'',status,payment_method:'cash',payment_status:status==='completed'?'paid':'unpaid',pickup_at:'2030-01-01T16:00:00Z',created_at:'2030-01-01T12:00:00Z',total:990,items:[{name:'Döner-Menü',quantity:1,unitPrice:990,selections:[]}],fulfillment_method:'pickup'}))}}));
 await page.goto('/admin');
 await expect(page.locator('.admin-order')).toHaveCount(3);
 await page.getByRole('button',{name:'Alle',exact:true}).click();await expect(page.locator('.admin-order')).toHaveCount(5);
 const colours=await page.locator('.admin-order .order-head').evaluateAll(elements=>elements.map(element=>getComputedStyle(element).backgroundColor));expect(new Set(colours).size).toBe(5);
 for(const [status,label] of [['pending','Neu'],['accepted','In Zubereitung'],['ready','Abholbereit'],['completed','Abgeschlossen · abgeholt'],['rejected','Abgelehnt']])await expect(page.locator(`.order-state-${status} .status-badge`)).toHaveText(label);
 await page.getByRole('button',{name:'Abgeschlossen',exact:true}).click();await expect(page.locator('.admin-order')).toHaveCount(1);await expect(page.locator('.admin-order')).toHaveClass(/order-state-completed/);
 await page.getByRole('button',{name:'In Zubereitung',exact:true}).click();await expect(page.locator('.admin-order')).toHaveClass(/order-state-accepted/);
 await page.getByRole('button',{name:'Alle',exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`/tmp/order-status-colours-${test.info().project.name}.png`,fullPage:true});
});
