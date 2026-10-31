import { test, expect } from '@playwright/test';
test.beforeEach(async ({ context }) => { await context.setExtraHTTPHeaders({ 'CF-Connecting-IP': `e2e-${crypto.randomUUID()}` }); });
test('Instagram deal → extras → cash checkout → private status → restaurant accepts', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Guter Hunger/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Deal sichern' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Deal sichern' }).click();
  await page.getByText('Feta', { exact: true }).click();
  await page.getByRole('button', { name: 'Menge erhöhen' }).click();
  await expect(page.getByRole('button', { name: /Hinzufügen · 23,80/ })).toBeVisible();
  await page.getByRole('button', { name: /Hinzufügen · 23,80/ }).click();
  await page.locator('.cart-button').click();
  await expect(page.getByRole('dialog')).toContainText('23,80');
  await page.getByRole('button', { name: 'Weiter zur Kasse' }).click();
  await page.getByLabel('Dein Name', { exact: true }).fill('Browser Testgast');
  await page.getByLabel(/Telefonnummer/).fill('01234567890');
  await page.locator('select[name=pickup]').selectOption({ index: 1 });
  await page.locator('input[name=consent]').check();
  await page.getByRole('button', { name: /Testbestellung aufgeben/ }).click();
  await expect(page.getByText('Deine Bestellung ist angekommen.', { exact: true })).toBeVisible();
  const trackingUrl = page.url();
  const admin = await context.newPage(); await admin.goto('/admin');
  await admin.getByLabel('Benutzername oder E-Mail', { exact: true }).fill('demo@mediterrane.local');
  await admin.getByLabel('Passwort', { exact: true }).fill('Demo-2026!');
  await admin.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(admin.getByRole('heading', { name: 'Deine Bestellungen' })).toBeVisible();
  const card = admin.locator('.admin-order').filter({ hasText: 'Browser Testgast' }).first();
  await card.getByRole('button', { name: 'Annehmen', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Als abholbereit markieren' })).toBeVisible();
  await page.goto(trackingUrl);
  await expect(page.getByText('Wir machen’s frisch für dich.', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Als abholbereit markieren' }).click();
  await expect(page.getByText('Dein Essen ist abholbereit!', { exact: true })).toBeVisible({ timeout: 12000 });
  await card.getByRole('button', { name: /Abgeholt/ }).click();
  await expect(page.getByText('Lass es dir schmecken!', { exact: true })).toBeVisible({ timeout: 12000 });
  expect(errors).toEqual([]);
});
test('cart survives reload, quantities and keyboard modal dismissal work', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Knusprige Pommes hinzufügen' }).click();
  await page.getByRole('button', { name: /Hinzufügen ·/ }).click();
  await page.reload(); await page.locator('.cart-button').click();
  await expect(page.getByRole('dialog')).toContainText('Knusprige Pommes');
  await page.getByRole('button', { name: 'Menge verringern' }).click();
  await expect(page.getByText('Platz für etwas Leckeres.')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('menu card search, dish numbers, and reversible pizza extras', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Gericht oder Nummer suchen' }).fill('44');
  const seafood = page.locator('.product-card').filter({ hasText: 'Spaghetti Frutti di Mare' });
  await expect(seafood).toContainText('Nr. 44');
  await expect(seafood).toContainText('13,90');
  await page.getByRole('searchbox').fill('unbekanntes-gericht-xyz');
  await expect(page.getByText('Dein Gericht ist noch nicht dabei?')).toBeVisible();
  await page.getByRole('button', { name: 'Alle Gerichte anzeigen', exact: true }).click();
  await page.getByRole('button', { name: 'Pizza', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('26 Gerichte');
  await page.getByRole('button', { name: 'Pizza Margherita hinzufügen', exact: true }).click();
  await expect(page.getByRole('button', { name: /Hinzufügen · 9,50/ })).toBeVisible();
  await page.getByRole('checkbox', { name: /Feta-Käse/ }).check();
  await page.getByRole('checkbox', { name: /Extra Dönerfleisch/ }).check();
  await expect(page.getByRole('button', { name: /Hinzufügen · 14,40/ })).toBeVisible();
  await page.getByRole('checkbox', { name: /Feta-Käse/ }).uncheck();
  await expect(page.getByRole('button', { name: /Hinzufügen · 12,40/ })).toBeVisible();
  await page.getByRole('button', { name: /Hinzufügen · 12,40/ }).click();
  await page.locator('.cart-button').click();
  await expect(page.getByRole('dialog')).toContainText('Pizza Margherita');
  await expect(page.getByRole('dialog')).toContainText('12,40');
});
test('source opening times remain available and schnitzel is removed', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Schnitzel', exact: true })).toHaveCount(0);
  await page.getByRole('searchbox').fill('Schnitzel');
  await expect(page.getByText('Dein Gericht ist noch nicht dabei?')).toBeVisible();
  await expect(page.locator('.restaurant-details')).toContainText('Friedrich-Ebert-Str. 50');
  await expect(page.locator('.restaurant-phone')).toHaveAttribute('href','tel:062412107548');
  await expect(page.locator('.opening-hours')).toContainText('11:30 – 22:00 Uhr');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('saved phone requires confirmation and can be declined', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mediterrane-saved-phone', JSON.stringify('01234567890')));
  async function checkout() {
    await page.goto('/');
    await page.getByRole('button', {name:'Deal sichern'}).click();
    await page.getByRole('button', {name:/Hinzufügen ·/}).click();
    await page.locator('.cart-button').click();
    await page.getByRole('button', {name:'Weiter zur Kasse'}).click();
  }
  await checkout();
  await expect(page.getByLabel(/Telefonnummer/)).toHaveValue('');
  await page.getByRole('button', {name:'Nicht übernehmen',exact:true}).click();
  await expect(page.getByLabel(/Telefonnummer/)).toHaveValue('');
  await page.reload();
  await page.locator('.cart-button').click();
  await page.getByRole('button', {name:'Weiter zur Kasse'}).click();
  await page.getByRole('button', {name:'Übernehmen',exact:true}).click();
  await expect(page.getByLabel(/Telefonnummer/)).toHaveValue('01234567890');
  expect(await page.locator('#customer-phone').evaluate((input:HTMLInputElement)=>input.checkValidity())).toBe(true);
});

test('food photos load without stretching', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name:'Pizza',exact:true}).click();
  const photo=page.locator('.product-card .food-photo img').first();
  await photo.scrollIntoViewIfNeeded();
  await expect(photo).toBeVisible();
  await expect.poll(()=>photo.evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  const ratio=await photo.evaluate((img:HTMLImageElement)=>({actual:img.width/img.height,natural:img.naturalWidth/img.naturalHeight}));
  expect(ratio.actual).toBeCloseTo(ratio.natural,2);
  await page.screenshot({path:`/tmp/menu-${test.info().project.name}.png`,fullPage:false});
});

test('contact picker asks before using a selected number', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator,'contacts',{configurable:true,value:{select:async()=>[{tel:['01234567890']}]}}));
  await page.goto('/');
  await page.getByRole('button',{name:'Deal sichern'}).click();
  await page.getByRole('button',{name:/Hinzufügen ·/}).click();
  await page.locator('.cart-button').click();
  await page.getByRole('button',{name:'Weiter zur Kasse'}).click();
  await page.getByRole('button',{name:'Eigene Nummer aus Kontakt auswählen'}).click();
  await expect(page.getByText('Ist das deine eigene Telefonnummer?')).toBeVisible();
  await expect(page.getByLabel(/Telefonnummer/)).toHaveValue('');
  await page.getByRole('button',{name:'Übernehmen',exact:true}).click();
  await expect(page.getByLabel(/Telefonnummer/)).toHaveValue('01234567890');
});

test('mobile autofill restores the German leading zero before checkout', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Deal sichern'}).click();
  await page.getByRole('button',{name:/Hinzufügen ·/}).click();
  await page.locator('.cart-button').click();
  await page.getByRole('button',{name:'Weiter zur Kasse'}).click();
  const phone=page.getByLabel(/Telefonnummer/);
  await phone.fill('15119137118');
  await phone.blur();
  await expect(phone).toHaveValue('015119137118');
  await phone.fill('+4915119137118');
  await phone.blur();
  await expect(phone).toHaveValue('+4915119137118');
});
