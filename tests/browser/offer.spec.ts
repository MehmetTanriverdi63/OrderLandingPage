import {test,expect} from '@playwright/test';
test('Instagram campaign opens a dedicated offer and shared cart enforces the delivery minimum',async({page})=>{
 await page.goto('/angebot?utm_source=instagram&utm_medium=paid_social');
 await expect(page.getByRole('heading',{name:/Dein Döner-Menü/})).toBeVisible();
 await expect(page.locator('.offer-price-row')).toContainText('9,90');
 await expect(page.locator('.offer-fulfillment')).toContainText('20,00');
 await expect(page.locator('.hero')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`/tmp/offer-${test.info().project.name}.png`,fullPage:true});
 await page.reload();await expect(page).toHaveURL(/\/angebot\?utm_source/);
 await page.getByRole('button',{name:'Menü zusammenstellen',exact:true}).first().click();
 await page.getByRole('button',{name:'Menge erhöhen'}).click();
 await page.getByRole('button',{name:/Hinzufügen · 19,80/}).click();
 await expect(page.getByRole('dialog')).toHaveAttribute('aria-label','Dein Warenkorb');
 await page.getByRole('button',{name:'Weiter zur Kasse'}).click();
 await page.getByRole('radio',{name:/Lieferung/}).check();
 await expect(page.locator('.delivery-minimum-notice')).toContainText('0,20');
 await expect(page.getByRole('button',{name:/Testbestellung aufgeben/})).toBeDisabled();
 await page.getByRole('button',{name:'Warenkorb ändern'}).click();
 await page.getByRole('button',{name:'Menge erhöhen'}).click();
 await page.getByRole('button',{name:'Weiter zur Kasse'}).click();
 await page.getByRole('radio',{name:/Lieferung/}).check();
 await expect(page.locator('.delivery-minimum-notice')).toHaveCount(0);
 await expect(page.locator('.totals')).toContainText('29,70');
});
test('legal pages are directly reachable and visibly identify missing operator and allergen details',async({page})=>{
 for(const [path,title] of [['/impressum','Impressum'],['/datenschutz','Datenschutz'],['/allergene','Allergene & Hinweise']]){
  const response=await page.goto(path);expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
  await expect(page.locator('.legal-missing').first()).toContainText('NOCH ERGÄNZEN:');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await expect(page.locator('.legal-content li')).toHaveCount(14);
 await page.goto('/impressum');await expect(page.locator('.legal-content')).toContainText('KI-generierte');
 await page.goto('/angebot');await page.getByRole('link',{name:'Datenschutz',exact:true}).click();await expect(page).toHaveURL(/\/datenschutz$/);
});
