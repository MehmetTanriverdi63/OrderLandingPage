import { test,expect } from '@playwright/test';
test('test online payment hands off to hosted checkout without collecting card data',async({page})=>{
  await page.route('**/api/menu?*',async route=>{
    const response=await route.fetch();const menu=await response.json();
    await route.fulfill({json:{...menu,stripeEnabled:true}});
  });
  await page.route('**/api/orders',route=>route.fulfill({status:201,json:{id:'test-order',token:'test-private-token',paymentUrl:'https://checkout.stripe.com/test_fixture'}}));
  await page.route('https://checkout.stripe.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Mock Stripe test checkout</h1>'}));
  await page.goto('/');
  await page.getByRole('button',{name:'Deal sichern'}).click();
  await page.getByRole('button',{name:/Hinzufügen ·/}).click();
  await page.locator('.cart-button').click();
  await page.getByRole('button',{name:'Weiter zur Kasse'}).click();
  await page.getByLabel('Dein Name',{exact:true}).fill('Testkunde');
  await page.getByLabel(/Telefonnummer/).fill('015119137118');
  await page.locator('select[name=pickup]').selectOption({index:1});
  await page.getByRole('radio',{name:/Online bezahlen/}).check();
  await page.locator('input[name=consent]').check();
  const request=page.waitForRequest(request=>request.url().endsWith('/api/orders')&&request.method()==='POST');
  await page.getByRole('button',{name:/Online bestellen/}).click();
  await expect(page.getByRole('alertdialog')).toContainText('kein echtes Geld');
  await page.getByRole('button',{name:'Weiter zur Stripe-Testzahlung'}).click();
  expect((await request).postDataJSON().paymentMethod).toBe('stripe');
  await expect(page).toHaveURL('https://checkout.stripe.com/test_fixture');
  await expect(page.getByRole('heading',{name:'Mock Stripe test checkout'})).toBeVisible();
});
