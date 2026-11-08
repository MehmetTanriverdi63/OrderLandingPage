import {test,expect} from '@playwright/test';
test('closed order status button pulses only while awaiting acceptance',async({page})=>{
 let status='pending';
 await page.route('**/api/orders/tracking-fixture',route=>route.fulfill({json:{id:'tracking-fixture',number:1234,status,payment_method:'cash',payment_status:'unpaid',fulfillment_method:'pickup',pickup_at:'2030-01-01T16:00:00.000Z',total:990,items:[]}}));
 await page.goto('/?order=tracking-fixture&token=private-fixture');
 await expect(page.getByText('Deine Bestellung ist angekommen.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Schließen',exact:true}).click();
 const button=page.getByRole('button',{name:'Bestellstatus ansehen',exact:true});
 await expect(button).toHaveClass(/tracking-chip-pending/);
 expect(await button.evaluate(el=>getComputedStyle(el).animationName)).toBe('tracking-button-pulse');
 await page.emulateMedia({reducedMotion:'reduce'});
 expect(await button.evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 status='accepted';
 await expect(button).not.toHaveClass(/tracking-chip-pending/,{timeout:8000});
 await button.click();
 await expect(page.getByText('Wir machen’s frisch für dich.',{exact:true})).toBeVisible();
});
