import {test,expect} from '@playwright/test';
test('allergen guide is searchable, readable and never claims dish-level safety',async({page})=>{
 await page.goto('/allergene');
 await expect(page.locator('.allergen-grid li')).toHaveCount(14);
 await expect(page.locator('.allergen-confirmation')).toContainText('Angaben pro Gericht noch nicht bestätigt');
 await expect(page.locator('.allergen-confirmation a')).toHaveAttribute('href','tel:062412107548');
 await page.getByLabel('Allergengruppe suchen',{exact:true}).fill('Laktose');
 await expect(page.locator('.allergen-grid li')).toHaveCount(1);
 await page.locator('.allergen-grid summary').click();
 await expect(page.locator('.allergen-grid details>p')).toBeVisible();
 await expect(page.locator('.allergen-grid details>p')).toContainText('einschließlich Laktose');
 await page.getByLabel('Allergengruppe suchen',{exact:true}).fill('unbekannt-xyz');
 await expect(page.getByText('Keine passende Gruppe gefunden.',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Alle Gruppen anzeigen'}).click();
 await expect(page.locator('.allergen-grid li')).toHaveCount(14);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`/tmp/allergens-${test.info().project.name}.png`,fullPage:true});
});
test('product configuration links to allergen information before adding to cart',async({page})=>{
 await page.goto('/angebot');
 await page.getByRole('button',{name:'Menü zusammenstellen',exact:true}).first().click();
 const notice=page.getByRole('dialog').locator('.allergen-quick-note');
 await expect(notice).toContainText('Die Allergenangaben für dieses Gericht, Soßen und Extras sind noch nicht bestätigt.');
 await expect(notice.getByRole('link',{name:'Allergenhinweise ansehen'})).toHaveAttribute('href','/allergene');
 await expect(notice.getByRole('link',{name:'Allergenhinweise ansehen'})).toHaveAttribute('target','_blank');
});
